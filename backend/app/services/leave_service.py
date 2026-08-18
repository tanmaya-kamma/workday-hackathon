"""
Leave service — leave request submission, approval, rejection, and queries.

Uses Motor (PyMongo async) directly for all database operations on LMS database.
"""

from datetime import datetime, timezone

# pyrefly: ignore [missing-import]
from bson import ObjectId
from fastapi import HTTPException, status

from app.core.database import get_db
from app.models.leave import LeaveRequestInDB
from app.schemas.leave import LeaveResponse, LeaveListResponse
from app.schemas.leave import LeaveCreate
from app.services.notification_service import (
    notify_leave_submitted,
    notify_leave_approved,
    notify_leave_rejected,
)


# ---------------------------------------------------------------------------
# Employee actions
# ---------------------------------------------------------------------------

async def submit_leave(data: LeaveCreate, employee: dict) -> LeaveResponse:
    """
    Submit a new leave request.

    Args:
        data: Validated leave request data.
        employee: Raw MongoDB user document (dict).
    """
    db = get_db()

    # Validate date range.
    if data.start_date > data.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be on or before end date.",
        )

    total_days = (data.end_date - data.start_date).days + 1

    # Check balance (skip for unpaid leave).
    balances = employee.get("leave_balances")
    if not balances:
        bal_doc = await db.leave_balances.find_one({"user_id": employee["_id"]})
        if bal_doc and "balances" in bal_doc:
            b = bal_doc["balances"]
            field_map = {"annual": "vacation", "vacation": "vacation", "sick": "sick", "casual": "personal", "personal": "personal"}
            target_key = field_map.get(data.leave_type, "vacation")
            sub_bal = b.get(target_key, {})
            current_balance = int(sub_bal.get("remaining") if sub_bal.get("remaining") is not None else (sub_bal.get("total") or 20))
        else:
            current_balance = 20
    elif isinstance(balances, dict):
        current_balance = balances.get(data.leave_type, 20)
    else:
        current_balance = 20

    if data.leave_type != "unpaid" and current_balance < total_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient {data.leave_type} leave balance. Available: {current_balance}, Requested: {total_days}.",
        )

    # Employee manager routing with HR/Admin fallback.
    manager_id = employee.get("manager_id")
    if not manager_id:
        fallback_user = await db.users.find_one({"role": "hr", "is_active": True})
        if not fallback_user:
            fallback_user = await db.users.find_one({"role": "admin", "is_active": True})
        
        if fallback_user:
            manager_id = fallback_user["_id"]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No manager assigned and no HR fallback available. Contact administrator.",
            )

    from app.services.policy_service import categorize_leave
    category = categorize_leave(data.leave_type, data.reason, total_days)

    now = datetime.now(timezone.utc)
    start_dt = datetime(data.start_date.year, data.start_date.month, data.start_date.day, 0, 0, 0, tzinfo=timezone.utc)
    end_dt = datetime(data.end_date.year, data.end_date.month, data.end_date.day, 0, 0, 0, tzinfo=timezone.utc)

    # Standardize leave_type to match Compass schema: vacation, sick, personal, unpaid
    type_map = {
        "annual": "vacation",
        "vacation": "vacation",
        "casual": "personal",
        "personal": "personal",
        "sick": "sick",
        "unpaid": "unpaid",
    }
    db_leave_type = type_map.get(data.leave_type, data.leave_type)

    emp_oid = employee["_id"] if isinstance(employee["_id"], ObjectId) else (ObjectId(str(employee["_id"])) if ObjectId.is_valid(str(employee["_id"])) else employee["_id"])
    mgr_oid = manager_id if isinstance(manager_id, ObjectId) else (ObjectId(str(manager_id)) if manager_id and ObjectId.is_valid(str(manager_id)) else manager_id)

    # Exact MongoDB Compass schema structure
    leave_dict = {
        "employee_id": emp_oid,
        "manager_id": mgr_oid,
        "leave_type": db_leave_type,
        "start_date": start_dt,
        "end_date": end_dt,
        "reason": data.reason,
        "status": "pending",
        "reviewed_by": None,
        "review_comment": None,
        "created_at": now,
        "updated_at": now,
    }

    result = await db.leave_requests.insert_one(leave_dict)
    leave_doc = await db.leave_requests.find_one({"_id": result.inserted_id})

    # Invalidate HR stats cache.


    # Notify manager
    await notify_leave_submitted(leave_doc, employee)

    return _doc_to_response(leave_doc)


async def get_my_leaves(
    employee: dict,
    status_filter: str | None = None,
) -> LeaveListResponse:
    """Get all leave requests submitted by the current employee."""
    db = get_db()

    emp_id = employee["_id"]
    query = {"$or": [{"employee_id": emp_id}, {"employee_id": str(emp_id)}]}
    if status_filter:
        query["status"] = status_filter

    cursor = db.leave_requests.find(query).sort("created_at", -1)
    leaves = await cursor.to_list(length=500)
    items = await _enrich_leaves_with_employee_names(leaves, db)

    return LeaveListResponse(
        items=items,
        total=len(items),
    )


async def get_leave_by_id(leave_id: str, user: dict) -> LeaveResponse:
    """Get a single leave request."""
    leave_doc = await _get_leave_or_404(leave_id)

    user_id = str(user["_id"])
    doc_emp = str(leave_doc.get("employee_id", ""))
    doc_mgr = str(leave_doc.get("manager_id", ""))

    if doc_emp != user_id and doc_mgr != user_id and user.get("role") not in ["hr", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this leave request.",
        )

    db = get_db()
    items = await _enrich_leaves_with_employee_names([leave_doc], db)
    return items[0] if items else _doc_to_response(leave_doc)


async def cancel_leave(leave_id: str, employee: dict) -> LeaveResponse:
    """Cancel a pending leave request. Only the employee can cancel."""
    db = get_db()
    leave_doc = await _get_leave_or_404(leave_id)

    doc_emp = str(leave_doc.get("employee_id", ""))
    if doc_emp != str(employee["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own leave requests.",
        )

    if leave_doc["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a leave request with status '{leave_doc['status']}'.",
        )

    await db.leave_requests.update_one(
        {"_id": leave_doc["_id"]},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
    )


    updated = await db.leave_requests.find_one({"_id": leave_doc["_id"]})
    return _doc_to_response(updated)


# ---------------------------------------------------------------------------
# Manager actions
# ---------------------------------------------------------------------------

async def get_team_leaves(
    manager: dict,
    status_filter: str | None = None,
) -> LeaveListResponse:
    """Get all leave requests assigned to this manager (or HR) for review."""
    db = get_db()

    mgr_id = manager["_id"]
    if manager.get("role") in ["hr", "admin"]:
        query = {}
    else:
        query = {"$or": [{"manager_id": mgr_id}, {"manager_id": str(mgr_id)}]}

    if status_filter:
        query["status"] = status_filter

    cursor = db.leave_requests.find(query).sort("created_at", -1)
    leaves = await cursor.to_list(length=500)
    items = await _enrich_leaves_with_employee_names(leaves, db)

    return LeaveListResponse(
        items=items,
        total=len(items),
    )


async def approve_leave(leave_id: str, manager: dict, remarks: str | None = None) -> LeaveResponse:
    """Approve a pending leave request and deduct the employee's balance."""
    db = get_db()
    leave_doc = await _get_leave_or_404(leave_id)
    _validate_manager_action(leave_doc, manager)

    now = datetime.now(timezone.utc)
    total_days = leave_doc.get("total_days") or 1

    # Deduct leave balance
    emp_ref = leave_doc.get("employee_id")
    if leave_doc.get("leave_type") != "unpaid":
        field_map = {"annual": "vacation", "vacation": "vacation", "sick": "sick", "casual": "personal", "personal": "personal"}
        target_field = field_map.get(leave_doc["leave_type"], "vacation")

        # Update LMS.leave_balances collection
        if emp_ref:
            emp_oid = emp_ref if isinstance(emp_ref, ObjectId) else ObjectId(str(emp_ref))
            await db.leave_balances.update_one(
                {"user_id": emp_oid},
                {"$inc": {
                    f"balances.{target_field}.remaining": -total_days,
                    f"balances.{target_field}.used": total_days,
                }}
            )

    mgr_oid = manager["_id"] if isinstance(manager["_id"], ObjectId) else (ObjectId(str(manager["_id"])) if ObjectId.is_valid(str(manager["_id"])) else manager["_id"])

    await db.leave_requests.update_one(
        {"_id": leave_doc["_id"]},
        {
            "$set": {
                "status": "approved",
                "reviewed_by": mgr_oid,
                "review_comment": remarks,
                "updated_at": now,
            }
        },
    )


    updated = await db.leave_requests.find_one({"_id": leave_doc["_id"]})

    # Fetch employee doc for notification
    emp_doc = await db.users.find_one({"_id": emp_ref if isinstance(emp_ref, ObjectId) else ObjectId(str(emp_ref))})
    if emp_doc:
        await notify_leave_approved(updated, emp_doc)

    return _doc_to_response(updated)


async def reject_leave(leave_id: str, manager: dict, remarks: str | None = None) -> LeaveResponse:
    """Reject a pending leave request with optional manager remarks."""
    db = get_db()
    leave_doc = await _get_leave_or_404(leave_id)
    _validate_manager_action(leave_doc, manager)

    now = datetime.now(timezone.utc)
    mgr_oid = manager["_id"] if isinstance(manager["_id"], ObjectId) else (ObjectId(str(manager["_id"])) if ObjectId.is_valid(str(manager["_id"])) else manager["_id"])

    await db.leave_requests.update_one(
        {"_id": leave_doc["_id"]},
        {
            "$set": {
                "status": "rejected",
                "reviewed_by": mgr_oid,
                "review_comment": remarks,
                "updated_at": now,
            }
        },
    )


    updated = await db.leave_requests.find_one({"_id": leave_doc["_id"]})

    emp_ref = leave_doc.get("employee_id")
    emp_doc = await db.users.find_one({"_id": emp_ref if isinstance(emp_ref, ObjectId) else ObjectId(str(emp_ref))})
    if emp_doc:
        await notify_leave_rejected(updated, emp_doc)

    return _doc_to_response(updated)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_leave_or_404(leave_id: str) -> dict:
    """Fetch a leave request by ID or raise 404."""
    if not ObjectId.is_valid(leave_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid leave request ID format.",
        )
    db = get_db()
    doc = await db.leave_requests.find_one({"_id": ObjectId(leave_id)})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )
    return doc


def _validate_manager_action(leave_doc: dict, manager: dict) -> None:
    """Validate that the manager is assigned to this request and it is pending."""
    mgr_role = manager.get("role")
    mgr_id_str = str(manager["_id"])
    doc_mgr_str = str(leave_doc.get("manager_id", ""))

    if mgr_role not in ["hr", "admin"] and doc_mgr_str != mgr_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the assigned manager for this leave request.",
        )
    if leave_doc.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot review a leave request with status '{leave_doc.get('status')}'.",
        )


def _doc_to_response(doc: dict, employee_name_override: str | None = None) -> LeaveResponse:
    """Convert a MongoDB leave_requests document to a response schema."""
    start = doc.get("start_date")
    end = doc.get("end_date")
    if isinstance(start, datetime):
        start = start.date()
    if isinstance(end, datetime):
        end = end.date()

    emp_id = str(doc.get("employee_id", ""))
    mgr_id = str(doc.get("manager_id", "")) if doc.get("manager_id") else None

    total_days = doc.get("total_days")
    if total_days is None:
        total_days = (end - start).days + 1 if (start and end) else 1

    applied_at = doc.get("applied_at") or doc.get("created_at") or datetime.now(timezone.utc)
    reviewed_at = doc.get("reviewed_at") or doc.get("updated_at")

    emp_name = employee_name_override or doc.get("employee_name") or "Employee"

    return LeaveResponse(
        id=str(doc["_id"]),
        employee_id=emp_id,
        employee_name=emp_name,
        leave_type=doc.get("leave_type", "annual"),
        category=doc.get("category", "planned"),
        start_date=start,
        end_date=end,
        total_days=total_days,
        reason=doc.get("reason", ""),
        status=doc.get("status", "pending"),
        manager_id=mgr_id,
        manager_remarks=doc.get("manager_remarks") or doc.get("review_comment"),
        applied_at=applied_at,
        reviewed_at=reviewed_at,
    )


async def _enrich_leaves_with_employee_names(leaves: list, db) -> list:
    """Enrich a list of raw leave documents with full employee names from LMS.users."""
    if not leaves:
        return []

    emp_ids = []
    for doc in leaves:
        eid = doc.get("employee_id")
        if eid:
            if isinstance(eid, ObjectId):
                emp_ids.append(eid)
            else:
                try:
                    emp_ids.append(ObjectId(str(eid)))
                except Exception:
                    pass

    users_map = {}
    if emp_ids:
        users = await db.users.find({"_id": {"$in": emp_ids}}).to_list(length=len(emp_ids))
        for u in users:
            users_map[str(u["_id"])] = u.get("full_name") or u.get("email")

    responses = []
    for doc in leaves:
        emp_id_str = str(doc.get("employee_id", ""))
        emp_name = doc.get("employee_name") or users_map.get(emp_id_str) or "Employee"
        responses.append(_doc_to_response(doc, employee_name_override=emp_name))
    return responses
