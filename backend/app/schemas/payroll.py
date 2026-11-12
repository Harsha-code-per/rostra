from datetime import date
from pydantic import BaseModel, Field


class EarningsBreakdown(BaseModel):
    basic: float
    hra: float
    standard_allowance: float
    performance_bonus: float
    lta: float
    fixed_allowance: float


class DeductionsBreakdown(BaseModel):
    pf: float
    professional_tax: float


class AttendancePayrollSummary(BaseModel):
    total_working_days: int = 22
    payable_days: float = 22.0
    unpaid_days: float = 0.0
    effective_net_payout: float = 0.0
    present_days: float = 0.0
    paid_leave_days: float = 0.0
    month: int = 0
    year: int = 0


class SalaryBreakdownOut(BaseModel):
    employee_id: str
    employee_name: str
    department: str
    designation: str
    effective_from: date
    wage: float
    earnings: EarningsBreakdown
    deductions: DeductionsBreakdown
    gross_salary: float
    total_deductions: float
    net_salary: float
    attendance_summary: AttendancePayrollSummary


class WageUpdateRequest(BaseModel):
    wage: float = Field(gt=0, le=100_000_000)


class SalaryRecalculationResponse(BaseModel):
    message: str = "Salary structure successfully recalculated and saved"
    employee_id: str
    wage: float
    basic: float
    hra: float
    standard_allowance: float
    performance_bonus: float
    lta: float
    fixed_allowance: float
    pf: float
    professional_tax: float
    gross_salary: float
    total_deductions: float
    net_salary: float


class SalaryComponents(BaseModel):
    wage: float
    basic: float
    hra: float
    standard_allowance: float
    performance_bonus: float
    lta: float
    fixed_allowance: float
    pf: float
    professional_tax: float
    gross_salary: float
    total_deductions: float
    net_salary: float
