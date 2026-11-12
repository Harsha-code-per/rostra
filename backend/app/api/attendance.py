from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import get_current_user, require_roles
from app.models.profile import Profile
from app.models.attendance import AttendanceStatus
from app.models.employee import Employee
from app.schemas.attendance import (
    CheckInRequest,
    CheckOutRequest,
    AttendanceOut,
    AttendanceOverrideRequest,
    AttendanceHistoryResponse,
    CompanyAttendanceItem,
)
from app.services.attendance_service import (
    process_check_in,
    process_check_out,
    override_attendance,
    get_employee_attendance_history,
    get_company_attendance,
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.post("/check-in", response_model=AttendanceOut)
async def check_in(
    req: Optional[CheckInRequest] = None,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an associated employee profile to check in",
        )

    notes = req.notes if req else None
    attendance = await process_check_in(db, current_user.employee.id, current_user.company_id, notes)
    return attendance


@router.post("/check-out", response_model=AttendanceOut)
async def check_out(
    req: Optional[CheckOutRequest] = None,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an associated employee profile to check out",
        )

    notes = req.notes if req else None
    attendance = await process_check_out(db, current_user.employee.id, current_user.company_id, notes)
    return attendance


@router.get("/me", response_model=AttendanceHistoryResponse)
async def get_my_attendance_history(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    history = await get_employee_attendance_history(
        db, current_user.employee.id, current_user.company_id, start_date, end_date
    )
    return history


@router.get("", response_model=List[CompanyAttendanceItem])
async def list_company_attendance(
    date: Optional[date] = Query(None, description="Target date (default: today)"),
    department: Optional[str] = Query(None, description="Filter by department or 'all'"),
    current_user: Profile = Depends(require_roles(["ADMIN", "HR"])),
    db: AsyncSession = Depends(get_db),
):
    return await get_company_attendance(db, current_user.company_id, date, department)


@router.put("/override", response_model=AttendanceOut)
async def override_employee_attendance(
    req: AttendanceOverrideRequest,
    current_user: Profile = Depends(require_roles(["ADMIN", "HR"])),
    db: AsyncSession = Depends(get_db),
):
    return await override_attendance(
        db,
        current_user.company_id,
        req.employee_id,
        req.work_date,
        AttendanceStatus(req.status),
        req.total_hours,
        req.notes,
    )


@router.get("/{id_or_emp_id}", response_model=AttendanceHistoryResponse)
async def get_employee_attendance(
    id_or_emp_id: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Lookup employee within caller's company
    stmt = select(Employee).where(
        Employee.company_id == current_user.company_id,
        or_(Employee.id == id_or_emp_id, Employee.employee_id == id_or_emp_id),
    )
    res = await db.execute(stmt)
    emp = res.scalar_one_or_none()

    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {id_or_emp_id} not found in this company",
        )

    user_role = str(current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    is_admin_or_hr = user_role in ["ADMIN", "HR"]
    is_own_record = current_user.employee and (
        current_user.employee.id == emp.id or current_user.employee.employee_id == emp.employee_id
    )

    if not is_admin_or_hr and not is_own_record:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this employee's attendance records",
        )

    return await get_employee_attendance_history(db, emp.id, current_user.company_id, start_date, end_date)


