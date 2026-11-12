from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, AliasChoices


class CompanyTenantOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    name: str
    slug: str
    domain: Optional[str] = None
    plan: str = "Growth"
    admin_name: str = Field(default="Admin", validation_alias=AliasChoices("admin_name", "adminName"), serialization_alias="adminName")
    admin_email: str = Field(default="", validation_alias=AliasChoices("admin_email", "adminEmail"), serialization_alias="adminEmail")
    employee_count: int = Field(default=1, validation_alias=AliasChoices("employee_count", "employeeCount"), serialization_alias="employeeCount")
    status: str = "ACTIVE"
    max_employees: Optional[int] = Field(default=None, validation_alias=AliasChoices("max_employees", "maxEmployees"), serialization_alias="maxEmployees")
    created_at: Optional[datetime] = Field(default=None, validation_alias=AliasChoices("created_at", "createdAt"), serialization_alias="createdAt")


class CompanyProvisionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=2, max_length=255)
    domain: Optional[str] = Field(default=None, max_length=255)
    admin_name: str = Field(min_length=2, max_length=255, validation_alias=AliasChoices("admin_name", "adminName"))
    admin_email: EmailStr = Field(validation_alias=AliasChoices("admin_email", "adminEmail"))
    plan: Literal["Starter", "Growth", "Enterprise"] = "Growth"
    max_employees: Optional[int] = Field(default=None, ge=1, validation_alias=AliasChoices("max_employees", "maxEmployees"))


class CompanyProvisionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    company: CompanyTenantOut
    temporary_password: str = Field(validation_alias=AliasChoices("temporary_password", "temporaryPassword"), serialization_alias="temporaryPassword")


class CompanyStatusUpdateRequest(BaseModel):
    status: Literal["ACTIVE", "SUSPENDED", "PENDING_SETUP"]


class InquiryCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    company_name: str = Field(min_length=2, max_length=255, validation_alias=AliasChoices("company_name", "companyName"))
    contact_name: str = Field(min_length=2, max_length=255, validation_alias=AliasChoices("contact_name", "contactName"))
    work_email: EmailStr = Field(validation_alias=AliasChoices("work_email", "workEmail"))
    phone: Optional[str] = Field(default=None, max_length=50)
    team_size: Optional[str] = Field(default="25-50", max_length=50, validation_alias=AliasChoices("team_size", "teamSize"))
    plan_interest: Optional[str] = Field(default="Growth", max_length=50, validation_alias=AliasChoices("plan_interest", "planInterest"))
    message: Optional[str] = Field(default=None, max_length=2000)


class InquiryOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    company_name: str = Field(validation_alias=AliasChoices("company_name", "companyName"), serialization_alias="companyName")
    contact_name: str = Field(validation_alias=AliasChoices("contact_name", "contactName"), serialization_alias="contactName")
    work_email: str = Field(validation_alias=AliasChoices("work_email", "workEmail"), serialization_alias="workEmail")
    phone: Optional[str] = None
    team_size: str = Field(default="25-50", validation_alias=AliasChoices("team_size", "teamSize"), serialization_alias="teamSize")
    plan_interest: str = Field(default="Growth", validation_alias=AliasChoices("plan_interest", "planInterest"), serialization_alias="planInterest")
    message: Optional[str] = None
    status: str = "NEW"
    created_at: Optional[datetime] = Field(default=None, validation_alias=AliasChoices("created_at", "createdAt"), serialization_alias="createdAt")


class InquiryStatusUpdate(BaseModel):
    status: Literal["NEW", "CONTACTED", "PROVISIONED"]
