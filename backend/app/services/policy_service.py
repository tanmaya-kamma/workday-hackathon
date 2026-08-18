from datetime import date, datetime, time, timezone
from typing import Optional

from app.core.database import policies_collection


class PolicyService:
    """
    Handles retrieval of effective leave policies from MongoDB.

    This service does NOT calculate leave.
    It only determines which policy applies.
    """

    @staticmethod
    def _to_datetime(value: date | datetime) -> datetime:
        """
        Convert date/datetime into timezone-aware UTC datetime.
        """

        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)

            return value.astimezone(timezone.utc)

        return datetime.combine(
            value,
            time.min,
            tzinfo=timezone.utc
        )

    @staticmethod
    def get_policy(
        leave_type: str,
        as_of_date: date
    ) -> Optional[dict]:
        """
        Find the policy applicable to the given leave type
        on the specified date.
        """

        leave_type = leave_type.upper()

        as_of_datetime = PolicyService._to_datetime(
            as_of_date
        )

        query = {
            "leave_type": leave_type,
            "effective_from": {
                "$lte": as_of_datetime
            },
            "$or": [
                {
                    "effective_to": None
                },
                {
                    "effective_to": {
                        "$gte": as_of_datetime
                    }
                }
            ]
        }

        return policies_collection.find_one(
            query,
            sort=[
                ("effective_from", -1)
            ]
        )

    @staticmethod
    def get_all_policies() -> list[dict]:
        """
        Return all configured policies.
        """

        return list(
            policies_collection.find({})
        )