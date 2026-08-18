from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from bson import ObjectId
from fastapi import HTTPException

from app.schemas.leave import LeaveCreate
from app.services.leave_service import (
    submit_leave,
    approve_leave,
    reject_leave,
    _validate_manager_action,
)


# ============================================================================
# 1. SUBMIT LEAVE WITH MANAGER
# ============================================================================


@pytest.mark.anyio
@patch(
    "app.services.leave_service.ValidationService.validate_leave_request"
)
@patch(
    "app.services.leave_service.ApprovalService.determine_approval_route"
)
@patch(
    "app.services.leave_service.get_db"
)
async def test_submit_leave_with_manager(
    mock_get_db,
    mock_determine_route,
    mock_validate,
):
    # ----------------------------------------------------------------------
    # DATABASE
    # ----------------------------------------------------------------------

    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    inserted_id = ObjectId()

    mock_db.leave_requests.insert_one = AsyncMock(
        return_value=MagicMock(
            inserted_id=inserted_id
        )
    )

    mock_db.leave_requests.find_one = AsyncMock(
        return_value={
            "_id": inserted_id,
            "employee_id": "emp_123",
            "employee_name": "Test Employee",
            "leave_type": "vacation",
            "category": "planned",
            "start_date": date(2026, 9, 1),
            "end_date": date(2026, 9, 3),
            "total_days": 3,
            "requested_days": 3,
            "reason": "Vacation",
            "status": "pending",
            "manager_id": "mgr_123",
            "approval_stage": "MANAGER",
            "current_approver": "MANAGER",
            "created_at": datetime.now(
                timezone.utc
            ),
        }
    )

    mock_db.notifications.insert_one = AsyncMock()

    # ----------------------------------------------------------------------
    # MOCK VALIDATION ENGINE
    # ----------------------------------------------------------------------

    mock_validate.return_value = {
        "valid": True,
        "employee_id": "emp_123",
        "leave_type": "VACATION",
        "requested_days": 3,
        "usable_balance": 10.0,
        "reason": (
            "Leave request passed validation."
        ),
    }

    # ----------------------------------------------------------------------
    # MOCK APPROVAL ENGINE
    # ----------------------------------------------------------------------

    mock_determine_route.return_value = {
        "current_approver": "MANAGER",
        "final_approver": "HR",
        "requires_manager": True,
        "requires_hr": True,
        "approval_levels": 2,
    }

    # ----------------------------------------------------------------------
    # REQUEST
    # ----------------------------------------------------------------------

    data = LeaveCreate(
        leave_type="annual",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
        reason="Vacation",
    )

    employee = {
        "_id": ObjectId(),
        "employee_id": "emp_123",
        "full_name": "Test Employee",
        "manager_id": "mgr_123",
        "leave_balances": {
            "annual": 10
        },
    }

    # ----------------------------------------------------------------------
    # EXECUTE
    # ----------------------------------------------------------------------

    result = await submit_leave(
        data,
        employee,
    )

    # ----------------------------------------------------------------------
    # ASSERT
    # ----------------------------------------------------------------------

    assert result.status == "pending"
    assert result.total_days == 3

    mock_validate.assert_called_once()

    mock_determine_route.assert_called_once_with(
        3
    )

    mock_db.leave_requests.insert_one.assert_awaited_once()


# ============================================================================
# 2. SUBMIT LEAVE WITH HR FALLBACK
# ============================================================================


@pytest.mark.anyio
@patch(
    "app.services.leave_service.ValidationService.validate_leave_request"
)
@patch(
    "app.services.leave_service.ApprovalService.determine_approval_route"
)
@patch(
    "app.services.leave_service.get_db"
)
async def test_submit_leave_hr_fallback(
    mock_get_db,
    mock_determine_route,
    mock_validate,
):
    # ----------------------------------------------------------------------
    # DATABASE
    # ----------------------------------------------------------------------

    mock_db = MagicMock()
    mock_get_db.return_value = mock_db

    hr_id = ObjectId()
    inserted_id = ObjectId()

    # HR fallback lookup.
    mock_db.users.find_one = AsyncMock(
        return_value={
            "_id": hr_id,
            "role": "hr",
            "is_active": True,
        }
    )

    mock_db.leave_requests.insert_one = AsyncMock(
        return_value=MagicMock(
            inserted_id=inserted_id
        )
    )

    mock_db.leave_requests.find_one = AsyncMock(
        return_value={
            "_id": inserted_id,
            "employee_id": "emp_123",
            "employee_name": "Test Employee",
            "leave_type": "vacation",
            "category": "planned",
            "start_date": date(2026, 9, 1),
            "end_date": date(2026, 9, 3),
            "total_days": 3,
            "requested_days": 3,
            "reason": "Vacation",
            "status": "pending",
            "manager_id": str(hr_id),
            "approval_stage": "MANAGER",
            "current_approver": "MANAGER",
            "created_at": datetime.now(
                timezone.utc
            ),
        }
    )

    mock_db.notifications.insert_one = AsyncMock()

    # ----------------------------------------------------------------------
    # MOCK VALIDATION
    # ----------------------------------------------------------------------

    mock_validate.return_value = {
        "valid": True,
        "employee_id": "emp_123",
        "leave_type": "VACATION",
        "requested_days": 3,
        "usable_balance": 10.0,
        "reason": (
            "Leave request passed validation."
        ),
    }

    # ----------------------------------------------------------------------
    # MOCK APPROVAL ROUTE
    # ----------------------------------------------------------------------

    mock_determine_route.return_value = {
        "current_approver": "MANAGER",
        "final_approver": "HR",
        "requires_manager": True,
        "requires_hr": True,
        "approval_levels": 2,
    }

    # ----------------------------------------------------------------------
    # REQUEST
    # ----------------------------------------------------------------------

    data = LeaveCreate(
        leave_type="annual",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
        reason="Vacation",
    )

    employee = {
        "_id": ObjectId(),
        "employee_id": "emp_123",
        "full_name": "Test Employee",
        "manager_id": None,
        "leave_balances": {
            "annual": 10
        },
    }

    # ----------------------------------------------------------------------
    # EXECUTE
    # ----------------------------------------------------------------------

    result = await submit_leave(
        data,
        employee,
    )

    # ----------------------------------------------------------------------
    # ASSERT
    # ----------------------------------------------------------------------

    assert result.status == "pending"
    assert result.total_days == 3

    mock_db.users.find_one.assert_awaited_once_with(
        {
            "role": "hr",
            "is_active": True,
        }
    )

    mock_validate.assert_called_once()

    mock_determine_route.assert_called_once_with(
        3
    )

    mock_db.leave_requests.insert_one.assert_awaited_once()


# ============================================================================
# 3. MANAGER SECURITY
# ============================================================================


def test_validate_manager_action_security():
    manager_id = ObjectId(
        "6683a1b0c1d2e3f4a5b60103"
    )

    leave_doc = {
        "manager_id": str(manager_id),
        "status": "pending",
    }

    manager = {
        "_id": manager_id
    }

    # Should not raise.
    _validate_manager_action(
        leave_doc,
        manager,
    )


# ============================================================================
# 4. ALREADY REVIEWED REQUEST
# ============================================================================


def test_validate_manager_action_already_reviewed():
    manager_id = ObjectId(
        "6683a1b0c1d2e3f4a5b60103"
    )

    leave_doc = {
        "manager_id": str(manager_id),
        "status": "approved",
    }

    manager = {
        "_id": manager_id
    }

    with pytest.raises(
        HTTPException
    ) as exc_info:

        _validate_manager_action(
            leave_doc,
            manager,
        )

    assert exc_info.value.status_code == 400


# ============================================================================
# 5. WRONG MANAGER
# ============================================================================


def test_validate_manager_action_wrong_manager():
    leave_doc = {
        "manager_id": "manager_123",
        "status": "pending",
    }

    manager = {
        "_id": ObjectId(
            "6683a1b0c1d2e3f4a5b60103"
        )
    }

    with pytest.raises(
        HTTPException
    ) as exc_info:

        _validate_manager_action(
            leave_doc,
            manager,
        )

    assert exc_info.value.status_code == 403


# ============================================================================
# 6. REJECTED REQUEST CANNOT BE REVIEWED
# ============================================================================


def test_validate_manager_action_rejected_request():
    manager_id = ObjectId(
        "6683a1b0c1d2e3f4a5b60103"
    )

    leave_doc = {
        "manager_id": str(manager_id),
        "status": "rejected",
    }

    manager = {
        "_id": manager_id
    }

    with pytest.raises(
        HTTPException
    ) as exc_info:

        _validate_manager_action(
            leave_doc,
            manager,
        )

    assert exc_info.value.status_code == 400