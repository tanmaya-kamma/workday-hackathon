from datetime import date

from app.services.calendar_service import CalendarService


# =========================================================
# INDIA CALENDAR
# =========================================================

def test_india_calendar_exists():

    calendar = CalendarService.get_calendar(
        region="IN",
        year=2026
    )

    assert calendar is not None

    assert calendar["region"] == "IN"
    assert calendar["year"] == 2026


def test_india_calendar_has_16_holidays():

    holidays = CalendarService.get_holidays(
        region="IN",
        year=2026
    )

    assert len(holidays) == 16


def test_india_weekend_configuration():

    weekend_days = CalendarService.get_weekend_days(
        region="IN",
        year=2026
    )

    assert weekend_days == [6, 7]


# =========================================================
# HOLIDAY TESTS
# =========================================================

def test_india_holiday_detection():

    holidays = CalendarService.get_holidays(
        region="IN",
        year=2026
    )

    assert len(holidays) > 0

    first_holiday = holidays[0]

    holiday_date = CalendarService.to_date(
        first_holiday["date"]
    )

    result = CalendarService.is_holiday(
        region="IN",
        target_date=holiday_date
    )

    assert result is True


def test_india_holiday_details():

    holidays = CalendarService.get_holidays(
        region="IN",
        year=2026
    )

    assert len(holidays) > 0

    first_holiday = holidays[0]

    holiday_date = CalendarService.to_date(
        first_holiday["date"]
    )

    holiday = CalendarService.get_holiday(
        region="IN",
        target_date=holiday_date
    )

    assert holiday is not None
    assert holiday["date"] == first_holiday["date"]
    assert holiday["name"] == first_holiday["name"]


# =========================================================
# WEEKEND TESTS
# =========================================================

def test_saturday_is_weekend_in_india():

    # 2026-01-03 = Saturday

    result = CalendarService.is_weekend(
        region="IN",
        target_date=date(2026, 1, 3)
    )

    assert result is True


def test_sunday_is_weekend_in_india():

    # 2026-01-04 = Sunday

    result = CalendarService.is_weekend(
        region="IN",
        target_date=date(2026, 1, 4)
    )

    assert result is True


def test_monday_is_not_weekend_in_india():

    # 2026-01-05 = Monday

    result = CalendarService.is_weekend(
        region="IN",
        target_date=date(2026, 1, 5)
    )

    assert result is False


# =========================================================
# WORKING DAY TESTS
# =========================================================

def test_monday_is_working_day_in_india():

    # 2026-01-05 = Monday

    result = CalendarService.is_working_day(
        region="IN",
        target_date=date(2026, 1, 5)
    )

    assert result is True


def test_weekend_is_not_working_day():

    # 2026-01-03 = Saturday

    result = CalendarService.is_working_day(
        region="IN",
        target_date=date(2026, 1, 3)
    )

    assert result is False


def test_holiday_is_not_working_day():

    holidays = CalendarService.get_holidays(
        region="IN",
        year=2026
    )

    assert len(holidays) > 0

    first_holiday = holidays[0]

    holiday_date = CalendarService.to_date(
        first_holiday["date"]
    )

    result = CalendarService.is_working_day(
        region="IN",
        target_date=holiday_date
    )

    assert result is False


# =========================================================
# DAY COUNT TESTS
# =========================================================

def test_calendar_day_count():

    result = CalendarService.count_calendar_days(
        start_date=date(2026, 1, 5),
        end_date=date(2026, 1, 9)
    )

    assert result == 5


def test_calendar_day_count_includes_weekend():

    result = CalendarService.count_calendar_days(
        start_date=date(2026, 1, 9),
        end_date=date(2026, 1, 11)
    )

    # Friday + Saturday + Sunday

    assert result == 3


def test_working_day_count_excludes_weekends():

    result = CalendarService.count_working_days(
        region="IN",
        start_date=date(2026, 1, 5),
        end_date=date(2026, 1, 11)
    )

    # Monday → Sunday
    #
    # Monday-Friday = 5 working days
    # Saturday/Sunday = excluded

    assert result == 5


def test_working_day_count_for_single_weekday():

    result = CalendarService.count_working_days(
        region="IN",
        start_date=date(2026, 1, 5),
        end_date=date(2026, 1, 5)
    )

    assert result == 1


def test_working_day_count_for_weekend():

    result = CalendarService.count_working_days(
        region="IN",
        start_date=date(2026, 1, 3),
        end_date=date(2026, 1, 4)
    )

    assert result == 0


# =========================================================
# LEAVE DAY BASIS
# =========================================================

def test_leave_days_using_working_days():

    result = CalendarService.count_leave_days(
        region="IN",
        start_date=date(2026, 1, 5),
        end_date=date(2026, 1, 11),
        basis="WORKING_DAYS"
    )

    assert result == 5


def test_leave_days_using_calendar_days():

    result = CalendarService.count_leave_days(
        region="IN",
        start_date=date(2026, 1, 5),
        end_date=date(2026, 1, 11),
        basis="CALENDAR_DAYS"
    )

    assert result == 7


# =========================================================
# INVALID INPUT
# =========================================================

def test_invalid_leave_day_basis():

    try:

        CalendarService.count_leave_days(
            region="IN",
            start_date=date(2026, 1, 5),
            end_date=date(2026, 1, 5),
            basis="INVALID"
        )

        assert False, "Expected ValueError"

    except ValueError as exc:

        assert "Unsupported leave day basis" in str(exc)


def test_invalid_date_range():

    result = CalendarService.count_working_days(
        region="IN",
        start_date=date(2026, 1, 10),
        end_date=date(2026, 1, 5)
    )

    assert result == 0


# =========================================================
# OTHER REGIONS
# =========================================================

def test_uk_calendar_exists():

    calendar = CalendarService.get_calendar(
        region="UK",
        year=2026
    )

    assert calendar is not None
    assert calendar["region"] == "UK"


def test_us_calendar_exists():

    calendar = CalendarService.get_calendar(
        region="US",
        year=2026
    )

    assert calendar is not None
    assert calendar["region"] == "US"


def test_me_calendar_exists():

    calendar = CalendarService.get_calendar(
        region="ME",
        year=2026
    )

    assert calendar is not None
    assert calendar["region"] == "ME"