"""
Rostra — End-to-End Real-Data Multi-Tenant Lifecycle Verification Suite
Executes the full 7-stage SaaS workflow against real FastAPI endpoints and database.
"""

import asyncio
import httpx
import uuid

BASE_URL = "http://localhost:8000/api/v1"

async def run_e2e_verification():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        print("=" * 80)
        print("⚡ ROSTRA HRMS — FULL-STACK REAL-DATA E2E WORKFLOW VERIFICATION")
        print("=" * 80)

        run_id = uuid.uuid4().hex[:6]
        tenant_domain = f"starlight-{run_id}.ai"
        founder_email = f"elena.{run_id}@{tenant_domain}"
        emp_email = f"marcus.{run_id}@{tenant_domain}"
        emp_code = f"EMP-{run_id.upper()[:4]}"

        # -------------------------------------------------------------------------
        # STAGE 1: Public Lead Submission (/contact)
        # -------------------------------------------------------------------------
        print(f"\n[STAGE 1] Submitting Enterprise Client Inquiry for {tenant_domain}...")
        inquiry_payload = {
            "contact_name": "Elena Vance",
            "work_email": founder_email,
            "company_name": f"Starlight Dynamics {run_id.upper()}",
            "team_size": "51-200",
            "plan_interest": "Enterprise",
            "message": "We need a unified multi-tenant HRMS with automated statutory payroll.",
        }
        res = await client.post("/inquiries", json=inquiry_payload)
        assert res.status_code == 201, f"Failed inquiry submission: {res.text}"
        inquiry_data = res.json()
        c_name = inquiry_data.get("companyName") or inquiry_data.get("company_name")
        contact_name = inquiry_data.get("contactName") or inquiry_data.get("contact_name")
        print(f"  ✓ Inquiry Registered: {c_name} by {contact_name} (ID: {inquiry_data['id']})")

        # -------------------------------------------------------------------------
        # STAGE 2: Platform Super Admin Control Plane (/platform-admin)
        # -------------------------------------------------------------------------
        print("\n[STAGE 2] Platform Super Admin Login & Multi-Tenant Provisioning...")
        login_res = await client.post("/auth/login", json={
            "email": "owner@demo.example.com",
            "password": "RostraPlatform#2026"
        })
        assert login_res.status_code == 200, f"Super Admin login failed: {login_res.text}"
        super_token = login_res.json()["access_token"]
        super_headers = {"Authorization": f"Bearer {super_token}"}
        print(f"  ✓ Super Admin Authenticated: owner@demo.example.com (Role: {login_res.json()['user']['role']})")

        # Verify inquiries list
        inquiries_res = await client.get("/super-admin/inquiries", headers=super_headers)
        assert inquiries_res.status_code == 200
        inquiries_list = inquiries_res.json()
        assert any(
            (i.get("workEmail") == founder_email or i.get("work_email") == founder_email)
            for i in inquiries_list
        )
        print("  ✓ Verified Inquiry in Super Admin Queue")

        # Provision Tenant Workspace
        provision_res = await client.post("/super-admin/companies", headers=super_headers, json={
            "name": f"Starlight Dynamics {run_id.upper()}",
            "domain": tenant_domain,
            "admin_name": "Elena Vance",
            "admin_email": founder_email,
            "plan": "Enterprise"
        })
        assert provision_res.status_code == 201, f"Provisioning failed: {provision_res.text}"
        provision_data = provision_res.json()
        temp_password = provision_data.get("temporaryPassword") or provision_data.get("temporary_password")
        company_id = provision_data["company"]["id"]
        company_name = provision_data["company"].get("name")
        print(f"  ✓ Tenant Provisioned: {company_name} (ID: {company_id})")
        print(f"  ✓ One-Time Temporary Password Generated: {temp_password}")

        # -------------------------------------------------------------------------
        # STAGE 3: Founder First Login & Forced Password Reset
        # -------------------------------------------------------------------------
        print("\n[STAGE 3] Founder First Login & Zero-Trust Hard Password Reset...")
        founder_login = await client.post("/auth/login", json={
            "email": founder_email,
            "password": temp_password
        })
        assert founder_login.status_code == 200
        founder_data = founder_login.json()
        assert founder_data["must_reset_password"] is True, "Security guard failure: must_reset_password must be True"
        founder_temp_token = founder_data["access_token"]
        print("  ✓ Security Guard Intercept: Founder flagged for mandatory 1st-login reset")

        # Execute Permanent Password Reset
        reset_res = await client.post("/auth/change-password", headers={"Authorization": f"Bearer {founder_temp_token}"}, json={
            "old_password": temp_password,
            "new_password": "StarlightFounder#2026"
        })
        assert reset_res.status_code == 200, f"Password reset failed: {reset_res.text}"
        print("  ✓ Permanent Password Activated: StarlightFounder#2026")

        # Re-authenticate with permanent password
        permanent_login = await client.post("/auth/login", json={
            "email": founder_email,
            "password": "StarlightFounder#2026"
        })
        assert permanent_login.status_code == 200
        assert permanent_login.json()["must_reset_password"] is False
        founder_auth_token = permanent_login.json()["access_token"]
        founder_headers = {"Authorization": f"Bearer {founder_auth_token}"}
        print("  ✓ Full Workspace Unlocked & Command Center Session Initialized")

        # -------------------------------------------------------------------------
        # STAGE 4: Onboard Employee & Configure Statutory Payroll
        # -------------------------------------------------------------------------
        print(f"\n[STAGE 4] Staff Directory Onboarding for {emp_email}...")
        emp_res = await client.post("/auth/register", headers=founder_headers, json={
            "employee_id": emp_code,
            "first_name": "Marcus",
            "last_name": "Brody",
            "email": emp_email,
            "password": "EmployeePass#2026",
            "department": "Engineering",
            "designation": "Staff Infrastructure Architect",
            "phone": "+1 555-0999",
            "wage": 150000.0,
            "role": "EMPLOYEE"
        })
        assert emp_res.status_code == 201, f"Employee registration failed: {emp_res.text}"
        emp_data = emp_res.json()
        marcus_emp_id = emp_data["employee_id"]
        print(f"  ✓ Employee Onboarded: Marcus Brody (ID: {marcus_emp_id})")

        # Verify salary breakdown against Indian statutory rules
        payroll_res = await client.get(f"/payroll/{marcus_emp_id}", headers=founder_headers)
        assert payroll_res.status_code == 200
        payroll_data = payroll_res.json()
        earnings = payroll_data["earnings"]
        deductions = payroll_data["deductions"]
        assert earnings["basic"] == 75000.0, f"Basic mismatch: {earnings['basic']}"
        assert earnings["hra"] == 37500.0, f"HRA mismatch: {earnings['hra']}"
        assert deductions["pf"] == 9000.0, f"PF mismatch: {deductions['pf']}"
        assert deductions["professional_tax"] == 200.0, f"PT mismatch: {deductions['professional_tax']}"
        assert payroll_data["net_salary"] == 140800.0, f"Net salary mismatch: {payroll_data['net_salary']}"
        print("  ✓ Statutory CTC Formula Verified: Base=₹1,50,000 | Basic=₹75,000 | HRA=₹37,500 | PF=₹9,000 | PT=₹200 | Net=₹1,40,800")

        # -------------------------------------------------------------------------
        # STAGE 5: Biometric Attendance Tracking
        # -------------------------------------------------------------------------
        print(f"\n[STAGE 5] Biometrics & Attendance Tracking for {emp_email}...")
        emp_login = await client.post("/auth/login", json={
            "email": emp_email,
            "password": "EmployeePass#2026"
        })
        assert emp_login.status_code == 200
        emp_token = emp_login.json()["access_token"]
        emp_headers = {"Authorization": f"Bearer {emp_token}"}

        # Punch In
        punch_in_res = await client.post("/attendance/check-in", headers=emp_headers)
        assert punch_in_res.status_code == 200
        print(f"  ✓ Clock-In Registered: {punch_in_res.json()['check_in']} (Status: PRESENT)")

        # Punch Out
        punch_out_res = await client.post("/attendance/check-out", headers=emp_headers)
        assert punch_out_res.status_code == 200
        print(f"  ✓ Clock-Out Registered: {punch_out_res.json()['check_out']}")

        # -------------------------------------------------------------------------
        # STAGE 6: Leave Governance & Real-Time Kanban Board
        # -------------------------------------------------------------------------
        print("\n[STAGE 6] Leave Application & Real-Time Kanban Approval...")
        leave_res = await client.post("/leaves", headers=emp_headers, json={
            "leave_type": "PAID",
            "start_date": "2026-09-01",
            "end_date": "2026-09-04",
            "reason": "Attending Kubernetes Summit 2026."
        })
        assert leave_res.status_code == 201
        leave_id = leave_res.json()["id"]
        print(f"  ✓ Leave Request Submitted: 4 Days PAID (Status: {leave_res.json()['status']})")

        # Admin Reviews & Approves Leave
        approve_res = await client.patch(f"/leaves/{leave_id}/approve", headers=founder_headers, json={
            "hr_comments": "Approved. Travel budget sanctioned."
        })
        assert approve_res.status_code == 200
        assert approve_res.json()["status"] == "APPROVED"
        print(f"  ✓ Kanban Action: Approved leave {leave_id} with manager notes")

        # -------------------------------------------------------------------------
        # STAGE 7: Executive Intelligence & Analytics Dashboard
        # -------------------------------------------------------------------------
        print("\n[STAGE 7] Executive Analytics & Telemetry Pulse...")
        analytics_res = await client.get("/analytics/dashboard", headers=founder_headers)
        assert analytics_res.status_code == 200
        analytics_data = analytics_res.json()
        metrics = analytics_data["metrics"]
        print(f"  ✓ Executive KPI Telemetry: Total Staff={metrics['total_employees']} | Presence Rate={metrics['attendance_rate']}% | Monthly Burn=₹{metrics['monthly_payroll_total']:,.2f}")

        print("\n" + "=" * 80)
        print("🏆 ALL 7 STAGES OF THE SAAS HRMS LIFECYCLE PASSED WITH 100% SUCCESS!")
        print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_e2e_verification())
