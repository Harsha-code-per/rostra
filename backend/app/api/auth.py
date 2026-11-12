import asyncio
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.limiter import limiter
from app.core.permissions import get_current_user, role_value
from app.models.profile import Profile, UserRole
from app.models.employee import Employee
from app.models.reset_token import PasswordResetToken
from app.models.payroll import SalaryStructure
from app.services.payroll_service import calculate_salary_structure
from app.services.email_service import email_service
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
    RegisterResponse,
    EmployeeSummary,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Profile)
        .where(Profile.email == req.email.lower())
        .options(selectinload(Profile.employee), selectinload(Profile.company))
    )
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile or not await asyncio.to_thread(verify_password, req.password, profile.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not profile.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account has been deactivated or disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if profile.company and (not profile.company.is_active or profile.company.status != "ACTIVE"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This workspace is suspended. Contact your administrator or Rostra support.",
        )

    role_str = role_value(profile.role)
    access_token = create_access_token(
        subject=profile.id,
        role=role_str,
        company_id=profile.company_id,
    )

    emp_summary = None
    if profile.employee:
        emp = profile.employee
        emp_summary = EmployeeSummary(
            id=emp.id,
            employee_id=emp.employee_id,
            first_name=emp.first_name,
            last_name=emp.last_name,
            department=emp.department,
            designation=emp.designation,
            avatar_url=emp.avatar_url,
        )

    user_out = UserOut(
        id=profile.id,
        email=profile.email,
        role=role_str,
        company_id=profile.company_id,
        company_name=profile.company.name if profile.company else None,
        must_reset_password=profile.must_reset_password,
        is_active=profile.is_active,
        employee=emp_summary,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        token=access_token,
        must_reset_password=profile.must_reset_password,
        user=user_out,
    )


@router.post("/change-password")
async def change_password(
    req: PasswordChangeRequest,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await asyncio.to_thread(verify_password, req.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed",
        )

    current_user.password_hash = await asyncio.to_thread(get_password_hash, req.new_password)
    current_user.must_reset_password = False
    current_user.password_changed_at = datetime.now(timezone.utc)

    await db.commit()
    return {"message": "Password updated successfully. Previous sessions invalidated."}


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Profile)
        .where(Profile.email == req.email.lower())
        .options(selectinload(Profile.employee))
    )
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    # Always return 200 message to prevent account enumeration
    if not profile or not profile.is_active:
        return {"message": "If this email exists, a password reset link has been dispatched."}

    recipient_name = f"{profile.employee.first_name} {profile.employee.last_name}" if profile.employee else profile.email.split("@")[0]
    raw_token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=profile.id,
            token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES),
        )
    )
    await db.commit()
    reset_link = f"{settings.APP_BASE_URL}/reset-password?token={raw_token}"
    email_service.send_password_reset_email(
        to_email=profile.email,
        recipient_name=recipient_name,
        reset_link=reset_link,
    )
    return {"message": "If this email exists, a password reset link has been dispatched."}


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(req.token.encode()).hexdigest()
    record = (
        await db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    expires_at = record.expires_at.replace(tzinfo=timezone.utc) if record and record.expires_at.tzinfo is None else (record.expires_at if record else None)
    if not record or record.used_at is not None or expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link is invalid or has expired")

    profile = (await db.execute(select(Profile).where(Profile.id == record.user_id))).scalar_one()
    profile.password_hash = await asyncio.to_thread(get_password_hash, req.new_password)
    profile.must_reset_password = False
    profile.password_changed_at = now
    record.used_at = now
    await db.commit()
    return {"message": "Password updated. Please sign in with your new password."}


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    req: RegisterRequest,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_role = role_value(current_user.role)

    # 1. Role whitelist: who may create which role. SUPER_ADMIN is never creatable via the API.
    allowed_targets = {"ADMIN": {"HR", "EMPLOYEE"}, "HR": {"EMPLOYEE"}}.get(user_role)
    target_role = req.role or UserRole.EMPLOYEE
    target_role_str = role_value(target_role)
    if allowed_targets is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to register new users")
    if target_role_str not in allowed_targets:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{user_role} accounts can only create: {', '.join(sorted(allowed_targets))}",
        )

    # Plan limit
    company = current_user.company
    if company and company.max_employees is not None:
        headcount = (
            await db.execute(select(func.count()).select_from(Employee).where(Employee.company_id == company.id))
        ).scalar_one()
        if headcount >= company.max_employees:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Your plan allows up to {company.max_employees} employees. Contact Rostra to upgrade.",
            )

    # 2. Check duplicate email or employee_id within tenant
    stmt = select(Profile).where(Profile.email == req.email.lower())
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    emp_stmt = select(Employee).where(
        Employee.company_id == current_user.company_id,
        Employee.employee_id == req.employee_id,
    )
    emp_res = await db.execute(emp_stmt)
    if emp_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An employee with this employee_id already exists in this company",
        )

    # 3. Transactional multi-record creation
    hashed_pw = await asyncio.to_thread(get_password_hash, req.password)

    profile = Profile(
        company_id=current_user.company_id,
        email=req.email.lower(),
        password_hash=hashed_pw,
        role=target_role,
        must_reset_password=True,
    )
    db.add(profile)
    await db.flush()

    employee = Employee(
        company_id=current_user.company_id,
        user_id=profile.id,
        employee_id=req.employee_id,
        first_name=req.first_name,
        last_name=req.last_name,
        email=req.email.lower(),
        phone=req.phone,
        department=req.department,
        designation=req.designation,
        avatar_url=req.avatar_url,
    )
    db.add(employee)
    await db.flush()

    # Create default salary structure
    wage_amount = req.wage or 60000.0
    salary_calc = calculate_salary_structure(wage_amount)
    salary = SalaryStructure(
        company_id=current_user.company_id,
        employee_id=employee.id,
        **salary_calc,
    )
    db.add(salary)

    await db.commit()

    # 4. Dispatch onboarding invitation email
    company_name = current_user.company.name if current_user.company else "your company"
    activation_link = f"{settings.APP_BASE_URL}/force-password-reset"
    email_service.send_invitation_email(
        to_email=profile.email,
        recipient_name=f"{employee.first_name} {employee.last_name}",
        company_name=company_name,
        role=target_role_str,
        activation_link=activation_link,
    )

    return RegisterResponse(
        message="User onboarded successfully into company",
        user_id=profile.id,
        employee_id=employee.employee_id,
        company_id=current_user.company_id,
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: Profile = Depends(get_current_user)):
    role_str = role_value(current_user.role)
    emp_summary = None
    if current_user.employee:
        emp = current_user.employee
        emp_summary = EmployeeSummary(
            id=emp.id,
            employee_id=emp.employee_id,
            first_name=emp.first_name,
            last_name=emp.last_name,
            department=emp.department,
            designation=emp.designation,
            avatar_url=emp.avatar_url,
        )

    return UserOut(
        id=current_user.id,
        email=current_user.email,
        role=role_str,
        company_id=current_user.company_id,
        company_name=current_user.company.name if current_user.company else None,
        must_reset_password=current_user.must_reset_password,
        is_active=current_user.is_active,
        employee=emp_summary,
    )

