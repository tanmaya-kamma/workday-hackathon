from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

import pytest

from app.services.approval_service import ApprovalService


EMPLOYEE_ID = ObjectId("6683a1b0c1d2e3f4a5b60001")
MANAGER_ID = ObjectId("6683a1b0c1d2e3f4a5b60002")
HR_ID = ObjectId("6683a1b0c1d2e3f4a5b60003")


def make_leave(
    total_days: int,
    status: str = "pending",
):
    return {
        "_id": ObjectId(),
        "employee_id": EMPLOYEE_ID,
        "manager_id": MANAGER_ID,
        "leave_type": "vacation",
        "start_date": datetime(2026, 9, 1, tzinfo=timezone.utc),
        "end_date": datetime(2026, 9, total_days, tzinfo=timezone.utc),
        "total_days": total_days,
        "reason": "Vacation",
        "status": status,
        "reviewed_by": None,
        "review_comment": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }


def make_user(user_id, role):
    return {
        "_id": user_id,
        "role": role,
        "is_active": True,
        "full_name": f"{role.title()} User",
    }


# =========================================================
# 1. SHORT LEAVE
# =========================================================


def test_two_day_leave_manager_is_final_approver():
    leave = make_leave(2)
    manager = make_user(MANAGER_ID, "manager")

    authorization = ApprovalService.validate_approver(
        leave_request=leave,
        approver=manager,
    )

    next_status = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="manager",
    )

    assert authorization["allowed"] is True
    assert next_status == "approved"


# =========================================================
# 2. MEDIUM LEAVE - MANAGER FIRST
# =========================================================


def test_three_day_leave_manager_approval_moves_to_hr():
    leave = make_leave(3)
    manager = make_user(MANAGER_ID, "manager")

    authorization = ApprovalService.validate_approver(
        leave_request=leave,
        approver=manager,
    )

    next_status = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="manager",
    )

    assert authorization["allowed"] is True
    assert next_status == "pending_hr"


# =========================================================
# 3. HR CANNOT SKIP MANAGER
# =========================================================


def test_hr_cannot_approve_three_day_leave_before_manager():
    leave = make_leave(3)
    hr = make_user(HR_ID, "hr")

    authorization = ApprovalService.validate_approver(
        leave_request=leave,
        approver=hr,
    )

    assert authorization["allowed"] is False
    assert "Manager approval" in authorization["reason"]


# =========================================================
# 4. HR FINAL APPROVAL
# =========================================================


def test_hr_can_finalize_three_day_leave_after_manager():
    leave = make_leave(
        3,
        status="pending_hr",
    )

    hr = make_user(HR_ID, "hr")

    authorization = ApprovalService.validate_approver(
        leave_request=leave,
        approver=hr,
    )

    next_status = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="hr",
    )

    assert authorization["allowed"] is True
    assert next_status == "approved"


# =========================================================
# 5. LONG LEAVE GOES DIRECTLY TO HR
# =========================================================


def test_six_day_leave_goes_directly_to_hr():
    leave = make_leave(6)
    hr = make_user(HR_ID, "hr")

    authorization = ApprovalService.validate_approver(
        leave_request=leave,
        approver=hr,
    )

    next_status = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="hr",
    )

    assert authorization["allowed"] is True
    assert next_status == "approved"


# =========================================================
# 6. MANAGER CANNOT APPROVE LONG LEAVE
# =========================================================


def test_manager_cannot_approve_six_day_leave():
    leave = make_leave(6)
    manager = make_user(MANAGER_ID, "manager")

    authorization = ApprovalService.validate_approver(
        leave_request=leave,
        approver=manager,
    )

    assert authorization["allowed"] is False


# =========================================================
# 7. MANAGER REJECTION
# =========================================================


def test_manager_can_reject_three_day_leave():
    leave = make_leave(3)

    result = ApprovalService.get_rejection_status(
        leave_request=leave,
        approver_role="manager",
    )

    assert result == "rejected"


# =========================================================
# 8. HR REJECTION
# =========================================================


def test_hr_can_reject_pending_hr_leave():
    leave = make_leave(
        3,
        status="pending_hr",
    )

    result = ApprovalService.get_rejection_status(
        leave_request=leave,
        approver_role="hr",
    )

    assert result == "rejected"


# =========================================================
# 9. BALANCE MUST NOT BE DEDUCTED AT PENDING_HR
# =========================================================


def test_manager_approval_for_three_day_leave_does_not_finalize():
    leave = make_leave(3)

    result = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="manager",
    )

    assert result == "pending_hr"
    assert result != "approved"


# =========================================================
# 10. FINAL APPROVAL IS REQUIRED BEFORE BALANCE DEDUCTION
# =========================================================


def test_three_day_leave_requires_hr_before_final_approval():
    leave = make_leave(3)

    manager_result = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="manager",
    )

    assert manager_result == "pending_hr"

    leave["status"] = manager_result

    hr_result = ApprovalService.get_next_status(
        leave_request=leave,
        approver_role="hr",
    )

    assert hr_result == "approved"


# =========================================================
# 11. ALREADY APPROVED REQUEST CANNOT BE REVIEWED
# =========================================================


def test_approved_leave_cannot_be_reviewed_again():
    leave = make_leave(
        2,
        status="approved",
    )

    manager = make_user(MANAGER_ID, "manager")

    authorization = ApprovalService.validate_approver(
        leave_request=leave,
        approver=manager,
    )

    assert authorization["allowed"] is False


# =========================================================
# 12. ALREADY REJECTED REQUEST CANNOT BE REVIEWED
# =========================================================


def test_rejected_leave_cannot_be_reviewed_again():
    leave = make_leave(
        2,
        status="rejected",
    )

    manager = make_user(MANAGER_ID, "manager")

    authorization = ApprovalService.validate_approver(
        leave_request=leave,
        approver=manager,
    )

    assert authorization["allowed"] is False