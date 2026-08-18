"""
HR service — organization-wide queries, reporting, and statistics.

Uses Motor (PyMongo async) directly for database operations on LMS database.
"""

from typing import Optional, Dict, Any, List
# pyrefly: ignore [missing-import]
from bson import ObjectId

from app.core.database import get_db
from datetime import datetime
from fastapi import HTTPException, status
from app.core.security import hash_password
from app.schemas.user import UserProfile
from app.schemas.leave import LeaveResponse, LeaveListResponse
from app.schemas.hr import HRDashboardStats, LeaveTypeDistribution, CreateEmployeeRequest
from app.services.auth_service import _doc_to_profile
from app.services.leave_service import _doc_to_response


async def create_employee(data: CreateEmployeeRequest) -> UserProfile:
    """
    Create a new employee/manager record in LMS.users and initialize LMS.leave_balances.
    Exact schema matches MongoDB Compass LMS structure.
    """
    db = get_db()
    email_clean = data.email.strip().lower()

    # Check for existing email
    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An employee with email '{email_clean}' already exists.",
        )

    # Determine employee_id if omitted
    emp_id = data.employee_id
    if not emp_id or not emp_id.strip():
        count = await db.users.count_documents({"role": data.role})
        prefix = "MGR" if data.role == "manager" else ("HR" if data.role == "hr" else "EMP")
        emp_id = f"{prefix}{count + 1:03d}"
    else:
        emp_id = emp_id.strip().upper()
        # Verify unique employee_id
        existing_emp = await db.users.find_one({"employee_id": emp_id})
        if existing_emp:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An employee with ID '{emp_id}' already exists.",
            )

    # Manager ObjectId reference
    mgr_oid = None
    if data.manager_id and data.manager_id.strip():
        try:
            mgr_oid = ObjectId(data.manager_id.strip())
        except Exception:
            mgr_oid = None

    # Password hash
    pwd_raw = data.password or "password123"
    pwd_hash = hash_password(pwd_raw)

    doj = data.date_of_joining or datetime.utcnow()

    # 1. Insert into LMS.users
    user_doc = {
        "employee_id": emp_id,
        "email": email_clean,
        "password_hash": pwd_hash,
        "full_name": data.full_name.strip(),
        "role": data.role,
        "department": data.department.strip(),
        "region": data.region.strip(),
        "manager_id": mgr_oid,
        "date_of_joining": doj,
        "is_active": True,
    }

    result = await db.users.insert_one(user_doc)
    new_user_id = result.inserted_id
    user_doc["_id"] = new_user_id

    # 2. Insert into LMS.leave_balances
    ann = float(data.annual_leave if data.annual_leave is not None else 20)
    sk = float(data.sick_leave if data.sick_leave is not None else 12)
    cas = float(data.casual_leave if data.casual_leave is not None else 6)

    balance_doc = {
        "user_id": new_user_id,
        "year": 2026,
        "balances": {
            "vacation": {
                "total": ann,
                "accrued": ann,
                "carry_forward": 0.0,
                "used": 0.0,
                "pending": 0.0,
                "adjustments": 0.0,
                "expired": 0.0,
                "remaining": ann,
                "usable": ann,
            },
            "sick": {
                "total": sk,
                "accrued": sk,
                "carry_forward": 0.0,
                "used": 0.0,
                "pending": 0.0,
                "adjustments": 0.0,
                "expired": 0.0,
                "remaining": sk,
                "usable": sk,
            },
            "personal": {
                "total": cas,
                "accrued": cas,
                "carry_forward": 0.0,
                "used": 0.0,
                "pending": 0.0,
                "adjustments": 0.0,
                "expired": 0.0,
                "remaining": cas,
                "usable": cas,
            },
        },
        "updated_at": datetime.utcnow(),
    }
    await db.leave_balances.insert_one(balance_doc)

    return await _doc_to_profile(user_doc)


async def get_all_employees() -> List[UserProfile]:
    """Retrieve all active users across the organization for HR directory."""
    db = get_db()
    cursor = db.users.find({"is_active": True}).sort("full_name", 1)
    employees = await cursor.to_list(length=1000)
    return [await _doc_to_profile(emp) for emp in employees]


async def get_all_managers() -> List[UserProfile]:
    """Retrieve all users in the system who have the 'manager' role."""
    db = get_db()
    cursor = db.users.find({"role": "manager", "is_active": True}).sort("full_name", 1)
    managers = await cursor.to_list(length=1000)
    return [await _doc_to_profile(mgr) for mgr in managers]


async def get_organizational_leaves(
    employee_id: Optional[str] = None,
    manager_id: Optional[str] = None,
    status: Optional[str] = None,
    leave_type: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> LeaveListResponse:
    """
    Retrieve all leave requests with advanced filtering and pagination.

    Used by HR to monitor organizational activity.
    """
    db = get_db()
    query: Dict[str, Any] = {}

    if employee_id:
        try:
            query["$or"] = [{"employee_id": employee_id}, {"employee_id": ObjectId(employee_id)}]
        except Exception:
            query["employee_id"] = employee_id

    if manager_id:
        try:
            query["$or"] = [{"manager_id": manager_id}, {"manager_id": ObjectId(manager_id)}]
        except Exception:
            query["manager_id"] = manager_id

    if status:
        query["status"] = status
    if leave_type:
        query["leave_type"] = leave_type

    # Count total matches.
    total = await db.leave_requests.count_documents(query)

    # Fetch paginated results.
    skip = (page - 1) * limit
    cursor = db.leave_requests.find(query).sort("created_at", -1).skip(skip).limit(limit)
    leaves = await cursor.to_list(length=limit)

    from app.services.leave_service import _enrich_leaves_with_employee_names
    items = await _enrich_leaves_with_employee_names(leaves, db)

    return LeaveListResponse(
        items=items,
        total=total,
    )


async def get_leave_statistics() -> HRDashboardStats:
    """
    Compute aggregate leave statistics for the HR dashboard.
    """
    db = get_db()

    # Get employee/manager counts.
    total_employees = await db.users.count_documents({"role": "employee", "is_active": True})
    total_managers = await db.users.count_documents({"role": "manager", "is_active": True})

    # Aggregation for request states.
    total_requests = await db.leave_requests.count_documents({})
    pending_requests = await db.leave_requests.count_documents({"status": "pending"})
    approved_requests = await db.leave_requests.count_documents({"status": "approved"})
    rejected_requests = await db.leave_requests.count_documents({"status": "rejected"})

    # Distribution of leave types.
    annual_count = await db.leave_requests.count_documents({"leave_type": {"$in": ["annual", "vacation"]}})
    sick_count = await db.leave_requests.count_documents({"leave_type": "sick"})
    casual_count = await db.leave_requests.count_documents({"leave_type": {"$in": ["casual", "personal"]}})
    unpaid_count = await db.leave_requests.count_documents({"leave_type": "unpaid"})

    distribution = LeaveTypeDistribution(
        annual=annual_count,
        sick=sick_count,
        casual=casual_count,
        unpaid=unpaid_count,
    )

    return HRDashboardStats(
        total_employees=total_employees,
        total_managers=total_managers,
        total_requests=total_requests,
        pending_requests=pending_requests,
        approved_requests=approved_requests,
        rejected_requests=rejected_requests,
        leave_type_distribution=distribution,
    )
