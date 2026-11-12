"""Multi-tenant architecture and security hardening

Revision ID: 0002_multi_tenant_saas
Revises: 0001_initial_schema
Create Date: 2026-08-22 13:31:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0002_multi_tenant_saas'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_COMPANY_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'


def upgrade() -> None:
    # 1. Create Companies Table
    op.create_table(
        'companies',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('currency', sa.String(length=10), server_default='INR', nullable=False),
        sa.Column('owner_id', sa.String(length=36), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_companies_slug', 'companies', ['slug'], unique=True)

    # 2. Seed Default Company (Idempotent check/insert)
    op.execute(
        f"""
        INSERT INTO companies (id, name, slug, currency, owner_id, is_active, created_at, updated_at)
        SELECT '{DEFAULT_COMPANY_ID}', 'Dayflow Technologies Inc.', 'dayflow', 'INR', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        WHERE NOT EXISTS (SELECT 1 FROM companies WHERE id = '{DEFAULT_COMPANY_ID}');
        """
    )
    op.execute(
        f"""
        UPDATE companies SET owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
        WHERE id = '{DEFAULT_COMPANY_ID}' AND EXISTS (SELECT 1 FROM profiles WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1');
        """
    )

    # 3. Add columns and migrate existing demo data safely
    # Profiles
    with op.batch_alter_table('profiles') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False))
        batch_op.add_column(sa.Column('must_reset_password', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True))

    op.execute(f"UPDATE profiles SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL;")

    with op.batch_alter_table('profiles') as batch_op:
        batch_op.alter_column('company_id', nullable=False, existing_type=sa.String(length=36))
        batch_op.create_foreign_key('fk_profiles_company', 'companies', ['company_id'], ['id'], ondelete='CASCADE')

    # Link company owner foreign key
    with op.batch_alter_table('companies') as batch_op:
        batch_op.create_foreign_key('fk_company_owner', 'profiles', ['owner_id'], ['id'], ondelete='SET NULL')

    # Employees
    with op.batch_alter_table('employees') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.String(length=36), nullable=True))

    op.execute(f"UPDATE employees SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL;")

    with op.batch_alter_table('employees') as batch_op:
        batch_op.alter_column('company_id', nullable=False, existing_type=sa.String(length=36))
        batch_op.create_foreign_key('fk_employees_company', 'companies', ['company_id'], ['id'], ondelete='CASCADE')
        batch_op.create_unique_constraint('uq_company_employee_id', ['company_id', 'employee_id'])

    # Attendance
    with op.batch_alter_table('attendance') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.String(length=36), nullable=True))

    op.execute(f"UPDATE attendance SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL;")

    with op.batch_alter_table('attendance') as batch_op:
        batch_op.alter_column('company_id', nullable=False, existing_type=sa.String(length=36))
        batch_op.create_foreign_key('fk_attendance_company', 'companies', ['company_id'], ['id'], ondelete='CASCADE')
        batch_op.create_unique_constraint('uq_company_employee_work_date', ['company_id', 'employee_id', 'work_date'])

    # Leave Types
    with op.batch_alter_table('leave_types') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.String(length=36), nullable=True))

    op.execute(f"UPDATE leave_types SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL;")

    with op.batch_alter_table('leave_types') as batch_op:
        batch_op.alter_column('company_id', nullable=False, existing_type=sa.String(length=36))
        batch_op.create_foreign_key('fk_leave_types_company', 'companies', ['company_id'], ['id'], ondelete='CASCADE')
        batch_op.create_unique_constraint('uq_company_leave_type_name', ['company_id', 'name'])

    # Leave Requests
    with op.batch_alter_table('leave_requests') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.String(length=36), nullable=True))

    op.execute(f"UPDATE leave_requests SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL;")

    with op.batch_alter_table('leave_requests') as batch_op:
        batch_op.alter_column('company_id', nullable=False, existing_type=sa.String(length=36))
        batch_op.create_foreign_key('fk_leave_requests_company', 'companies', ['company_id'], ['id'], ondelete='CASCADE')

    # Salary Structures
    with op.batch_alter_table('salary_structures') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.String(length=36), nullable=True))

    op.execute(f"UPDATE salary_structures SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL;")

    with op.batch_alter_table('salary_structures') as batch_op:
        batch_op.alter_column('company_id', nullable=False, existing_type=sa.String(length=36))
        batch_op.create_foreign_key('fk_salary_structures_company', 'companies', ['company_id'], ['id'], ondelete='CASCADE')

    # Notifications
    with op.batch_alter_table('notifications') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.String(length=36), nullable=True))

    op.execute(f"UPDATE notifications SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL;")

    with op.batch_alter_table('notifications') as batch_op:
        batch_op.alter_column('company_id', nullable=False, existing_type=sa.String(length=36))
        batch_op.create_foreign_key('fk_notifications_company', 'companies', ['company_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    # Reverse foreign keys and columns
    with op.batch_alter_table('notifications') as batch_op:
        batch_op.drop_column('company_id')

    with op.batch_alter_table('salary_structures') as batch_op:
        batch_op.drop_column('company_id')

    with op.batch_alter_table('leave_requests') as batch_op:
        batch_op.drop_column('company_id')

    with op.batch_alter_table('leave_types') as batch_op:
        batch_op.drop_constraint('uq_company_leave_type_name', type_='unique')
        batch_op.drop_column('company_id')

    with op.batch_alter_table('attendance') as batch_op:
        batch_op.drop_constraint('uq_company_employee_work_date', type_='unique')
        batch_op.drop_column('company_id')

    with op.batch_alter_table('employees') as batch_op:
        batch_op.drop_constraint('uq_company_employee_id', type_='unique')
        batch_op.drop_column('company_id')

    with op.batch_alter_table('profiles') as batch_op:
        batch_op.drop_column('password_changed_at')
        batch_op.drop_column('must_reset_password')
        batch_op.drop_column('is_active')
        batch_op.drop_column('company_id')

    op.drop_table('companies')
