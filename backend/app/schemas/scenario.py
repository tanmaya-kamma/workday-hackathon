from datetime import date
from typing import List

from pydantic import BaseModel, field_validator


class HypotheticalLeave(BaseModel):
    leave_type: str
    start_date: date
    end_date: date

    @field_validator("leave_type")
    @classmethod
    def validate_leave_type(cls, v):
        allowed = {
            "annual", "vacation", "sick",
            "casual", "personal",
        }
        if v.lower() not in allowed:
            raise ValueError(
                f"leave_type must be one of: {', '.join(sorted(allowed))}"
            )
        return v.lower()


class SimulationRequest(BaseModel):
    hypothetical_leaves: List[HypotheticalLeave]
