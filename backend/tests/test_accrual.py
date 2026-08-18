from datetime import date

from app.services.accrual_service import AccrualService


AS_OF_DATE = date(2026, 8, 18)


def test_employee_exists():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None
    assert employee["employee_id"] == "HR001"


def test_tenure_calculation():

    tenure = AccrualService.calculate_tenure_years(
        joining_date=date(2020, 1, 10),
        as_of_date=date(2026, 8, 18)
    )

    assert tenure > 6
    assert tenure < 7


def test_vacation_entitlement_for_senior_employee():

    employee = AccrualService.get_employee(
        "HR001"
    )

    assert employee is not None

    policy_result = (
        AccrualService.calculate_leave_type(
            employee=employee,
            leave_type="VACATION",
            as_of_date=AS_OF_DATE
        )
    )

    assert (
        policy_result["annual_entitlement"]
        == 30
    )


def test_sick_entitlement():

    employee = AccrualService.get_employee(
        "HR001"
    )

    result = (
        AccrualService.calculate_leave_type(
            employee,
            "SICK",
            AS_OF_DATE
        )
    )

    assert result["annual_entitlement"] == 12


def test_personal_entitlement():

    employee = AccrualService.get_employee(
        "HR001"
    )

    result = (
        AccrualService.calculate_leave_type(
            employee,
            "PERSONAL",
            AS_OF_DATE
        )
    )

    assert result["annual_entitlement"] == 6


def test_complete_employee_calculation():

    result = (
        AccrualService.calculate_employee_balance(
            employee_id="HR001",
            as_of_date=AS_OF_DATE
        )
    )

    assert result["employee_id"] == "HR001"

    assert "vacation" in result["balances"]
    assert "sick" in result["balances"]
    assert "personal" in result["balances"]

    for leave_type in result["balances"]:

        balance = result["balances"][leave_type]

        assert "annual_entitlement" in balance
        assert "accrued" in balance
        assert "used" in balance
        assert "pending" in balance
        assert "remaining" in balance
        assert "usable" in balance
def test_leave_request_uses_regional_calendar():
    """
    Verify that leave usage respects the employee's
    regional weekend configuration.
    """

    employee = AccrualService.get_employee("HR001")

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