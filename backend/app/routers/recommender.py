"""
Recommender router — AI-assisted leave conflict resolution and the
manager→employee reschedule request workflow.

Prefix: /api/v1/recommender
"""

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_role
from app.schemas.recommender import (
    ConflictAnalyzeRequest,
    ConflictAnalyzeResponse,
    RescheduleCreate,
    RescheduleListResponse,
    RescheduleRespond,
    RescheduleResponse,
)
from app.services import recommender_service

router = APIRouter(prefix="/api/v1/recommender", tags=["Recommender Agent"])


# ---------------------------------------------------------------------------
# Manager endpoints
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=ConflictAnalyzeResponse)
async def analyze_conflict(
    data: ConflictAnalyzeRequest,
    manager: dict = Depends(require_role("manager", "hr", "admin")),
):
    """
    Analyse overlapping leave requests and recommend which employee(s)
    to reschedule, with suggested alternative dates and AI-generated
    reasons based on each employee's past leave behaviour.
    """
    return await recommender_service.analyze_conflict(data, manager)


@router.post("/reschedules", response_model=RescheduleResponse, status_code=201)
async def create_reschedule(
    data: RescheduleCreate,
    manager: dict = Depends(require_role("manager", "hr", "admin")),
):
    """
    Send a reschedule request to an employee for one of their leave
    requests. The employee is notified and can accept or reject it.
    """
    return await recommender_service.create_reschedule_request(data, manager)


@router.get("/reschedules/team", response_model=RescheduleListResponse)
async def get_team_reschedules(
    manager: dict = Depends(require_role("manager", "hr", "admin")),
):
    """List reschedule requests sent by the current manager."""
    return await recommender_service.get_team_reschedules(manager)


# ---------------------------------------------------------------------------
# Employee endpoints
# ---------------------------------------------------------------------------

@router.get("/reschedules/my", response_model=RescheduleListResponse)
async def get_my_reschedules(
    current_user: dict = Depends(get_current_user),
):
    """List reschedule requests addressed to the current user."""
    return await recommender_service.get_my_reschedules(current_user)


@router.post("/reschedules/{reschedule_id}/respond", response_model=RescheduleResponse)
async def respond_to_reschedule(
    reschedule_id: str,
    data: RescheduleRespond,
    current_user: dict = Depends(get_current_user),
):
    """
    Accept or reject a reschedule request, with an optional message
    to the manager. Accepting moves the leave to the proposed dates.
    """
    return await recommender_service.respond_to_reschedule(
        reschedule_id, data, current_user
    )
