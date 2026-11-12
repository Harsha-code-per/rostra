from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification


async def get_user_notifications(
    db: AsyncSession, user_id: str, company_id: str, unread_only: bool = False
) -> List[Notification]:
    stmt = (
        select(Notification)
        .where(
            Notification.company_id == company_id,
            Notification.user_id == user_id,
        )
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    result = await db.execute(stmt)
    return result.scalars().all()


async def mark_notification_as_read(
    db: AsyncSession, notification_id: str, user_id: str, company_id: str
) -> bool:
    stmt = select(Notification).where(
        Notification.company_id == company_id,
        Notification.id == notification_id,
        Notification.user_id == user_id,
    )
    result = await db.execute(stmt)
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
        return True
    return False

