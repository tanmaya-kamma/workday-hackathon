from datetime import date
from typing import Optional

from app.services.accrual_service import AccrualService
from app.services.policy_service import PolicyService


class EligibilityService:
    """
    Leave Eligibility Engine.

    Determines whether an employee is eligible
    to request a particular leave type.

    Responsibilities:
    - Employee existence check
    - Employee active-status check
    - Leave policy existence check
    - Current usable balance check
    - Return clear eligibility decision

    Complex leave-day validation, holidays, weekends,
    and manager approval are handled by other modules.
    """

    # ---------------------------------------------------------
    # EMPLOYEE LOOKUP
    # ---------------------------------------------------------

    @staticmethod
    def get_employee(employee_id: str) -> Optional[dict]:
        """
        Find an employee using the human-readable employee_id.
        """

        return AccrualService.get_employee(
            employee_id
        )

    # ---------------------------------------------------------
    # POLICY LOOKUP
    # ---------------------------------------------------------

    @staticmethod
    def get_policy(
        leave_type: str,
        as_of_date: date
    ) -> Optional[dict]:
        """
        Find the active policy for a leave type.
        """

        return PolicyService.get_policy(
            leave_type,
            as_of_date
        )

    # ---------------------------------------------------------
    # MAIN ELIGIBILITY CHECK
    # ---------------------------------------------------------

    @staticmethod
    def check_eligibility(
        employee_id: str,
        leave_type: str,
        as_of_date: Optional[date] = None,
        requested_days: float = 0.0
    ) -> dict:
        """
        Determine whether an employee is eligible
        to request a leave type.

        Parameters:
            employee_id:
                Human-readable employee ID such as HR001.

            leave_type:
                VACATION, SICK or PERSONAL.

            as_of_date:
                Date used for balance/policy calculation.

            requested_days:
                Optional number of leave days requested.

                If 0, only general eligibility is checked.
                If greater than 0, usable balance is compared
                against the requested number of days.

        Returns:
            A structured eligibility result.
        """

        # -----------------------------------------------------
        # DEFAULT DATE
        # -----------------------------------------------------

        if as_of_date is None:
            as_of_date = date.today()

        # -----------------------------------------------------
        # NORMALIZE INPUT
        # -----------------------------------------------------

        employee_id = (
            employee_id.strip()
            if isinstance(employee_id, str)
            else ""
        )

        leave_type = (
            leave_type.strip().upper()
            if isinstance(leave_type, str)
            else ""
        )

        # -----------------------------------------------------
        # BASIC INPUT VALIDATION
        # -----------------------------------------------------

        if not employee_id:
            return {
                "eligible": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "usable_balance": 0.0,
                "requested_days": float(requested_days),
                "reason": "Employee ID is required."
            }

        if not leave_type:
            return {
                "eligible": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "usable_balance": 0.0,
                "requested_days": float(requested_days),
                "reason": "Leave type is required."
            }

        if requested_days < 0:
            return {
                "eligible": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "usable_balance": 0.0,
                "requested_days": float(requested_days),
                "reason": "Requested leave days cannot be negative."
            }

        # -----------------------------------------------------
        # EMPLOYEE CHECK
        # -----------------------------------------------------

        employee = EligibilityService.get_employee(
            employee_id
        )

        if employee is None:
            return {
                "eligible": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "usable_balance": 0.0,
                "requested_days": float(requested_days),
                "reason": (
                    f"Employee {employee_id} not found."
                )
            }

        # -----------------------------------------------------
        # ACTIVE EMPLOYEE CHECK
        # -----------------------------------------------------

        if not employee.get("is_active", True):
            return {
                "eligible": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "usable_balance": 0.0,
                "requested_days": float(requested_days),
                "reason": "Employee is inactive."
            }

        # -----------------------------------------------------
        # POLICY CHECK
        # -----------------------------------------------------

        try:

            policy = EligibilityService.get_policy(
                leave_type,
                as_of_date
            )

        except ValueError as exc:

            return {
                "eligible": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "usable_balance": 0.0,
                "requested_days": float(requested_days),
                "reason": (
                    f"Policy validation failed: {str(exc)}"
                )
            }

        if policy is None:

            return {
                "eligible": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "usable_balance": 0.0,
                "requested_days": float(requested_days),
                "reason": (
                    f"No active policy found for "
                    f"{leave_type}."
                )
            }

        # -----------------------------------------------------
        # BALANCE CALCULATION
        # -----------------------------------------------------

        try:

            balance_result = (
                AccrualService.calculate_leave_type(
                    employee=employee,
                    leave_type=leave_type,
                    as_of_date=as_of_date
                )
            )

        except Exception as exc:

            return {
                "eligible": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "usable_balance": 0.0,
                "requested_days": float(requested_days),
                "reason": (
                    "Unable to calculate leave balance: "
                    f"{str(exc)}"
                )
            }

        usable_balance = float(
            balance_result.get(
                "usable",
                0.0
            )
        )

        # -----------------------------------------------------
        # REQUESTED DAYS CHECK
        # -----------------------------------------------------

        if requested_days > 0:

            if usable_balance < requested_days:

                return {
                    "eligible": False,
                    "employee_id": employee_id,
                    "leave_type": leave_type,
                    "usable_balance": usable_balance,
                    "requested_days": float(requested_days),
                    "reason": (
                        "Insufficient usable balance. "
                        f"Available: {usable_balance} days."
                    )
                }

        # -----------------------------------------------------
        # SUCCESS
        # -----------------------------------------------------

        return {
            "eligible": True,
            "employee_id": employee_id,
            "leave_type": leave_type,
            "usable_balance": usable_balance,
            "requested_days": float(requested_days),
            "reason": (
                "Employee is eligible for this leave type."
            )
        }