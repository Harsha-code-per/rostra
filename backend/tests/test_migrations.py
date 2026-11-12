import pytest
import sqlite3
from alembic.config import Config
from alembic import command


@pytest.mark.asyncio
async def test_migration_pipeline_and_data_preservation(tmp_path):
    """
    Test the full migration pipeline:
    1. Upgrade to 0001_initial_schema on fresh DB.
    2. Insert pre-existing un-scoped demo records into profiles, employees, etc.
    3. Run upgrade to 0002_multi_tenant_saas.
    4. Verify that data migration populated company_id for all records without data loss.
    5. Run upgrade to 0003_repair_existing_tenant_schema (idempotent head).
    6. Verify downgrade to 0001_initial_schema and re-upgrade to head.
    """
    test_db_path = str(tmp_path / "migration_test.db")
    db_url = f"sqlite+aiosqlite:///{test_db_path}"

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # 1. Upgrade to 0001
    command.upgrade(alembic_cfg, "0001_initial_schema")

    # 2. Insert un-scoped demo data directly (as if existing in pre-migration rostra.db)
    conn = sqlite3.connect(test_db_path)
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO profiles (id, email, password_hash, role, created_at, updated_at)
        VALUES ('user-1', 'existing@demo.example.com', 'hash123', 'EMPLOYEE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    """)
    cur.execute("""
        INSERT INTO employees (id, user_id, employee_id, first_name, last_name, email, department, designation, joining_date, status, created_at, updated_at)
        VALUES ('emp-1', 'user-1', 'EMP-OLD-01', 'Old', 'User', 'existing@demo.example.com', 'Engineering', 'Developer', CURRENT_DATE, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    """)
    cur.execute("""
        INSERT INTO salary_structures (id, employee_id, effective_from, wage, basic, hra, standard_allowance, performance_bonus, lta, fixed_allowance, pf, professional_tax, gross_salary, total_deductions, net_salary, created_at, updated_at)
        VALUES ('sal-1', 'emp-1', CURRENT_DATE, 60000.0, 30000.0, 15000.0, 4167.0, 2499.0, 2499.0, 5835.0, 3600.0, 200.0, 60000.0, 3800.0, 56200.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    """)
    conn.commit()
    conn.close()

    # 3. Upgrade to 0002_multi_tenant_saas (migration under test)
    command.upgrade(alembic_cfg, "0002_multi_tenant_saas")

    # 4. Verify data preservation & company_id population
    conn = sqlite3.connect(test_db_path)
    cur = conn.cursor()

    # Check company created
    comp_row = cur.execute("SELECT id, name, slug FROM companies WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'").fetchone()
    assert comp_row is not None
    assert comp_row[1] == "Dayflow Technologies Inc."

    # Check profile updated with company_id and defaults
    prof_row = cur.execute("SELECT id, email, company_id, is_active, must_reset_password FROM profiles WHERE id = 'user-1'").fetchone()
    assert prof_row is not None
    assert prof_row[2] == "cccccccc-cccc-cccc-cccc-cccccccccccc"
    assert prof_row[3] == 1  # is_active
    assert prof_row[4] == 0  # must_reset_password

    # Check employee updated with company_id
    emp_row = cur.execute("SELECT id, employee_id, company_id FROM employees WHERE id = 'emp-1'").fetchone()
    assert emp_row is not None
    assert emp_row[2] == "cccccccc-cccc-cccc-cccc-cccccccccccc"

    # Check salary structure updated with company_id
    sal_row = cur.execute("SELECT id, company_id FROM salary_structures WHERE id = 'sal-1'").fetchone()
    assert sal_row is not None
    assert sal_row[1] == "cccccccc-cccc-cccc-cccc-cccccccccccc"

    conn.close()

    # 5. Upgrade to head (0003_repair_tenant_schema)
    command.upgrade(alembic_cfg, "head")

    # 6. Test Downgrade and Re-upgrade
    command.downgrade(alembic_cfg, "0001_initial_schema")
    command.upgrade(alembic_cfg, "head")


@pytest.mark.asyncio
async def test_repair_migration_on_inconsistent_database(tmp_path):
    """
    Test scenario where database was at 0001, stamped at 0002 without column additions,
    and 0003_repair_tenant_schema safely fixes all missing columns & backfills.
    """
    test_db_path = str(tmp_path / "inconsistent_repair_test.db")
    db_url = f"sqlite+aiosqlite:///{test_db_path}"

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # 1. Build initial schema
    command.upgrade(alembic_cfg, "0001_initial_schema")

    # 2. Insert records
    conn = sqlite3.connect(test_db_path)
    cur = conn.cursor()
    cur.execute("INSERT INTO profiles (id, email, password_hash, role) VALUES ('p-100', 'repair@test.io', 'hash', 'HR')")
    cur.execute("INSERT INTO employees (id, user_id, employee_id, first_name, last_name, email, department, designation) VALUES ('e-100', 'p-100', 'EMP-100', 'Repair', 'Tester', 'repair@test.io', 'HR', 'Manager')")
    conn.commit()
    conn.close()

    # 3. Simulate stamp to 0002
    command.stamp(alembic_cfg, "0002_multi_tenant_saas")

    # 4. Upgrade to 0003_repair_tenant_schema
    command.upgrade(alembic_cfg, "0003_repair_tenant_schema")

    # 5. Verify repair success
    conn = sqlite3.connect(test_db_path)
    cur = conn.cursor()
    prof = cur.execute("SELECT id, company_id, is_active FROM profiles WHERE id = 'p-100'").fetchone()
    assert prof[1] == "cccccccc-cccc-cccc-cccc-cccccccccccc"
    assert prof[2] == 1
    emp = cur.execute("SELECT id, company_id FROM employees WHERE id = 'e-100'").fetchone()
    assert emp[1] == "cccccccc-cccc-cccc-cccc-cccccccccccc"
    conn.close()
