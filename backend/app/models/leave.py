import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, Date, DateTime, Integer, Boolean, ForeignKey, Enum as SAEnum, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.database import Base


class LeaveTypeEnum(str, enum.Enum):
    PAID = "PAID"
    SICK = "SICK"
    CASUAL = "CASUAL"
    UNPAID = "UNPAID"


class LeaveStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class LeaveType(Base):
    __tablename__ = "leave_types"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_company_leave_type_name"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(SAEnum(LeaveTypeEnum, native_enum=False), nullable=False)
    is_paid = Column(Boolean, default=True, nullable=False)
    default_allocation = Column(Integer, default=12, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    company = relationship("Company", back_populates="leave_types")
    requests = relationship("LeaveRequest", back_populates="leave_type")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    __table_args__ = (
        Index("ix_leave_requests_company_status", "company_id", "status"),
        Index("ix_leave_requests_dates", "start_date", "end_date"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id = Column(String(36), ForeignKey("leave_types.id", ondelete="RESTRICT"), nullable=False, index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Integer, default=1, nullable=False)
    reason = Column(Text, nullable=False)
    attachment_url = Column(Text, nullable=True)
    status = Column(SAEnum(LeaveStatus, native_enum=False), default=LeaveStatus.PENDING, nullable=False, index=True)
    hr_comments = Column(Text, nullable=True)
    reviewed_by = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    employee = relationship("Employee", back_populates="leave_requests", foreign_keys=[employee_id])
    leave_type = relationship("LeaveType", back_populates="requests")
    reviewer = relationship("Profile", foreign_keys=[reviewed_by])

