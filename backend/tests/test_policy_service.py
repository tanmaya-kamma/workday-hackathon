from datetime import date

from app.services.policy_service import PolicyService


def test_vacation_policy_exists():

    policy = PolicyService.get_policy(
        leave_type="VACATION",
        as_of_date=date(2026, 8, 18)
    )

    assert policy is not None

    assert policy["policy_id"] == "VACATION_STANDARD"

    assert policy["leave_type"] == "VACATION"


def test_vacation_tenure_rules():

    policy = PolicyService.get_policy(
        leave_type="VACATION",
        as_of_date=date(2026, 8, 18)
    )

    rules = policy["tenure_rules"]

    assert len(rules) == 4

    assert rules[0]["annual_entitlement"] == 12
    assert rules[1]["annual_entitlement"] == 18
    assert rules[2]["annual_entitlement"] == 24
    assert rules[3]["annual_entitlement"] == 30


def test_sick_policy_exists():

    policy = PolicyService.get_policy(
        leave_type="SICK",
        as_of_date=date(2026, 8, 18)
    )

    assert policy is not None
    assert policy["annual_entitlement"] == 12


def test_personal_policy_exists():

    policy = PolicyService.get_policy(
        leave_type="PERSONAL",
        as_of_date=date(2026, 8, 18)
    )

    assert policy is not None
    assert policy["annual_entitlement"] == 6