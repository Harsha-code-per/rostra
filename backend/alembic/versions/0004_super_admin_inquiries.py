"""super admin and inquiries schema

Revision ID: 0004_super_admin_inquiries
Revises: 0003_repair_tenant_schema
Create Date: 2026-08-22 15:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0004_super_admin_inquiries'
down_revision: Union[str, None] = '0003_repair_tenant_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    # 0. Add SUPER_ADMIN to userrole enum and fix leave_types constraint in PostgreSQL
    if conn.dialect.name == "postgresql":
        try:
            op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';")
        except Exception:
            pass
        try:
            op.execute("ALTER TABLE leave_types DROP CONSTRAINT IF EXISTS leave_types_name_key;")
            op.execute("ALTER TABLE leave_types DROP CONSTRAINT IF EXISTS uq_company_leave_type_name;")
            op.execute("ALTER TABLE leave_types ADD CONSTRAINT uq_company_leave_type_name UNIQUE (company_id, name);")
        except Exception:
            pass
        try:
            op.execute("DROP INDEX IF EXISTS ix_employees_employee_id;")
            op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_company_employee_id ON employees (company_id, employee_id);")
            op.execute("CREATE INDEX IF NOT EXISTS ix_employees_employee_id ON employees (employee_id);")
        except Exception:
            pass

    # 1. Update companies table if needed
    if 'companies' in tables:
        company_cols = [c['name'] for c in insp.get_columns('companies')]
        if 'domain' not in company_cols:
            op.add_column('companies', sa.Column('domain', sa.String(255), nullable=True))
        if 'plan' not in company_cols:
            op.add_column('companies', sa.Column('plan', sa.String(50), server_default='Growth', nullable=False))
        if 'status' not in company_cols:
            op.add_column('companies', sa.Column('status', sa.String(50), server_default='ACTIVE', nullable=False))

    # 2. Make profiles.company_id nullable
    if 'profiles' in tables:
        # For Postgres/SQLite safe alter
        try:
            op.alter_column('profiles', 'company_id', existing_type=sa.String(36), nullable=True)
        except Exception:
            pass

    # 3. Create inquiries table if not exists
    if 'inquiries' not in tables:
        op.create_table(
            'inquiries',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('company_name', sa.String(255), nullable=False),
            sa.Column('contact_name', sa.String(255), nullable=False),
            sa.Column('work_email', sa.String(255), nullable=False, index=True),
            sa.Column('phone', sa.String(50), nullable=True),
            sa.Column('team_size', sa.String(50), server_default='25-50', nullable=False),
            sa.Column('plan_interest', sa.String(50), server_default='Growth', nullable=False),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('status', sa.String(50), server_default='NEW', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    if 'inquiries' in tables:
        op.drop_table('inquiries')

    if 'companies' in tables:
        company_cols = [c['name'] for c in insp.get_columns('companies')]
        if 'status' in company_cols:
            op.drop_column('companies', 'status')
        if 'plan' in company_cols:
            op.drop_column('companies', 'plan')
        if 'domain' in company_cols:
            op.drop_column('companies', 'domain')
