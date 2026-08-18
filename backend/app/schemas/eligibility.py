from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class EligibilityRequest(BaseModel):
    """
    Request body for leave eligibility check.
    """

    employee_id: str = Field(
        ...,
        min_length=1,
        description="Employee ID such as HR001"
    )

    leave_type: str = Field(
        ...,
        min_length=1,
        description="Leave type such as VACATION, SICK or PERSONAL"
    )

    requested_days: float = Field(
        default=0.0,
        ge=0,
        description="Number of leave days requested"
    )

    as_of_date: Optional[date] = Field(
        default=None,
        description="Date on which eligibility is evaluated"
    )


class EligibilityResponse(BaseModel):
    """
    Eligibility decision returned by the API.
    """

    eligible: bool

    employee_id: str

    leave_type: str

    usable_balance: float

    requested_days: float

    reason: str