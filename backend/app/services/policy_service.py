"""
Policy service — dynamic policy lookup from MongoDB and leave categorization.
"""

from datetime import date, datetime, time, timezone
from typing import Optional

import app.core.database as db


_MEDICAL_KEYWORDS = [
    "sick", "doctor", "hospital", "surgery", "medical", "health",
    "fever", "flu", "covid", "injury", "treatment", "therapy",
    "dental", "clinic", "appointment",
]

_PERSONAL_KEYWORDS = [
    "family", "personal", "wedding", "funeral", "bereavement",
    "moving", "relocation", "emergency", "childcare",
]


# =========================================================
# LEAVE TYPE NORMALIZATION
# =========================================================

LEAVE_TYPE_MAP = {
    "annual": "VACATION",
    "vacation": "VACATION",

    "sick": "SICK",

    "casual": "PERSONAL",
    "personal": "PERSONAL",

    "unpaid": "UNPAID",
}


def normalize_leave_type(leave_type: str) -> str:
    """
    Convert API/user-facing leave type names into the
    canonical policy names used by the system.

    Examples:

        annual   -> VACATION
        vacation -> VACATION
        sick     -> SICK
        casual   -> PERSONAL
        personal -> PERSONAL
        unpaid   -> UNPAID
    """

    if not isinstance(leave_type, str):
        raise ValueError("Leave type must be a string.")

    normalized = leave_type.strip().lower()

    canonical = LEAVE_TYPE_MAP.get(normalized)

    if canonical is None:
        raise ValueError(
            f"Unsupported leave type: {leave_type}"
        )

    return canonical


# =========================================================
# LEAVE CATEGORIZATION
# =========================================================

def categorize_leave(
    leave_type: str,
    reason: str,
    total_days: int
) -> str:
    """
    Classify a leave request as planned/unplanned/medical/personal.
    """

    normalized_type = normalize_leave_type(leave_type)
    reason_lower = (reason or "").lower()

    if normalized_type == "SICK":
        return "medical"

    if any(
        keyword in reason_lower
        for keyword in _MEDICAL_KEYWORDS
    ):
        return "medical"

    if any(
        keyword in reason_lower
        for keyword in _PERSONAL_KEYWORDS
    ):
        return "personal"

    if (
        total_days == 1
        and normalized_type == "PERSONAL"
    ):
        return "unplanned"

    return "planned"


# =========================================================
# POLICY SERVICE
# =========================================================

class PolicyService:
    """
    Retrieves effective leave policies from the policies
    collection in MongoDB.
    """

    @staticmethod
    def _to_datetime(
        value: date | datetime
    ) -> datetime:

        if isinstance(value, datetime):

            if value.tzinfo is None:
                return value.replace(
                    tzinfo=timezone.utc
                )

            return value.astimezone(timezone.utc)

        return datetime.combine(
            value,
            time.min,
            tzinfo=timezone.utc
        )

    # =====================================================
    # GET POLICY
    # =====================================================

    @staticmethod
    def get_policy(
        leave_type: str,
        as_of_date: date
    ) -> Optional[dict]:
        """
        Find the active policy for the given leave type.

        The incoming leave type can be either an API-facing
        name or the canonical policy name.
        """

        # IMPORTANT:
        # Normalize annual -> VACATION,
        # casual -> PERSONAL, etc.
        canonical_leave_type = normalize_leave_type(
            leave_type
        )

        as_of_datetime = PolicyService._to_datetime(
            as_of_date
        )

        query = {
            "leave_type": canonical_leave_type,
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
                },
            ],
        }

        return db.policies_collection.find_one(
            query,
            sort=[("effective_from", -1)]
        )

    # =====================================================
    # GET ALL POLICIES
    # =====================================================

    @staticmethod
    def get_all_policies() -> list[dict]:
        """
        Return all configured policies from MongoDB.
        """

        return list(
            db.policies_collection.find({})
        )