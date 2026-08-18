"""
Policies router — leave policy information.

Prefix: /api/v1/policies

Provides read-only access to leave type definitions and rules.
"""

from fastapi import APIRouter

from app.schemas.policy import LeavePolicyResponse, LeaveTypeInfo
from app.services.policy_service import get_leave_policies

router = APIRouter(prefix="/api/v1/policies", tags=["Leave Policies"])


@router.get("/leave-types", response_model=LeaveTypeInfo)
async def list_leave_types():
    """
    Get all available leave types and their policy rules.

    This is a public endpoint (no auth required) so the frontend
    can populate leave type dropdowns before login.
    """
    policies = get_leave_policies()
    return LeaveTypeInfo(
        leave_types=[LeavePolicyResponse(**p) for p in policies]
    )
