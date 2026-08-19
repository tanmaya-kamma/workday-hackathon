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

Multi-tier approval:

    1–2 days:
        Employee → Manager → APPROVED

    3–5 days:
        Employee → Manager → Manager's Manager / HR → APPROVED

    6+ days:
        Employee → Manager's Manager / HR → APPROVED

The HR approver is resolved from the manager hierarchy.

Example:

    Sana Sheikh
        manager_id → Ravi Patel

    Ravi Patel
        manager_id → Priya Mehta (HR)

Therefore:

    Sana → Ravi → Priya
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
    Convert external/API leave type names into canonical leave types.
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
# HR APPROVER RESOLUTION
# ============================================================================


async def _resolve_hr_approver(
    db,
    manager_id,
):
    """
    Resolve the HR approver for an employee's leave request.

    Hierarchy:

        Employee
            ↓
        Manager
            ↓
        Manager's manager

    Example:

        Sana → Ravi → Priya

    Ravi.manager_id points to Priya, so Priya becomes
    the HR approver.

    If the manager's manager does not exist or is not HR,
    an active HR user is used as fallback.
    """

    # ------------------------------------------------------------------
    # If no manager exists, find an active HR user.
    # ------------------------------------------------------------------

    if not manager_id:
        hr_user = await db.users.find_one(
            {
                "role": "hr",
                "is_active": True,
            }
        )

        if hr_user:
            return hr_user

        return None

    # ------------------------------------------------------------------
    # Find the assigned manager.
    # ------------------------------------------------------------------

    manager_oid = _to_object_id(manager_id)

    manager_doc = None

    if manager_oid is not None:

        manager_doc = await db.users.find_one(
            {
                "_id": manager_oid
            }
        )

    # Also support human-readable/string IDs.
    if not manager_doc:

        manager_doc = await db.users.find_one(
            {
                "employee_id": str(manager_id)
            }
        )

    # ------------------------------------------------------------------
    # Manager's manager = next approval level.
    # ------------------------------------------------------------------

    if manager_doc:

        manager_manager_id = manager_doc.get(
            "manager_id"
        )

        if manager_manager_id:

            next_manager_oid = _to_object_id(
                manager_manager_id
            )

            hr_approver = None

            if next_manager_oid is not None:

                hr_approver = await db.users.find_one(
                    {
                        "_id": next_manager_oid,
                        "is_active": True,
                    }
                )

            # Support employee_id based manager references.
            if not hr_approver:

                hr_approver = await db.users.find_one(
                    {
                        "employee_id": str(
                            manager_manager_id
                        ),
                        "is_active": True,
                    }
                )

            # Only use the manager's manager if they are HR.
            if (
                hr_approver
                and (
                    hr_approver.get("role") or ""
                ).strip().lower() == "hr"
            ):
                return hr_approver

    # ------------------------------------------------------------------
    # Fallback: any active HR user.
    # ------------------------------------------------------------------

    hr_user = await db.users.find_one(
        {
            "role": "hr",
            "is_active": True,
        }
    )

    return hr_user


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
        6. Resolve manager
        7. Resolve HR approver
        8. Persist request
        9. Notify workflow
    """

    db = get_db()

    # ----------------------------------------------------------------------
    # EMPLOYEE ID
    # ----------------------------------------------------------------------

    employee_id = employee.get(
        "employee_id"
    )

    if not employee_id:

        employee_id = str(
            employee.get(
                "_id",
                "",
            )
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

    if not validation.get(
        "valid",
        False,
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation.get(
                "reason",
                "Leave request failed validation.",
            ),
        )

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

    # Days beyond the usable balance are allowed but unpaid.
    paid_days = float(
        validation.get(
            "paid_days",
            requested_days,
        )
    )

    unpaid_days = float(
        validation.get(
            "unpaid_days",
            0.0,
        )
    )

    # ----------------------------------------------------------------------
    # APPROVAL ENGINE
    # ----------------------------------------------------------------------

    approval_route = ApprovalService.determine_approval_route(
        requested_days
    )

    # ----------------------------------------------------------------------
    # MANAGER ROUTING
    # ----------------------------------------------------------------------

    manager_id = employee.get(
        "manager_id"
    )

    # Manager required for 1–5 day requests.
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
    # RESOLVE HR APPROVER
    # ----------------------------------------------------------------------

    hr_approver = None

    if approval_route["requires_hr"]:

        hr_approver = await _resolve_hr_approver(
            db,
            manager_id,
        )

        if not hr_approver:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "No HR approver could be resolved "
                    "for this leave request."
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

    hr_approver_oid = (
        _to_object_id(
            hr_approver.get("_id")
        )
        if hr_approver
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
    # INITIAL APPROVER
    # ----------------------------------------------------------------------

    if approval_route["requires_manager"]:

        initial_stage = "MANAGER"

        initial_approver = manager_oid

    else:

        initial_stage = "HR"

        initial_approver = hr_approver_oid

    # ----------------------------------------------------------------------
    # INITIAL WORKFLOW STATE
    # ----------------------------------------------------------------------

    leave_dict = {

        # Employee
        "employee_id": employee_oid,

        # Assigned manager
        "manager_id": manager_oid,

        # Resolved HR approver
        "hr_approver_id": hr_approver_oid,

        # Canonical leave type
        "leave_type": normalized_leave_type,

        # Dates
        "start_date": start_dt,
        "end_date": end_dt,

        # Policy-aware charged days
        "total_days": requested_days,
        "requested_days": requested_days,

        # Paid vs unpaid split (unpaid = days beyond usable balance)
        "paid_days": paid_days,
        "unpaid_days": unpaid_days,

        # Request information
        "reason": data.reason,
        "category": category,

        # Initial status
        "status": "pending",

        # Approval workflow
        "approval_stage": initial_stage,

        # IMPORTANT:
        # This stores the actual user's MongoDB ID,
        # not the string "MANAGER" or "HR".
        "current_approver": initial_approver,

        # Complete approval route
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
            "manager_id": manager_oid,
            "hr_approver_id": hr_approver_oid,
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

    doc_hr = str(
        leave_doc.get(
            "hr_approver_id",
            "",
        )
    )

    if (
        doc_emp != user_id
        and doc_mgr != user_id
        and doc_hr != user_id
        and user.get("role")
        not in [
            "hr",
            "admin",
        ]
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
        else _doc_to_response(
            leave_doc
        )
    )


# ============================================================================
# CANCEL
# ============================================================================


async def cancel_leave(
    leave_id: str,
    employee: dict,
) -> LeaveResponse:

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

    if leave_doc.get(
        "status"
    ) != "pending":

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
        Sees requests currently assigned to that manager.

    HR:
        Sees requests specifically assigned to that HR user.

    Admin:
        Sees all requests.
    """

    db = get_db()

    role = (
        manager.get("role") or ""
    ).strip().lower()

    mgr_id = manager["_id"]

    # ------------------------------------------------------------------
    # MANAGER
    # ------------------------------------------------------------------

    if role == "manager":

        # Managers see EVERY request from their team — including
        # HR-direct (6+ day) requests and those already escalated to
        # HR — for visibility. Which ones are actionable is decided
        # by approval_stage/current_approver on the client and at
        # approve-time by the approval engine.
        query = {
            "$or": [
                {
                    "manager_id": mgr_id,
                },
                {
                    "manager_id": str(mgr_id),
                },
            ]
        }

    # ------------------------------------------------------------------
    # HR
    # ------------------------------------------------------------------

    elif role == "hr":

        query = {
            "approval_stage": "HR",
            "$or": [
                {
                    "current_approver": mgr_id
                },
                {
                    "current_approver": str(mgr_id)
                },
            ],
        }

    # ------------------------------------------------------------------
    # ADMIN
    # ------------------------------------------------------------------

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

        # --------------------------------------------------------------
        # Resolve HR approver.
        #
        # For Sana:
        #
        # Sana.manager_id = Ravi
        # Ravi.manager_id = Priya
        #
        # Therefore Priya becomes current_approver.
        # --------------------------------------------------------------

        hr_approver_oid = leave_doc.get(
            "hr_approver_id"
        )

        if not hr_approver_oid:

            hr_approver = await _resolve_hr_approver(
                db,
                leave_doc.get(
                    "manager_id"
                ),
            )

            if not hr_approver:

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Unable to resolve HR approver "
                        "for this leave request."
                    ),
                )

            hr_approver_oid = _to_object_id(
                hr_approver.get("_id")
            )

            await db.leave_requests.update_one(
                {
                    "_id": leave_doc["_id"]
                },
                {
                    "$set": {
                        "hr_approver_id": hr_approver_oid
                    }
                },
            )

        update_fields = {
            "status": "pending_hr",
            "approval_stage": "HR",

            # IMPORTANT:
            # Actual HR user's ID.
            "current_approver": hr_approver_oid,

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

    manager_id = str(
        manager.get(
            "_id",
            "",
        )
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

    if leave_doc.get(
        "status"
    ) not in [
        "pending",
        "pending_hr",
    ]:

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

    if (
        assigned_manager_id != manager_id
        and manager.get("role")
        not in [
            "hr",
            "admin",
        ]
    ):

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
        ) is not None
        or leave_doc.get(
            "total_days"
        ) is not None
        or (
            leave_doc.get(
                "start_date"
            ) is not None
            and leave_doc.get(
                "end_date"
            ) is not None
        )
    )

    if not has_duration:
        return

    # ----------------------------------------------------------------------
    # FULL APPROVAL ENGINE CHECK
    # ----------------------------------------------------------------------

    authorization = ApprovalService.validate_approver(
        leave_request=leave_doc,
        approver=manager,
    )

    if authorization.get(
        "allowed",
        False,
    ):
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


# ============================================================================
# BALANCE DEDUCTION
# ============================================================================


async def _deduct_leave_balance(
    db,
    leave_doc: dict,
) -> None:

    leave_type = (
        leave_doc.get(
            "leave_type"
        )
        or ""
    ).strip().lower()

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

    total_days = float(
        leave_doc.get(
            "requested_days",
            leave_doc.get(
                "total_days",
                1,
            ),
        )
    )

    # Only the paid portion is charged against the balance;
    # days beyond the usable balance were classified unpaid.
    paid_days = leave_doc.get("paid_days")

    if paid_days is not None:
        deduct_days = float(paid_days)
    else:
        unpaid_days = float(
            leave_doc.get("unpaid_days") or 0.0
        )
        deduct_days = max(0.0, total_days - unpaid_days)

    if deduct_days <= 0:
        return

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
                ): -deduct_days,

                (
                    f"balances."
                    f"{target_field}."
                    f"used"
                ): deduct_days,
            }
        },
    )


# ============================================================================
# FIND EMPLOYEE
# ============================================================================


async def _find_employee(
    db,
    employee_ref,
) -> dict | None:

    if not employee_ref:
        return None

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

    return await db.users.find_one(
        {
            "employee_id": str(
                employee_ref
            )
        }
    )


# ============================================================================
# OBJECT ID HELPER
# ============================================================================


def _to_object_id(
    value,
):
    """
    Safely convert a value to ObjectId.
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
        if doc.get(
            "manager_id"
        )
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
        doc.get(
            "applied_at"
        )
        or doc.get(
            "created_at"
        )
        or datetime.now(
            timezone.utc
        )
    )

    reviewed_at = (
        doc.get(
            "reviewed_at"
        )
        or doc.get(
            "updated_at"
        )
    )

    emp_name = (
        employee_name_override
        or doc.get(
            "employee_name"
        )
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

        paid_days=doc.get(
            "paid_days"
        ),

        unpaid_days=float(
            doc.get(
                "unpaid_days"
            )
            or 0.0
        ),

        reason=doc.get(
            "reason",
            "",
        ),

        status=doc.get(
            "status",
            "pending",
        ),

        approval_stage=doc.get(
            "approval_stage"
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

            emp_ids.append(
                eid
            )

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