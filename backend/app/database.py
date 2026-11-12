from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
from app.db_url import prepare_database_url

database_url, connect_args = prepare_database_url(settings.DATABASE_URL)

engine_kwargs = {"echo": False, "connect_args": connect_args}
if not database_url.startswith("sqlite"):
    # Free-tier friendly: Neon scales to zero and drops idle connections, so recycle and pre-ping.
    engine_kwargs.update(pool_pre_ping=True, pool_size=5, max_overflow=5, pool_recycle=240)

engine = create_async_engine(database_url, **engine_kwargs)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
