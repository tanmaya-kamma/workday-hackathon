# pyrefly: ignore [missing-import]
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch
# pyrefly: ignore [missing-import]
from bson import ObjectId
from datetime import date, datetime, timezone
# pyrefly: ignore [missing-import]
import bcrypt

from main import app as fastapi_app
from app.core.database import get_db

client = TestClient(fastapi_app)

# Helper mock for database dependency overridden in database module and container
@pytest.fixture(autouse=True)
def mock_db():
    mock_db_instance = MagicMock()
    
    # Configure all collections with async methods
    for coll in ["users", "leave_requests", "notifications"]:
        mock_coll = MagicMock()
        mock_coll.find_one = AsyncMock(return_value=None)
        mock_coll.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_coll.insert_many = AsyncMock()
        mock_coll.update_one = AsyncMock()
        mock_coll.update_many = AsyncMock()
        mock_coll.delete_one = AsyncMock()
        mock_coll.count_documents = AsyncMock(return_value=0)
        
        # Cursor mocks for chained calls
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_coll.find = MagicMock(return_value=mock_cursor)
        
        setattr(mock_db_instance, coll, mock_coll)
    
    # Direct module-level database reference mocking
    import app.core.database
    original_db = app.core.database._database
    original_avail = app.core.database._db_available
    
    app.core.database._database = mock_db_instance
    app.core.database._db_available = True
    
    fastapi_app.dependency_overrides[get_db] = lambda: mock_db_instance
    
    yield mock_db_instance
    
    # Restore state after test run
    app.core.database._database = original_db
    app.core.database._db_available = original_avail
    fastapi_app.dependency_overrides.clear()


def test_health_check_endpoint(mock_db):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]



def test_register_and_login_flow(mock_db):
    pwd_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode("utf-8")
    
    call_count = 0
    # Dynamic side_effect function to prevent StopAsyncIteration and handle registration + login checks
    def mock_find_one(query, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        # The first two queries check for email/employee_id existence and must return None.
        if call_count <= 2:
            return None
        return {
            "_id": ObjectId("6683a1b0c1d2e3f4a5b60101"),
            "email": "test@company.com",
            "hashed_password": pwd_hash,
            "role": "employee",
            "full_name": "Test User",
            "is_active": True,
            "department": "Engineering",
            "employee_id": "EMP-999",
            "leave_balances": {"annual": 20, "sick": 10, "casual": 5},
            "created_at": datetime.now(timezone.utc)
        }

    mock_db.users.find_one = AsyncMock(side_effect=mock_find_one)
    mock_db.users.insert_one = AsyncMock()
    
    # 1. Register User
    reg_payload = {
        "employee_id": "EMP-999",
        "email": "test@company.com",
        "full_name": "Test User",
        "password": "password123",
        "role": "employee",
        "department": "Engineering"
    }
    response = client.post("/api/v1/auth/register", json=reg_payload)
    assert response.status_code == 201
    
    # 2. Login User
    login_payload = {
        "email": "test@company.com",
        "password": "password123"
    }
    login_response = client.post("/api/v1/auth/login", json=login_payload)
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data


def test_submit_leave_api(mock_db):
    user_id = ObjectId()
    mock_user = {
        "_id": user_id,
        "email": "john@company.com",
        "role": "employee",
        "full_name": "John Employee",
        "is_active": True,
        "department": "Sales",
        "manager_id": "mgr-123",
        "leave_balances": {"annual": 20, "sick": 10, "casual": 5},
        "created_at": datetime.now(timezone.utc)
    }
    
    # Register mock db responses
    mock_db.users.find_one = AsyncMock(return_value=mock_user)
    mock_db.leave_requests.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
    mock_db.leave_requests.find_one = AsyncMock(return_value={
        "_id": ObjectId(),
        "employee_id": str(user_id),
        "employee_name": "John Employee",
        "leave_type": "annual",
        "category": "planned",
        "start_date": date(2026, 9, 1),
        "end_date": date(2026, 9, 3),
        "total_days": 3,
        "reason": "Family trip",
        "status": "pending",
        "manager_id": "mgr-123",
        "applied_at": date(2026, 8, 1)
    })
    mock_db.notifications.insert_one = AsyncMock()
    
    # Generate token
    from app.core.security import create_access_token
    token = create_access_token(str(user_id), extra_claims={"role": "employee"})
    headers = {"Authorization": f"Bearer {token}"}
    
    leave_payload = {
        "leave_type": "annual",
        "start_date": "2026-09-01",
        "end_date": "2026-09-03",
        "reason": "Family trip"
    }
    
    response = client.post("/api/v1/leaves/", json=leave_payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["status"] == "pending"


def test_hr_stats_and_directories_api(mock_db):
    hr_id = ObjectId()
    mock_hr_user = {
        "_id": hr_id,
        "email": "helen@company.com",
        "role": "hr",
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    # Mock user authorization check
    mock_db.users.find_one = AsyncMock(return_value=mock_hr_user)
    
    # Mock cursors for employees list
    mock_cursor = MagicMock()
    mock_cursor.sort = MagicMock(return_value=mock_cursor)
    mock_cursor.skip = MagicMock(return_value=mock_cursor)
    mock_cursor.limit = MagicMock(return_value=mock_cursor)
    mock_cursor.to_list = AsyncMock(return_value=[
        {
            "_id": ObjectId(),
            "full_name": "Emp A",
            "employee_id": "EMP-001",
            "email": "empa@company.com",
            "role": "employee",
            "department": "HR",
            "manager_id": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "leave_balances": {"annual": 20, "sick": 10, "casual": 5}
        }
    ])
    
    mock_db.users.find = MagicMock(return_value=mock_cursor)
    mock_db.users.count_documents = AsyncMock(return_value=5)
    mock_db.leave_requests.count_documents = AsyncMock(return_value=2)
    
    # Generate JWT header
    from app.core.security import create_access_token
    token = create_access_token(str(hr_id), extra_claims={"role": "hr"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Employees directory
    response = client.get("/api/v1/hr/employees", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
    
    # 2. Statistics
    response_stats = client.get("/api/v1/hr/statistics", headers=headers)
    assert response_stats.status_code == 200
    assert response_stats.json()["total_employees"] == 5
