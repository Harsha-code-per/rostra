import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text
from app.database import Base


class Inquiry(Base):
    __tablename__ = "inquiries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=False)
    work_email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    team_size = Column(String(50), default="25-50", nullable=False)
    plan_interest = Column(String(50), default="Growth", nullable=False)
    message = Column(Text, nullable=True)
    status = Column(String(50), default="NEW", nullable=False, index=True)  # NEW, CONTACTED, PROVISIONED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
