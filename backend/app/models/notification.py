"""
Notification model — plain Pydantic model for validation/serialization.

Direct collection access is done via `get_db().notifications`.
"""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class NotificationInDB(BaseModel):
    """
    Represents a notification document as stored in MongoDB.
    """
    user_id: str
    title: str
    message: str
    type: str
    is_read: bool = False
    reference_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_doc(self) -> dict:
        """Convert to a dict suitable for MongoDB insertion."""
        return self.model_dump()

    @classmethod
    def from_doc(cls, doc: dict) -> "NotificationInDB":
        """Create a NotificationInDB from a MongoDB document."""
        return cls(**{k: v for k, v in doc.items() if k != "_id"})
