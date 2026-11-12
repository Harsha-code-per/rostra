from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.permissions import get_current_user
from app.models.profile import Profile
from app.models.employee import Employee, EmployeeStatus
from app.services.payroll_service import update_employee_salary
from app.schemas.employee import EmployeeOut, EmployeeUpdate

router = APIRouter(prefix="/employees", tags=["Employees"])


def employee_to_out(emp: Employee, include_wage: bool = True) -> EmployeeOut:
    wage_val = (emp.salary_structure.wage if emp.salary_structure else 0.0) if include_wage else 0.0
    return EmployeeOut(
        id=emp.id,
        user_id=emp.user_id,
        employee_id=emp.employee_id,
        first_name=emp.first_name,
        last_name=emp.last_name,
        email=emp.email,
        phone=emp.phone,
        department=emp.department,
        designation=emp.designation,
        manager_id=emp.manager_id,
        joining_date=emp.joining_date,
        status=emp.status.value if hasattr(emp.status, "value") else str(emp.status),
        avatar_url=emp.avatar_url,
        address=emp.address,
        emergency_contact=emp.emergency_contact or {},
        wage=wage_val,
        created_at=emp.created_at,
        updated_at=emp.updated_at,
    )


@router.get("/me", response_model=EmployeeOut)
async def get_my_employee_profile(
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found for this user account",
        )

    stmt = (
        select(Employee)
        .where(
            Employee.company_id == current_user.company_id,
            Employee.id == current_user.employee.id,
        )
        .options(selectinload(Employee.salary_structure))
    )
    res = await db.execute(stmt)
    emp = res.scalar_one_or_none()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found in current company",
        )
    return employee_to_out(emp, include_wage=True)


@router.get("", response_model=List[EmployeeOut])
async def list_employees(
    department: Optional[str] = Query(None, description="Filter by department"),
    status: Optional[EmployeeStatus] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, max_length=100, description="Search by name, email, or employee ID"),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Employee)
        .where(Employee.company_id == current_user.company_id)
        .options(selectinload(Employee.salary_structure))
        .order_by(Employee.employee_id.asc())
    )

    if department and department.lower() != "all":
        stmt = stmt.where(Employee.department == department)

    if status:
        stmt = stmt.where(Employee.status == status)

    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Employee.first_name.ilike(s),
                Employee.last_name.ilike(s),
                Employee.email.ilike(s),
                Employee.employee_id.ilike(s),
            )
        )

    result = await db.execute(stmt.limit(limit).offset(offset))
    employees = result.scalars().all()
    user_role = str(current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    is_admin_or_hr = user_role in ["ADMIN", "HR"]

    return [
        employee_to_out(
            e,
            include_wage=(is_admin_or_hr or (current_user.employee and current_user.employee.id == e.id)),
        )
        for e in employees
    ]


@router.get("/{id_or_emp_id}", response_model=EmployeeOut)
async def get_employee(
    id_or_emp_id: str,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Employee)
        .where(
            Employee.company_id == current_user.company_id,
            or_(
                Employee.id == id_or_emp_id,
                Employee.employee_id == id_or_emp_id,
            ),
        )
        .options(selectinload(Employee.salary_structure))
    )
    result = await db.execute(stmt)
    emp = result.scalar_one_or_none()

    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {id_or_emp_id} not found in this company",
        )

    user_role = str(current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    is_admin_or_hr = user_role in ["ADMIN", "HR"]
    can_see_wage = is_admin_or_hr or (
        current_user.employee and (current_user.employee.id == emp.id or current_user.employee.employee_id == emp.employee_id)
    )

    return employee_to_out(emp, include_wage=can_see_wage)


@router.put("/{id_or_emp_id}", response_model=EmployeeOut)
async def update_employee(
    id_or_emp_id: str,
    updates: EmployeeUpdate,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Employee)
        .where(
            Employee.company_id == current_user.company_id,
            or_(
                Employee.id == id_or_emp_id,
                Employee.employee_id == id_or_emp_id,
            ),
        )
        .options(selectinload(Employee.salary_structure))
    )
    result = await db.execute(stmt)
    emp = result.scalar_one_or_none()

    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {id_or_emp_id} not found in this company",
        )

    user_role = str(current_user.role.value if hasattr(current_user.role, "value") else current_user.role)
    is_admin_or_hr = user_role in ["ADMIN", "HR"]
    is_own_profile = current_user.employee and current_user.employee.id == emp.id

    if not is_admin_or_hr and not is_own_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this employee's profile",
        )

    # General allowed updates (both employee self-edit and HR)
    if updates.phone is not None:
        emp.phone = updates.phone
    if updates.address is not None:
        emp.address = updates.address
    if updates.avatar_url is not None:
        emp.avatar_url = updates.avatar_url
    if updates.emergency_contact is not None:
        emp.emergency_contact = updates.emergency_contact

    # HR/Admin only updates
    if is_admin_or_hr:
        if updates.first_name is not None:
            emp.first_name = updates.first_name
        if updates.last_name is not None:
            emp.last_name = updates.last_name
        if updates.department is not None:
            emp.department = updates.department
        if updates.designation is not None:
            emp.designation = updates.designation
        if updates.status is not None:
            emp.status = updates.status
        if updates.wage is not None:
            await update_employee_salary(db, emp.id, current_user.company_id, updates.wage)

    await db.commit()
    await db.refresh(emp)

    # Reload with salary_structure
    stmt_reload = (
        select(Employee)
        .where(Employee.id == emp.id, Employee.company_id == current_user.company_id)
        .options(selectinload(Employee.salary_structure))
    )
    emp_reloaded = (await db.execute(stmt_reload)).scalar_one()

    return employee_to_out(emp_reloaded)

