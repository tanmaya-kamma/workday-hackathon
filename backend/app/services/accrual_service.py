from calendar import isleap
from datetime import date, datetime
from typing import Optional

from bson import ObjectId

from app.core.database import (
    users_collection,
    leave_requests_collection,
    leave_balances_collection,
)

from app.services.policy_service import PolicyService
from app.services.calendar_service import CalendarService


class AccrualService:
    """
    Dynamic PTO and Leave Accrual Engine.

    Responsibilities:
    - Employee lookup
    - Tenure calculation
    - Policy evaluation
    - Entitlement calculation
    - Monthly / annual accrual
    - First-year proration
    - Regional calendar integration
    - Approved leave usage
    - Pending leave calculation
    - Balance calculation
    - Persisting calculated balances
    """

    # =========================================================
    # USER LOOKUP
    # =========================================================

    @staticmethod
    def get_employee(employee_id: str) -> Optional[dict]:
        """
        Find an employee using the human-readable employee ID.

        Example:
            HR001
        """

        return users_collection.find_one({
            "employee_id": employee_id
        })

    # =========================================================
    # DATE HELPERS
    # =========================================================

    @staticmethod
    def to_date(value) -> date:
        """
        Convert MongoDB datetime/date/string into Python date.
        """

        if isinstance(value, datetime):
            return value.date()

        if isinstance(value, date):
            return value

        if isinstance(value, str):
            return datetime.fromisoformat(
                value.replace("Z", "+00:00")
            ).date()

        raise ValueError(
            f"Unsupported date value: {value}"
        )

    @staticmethod
    def days_in_year(year: int) -> int:
        """
        Return the number of days in a year.
        """

        return 366 if isleap(year) else 365

    # =========================================================
    # TENURE
    # =========================================================

    @staticmethod
    def calculate_tenure_years(
        joining_date: date,
        as_of_date: date
    ) -> float:
        """
        Calculate employee tenure in years.

        Returns a decimal value so that policies can
        evaluate tenure accurately.
        """

        if as_of_date < joining_date:
            return 0.0

        years = as_of_date.year - joining_date.year

        anniversary = joining_date.replace(
            year=as_of_date.year
        )

        if as_of_date < anniversary:
            years -= 1

        previous_anniversary = joining_date.replace(
            year=joining_date.year + years
        )

        days_since_anniversary = (
            as_of_date - previous_anniversary
        ).days

        return years + (
            days_since_anniversary / 365.25
        )

    # =========================================================
    # ENTITLEMENT
    # =========================================================

    @staticmethod
    def determine_entitlement(
        tenure_years: float,
        policy: dict
    ) -> float:
        """
        Determine annual leave entitlement based on
        the employee's tenure and policy rules.

        Example:

            0-1 years  -> 12
            1-3 years  -> 18
            3-5 years  -> 24
            5+ years   -> 30
        """

        rules = policy.get(
            "tenure_rules",
            []
        )

        # Policy without tenure rules
        if not rules:

            entitlement = policy.get(
                "annual_entitlement"
            )

            if entitlement is None:
                raise ValueError(
                    "Policy does not contain annual entitlement."
                )

            return float(entitlement)

        for rule in rules:

            min_years = float(
                rule.get(
                    "min_years",
                    0
                )
            )

            max_years = rule.get(
                "max_years"
            )

            if tenure_years < min_years:
                continue

            # No upper limit
            if max_years is None:

                return float(
                    rule["annual_entitlement"]
                )

            if tenure_years < float(max_years):

                return float(
                    rule["annual_entitlement"]
                )

        raise ValueError(
            f"No entitlement rule found for "
            f"{tenure_years} years of tenure."
        )

    # =========================================================
    # ROUNDING
    # =========================================================

    @staticmethod
    def round_leave(
        value: float,
        policy: dict
    ) -> float:
        """
        Round leave according to policy.

        Default:
            nearest 0.5 day
        """

        rounding = policy.get(
            "rounding",
            {}
        )

        unit = float(
            rounding.get(
                "unit",
                0.5
            )
        )

        if unit <= 0:
            return round(
                value,
                4
            )

        return round(
            value / unit
        ) * unit

    # =========================================================
    # FIRST YEAR PRORATION
    # =========================================================

    @staticmethod
    def calculate_first_year_proration(
        annual_entitlement: float,
        joining_date: date
    ) -> float:
        """
        Calculate first-year prorated entitlement
        based on remaining days in the joining year.
        """

        year = joining_date.year

        total_days = AccrualService.days_in_year(
            year
        )

        last_day = date(
            year,
            12,
            31
        )

        eligible_days = (
            last_day - joining_date
        ).days + 1

        return (
            annual_entitlement
            * eligible_days
            / total_days
        )

    # =========================================================
    # MONTHLY ACCRUAL
    # =========================================================

    @staticmethod
    def completed_months_in_year(
        joining_date: date,
        as_of_date: date
    ) -> int:
        """
        Calculate the number of monthly accrual periods
        applicable in the current year.

        For an employee who joined during the current year,
        accrual starts from the joining month.

        Example:

            Joined: March
            As of: August

            Accrual periods = March, April, May, June,
                              July, August = 6
        """

        if as_of_date < joining_date:
            return 0

        if joining_date.year == as_of_date.year:

            first_accrual_month = joining_date.month

            return max(
                0,
                as_of_date.month
                - first_accrual_month
                + 1
            )

        return as_of_date.month

    @staticmethod
    def calculate_monthly_accrual(
        annual_entitlement: float,
        joining_date: date,
        as_of_date: date
    ) -> float:
        """
        Calculate monthly accrued leave.
        """

        monthly_rate = (
            annual_entitlement / 12
        )

        months = (
            AccrualService.completed_months_in_year(
                joining_date,
                as_of_date
            )
        )

        return monthly_rate * months

    # =========================================================
    # ANNUAL ACCRUAL
    # =========================================================

    @staticmethod
    def calculate_annual_accrual(
        annual_entitlement: float,
        joining_date: date,
        as_of_date: date
    ) -> float:
        """
        Calculate annual/front-loaded accrual.

        Employees active before the current year receive
        full entitlement.

        Employees who joined during the current year
        receive prorated entitlement.
        """

        if joining_date.year == as_of_date.year:

            return AccrualService.calculate_first_year_proration(
                annual_entitlement,
                joining_date
            )

        return annual_entitlement

    # =========================================================
    # ACCRUED LEAVE
    # =========================================================

    @staticmethod
    def calculate_accrued(
        employee: dict,
        policy: dict,
        as_of_date: date
    ) -> float:
        """
        Calculate earned leave as of a given date.
        """

        joining_date = AccrualService.to_date(
            employee["date_of_joining"]
        )

        if as_of_date < joining_date:
            return 0.0

        tenure = (
            AccrualService.calculate_tenure_years(
                joining_date,
                as_of_date
            )
        )

        annual_entitlement = (
            AccrualService.determine_entitlement(
                tenure,
                policy
            )
        )

        accrual = policy.get(
            "accrual",
            {}
        )

        frequency = accrual.get(
            "frequency",
            "MONTHLY"
        ).upper()

        proration = policy.get(
            "proration",
            {}
        )

        proration_enabled = proration.get(
            "enabled",
            False
        )

        # -----------------------------------------------------
        # MONTHLY ACCRUAL
        # -----------------------------------------------------

        if frequency == "MONTHLY":

            # First-year daily proration
            if (
                proration_enabled
                and joining_date.year == as_of_date.year
                and proration.get("method") == "DAILY"
            ):

                prorated_entitlement = (
                    AccrualService.calculate_first_year_proration(
                        annual_entitlement,
                        joining_date
                    )
                )

                elapsed_days = (
                    as_of_date - joining_date
                ).days + 1

                total_eligible_days = (
                    date(
                        as_of_date.year,
                        12,
                        31
                    ) - joining_date
                ).days + 1

                if total_eligible_days <= 0:
                    return 0.0

                earned = (
                    prorated_entitlement
                    * elapsed_days
                    / total_eligible_days
                )

                return AccrualService.round_leave(
                    earned,
                    policy
                )

            # Standard monthly accrual
            earned = (
                AccrualService.calculate_monthly_accrual(
                    annual_entitlement,
                    joining_date,
                    as_of_date
                )
            )

            return AccrualService.round_leave(
                earned,
                policy
            )

        # -----------------------------------------------------
        # ANNUAL ACCRUAL
        # -----------------------------------------------------

        if frequency == "ANNUAL":

            earned = (
                AccrualService.calculate_annual_accrual(
                    annual_entitlement,
                    joining_date,
                    as_of_date
                )
            )

            return AccrualService.round_leave(
                earned,
                policy
            )

        raise ValueError(
            f"Unsupported accrual frequency: {frequency}"
        )

    # =========================================================
    # LEAVE REQUEST DAYS
    # =========================================================

    @staticmethod
    def calculate_request_days(
        region: str,
        start_date,
        end_date,
        basis: str = "WORKING_DAYS"
    ) -> int:
        """
        Calculate the number of leave days charged
        against the employee's balance.

        Regional holidays and weekends are excluded
        when using WORKING_DAYS.
        """

        start = AccrualService.to_date(
            start_date
        )

        end = AccrualService.to_date(
            end_date
        )

        return CalendarService.count_leave_days(
            region=region,
            start_date=start,
            end_date=end,
            basis=basis
        )

    # =========================================================
    # APPROVED LEAVE USAGE
    # =========================================================

    @staticmethod
    def calculate_leave_usage(
        user_id: ObjectId,
        leave_type: str,
        year: int,
        as_of_date: date,
        region: str,
        day_count_basis: str = "WORKING_DAYS"
    ) -> float:
        """
        Calculate approved leave usage up to as_of_date.

        Regional weekends and holidays are excluded when
        the policy uses WORKING_DAYS.
        """

        leave_type = leave_type.lower()

        query = {
            "employee_id": user_id,
            "leave_type": leave_type,
            "status": "approved"
        }

        requests = leave_requests_collection.find(
            query
        )

        total_used = 0.0

        for request in requests:

            start = AccrualService.to_date(
                request["start_date"]
            )

            end = AccrualService.to_date(
                request["end_date"]
            )

            # Request is completely outside the year
            if end.year < year:
                continue

            if start.year > year:
                continue

            # Leave has not happened yet
            if start > as_of_date:
                continue

            effective_start = max(
                start,
                date(year, 1, 1)
            )

            effective_end = min(
                end,
                as_of_date
            )

            if effective_end < effective_start:
                continue

            used_days = (
                AccrualService.calculate_request_days(
                    region=region,
                    start_date=effective_start,
                    end_date=effective_end,
                    basis=day_count_basis
                )
            )

            total_used += used_days

        return float(total_used)

    # =========================================================
    # PENDING LEAVE USAGE
    # =========================================================

    @staticmethod
    def calculate_pending_usage(
        user_id: ObjectId,
        leave_type: str,
        year: int,
        as_of_date: date,
        region: str,
        day_count_basis: str = "WORKING_DAYS"
    ) -> float:
        """
        Calculate pending leave that acts as a reservation.

        Pending leave reduces usable balance but is not
        deducted from accrued balance until approved.
        """

        leave_type = leave_type.lower()

        query = {
            "employee_id": user_id,
            "leave_type": leave_type,
            "status": "pending"
        }

        requests = leave_requests_collection.find(
            query
        )

        total_pending = 0.0

        for request in requests:

            start = AccrualService.to_date(
                request["start_date"]
            )

            end = AccrualService.to_date(
                request["end_date"]
            )

            if end.year < year:
                continue

            if start.year > year:
                continue

            effective_start = max(
                start,
                date(year, 1, 1)
            )

            effective_end = end

            if effective_end < effective_start:
                continue

            pending_days = (
                AccrualService.calculate_request_days(
                    region=region,
                    start_date=effective_start,
                    end_date=effective_end,
                    basis=day_count_basis
                )
            )

            total_pending += pending_days

        return float(total_pending)

    # =========================================================
    # BALANCE CALCULATION
    # =========================================================

    @staticmethod
    def calculate_balance(
        accrued: float,
        carry_forward: float,
        used: float,
        adjustments: float,
        expired: float,
        pending: float,
        policy: dict
    ) -> dict:
        """
        Calculate remaining and usable leave.

        Formula:

            Remaining =
                Accrued
                + Carry Forward
                + Adjustments
                - Used
                - Expired

            Usable =
                Remaining - Pending
        """

        balance_config = policy.get(
            "balance",
            {}
        )

        maximum = balance_config.get(
            "maximum"
        )

        available = (
            accrued
            + carry_forward
            + adjustments
            - used
            - expired
        )

        # Negative balances disabled by default
        if not balance_config.get(
            "allow_negative",
            False
        ):
            available = max(
                available,
                0.0
            )

        # Maximum balance cap
        if maximum is not None:

            available = min(
                available,
                float(maximum)
            )

        usable = max(
            available - pending,
            0.0
        )

        return {
            "remaining": round(
                available,
                2
            ),
            "usable": round(
                usable,
                2
            )
        }

    # =========================================================
    # SINGLE LEAVE TYPE
    # =========================================================

    @staticmethod
    def calculate_leave_type(
        employee: dict,
        leave_type: str,
        as_of_date: date
    ) -> dict:
        """
        Calculate complete balance for one leave type.
        """

        policy = PolicyService.get_policy(
            leave_type,
            as_of_date
        )

        if policy is None:
            raise ValueError(
                f"No policy found for {leave_type}"
            )

        # Policy determines whether leave is counted
        # using working days or calendar days.
        day_count_basis = policy.get(
            "day_count_basis",
            "WORKING_DAYS"
        ).upper()

        user_id = employee["_id"]

        joining_date = AccrualService.to_date(
            employee["date_of_joining"]
        )

        tenure = (
            AccrualService.calculate_tenure_years(
                joining_date,
                as_of_date
            )
        )

        annual_entitlement = (
            AccrualService.determine_entitlement(
                tenure,
                policy
            )
        )

        accrued = (
            AccrualService.calculate_accrued(
                employee,
                policy,
                as_of_date
            )
        )

        # -----------------------------------------------------
        # APPROVED USAGE
        # -----------------------------------------------------

        used = (
            AccrualService.calculate_leave_usage(
                user_id=user_id,
                leave_type=leave_type,
                year=as_of_date.year,
                as_of_date=as_of_date,
                region=employee["region"],
                day_count_basis=day_count_basis
            )
        )

        # -----------------------------------------------------
        # PENDING USAGE
        # -----------------------------------------------------

        pending = (
            AccrualService.calculate_pending_usage(
                user_id=user_id,
                leave_type=leave_type,
                year=as_of_date.year,
                as_of_date=as_of_date,
                region=employee["region"],
                day_count_basis=day_count_basis
            )
        )

        # -----------------------------------------------------
        # MVP VALUES
        # -----------------------------------------------------

        # Carry-forward, adjustments and expiry will be
        # implemented in the next MVP phase.
        carry_forward = 0.0
        adjustments = 0.0
        expired = 0.0

        # -----------------------------------------------------
        # FINAL BALANCE
        # -----------------------------------------------------

        balance = (
            AccrualService.calculate_balance(
                accrued=accrued,
                carry_forward=carry_forward,
                used=used,
                adjustments=adjustments,
                expired=expired,
                pending=pending,
                policy=policy
            )
        )

        return {
            "annual_entitlement": annual_entitlement,
            "accrued": accrued,
            "carry_forward": carry_forward,
            "used": used,
            "pending": pending,
            "adjustments": adjustments,
            "expired": expired,
            "remaining": balance["remaining"],
            "usable": balance["usable"]
        }

    # =========================================================
    # COMPLETE EMPLOYEE BALANCE
    # =========================================================

    @staticmethod
    def calculate_employee_balance(
        employee_id: str,
        as_of_date: Optional[date] = None
    ) -> dict:
        """
        Calculate all configured leave balances
        for an employee.
        """

        if as_of_date is None:
            as_of_date = date.today()

        employee = (
            AccrualService.get_employee(
                employee_id
            )
        )

        if employee is None:
            raise ValueError(
                f"Employee {employee_id} not found."
            )

        if not employee.get(
            "is_active",
            True
        ):
            raise ValueError(
                f"Employee {employee_id} is inactive."
            )

        leave_types = [
            "VACATION",
            "SICK",
            "PERSONAL"
        ]

        balances = {}

        for leave_type in leave_types:

            balances[
                leave_type.lower()
            ] = (
                AccrualService.calculate_leave_type(
                    employee=employee,
                    leave_type=leave_type,
                    as_of_date=as_of_date
                )
            )

        return {
            "employee_id": employee["employee_id"],
            "user_id": str(employee["_id"]),
            "full_name": employee.get(
                "full_name"
            ),
            "region": employee.get(
                "region"
            ),
            "as_of_date": as_of_date.isoformat(),
            "balances": balances
        }

    # =========================================================
    # PERSIST BALANCE
    # =========================================================

    @staticmethod
    def save_balance(
        employee: dict,
        calculation: dict,
        year: int
    ):
        """
        Save calculated balances into leave_balances.

        Existing schema is preserved while adding
        dynamic accrual information.
        """

        user_id = employee["_id"]

        balances = calculation["balances"]

        formatted_balances = {}

        for leave_type, data in balances.items():

            formatted_balances[leave_type] = {
                "total": data["annual_entitlement"],
                "accrued": data["accrued"],
                "carry_forward": data["carry_forward"],
                "used": data["used"],
                "pending": data["pending"],
                "adjustments": data["adjustments"],
                "expired": data["expired"],
                "remaining": data["remaining"],
                "usable": data["usable"]
            }

        leave_balances_collection.update_one(
            {
                "user_id": user_id,
                "year": year
            },
            {
                "$set": {
                    "balances": formatted_balances,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )

        return formatted_balances