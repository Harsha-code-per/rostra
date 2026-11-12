import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_super_admin_login(client: AsyncClient):
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "owner@demo.example.com", "password": "RostraPlatform#2026"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "SUPER_ADMIN"
    assert data["user"]["email"] == "owner@demo.example.com"


@pytest.mark.asyncio
async def test_super_admin_negative_rbac(client: AsyncClient):
    # 1. Tenant Admin tries to access Super Admin endpoint
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@demo.example.com", "password": "password123"},
    )
    admin_token = admin_login.json()["access_token"]

    res = await client.get(
        "/api/v1/super-admin/companies",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 403

    # 2. Tenant HR tries to provision company
    hr_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "sarah.hr@demo.example.com", "password": "password123"},
    )
    hr_token = hr_login.json()["access_token"]

    res = await client.post(
        "/api/v1/super-admin/companies",
        headers={"Authorization": f"Bearer {hr_token}"},
        json={
            "name": "Unauthorized Inc",
            "adminName": "Hacker",
            "adminEmail": "hacker@test.io",
            "plan": "Enterprise",
        },
    )
    assert res.status_code == 403

    # 3. Employee tries to view inquiries
    emp_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "alex.rivera@demo.example.com", "password": "password123"},
    )
    emp_token = emp_login.json()["access_token"]

    res = await client.get(
        "/api/v1/super-admin/inquiries",
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_super_admin_provision_company_and_persistence(client: AsyncClient):
    super_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "owner@demo.example.com", "password": "RostraPlatform#2026"},
    )
    super_token = super_login.json()["access_token"]

    # Provision new client company
    res = await client.post(
        "/api/v1/super-admin/companies",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "name": "Starlight Dynamics",
            "domain": "starlight.io",
            "adminName": "Arthur Pendelton",
            "adminEmail": "arthur@starlight.io",
            "plan": "Enterprise",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert "company" in data
    assert data["company"]["name"] == "Starlight Dynamics"
    assert data["company"]["adminEmail"] == "arthur@starlight.io"
    assert "temporaryPassword" in data

    # List companies and verify new company is present
    list_res = await client.get(
        "/api/v1/super-admin/companies",
        headers={"Authorization": f"Bearer {super_token}"},
    )
    assert list_res.status_code == 200
    companies = list_res.json()
    matched = next((c for c in companies if c["adminEmail"] == "arthur@starlight.io"), None)
    assert matched is not None
    assert matched["name"] == "Starlight Dynamics"


@pytest.mark.asyncio
async def test_provisioned_admin_login_and_forced_password_reset(client: AsyncClient):
    super_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "owner@demo.example.com", "password": "RostraPlatform#2026"},
    )
    super_token = super_login.json()["access_token"]

    # Provision new company
    prov_res = await client.post(
        "/api/v1/super-admin/companies",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "name": "Nova BioTech",
            "domain": "novabio.io",
            "adminName": "Elena Vance",
            "adminEmail": "elena@novabio.io",
            "plan": "Growth",
        },
    )
    assert prov_res.status_code == 201
    temp_pass = prov_res.json()["temporaryPassword"]

    # 1. Login with temporary password
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "elena@novabio.io", "password": temp_pass},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["must_reset_password"] is True
    token = login_data["access_token"]

    # 2. Change password to permanent
    change_res = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"old_password": temp_pass, "new_password": "PermanentPass#2026"},
    )
    assert change_res.status_code == 200
    assert "Password updated successfully" in change_res.json()["message"]

    # 3. Login with permanent password
    new_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "elena@novabio.io", "password": "PermanentPass#2026"},
    )
    assert new_login.status_code == 200
    assert new_login.json()["must_reset_password"] is False


@pytest.mark.asyncio
async def test_public_inquiry_and_super_admin_review(client: AsyncClient):
    # 1. Public user submits inquiry
    inq_res = await client.post(
        "/api/v1/inquiries",
        json={
            "companyName": "Vortex Analytics",
            "contactName": "Marcus Ray",
            "workEmail": "marcus@vortex.ai",
            "phone": "+1 555-9876",
            "teamSize": "50-100",
            "planInterest": "Enterprise",
            "message": "Interested in 100 enterprise seats.",
        },
    )
    assert inq_res.status_code == 201, inq_res.text
    inq_data = inq_res.json()
    inquiry_id = inq_data["id"]
    assert inq_data["status"] == "NEW"

    # 2. Super Admin lists inquiries
    super_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "owner@demo.example.com", "password": "RostraPlatform#2026"},
    )
    super_token = super_login.json()["access_token"]

    list_res = await client.get(
        "/api/v1/super-admin/inquiries",
        headers={"Authorization": f"Bearer {super_token}"},
    )
    assert list_res.status_code == 200
    all_inqs = list_res.json()
    matched = next((i for i in all_inqs if i["id"] == inquiry_id), None)
    assert matched is not None

    # 3. Super Admin updates status to CONTACTED
    patch_res = await client.patch(
        f"/api/v1/super-admin/inquiries/{inquiry_id}/status",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"status": "CONTACTED"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "CONTACTED"
