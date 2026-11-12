import asyncio
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select
from app.database import engine, async_session_factory, Base
from app.models.company import Company
from app.models.profile import Profile, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import LeaveType, LeaveRequest, LeaveTypeEnum, LeaveStatus
from app.models.payroll import SalaryStructure
from app.core.security import get_password_hash
from app.services.payroll_service import calculate_salary_structure

DEFAULT_COMPANY_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
DEFAULT_PASSWORD = "password123"

PERSONAS = [
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
        "employee_id": "EMP-001",
        "first_name": "Arthur",
        "last_name": "Morgan",
        "email": "admin@demo.example.com",
        "phone": "+1 555-0101",
        "department": "Management",
        "designation": "Chief Executive Officer",
        "joining_date": date(2022, 1, 15),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        "address": "100 Silicon Ave, San Francisco, CA",
        "emergency_contact": {"name": "Mary Morgan", "relationship": "Spouse", "phone": "+1 555-0102"},
        "wage": 120000.0,
        "role": UserRole.ADMIN,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
        "employee_id": "EMP-002",
        "first_name": "Sarah",
        "last_name": "Jenkins",
        "email": "sarah.hr@demo.example.com",
        "phone": "+1 555-0201",
        "department": "Human Resources",
        "designation": "HR Director",
        "joining_date": date(2022, 3, 1),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
        "address": "250 Market St, San Francisco, CA",
        "emergency_contact": {"name": "Tom Jenkins", "relationship": "Spouse", "phone": "+1 555-0202"},
        "wage": 90000.0,
        "role": UserRole.HR,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3",
        "employee_id": "EMP-003",
        "first_name": "Alex",
        "last_name": "Rivera",
        "email": "alex.rivera@demo.example.com",
        "phone": "+1 555-0301",
        "department": "Engineering",
        "designation": "Senior Full Stack Engineer",
        "joining_date": date(2023, 2, 10),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        "address": "450 Pine Street, Berkeley, CA",
        "emergency_contact": {"name": "Maria Rivera", "relationship": "Sister", "phone": "+1 555-0302"},
        "wage": 75000.0,
        "role": UserRole.EMPLOYEE,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4",
        "employee_id": "EMP-004",
        "first_name": "Elena",
        "last_name": "Rostova",
        "email": "elena.rostova@demo.example.com",
        "phone": "+1 555-0401",
        "department": "Engineering",
        "designation": "Staff Frontend Architect",
        "joining_date": date(2023, 4, 15),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
        "address": "88 Valencia St, San Francisco, CA",
        "emergency_contact": {"name": "Dmitri Rostov", "relationship": "Brother", "phone": "+1 555-0402"},
        "wage": 85000.0,
        "role": UserRole.EMPLOYEE,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5",
        "employee_id": "EMP-005",
        "first_name": "David",
        "last_name": "Chen",
        "email": "david.chen@demo.example.com",
        "phone": "+1 555-0501",
        "department": "Engineering",
        "designation": "DevOps & Cloud Lead",
        "joining_date": date(2023, 6, 1),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
        "address": "720 Haight St, San Francisco, CA",
        "emergency_contact": {"name": "Grace Chen", "relationship": "Spouse", "phone": "+1 555-0502"},
        "wage": 80000.0,
        "role": UserRole.EMPLOYEE,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6",
        "employee_id": "EMP-006",
        "first_name": "Marcus",
        "last_name": "Vance",
        "email": "marcus.vance@demo.example.com",
        "phone": "+1 555-0601",
        "department": "Product",
        "designation": "VP of Product",
        "joining_date": date(2022, 8, 1),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
        "address": "330 2nd St, San Francisco, CA",
        "emergency_contact": {"name": "Claire Vance", "relationship": "Spouse", "phone": "+1 555-0602"},
        "wage": 105000.0,
        "role": UserRole.EMPLOYEE,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7",
        "employee_id": "EMP-007",
        "first_name": "Priya",
        "last_name": "Sharma",
        "email": "priya.sharma@demo.example.com",
        "phone": "+1 555-0701",
        "department": "Product",
        "designation": "Senior Product Manager",
        "joining_date": date(2023, 1, 10),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
        "address": "512 Folsom St, San Francisco, CA",
        "emergency_contact": {"name": "Raj Sharma", "relationship": "Father", "phone": "+1 555-0702"},
        "wage": 78000.0,
        "role": UserRole.EMPLOYEE,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8",
        "employee_id": "EMP-008",
        "first_name": "Chloe",
        "last_name": "Dupont",
        "email": "chloe.dupont@demo.example.com",
        "phone": "+1 555-0801",
        "department": "Product",
        "designation": "Lead UI/UX Designer",
        "joining_date": date(2023, 3, 15),
        "status": EmployeeStatus.ON_LEAVE,
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        "address": "901 Mission St, San Francisco, CA",
        "emergency_contact": {"name": "Jean Dupont", "relationship": "Brother", "phone": "+1 555-0802"},
        "wage": 72000.0,
        "role": UserRole.EMPLOYEE,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb9",
        "employee_id": "EMP-009",
        "first_name": "Lucas",
        "last_name": "Meyer",
        "email": "lucas.meyer@demo.example.com",
        "phone": "+1 555-0901",
        "department": "Sales",
        "designation": "Head of Enterprise Sales",
        "joining_date": date(2022, 11, 1),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
        "address": "1200 Grand Ave, Oakland, CA",
        "emergency_contact": {"name": "Sophie Meyer", "relationship": "Spouse", "phone": "+1 555-0902"},
        "wage": 95000.0,
        "role": UserRole.EMPLOYEE,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10",
        "employee_id": "EMP-010",
        "first_name": "Amina",
        "last_name": "Khan",
        "email": "amina.khan@demo.example.com",
        "phone": "+1 555-1001",
        "department": "Marketing",
        "designation": "Growth Marketing Lead",
        "joining_date": date(2023, 5, 1),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
        "address": "1400 Post St, San Francisco, CA",
        "emergency_contact": {"name": "Farhan Khan", "relationship": "Brother", "phone": "+1 555-1002"},
        "wage": 50000.0,
        "role": UserRole.EMPLOYEE,
    },
    {
        "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11",
        "emp_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11",
        "employee_id": "EMP-011",
        "first_name": "Liam",
        "last_name": "Nelson",
        "email": "liam.nelson@demo.example.com",
        "phone": "+1 555-1101",
        "department": "Finance",
        "designation": "Financial Controller",
        "joining_date": date(2022, 5, 15),
        "status": EmployeeStatus.ACTIVE,
        "avatar_url": "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150",
        "address": "320 Bush St, San Francisco, CA",
        "emergency_contact": {"name": "Anna Nelson", "relationship": "Spouse", "phone": "+1 555-1102"},
        "wage": 82000.0,
        "role": UserRole.EMPLOYEE,
    },
]


async def seed_database(target_engine=None, target_session_factory=None):
    eng = target_engine or engine
    factory = target_session_factory or async_session_factory

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with factory() as session:
        # 1. Seed Default Tenant Company
        comp_stmt = select(Company).where(Company.id == DEFAULT_COMPANY_ID)
        comp_res = await session.execute(comp_stmt)
        company = comp_res.scalar_one_or_none()
        if not company:
            company = Company(
                id=DEFAULT_COMPANY_ID,
                name="Rostra Demo Co.",
                slug="rostra",
                currency="INR",
                owner_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
                is_active=True,
            )
            session.add(company)
            await session.flush()

        # 2. Seed Leave Types for default company
        leave_types = [
            ("11111111-1111-1111-1111-111111111101", LeaveTypeEnum.PAID, True, 18, "Annual paid vacation leave"),
            ("11111111-1111-1111-1111-111111111102", LeaveTypeEnum.SICK, True, 10, "Medical and sickness leave"),
            ("11111111-1111-1111-1111-111111111103", LeaveTypeEnum.CASUAL, True, 6, "Short personal time off"),
            ("11111111-1111-1111-1111-111111111104", LeaveTypeEnum.UNPAID, False, 0, "Leave without pay"),
        ]

        lt_objs = {}
        for lt_id, name, is_paid, alloc, desc in leave_types:
            stmt = select(LeaveType).where(
                LeaveType.company_id == DEFAULT_COMPANY_ID,
                LeaveType.name == name,
            )
            res = await session.execute(stmt)
            obj = res.scalar_one_or_none()
            if not obj:
                obj = LeaveType(
                    id=lt_id,
                    company_id=DEFAULT_COMPANY_ID,
                    name=name,
                    is_paid=is_paid,
                    default_allocation=alloc,
                    description=desc,
                )
                session.add(obj)
            lt_objs[name.value] = obj

        await session.flush()

        # 3. Seed Profiles and Employees
        print("👤 Seeding Profiles and Employees...")
        password_hash = get_password_hash(DEFAULT_PASSWORD)

        for p in PERSONAS:
            # Profile
            stmt = select(Profile).where(Profile.email == p["email"])
            res = await session.execute(stmt)
            profile = res.scalar_one_or_none()
            if not profile:
                profile = Profile(
                    id=p["user_id"],
                    company_id=DEFAULT_COMPANY_ID,
                    email=p["email"],
                    password_hash=password_hash,
                    role=p["role"],
                    must_reset_password=False,
                    is_active=True,
                )
                session.add(profile)
                await session.flush()

            # Employee
            emp_stmt = select(Employee).where(
                Employee.company_id == DEFAULT_COMPANY_ID,
                Employee.employee_id == p["employee_id"],
            )
            emp_res = await session.execute(emp_stmt)
            emp = emp_res.scalar_one_or_none()
            if not emp:
                emp = Employee(
                    id=p["emp_id"],
                    company_id=DEFAULT_COMPANY_ID,
                    user_id=profile.id,
                    employee_id=p["employee_id"],
                    first_name=p["first_name"],
                    last_name=p["last_name"],
                    email=p["email"],
                    phone=p["phone"],
                    department=p["department"],
                    designation=p["designation"],
                    joining_date=p["joining_date"],
                    status=p["status"],
                    avatar_url=p["avatar_url"],
                    address=p["address"],
                    emergency_contact=p["emergency_contact"],
                )
                session.add(emp)
                await session.flush()

            # Salary Structure
            sal_stmt = select(SalaryStructure).where(
                SalaryStructure.company_id == DEFAULT_COMPANY_ID,
                SalaryStructure.employee_id == emp.id,
            )
            sal_res = await session.execute(sal_stmt)
            sal = sal_res.scalar_one_or_none()
            if not sal:
                calc = calculate_salary_structure(p["wage"])
                sal = SalaryStructure(
                    company_id=DEFAULT_COMPANY_ID,
                    employee_id=emp.id,
                    effective_from=date(2026, 1, 1),
                    **calc,
                )
                session.add(sal)

        await session.flush()

        # 4. Seed Attendance Records
        print("⏰ Seeding Attendance History...")
        today = date.today()
        alex_emp_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3"
        elena_emp_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4"
        chloe_emp_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8"

        def seed_dt(d: date, hour: int, minute: int) -> datetime:
            return datetime(d.year, d.month, d.day, hour, minute, 0, tzinfo=timezone.utc)

        sample_attendances = [
            (alex_emp_id, today - timedelta(days=4), seed_dt(today - timedelta(days=4), 9, 2), seed_dt(today - timedelta(days=4), 17, 35), 8.55, AttendanceStatus.PRESENT, "Sprint kickoff"),
            (alex_emp_id, today - timedelta(days=3), seed_dt(today - timedelta(days=3), 9, 15), seed_dt(today - timedelta(days=3), 18, 0), 8.75, AttendanceStatus.PRESENT, "Backend integration"),
            (alex_emp_id, today - timedelta(days=2), seed_dt(today - timedelta(days=2), 8, 55), seed_dt(today - timedelta(days=2), 17, 30), 8.58, AttendanceStatus.PRESENT, "Feature testing"),
            (alex_emp_id, today - timedelta(days=1), seed_dt(today - timedelta(days=1), 9, 0), seed_dt(today - timedelta(days=1), 13, 15), 4.25, AttendanceStatus.HALF_DAY, "Dentist appointment"),
            (alex_emp_id, today, seed_dt(today, 9, 0), None, 0.0, AttendanceStatus.PRESENT, "Checked in for demo"),
            (elena_emp_id, today - timedelta(days=1), seed_dt(today - timedelta(days=1), 9, 10), seed_dt(today - timedelta(days=1), 17, 40), 8.50, AttendanceStatus.PRESENT, "Design review"),
            (elena_emp_id, today, seed_dt(today, 8, 45), None, 0.0, AttendanceStatus.PRESENT, "UI polish"),
            (chloe_emp_id, today, None, None, 0.0, AttendanceStatus.ON_LEAVE, "Approved Vacation"),
        ]

        for emp_id, wdate, cin, cout, thours, st, notes in sample_attendances:
            att_stmt = select(Attendance).where(
                Attendance.company_id == DEFAULT_COMPANY_ID,
                Attendance.employee_id == emp_id,
                Attendance.work_date == wdate,
            )
            att_res = await session.execute(att_stmt)
            existing_att = att_res.scalar_one_or_none()
            if not existing_att:
                att = Attendance(
                    company_id=DEFAULT_COMPANY_ID,
                    employee_id=emp_id,
                    work_date=wdate,
                    check_in=cin,
                    check_out=cout,
                    total_hours=thours,
                    status=st,
                    notes=notes,
                )
                session.add(att)
            else:
                existing_att.check_in = cin
                existing_att.check_out = cout
                existing_att.total_hours = thours
                existing_att.status = st
                existing_att.notes = notes

        # 5. Seed Leave Requests
        print("📝 Seeding Sample Leave Requests...")
        sample_leaves = [
            (alex_emp_id, lt_objs["SICK"].id, today - timedelta(days=10), today - timedelta(days=9), 2, "Flu recovery", LeaveStatus.APPROVED, "Approved by Sarah", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"),
            (chloe_emp_id, lt_objs["PAID"].id, today - timedelta(days=1), today + timedelta(days=2), 4, "Annual family vacation", LeaveStatus.APPROVED, "Have fun!", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"),
            (elena_emp_id, lt_objs["CASUAL"].id, today + timedelta(days=5), today + timedelta(days=5), 1, "Personal errand", LeaveStatus.PENDING, None, None),
        ]

        for emp_id, ltid, sdate, edate, tdays, reason, st, comments, rev_by in sample_leaves:
            l_stmt = select(LeaveRequest).where(
                LeaveRequest.company_id == DEFAULT_COMPANY_ID,
                LeaveRequest.employee_id == emp_id,
                LeaveRequest.start_date == sdate,
            )
            l_res = await session.execute(l_stmt)
            if not l_res.scalar_one_or_none():
                lr = LeaveRequest(
                    company_id=DEFAULT_COMPANY_ID,
                    employee_id=emp_id,
                    leave_type_id=ltid,
                    start_date=sdate,
                    end_date=edate,
                    total_days=tdays,
                    reason=reason,
                    status=st,
                    hr_comments=comments,
                    reviewed_by=rev_by,
                    reviewed_at=datetime.now(timezone.utc) if rev_by else None,
                )
                session.add(lr)

        # 6. Seed Platform Super Admin
        print("👑 Seeding Platform Super Admin...")
        super_admin_stmt = select(Profile).where(Profile.email == "owner@demo.example.com")
        super_admin_res = await session.execute(super_admin_stmt)
        super_admin = super_admin_res.scalar_one_or_none()
        if not super_admin:
            super_admin = Profile(
                id="00000000-0000-0000-0000-000000000001",
                company_id=None,
                email="owner@demo.example.com",
                password_hash=get_password_hash("RostraPlatform#2026"),
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                must_reset_password=False,
            )
            session.add(super_admin)
        else:
            super_admin.role = UserRole.SUPER_ADMIN
            super_admin.password_hash = get_password_hash("RostraPlatform#2026")
            super_admin.is_active = True

        await session.commit()
        print("✅ Database successfully seeded with Company, 11 demo personas, salary structures, attendance records, and Super Admin!")


if __name__ == "__main__":
    asyncio.run(seed_database())
