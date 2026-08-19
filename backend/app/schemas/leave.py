"""
Leave request schemas — request and response models for leave endpoints.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class LeaveCreate(BaseModel):
    """POST /leaves/ request body — employee submits a leave request."""
    leave_type: str = Field(
        ...,
        pattern="^(annual|vacation|sick|casual|personal|unpaid)$",
        examples=["annual"],
        description="Type of leave: annual, vacation, sick, casual, personal, or unpaid.",
    )
    start_date: date = Field(..., examples=["2026-09-01"])
    end_date: date = Field(..., examples=["2026-09-03"])
    reason: str = Field(
        ...,
        min_length=3,
        max_length=500,
        examples=["Family vacation planned in advance."],
    )


class LeaveReview(BaseModel):
    """PUT /leaves/{id}/approve or /reject — manager review."""
    remarks: Optional[str] = Field(
        default=None,
        max_length=500,
        examples=["Approved. Enjoy your time off."],
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class LeaveResponse(BaseModel):
    """Single leave request returned by the API."""
    id: str
    employee_id: str
    employee_name: str
    leave_type: str
    category: str
    start_date: date
    end_date: date
    total_days: int
    paid_days: Optional[float] = None
    unpaid_days: float = 0
    reason: str
    status: str
    approval_stage: Optional[str] = None
    manager_id: str
    manager_remarks: Optional[str] = None
    applied_at: datetime
    reviewed_at: Optional[datetime] = None


class LeaveListResponse(BaseModel):
    """Paginated list of leave requests."""
    items: list[LeaveResponse]
    total: int
