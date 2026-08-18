"""
Policy service — dynamic policy lookup from MongoDB and leave categorization.
"""

from datetime import date, datetime, time, timezone
from typing import Optional

from app.core.database import policies_collection


_MEDICAL_KEYWORDS = [
    "sick", "doctor", "hospital", "surgery", "medical", "health",
    "fever", "flu", "covid", "injury", "treatment", "therapy",
    "dental", "clinic", "appointment",
]

_PERSONAL_KEYWORDS = [
    "family", "personal", "wedding", "funeral", "bereavement",
    "moving", "relocation", "emergency", "childcare",
]


def categorize_leave(leave_type: str, reason: str, total_days: int) -> str:
    """
    Classify a leave request as planned/unplanned/medical/personal.
    """
    reason_lower = reason.lower()

    if leave_type == "sick":
        return "medical"

    if any(keyword in reason_lower for keyword in _MEDICAL_KEYWORDS):
        return "medical"

    if any(keyword in reason_lower for keyword in _PERSONAL_KEYWORDS):
        return "personal"

    if total_days == 1 and leave_type == "casual":
        return "unplanned"

    return "planned"


class PolicyService:
    """
    Retrieves effective leave policies from the policies collection in MongoDB.
    """

    @staticmethod
    def _to_datetime(value: date | datetime) -> datetime:
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc)
        return datetime.combine(value, time.min, tzinfo=timezone.utc)

    @staticmethod
    def get_policy(leave_type: str, as_of_date: date) -> Optional[dict]:
        """Find the policy applicable to the given leave type on the specified date."""
        leave_type = leave_type.upper()
        as_of_datetime = PolicyService._to_datetime(as_of_date)

        query = {
            "leave_type": leave_type,
            "effective_from": {"$lte": as_of_datetime},
            "$or": [
                {"effective_to": None},
                {"effective_to": {"$gte": as_of_datetime}},
            ],
        }

        return policies_collection.find_one(query, sort=[("effective_from", -1)])

    @staticmethod
    def get_all_policies() -> list[dict]:
        """Return all configured policies from MongoDB."""
        return list(policies_collection.find({}))
