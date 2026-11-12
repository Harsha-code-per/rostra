import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_login_and_auth_flow(client: AsyncClient):
    # 1. Login as Alex Rivera (Employee)
    res = await client.post("/api/v1/auth/login", json={
        "email": "alex.rivera@demo.example.com",
        "password": "password123",
    })
    assert res.status_code == 200
    alex_data = res.json()
    assert "access_token" in alex_data
    assert alex_data["user"]["role"] == "EMPLOYEE"
    assert alex_data["user"]["employee"]["employee_id"] == "EMP-003"

    alex_token = alex_data["access_token"]
    headers = {"Authorization": f"Bearer {alex_token}"}

    # 2. Get Employee Me Profile
    me_res = await client.get("/api/v1/employees/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "alex.rivera@demo.example.com"
    assert me_data["department"] == "Engineering"

    # 3. Login as Sarah (HR)
    hr_res = await client.post("/api/v1/auth/login", json={
        "email": "sarah.hr@demo.example.com",
        "password": "password123",
    })
    assert hr_res.status_code == 200
    hr_data = hr_res.json()
    assert hr_data["user"]["role"] == "HR"

    # 4. Invalid Password Rejection
    bad_res = await client.post("/api/v1/auth/login", json={
        "email": "alex.rivera@demo.example.com",
        "password": "wrongpassword",
    })
    assert bad_res.status_code == 401


@pytest.mark.asyncio
async def test_payroll_dynamic_recalculation_endpoint(client: AsyncClient):
    # Login as Sarah (HR)
    hr_res = await client.post("/api/v1/auth/login", json={
        "email": "sarah.hr@demo.example.com",
        "password": "password123",
    })
    hr_token = hr_res.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # Update Wage for Alex (EMP-003): ₹75,000 -> ₹90,000
    update_res = await client.put(
        "/api/v1/admin/payroll/EMP-003/salary",
        json={"wage": 90000.0},
        headers=hr_headers,
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["wage"] == 90000.0
    assert data["basic"] == 45000.0
    assert data["hra"] == 22500.0
    assert data["pf"] == 5400.0
    assert data["professional_tax"] == 200.0
    assert data["gross_salary"] == 90000.0
    assert data["total_deductions"] == 5600.0
    assert data["net_salary"] == 84400.0


@pytest.mark.asyncio
async def test_leaves_workflow_and_approval(client: AsyncClient):
    # Alex (Employee) Login
    alex_res = await client.post("/api/v1/auth/login", json={
        "email": "alex.rivera@demo.example.com",
        "password": "password123",
    })
    alex_token = alex_res.json()["access_token"]
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    # Apply for 2-day Sick Leave
    apply_res = await client.post(
        "/api/v1/leaves",
        json={
            "leave_type": "SICK",
            "start_date": "2026-09-01",
            "end_date": "2026-09-02",
            "total_days": 2,
            "reason": "Doctor appointment & recovery",
        },
        headers=alex_headers,
    )
    assert apply_res.status_code == 201
    leave_data = apply_res.json()
    assert leave_data["status"] == "PENDING"
    leave_id = leave_data["id"]

    # HR Login
    hr_res = await client.post("/api/v1/auth/login", json={
        "email": "sarah.hr@demo.example.com",
        "password": "password123",
    })
    hr_token = hr_res.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # Approve Leave
    appr_res = await client.patch(
        f"/api/v1/leaves/{leave_id}/approve",
        json={"hr_comments": "Approved. Get well soon!"},
        headers=hr_headers,
    )
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["status"] == "APPROVED"
    assert appr_data["hr_comments"] == "Approved. Get well soon!"


@pytest.mark.asyncio
async def test_executive_analytics_dashboard(client: AsyncClient):
    # HR Login
    hr_res = await client.post("/api/v1/auth/login", json={
        "email": "sarah.hr@demo.example.com",
        "password": "password123",
    })
    hr_token = hr_res.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    dash_res = await client.get("/api/v1/analytics/dashboard", headers=hr_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()

    assert "metrics" in dash_data
    assert dash_data["metrics"]["total_employees"] >= 11
    assert "department_distribution" in dash_data
    assert len(dash_data["department_distribution"]) > 0
    assert "attendance_trends" in dash_data


@pytest.mark.asyncio
async def test_registration_rbac_restrictions(client: AsyncClient):
    new_user_payload = {
        "employee_id": "EMP-999",
        "email": "test.newbie@demo.example.com",
        "password": "StrongPassword123!",
        "first_name": "Test",
        "last_name": "Newbie",
        "role": "EMPLOYEE",
        "department": "Engineering",
        "designation": "Junior Developer",
    }

    # 1. Unauthenticated registration attempt -> 401
    unauth_res = await client.post("/api/v1/auth/register", json=new_user_payload)
    assert unauth_res.status_code == 401

    # 2. EMPLOYEE trying to register a new user -> 403
    alex_res = await client.post("/api/v1/auth/login", json={
        "email": "alex.rivera@demo.example.com",
        "password": "password123",
    })
    alex_token = alex_res.json()["access_token"]
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    emp_reg_res = await client.post("/api/v1/auth/register", json=new_user_payload, headers=alex_headers)
    assert emp_reg_res.status_code == 403

    # 3. HR registering a new user -> 201
    hr_res = await client.post("/api/v1/auth/login", json={
        "email": "sarah.hr@demo.example.com",
        "password": "password123",
    })
    hr_token = hr_res.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    hr_reg_res = await client.post("/api/v1/auth/register", json=new_user_payload, headers=hr_headers)
    assert hr_reg_res.status_code == 201
    assert hr_reg_res.json()["employee_id"] == "EMP-999"


@pytest.mark.asyncio
async def test_payroll_rbac_and_ownership(client: AsyncClient):
    # Alex (Employee EMP-003)
    alex_res = await client.post("/api/v1/auth/login", json={
        "email": "alex.rivera@demo.example.com",
        "password": "password123",
    })
    alex_token = alex_res.json()["access_token"]
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    # Sarah (HR EMP-002)
    hr_res = await client.post("/api/v1/auth/login", json={
        "email": "sarah.hr@demo.example.com",
        "password": "password123",
    })
    hr_token = hr_res.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # 1. EMPLOYEE viewing own payroll (EMP-003) -> 200 OK
    own_res = await client.get("/api/v1/admin/payroll/EMP-003", headers=alex_headers)
    assert own_res.status_code == 200
    assert own_res.json()["employee_id"] == "EMP-003"

    # 2. EMPLOYEE trying to view Arthur's payroll (EMP-001) -> 403 Forbidden
    other_res = await client.get("/api/v1/admin/payroll/EMP-001", headers=alex_headers)
    assert other_res.status_code == 403

    # 3. EMPLOYEE trying to edit wage -> 403 Forbidden
    emp_update_res = await client.put(
        "/api/v1/admin/payroll/EMP-003/salary",
        json={"wage": 100000.0},
        headers=alex_headers,
    )
    assert emp_update_res.status_code == 403

    # 4. HR viewing Alex's payroll (EMP-003) -> 200 OK
    hr_view_res = await client.get("/api/v1/admin/payroll/EMP-003", headers=hr_headers)
    assert hr_view_res.status_code == 200
    assert hr_view_res.json()["employee_id"] == "EMP-003"


@pytest.mark.asyncio
async def test_leave_approval_rbac_restriction(client: AsyncClient):
    # Alex (Employee)
    alex_res = await client.post("/api/v1/auth/login", json={
        "email": "alex.rivera@demo.example.com",
        "password": "password123",
    })
    alex_token = alex_res.json()["access_token"]
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    # Employee trying to approve leave -> 403 Forbidden
    appr_res = await client.patch(
        "/api/v1/leaves/some-leave-id/approve",
        json={"hr_comments": "Approved"},
        headers=alex_headers,
    )
    assert appr_res.status_code == 403


@pytest.mark.asyncio
async def test_seed_attendance_timestamps_date_consistency(client: AsyncClient):
    # Sarah (HR) Login
    hr_res = await client.post("/api/v1/auth/login", json={
        "email": "sarah.hr@demo.example.com",
        "password": "password123",
    })
    hr_token = hr_res.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # Query Alex's historical attendance records
    att_res = await client.get("/api/v1/attendance/EMP-003", headers=hr_headers)
    assert att_res.status_code == 200
    records = att_res.json()["records"]

    # Verify that every record has check_in and check_out dates matching work_date exactly
    for rec in records:
        work_date_str = rec["work_date"]
        if rec["check_in"]:
            check_in_date_str = rec["check_in"][:10]
            assert check_in_date_str == work_date_str, f"Mismatch: check_in {rec['check_in']} vs work_date {work_date_str}"
        if rec["check_out"]:
            check_out_date_str = rec["check_out"][:10]
            assert check_out_date_str == work_date_str, f"Mismatch: check_out {rec['check_out']} vs work_date {work_date_str}"


@pytest.mark.asyncio
async def test_real_runtime_attendance_check_in_out(client: AsyncClient):
    # Login as David Chen (EMP-005)
    david_res = await client.post("/api/v1/auth/login", json={
        "email": "david.chen@demo.example.com",
        "password": "password123",
    })
    david_token = david_res.json()["access_token"]
    david_headers = {"Authorization": f"Bearer {david_token}"}

    # 1. Check in
    cin_res = await client.post(
        "/api/v1/attendance/check-in",
        json={"notes": "Real runtime test check-in"},
        headers=david_headers,
    )
    assert cin_res.status_code == 200
    cin_data = cin_res.json()
    assert cin_data["status"] == "PRESENT"
    assert cin_data["work_date"] == cin_data["check_in"][:10]

    # 2. Duplicate check-in should be rejected
    dup_res = await client.post(
        "/api/v1/attendance/check-in",
        json={"notes": "Duplicate"},
        headers=david_headers,
    )
    assert dup_res.status_code == 400

    # 3. Check out
    cout_res = await client.post(
        "/api/v1/attendance/check-out",
        json={"notes": "Real runtime test check-out"},
        headers=david_headers,
    )
    assert cout_res.status_code == 200
    cout_data = cout_res.json()
    assert cout_data["check_out"] is not None
    assert cout_data["work_date"] == cout_data["check_out"][:10]
    assert cout_data["total_hours"] >= 0.1


@pytest.mark.asyncio
async def test_employee_wage_privacy_and_analytics_rbac(client: AsyncClient):
    # Alex (Employee) Login
    alex_res = await client.post("/api/v1/auth/login", json={
        "email": "alex.rivera@demo.example.com",
        "password": "password123",
    })
    alex_token = alex_res.json()["access_token"]
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    # Sarah (HR) Login
    hr_res = await client.post("/api/v1/auth/login", json={
        "email": "sarah.hr@demo.example.com",
        "password": "password123",
    })
    hr_token = hr_res.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # 1. Alex querying employees list: colleagues' wages should be masked to 0.0, his own wage visible
    alex_list_res = await client.get("/api/v1/employees", headers=alex_headers)
    assert alex_list_res.status_code == 200
    alex_list = alex_list_res.json()
    for emp in alex_list:
        if emp["employee_id"] == "EMP-003":
            assert emp["wage"] > 0
        else:
            assert emp["wage"] == 0.0

    # 2. Sarah (HR) querying employees list: all wages visible
    hr_list_res = await client.get("/api/v1/employees", headers=hr_headers)
    assert hr_list_res.status_code == 200
    hr_list = hr_list_res.json()
    assert all(e["wage"] > 0 for e in hr_list)

    # 3. Alex attempting to access executive analytics -> 403 Forbidden
    alex_dash_res = await client.get("/api/v1/analytics/dashboard", headers=alex_headers)
    assert alex_dash_res.status_code == 403

    # 4. Sarah (HR) accessing executive analytics -> 200 OK
    hr_dash_res = await client.get("/api/v1/analytics/dashboard", headers=hr_headers)
    assert hr_dash_res.status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_flow(client: AsyncClient):
    res = await client.post("/api/v1/auth/forgot-password", json={
        "email": "alex.rivera@demo.example.com"
    })
    assert res.status_code == 200
    assert "dispatched" in res.json()["message"]

    # Test non-existent email still returns 200 to prevent enumeration
    res_fake = await client.post("/api/v1/auth/forgot-password", json={
        "email": "nonexistent@demo.example.com"
    })
    assert res_fake.status_code == 200
    assert "dispatched" in res_fake.json()["message"]
