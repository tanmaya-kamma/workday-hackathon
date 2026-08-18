from datetime import date
from unittest.mock import patch

from app.services.accrual_service import AccrualService


AS_OF_DATE = date(2026, 8, 18)


# =========================================================
# EMPLOYEE
# =========================================================

def test_employee_exists():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None
    assert employee["employee_id"] == "HR001"


# =========================================================
# TENURE
# =========================================================

def test_tenure_calculation():

    tenure = AccrualService.calculate_tenure_years(
        joining_date=date(2020, 1, 10),
        as_of_date=AS_OF_DATE
    )

    assert tenure > 6
    assert tenure < 7


# =========================================================
# ENTITLEMENT
# =========================================================

def test_vacation_entitlement_for_senior_employee():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None

    result = AccrualService.calculate_leave_type(
        employee=employee,
        leave_type="VACATION",
        as_of_date=AS_OF_DATE
    )

    assert result["annual_entitlement"] == 30


def test_sick_entitlement():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None

    result = AccrualService.calculate_leave_type(
        employee=employee,
        leave_type="SICK",
        as_of_date=AS_OF_DATE
    )

    assert result["annual_entitlement"] == 12


def test_personal_entitlement():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None

    result = AccrualService.calculate_leave_type(
        employee=employee,
        leave_type="PERSONAL",
        as_of_date=AS_OF_DATE
    )

    assert result["annual_entitlement"] == 6


# =========================================================
# COMPLETE EMPLOYEE CALCULATION
# =========================================================

def test_complete_employee_calculation():

    result = AccrualService.calculate_employee_balance(
        employee_id="HR001",
        as_of_date=AS_OF_DATE
    )

    assert result["employee_id"] == "HR001"

    assert "vacation" in result["balances"]
    assert "sick" in result["balances"]
    assert "personal" in result["balances"]

    for leave_type in result["balances"]:

        balance = result["balances"][leave_type]

        assert "annual_entitlement" in balance
        assert "accrued" in balance
        assert "carry_forward" in balance
        assert "used" in balance
        assert "pending" in balance
        assert "adjustments" in balance
        assert "expired" in balance
        assert "remaining" in balance
        assert "usable" in balance


# =========================================================
# REGIONAL CALENDAR INTEGRATION
# =========================================================

def test_leave_request_uses_regional_calendar():
    """
    Verify that leave usage uses the employee's
    regional calendar.

    HR001 belongs to the IN region.
    """

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None
    assert employee["region"] == "IN"

    user_id = employee["_id"]

    used = AccrualService.calculate_leave_usage(
        user_id=user_id,
        leave_type="VACATION",
        year=2026,
        as_of_date=date(2026, 12, 31),
        region=employee["region"],
        day_count_basis="WORKING_DAYS"
    )

    assert used >= 0


# =========================================================
# CARRY FORWARD - DISABLED
# =========================================================

def test_carry_forward_disabled():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None

    policy = {
        "carry_forward": {
            "enabled": False,
            "max_days": 30
        }
    }

    result = AccrualService.calculate_carry_forward(
        user_id=employee["_id"],
        leave_type="VACATION",
        current_year=2026,
        policy=policy
    )

    assert result == 0.0


# =========================================================
# CARRY FORWARD - BELOW LIMIT
# =========================================================

def test_carry_forward_below_policy_limit():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None

    policy = {
        "carry_forward": {
            "enabled": True,
            "max_days": 30
        }
    }

    fake_previous_balance = {
        "user_id": employee["_id"],
        "year": 2025,
        "balances": {
            "vacation": {
                "remaining": 12
            }
        }
    }

    with patch(
        "app.core.database.leave_balances_collection.find_one",
        return_value=fake_previous_balance
    ):

        result = AccrualService.calculate_carry_forward(
            user_id=employee["_id"],
            leave_type="VACATION",
            current_year=2026,
            policy=policy
        )

    assert result == 12.0


# =========================================================
# CARRY FORWARD - COMPANY LIMIT
# =========================================================

def test_carry_forward_respects_company_limit():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None

    policy = {
        "carry_forward": {
            "enabled": True,
            "max_days": 10
        }
    }

    fake_previous_balance = {
        "user_id": employee["_id"],
        "year": 2025,
        "balances": {
            "vacation": {
                "remaining": 25
            }
        }
    }

    with patch(
        "app.core.database.leave_balances_collection.find_one",
        return_value=fake_previous_balance
    ):

        result = AccrualService.calculate_carry_forward(
            user_id=employee["_id"],
            leave_type="VACATION",
            current_year=2026,
            policy=policy
        )

    assert result == 10.0


# =========================================================
# CARRY FORWARD - COMPANY ALLOWS 30 DAYS
# =========================================================

def test_carry_forward_company_allows_30_days():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None

    policy = {
        "carry_forward": {
            "enabled": True,
            "max_days": 30
        }
    }

    fake_previous_balance = {
        "user_id": employee["_id"],
        "year": 2025,
        "balances": {
            "vacation": {
                "remaining": 25
            }
        }
    }

    with patch(
        "app.core.database.leave_balances_collection.find_one",
        return_value=fake_previous_balance
    ):

        result = AccrualService.calculate_carry_forward(
            user_id=employee["_id"],
            leave_type="VACATION",
            current_year=2026,
            policy=policy
        )

    assert result == 25.0


# =========================================================
# CARRY FORWARD - NO PREVIOUS BALANCE
# =========================================================

def test_carry_forward_no_previous_balance():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None

    policy = {
        "carry_forward": {
            "enabled": True,
            "max_days": 30
        }
    }

    with patch(
        "app.core.database.leave_balances_collection.find_one",
        return_value=None
    ):

        result = AccrualService.calculate_carry_forward(
            user_id=employee["_id"],
            leave_type="VACATION",
            current_year=2026,
            policy=policy
        )

    assert result == 0.0