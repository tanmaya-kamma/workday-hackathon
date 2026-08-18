"""
LeaveRequest model — plain Pydantic model for validation/serialization.

Direct collection access is done via `get_db().leave_requests`.
"""

from datetime import date, datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class LeaveRequestInDB(BaseModel):
    """
    Represents a leave request document as stored in MongoDB.
    """
    employee_id: str
    employee_name: str
    leave_type: str
    category: str = "planned"
    start_date: date
    end_date: date
    total_days: int
    reason: str
    status: str = "pending"
    manager_id: str
    manager_remarks: Optional[str] = None
    applied_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_doc(self) -> dict:
        """Convert to a dict suitable for MongoDB insertion."""
        data = self.model_dump()
        # Convert date objects to datetime for MongoDB compatibility.
        data["start_date"] = datetime.combine(self.start_date, datetime.min.time())
        data["end_date"] = datetime.combine(self.end_date, datetime.min.time())
        return data

    @classmethod
    def from_doc(cls, doc: dict) -> "LeaveRequestInDB":
        """Create a LeaveRequestInDB from a MongoDB document."""
        # Convert datetime back to date if needed.
        if isinstance(doc.get("start_date"), datetime):
            doc["start_date"] = doc["start_date"].date()
        if isinstance(doc.get("end_date"), datetime):
            doc["end_date"] = doc["end_date"].date()
        return cls(**{k: v for k, v in doc.items() if k != "_id"})
