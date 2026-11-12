from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from app.models.profile import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class RegisterRequest(BaseModel):
    employee_id: str = Field(min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: Optional[UserRole] = UserRole.EMPLOYEE
    department: Optional[str] = "General"
    designation: Optional[str] = "Staff"
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    wage: Optional[float] = Field(default=60000.0, gt=0, le=100_000_000)



class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    currency: str = "INR"


class EmployeeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    employee_id: str
    first_name: str
    last_name: str
    department: str
    designation: str
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    role: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    must_reset_password: bool = False
    is_active: bool = True
    employee: Optional[EmployeeSummary] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    token: Optional[str] = None  # Frontend convenience alias
    must_reset_password: bool = False
    user: UserOut


class RegisterResponse(BaseModel):
    message: str
    user_id: str
    employee_id: str
    company_id: str

