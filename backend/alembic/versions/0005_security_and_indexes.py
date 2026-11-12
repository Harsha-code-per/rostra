"""password reset tokens, company plan limits, query indexes

Revision ID: 0005_security_and_indexes
Revises: 0004_super_admin_inquiries
Create Date: 2026-11-12 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_security_and_indexes"
down_revision: Union[str, None] = "0004_super_admin_inquiries"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEXES = [
    ("ix_leave_requests_company_status", "leave_requests", ["company_id", "status"]),
    ("ix_leave_requests_dates", "leave_requests", ["start_date", "end_date"]),
    ("ix_leave_requests_leave_type_id", "leave_requests", ["leave_type_id"]),
    ("ix_employees_company_department", "employees", ["company_id", "department"]),
    ("ix_employees_manager_id", "employees", ["manager_id"]),
    ("ix_notifications_created_at", "notifications", ["created_at"]),
    ("ix_inquiries_status", "inquiries", ["status"]),
    # Present in the models but missing from databases created by the early migrations
    ("ix_attendance_company_id", "attendance", ["company_id"]),
    ("ix_attendance_employee_id", "attendance", ["employee_id"]),
    ("ix_employees_company_id", "employees", ["company_id"]),
    ("ix_employees_department", "employees", ["department"]),
    ("ix_employees_status", "employees", ["status"]),
    ("ix_leave_requests_company_id", "leave_requests", ["company_id"]),
    ("ix_leave_requests_employee_id", "leave_requests", ["employee_id"]),
    ("ix_leave_requests_status", "leave_requests", ["status"]),
    ("ix_leave_types_company_id", "leave_types", ["company_id"]),
    ("ix_notifications_company_id", "notifications", ["company_id"]),
    ("ix_notifications_user_id", "notifications", ["user_id"]),
    ("ix_notifications_is_read", "notifications", ["is_read"]),
    ("ix_profiles_company_id", "profiles", ["company_id"]),
    ("ix_salary_structures_company_id", "salary_structures", ["company_id"]),
]


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())

    if "password_reset_tokens" not in insp.get_table_names():
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token_hash", sa.String(64), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
        op.create_index("ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"], unique=True)

    if "max_employees" not in {c["name"] for c in insp.get_columns("companies")}:
        with op.batch_alter_table("companies") as batch:
            batch.add_column(sa.Column("max_employees", sa.Integer(), nullable=True))

    for name, table, cols in INDEXES:
        if name not in {i["name"] for i in insp.get_indexes(table)}:
            op.create_index(name, table, cols)

    # One attendance row per employee per day (guards against double check-in races)
    uq = "unique_company_employee_work_date"
    has_uq = uq in {u["name"] for u in insp.get_unique_constraints("attendance")} or uq in {
        i["name"] for i in insp.get_indexes("attendance")
    }
    if not has_uq:
        op.create_index(uq, "attendance", ["company_id", "employee_id", "work_date"], unique=True)


def downgrade() -> None:
    op.drop_index("unique_company_employee_work_date", table_name="attendance")
    for name, table, _ in INDEXES:
        op.drop_index(name, table_name=table)
    with op.batch_alter_table("companies") as batch:
        batch.drop_column("max_employees")
    op.drop_table("password_reset_tokens")
