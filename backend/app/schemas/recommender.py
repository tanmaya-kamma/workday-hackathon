"""
Recommender schemas — request/response contracts for the AI recommender
agent and the reschedule request workflow.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Conflict analysis
# ---------------------------------------------------------------------------

class ConflictAnalyzeRequest(BaseModel):
    """Manager asks the agent to resolve an overlap between leave requests."""

    leave_request_ids: List[str] = Field(
        ...,
        min_length=2,
        description="IDs of the overlapping pending leave requests.",
    )
    num_to_reschedule: int = Field(
        ...,
        ge=1,
        description="How many of these employees must be rescheduled.",
    )
    manager_note: Optional[str] = Field(
        default=None,
        description="Optional context from the manager (e.g. 'release week').",
    )


class BehaviorProfile(BaseModel):
    """Deterministic behavioural stats computed from leave history."""

    total_requests: int
    approved_requests: int
    holiday_adjacent_ratio: float
    preferred_months: List[str]
    preferred_leave_type: Optional[str] = None
    average_duration_days: float
    remaining_balance: dict
    past_reschedule_acceptances: int = 0


class Recommendation(BaseModel):
    """One reschedule suggestion produced by the agent."""

    leave_request_id: str
    employee_id: str
    employee_name: str
    leave_type: str
    original_start_date: str
    original_end_date: str
    suggested_start_date: str
    suggested_end_date: str
    reason: str
    insights: List[str] = []
    holiday_context: Optional[str] = None
    confidence: str = "medium"  # low | medium | high


class ConflictAnalyzeResponse(BaseModel):
    conflict_summary: str
    overlap_start: Optional[str] = None
    overlap_end: Optional[str] = None
    recommendations: List[Recommendation]
    profiles: dict = {}
    ai_generated: bool
    model_used: str


# ---------------------------------------------------------------------------
# Reschedule requests (manager -> employee)
# ---------------------------------------------------------------------------

class RescheduleCreate(BaseModel):
    leave_request_id: str
    proposed_start_date: str = Field(..., description="YYYY-MM-DD")
    proposed_end_date: str = Field(..., description="YYYY-MM-DD")
    reason: str = Field(..., min_length=1, max_length=1000)


class RescheduleRespond(BaseModel):
    action: str = Field(..., pattern="^(accept|reject)$")
    message: Optional[str] = Field(default=None, max_length=1000)


class RescheduleResponse(BaseModel):
    id: str
    leave_request_id: str
    employee_id: str
    employee_name: Optional[str] = None
    manager_id: str
    manager_name: Optional[str] = None
    leave_type: Optional[str] = None
    original_start_date: str
    original_end_date: str
    proposed_start_date: str
    proposed_end_date: str
    reason: str
    status: str  # pending | accepted | rejected | cancelled
    employee_message: Optional[str] = None
    created_at: datetime
    responded_at: Optional[datetime] = None


class RescheduleListResponse(BaseModel):
    items: List[RescheduleResponse]
    total: int
