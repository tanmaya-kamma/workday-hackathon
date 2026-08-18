from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId

from app.services.approval_service import ApprovalService


# =========================================================
# TEST DATA
# =========================================================

EMPLOYEE_ID = ObjectId("6683a1b0c1d2e3f4a5b60001")
MANAGER_ID = ObjectId("6683a1b0c1d2e3f4a5b60002")
HR_ID = ObjectId("6683a1b0c1d2e3f4a5b60003")


def make_leave(
    total_days: int,
    status: str = "pending",
    manager_id=MANAGER_ID,
):
    return {
        "_id": ObjectId(),
        "employee_id": EMPLOYEE_ID,
        "manager_id": manager_id,
        "leave_type": "vacation",
        "start_date": date(2026, 9, 1),
        "end_date": date(2026, 9, total_days),
        "total_days": total_days,
        "reason": "Vacation",
        "status": status,
        "reviewed_by": None,
        "review_comment": None,
    }


def make_user(
    user_id,
    role,
):
    return {
        "_id": user_id,
        "role": role,
        "is_active": True,
        "full_name": f"{role.title()} User",
    }


# =========================================================
# ROUTING TESTS
# =========================================================


def test_one_day_leave_goes_to_manager():
    result = ApprovalService.determine_approval_route(1)

    assert result["current_approver"] == "MANAGER"
    assert result["final_approver"] == "MANAGER"
    assert result["requires_manager"] is True
    assert result["requires_hr"] is False


def test_two_day_leave_goes_to_manager():
    result = ApprovalService.determine_approval_route(2)

    assert result["current_approver"] == "MANAGER"
    assert result["final_approver"] == "MANAGER"
    assert result["requires_manager"] is True
    assert result["requires_hr"] is False


def test_three_day_leave_requires_manager_then_hr():
    result = ApprovalService.determine_approval_route(3)

    assert result["current_approver"] == "MANAGER"
    assert result["final_approver"] == "HR"
    assert result["requires_manager"] is True
    assert result["requires_hr"] is True


def test_five_day_leave_requires_manager_then_hr():
    result = ApprovalService.determine_approval_route(5)

    assert result["current_approver"] == "MANAGER"
    assert result["final_approver"] == "HR"
    assert result["requires_manager"] is True
    assert result["requires_hr"] is True


def test_six_day_leave_goes_directly_to_hr():
    result = ApprovalService.determine_approval_route(6)

    assert result["current_approver"] == "HR"
    assert result["final_approver"] == "HR"
    assert result["requires_manager"] is False
    assert result["requires_hr"] is True


def test_negative_days_are_rejected():
    with pytest.raises(ValueError):
        ApprovalService.determine_approval_route(-1)


def test_zero_days_are_rejected():
    with pytest.raises(ValueError):
        ApprovalService.determine_approval_route(0)


# =========================================================
# APPROVER VALIDATION TESTS
# =========================================================


def test_manager_can_review_two_day_leave():
    leave = make_leave(2)
    manager = make_user(MANAGER_ID, "manager")

    result = ApprovalService.validate_approver(
        leave_request=leave,
        approver=manager,
    )

    assert result["allowed"] is True


def test_manager_can_review_three_day_leave_first_tier():
    leave = make_leave(3)
    manager = make_user(MANAGER_ID, "manager")

    result = ApprovalService.validate_approver(
        leave_request=leave,
        approver=manager,
    )

    assert result["allowed"] is True


def test_hr_cannot_skip_manager_for_three_day_leave():
    leave = make_leave(3)
    hr = make_user(HR_ID, "hr")

    result = ApprovalService.validate_approver(
        leave_request=leave,
        approver=hr,
    )

    assert result["allowed"] is False


def test_hr_can_review_six_day_leave_directly():
    leave = make_leave(6)
    hr = make_user(HR_ID, "hr")

    result = ApprovalService.validate_approver(
        leave_request=leave,
        approver=hr,
    )

    assert result["allowed"] is True


def test_wrong_manager_cannot_review_request():
    leave = make_leave(2)

    wrong_manager = make_user(
        ObjectId("6683a1b0c1d2e3f4a5b60009"),
        "manager",
    )

    result = ApprovalService.validate_approver(
        leave_request=leave,
        approver=wrong_manager,
    )

    assert result["allowed"] is False


# =========================================================
# STATUS TRANSITION TESTS
# =========================================================


def test_two_day_manager_approval_results_in_approved():
    leave = make_leave(2)

    result = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="manager",
    )

    assert result == "approved"


def test_three_day_manager_approval_moves_to_pending_hr():
    leave = make_leave(3)

    result = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="manager",
    )

    assert result == "pending_hr"


def test_three_day_hr_approval_results_in_approved():
    leave = make_leave(
        3,
        status="pending_hr",
    )

    result = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="hr",
    )

    assert result == "approved"


def test_six_day_hr_approval_results_in_approved():
    leave = make_leave(6)

    result = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="hr",
    )

    assert result == "approved"


def test_manager_cannot_finalize_three_day_leave():
    leave = make_leave(3)

    result = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="manager",
    )

    assert result == "pending_hr"
    assert result != "approved"