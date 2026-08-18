from fastapi import APIRouter, HTTPException

from app.schemas.eligibility import (
    EligibilityRequest,
    EligibilityResponse
)

from app.services.eligibility_service import (
    EligibilityService
)


router = APIRouter(
    prefix="/api/eligibility",
    tags=["Eligibility"]
)


@router.post(
    "/check",
    response_model=EligibilityResponse
)
def check_eligibility(
    request: EligibilityRequest
):
    """
    Check whether an employee is eligible
    for a particular leave type.
    """

    try:

        result = EligibilityService.check_eligibility(
            employee_id=request.employee_id,
            leave_type=request.leave_type,
            as_of_date=request.as_of_date,
            requested_days=request.requested_days
        )

        return result

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc)
        )