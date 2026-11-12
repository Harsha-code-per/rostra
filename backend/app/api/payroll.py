from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.permissions import get_current_user, require_roles, role_value
from app.models.profile import Profile
from app.models.employee import Employee
from app.schemas.payroll import (
    SalaryBreakdownOut,
    WageUpdateRequest,
    SalaryRecalculationResponse,
    SalaryComponents,
)
from app.services.payroll_service import (
    calculate_salary_structure,
    update_employee_salary,
    get_employee_payroll_summary,
)

router = APIRouter(tags=["Payroll & Dynamic Salary Engine"])


@router.get("/payroll/me", response_model=SalaryBreakdownOut)
async def get_my_payroll(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    summary = await get_employee_payroll_summary(db, current_user.employee, current_user.company_id, month, year)
    return summary


@router.get("/admin/payroll/{id_or_emp_id}", response_model=SalaryBreakdownOut)
@router.get("/payroll/{id_or_emp_id}", response_model=SalaryBreakdownOut)
async def get_employee_payroll(
    id_or_emp_id: str,
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Employee)
        .where(
            Employee.company_id == current_user.company_id,
            or_(Employee.id == id_or_emp_id, Employee.employee_id == id_or_emp_id),
        )
        .options(selectinload(Employee.salary_structure))
    )
    res = await db.execute(stmt)
    emp = res.scalar_one_or_none()

    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {id_or_emp_id} not found in this company",
        )

    user_role = role_value(current_user.role)
    is_admin_or_hr = user_role in ["ADMIN", "HR"]
    is_own_payroll = current_user.employee and (
        current_user.employee.id == emp.id or current_user.employee.employee_id == emp.employee_id
    )

    if not is_admin_or_hr and not is_own_payroll:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this employee's payroll details",
        )

    return await get_employee_payroll_summary(db, emp, current_user.company_id, month, year)


@router.put("/admin/payroll/{id_or_emp_id}/salary", response_model=SalaryRecalculationResponse)
@router.put("/payroll/{id_or_emp_id}/salary", response_model=SalaryRecalculationResponse)
async def update_wage_and_recalculate(
    id_or_emp_id: str,
    req: WageUpdateRequest,
    current_user: Profile = Depends(require_roles(["ADMIN", "HR"])),
    db: AsyncSession = Depends(get_db),
):
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

    updated_structure = await update_employee_salary(db, emp.id, current_user.company_id, req.wage)

    return SalaryRecalculationResponse(
        message="Salary structure successfully recalculated and saved",
        employee_id=emp.employee_id,
        wage=updated_structure.wage,
        basic=updated_structure.basic,
        hra=updated_structure.hra,
        standard_allowance=updated_structure.standard_allowance,
        performance_bonus=updated_structure.performance_bonus,
        lta=updated_structure.lta,
        fixed_allowance=updated_structure.fixed_allowance,
        pf=updated_structure.pf,
        professional_tax=updated_structure.professional_tax,
        gross_salary=updated_structure.gross_salary,
        total_deductions=updated_structure.total_deductions,
        net_salary=updated_structure.net_salary,
    )


@router.post("/admin/payroll/{id_or_emp_id}/calculate", response_model=SalaryComponents)
async def preview_salary_calculation(
    id_or_emp_id: str,
    req: WageUpdateRequest,
    current_user: Profile = Depends(require_roles(["ADMIN", "HR"])),
):
    calc = calculate_salary_structure(req.wage)
    return SalaryComponents(**calc)

