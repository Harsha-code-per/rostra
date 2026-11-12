import uuid
from datetime import datetime, date, timezone
import enum
from sqlalchemy import Column, String, Date, DateTime, JSON, ForeignKey, Enum as SAEnum, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.database import Base


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ON_LEAVE = "ON_LEAVE"
    TERMINATED = "TERMINATED"


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("company_id", "employee_id", name="uq_company_employee_id"),
        Index("ix_employees_company_department", "company_id", "department"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    employee_id = Column(String(50), nullable=False, index=True)  # e.g. EMP-001 (unique per company)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    department = Column(String(100), nullable=False, index=True)
    designation = Column(String(100), nullable=False)
    manager_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    joining_date = Column(Date, default=date.today, nullable=False)
    status = Column(SAEnum(EmployeeStatus, native_enum=False), default=EmployeeStatus.ACTIVE, nullable=False, index=True)
    avatar_url = Column(Text, nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact = Column(JSON, default=dict, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    company = relationship("Company", back_populates="employees")
    profile = relationship("Profile", back_populates="employee")
    manager = relationship("Employee", remote_side=[id], backref="direct_reports")
    attendance_records = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan", order_by="desc(Attendance.work_date)")
    leave_requests = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan", foreign_keys="[LeaveRequest.employee_id]")
    salary_structure = relationship("SalaryStructure", back_populates="employee", uselist=False, cascade="all, delete-orphan")

