"""
Leaves router — employee and manager leave management endpoints.

Prefix: /api/v1/leaves
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.core.dependencies import get_current_user, require_role
from app.schemas.leave import LeaveCreate, LeaveReview, LeaveResponse, LeaveListResponse
from app.services import leave_service

router = APIRouter(prefix="/api/v1/leaves", tags=["Leave Management"])


# ---------------------------------------------------------------------------
# Employee endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=LeaveResponse, status_code=201)
async def submit_leave(
    data: LeaveCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit a new leave request.

    The request is routed to the employee's assigned manager.
    Leave balance is validated before submission.
    """
    return await leave_service.submit_leave(data, current_user)


@router.get("/my", response_model=LeaveListResponse)
async def get_my_leaves(
    status: Optional[str] = Query(
        default=None,
        description="Filter by status: pending, approved, rejected, cancelled",
    ),
    current_user: dict = Depends(get_current_user),
):
    """Get all leave requests submitted by the current user."""
    return await leave_service.get_my_leaves(current_user, status_filter=status)


# ---------------------------------------------------------------------------
# Manager endpoints
# ---------------------------------------------------------------------------

@router.get("/team", response_model=LeaveListResponse)
@router.get("/team/pending", response_model=LeaveListResponse)
async def get_team_leaves(
    status: Optional[str] = Query(
        default=None,
        description="Filter by status: pending, approved, rejected, cancelled",
    ),
    manager: dict = Depends(require_role("manager", "hr", "admin")),
):
    """
    Get all leave requests assigned to the current manager.

    Only accessible by users with 'manager', 'hr', or 'admin' role.
    """
    return await leave_service.get_team_leaves(manager, status_filter=status)


@router.get("/{leave_id}", response_model=LeaveResponse)
async def get_leave(
    leave_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single leave request by ID."""
    return await leave_service.get_leave_by_id(leave_id, current_user)


@router.delete("/{leave_id}", response_model=LeaveResponse)
@router.post("/{leave_id}/cancel", response_model=LeaveResponse)
async def cancel_leave(
    leave_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Cancel a pending leave request.

    Only the employee who submitted the request can cancel it,
    and only while the status is 'pending'.
    """
    return await leave_service.cancel_leave(leave_id, current_user)


@router.patch("/{leave_id}/approve", response_model=LeaveResponse)
async def approve_leave(
    leave_id: str,
    data: LeaveReview = None,
    manager: dict = Depends(require_role("manager", "hr", "admin")),
):
    """
    Approve a pending leave request.

    Deducts the leave days from the employee's balance and
    sends a notification to the employee.
    """
    remarks = data.remarks if data else None
    return await leave_service.approve_leave(leave_id, manager, remarks)


@router.patch("/{leave_id}/reject", response_model=LeaveResponse)
async def reject_leave(
    leave_id: str,
    data: LeaveReview = None,
    manager: dict = Depends(require_role("manager", "hr", "admin")),
):
    """
    Reject a pending leave request.

    Sends a notification to the employee with optional remarks.
    """
    remarks = data.remarks if data else None
    return await leave_service.reject_leave(leave_id, manager, remarks)
