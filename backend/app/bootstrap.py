import logging

from sqlalchemy import select

from app.config import settings
from app.core.security import get_password_hash
from app.database import async_session_factory
from app.models.profile import Profile, UserRole

log = logging.getLogger(__name__)


async def bootstrap_super_admin() -> None:
    """Create the first platform owner from env vars when none exists. Never resets an existing password."""
    if not (settings.SUPER_ADMIN_EMAIL and settings.SUPER_ADMIN_PASSWORD):
        return
    async with async_session_factory() as session:
        existing = await session.execute(select(Profile.id).where(Profile.role == UserRole.SUPER_ADMIN).limit(1))
        if existing.scalar_one_or_none():
            return
        session.add(
            Profile(
                company_id=None,
                email=settings.SUPER_ADMIN_EMAIL.lower(),
                password_hash=get_password_hash(settings.SUPER_ADMIN_PASSWORD),
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                must_reset_password=False,
            )
        )
        await session.commit()
        log.info("Bootstrapped super admin %s", settings.SUPER_ADMIN_EMAIL)
