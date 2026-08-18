from datetime import date
from unittest.mock import patch

from app.services.eligibility_service import (
    EligibilityService
)


AS_OF_DATE = date(2026, 8, 18)


# ---------------------------------------------------------
# EMPLOYEE
# ---------------------------------------------------------

def test_employee_exists():

    result = EligibilityService.get_employee(
        "HR001"
    )

    assert result is not None
    assert result["employee_id"] == "HR001"


# ---------------------------------------------------------
# ACTIVE EMPLOYEE
# ---------------------------------------------------------

def test_active_employee_is_eligible():

    result = EligibilityService.check_eligibility(
        employee_id="HR001",
        leave_type="VACATION",
        as_of_date=AS_OF_DATE
    )

    assert result["eligible"] is True
    assert result["employee_id"] == "HR001"
    assert result["leave_type"] == "VACATION"


# ---------------------------------------------------------
# UNKNOWN EMPLOYEE
# ---------------------------------------------------------

def test_unknown_employee_is_not_eligible():

    result = EligibilityService.check_eligibility(
        employee_id="UNKNOWN999",
        leave_type="VACATION",
        as_of_date=AS_OF_DATE
    )

    assert result["eligible"] is False

    assert (
        "not found"
        in result["reason"].lower()
    )


# ---------------------------------------------------------
# INACTIVE EMPLOYEE
# ---------------------------------------------------------

def test_inactive_employee_is_not_eligible():

    fake_employee = {
        "_id": "fake-id",
        "employee_id": "INACTIVE01",
        "is_active": False
    }

    with patch(
        "app.services.eligibility_service.EligibilityService.get_employee",
        return_value=fake_employee
    ):

        result = (
            EligibilityService.check_eligibility(
                employee_id="INACTIVE01",
                leave_type="VACATION",
                as_of_date=AS_OF_DATE
            )
        )

    assert result["eligible"] is False

    assert (
        "inactive"
        in result["reason"].lower()
    )


# ---------------------------------------------------------
# POLICY
# ---------------------------------------------------------

def test_invalid_leave_type_is_not_eligible():

    result = EligibilityService.check_eligibility(
        employee_id="HR001",
        leave_type="INVALID_LEAVE",
        as_of_date=AS_OF_DATE
    )

    assert result["eligible"] is False

    assert (
        "policy"
        in result["reason"].lower()
    )


# ---------------------------------------------------------
# VACATION
# ---------------------------------------------------------

def test_vacation_eligibility():

    result = EligibilityService.check_eligibility(
        employee_id="HR001",
        leave_type="VACATION",
        as_of_date=AS_OF_DATE
    )

    assert result["eligible"] is True
    assert result["usable_balance"] >= 0


# ---------------------------------------------------------
# SICK
# ---------------------------------------------------------

def test_sick_eligibility():

    result = EligibilityService.check_eligibility(
        employee_id="HR001",
        leave_type="SICK",
        as_of_date=AS_OF_DATE
    )

    assert result["eligible"] is True
    assert result["leave_type"] == "SICK"


# ---------------------------------------------------------
# PERSONAL
# ---------------------------------------------------------

def test_personal_eligibility():

    result = EligibilityService.check_eligibility(
        employee_id="HR001",
        leave_type="PERSONAL",
        as_of_date=AS_OF_DATE
    )

    assert result["eligible"] is True
    assert result["leave_type"] == "PERSONAL"


# ---------------------------------------------------------
# SUFFICIENT BALANCE
# ---------------------------------------------------------

def test_requested_days_within_balance():

    fake_balance = {
        "annual_entitlement": 30,
        "accrued": 30,
        "carry_forward": 0,
        "used": 0,
        "pending": 0,
        "adjustments": 0,
        "expired": 0,
        "remaining": 30,
        "usable": 30
    }

    with patch(
        "app.services.eligibility_service.AccrualService.calculate_leave_type",
        return_value=fake_balance
    ):

        result = (
            EligibilityService.check_eligibility(
                employee_id="HR001",
                leave_type="VACATION",
                as_of_date=AS_OF_DATE,
                requested_days=5
            )
        )

    assert result["eligible"] is True
    assert result["usable_balance"] == 30
    assert result["requested_days"] == 5


# ---------------------------------------------------------
# INSUFFICIENT BALANCE
# ---------------------------------------------------------

def test_requested_days_exceed_balance():

    fake_balance = {
        "annual_entitlement": 30,
        "accrued": 10,
        "carry_forward": 0,
        "used": 8,
        "pending": 0,
        "adjustments": 0,
        "expired": 0,
        "remaining": 2,
        "usable": 2
    }

    with patch(
        "app.services.eligibility_service.AccrualService.calculate_leave_type",
        return_value=fake_balance
    ):

        result = (
            EligibilityService.check_eligibility(
                employee_id="HR001",
                leave_type="VACATION",
                as_of_date=AS_OF_DATE,
                requested_days=5
            )
        )

    assert result["eligible"] is False
    assert result["usable_balance"] == 2

    assert (
        "insufficient"
        in result["reason"].lower()
    )


# ---------------------------------------------------------
# NEGATIVE DAYS
# ---------------------------------------------------------

def test_negative_requested_days_are_rejected():

    result = EligibilityService.check_eligibility(
        employee_id="HR001",
        leave_type="VACATION",
        as_of_date=AS_OF_DATE,
        requested_days=-2
    )

    assert result["eligible"] is False

    assert (
        "negative"
        in result["reason"].lower()
    )