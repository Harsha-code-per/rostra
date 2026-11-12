from datetime import date, datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee


async def process_check_in(
    db: AsyncSession, employee_id: str, company_id: str, notes: Optional[str] = None
) -> Attendance:
    today = date.today()
    stmt = select(Attendance).where(
        Attendance.company_id == company_id,
        Attendance.employee_id == employee_id,
        Attendance.work_date == today,
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()

    now_utc = datetime.now(timezone.utc)

    if record and record.check_in is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee has already checked in today at {record.check_in.strftime('%H:%M:%S')}",
        )

    if record:
        record.check_in = now_utc
        record.status = AttendanceStatus.PRESENT
        if notes:
            record.notes = notes
    else:
        record = Attendance(
            company_id=company_id,
            employee_id=employee_id,
            work_date=today,
            check_in=now_utc,
            check_out=None,
            total_hours=0.0,
            status=AttendanceStatus.PRESENT,
            notes=notes or "Checked in via Rostra",
        )
        db.add(record)

    try:
        await db.commit()
    except IntegrityError:  # concurrent double check-in hit the unique (employee, day) constraint
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee has already checked in today")
    await db.refresh(record)
    return record


async def override_attendance(
    db: AsyncSession,
    company_id: str,
    employee_ref: str,
    work_date: date,
    new_status: AttendanceStatus,
    total_hours: Optional[float],
    notes: Optional[str],
) -> Attendance:
    """HR/Admin manual correction: upsert the attendance row for one employee and day."""
    emp = (
        await db.execute(
            select(Employee).where(
                Employee.company_id == company_id,
                (Employee.id == employee_ref) | (Employee.employee_id == employee_ref),
            )
        )
    ).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Employee {employee_ref} not found in this company")

    record = (
        await db.execute(
            select(Attendance).where(
                Attendance.company_id == company_id,
                Attendance.employee_id == emp.id,
                Attendance.work_date == work_date,
            )
        )
    ).scalar_one_or_none()
    if not record:
        record = Attendance(company_id=company_id, employee_id=emp.id, work_date=work_date)
        db.add(record)
    record.status = new_status
    if total_hours is not None:
        record.total_hours = total_hours
    elif new_status in (AttendanceStatus.ABSENT, AttendanceStatus.ON_LEAVE):
        record.total_hours = 0.0
    if notes is not None:
        record.notes = notes
    await db.commit()
    await db.refresh(record)
    return record


async def process_check_out(
    db: AsyncSession, employee_id: str, company_id: str, notes: Optional[str] = None
) -> Attendance:
    today = date.today()
    stmt = select(Attendance).where(
        Attendance.company_id == company_id,
        Attendance.employee_id == employee_id,
        Attendance.work_date == today,
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()

    if not record or not record.check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No check-in record found for today. Please check in first.",
        )

    if record.check_out is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee has already checked out today at {record.check_out.strftime('%H:%M:%S')}",
        )

    now_utc = datetime.now(timezone.utc)
    check_in_dt = record.check_in
    if check_in_dt.tzinfo is None:
        check_in_dt = check_in_dt.replace(tzinfo=timezone.utc)

    duration_seconds = (now_utc - check_in_dt).total_seconds()
    duration_hours = max(0.1, round(duration_seconds / 3600.0, 2))

    record.check_out = now_utc
    record.total_hours = duration_hours
    if duration_hours < 5.0:
        record.status = AttendanceStatus.HALF_DAY
    else:
        record.status = AttendanceStatus.PRESENT

    if notes:
        record.notes = (record.notes + " | " + notes) if record.notes else notes

    await db.commit()
    await db.refresh(record)
    return record


async def get_employee_attendance_history(
    db: AsyncSession,
    employee_id: str,
    company_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict[str, Any]:
    today = date.today()
    if not start_date:
        start_date = date(today.year, today.month, 1)
    if not end_date:
        end_date = today

    stmt = (
        select(Attendance)
        .where(
            Attendance.company_id == company_id,
            Attendance.employee_id == employee_id,
            Attendance.work_date >= start_date,
            Attendance.work_date <= end_date,
        )
        .order_by(Attendance.work_date.desc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    # Find today's specific state
    today_rec = next((r for r in records if r.work_date == today), None)
    today_status = {
        "checked_in": bool(today_rec and today_rec.check_in),
        "checked_out": bool(today_rec and today_rec.check_out),
        "check_in_time": today_rec.check_in if today_rec else None,
        "check_out_time": today_rec.check_out if today_rec else None,
        "status": today_rec.status.value if today_rec else "ABSENT",
    }

    present_days = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
    half_days = sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY)
    leaves_taken = sum(1 for r in records if r.status == AttendanceStatus.ON_LEAVE)
    total_hours = sum(r.total_hours for r in records)

    summary = {
        "total_working_days": 22,
        "present_days": present_days,
        "half_days": half_days,
        "leaves_taken": leaves_taken,
        "total_hours_worked": round(total_hours, 2),
    }

    return {
        "today": today_status,
        "summary": summary,
        "records": records,
    }


async def get_company_attendance(
    db: AsyncSession,
    company_id: str,
    work_date: Optional[date] = None,
    department: Optional[str] = None,
) -> List[Dict[str, Any]]:
    target_date = work_date or date.today()

    emp_stmt = (
        select(Employee)
        .where(Employee.company_id == company_id)
    )
    if department and department.lower() != "all":
        emp_stmt = emp_stmt.where(Employee.department == department)

    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()

    # Fetch attendance records for all employees in this company on target_date
    att_stmt = select(Attendance).where(
        Attendance.company_id == company_id,
        Attendance.work_date == target_date,
    )
    att_result = await db.execute(att_stmt)
    att_map = {a.employee_id: a for a in att_result.scalars().all()}

    grid = []
    for emp in employees:
        att = att_map.get(emp.id)
        grid.append({
            "id": att.id if att else None,
            "employee_id": emp.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}",
            "department": emp.department,
            "avatar_url": emp.avatar_url,
            "work_date": target_date,
            "check_in": att.check_in if att else None,
            "check_out": att.check_out if att else None,
            "total_hours": att.total_hours if att else 0.0,
            "status": att.status.value if att else ("ON_LEAVE" if emp.status.value == "ON_LEAVE" else "ABSENT"),
            "notes": att.notes if att else None,
        })

    return grid

