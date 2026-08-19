"""
HR service — organization-wide queries,
reporting, statistics, leave policies,
and regional holiday calendars.

Uses Motor (PyMongo async) directly
for database operations on LMS database.
"""

from typing import (
    Optional,
    Dict,
    Any,
    List,
)

from io import BytesIO
from datetime import datetime

# pyrefly: ignore [missing-import]
from bson import ObjectId

from fastapi import (
    HTTPException,
    status,
    UploadFile,
)

from app.core.database import get_db
from app.core.security import hash_password

from app.schemas.user import UserProfile
from app.schemas.leave import (
    LeaveResponse,
    LeaveListResponse,
)
from app.schemas.hr import (
    HRDashboardStats,
    LeaveTypeDistribution,
    CreateEmployeeRequest,
)

from app.services.auth_service import (
    _doc_to_profile,
)

from app.services.leave_service import (
    _doc_to_response,
)

# ============================================================
# DYNAMIC ACCRUAL ENGINE
# ============================================================

from app.services.accrual_service import (
    AccrualService,
)


# ============================================================
# EMPLOYEE MANAGEMENT
# ============================================================


async def create_employee(
    data: CreateEmployeeRequest,
) -> UserProfile:
    """
    Create a new employee/manager record
    in LMS.users.

    Immediately after creating the employee,
    the dynamic accrual engine calculates and
    persists the employee's leave balance.

    Leave entitlement is NOT manually assigned
    from the frontend.

    The accrual engine is responsible for:

    - Date of joining
    - Organization leave policy
    - Accrual rules
    - Employee tenure
    - First-year proration
    - Regional calendar
    - Existing leave usage
    - Pending leave
    """

    db = get_db()

    # ========================================================
    # CLEAN EMAIL
    # ========================================================

    email_clean = (
        data.email.strip().lower()
    )

    # ========================================================
    # CHECK EXISTING EMAIL
    # ========================================================

    existing = await db.users.find_one(
        {
            "email": email_clean
        }
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"An employee with email "
                f"'{email_clean}' already exists."
            ),
        )

    # ========================================================
    # EMPLOYEE ID
    # ========================================================

    emp_id = data.employee_id

    if not emp_id or not emp_id.strip():

        count = await db.users.count_documents(
            {
                "role": data.role
            }
        )

        prefix = (
            "MGR"
            if data.role == "manager"
            else (
                "HR"
                if data.role == "hr"
                else "EMP"
            )
        )

        emp_id = (
            f"{prefix}{count + 1:03d}"
        )

    else:

        emp_id = (
            emp_id.strip().upper()
        )

        existing_emp = (
            await db.users.find_one(
                {
                    "employee_id": emp_id
                }
            )
        )

        if existing_emp:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"An employee with ID "
                    f"'{emp_id}' already exists."
                ),
            )

    # ========================================================
    # MANAGER OBJECT ID
    # ========================================================

    mgr_oid = None

    if (
        data.manager_id
        and data.manager_id.strip()
    ):

        try:
            mgr_oid = ObjectId(
                data.manager_id.strip()
            )

        except Exception:
            mgr_oid = None

    # ========================================================
    # PASSWORD
    # ========================================================

    pwd_raw = (
        data.password
        or "password123"
    )

    pwd_hash = hash_password(
        pwd_raw
    )

    # ========================================================
    # DATE OF JOINING
    # ========================================================

    doj = (
        data.date_of_joining
        or datetime.utcnow()
    )

    # ========================================================
    # USER DOCUMENT
    # ========================================================

    user_doc = {
        "employee_id": emp_id,

        "email": email_clean,

        "password_hash": pwd_hash,

        "full_name":
            data.full_name.strip(),

        "role":
            data.role,

        "department":
            data.department.strip(),

        "region":
            data.region.strip(),

        "manager_id":
            mgr_oid,

        "date_of_joining":
            doj,

        "is_active":
            True,
    }

    # ========================================================
    # INSERT USER FIRST
    # ========================================================

    result = await db.users.insert_one(
        user_doc
    )

    new_user_id = (
        result.inserted_id
    )

    user_doc["_id"] = (
        new_user_id
    )

    # ========================================================
    # DYNAMIC INITIAL LEAVE BALANCE
    # ========================================================

    """
    IMPORTANT:

    Do NOT manually insert:

        annual = 20
        sick = 12
        casual = 6

    anymore.

    The AccrualService is the source of truth.

    It calculates the employee's actual
    entitlement based on the employee's
    joining date and organization policy.
    """

    try:

        calculation_date = (
            datetime.utcnow().date()
        )

        # ----------------------------------------------------
        # CALCULATE
        # ----------------------------------------------------

        calculation = (
            AccrualService.calculate_employee_balance(
                employee_id=emp_id,
                as_of_date=calculation_date,
            )
        )

        # ----------------------------------------------------
        # SAVE
        # ----------------------------------------------------

        AccrualService.save_balance(
            employee=user_doc,
            calculation=calculation,
            year=calculation_date.year,
        )

        print(
            "[HR] Initial leave balance "
            "successfully calculated and "
            f"saved for {emp_id}."
        )

        print(
            "[HR] Calculation:",
            calculation,
        )

    except Exception as exc:

        # ----------------------------------------------------
        # IMPORTANT ERROR LOGGING
        # ----------------------------------------------------

        print(
            "[HR] ERROR: Employee was created "
            "but initial accrual calculation "
            f"failed for {emp_id}."
        )

        print(
            "[HR] Accrual error:",
            repr(exc),
        )

        # ----------------------------------------------------
        # CLEAN UP INVALID EMPLOYEE
        # ----------------------------------------------------

        """
        We don't want an employee existing
        without a corresponding leave balance.

        Therefore, if the mandatory initial
        balance calculation fails, remove
        the employee again and return an error.

        This makes employee creation atomic
        from the application's perspective.
        """

        try:

            await db.users.delete_one(
                {
                    "_id":
                        new_user_id
                }
            )

        except Exception as cleanup_exc:

            print(
                "[HR] WARNING: Could not "
                "rollback employee after "
                f"accrual failure: {cleanup_exc}"
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Employee could not be created "
                "because the leave accrual "
                "calculation failed. "
                f"Accrual error: {str(exc)}"
            ),
        )

    # ========================================================
    # RETURN CREATED EMPLOYEE
    # ========================================================

    return await _doc_to_profile(
        user_doc
    )


# ============================================================
# EMPLOYEE DIRECTORY
# ============================================================


async def get_all_employees() -> List[UserProfile]:
    """
    Retrieve all active users across
    the organization.

    User profiles should expose the latest
    leave balance calculated by the backend.
    """

    db = get_db()

    cursor = (
        db.users
        .find(
            {
                "is_active": True
            }
        )
        .sort(
            "full_name",
            1,
        )
    )

    employees = await cursor.to_list(
        length=1000
    )

    return [
        await _doc_to_profile(emp)
        for emp in employees
    ]


async def get_all_managers() -> List[UserProfile]:
    """
    Retrieve all active managers.
    """

    db = get_db()

    cursor = (
        db.users
        .find(
            {
                "role": "manager",
                "is_active": True,
            }
        )
        .sort(
            "full_name",
            1,
        )
    )

    managers = await cursor.to_list(
        length=1000
    )

    return [
        await _doc_to_profile(mgr)
        for mgr in managers
    ]


# ============================================================
# ORGANIZATIONAL LEAVES
# ============================================================


async def get_organizational_leaves(
    employee_id: Optional[str] = None,
    manager_id: Optional[str] = None,
    status: Optional[str] = None,
    leave_type: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> LeaveListResponse:
    """
    Retrieve all leave requests with
    filtering and pagination.
    """

    db = get_db()

    query: Dict[str, Any] = {}

    # ========================================================
    # EMPLOYEE FILTER
    # ========================================================

    if employee_id:

        try:

            query["$or"] = [
                {
                    "employee_id":
                        employee_id
                },
                {
                    "employee_id":
                        ObjectId(
                            employee_id
                        )
                },
            ]

        except Exception:

            query[
                "employee_id"
            ] = employee_id

    # ========================================================
    # MANAGER FILTER
    # ========================================================

    if manager_id:

        try:

            query["$or"] = [
                {
                    "manager_id":
                        manager_id
                },
                {
                    "manager_id":
                        ObjectId(
                            manager_id
                        )
                },
            ]

        except Exception:

            query[
                "manager_id"
            ] = manager_id

    # ========================================================
    # OTHER FILTERS
    # ========================================================

    if status:
        query[
            "status"
        ] = status

    if leave_type:
        query[
            "leave_type"
        ] = leave_type

    # ========================================================
    # COUNT
    # ========================================================

    total = (
        await db.leave_requests.count_documents(
            query
        )
    )

    # ========================================================
    # PAGINATION
    # ========================================================

    skip = (
        (page - 1)
        * limit
    )

    cursor = (
        db.leave_requests
        .find(query)
        .sort(
            "created_at",
            -1,
        )
        .skip(skip)
        .limit(limit)
    )

    leaves = await cursor.to_list(
        length=limit
    )

    from app.services.leave_service import (
        _enrich_leaves_with_employee_names
    )

    items = (
        await _enrich_leaves_with_employee_names(
            leaves,
            db,
        )
    )

    return LeaveListResponse(
        items=items,
        total=total,
    )


# ============================================================
# HR STATISTICS
# ============================================================


async def get_leave_statistics() -> HRDashboardStats:
    """
    Compute aggregate leave statistics
    for the HR dashboard.
    """

    db = get_db()

    total_employees = (
        await db.users.count_documents(
            {
                "role": "employee",
                "is_active": True,
            }
        )
    )

    total_managers = (
        await db.users.count_documents(
            {
                "role": "manager",
                "is_active": True,
            }
        )
    )

    total_requests = (
        await db.leave_requests.count_documents(
            {}
        )
    )

    pending_requests = (
        await db.leave_requests.count_documents(
            {
                "status": "pending"
            }
        )
    )

    approved_requests = (
        await db.leave_requests.count_documents(
            {
                "status": "approved"
            }
        )
    )

    rejected_requests = (
        await db.leave_requests.count_documents(
            {
                "status": "rejected"
            }
        )
    )

    # ========================================================
    # LEAVE DISTRIBUTION
    # ========================================================

    annual_count = (
        await db.leave_requests.count_documents(
            {
                "leave_type": {
                    "$in": [
                        "annual",
                        "vacation",
                    ]
                }
            }
        )
    )

    sick_count = (
        await db.leave_requests.count_documents(
            {
                "leave_type":
                    "sick"
            }
        )
    )

    casual_count = (
        await db.leave_requests.count_documents(
            {
                "leave_type": {
                    "$in": [
                        "casual",
                        "personal",
                    ]
                }
            }
        )
    )

    unpaid_count = (
        await db.leave_requests.count_documents(
            {
                "leave_type":
                    "unpaid"
            }
        )
    )

    distribution = (
        LeaveTypeDistribution(
            annual=annual_count,
            sick=sick_count,
            casual=casual_count,
            unpaid=unpaid_count,
        )
    )

    return HRDashboardStats(
        total_employees=
            total_employees,

        total_managers=
            total_managers,

        total_requests=
            total_requests,

        pending_requests=
            pending_requests,

        approved_requests=
            approved_requests,

        rejected_requests=
            rejected_requests,

        leave_type_distribution=
            distribution,
    )


# ============================================================
# LEAVE POLICY CONFIGURATION
# ============================================================


async def get_leave_policies() -> Dict[str, Any]:
    """
    Get the organization's current
    leave policy configuration.

    If no policy exists yet, create
    a default configuration.
    """

    db = get_db()

    policy = (
        await db.leave_policies.find_one(
            {
                "organization_id":
                    "default"
            }
        )
    )

    # ========================================================
    # CREATE DEFAULT POLICY
    # ========================================================

    if not policy:

        policy = {
            "organization_id":
                "default",

            "region":
                "India",

            "annual_leave":
                20,

            "sick_leave":
                12,

            "casual_leave":
                6,

            "manager_approval_days":
                2,

            "hr_direct_approval_days":
                6,

            "updated_at":
                datetime.utcnow(),
        }

        await db.leave_policies.insert_one(
            policy
        )

    # ========================================================
    # REMOVE MONGO ID
    # ========================================================

    policy.pop(
        "_id",
        None,
    )

    # ========================================================
    # SERIALIZE DATE
    # ========================================================

    if policy.get(
        "updated_at"
    ):

        policy[
            "updated_at"
        ] = (
            policy[
                "updated_at"
            ].isoformat()
        )

    return policy


async def update_leave_policies(
    data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Update organization-wide
    leave policy configuration.
    """

    db = get_db()

    update_data = {
        "annual_leave":
            float(
                data[
                    "annual_leave"
                ]
            ),

        "sick_leave":
            float(
                data[
                    "sick_leave"
                ]
            ),

        "casual_leave":
            float(
                data[
                    "casual_leave"
                ]
            ),

        "manager_approval_days":
            int(
                data[
                    "manager_approval_days"
                ]
            ),

        "hr_direct_approval_days":
            int(
                data[
                    "hr_direct_approval_days"
                ]
            ),

        "updated_at":
            datetime.utcnow(),
    }

    await db.leave_policies.update_one(
        {
            "organization_id":
                "default"
        },

        {
            "$set":
                update_data,

            "$setOnInsert": {
                "organization_id":
                    "default",

                "region":
                    "India",
            },
        },

        upsert=True,
    )

    # ========================================================
    # SYNC ACCRUAL POLICY DOCUMENTS
    # ========================================================
    #
    # Employee balances are computed by AccrualService from the
    # `policies` collection, not from `leave_policies`. Propagate
    # the new org-wide numbers there so dashboards reflect the
    # change. The simple HR form defines one flat entitlement per
    # leave type, which supersedes tenure bands; existing bands
    # are preserved in `tenure_rules_backup` so they can be
    # restored by a richer policy editor later.

    accrual_sync = [
        ("VACATION", float(data["annual_leave"])),
        ("SICK", float(data["sick_leave"])),
        ("PERSONAL", float(data["casual_leave"])),
    ]

    for leave_type, entitlement in accrual_sync:

        policy_doc = await db.policies.find_one(
            {
                "leave_type": leave_type
            }
        )

        if policy_doc is None:
            continue

        policy_update = {
            "annual_entitlement": entitlement,
        }

        # Never let the balance cap fall below the entitlement.
        current_maximum = (
            policy_doc.get("balance", {}).get("maximum")
        )

        if (
            current_maximum is not None
            and current_maximum < entitlement
        ):
            policy_update["balance.maximum"] = entitlement

        if policy_doc.get("tenure_rules"):
            policy_update["tenure_rules"] = []
            policy_update["tenure_rules_backup"] = (
                policy_doc["tenure_rules"]
            )

        await db.policies.update_one(
            {
                "_id": policy_doc["_id"]
            },
            {
                "$set": policy_update
            },
        )

    return await get_leave_policies()


# ============================================================
# REGIONAL HOLIDAY CALENDAR
# ============================================================


async def upload_regional_calendar(
    region: str,
    file: UploadFile,
) -> Dict[str, Any]:
    """
    Read an Excel regional holiday
    calendar and store the parsed
    holidays in MongoDB.

    Expected Excel columns:

        Date
        Holiday Name
    """

    # ========================================================
    # OPENPYXL
    # ========================================================

    try:

        from openpyxl import (
            load_workbook
        )

    except ImportError:

        raise HTTPException(
            status_code=500,
            detail=(
                "openpyxl is not installed. "
                "Run: pip install openpyxl"
            ),
        )

    # ========================================================
    # READ FILE
    # ========================================================

    try:

        contents = (
            await file.read()
        )

        workbook = load_workbook(
            filename=BytesIO(
                contents
            ),
            data_only=True,
        )

        worksheet = (
            workbook.active
        )

        rows = list(
            worksheet.iter_rows(
                values_only=True
            )
        )

        if not rows:

            raise HTTPException(
                status_code=400,
                detail=(
                    "The Excel file is empty."
                ),
            )

        # ====================================================
        # READ HEADERS
        # ====================================================

        headers = [
            (
                str(value)
                .strip()
                .lower()
                if value is not None
                else ""
            )
            for value in rows[0]
        ]

        date_index = None
        name_index = None

        # ====================================================
        # FIND COLUMNS
        # ====================================================

        for index, header in enumerate(
            headers
        ):

            if header in {
                "date",
                "holiday date",
                "holiday_date",
            }:

                date_index = index

            if header in {
                "holiday",
                "holiday name",
                "holiday_name",
                "name",
            }:

                name_index = index

        # ====================================================
        # VALIDATE COLUMNS
        # ====================================================

        if date_index is None:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Excel must contain "
                    "a 'Date' column."
                ),
            )

        if name_index is None:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Excel must contain "
                    "a 'Holiday Name' column."
                ),
            )

        # ====================================================
        # PARSE HOLIDAYS
        # ====================================================

        holidays = []

        for row in rows[1:]:

            if not row:
                continue

            holiday_date = (
                row[date_index]
                if date_index <
                len(row)
                else None
            )

            holiday_name = (
                row[name_index]
                if name_index <
                len(row)
                else None
            )

            if (
                not holiday_date
                or not holiday_name
            ):
                continue

            # ------------------------------------------------
            # EXCEL DATETIME
            # ------------------------------------------------

            if hasattr(
                holiday_date,
                "date",
            ):

                holiday_date = (
                    holiday_date.date()
                )

            # ------------------------------------------------
            # PYTHON DATE
            # ------------------------------------------------

            if hasattr(
                holiday_date,
                "isoformat",
            ):

                holiday_date = (
                    holiday_date.isoformat()
                )

            else:

                holiday_date = str(
                    holiday_date
                )

            holidays.append(
                {
                    "date":
                        holiday_date,

                    "name":
                        str(
                            holiday_name
                        ).strip(),
                }
            )

        # ====================================================
        # VALIDATE DATA
        # ====================================================

        if not holidays:

            raise HTTPException(
                status_code=400,
                detail=(
                    "No valid holiday records "
                    "were found in the Excel file."
                ),
            )

        # ====================================================
        # DETERMINE YEAR
        # ====================================================

        try:

            year = int(
                holidays[0][
                    "date"
                ][:4]
            )

        except Exception:

            year = (
                datetime.utcnow().year
            )

        # ====================================================
        # SAVE TO MONGODB
        # ====================================================

        db = get_db()

        calendar_doc = {
            "region":
                region,

            "year":
                year,

            "filename":
                file.filename,

            "holidays":
                holidays,

            "holiday_count":
                len(holidays),

            "updated_at":
                datetime.utcnow(),
        }

        await db.regional_calendars.update_one(
            {
                "region":
                    region,

                "year":
                    year,
            },

            {
                "$set":
                    calendar_doc
            },

            upsert=True,
        )

        # ====================================================
        # RESPONSE
        # ====================================================

        return {
            "success":
                True,

            "message":
                (
                    f"{len(holidays)} holidays "
                    "uploaded successfully."
                ),

            "region":
                region,

            "year":
                year,

            "holiday_count":
                len(holidays),

            "filename":
                file.filename,
        }

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to process Excel "
                f"file: {exc}"
            ),
        )