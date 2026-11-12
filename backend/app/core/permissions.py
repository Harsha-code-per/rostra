from datetime import timezone
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.security import decode_access_token
from app.models.profile import Profile, UserRole
from app.models.employee import Employee

security_scheme = HTTPBearer(auto_error=False)


def role_value(role) -> str:
    return role.value if isinstance(role, UserRole) else str(role)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Profile:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = (
        select(Profile)
        .where(Profile.id == user_id)
        .options(
            selectinload(Profile.company),
            selectinload(Profile.employee).selectinload(Employee.salary_structure),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token does not exist",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account has been deactivated or disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.company and (not user.company.is_active or user.company.status != "ACTIVE"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This workspace is suspended. Contact your administrator or Rostra support.",
        )

    token_iat = payload.get("iat")
    if user.password_changed_at and token_iat is not None:
        pwd_dt = user.password_changed_at
        if pwd_dt.tzinfo is None:
            pwd_dt = pwd_dt.replace(tzinfo=timezone.utc)
        pwd_changed_ts = int(pwd_dt.timestamp())
        if token_iat < pwd_changed_ts:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been invalidated due to password change. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return user




def require_roles(allowed_roles: List[str]):
    async def role_checker(current_user: Profile = Depends(get_current_user)) -> Profile:
        user_role = role_value(current_user.role)
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires one of roles {allowed_roles}, but current role is {user_role}",
            )
        return current_user

    return role_checker
