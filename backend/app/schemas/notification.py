"""
Notification schemas — response models for notification endpoints.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    """Single notification returned by the API."""
    id: str
    title: str
    message: str
    type: str
    is_read: bool
    reference_id: Optional[str] = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    """List of notifications with unread count."""
    items: list[NotificationResponse]
    total: int
    unread_count: int
