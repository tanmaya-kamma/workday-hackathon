"""
Leave service — leave request submission, approval, rejection, and queries.

Workflow:

    Employee
        ↓
    ValidationService
        ↓
    ApprovalService
        ↓
    MongoDB

Database access continues to use the existing get_db() pattern.
"""

from datetime import datetime, timezone

# pyrefly: ignore [missing-import]
from bson import ObjectId
from fastapi import HTTPException, status

from app.core.database import get_db
from app.schemas.leave import (
    LeaveResponse,
    LeaveListResponse,
    LeaveCreate,
)

from app.services.validation_service import ValidationService
from app.services.approval_service import ApprovalService

from app.services.notification_service import (
    notify_leave_submitted,
    notify_leave_approved,
    notify_leave_rejected,
)


# ============================================================================
# LEAVE TYPE NORMALIZATION
# ============================================================================


def _normalize_leave_type(leave_type: str) -> str:
    """
    Convert external/API leave type names into the canonical
    leave types used by the policy and accrual engines.

    Supported mappings:

        annual   -> vacation
        vacation -> vacation
        casual   -> personal
        personal -> personal
        sick     -> sick
        unpaid   -> unpaid
    """

    if not isinstance(leave_type, str):
        return ""

    normalized = leave_type.strip().lower()

    type_map = {
        "annual": "vacation",
        "vacation": "vacation",
        "casual": "personal",
        "personal": "personal",
        "sick": "sick",
        "unpaid": "unpaid",
    }

    return type_map.get(
        normalized,
        normalized,
    )


# ============================================================================
# EMPLOYEE ACTIONS
# ============================================================================


async def submit_leave(
    data: LeaveCreate,
    employee: dict,
) -> LeaveResponse:
    """
    Submit a new leave request.

    Processing flow:

        1. Identify employee
        2. Normalize leave type
        3. Validate leave request
        4. Calculate policy-aware chargeable days
        5. Determine approval route
        6. Assign manager/HR workflow
        7. Persist request
        8. Notify workflow
    """

    db = get_db()

    # ----------------------------------------------------------------------
    # EMPLOYEE ID
    # ----------------------------------------------------------------------

    employee_id = employee.get("employee_id")

    if not employee_id:
        employee_id = str(
            employee.get("_id", "")
        )

    if not employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee ID is missing.",
        )

    # ----------------------------------------------------------------------
    # NORMALIZE LEAVE TYPE
    # ----------------------------------------------------------------------

    normalized_leave_type = _normalize_leave_type(
        data.leave_type
    )

    if not normalized_leave_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave type is required.",
        )

    # ----------------------------------------------------------------------
    # VALIDATION ENGINE
    # ----------------------------------------------------------------------

    validation = ValidationService.validate_leave_request(
        employee_id=employee_id,
        leave_type=normalized_leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
    )

    if not validation.get("valid", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation.get(
                "reason",
                "Leave request failed validation.",
            ),
        )

    # IMPORTANT:
    # requested_days comes from ValidationService.
    # Therefore it respects:
    #
    #   - regional calendar
    #   - weekends
    #   - holidays
    #   - policy day-count basis
    #   - leave balance
    #

    requested_days = int(
        validation.get(
            "requested_days",
            0,
        )
    )

    if requested_days <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Leave request must contain "
                "at least one chargeable day."
            ),
        )

    # ----------------------------------------------------------------------
    # APPROVAL ENGINE
    # ----------------------------------------------------------------------

    approval_route = ApprovalService.determine_approval_route(
        requested_days
    )

    current_approver = approval_route[
        "current_approver"
    ]

    # ----------------------------------------------------------------------
    # MANAGER ROUTING
    # ----------------------------------------------------------------------

    manager_id = employee.get(
        "manager_id"
    )

    # A manager is required for 1–5 day leave.
    #
    # If no manager exists, use HR as fallback.

    if (
        approval_route["requires_manager"]
        and not manager_id
    ):

        fallback_user = await db.users.find_one(
            {
                "role": "hr",
                "is_active": True,
            }
        )

        if not fallback_user:

            fallback_user = await db.users.find_one(
                {
                    "role": "admin",
                    "is_active": True,
                }
            )

        if fallback_user:
            manager_id = fallback_user["_id"]

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "No manager assigned and no HR "
                    "fallback available. "
                    "Contact administrator."
                ),
            )

    # ----------------------------------------------------------------------
    # OBJECT ID NORMALIZATION
    # ----------------------------------------------------------------------

    employee_oid = _to_object_id(
        employee.get("_id")
    )

    manager_oid = (
        _to_object_id(manager_id)
        if manager_id
        else None
    )

    # ----------------------------------------------------------------------
    # CATEGORY
    # ----------------------------------------------------------------------

    from app.services.policy_service import categorize_leave

    category = categorize_leave(
        normalized_leave_type,
        data.reason,
        requested_days,
    )

    # ----------------------------------------------------------------------
    # DATES
    # ----------------------------------------------------------------------

    now = datetime.now(
        timezone.utc
    )

    start_dt = datetime(
        data.start_date.year,
        data.start_date.month,
        data.start_date.day,
        tzinfo=timezone.utc,
    )

    end_dt = datetime(
        data.end_date.year,
        data.end_date.month,
        data.end_date.day,
        tzinfo=timezone.utc,
    )

    # ----------------------------------------------------------------------
    # INITIAL WORKFLOW STATE
    # ----------------------------------------------------------------------

    leave_dict = {
        # Employee
        "employee_id": employee_oid,

        # Assigned manager where available
        "manager_id": manager_oid,

        # Canonical leave type
        "leave_type": normalized_leave_type,

        # Dates
        "start_date": start_dt,
        "end_date": end_dt,

        # Policy-aware charged days
        "total_days": requested_days,
        "requested_days": requested_days,

        # Request information
        "reason": data.reason,
        "category": category,

        # Initial status
        "status": "pending",

        # Approval workflow
        "approval_stage": current_approver,
        "current_approver": current_approver,

        "approval_route": {
            "requires_manager": (
                approval_route["requires_manager"]
            ),
            "requires_hr": (
                approval_route["requires_hr"]
            ),
            "approval_levels": (
                approval_route["approval_levels"]
            ),
            "final_approver": (
                approval_route["final_approver"]
            ),
        },

        # Audit fields
        "reviewed_by": None,
        "review_comment": None,
        "reviewed_at": None,

        # Multi-tier approval history
        "approval_history": [],

        # Timestamps
        "created_at": now,
        "updated_at": now,
    }

    # ----------------------------------------------------------------------
    # SAVE
    # ----------------------------------------------------------------------

    result = await db.leave_requests.insert_one(
        leave_dict
    )

    leave_doc = await db.leave_requests.find_one(
        {
            "_id": result.inserted_id
        }
    )

    if leave_doc is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Leave request could not be created."
            ),
        )

    # ----------------------------------------------------------------------
    # NOTIFICATION
    # ----------------------------------------------------------------------

    await notify_leave_submitted(
        leave_doc,
        employee,
    )

    return _doc_to_response(
        leave_doc
    )


# ============================================================================
# EMPLOYEE QUERY
# ============================================================================


async def get_my_leaves(
    employee: dict,
    status_filter: str | None = None,
) -> LeaveListResponse:
    """
    Get all leave requests submitted by the
    current employee.
    """

    db = get_db()

    emp_id = employee["_id"]

    query = {
        "$or": [
            {
                "employee_id": emp_id
            },
            {
                "employee_id": str(emp_id)
            },
        ]
    }

    if status_filter:
        query["status"] = status_filter

    cursor = (
        db.leave_requests
        .find(query)
        .sort(
            "created_at",
            -1,
        )
    )

    leaves = await cursor.to_list(
        length=500
    )

    items = await _enrich_leaves_with_employee_names(
        leaves,
        db,
    )

    return LeaveListResponse(
        items=items,
        total=len(items),
    )


# ============================================================================
# SINGLE LEAVE QUERY
# ============================================================================


async def get_leave_by_id(
    leave_id: str,
    user: dict,
) -> LeaveResponse:
    """
    Get a single leave request.
    """

    leave_doc = await _get_leave_or_404(
        leave_id
    )

    user_id = str(
        user["_id"]
    )

    doc_emp = str(
        leave_doc.get(
            "employee_id",
            "",
        )
    )

    doc_mgr = str(
        leave_doc.get(
            "manager_id",
            "",
        )
    )

    if (
        doc_emp != user_id
        and doc_mgr != user_id
        and user.get("role")
        not in ["hr", "admin"]
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You don't have access "
                "to this leave request."
            ),
        )

    db = get_db()

    items = await _enrich_leaves_with_employee_names(
        [leave_doc],
        db,
    )

    return (
        items[0]
        if items
        else _doc_to_response(leave_doc)
    )


# ============================================================================
# CANCEL
# ============================================================================


async def cancel_leave(
    leave_id: str,
    employee: dict,
) -> LeaveResponse:
    """
    Cancel a pending leave request.

    Only the employee who submitted the request
    can cancel it.
    """

    db = get_db()

    leave_doc = await _get_leave_or_404(
        leave_id
    )

    if (
        str(
            leave_doc.get(
                "employee_id",
                "",
            )
        )
        != str(employee["_id"])
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You can only cancel "
                "your own leave requests."
            ),
        )

    if leave_doc.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cannot cancel a leave request "
                f"with status "
                f"'{leave_doc.get('status')}'."
            ),
        )

    await db.leave_requests.update_one(
        {
            "_id": leave_doc["_id"]
        },
        {
            "$set": {
                "status": "cancelled",
                "approval_stage": None,
                "current_approver": None,
                "updated_at": datetime.now(
                    timezone.utc
                ),
            }
        },
    )

    updated = await db.leave_requests.find_one(
        {
            "_id": leave_doc["_id"]
        }
    )

    return _doc_to_response(
        updated
    )


# ============================================================================
# APPROVER QUERY
# ============================================================================


async def get_team_leaves(
    manager: dict,
    status_filter: str | None = None,
) -> LeaveListResponse:
    """
    Get leave requests assigned to the current approver.

    Manager:
        Sees requests assigned to that manager.

    HR:
        Sees requests currently requiring HR review.

    Admin:
        Sees all requests.
    """

    db = get_db()

    role = (
        manager.get("role") or ""
    ).strip().lower()

    mgr_id = manager["_id"]

    if role == "manager":

        query = {
            "$or": [
                {
                    "manager_id": mgr_id,
                    "approval_stage": "MANAGER",
                },
                {
                    "manager_id": str(mgr_id),
                    "approval_stage": "MANAGER",
                },
            ]
        }

    elif role == "hr":

        query = {
            "approval_stage": "HR"
        }

    else:

        query = {}

    if status_filter:
        query["status"] = status_filter

    cursor = (
        db.leave_requests
        .find(query)
        .sort(
            "created_at",
            -1,
        )
    )

    leaves = await cursor.to_list(
        length=500
    )

    items = await _enrich_leaves_with_employee_names(
        leaves,
        db,
    )

    return LeaveListResponse(
        items=items,
        total=len(items),
    )


# ============================================================================
# APPROVAL
# ============================================================================


async def approve_leave(
    leave_id: str,
    manager: dict,
    remarks: str | None = None,
) -> LeaveResponse:
    """
    Approve a leave request according to ApprovalService.

    Workflow:

        1–2 days:
            Manager → APPROVED

        3–5 days:
            Manager → PENDING_HR
            HR → APPROVED

        6+ days:
            HR → APPROVED

    Balance is deducted ONLY after final approval.
    """

    db = get_db()

    leave_doc = await _get_leave_or_404(
        leave_id
    )

    # ----------------------------------------------------------------------
    # APPROVAL AUTHORIZATION
    # ----------------------------------------------------------------------

    authorization = ApprovalService.validate_approver(
        leave_request=leave_doc,
        approver=manager,
    )

    if not authorization["allowed"]:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=authorization["reason"],
        )

    role = (
        manager.get("role") or ""
    ).strip().lower()

    # ----------------------------------------------------------------------
    # NEXT STATUS
    # ----------------------------------------------------------------------

    try:

        next_status = ApprovalService.get_next_status(
            leave_request=leave_doc,
            approver_role=role,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    now = datetime.now(
        timezone.utc
    )

    # ----------------------------------------------------------------------
    # APPROVAL HISTORY
    # ----------------------------------------------------------------------

    history_entry = {
        "level": (
            leave_doc.get(
                "approval_stage"
            )
            or role.upper()
        ),
        "approver_id": _to_object_id(
            manager.get("_id")
        ),
        "approver_role": role.upper(),
        "action": "APPROVED",
        "remarks": remarks,
        "timestamp": now,
    }

    # ----------------------------------------------------------------------
    # NEXT APPROVAL STAGE
    # ----------------------------------------------------------------------

    if next_status == "pending_hr":

        update_fields = {
            "status": "pending_hr",
            "approval_stage": "HR",
            "current_approver": "HR",
            "updated_at": now,
        }

    else:

        update_fields = {
            "status": "approved",
            "approval_stage": None,
            "current_approver": None,
            "reviewed_by": _to_object_id(
                manager.get("_id")
            ),
            "review_comment": remarks,
            "reviewed_at": now,
            "updated_at": now,
        }

    # ----------------------------------------------------------------------
    # SAVE APPROVAL
    # ----------------------------------------------------------------------

    await db.leave_requests.update_one(
        {
            "_id": leave_doc["_id"]
        },
        {
            "$set": update_fields,
            "$push": {
                "approval_history": history_entry
            },
        },
    )

    # ----------------------------------------------------------------------
    # FINAL APPROVAL → BALANCE DEDUCTION
    # ----------------------------------------------------------------------

    if next_status == "approved":

        await _deduct_leave_balance(
            db=db,
            leave_doc=leave_doc,
        )

    # ----------------------------------------------------------------------
    # FETCH UPDATED DOCUMENT
    # ----------------------------------------------------------------------

    updated = await db.leave_requests.find_one(
        {
            "_id": leave_doc["_id"]
        }
    )

    if updated is None:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Unable to retrieve updated "
                "leave request."
            ),
        )

    # ----------------------------------------------------------------------
    # FINAL APPROVAL NOTIFICATION
    # ----------------------------------------------------------------------

    if next_status == "approved":

        emp_ref = updated.get(
            "employee_id"
        )

        emp_doc = await _find_employee(
            db,
            emp_ref,
        )

        if emp_doc:

            await notify_leave_approved(
                updated,
                emp_doc,
            )

    return _doc_to_response(
        updated
    )


# ============================================================================
# REJECTION
# ============================================================================


async def reject_leave(
    leave_id: str,
    manager: dict,
    remarks: str | None = None,
) -> LeaveResponse:
    """
    Reject a leave request.

    Manager or HR can reject only when they are the
    currently authorized approval tier.
    """

    db = get_db()

    leave_doc = await _get_leave_or_404(
        leave_id
    )

    # ----------------------------------------------------------------------
    # AUTHORIZATION
    # ----------------------------------------------------------------------

    authorization = ApprovalService.validate_approver(
        leave_request=leave_doc,
        approver=manager,
    )

    if not authorization["allowed"]:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=authorization["reason"],
        )

    role = (
        manager.get("role") or ""
    ).strip().lower()

    # ----------------------------------------------------------------------
    # REJECTION VALIDATION
    # ----------------------------------------------------------------------

    try:

        next_status = ApprovalService.get_rejection_status(
            leave_request=leave_doc,
            approver_role=role,
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    now = datetime.now(
        timezone.utc
    )

    # ----------------------------------------------------------------------
    # HISTORY
    # ----------------------------------------------------------------------

    history_entry = {
        "level": (
            leave_doc.get(
                "approval_stage"
            )
            or role.upper()
        ),
        "approver_id": _to_object_id(
            manager.get("_id")
        ),
        "approver_role": role.upper(),
        "action": "REJECTED",
        "remarks": remarks,
        "timestamp": now,
    }

    # ----------------------------------------------------------------------
    # SAVE
    # ----------------------------------------------------------------------

    await db.leave_requests.update_one(
        {
            "_id": leave_doc["_id"]
        },
        {
            "$set": {
                "status": next_status,
                "approval_stage": None,
                "current_approver": None,
                "reviewed_by": _to_object_id(
                    manager.get("_id")
                ),
                "review_comment": remarks,
                "reviewed_at": now,
                "updated_at": now,
            },
            "$push": {
                "approval_history": history_entry
            },
        },
    )

    updated = await db.leave_requests.find_one(
        {
            "_id": leave_doc["_id"]
        }
    )

    # ----------------------------------------------------------------------
    # NOTIFICATION
    # ----------------------------------------------------------------------

    emp_ref = leave_doc.get(
        "employee_id"
    )

    emp_doc = await _find_employee(
        db,
        emp_ref,
    )

    if emp_doc:

        await notify_leave_rejected(
            updated,
            emp_doc,
        )

    return _doc_to_response(
        updated
    )


# ============================================================================
# BACKWARD-COMPATIBLE MANAGER VALIDATION
# ============================================================================


def _validate_manager_action(
    leave_doc: dict,
    manager: dict,
) -> None:
    """
    Backward-compatible manager authorization helper.

    This helper is retained because existing tests and parts of
    the application import it directly.

    It performs basic ownership/state validation first.

    If the document contains enough information for the full
    ApprovalService, the request is additionally validated there.
    """

    manager_id = str(
        manager.get("_id", "")
    )

    assigned_manager_id = str(
        leave_doc.get(
            "manager_id",
            "",
        )
    )

    # ----------------------------------------------------------------------
    # REQUEST STATE
    # ----------------------------------------------------------------------

    if leave_doc.get("status") != "pending":

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cannot review a leave request "
                f"with status "
                f"'{leave_doc.get('status')}'."
            ),
        )

    # ----------------------------------------------------------------------
    # MANAGER OWNERSHIP
    # ----------------------------------------------------------------------

    if assigned_manager_id != manager_id:

        if manager.get("role") not in [
            "hr",
            "admin",
        ]:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You are not the assigned manager "
                    "for this leave request."
                ),
            )

    # ----------------------------------------------------------------------
    # LEGACY DOCUMENT SUPPORT
    # ----------------------------------------------------------------------

    has_duration = (
        leave_doc.get(
            "requested_days"
        )
        is not None
        or leave_doc.get(
            "total_days"
        )
        is not None
        or (
            leave_doc.get(
                "start_date"
            )
            is not None
            and leave_doc.get(
                "end_date"
            )
            is not None
        )
    )

    # Old test/document without duration.
    if not has_duration:
        return

    # ----------------------------------------------------------------------
    # FULL APPROVAL ENGINE CHECK
    # ----------------------------------------------------------------------

    authorization = ApprovalService.validate_approver(
        leave_request=leave_doc,
        approver=manager,
    )

    if authorization.get("allowed", False):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=authorization.get(
            "reason",
            "You are not authorized to review this request.",
        ),
    )


# ============================================================================
# INTERNAL DATABASE HELPERS
# ============================================================================


async def _get_leave_or_404(
    leave_id: str,
) -> dict:
    """
    Fetch a leave request by MongoDB ObjectId.
    """

    if not ObjectId.is_valid(
        leave_id
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid leave request ID format."
            ),
        )

    db = get_db()

    doc = await db.leave_requests.find_one(
        {
            "_id": ObjectId(leave_id)
        }
    )

    if not doc:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Leave request not found."
            ),
        )

    return doc


async def _deduct_leave_balance(
    db,
    leave_doc: dict,
) -> None:
    """
    Deduct leave balance ONLY after final approval.
    """

    leave_type = (
        leave_doc.get(
            "leave_type"
        )
        or ""
    ).strip().lower()

    # Unpaid leave has no balance deduction.
    if leave_type == "unpaid":
        return

    emp_ref = leave_doc.get(
        "employee_id"
    )

    if not emp_ref:
        return

    emp_oid = _to_object_id(
        emp_ref
    )

    if emp_oid is None:
        return

    total_days = int(
        leave_doc.get(
            "requested_days",
            leave_doc.get(
                "total_days",
                1,
            ),
        )
    )

    field_map = {
        "annual": "vacation",
        "vacation": "vacation",
        "sick": "sick",
        "casual": "personal",
        "personal": "personal",
    }

    target_field = field_map.get(
        leave_type,
        leave_type,
    )

    await db.leave_balances.update_one(
        {
            "user_id": emp_oid
        },
        {
            "$inc": {
                (
                    f"balances."
                    f"{target_field}."
                    f"remaining"
                ): -total_days,

                (
                    f"balances."
                    f"{target_field}."
                    f"used"
                ): total_days,
            }
        },
    )


async def _find_employee(
    db,
    employee_ref,
) -> dict | None:
    """
    Find employee using either MongoDB ObjectId
    or human-readable employee_id.
    """

    if not employee_ref:
        return None

    # Try MongoDB ObjectId.
    if isinstance(
        employee_ref,
        ObjectId,
    ):

        employee_oid = employee_ref

    elif ObjectId.is_valid(
        str(employee_ref)
    ):

        employee_oid = ObjectId(
            str(employee_ref)
        )

    else:

        employee_oid = None

    if employee_oid:

        employee = await db.users.find_one(
            {
                "_id": employee_oid
            }
        )

        if employee:
            return employee

    # Try human-readable employee ID.
    return await db.users.find_one(
        {
            "employee_id": str(
                employee_ref
            )
        }
    )


def _to_object_id(
    value,
):
    """
    Safely convert a value to ObjectId.

    If the value is not a valid ObjectId string,
    return the original value.
    """

    if value is None:
        return None

    if isinstance(
        value,
        ObjectId,
    ):
        return value

    if ObjectId.is_valid(
        str(value)
    ):

        return ObjectId(
            str(value)
        )

    return value


# ============================================================================
# RESPONSE CONVERSION
# ============================================================================


def _doc_to_response(
    doc: dict,
    employee_name_override: str | None = None,
) -> LeaveResponse:
    """
    Convert MongoDB leave document into LeaveResponse.
    """

    start = doc.get(
        "start_date"
    )

    end = doc.get(
        "end_date"
    )

    if isinstance(
        start,
        datetime,
    ):
        start = start.date()

    if isinstance(
        end,
        datetime,
    ):
        end = end.date()

    emp_id = str(
        doc.get(
            "employee_id",
            "",
        )
    )

    mgr_id = (
        str(
            doc.get(
                "manager_id"
            )
        )
        if doc.get("manager_id")
        else None
    )

    total_days = doc.get(
        "requested_days"
    )

    if total_days is None:

        total_days = doc.get(
            "total_days"
        )

    if (
        total_days is None
        and start
        and end
    ):

        total_days = (
            end - start
        ).days + 1

    if total_days is None:
        total_days = 1

    applied_at = (
        doc.get("applied_at")
        or doc.get("created_at")
        or datetime.now(timezone.utc)
    )

    reviewed_at = (
        doc.get("reviewed_at")
        or doc.get("updated_at")
    )

    emp_name = (
        employee_name_override
        or doc.get("employee_name")
        or "Employee"
    )

    return LeaveResponse(
        id=str(
            doc["_id"]
        ),

        employee_id=emp_id,

        employee_name=emp_name,

        leave_type=doc.get(
            "leave_type",
            "annual",
        ),

        category=doc.get(
            "category",
            "planned",
        ),

        start_date=start,

        end_date=end,

        total_days=total_days,

        reason=doc.get(
            "reason",
            "",
        ),

        status=doc.get(
            "status",
            "pending",
        ),

        manager_id=mgr_id,

        manager_remarks=(
            doc.get(
                "manager_remarks"
            )
            or doc.get(
                "review_comment"
            )
        ),

        applied_at=applied_at,

        reviewed_at=reviewed_at,
    )


# ============================================================================
# EMPLOYEE NAME ENRICHMENT
# ============================================================================


async def _enrich_leaves_with_employee_names(
    leaves: list,
    db,
) -> list:
    """
    Enrich leave documents with employee names
    from the users collection.
    """

    if not leaves:
        return []

    emp_ids = []

    for doc in leaves:

        eid = doc.get(
            "employee_id"
        )

        if not eid:
            continue

        if isinstance(
            eid,
            ObjectId,
        ):

            emp_ids.append(eid)

        else:

            try:

                emp_ids.append(
                    ObjectId(
                        str(eid)
                    )
                )

            except Exception:
                pass

    users_map = {}

    if emp_ids:

        users = await (
            db.users
            .find(
                {
                    "_id": {
                        "$in": emp_ids
                    }
                }
            )
            .to_list(
                length=len(emp_ids)
            )
        )

        for user in users:

            users_map[
                str(user["_id"])
            ] = (
                user.get(
                    "full_name"
                )
                or user.get(
                    "email"
                )
            )

    responses = []

    for doc in leaves:

        emp_id_str = str(
            doc.get(
                "employee_id",
                "",
            )
        )

        emp_name = (
            doc.get(
                "employee_name"
            )
            or users_map.get(
                emp_id_str
            )
            or "Employee"
        )

        responses.append(
            _doc_to_response(
                doc,
                employee_name_override=emp_name,
            )
        )

    return responses