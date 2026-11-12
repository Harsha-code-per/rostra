import uuid
import re
import secrets
from datetime import date
from typing import List, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash
from app.models.company import Company
from app.models.profile import Profile, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import LeaveType, LeaveTypeEnum
from app.models.inquiry import Inquiry
from app.services.payroll_service import get_or_create_salary_structure
from app.services.email_service import email_service
from app.config import settings
from app.schemas.super_admin import (
    CompanyProvisionRequest,
    CompanyTenantOut,
    InquiryCreate,
    InquiryOut,
)


async def generate_unique_slug(db: AsyncSession, name: str) -> str:
    cleaned = re.sub(r'[^a-z0-9]', '', name.lower()) or "tenant"
    while True:
        slug = f"{cleaned[:20]}-{secrets.token_hex(3)}"
        if not (await db.execute(select(Company.id).where(Company.slug == slug))).scalar_one_or_none():
            return slug


async def provision_new_tenant(
    db: AsyncSession,
    data: CompanyProvisionRequest,
) -> Tuple[CompanyTenantOut, str]:
    # Check if admin email already exists in profiles
    existing_profile = await db.execute(select(Profile).where(Profile.email == data.admin_email.lower().strip()))
    if existing_profile.scalar_one_or_none():
        raise ValueError(f"User profile with email {data.admin_email} already exists")

    slug = await generate_unique_slug(db, data.name)
    domain = data.domain or f"{slug.split('-')[0]}.com"
    temp_password = f"Rx-{secrets.token_urlsafe(9)}"

    # 1. Create Company
    company_id = str(uuid.uuid4())
    company = Company(
        id=company_id,
        name=data.name.strip(),
        slug=slug,
        domain=domain,
        plan=data.plan,
        status="ACTIVE",
        max_employees=data.max_employees,
        currency="INR",
        is_active=True,
    )
    db.add(company)
    await db.flush()

    # 2. Create Default Leave Types
    default_leave_types = [
        LeaveType(id=str(uuid.uuid4()), company_id=company_id, name=LeaveTypeEnum.PAID, default_allocation=15, is_paid=True, description="Paid Annual Leave"),
        LeaveType(id=str(uuid.uuid4()), company_id=company_id, name=LeaveTypeEnum.SICK, default_allocation=10, is_paid=True, description="Medical/Sick Leave"),
        LeaveType(id=str(uuid.uuid4()), company_id=company_id, name=LeaveTypeEnum.CASUAL, default_allocation=7, is_paid=True, description="Casual Leave"),
        LeaveType(id=str(uuid.uuid4()), company_id=company_id, name=LeaveTypeEnum.UNPAID, default_allocation=0, is_paid=False, description="Unpaid Leave / Loss of Pay"),
    ]
    for lt in default_leave_types:
        db.add(lt)
    await db.flush()

    # 3. Parse Admin Name
    parts = data.admin_name.strip().split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    # 4. Create Admin Profile
    admin_profile_id = str(uuid.uuid4())
    admin_profile = Profile(
        id=admin_profile_id,
        company_id=company_id,
        email=data.admin_email.lower().strip(),
        password_hash=get_password_hash(temp_password),
        role=UserRole.ADMIN,
        is_active=True,
        must_reset_password=True,
    )
    db.add(admin_profile)
    await db.flush()

    # 5. Create Admin Employee
    admin_emp_id = str(uuid.uuid4())
    admin_emp = Employee(
        id=admin_emp_id,
        user_id=admin_profile_id,
        company_id=company_id,
        employee_id="EMP-001",
        first_name=first_name,
        last_name=last_name,
        email=data.admin_email.lower().strip(),
        department="Management",
        designation="Company Administrator",
        joining_date=date.today(),
        status=EmployeeStatus.ACTIVE,
        phone="+1 555-0100",
        avatar_url="",
        address="Headquarters",
        emergency_contact={"name": "Executive Contact", "relationship": "Company", "phone": "+1 555-0100"},
    )
    db.add(admin_emp)
    await db.flush()

    # 6. Create Salary Structure
    await get_or_create_salary_structure(db, employee_id=admin_emp_id, company_id=company_id, default_wage=120000.0)

    # 7. Set Company Owner
    company.owner_id = admin_profile_id
    await db.commit()

    # 8. Dispatch invitation email via Resend
    activation_link = f"{settings.APP_BASE_URL}/force-password-reset"
    email_service.send_invitation_email(
        to_email=data.admin_email.lower().strip(),
        recipient_name=data.admin_name,
        company_name=data.name,
        role="ADMIN",
        activation_link=activation_link,
    )

    company_out = CompanyTenantOut(
        id=company.id,
        name=company.name,
        slug=company.slug,
        domain=company.domain,
        plan=company.plan,
        adminName=f"{first_name} {last_name}".strip(),
        adminEmail=admin_profile.email,
        employeeCount=1,
        status=company.status,
        maxEmployees=company.max_employees,
        createdAt=company.created_at,
    )

    return company_out, temp_password


async def list_all_tenants(db: AsyncSession) -> List[CompanyTenantOut]:
    stmt = (
        select(Company)
        .options(
            selectinload(Company.owner).selectinload(Profile.employee),
            selectinload(Company.employees),
        )
        .order_by(Company.created_at.desc())
    )
    res = await db.execute(stmt)
    companies = res.scalars().all()

    out: List[CompanyTenantOut] = []
    for c in companies:
        admin_name = "Admin"
        admin_email = ""
        if c.owner:
            admin_email = c.owner.email
            if c.owner.employee:
                admin_name = f"{c.owner.employee.first_name} {c.owner.employee.last_name}".strip()
            else:
                admin_name = c.owner.email.split("@")[0].capitalize()

        out.append(
            CompanyTenantOut(
                id=c.id,
                name=c.name,
                slug=c.slug,
                domain=c.domain or f"{c.slug}.com",
                plan=c.plan or "Growth",
                adminName=admin_name,
                adminEmail=admin_email,
                employeeCount=len(c.employees) if c.employees else 1,
                status=c.status or ("ACTIVE" if c.is_active else "SUSPENDED"),
                maxEmployees=c.max_employees,
                createdAt=c.created_at,
            )
        )
    return out


async def update_tenant_status(db: AsyncSession, company_id: str, new_status: str) -> CompanyTenantOut:
    stmt = (
        select(Company)
        .where(Company.id == company_id)
        .options(
            selectinload(Company.owner).selectinload(Profile.employee),
            selectinload(Company.employees),
        )
    )
    res = await db.execute(stmt)
    company = res.scalar_one_or_none()
    if not company:
        raise ValueError(f"Company {company_id} not found")

    company.status = new_status
    company.is_active = (new_status == "ACTIVE")
    await db.commit()

    admin_name = "Admin"
    admin_email = ""
    if company.owner:
        admin_email = company.owner.email
        if company.owner.employee:
            admin_name = f"{company.owner.employee.first_name} {company.owner.employee.last_name}".strip()

    return CompanyTenantOut(
        id=company.id,
        name=company.name,
        slug=company.slug,
        domain=company.domain,
        plan=company.plan,
        adminName=admin_name,
        adminEmail=admin_email,
        employeeCount=len(company.employees) if company.employees else 1,
        status=company.status,
        maxEmployees=company.max_employees,
        createdAt=company.created_at,
    )


async def create_inquiry(db: AsyncSession, data: InquiryCreate) -> InquiryOut:
    inquiry = Inquiry(
        id=str(uuid.uuid4()),
        company_name=data.company_name,
        contact_name=data.contact_name,
        work_email=data.work_email.lower().strip(),
        phone=data.phone,
        team_size=data.team_size or "25-50",
        plan_interest=data.plan_interest or "Growth",
        message=data.message,
        status="NEW",
    )
    db.add(inquiry)
    await db.commit()
    await db.refresh(inquiry)

    return InquiryOut(
        id=inquiry.id,
        companyName=inquiry.company_name,
        contactName=inquiry.contact_name,
        workEmail=inquiry.work_email,
        phone=inquiry.phone,
        teamSize=inquiry.team_size,
        planInterest=inquiry.plan_interest,
        message=inquiry.message,
        status=inquiry.status,
        createdAt=inquiry.created_at,
    )


async def list_inquiries(db: AsyncSession) -> List[InquiryOut]:
    stmt = select(Inquiry).order_by(Inquiry.created_at.desc())
    res = await db.execute(stmt)
    inquiries = res.scalars().all()

    return [
        InquiryOut(
            id=i.id,
            companyName=i.company_name,
            contactName=i.contact_name,
            workEmail=i.work_email,
            phone=i.phone,
            teamSize=i.team_size,
            planInterest=i.plan_interest,
            message=i.message,
            status=i.status,
            createdAt=i.created_at,
        )
        for i in inquiries
    ]


async def update_inquiry_status(db: AsyncSession, inquiry_id: str, status: str) -> InquiryOut:
    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
    res = await db.execute(stmt)
    inquiry = res.scalar_one_or_none()
    if not inquiry:
        raise ValueError(f"Inquiry {inquiry_id} not found")

    inquiry.status = status
    await db.commit()
    await db.refresh(inquiry)

    return InquiryOut(
        id=inquiry.id,
        companyName=inquiry.company_name,
        contactName=inquiry.contact_name,
        workEmail=inquiry.work_email,
        phone=inquiry.phone,
        teamSize=inquiry.team_size,
        planInterest=inquiry.plan_interest,
        message=inquiry.message,
        status=inquiry.status,
        createdAt=inquiry.created_at,
    )
