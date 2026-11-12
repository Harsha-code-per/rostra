"""remove the empty legacy demo company inserted by migrations 0002/0003

Revision ID: 0006_drop_empty_default_company
Revises: 0005_security_and_indexes
Create Date: 2026-11-12 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006_drop_empty_default_company"
down_revision: Union[str, None] = "0005_security_and_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_COMPANY_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"


def upgrade() -> None:
    # Only removes the placeholder tenant when nothing belongs to it, so databases that
    # backfilled legacy rows into it keep their data.
    op.execute(
        f"""
        DELETE FROM companies
        WHERE id = '{DEFAULT_COMPANY_ID}'
          AND NOT EXISTS (SELECT 1 FROM profiles WHERE company_id = '{DEFAULT_COMPANY_ID}')
          AND NOT EXISTS (SELECT 1 FROM employees WHERE company_id = '{DEFAULT_COMPANY_ID}')
        """
    )


def downgrade() -> None:
    pass  # the placeholder row carried no data
