from datetime import date, timedelta
from typing import Any, Dict, List

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import LeaveRequest, LeaveStatus
from app.models.payroll import SalaryStructure

PRESENT_STATES = (AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY)


async def get_executive_dashboard(db: AsyncSession, company_id: str) -> Dict[str, Any]:
    today = date.today()

    # Headcount, payroll and on-leave count per department, aggregated in SQL
    dept_rows = (
        await db.execute(
            select(
                Employee.department,
                func.count(Employee.id),
                func.coalesce(func.sum(SalaryStructure.wage), 0.0),
                func.sum(case((Employee.status == EmployeeStatus.ON_LEAVE, 1), else_=0)),
            )
            .outerjoin(SalaryStructure, SalaryStructure.employee_id == Employee.id)
            .where(Employee.company_id == company_id)
            .group_by(Employee.department)
        )
    ).all()
    total_employees = sum(r[1] for r in dept_rows)
    monthly_payroll_total = sum(float(r[2]) for r in dept_rows)
    employees_on_leave = sum(int(r[3] or 0) for r in dept_rows)

    # Last 5 days of attendance in one query: (date, status) -> count
    start = today - timedelta(days=4)
    att_rows = (
        await db.execute(
            select(Attendance.work_date, Attendance.status, func.count(Attendance.id))
            .where(Attendance.company_id == company_id, Attendance.work_date.between(start, today))
            .group_by(Attendance.work_date, Attendance.status)
        )
    ).all()
    per_day: Dict[date, Dict[AttendanceStatus, int]] = {}
    for d, st, n in att_rows:
        per_day.setdefault(d, {})[st] = n

    def day_counts(d: date) -> Dict[str, int]:
        c = per_day.get(d, {})
        present = sum(c.get(s, 0) for s in PRESENT_STATES)
        leave = c.get(AttendanceStatus.ON_LEAVE, 0)
        # A day with no attendance rows has no data: report zeros instead of inventing absences.
        absent = max(0, total_employees - present - leave) if c else 0
        return {"present": present, "absent": absent, "leave": leave}

    today_counts = day_counts(today)
    present_today = today_counts["present"]
    on_leave_today = employees_on_leave or today_counts["leave"]
    absent_today = max(0, total_employees - present_today - on_leave_today)

    pending_leaves = (
        await db.execute(
            select(func.count(LeaveRequest.id)).where(
                LeaveRequest.company_id == company_id,
                LeaveRequest.status == LeaveStatus.PENDING,
            )
        )
    ).scalar() or 0

    attendance_rate = round(present_today / total_employees * 100, 1) if total_employees else 0.0

    attendance_trends: List[Dict[str, Any]] = [
        {"date": (today - timedelta(days=i)).strftime("%a"), **day_counts(today - timedelta(days=i))}
        for i in range(4, -1, -1)
    ]

    return {
        "metrics": {
            "total_employees": total_employees,
            "present_today": present_today,
            "absent_today": absent_today,
            "on_leave_today": on_leave_today,
            "pending_leaves": pending_leaves,
            "attendance_rate": attendance_rate,
            "monthly_payroll_total": round(monthly_payroll_total, 2),
        },
        "department_distribution": [
            {"name": r[0], "count": r[1], "payroll": round(float(r[2]), 2)} for r in dept_rows
        ],
        "attendance_trends": attendance_trends,
    }
