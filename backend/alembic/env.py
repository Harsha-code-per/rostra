import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from app.config import settings
from app.db_url import prepare_database_url
from app.database import Base
# Import all models to ensure they are registered with Base.metadata
from app.models import (  # noqa: F401
    Company,
    Profile,
    Employee,
    Attendance,
    LeaveType,
    LeaveRequest,
    SalaryStructure,
    Notification,
    Inquiry,
    PasswordResetToken,
)

# Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


import os


def get_url() -> str:
    url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url") or settings.DATABASE_URL
    return prepare_database_url(url)[0]


def get_connect_args() -> dict:
    url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url") or settings.DATABASE_URL
    return prepare_database_url(url)[1]


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=get_connect_args(),
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    import concurrent.futures

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            executor.submit(lambda: asyncio.run(run_async_migrations())).result()
    else:
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

