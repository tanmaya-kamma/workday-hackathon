from datetime import date, datetime, timedelta
from typing import Optional

from app.core.database import regional_calendars_collection


class CalendarService:
    """
    Handles regional holiday calendars.

    Calendar data is stored in MongoDB.

    Example MongoDB document:

    {
        "region": "IN",
        "year": 2026,
        "holidays": [
            {
                "date": "2026-01-26",
                "name": "Republic Day"
            }
        ],
        "weekend_days": [6, 7]
    }

    ISO weekday numbers:
        1 = Monday
        2 = Tuesday
        3 = Wednesday
        4 = Thursday
        5 = Friday
        6 = Saturday
        7 = Sunday
    """

    # =========================================================
    # DATE NORMALIZATION
    # =========================================================

    @staticmethod
    def to_date(value) -> date:
        """
        Convert supported date/datetime/string values
        into a Python date object.
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

    # =========================================================
    # GET REGIONAL CALENDAR
    # =========================================================

    @staticmethod
    def get_calendar(
        region: str,
        year: int
    ) -> Optional[dict]:
        """
        Retrieve the regional calendar for a given
        region and year.

        Example:
            region = "IN"
            year = 2026
        """

        return regional_calendars_collection.find_one(
            {
                "region": region.upper(),
                "year": year
            }
        )

    # =========================================================
    # REQUIRE REGIONAL CALENDAR
    # =========================================================

    @staticmethod
    def require_calendar(
        region: str,
        year: int
    ) -> dict:
        """
        Retrieve the regional calendar.

        Raises an error if no calendar exists.
        """

        calendar = CalendarService.get_calendar(
            region=region,
            year=year
        )

        if calendar is None:
            raise ValueError(
                f"No regional calendar configured "
                f"for region={region.upper()}, year={year}"
            )

        return calendar

    # =========================================================
    # GET HOLIDAYS
    # =========================================================

    @staticmethod
    def get_holidays(
        region: str,
        year: int
    ) -> list[dict]:
        """
        Return all holidays configured for
        a region and year.
        """

        calendar = CalendarService.get_calendar(
            region=region,
            year=year
        )

        if calendar is None:
            return []

        return calendar.get(
            "holidays",
            []
        )

    # =========================================================
    # GET WEEKEND DAYS
    # =========================================================

    @staticmethod
    def get_weekend_days(
        region: str,
        year: int
    ) -> list[int]:
        """
        Return configured weekend days.

        Example:
            [6, 7] = Saturday and Sunday

        The values come directly from MongoDB.
        """

        calendar = CalendarService.get_calendar(
            region=region,
            year=year
        )

        if calendar is None:
            return [6, 7]

        return calendar.get(
            "weekend_days",
            [6, 7]
        )

    # =========================================================
    # CHECK HOLIDAY
    # =========================================================

    @staticmethod
    def is_holiday(
        region: str,
        target_date: date
    ) -> bool:
        """
        Check whether a date is a configured
        regional holiday.
        """

        target_date = CalendarService.to_date(
            target_date
        )

        holidays = CalendarService.get_holidays(
            region=region,
            year=target_date.year
        )

        for holiday in holidays:

            holiday_date = holiday.get("date")

            if not holiday_date:
                continue

            holiday_date = CalendarService.to_date(
                holiday_date
            )

            if holiday_date == target_date:
                return True

        return False

    # =========================================================
    # GET HOLIDAY DETAILS
    # =========================================================

    @staticmethod
    def get_holiday(
        region: str,
        target_date: date
    ) -> Optional[dict]:
        """
        Return the holiday document for a specific date.

        Example:

        {
            "date": "2026-01-26",
            "name": "Republic Day"
        }
        """

        target_date = CalendarService.to_date(
            target_date
        )

        holidays = CalendarService.get_holidays(
            region=region,
            year=target_date.year
        )

        for holiday in holidays:

            holiday_date = holiday.get("date")

            if not holiday_date:
                continue

            holiday_date = CalendarService.to_date(
                holiday_date
            )

            if holiday_date == target_date:
                return holiday

        return None

    # =========================================================
    # CHECK WEEKEND
    # =========================================================

    @staticmethod
    def is_weekend(
        region: str,
        target_date: date
    ) -> bool:
        """
        Check whether a date is configured as
        a weekend for the employee's region.
        """

        target_date = CalendarService.to_date(
            target_date
        )

        iso_weekday = target_date.isoweekday()

        weekend_days = CalendarService.get_weekend_days(
            region=region,
            year=target_date.year
        )

        return iso_weekday in weekend_days

    # =========================================================
    # CHECK WORKING DAY
    # =========================================================

    @staticmethod
    def is_working_day(
        region: str,
        target_date: date
    ) -> bool:
        """
        A working day is a day that is:

        1. Not a configured weekend
        2. Not a configured regional holiday
        """

        target_date = CalendarService.to_date(
            target_date
        )

        if CalendarService.is_weekend(
            region,
            target_date
        ):
            return False

        if CalendarService.is_holiday(
            region,
            target_date
        ):
            return False

        return True

    # =========================================================
    # COUNT WORKING DAYS
    # =========================================================

    @staticmethod
    def count_working_days(
        region: str,
        start_date: date,
        end_date: date
    ) -> int:
        """
        Count working days between two dates,
        inclusive.

        Example:

            Monday → Friday = 5

        If Wednesday is a holiday:

            Monday → Friday = 4
        """

        start_date = CalendarService.to_date(
            start_date
        )

        end_date = CalendarService.to_date(
            end_date
        )

        if end_date < start_date:
            return 0

        current_date = start_date
        working_days = 0

        while current_date <= end_date:

            if CalendarService.is_working_day(
                region=region,
                target_date=current_date
            ):
                working_days += 1

            current_date += timedelta(days=1)

        return working_days

    # =========================================================
    # COUNT CALENDAR DAYS
    # =========================================================

    @staticmethod
    def count_calendar_days(
        start_date: date,
        end_date: date
    ) -> int:
        """
        Count every day between two dates,
        including weekends and holidays.
        """

        start_date = CalendarService.to_date(
            start_date
        )

        end_date = CalendarService.to_date(
            end_date
        )

        if end_date < start_date:
            return 0

        return (
            end_date - start_date
        ).days + 1

    # =========================================================
    # COUNT LEAVE DAYS
    # =========================================================

    @staticmethod
    def count_leave_days(
        region: str,
        start_date: date,
        end_date: date,
        basis: str = "WORKING_DAYS"
    ) -> int:
        """
        Calculate the number of days charged
        against an employee's leave balance.

        Supported bases:

            WORKING_DAYS
            CALENDAR_DAYS
        """

        basis = basis.upper()

        if basis == "WORKING_DAYS":

            return CalendarService.count_working_days(
                region=region,
                start_date=start_date,
                end_date=end_date
            )

        if basis == "CALENDAR_DAYS":

            return CalendarService.count_calendar_days(
                start_date=start_date,
                end_date=end_date
            )

        raise ValueError(
            f"Unsupported leave day basis: {basis}"
        )