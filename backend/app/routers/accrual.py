from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.accrual_service import AccrualService


router = APIRouter(
    prefix="/api/accrual",
    tags=["Accrual"]
)


@router.get("/{employee_id}")
def get_employee_accrual(
    employee_id: str,
    as_of_date: Optional[date] = Query(
        default=None,
        description="Calculate balance as of this date"
    )
):
    """
    Calculate dynamic leave balances for an employee.
    """

    try:
        result = AccrualService.calculate_employee_balance(
            employee_id=employee_id,
            as_of_date=as_of_date
        )

        return {
            "success": True,
            "data": result
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Accrual calculation failed: {str(exc)}"
        )


@router.post("/{employee_id}/recalculate")
def recalculate_employee_accrual(
    employee_id: str,
    as_of_date: Optional[date] = Query(
        default=None,
        description="Date used for recalculation"
    )
):
    """
    Calculate and persist an employee's leave balances.
    """

    try:
        calculation_date = (
            as_of_date
            if as_of_date is not None
            else date.today()
        )

        result = AccrualService.calculate_employee_balance(
            employee_id=employee_id,
            as_of_date=calculation_date
        )

        employee = AccrualService.get_employee(
            employee_id
        )

        if employee is None:
            raise HTTPException(
                status_code=404,
                detail=f"Employee {employee_id} not found."
            )

        saved_balances = AccrualService.save_balance(
            employee=employee,
            calculation=result,
            year=calculation_date.year
        )

        return {
            "success": True,
            "message": "Leave balances recalculated successfully.",
            "data": result,
            "saved_balances": saved_balances
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Accrual recalculation failed: {str(exc)}"
        )