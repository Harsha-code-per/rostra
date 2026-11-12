from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime


class NotificationCreate(BaseModel):
    user_id: str
    type: str
    title: str
    message: str
