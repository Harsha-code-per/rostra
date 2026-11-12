from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.models.payroll import SalaryStructure
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import LeaveRequest, LeaveStatus, LeaveType


def calculate_salary_structure(wage: float) -> Dict[str, float]:
    """
    Dynamic Salary Calculation Formula:
    - Basic: 50% of Wage
    - HRA: 50% of Basic
    - Standard Allowance: ₹4,167 (fixed standard deduction)
    - Performance Bonus: 8.33% of Basic
    - LTA: 8.33% of Basic
    - Fixed Allowance: Residual balancing component (Wage - sum of earnings)
    - PF: 12% of Basic
    - Professional Tax: ₹200 (standard state PT)
    - Gross Salary = Wage
    - Total Deductions = PF + PT
    - Net Salary = Gross Salary - Total Deductions
    """
    wage = float(round(wage, 2))
    basic = round(wage * 0.50, 2)
    hra = round(basic * 0.50, 2)
    performance_bonus = round(basic * 0.0833, 2)
    lta = round(basic * 0.0833, 2)

    # Components always add up to the wage: the standard allowance shrinks for very low wages.
    standard_allowance = min(4167.00, round(wage - (basic + hra + performance_bonus + lta), 2))
    fixed_allowance = round(wage - (basic + hra + standard_allowance + performance_bonus + lta), 2)

    gross_salary = wage
    pf = round(basic * 0.12, 2)
    professional_tax = 200.00
    total_deductions = round(pf + professional_tax, 2)
    net_salary = round(gross_salary - total_deductions, 2)

    return {
        "wage": wage,
        "basic": basic,
        "hra": hra,
        "standard_allowance": standard_allowance,
        "performance_bonus": performance_bonus,
        "lta": lta,
        "fixed_allowance": fixed_allowance,
        "pf": pf,
        "professional_tax": professional_tax,
        "gross_salary": gross_salary,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
    }


def calculate_payable_payout(
    net_salary: float,
    total_working_days: int = 22,
    present_days: float = 20.0,
    paid_leave_days: float = 2.0,
) -> Dict[str, Any]:
    payable_days = min(float(total_working_days), present_days + paid_leave_days)
    unpaid_days = max(0.0, float(total_working_days) - payable_days)

    if total_working_days > 0:
        effective_net_payout = round(net_salary * (payable_days / total_working_days), 2)
    else:
        effective_net_payout = net_salary

    return {
        "total_working_days": total_working_days,
        "payable_days": payable_days,
        "unpaid_days": unpaid_days,
        "effective_net_payout": effective_net_payout,
    }


async def get_or_create_salary_structure(
    db: AsyncSession, employee_id: str, company_id: str, default_wage: float = 60000.0
) -> SalaryStructure:
    stmt = select(SalaryStructure).where(
        SalaryStructure.company_id == company_id,
        SalaryStructure.employee_id == employee_id,
    )
    result = await db.execute(stmt)
    structure = result.scalar_one_or_none()

    if not structure:
        calc = calculate_salary_structure(default_wage)
        structure = SalaryStructure(
            company_id=company_id,
            employee_id=employee_id,
            effective_from=date.today(),
            **calc,
        )
        db.add(structure)
        await db.commit()
        await db.refresh(structure)

    return structure


async def update_employee_salary(
    db: AsyncSession, employee_id: str, company_id: str, new_wage: float
) -> SalaryStructure:
    calc = calculate_salary_structure(new_wage)

    stmt = select(SalaryStructure).where(
        SalaryStructure.company_id == company_id,
        SalaryStructure.employee_id == employee_id,
    )
    result = await db.execute(stmt)
    structure = result.scalar_one_or_none()

    if structure:
        structure.wage = calc["wage"]
        structure.basic = calc["basic"]
        structure.hra = calc["hra"]
        structure.standard_allowance = calc["standard_allowance"]
        structure.performance_bonus = calc["performance_bonus"]
        structure.lta = calc["lta"]
        structure.fixed_allowance = calc["fixed_allowance"]
        structure.pf = calc["pf"]
        structure.professional_tax = calc["professional_tax"]
        structure.gross_salary = calc["gross_salary"]
        structure.total_deductions = calc["total_deductions"]
        structure.net_salary = calc["net_salary"]
        structure.updated_at = datetime.now(timezone.utc)
    else:
        structure = SalaryStructure(
            company_id=company_id,
            employee_id=employee_id,
            effective_from=date.today(),
            **calc,
        )
        db.add(structure)

    await db.commit()
    await db.refresh(structure)
    return structure


def _weekdays(start: date, end: date) -> int:
    return sum(1 for i in range((end - start).days + 1) if (start + timedelta(days=i)).weekday() < 5)


async def get_employee_payroll_summary(
    db: AsyncSession,
    employee: Employee,
    company_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
) -> Dict[str, Any]:
    structure = await get_or_create_salary_structure(db, employee.id, company_id, default_wage=75000.0)

    # Payroll period: the requested month, counted up to today when it is the current month.
    today = date.today()
    year = year or today.year
    month = month or today.month
    period_start = date(year, month, 1)
    period_end = date(year + (month == 12), month % 12 + 1, 1) - timedelta(days=1)
    counted_end = min(period_end, today)

    present_days = 0.0
    paid_leaves = 0.0
    if counted_end >= period_start:
        records = (
            await db.execute(
                select(Attendance).where(
                    Attendance.company_id == company_id,
                    Attendance.employee_id == employee.id,
                    Attendance.work_date.between(period_start, counted_end),
                )
            )
        ).scalars().all()
        for r in records:
            if r.status == AttendanceStatus.PRESENT:
                present_days += 1.0
            elif r.status == AttendanceStatus.HALF_DAY:
                present_days += 0.5

        leaves = (
            await db.execute(
                select(LeaveRequest)
                .join(LeaveType)
                .where(
                    LeaveRequest.company_id == company_id,
                    LeaveRequest.employee_id == employee.id,
                    LeaveRequest.status == LeaveStatus.APPROVED,
                    LeaveType.is_paid,
                    LeaveRequest.start_date <= counted_end,
                    LeaveRequest.end_date >= period_start,
                )
            )
        ).scalars().all()
        for lv in leaves:  # weekdays of each approved paid leave that fall inside the period
            paid_leaves += _weekdays(max(lv.start_date, period_start), min(lv.end_date, counted_end))

    total_working_days = _weekdays(period_start, counted_end) if counted_end >= period_start else 0

    payable_summary = calculate_payable_payout(
        net_salary=structure.net_salary,
        total_working_days=total_working_days,
        present_days=present_days,
        paid_leave_days=paid_leaves,
    )

    return {
        "employee_id": employee.employee_id,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "department": employee.department,
        "designation": employee.designation,
        "effective_from": structure.effective_from,
        "wage": structure.wage,
        "earnings": {
            "basic": structure.basic,
            "hra": structure.hra,
            "standard_allowance": structure.standard_allowance,
            "performance_bonus": structure.performance_bonus,
            "lta": structure.lta,
            "fixed_allowance": structure.fixed_allowance,
        },
        "deductions": {
            "pf": structure.pf,
            "professional_tax": structure.professional_tax,
        },
        "gross_salary": structure.gross_salary,
        "total_deductions": structure.total_deductions,
        "net_salary": structure.net_salary,
        "attendance_summary": {
            **payable_summary,
            "present_days": present_days,
            "paid_leave_days": paid_leaves,
            "month": month,
            "year": year,
        },
    }

