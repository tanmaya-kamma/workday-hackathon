from datetime import date
from unittest.mock import patch

from app.services.validation_service import ValidationService


AS_OF_DATE = date(2026, 8, 18)


def test_valid_leave_request():

    employee = {
        "_id": "test-id",
        "employee_id": "HR001",
        "region": "IN",
        "is_active": True
    }

    policy = {
        "day_count_basis": "WORKING_DAYS"
    }

    eligibility = {
        "eligible": True,
        "employee_id": "HR001",
        "leave_type": "VACATION",
        "usable_balance": 20.0,
        "requested_days": 0.0,
        "reason": "Employee is eligible for this leave type."
    }

    with patch(
        "app.services.validation_service.EligibilityService.check_eligibility",
        return_value=eligibility
    ), patch(
        "app.services.validation_service.EligibilityService.get_employee",
        return_value=employee
    ), patch(
        "app.services.validation_service.EligibilityService.get_policy",
        return_value=policy
    ), patch(
        "app.services.validation_service.CalendarService.count_leave_days",
        return_value=3
    ), patch(
        "app.services.validation_service.CalendarService.is_weekend",
        return_value=False
    ), patch(
        "app.services.validation_service.CalendarService.get_holiday",
        return_value=None
    ):

        result = ValidationService.validate_leave_request(
            employee_id="HR001",
            leave_type="VACATION",
            start_date=date(2026, 8, 19),
            end_date=date(2026, 8, 21),
            as_of_date=AS_OF_DATE
        )

    assert result["valid"] is True
    assert result["requested_days"] == 3
    assert result["usable_balance"] == 20.0


def test_end_date_before_start_date():

    result = ValidationService.validate_leave_request(
        employee_id="HR001",
        leave_type="VACATION",
        start_date=date(2026, 8, 25),
        end_date=date(2026, 8, 20),
        as_of_date=AS_OF_DATE
    )

    assert result["valid"] is False
    assert "End date cannot be before start date" in result["reason"]


def test_missing_employee_id():

    result = ValidationService.validate_leave_request(
        employee_id="",
        leave_type="VACATION",
        start_date=date(2026, 8, 19),
        end_date=date(2026, 8, 21),
        as_of_date=AS_OF_DATE
    )

    assert result["valid"] is False
    assert result["reason"] == "Employee ID is required."


def test_missing_leave_type():

    result = ValidationService.validate_leave_request(
        employee_id="HR001",
        leave_type="",
        start_date=date(2026, 8, 19),
        end_date=date(2026, 8, 21),
        as_of_date=AS_OF_DATE
    )

    assert result["valid"] is False
    assert result["reason"] == "Leave type is required."


def test_ineligible_employee():

    eligibility = {
        "eligible": False,
        "employee_id": "HR001",
        "leave_type": "VACATION",
        "usable_balance": 0.0,
        "requested_days": 0.0,
        "reason": "Employee is inactive."
    }

    with patch(
        "app.services.validation_service.EligibilityService.check_eligibility",
        return_value=eligibility
    ):

        result = ValidationService.validate_leave_request(
            employee_id="HR001",
            leave_type="VACATION",
            start_date=date(2026, 8, 19),
            end_date=date(2026, 8, 21),
            as_of_date=AS_OF_DATE
        )

    assert result["valid"] is False
    assert result["reason"] == "Employee is inactive."


def test_insufficient_balance():

    employee = {
        "_id": "test-id",
        "employee_id": "HR001",
        "region": "IN",
        "is_active": True
    }

    policy = {
        "day_count_basis": "WORKING_DAYS"
    }

    eligibility = {
        "eligible": True,
        "employee_id": "HR001",
        "leave_type": "VACATION",
        "usable_balance": 2.0,
        "requested_days": 0.0,
        "reason": "Employee is eligible for this leave type."
    }

    with patch(
        "app.services.validation_service.EligibilityService.check_eligibility",
        return_value=eligibility
    ), patch(
        "app.services.validation_service.EligibilityService.get_employee",
        return_value=employee
    ), patch(
        "app.services.validation_service.EligibilityService.get_policy",
        return_value=policy
    ), patch(
        "app.services.validation_service.CalendarService.count_leave_days",
        return_value=5
    ), patch(
        "app.services.validation_service.CalendarService.is_weekend",
        return_value=False
    ), patch(
        "app.services.validation_service.CalendarService.get_holiday",
        return_value=None
    ):

        result = ValidationService.validate_leave_request(
            employee_id="HR001",
            leave_type="VACATION",
            start_date=date(2026, 8, 19),
            end_date=date(2026, 8, 25),
            as_of_date=AS_OF_DATE
        )

    assert result["valid"] is False
    assert result["requested_days"] == 5
    assert result["usable_balance"] == 2.0
    assert "Insufficient usable balance" in result["reason"]


def test_only_weekends_is_rejected():

    employee = {
        "_id": "test-id",
        "employee_id": "HR001",
        "region": "IN",
        "is_active": True
    }

    policy = {
        "day_count_basis": "WORKING_DAYS"
    }

    eligibility = {
        "eligible": True,
        "employee_id": "HR001",
        "leave_type": "VACATION",
        "usable_balance": 20.0,
        "requested_days": 0.0,
        "reason": "Employee is eligible for this leave type."
    }

    with patch(
        "app.services.validation_service.EligibilityService.check_eligibility",
        return_value=eligibility
    ), patch(
        "app.services.validation_service.EligibilityService.get_employee",
        return_value=employee
    ), patch(
        "app.services.validation_service.EligibilityService.get_policy",
        return_value=policy
    ), patch(
        "app.services.validation_service.CalendarService.count_leave_days",
        return_value=0
    ), patch(
        "app.services.validation_service.CalendarService.is_weekend",
        return_value=True
    ), patch(
        "app.services.validation_service.CalendarService.get_holiday",
        return_value=None
    ):

        result = ValidationService.validate_leave_request(
            employee_id="HR001",
            leave_type="VACATION",
            start_date=date(2026, 8, 22),
            end_date=date(2026, 8, 23),
            as_of_date=AS_OF_DATE
        )

    assert result["valid"] is False
    assert result["requested_days"] == 0
    assert "no chargeable leave days" in result["reason"]


def test_holiday_is_reported():

    employee = {
        "_id": "test-id",
        "employee_id": "HR001",
        "region": "IN",
        "is_active": True
    }

    policy = {
        "day_count_basis": "WORKING_DAYS"
    }

    eligibility = {
        "eligible": True,
        "employee_id": "HR001",
        "leave_type": "VACATION",
        "usable_balance": 20.0,
        "requested_days": 0.0,
        "reason": "Employee is eligible for this leave type."
    }

    holiday = {
        "date": "2026-08-20",
        "name": "Test Holiday"
    }

    def mock_holiday(region, target_date):
        if target_date == date(2026, 8, 20):
            return holiday

        return None

    with patch(
        "app.services.validation_service.EligibilityService.check_eligibility",
        return_value=eligibility
    ), patch(
        "app.services.validation_service.EligibilityService.get_employee",
        return_value=employee
    ), patch(
        "app.services.validation_service.EligibilityService.get_policy",
        return_value=policy
    ), patch(
        "app.services.validation_service.CalendarService.count_leave_days",
        return_value=2
    ), patch(
        "app.services.validation_service.CalendarService.is_weekend",
        return_value=False
    ), patch(
        "app.services.validation_service.CalendarService.get_holiday",
        side_effect=mock_holiday
    ):

        result = ValidationService.validate_leave_request(
            employee_id="HR001",
            leave_type="VACATION",
            start_date=date(2026, 8, 19),
            end_date=date(2026, 8, 21),
            as_of_date=AS_OF_DATE
        )

    assert result["valid"] is True
    assert result["requested_days"] == 2
    assert len(result["non_working_days"]) == 1
    assert result["non_working_days"][0]["reason"] == "HOLIDAY"
    assert result["non_working_days"][0]["name"] == "Test Holiday"


def test_calendar_day_policy():

    employee = {
        "_id": "test-id",
        "employee_id": "HR001",
        "region": "IN",
        "is_active": True
    }

    policy = {
        "day_count_basis": "CALENDAR_DAYS"
    }

    with patch(
        "app.services.validation_service.CalendarService.count_leave_days",
        return_value=5
    ) as mocked_count:

        result = ValidationService.calculate_requested_days(
            region="IN",
            start_date=date(2026, 8, 19),
            end_date=date(2026, 8, 23),
            policy=policy
        )

    assert result == 5

    mocked_count.assert_called_once_with(
        region="IN",
        start_date=date(2026, 8, 19),
        end_date=date(2026, 8, 23),
        basis="CALENDAR_DAYS"
    )


def test_working_day_policy():

    policy = {
        "day_count_basis": "WORKING_DAYS"
    }

    with patch(
        "app.services.validation_service.CalendarService.count_leave_days",
        return_value=3
    ) as mocked_count:

        result = ValidationService.calculate_requested_days(
            region="IN",
            start_date=date(2026, 8, 19),
            end_date=date(2026, 8, 21),
            policy=policy
        )

    assert result == 3

    mocked_count.assert_called_once_with(
        region="IN",
        start_date=date(2026, 8, 19),
        end_date=date(2026, 8, 21),
        basis="WORKING_DAYS"
    )


def test_non_working_days_returns_weekend():

    with patch(
        "app.services.validation_service.CalendarService.is_weekend",
        side_effect=lambda region, target_date:
            target_date.weekday() >= 5
    ), patch(
        "app.services.validation_service.CalendarService.get_holiday",
        return_value=None
    ):

        result = ValidationService.get_non_working_days(
            region="IN",
            start_date=date(2026, 8, 21),
            end_date=date(2026, 8, 23)
        )

    assert len(result) == 2

    dates = {
        item["date"]
        for item in result
    }

    assert "2026-08-22" in dates
    assert "2026-08-23" in dates


def test_date_range_validation():

    valid_result = ValidationService.validate_date_range(
        start_date=date(2026, 8, 20),
        end_date=date(2026, 8, 25)
    )

    assert valid_result["valid"] is True

    invalid_result = ValidationService.validate_date_range(
        start_date=date(2026, 8, 25),
        end_date=date(2026, 8, 20)
    )

    assert invalid_result["valid"] is False