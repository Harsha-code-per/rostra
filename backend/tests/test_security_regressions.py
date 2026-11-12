"""Regression tests for the security/correctness fixes. Each test provisions its own tenant so shared seed data stays untouched."""
import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from app.core.limiter import limiter
from app.services.email_service import email_service


async def _login(client, email, password):
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return res


async def _tenant(client, max_employees=None):
    """Provision a fresh company via the super admin; returns (company_id, admin_headers)."""
    owner = (await _login(client, "owner@demo.example.com", "RostraPlatform#2026")).json()["access_token"]
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    body = {"name": "Test Co", "adminName": "Ada Admin", "adminEmail": email, "plan": "Growth"}
    if max_employees:
        body["maxEmployees"] = max_employees
    res = await client.post("/api/v1/super-admin/companies", json=body, headers={"Authorization": f"Bearer {owner}"})
    assert res.status_code == 201, res.text
    data = res.json()
    token = (await _login(client, email, data["temporaryPassword"])).json()["access_token"]
    return data["company"]["id"], {"Authorization": f"Bearer {token}"}, {"Authorization": f"Bearer {owner}"}, email, data["temporaryPassword"]


def _new_user(role="EMPLOYEE", **kw):
    n = uuid.uuid4().hex[:6]
    return {"employee_id": f"X-{n}", "email": f"u{n}@example.com", "password": "Str0ngPass!", "first_name": "T", "last_name": "U", "role": role, **kw}


async def test_admin_cannot_create_super_admin(client: AsyncClient):
    _, admin, *_ = await _tenant(client)
    res = await client.post("/api/v1/auth/register", json=_new_user("SUPER_ADMIN"), headers=admin)
    assert res.status_code == 403
    assert (await client.post("/api/v1/auth/register", json=_new_user("ADMIN"), headers=admin)).status_code == 403
    assert (await client.post("/api/v1/auth/register", json=_new_user("HR"), headers=admin)).status_code == 201


async def test_hr_can_only_create_employees(client: AsyncClient):
    _, admin, *_ = await _tenant(client)
    hr = _new_user("HR")
    assert (await client.post("/api/v1/auth/register", json=hr, headers=admin)).status_code == 201
    hr_token = (await _login(client, hr["email"], hr["password"])).json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}
    assert (await client.post("/api/v1/auth/register", json=_new_user("HR"), headers=hr_headers)).status_code == 403
    assert (await client.post("/api/v1/auth/register", json=_new_user("EMPLOYEE"), headers=hr_headers)).status_code == 201


async def test_register_rejects_short_password(client: AsyncClient):
    _, admin, *_ = await _tenant(client)
    res = await client.post("/api/v1/auth/register", json=_new_user(password="short"), headers=admin)
    assert res.status_code == 422


async def test_plan_employee_limit_is_enforced(client: AsyncClient):
    _, admin, *_ = await _tenant(client, max_employees=2)  # the admin already counts as 1
    assert (await client.post("/api/v1/auth/register", json=_new_user(), headers=admin)).status_code == 201
    assert (await client.post("/api/v1/auth/register", json=_new_user(), headers=admin)).status_code == 402


async def test_put_employee_wage_updates_salary(client: AsyncClient):
    _, admin, *_ = await _tenant(client)
    user = _new_user()
    assert (await client.post("/api/v1/auth/register", json=user, headers=admin)).status_code == 201
    res = await client.put(f"/api/v1/employees/{user['employee_id']}", json={"wage": 90000}, headers=admin)
    assert res.status_code == 200, res.text
    payroll = await client.get(f"/api/v1/payroll/{user['employee_id']}", headers=admin)
    assert payroll.json()["wage"] == 90000


async def test_wage_must_be_positive(client: AsyncClient):
    _, admin, *_ = await _tenant(client)
    user = _new_user()
    await client.post("/api/v1/auth/register", json=user, headers=admin)
    res = await client.put(f"/api/v1/admin/payroll/{user['employee_id']}/salary", json={"wage": -5}, headers=admin)
    assert res.status_code == 422


async def test_suspended_tenant_is_locked_out(client: AsyncClient):
    company_id, admin, owner, email, temp = await _tenant(client)
    assert (await client.get("/api/v1/employees/me", headers=admin)).status_code == 200
    res = await client.patch(f"/api/v1/super-admin/companies/{company_id}/status", json={"status": "SUSPENDED"}, headers=owner)
    assert res.status_code == 200
    assert (await client.get("/api/v1/employees/me", headers=admin)).status_code == 403  # existing token
    assert (await _login(client, email, temp)).status_code == 403  # new login
    await client.patch(f"/api/v1/super-admin/companies/{company_id}/status", json={"status": "ACTIVE"}, headers=owner)
    assert (await client.get("/api/v1/employees/me", headers=admin)).status_code == 200


async def test_invalid_company_status_rejected(client: AsyncClient):
    company_id, _, owner, *_ = await _tenant(client)
    res = await client.patch(f"/api/v1/super-admin/companies/{company_id}/status", json={"status": "banana"}, headers=owner)
    assert res.status_code == 422


async def test_password_reset_flow_is_single_use(client: AsyncClient, monkeypatch):
    _, _, _, email, temp = await _tenant(client)
    sent = {}
    monkeypatch.setattr(email_service, "send_password_reset_email", lambda **kw: sent.update(kw))
    assert (await client.post("/api/v1/auth/forgot-password", json={"email": email})).status_code == 200
    token = sent["reset_link"].split("token=")[1]

    assert (await client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "short"})).status_code == 422
    ok = await client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "BrandNew#Pass1"})
    assert ok.status_code == 200
    assert (await _login(client, email, "BrandNew#Pass1")).status_code == 200
    assert (await _login(client, email, temp)).status_code == 401
    again = await client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "AnotherPass#2"})
    assert again.status_code == 400  # token already used


async def test_unknown_reset_token_rejected(client: AsyncClient):
    res = await client.post("/api/v1/auth/reset-password", json={"token": "x" * 40, "new_password": "BrandNew#Pass1"})
    assert res.status_code == 400


async def test_leave_cannot_be_reviewed_twice_and_days_are_server_side(client: AsyncClient):
    _, admin, *_ = await _tenant(client)
    user = _new_user()
    await client.post("/api/v1/auth/register", json=user, headers=admin)
    emp = {"Authorization": "Bearer " + (await _login(client, user["email"], user["password"])).json()["access_token"]}
    start = date.today() + timedelta(days=30)
    res = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "PAID", "start_date": str(start), "end_date": str(start + timedelta(days=2)), "total_days": 99, "reason": "Family trip"},
        headers=emp,
    )
    assert res.status_code == 201, res.text
    leave = res.json()
    assert leave["total_days"] == 3
    assert (await client.patch(f"/api/v1/leaves/{leave['id']}/approve", headers=admin)).status_code == 200
    assert (await client.patch(f"/api/v1/leaves/{leave['id']}/approve", headers=admin)).status_code == 409
    assert (await client.patch(f"/api/v1/leaves/{leave['id']}/reject", headers=admin)).status_code == 409


async def test_leave_longer_than_90_days_rejected(client: AsyncClient):
    _, admin, *_ = await _tenant(client)
    start = date.today() + timedelta(days=10)
    res = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "PAID", "start_date": str(start), "end_date": str(start + timedelta(days=200)), "reason": "Too long"},
        headers=admin,
    )
    assert res.status_code == 400


async def test_payroll_does_not_invent_attendance(client: AsyncClient):
    _, admin, *_ = await _tenant(client)
    res = await client.get("/api/v1/payroll/me", headers=admin)
    assert res.status_code == 200
    summary = res.json()["attendance_summary"]
    assert summary["present_days"] == 0 and summary["paid_leave_days"] == 0


async def test_salary_components_always_sum_to_wage():
    from app.services.payroll_service import calculate_salary_structure

    for wage in (5000.0, 12000.0, 50000.0, 250000.0):
        c = calculate_salary_structure(wage)
        total = c["basic"] + c["hra"] + c["standard_allowance"] + c["performance_bonus"] + c["lta"] + c["fixed_allowance"]
        assert round(total, 2) == wage
        assert c["fixed_allowance"] >= 0


async def test_login_is_rate_limited(client: AsyncClient):
    limiter.enabled = True
    limiter.reset()
    try:
        codes = [
            (await client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "wrongpass1"})).status_code
            for _ in range(12)
        ]
    finally:
        limiter.enabled = False
        limiter.reset()
    assert 429 in codes and codes[0] == 401


def test_production_rejects_default_jwt_secret():
    from app.config import Settings

    with pytest.raises(ValueError):
        Settings(ENVIRONMENT="production", _env_file=None)
    Settings(ENVIRONMENT="production", JWT_SECRET_KEY="x" * 40, CORS_ORIGINS="https://app.example.com", _env_file=None)


async def test_inquiry_validates_email(client: AsyncClient):
    res = await client.post("/api/v1/inquiries", json={"companyName": "Acme", "contactName": "Bo", "workEmail": "not-an-email"})
    assert res.status_code == 422


async def test_hr_can_override_attendance_but_employee_cannot(client: AsyncClient):
    _, admin, *_ = await _tenant(client)
    user = _new_user()
    await client.post("/api/v1/auth/register", json=user, headers=admin)
    body = {"employee_id": user["employee_id"], "work_date": str(date.today()), "status": "HALF_DAY", "total_hours": 4.5}
    res = await client.put("/api/v1/attendance/override", json=body, headers=admin)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "HALF_DAY"
    again = await client.put("/api/v1/attendance/override", json={**body, "status": "PRESENT"}, headers=admin)
    assert again.json()["id"] == res.json()["id"]  # upsert, not a second row
    emp = {"Authorization": "Bearer " + (await _login(client, user["email"], user["password"])).json()["access_token"]}
    assert (await client.put("/api/v1/attendance/override", json=body, headers=emp)).status_code == 403
    assert (await client.put("/api/v1/attendance/override", json={**body, "status": "NOPE"}, headers=admin)).status_code == 422


def test_neon_style_url_is_made_asyncpg_safe():
    from app.db_url import prepare_database_url

    url, args = prepare_database_url("postgresql://u:p@ep-x.neon.tech/neondb?sslmode=require&channel_binding=require")
    assert url == "postgresql+asyncpg://u:p@ep-x.neon.tech/neondb"
    assert args == {"ssl": True}
    assert prepare_database_url("postgres://u:p@h/db")[0] == "postgresql+asyncpg://u:p@h/db"
    assert prepare_database_url("sqlite+aiosqlite:///x.db")[1] == {"check_same_thread": False}


async def test_inquiry_notifies_the_owner_when_configured(client: AsyncClient, monkeypatch):
    from app.config import settings

    sent = {}
    monkeypatch.setattr(settings, "INQUIRY_NOTIFY_TO", "owner@rostra.test")
    monkeypatch.setattr(email_service, "send_inquiry_notification", lambda **kw: sent.update(kw))
    res = await client.post("/api/v1/inquiries", json={"companyName": "Acme", "contactName": "Jo", "workEmail": "jo@acme.example.com"})
    assert res.status_code == 201
    assert sent["to_email"] == "owner@rostra.test" and sent["company"] == "Acme" and sent["email"] == "jo@acme.example.com"


async def test_plan_sets_the_default_employee_cap(client: AsyncClient):
    owner = {"Authorization": "Bearer " + (await _login(client, "owner@demo.example.com", "RostraPlatform#2026")).json()["access_token"]}
    for plan, cap in (("Starter", 25), ("Growth", 100), ("Enterprise", None)):
        body = {"name": f"{plan} Co", "plan": plan, "adminName": "Ada Admin", "adminEmail": f"{plan.lower()}-{uuid.uuid4().hex[:6]}@example.com"}
        res = await client.post("/api/v1/super-admin/companies", json=body, headers=owner)
        assert res.status_code == 201, res.text
        assert res.json()["company"]["maxEmployees"] == cap
