"""
User model — plain Pydantic models for validation and serialization.

These are NOT Beanie Documents. They are used for:
  - Validating data before inserting into MongoDB.
  - Serializing MongoDB documents into structured responses.

Direct collection access is done via `get_db().users`.
"""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class LeaveBalance(BaseModel):
    """Tracks remaining leave days by type."""
    annual: int = 20
    sick: int = 12
    casual: int = 6
    unpaid: int = 0


class UserInDB(BaseModel):
    """
    Represents a user document as stored in MongoDB.

    Used to construct documents for insertion and to
    parse documents returned from queries.
    """
    employee_id: str
    email: str
    full_name: str
    hashed_password: str
    role: str = "employee"
    department: str = "General"
    manager_id: Optional[str] = None
    leave_balances: LeaveBalance = Field(default_factory=LeaveBalance)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_doc(self) -> dict:
        """Convert to a dict suitable for MongoDB insertion."""
        return self.model_dump()

    @classmethod
    def from_doc(cls, doc: dict) -> "UserInDB":
        """Create a UserInDB from a MongoDB document."""
        return cls(**doc)
