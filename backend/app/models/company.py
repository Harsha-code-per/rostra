import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    domain = Column(String(255), nullable=True)
    plan = Column(String(50), default="Growth", nullable=False)
    status = Column(String(50), default="ACTIVE", nullable=False)
    max_employees = Column(Integer, nullable=True)  # None = unlimited
    currency = Column(String(10), default="INR", nullable=False)
    owner_id = Column(String(36), ForeignKey("profiles.id", ondelete="SET NULL", name="fk_company_owner", use_alter=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    owner = relationship("Profile", foreign_keys=[owner_id], post_update=True)
    profiles = relationship("Profile", foreign_keys="[Profile.company_id]", back_populates="company", cascade="all, delete-orphan")
    employees = relationship("Employee", foreign_keys="[Employee.company_id]", back_populates="company", cascade="all, delete-orphan")
    leave_types = relationship("LeaveType", foreign_keys="[LeaveType.company_id]", back_populates="company", cascade="all, delete-orphan")
