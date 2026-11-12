from datetime import date, datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.leave import LeaveRequest, LeaveType, LeaveTypeEnum, LeaveStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.profile import Profile, UserRole
from app.models.notification import Notification


MAX_LEAVE_DAYS = 90

DEFAULT_QUOTAS = {
    "PAID": 18,
    "SICK": 10,
    "CASUAL": 6,
    "UNPAID": 0,
}


async def get_or_create_leave_type(db: AsyncSession, company_id: str, type_enum: LeaveTypeEnum) -> LeaveType:
    stmt = select(LeaveType).where(
        LeaveType.company_id == company_id,
        LeaveType.name == type_enum,
    )
    result = await db.execute(stmt)
    lt = result.scalar_one_or_none()
    if not lt:
        lt = LeaveType(
            company_id=company_id,
            name=type_enum,
            is_paid=(type_enum != LeaveTypeEnum.UNPAID),
            default_allocation=DEFAULT_QUOTAS.get(type_enum.value, 10),
            description=f"{type_enum.value} Leave",
        )
        db.add(lt)
        await db.commit()
        await db.refresh(lt)
    return lt


async def apply_for_leave(
    db: AsyncSession,
    employee: Employee,
    company_id: str,
    leave_type_enum: LeaveTypeEnum,
    start_date: date,
    end_date: date,
    reason: str,
    total_days: Optional[int] = None,
    attachment_url: Optional[str] = None,
) -> LeaveRequest:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date",
        )

    # Duration is always derived server-side; any client-supplied total_days is ignored.
    computed_days = (end_date - start_date).days + 1
    if computed_days > MAX_LEAVE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A single leave request cannot exceed {MAX_LEAVE_DAYS} days",
        )

    leave_type = await get_or_create_leave_type(db, company_id, leave_type_enum)

    leave_req = LeaveRequest(
        company_id=company_id,
        employee_id=employee.id,
        leave_type_id=leave_type.id,
        start_date=start_date,
        end_date=end_date,
        total_days=computed_days,
        reason=reason,
        attachment_url=attachment_url,
        status=LeaveStatus.PENDING,
    )
    db.add(leave_req)

    # Dispatch notification to HR users in this company
    hr_stmt = select(Profile).where(
        Profile.company_id == company_id,
        Profile.role.in_([UserRole.HR, UserRole.ADMIN]),
    )
    hr_result = await db.execute(hr_stmt)
    hr_users = hr_result.scalars().all()

    for hr_user in hr_users:
        notif = Notification(
            company_id=company_id,
            user_id=hr_user.id,
            type="LEAVE_SUBMITTED",
            title=f"New Leave Request from {employee.first_name} {employee.last_name}",
            message=f"{computed_days} day(s) {leave_type_enum.value} leave applied for {start_date} to {end_date}.",
        )
        db.add(notif)

    await db.commit()
    await db.refresh(leave_req)
    return leave_req


async def review_leave_request(
    db: AsyncSession,
    leave_id: str,
    company_id: str,
    new_status: LeaveStatus,
    hr_comments: Optional[str],
    reviewer: Profile,
) -> LeaveRequest:
    stmt = (
        select(LeaveRequest)
        .where(
            LeaveRequest.company_id == company_id,
            LeaveRequest.id == leave_id,
        )
        .options(
            selectinload(LeaveRequest.employee).selectinload(Employee.profile),
            selectinload(LeaveRequest.leave_type),
        )
    )
    result = await db.execute(stmt)
    req = result.scalar_one_or_none()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found in this company",
        )

    if req.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This leave request was already {req.status.value.lower()}",
        )

    req.status = new_status
    req.hr_comments = hr_comments or ""
    req.reviewed_by = reviewer.id
    req.reviewed_at = datetime.now(timezone.utc)

    # If APPROVED, synchronize employee status and attendance dates
    if new_status == LeaveStatus.APPROVED:
        today = date.today()
        emp = req.employee

        # If today falls within leave window, mark employee ON_LEAVE
        if req.start_date <= today <= req.end_date:
            emp.status = EmployeeStatus.ON_LEAVE

        # Populate / update attendance records for each weekday in the leave range (one query, not one per day)
        existing = (
            await db.execute(
                select(Attendance).where(
                    Attendance.company_id == company_id,
                    Attendance.employee_id == emp.id,
                    Attendance.work_date.between(req.start_date, req.end_date),
                )
            )
        ).scalars().all()
        by_date = {a.work_date: a for a in existing}
        note = f"Approved {req.leave_type.name.value} Leave"
        current = req.start_date
        while current <= req.end_date:
            if current.weekday() < 5:  # skip Saturday/Sunday
                att = by_date.get(current)
                if att:
                    att.status = AttendanceStatus.ON_LEAVE
                    att.notes = note
                else:
                    db.add(
                        Attendance(
                            company_id=company_id,
                            employee_id=emp.id,
                            work_date=current,
                            check_in=None,
                            check_out=None,
                            total_hours=0.0,
                            status=AttendanceStatus.ON_LEAVE,
                            notes=note,
                        )
                    )
            current += timedelta(days=1)

    # Notify employee
    if req.employee and req.employee.profile:
        notif = Notification(
            company_id=company_id,
            user_id=req.employee.profile.id,
            type=f"LEAVE_{new_status.value}",
            title=f"Leave Request {new_status.value.capitalize()}",
            message=f"Your {req.leave_type.name.value} leave ({req.start_date} to {req.end_date}) was {new_status.value.lower()} by {reviewer.email}. Note: {hr_comments or 'None'}",
        )
        db.add(notif)

    await db.commit()
    await db.refresh(req)
    return req


async def get_leave_balances(
    db: AsyncSession, employee_id: str, company_id: str
) -> Dict[str, Dict[str, int]]:
    stmt = (
        select(LeaveRequest)
        .join(LeaveType)
        .where(
            LeaveRequest.company_id == company_id,
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status == LeaveStatus.APPROVED,
        )
        .options(selectinload(LeaveRequest.leave_type))
    )
    result = await db.execute(stmt)
    approved_requests = result.scalars().all()

    used_map = {"PAID": 0, "SICK": 0, "CASUAL": 0, "UNPAID": 0}
    for req in approved_requests:
        lt_name = req.leave_type.name.value
        if lt_name in used_map:
            used_map[lt_name] += req.total_days

    alloc_rows = (
        await db.execute(select(LeaveType.name, LeaveType.default_allocation).where(LeaveType.company_id == company_id))
    ).all()
    quotas = {**DEFAULT_QUOTAS, **{n.value: a for n, a in alloc_rows}}

    balances = {}
    for name, allocated in quotas.items():
        used = used_map.get(name, 0)
        remaining = max(0, allocated - used) if allocated > 0 else 0
        balances[name] = {
            "allocated": allocated,
            "used": used,
            "remaining": remaining,
        }

    return balances


async def list_leave_requests(
    db: AsyncSession,
    company_id: str,
    employee_id: Optional[str] = None,
    status_filter: Optional[LeaveStatus] = None,
    leave_id: Optional[str] = None,
    limit: int = 500,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    stmt = (
        select(LeaveRequest)
        .where(LeaveRequest.company_id == company_id)
        .options(
            selectinload(LeaveRequest.employee),
            selectinload(LeaveRequest.leave_type),
            selectinload(LeaveRequest.reviewer),
        )
        .order_by(LeaveRequest.created_at.desc())
    )

    if employee_id:
        stmt = stmt.where(LeaveRequest.employee_id == employee_id)
    if status_filter:
        stmt = stmt.where(LeaveRequest.status == status_filter)
    if leave_id:
        stmt = stmt.where(LeaveRequest.id == leave_id)

    result = await db.execute(stmt.limit(limit).offset(offset))
    requests = result.scalars().all()

    items = []
    for r in requests:
        emp = r.employee
        reviewer_name = r.reviewer.email if r.reviewer else None
        items.append({
            "id": r.id,
            "employee_id": emp.employee_id if emp else "",
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else "Unknown",
            "department": emp.department if emp else "General",
            "avatar_url": emp.avatar_url if emp else None,
            "leave_type": r.leave_type.name.value if r.leave_type else "PAID",
            "start_date": r.start_date,
            "end_date": r.end_date,
            "total_days": r.total_days,
            "reason": r.reason,
            "attachment_url": r.attachment_url,
            "status": r.status.value,
            "hr_comments": r.hr_comments,
            "reviewed_by": reviewer_name,
            "reviewed_at": r.reviewed_at,
            "created_at": r.created_at,
        })

    return items

