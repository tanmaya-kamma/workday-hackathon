from fastapi import APIRouter, HTTPException

from app.schemas.scenario import SimulationRequest
from app.services.scenario_service import ScenarioService


router = APIRouter(
    prefix="/api/scenarios",
    tags=["Scenarios"],
)


@router.post("/{employee_id}/simulate")
def simulate_leave(employee_id: str, request: SimulationRequest):
    for leave in request.hypothetical_leaves:
        if leave.end_date < leave.start_date:
            raise HTTPException(
                status_code=422,
                detail=f"end_date ({leave.end_date}) cannot be before start_date ({leave.start_date})",
            )

    try:
        result = ScenarioService.simulate_balance(
            employee_id=employee_id,
            hypothetical_leaves=request.hypothetical_leaves,
        )
        return {"success": True, "data": result}

    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {str(exc)}",
        )
