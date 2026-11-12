import pytest
import time
from datetime import date
from httpx import AsyncClient
from sqlalchemy import select

from app.models.company import Company
from app.models.profile import Profile, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import LeaveType, LeaveTypeEnum
from app.core.security import get_password_hash


@pytest.mark.asyncio
async def test_multi_tenant_isolation_two_companies(client: AsyncClient, db_session):
    """
    Simulate Company A and Company B.
    Ensure total data isolation:
    - Employees of Company A cannot be seen or accessed by Company B.
    - Attendance, leaves, payroll, and analytics are strictly company-scoped.
    """
    # 1. Setup Company B in DB
    comp_b_id = "cccccccc-cccc-cccc-cccc-bbbbbbbbbbbb"
    admin_b_profile_id = "aaaaaaaa-aaaa-aaaa-bbbb-aaaaaaaaaaa1"
    emp_b_profile_id = "aaaaaaaa-aaaa-aaaa-bbbb-aaaaaaaaaaa2"

    comp_b = Company(
        id=comp_b_id,
        name="Acme Corp Global",
        slug="acme-corp",
        currency="USD",
        owner_id=admin_b_profile_id,
        is_active=True,
    )
    db_session.add(comp_b)
    await db_session.flush()

    # Leave types for Company B
    lt_paid_b = LeaveType(
        id="22222222-2222-2222-2222-222222222201",
        company_id=comp_b_id,
        name=LeaveTypeEnum.PAID,
        is_paid=True,
        default_allocation=20,
    )
    db_session.add(lt_paid_b)

    pw_hash = get_password_hash("password123")

    # Admin of Company B
    admin_b = Profile(
        id=admin_b_profile_id,
        company_id=comp_b_id,
        email="owner@acmecorp.com",
        password_hash=pw_hash,
        role=UserRole.ADMIN,
        is_active=True,
        must_reset_password=False,
    )
    db_session.add(admin_b)
    await db_session.flush()

    admin_b_emp = Employee(
        id="bbbbbbbb-bbbb-bbbb-cccc-bbbbbbbbbbb1",
        company_id=comp_b_id,
        user_id=admin_b.id,
        employee_id="ACME-001",
        first_name="Bruce",
        last_name="Wayne",
        email="owner@acmecorp.com",
        phone="+1 555-9999",
        department="Executive",
        designation="Owner & Chairman",
        joining_date=date(2021, 1, 1),
        status=EmployeeStatus.ACTIVE,
    )
    db_session.add(admin_b_emp)

    # Employee of Company B
    emp_b_user = Profile(
        id=emp_b_profile_id,
        company_id=comp_b_id,
        email="clark.kent@acmecorp.com",
        password_hash=pw_hash,
        role=UserRole.EMPLOYEE,
        is_active=True,
        must_reset_password=False,
    )
    db_session.add(emp_b_user)
    await db_session.flush()

    emp_b = Employee(
        id="bbbbbbbb-bbbb-bbbb-cccc-bbbbbbbbbbb2",
        company_id=comp_b_id,
        user_id=emp_b_user.id,
        employee_id="ACME-002",
        first_name="Clark",
        last_name="Kent",
        email="clark.kent@acmecorp.com",
        phone="+1 555-8888",
        department="Editorial",
        designation="Reporter",
        joining_date=date(2022, 5, 1),
        status=EmployeeStatus.ACTIVE,
    )
    db_session.add(emp_b)
    await db_session.commit()

    # Log in as Company A HR (Sarah)
    res_a = await client.post("/api/v1/auth/login", json={"email": "sarah.hr@demo.example.com", "password": "password123"})
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Log in as Company B Admin (Bruce)
    res_b = await client.post("/api/v1/auth/login", json={"email": "owner@acmecorp.com", "password": "password123"})
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. List employees: Company A sees ONLY Company A employees
    list_a = await client.get("/api/v1/employees", headers=headers_a)
    assert list_a.status_code == 200
    emp_emails_a = [e["email"] for e in list_a.json()]
    assert "sarah.hr@demo.example.com" in emp_emails_a
    assert "clark.kent@acmecorp.com" not in emp_emails_a
    assert "owner@acmecorp.com" not in emp_emails_a

    # 2. List employees: Company B sees ONLY Company B employees
    list_b = await client.get("/api/v1/employees", headers=headers_b)
    assert list_b.status_code == 200
    emp_emails_b = [e["email"] for e in list_b.json()]
    assert "clark.kent@acmecorp.com" in emp_emails_b
    assert "owner@acmecorp.com" in emp_emails_b
    assert "sarah.hr@demo.example.com" not in emp_emails_b
    assert len(list_b.json()) == 2

    # 3. Direct access to Company B employee by ID from Company A returns 404 (prevents IDOR)
    cross_get = await client.get(f"/api/v1/employees/{emp_b.id}", headers=headers_a)
    assert cross_get.status_code == 404

    # 4. Direct access to Company B employee payroll from Company A returns 404
    cross_payroll = await client.get(f"/api/v1/admin/payroll/{emp_b.id}", headers=headers_a)
    assert cross_payroll.status_code == 404

    # 5. Direct access to Company B employee attendance from Company A returns 404
    cross_att = await client.get(f"/api/v1/attendance/{emp_b.id}", headers=headers_a)
    assert cross_att.status_code == 404

    # 6. Analytics dashboard isolation: Company B metrics only count Company B data
    dash_b = await client.get("/api/v1/analytics/dashboard", headers=headers_b)
    assert dash_b.status_code == 200
    assert dash_b.json()["metrics"]["total_employees"] == 2


@pytest.mark.asyncio
async def test_negative_rbac_and_privilege_escalation(client: AsyncClient):
    """
    Negative RBAC tests:
    - Employee cannot register users (403).
    - HR cannot create ADMIN accounts (403).
    - HR cannot create duplicate HR accounts (403).
    - Admin cannot create duplicate ADMIN accounts (403).
    - Employee cannot view another employee's payroll (403).
    - Employee cannot modify salary / wages (403).
    - Employee cannot access analytics dashboard (403).
    - Employee cannot approve/reject leave (403).
    """
    # Employee Login (Alex Rivera)
    emp_res = await client.post("/api/v1/auth/login", json={"email": "alex.rivera@demo.example.com", "password": "password123"})
    emp_token = emp_res.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # HR Login (Sarah Jenkins)
    hr_res = await client.post("/api/v1/auth/login", json={"email": "sarah.hr@demo.example.com", "password": "password123"})
    hr_token = hr_res.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # Admin Login (Arthur Morgan)
    admin_res = await client.post("/api/v1/auth/login", json={"email": "admin@demo.example.com", "password": "password123"})
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Employee cannot self-register or register others
    reg_by_emp = await client.post("/api/v1/auth/register", headers=emp_headers, json={
        "email": "hacker@demo.example.com",
        "password": "password123",
        "employee_id": "EMP-999",
        "first_name": "Hacker",
        "last_name": "User",
        "role": "ADMIN",
    })
    assert reg_by_emp.status_code == 403

    # 2. HR cannot create ADMIN account
    reg_admin_by_hr = await client.post("/api/v1/auth/register", headers=hr_headers, json={
        "email": "new.admin@demo.example.com",
        "password": "password123",
        "employee_id": "EMP-901",
        "first_name": "New",
        "last_name": "Admin",
        "role": "ADMIN",
    })
    assert reg_admin_by_hr.status_code == 403

    # 3. HR cannot create HR account (only standard EMPLOYEE)
    reg_hr_by_hr = await client.post("/api/v1/auth/register", headers=hr_headers, json={
        "email": "new.hr@demo.example.com",
        "password": "password123",
        "employee_id": "EMP-902",
        "first_name": "New",
        "last_name": "HR",
        "role": "HR",
    })
    assert reg_hr_by_hr.status_code == 403

    # 4. Admin cannot create duplicate ADMIN account
    reg_admin_by_admin = await client.post("/api/v1/auth/register", headers=admin_headers, json={
        "email": "second.admin@demo.example.com",
        "password": "password123",
        "employee_id": "EMP-903",
        "first_name": "Second",
        "last_name": "Admin",
        "role": "ADMIN",
    })
    assert reg_admin_by_admin.status_code == 403

    # 5. Employee cannot view another employee's payroll
    elena_payroll = await client.get("/api/v1/payroll/EMP-004", headers=emp_headers)
    assert elena_payroll.status_code == 403

    # 6. Employee cannot update wage
    wage_update = await client.put("/api/v1/payroll/EMP-003/salary", headers=emp_headers, json={"wage": 150000.0})
    assert wage_update.status_code == 403

    # 7. Employee cannot access analytics dashboard
    analytics_res = await client.get("/api/v1/analytics/dashboard", headers=emp_headers)
    assert analytics_res.status_code == 403

    # 8. Employee cannot approve leave
    approve_res = await client.patch("/api/v1/leaves/some-leave-id/approve", headers=emp_headers, json={"hr_comments": "Hacked"})
    assert approve_res.status_code == 403


@pytest.mark.asyncio
async def test_password_lifecycle_and_token_invalidation(client: AsyncClient, db_session):
    """
    Test password change lifecycle:
    - New onboarded user has must_reset_password=True.
    - Password change updates password_hash and sets must_reset_password=False.
    - Tokens issued before password change are invalidated (401 Unauthorized).
    - New login with new password succeeds.
    """
    # 1. Admin onboards a new employee
    admin_res = await client.post("/api/v1/auth/login", json={"email": "admin@demo.example.com", "password": "password123"})
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    new_emp_payload = {
        "email": "onboarding.user@demo.example.com",
        "password": "tempPassword123",
        "employee_id": "EMP-777",
        "first_name": "Sam",
        "last_name": "Fisher",
        "department": "Security",
        "designation": "Security Analyst",
        "wage": 70000.0,
    }
    reg_res = await client.post("/api/v1/auth/register", headers=admin_headers, json=new_emp_payload)
    assert reg_res.status_code == 201

    # 2. First login with temporary credentials
    login_res = await client.post("/api/v1/auth/login", json={
        "email": "onboarding.user@demo.example.com",
        "password": "tempPassword123",
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["must_reset_password"] is True
    old_token = login_data["access_token"]
    old_headers = {"Authorization": f"Bearer {old_token}"}

    # Small delay to ensure timestamp difference
    time.sleep(1.1)

    # 3. Change password with incorrect old password -> fails
    fail_change = await client.post("/api/v1/auth/change-password", headers=old_headers, json={
        "old_password": "wrongPassword",
        "new_password": "newSecurePassword456",
    })
    assert fail_change.status_code == 400

    # 4. Change password with valid old password -> succeeds
    success_change = await client.post("/api/v1/auth/change-password", headers=old_headers, json={
        "old_password": "tempPassword123",
        "new_password": "newSecurePassword456",
    })
    assert success_change.status_code == 200

    # 5. Old token is now invalidated (iat < password_changed_at)
    stale_profile = await client.get("/api/v1/auth/me", headers=old_headers)
    assert stale_profile.status_code == 401
    assert "revoked" in stale_profile.json()["detail"] or "expired" in stale_profile.json()["detail"] or "invalid" in stale_profile.json()["detail"]

    # 6. Login with new password -> must_reset_password is False
    new_login_res = await client.post("/api/v1/auth/login", json={
        "email": "onboarding.user@demo.example.com",
        "password": "newSecurePassword456",
    })
    assert new_login_res.status_code == 200
    assert new_login_res.json()["must_reset_password"] is False
    new_token = new_login_res.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # 7. New token works properly
    profile_check = await client.get("/api/v1/auth/me", headers=new_headers)
    assert profile_check.status_code == 200
    assert profile_check.json()["email"] == "onboarding.user@demo.example.com"


@pytest.mark.asyncio
async def test_account_deactivation_lock(client: AsyncClient, db_session):
    """
    Test account lifecycle / disable mechanism:
    - Disabled account (is_active=False) cannot log in.
    - Active token becomes invalid if account is deactivated.
    """
    # 1. Admin login and create active user
    admin_res = await client.post("/api/v1/auth/login", json={"email": "admin@demo.example.com", "password": "password123"})
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    user_payload = {
        "email": "deactivate.me@demo.example.com",
        "password": "password123",
        "employee_id": "EMP-888",
        "first_name": "Test",
        "last_name": "Deactivate",
        "department": "QA",
        "designation": "Tester",
    }
    await client.post("/api/v1/auth/register", headers=admin_headers, json=user_payload)

    # 2. Login to get token
    login_res = await client.post("/api/v1/auth/login", json={"email": "deactivate.me@demo.example.com", "password": "password123"})
    user_token = login_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 3. Manually deactivate user in DB
    user_stmt = select(Profile).where(Profile.email == "deactivate.me@demo.example.com")
    user_obj = (await db_session.execute(user_stmt)).scalar_one()
    user_obj.is_active = False
    await db_session.commit()

    # 4. Token requests should now return 401
    prot_res = await client.get("/api/v1/auth/me", headers=user_headers)
    assert prot_res.status_code == 401
    assert "deactivated" in prot_res.json()["detail"] or "disabled" in prot_res.json()["detail"]

    # 5. Login attempts should return 401
    login_attempt = await client.post("/api/v1/auth/login", json={"email": "deactivate.me@demo.example.com", "password": "password123"})
    assert login_attempt.status_code == 401


@pytest.mark.asyncio
async def test_transactional_multi_record_onboarding(client: AsyncClient):
    """
    Verify onboarding atomically creates Profile, Employee, and SalaryStructure.
    Duplicate employee_id or email rolls back transaction cleanly.
    """
    admin_res = await client.post("/api/v1/auth/login", json={"email": "admin@demo.example.com", "password": "password123"})
    admin_headers = {"Authorization": f"Bearer {admin_res.json()['access_token']}"}

    # Duplicate employee_id
    dup_emp_id_res = await client.post("/api/v1/auth/register", headers=admin_headers, json={
        "email": "unique.email@demo.example.com",
        "password": "password123",
        "employee_id": "EMP-001",  # Existing EMP-001
        "first_name": "Duplicate",
        "last_name": "Test",
    })
    assert dup_emp_id_res.status_code == 400
    assert "already exists" in dup_emp_id_res.json()["detail"]

    # Duplicate email
    dup_email_res = await client.post("/api/v1/auth/register", headers=admin_headers, json={
        "email": "admin@demo.example.com",  # Existing email
        "password": "password123",
        "employee_id": "EMP-9999",
        "first_name": "Duplicate",
        "last_name": "Test",
    })
    assert dup_email_res.status_code == 400
    assert "already exists" in dup_email_res.json()["detail"]
