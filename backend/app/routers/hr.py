"""
HR router — endpoints for administrative organizational visibility.

Prefix: /api/v1/hr
"""

from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    Query,
    UploadFile,
    File,
    HTTPException,
)
from pydantic import BaseModel, Field

from app.core.dependencies import require_role
from app.schemas.user import UserProfile
from app.schemas.leave import LeaveListResponse
from app.schemas.hr import HRDashboardStats, CreateEmployeeRequest
from app.services import hr_service


router = APIRouter(
    prefix="/api/v1/hr",
    tags=["HR Administration"],
)


# ============================================================
# POLICY SCHEMA
# ============================================================


class LeavePolicyUpdate(BaseModel):
    annual_leave: float = Field(ge=0)
    sick_leave: float = Field(ge=0)
    casual_leave: float = Field(ge=0)

    manager_approval_days: int = Field(
        ge=1
    )

    hr_direct_approval_days: int = Field(
        ge=1
    )


# ============================================================
# EMPLOYEES
# ============================================================


@router.post(
    "/employees",
    response_model=UserProfile,
    status_code=201,
)
async def create_employee(
    data: CreateEmployeeRequest,
    hr_user: dict = Depends(
        require_role("hr", "admin")
    ),
):
    """
    Add a new employee to LMS.users and
    initialize LMS.leave_balances in MongoDB.

    Only accessible by HR or Admin roles.
    """

    return await hr_service.create_employee(data)


@router.get(
    "/employees",
    response_model=List[UserProfile],
)
async def get_employees(
    current_user: dict = Depends(
        require_role(
            "manager",
            "hr",
            "admin",
        )
    ),
):
    """
    Get all active employees in the organization.

    Accessible by Manager, HR, or Admin roles.
    """

    return await hr_service.get_all_employees()


@router.get(
    "/managers",
    response_model=List[UserProfile],
)
async def get_managers(
    current_user: dict = Depends(
        require_role(
            "manager",
            "hr",
            "admin",
        )
    ),
):
    """
    Get all active managers in the organization.

    Accessible by Manager, HR, or Admin roles.
    """

    return await hr_service.get_all_managers()


# ============================================================
# ORGANIZATIONAL LEAVES
# ============================================================


@router.get(
    "/leaves",
    response_model=LeaveListResponse,
)
async def get_organizational_leaves(
    employee_id: Optional[str] = Query(
        None,
        description="Filter by employee user ID",
    ),
    manager_id: Optional[str] = Query(
        None,
        description="Filter by manager user ID",
    ),
    status: Optional[str] = Query(
        None,
        description=(
            "Filter by request status "
            "(pending/pending_hr/approved/rejected/cancelled)"
        ),
    ),
    leave_type: Optional[str] = Query(
        None,
        description="Filter by leave type",
    ),
    page: int = Query(
        1,
        ge=1,
        description="Page number",
    ),
    limit: int = Query(
        20,
        ge=1,
        le=100,
        description="Items per page",
    ),
    hr_user: dict = Depends(
        require_role("hr", "admin")
    ),
):
    """
    Get organizational leave requests
    with filtering and pagination.

    Only accessible by HR or Admin roles.
    """

    return await hr_service.get_organizational_leaves(
        employee_id=employee_id,
        manager_id=manager_id,
        status=status,
        leave_type=leave_type,
        page=page,
        limit=limit,
    )


# ============================================================
# HR STATISTICS
# ============================================================


@router.get(
    "/statistics",
    response_model=HRDashboardStats,
)
async def get_statistics(
    hr_user: dict = Depends(
        require_role("hr", "admin")
    ),
):
    """
    Get organizational leave metrics
    and statistics.
    """

    return await hr_service.get_leave_statistics()


# ============================================================
# LEAVE POLICY
# ============================================================


@router.get("/policies")
async def get_leave_policies(
    hr_user: dict = Depends(
        require_role("hr", "admin")
    ),
):
    """
    Get the organization's current
    leave policy configuration.
    """

    return await hr_service.get_leave_policies()


@router.put("/policies")
async def update_leave_policies(
    data: LeavePolicyUpdate,
    hr_user: dict = Depends(
        require_role("hr", "admin")
    ),
):
    """
    Update organization-wide leave
    policy configuration.
    """

    return await hr_service.update_leave_policies(
        data.model_dump()
    )


# ============================================================
# REGIONAL HOLIDAY CALENDAR
# ============================================================


@router.post("/regional-calendar")
async def upload_regional_calendar(
    region: str = Query(
        ...,
        min_length=1,
        description="Regional calendar name",
    ),
    file: UploadFile = File(...),
    hr_user: dict = Depends(
        require_role("hr", "admin")
    ),
):
    """
    Upload an Excel regional holiday
    calendar and store parsed holidays
    in MongoDB.
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    if not file.filename.lower().endswith(
        ".xlsx"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload an Excel "
                ".xlsx file."
            ),
        )

    return await hr_service.upload_regional_calendar(
        region=region.strip(),
        file=file,
    )