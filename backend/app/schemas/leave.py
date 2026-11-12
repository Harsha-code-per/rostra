from datetime import date, datetime
from typing import Optional, List, Dict
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field
from app.models.leave import LeaveTypeEnum


class LeaveApplyRequest(BaseModel):
    leave_type: LeaveTypeEnum
    start_date: date
    end_date: date
    total_days: Optional[int] = None  # deprecated: ignored, computed server-side
    reason: str = Field(min_length=3, max_length=2000)
    attachment_url: Optional[AnyHttpUrl] = None


class LeaveReviewRequest(BaseModel):
    hr_comments: Optional[str] = Field(default="", max_length=2000)


class LeaveRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    employee_id: str
    employee_name: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    leave_type: str
    start_date: date
    end_date: date
    total_days: int
    reason: str
    attachment_url: Optional[str] = None
    status: str
    hr_comments: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class LeaveBalanceItem(BaseModel):
    allocated: int
    used: int
    remaining: int


class LeaveBalanceResponse(BaseModel):
    balances: Dict[str, LeaveBalanceItem]
    requests: List[LeaveRequestOut]
