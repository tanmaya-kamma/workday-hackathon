"""
Policy service — leave categorization and rule engine.

Currently uses simple keyword-based rules. Designed to be replaced
by an LLM-based categorization engine in a future iteration.

Categories:
  - planned:    Pre-planned vacations, events.
  - unplanned:  Emergency or last-minute leaves.
  - medical:    Health-related leaves.
  - personal:   Personal errands, family matters.
"""

# Keywords that hint at each category.
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
    Determine the leave category based on type, reason, and duration.

    This is a simple rule-based categorizer. It will be replaced by
    an LLM-based classifier in a future iteration.

    Returns:
        One of: "planned", "unplanned", "medical", "personal"
    """
    reason_lower = reason.lower()

    # Sick leave is always medical.
    if leave_type == "sick":
        return "medical"

    # Check for medical keywords in the reason.
    if any(keyword in reason_lower for keyword in _MEDICAL_KEYWORDS):
        return "medical"

    # Check for personal keywords.
    if any(keyword in reason_lower for keyword in _PERSONAL_KEYWORDS):
        return "personal"

    # Short-notice leave (1 day) is likely unplanned.
    if total_days == 1 and leave_type == "casual":
        return "unplanned"

    # Default: planned leave.
    return "planned"


# ---------------------------------------------------------------------------
# Policy definitions (static for now)
# ---------------------------------------------------------------------------

LEAVE_POLICIES = [
    {
        "leave_type": "annual",
        "max_days_per_year": 20,
        "requires_approval": True,
        "min_notice_days": 3,
        "description": "Paid annual leave for vacation and personal time.",
    },
    {
        "leave_type": "sick",
        "max_days_per_year": 12,
        "requires_approval": True,
        "min_notice_days": 0,
        "description": "Paid sick leave for health-related absences.",
    },
    {
        "leave_type": "casual",
        "max_days_per_year": 6,
        "requires_approval": True,
        "min_notice_days": 1,
        "description": "Casual leave for short, unplanned absences.",
    },
    {
        "leave_type": "unpaid",
        "max_days_per_year": 0,  # Unlimited
        "requires_approval": True,
        "min_notice_days": 3,
        "description": "Unpaid leave when paid balances are exhausted.",
    },
]


def get_leave_policies() -> list[dict]:
    """Return the list of leave policy definitions."""
    return LEAVE_POLICIES
