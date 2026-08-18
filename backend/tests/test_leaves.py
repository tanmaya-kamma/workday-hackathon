import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from fastapi import HTTPException, status
from datetime import date

from app.services.leave_service import submit_leave, approve_leave, reject_leave, _validate_manager_action
from app.schemas.leave import LeaveCreate


@pytest.mark.anyio
@patch("app.services.leave_service.get_db")
async def test_submit_leave_with_manager(mock_get_db):
    # Setup mock DB.
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    # Mock insert_one.
    mock_db.leave_requests.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
    # Mock find_one for user and leave request.
    mock_db.leave_requests.find_one = AsyncMock(return_value={
        "_id": ObjectId(),
        "employee_id": "emp_123",
        "employee_name": "Test Employee",
        "leave_type": "annual",
        "category": "planned",
        "start_date": date(2026, 9, 1),
        "end_date": date(2026, 9, 3),
        "total_days": 3,
        "reason": "Vacation",
        "status": "pending",
        "manager_id": "mgr_123",
        "applied_at": date(2026, 8, 1),
    })
    mock_db.notifications.insert_one = AsyncMock()

    data = LeaveCreate(
        leave_type="annual",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
        reason="Vacation",
    )
    employee = {
        "_id": ObjectId(),
        "full_name": "Test Employee",
        "manager_id": "mgr_123",
        "leave_balances": {"annual": 10},
    }

    res = await submit_leave(data, employee)
    assert res.status == "pending"
    assert res.manager_id == "mgr_123"
    assert res.total_days == 3


@pytest.mark.anyio
@patch("app.services.leave_service.get_db")
async def test_submit_leave_hr_fallback(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = mock_db
    
    # Mock finding an HR user.
    hr_id = ObjectId()
    mock_db.users.find_one = AsyncMock(return_value={"_id": hr_id, "role": "hr", "is_active": True})
    mock_db.leave_requests.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
    mock_db.leave_requests.find_one = AsyncMock(return_value={
        "_id": ObjectId(),
        "employee_id": "emp_123",
        "employee_name": "Test Employee",
        "leave_type": "annual",
        "category": "planned",
        "start_date": date(2026, 9, 1),
        "end_date": date(2026, 9, 3),
        "total_days": 3,
        "reason": "Vacation",
        "status": "pending",
        "manager_id": str(hr_id),
        "applied_at": date(2026, 8, 1),
    })
    mock_db.notifications.insert_one = AsyncMock()

    data = LeaveCreate(
        leave_type="annual",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 3),
        reason="Vacation",
    )
    # Employee has no manager_id assigned.
    employee = {
        "_id": ObjectId(),
        "full_name": "Test Employee",
        "manager_id": None,
        "leave_balances": {"annual": 10},
    }

    res = await submit_leave(data, employee)
    assert res.manager_id == str(hr_id)
    assert res.status == "pending"


def test_validate_manager_action_security():
    leave_doc = {
        "manager_id": "mgr_123",
        "status": "pending",
    }
    
    # Authorized manager.
    manager_auth = {"_id": ObjectId("6683a1b0c1d2e3f4a5b60103")}
    leave_doc["manager_id"] = str(manager_auth["_id"])
    
    # Should run fine without raising any exception.
    _validate_manager_action(leave_doc, manager_auth)
    
    # Unauthorized manager.
    manager_unauth = {"_id": ObjectId("6683a1b0c1d2e3f4a5b60104")}
    with pytest.raises(HTTPException) as exc_info:
        _validate_manager_action(leave_doc, manager_unauth)
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


def test_validate_manager_action_already_reviewed():
    leave_doc = {
        "manager_id": "6683a1b0c1d2e3f4a5b60103",
        "status": "approved",  # Already approved!
    }
    manager = {"_id": ObjectId("6683a1b0c1d2e3f4a5b60103")}
    
    with pytest.raises(HTTPException) as exc_info:
        _validate_manager_action(leave_doc, manager)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "Cannot review a leave request" in exc_info.value.detail
