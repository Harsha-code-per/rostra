from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class CheckInRequest(BaseModel):
    notes: Optional[str] = None


class CheckOutRequest(BaseModel):
    notes: Optional[str] = None


class AttendanceOverrideRequest(BaseModel):
    employee_id: str  # employee code (EMP-001) or UUID
    work_date: date
    status: Literal["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"]
    total_hours: Optional[float] = Field(default=None, ge=0, le=24)
    notes: Optional[str] = Field(default=None, max_length=500)


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    employee_id: str
    work_date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    total_hours: float = 0.0
    status: str
    notes: Optional[str] = None


class TodayStatusOut(BaseModel):
    checked_in: bool = False
    checked_out: bool = False
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: str = "ABSENT"


class AttendanceSummaryOut(BaseModel):
    total_working_days: int = 22
    present_days: int = 0
    half_days: int = 0
    leaves_taken: int = 0
    total_hours_worked: float = 0.0


class AttendanceHistoryResponse(BaseModel):
    today: TodayStatusOut
    summary: AttendanceSummaryOut
    records: List[AttendanceOut]


class CompanyAttendanceItem(BaseModel):
    id: Optional[str] = None
    employee_id: str
    employee_name: str
    department: str
    avatar_url: Optional[str] = None
    work_date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    total_hours: float = 0.0
    status: str
    notes: Optional[str] = None
