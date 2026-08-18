"""
Policy schemas — leave policy configuration.

Stub for now. Will be expanded when the LLM-based categorization
engine is integrated.
"""

from pydantic import BaseModel


class LeavePolicyResponse(BaseModel):
    """Leave policy rules for a leave type."""
    leave_type: str
    max_days_per_year: int
    requires_approval: bool
    min_notice_days: int
    description: str


class LeaveTypeInfo(BaseModel):
    """Summary info about available leave types."""
    leave_types: list[LeavePolicyResponse]
