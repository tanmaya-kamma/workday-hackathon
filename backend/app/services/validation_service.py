from datetime import date
from typing import Optional

from app.services.calendar_service import CalendarService
from app.services.eligibility_service import EligibilityService


class ValidationService:
    """
    Leave Validation Engine.

    Responsible for validating a complete leave request
    before it reaches the approval workflow.

    Validation flow:

        1. Validate input dates
        2. Check employee/leave eligibility
        3. Load applicable leave policy
        4. Calculate leave days using regional calendar
        5. Validate weekends and holidays
        6. Return final validation decision

    This service intentionally does NOT access MongoDB directly.
    Database access remains inside the existing service layer.
    """

    # =========================================================
    # DATE NORMALIZATION
    # =========================================================

    @staticmethod
    def to_date(value) -> date:
        """
        Convert supported date values into Python date objects.
        """

        return CalendarService.to_date(value)

    # =========================================================
    # VALIDATE DATE RANGE
    # =========================================================

    @staticmethod
    def validate_date_range(
        start_date: date,
        end_date: date
    ) -> dict:
        """
        Validate that the requested date range is valid.
        """

        start_date = ValidationService.to_date(start_date)
        end_date = ValidationService.to_date(end_date)

        if end_date < start_date:
            return {
                "valid": False,
                "reason": "End date cannot be before start date."
            }

        return {
            "valid": True,
            "reason": "Date range is valid."
        }

    # =========================================================
    # GET POLICY
    # =========================================================

    @staticmethod
    def get_policy(
        leave_type: str,
        as_of_date: date
    ) -> Optional[dict]:
        """
        Retrieve the active policy for the requested leave type.
        """

        return EligibilityService.get_policy(
            leave_type=leave_type,
            as_of_date=as_of_date
        )

    # =========================================================
    # CALCULATE REQUESTED DAYS
    # =========================================================

    @staticmethod
    def calculate_requested_days(
        region: str,
        start_date: date,
        end_date: date,
        policy: dict
    ) -> int:
        """
        Calculate leave days according to the policy's
        configured day-count basis.

        Supported:
            WORKING_DAYS
            CALENDAR_DAYS
        """

        basis = policy.get(
            "day_count_basis",
            "WORKING_DAYS"
        ).upper()

        return CalendarService.count_leave_days(
            region=region,
            start_date=start_date,
            end_date=end_date,
            basis=basis
        )

    # =========================================================
    # GET NON-WORKING DAYS
    # =========================================================

    @staticmethod
    def get_non_working_days(
        region: str,
        start_date: date,
        end_date: date
    ) -> list[dict]:
        """
        Return weekends and holidays occurring inside
        the requested date range.

        This information is useful for the UI and audit trail.
        """

        start_date = ValidationService.to_date(start_date)
        end_date = ValidationService.to_date(end_date)

        non_working_days = []

        current_date = start_date

        while current_date <= end_date:

            is_weekend = CalendarService.is_weekend(
                region=region,
                target_date=current_date
            )

            holiday = CalendarService.get_holiday(
                region=region,
                target_date=current_date
            )

            if is_weekend or holiday is not None:

                if holiday is not None:
                    reason = "HOLIDAY"
                    name = holiday.get(
                        "name",
                        "Regional holiday"
                    )
                else:
                    reason = "WEEKEND"
                    name = "Regional weekend"

                non_working_days.append(
                    {
                        "date": current_date.isoformat(),
                        "reason": reason,
                        "name": name
                    }
                )

            current_date = (
                current_date.fromordinal(
                    current_date.toordinal() + 1
                )
            )

        return non_working_days

    # =========================================================
    # MAIN VALIDATION
    # =========================================================

    @staticmethod
    def validate_leave_request(
        employee_id: str,
        leave_type: str,
        start_date: date,
        end_date: date,
        as_of_date: Optional[date] = None
    ) -> dict:
        """
        Perform complete leave-request validation.

        Returns a structured decision containing:

            valid
            employee_id
            leave_type
            start_date
            end_date
            requested_days
            usable_balance
            non_working_days
            reason
        """

        # -----------------------------------------------------
        # DEFAULT AS-OF DATE
        # -----------------------------------------------------

        if as_of_date is None:
            as_of_date = date.today()

        as_of_date = ValidationService.to_date(
            as_of_date
        )

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

        start_date = ValidationService.to_date(
            start_date
        )

        end_date = ValidationService.to_date(
            end_date
        )

        # -----------------------------------------------------
        # BASIC INPUT VALIDATION
        # -----------------------------------------------------

        if not employee_id:
            return {
                "valid": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "requested_days": 0,
                "usable_balance": 0.0,
                "non_working_days": [],
                "reason": "Employee ID is required."
            }

        if not leave_type:
            return {
                "valid": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "requested_days": 0,
                "usable_balance": 0.0,
                "non_working_days": [],
                "reason": "Leave type is required."
            }

        # -----------------------------------------------------
        # DATE RANGE VALIDATION
        # -----------------------------------------------------

        date_result = ValidationService.validate_date_range(
            start_date=start_date,
            end_date=end_date
        )

        if not date_result["valid"]:
            return {
                "valid": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "requested_days": 0,
                "usable_balance": 0.0,
                "non_working_days": [],
                "reason": date_result["reason"]
            }

        # -----------------------------------------------------
        # ELIGIBILITY ENGINE
        # -----------------------------------------------------

        eligibility = EligibilityService.check_eligibility(
            employee_id=employee_id,
            leave_type=leave_type,
            as_of_date=as_of_date,
            requested_days=0
        )

        if not eligibility.get("eligible", False):
            return {
                "valid": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "requested_days": 0,
                "usable_balance": float(
                    eligibility.get(
                        "usable_balance",
                        0.0
                    )
                ),
                "non_working_days": [],
                "reason": eligibility.get(
                    "reason",
                    "Employee is not eligible."
                )
            }

        # -----------------------------------------------------
        # GET EMPLOYEE
        # -----------------------------------------------------

        employee = EligibilityService.get_employee(
            employee_id
        )

        if employee is None:
            return {
                "valid": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "requested_days": 0,
                "usable_balance": 0.0,
                "non_working_days": [],
                "reason": f"Employee {employee_id} not found."
            }

        region = employee.get(
            "region",
            "IN"
        )

        # -----------------------------------------------------
        # POLICY
        # -----------------------------------------------------

        policy = ValidationService.get_policy(
            leave_type=leave_type,
            as_of_date=as_of_date
        )

        if policy is None:
            return {
                "valid": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "requested_days": 0,
                "usable_balance": 0.0,
                "non_working_days": [],
                "reason": (
                    f"No active policy found for {leave_type}."
                )
            }

        # -----------------------------------------------------
        # CALENDAR VALIDATION
        # -----------------------------------------------------

        try:

            requested_days = (
                ValidationService.calculate_requested_days(
                    region=region,
                    start_date=start_date,
                    end_date=end_date,
                    policy=policy
                )
            )

        except ValueError as exc:

            return {
                "valid": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "requested_days": 0,
                "usable_balance": float(
                    eligibility.get(
                        "usable_balance",
                        0.0
                    )
                ),
                "non_working_days": [],
                "reason": str(exc)
            }

        non_working_days = (
            ValidationService.get_non_working_days(
                region=region,
                start_date=start_date,
                end_date=end_date
            )
        )

        # -----------------------------------------------------
        # ZERO WORKING DAYS
        # -----------------------------------------------------

        if requested_days <= 0:

            return {
                "valid": False,
                "employee_id": employee_id,
                "leave_type": leave_type,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "requested_days": requested_days,
                "usable_balance": float(
                    eligibility.get(
                        "usable_balance",
                        0.0
                    )
                ),
                "non_working_days": non_working_days,
                "reason": (
                    "The selected date range contains "
                    "no chargeable leave days."
                )
            }

        # -----------------------------------------------------
        # BALANCE VALIDATION → UNPAID SPILL-OVER
        # -----------------------------------------------------
        #
        # Requests that exceed the usable balance are NOT
        # blocked. The excess days are classified as unpaid
        # leave: the employee is warned at submission and
        # approvers see the paid/unpaid split on the request.

        usable_balance = float(
            eligibility.get(
                "usable_balance",
                0.0
            )
        )

        if leave_type.strip().lower() == "unpaid":

            paid_days = 0.0

            unpaid_days = float(requested_days)

        else:

            paid_days = min(
                float(requested_days),
                max(usable_balance, 0.0)
            )

            unpaid_days = float(requested_days) - paid_days

        # -----------------------------------------------------
        # FINAL DECISION
        # -----------------------------------------------------

        return {
            "valid": True,
            "employee_id": employee_id,
            "leave_type": leave_type,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "requested_days": requested_days,
            "paid_days": paid_days,
            "unpaid_days": unpaid_days,
            "usable_balance": usable_balance,
            "region": region,
            "day_count_basis": policy.get(
                "day_count_basis",
                "WORKING_DAYS"
            ).upper(),
            "non_working_days": non_working_days,
            "reason": "Leave request passed validation."
        }