from datetime import date, datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from app.models.employee import EmployeeStatus


class EmergencyContact(BaseModel):
    name: Optional[str] = ""
    relationship: Optional[str] = ""
    phone: Optional[str] = ""


class EmployeeCreate(BaseModel):
    user_id: str
    employee_id: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    department: str
    designation: str
    manager_id: Optional[str] = None
    joining_date: Optional[date] = None
    status: Optional[EmployeeStatus] = EmployeeStatus.ACTIVE
    avatar_url: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[EmergencyContact] = None
    wage: Optional[float] = 50000.0


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    avatar_url: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    wage: Optional[float] = Field(default=None, gt=0, le=100_000_000)


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    employee_id: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    department: str
    designation: str
    manager_id: Optional[str] = None
    joining_date: date
    status: str
    avatar_url: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    wage: Optional[float] = 0.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
