"""
HR router — endpoints for administrative organizational visibility.

Prefix: /api/v1/hr
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_role
from app.schemas.user import UserProfile
from app.schemas.leave import LeaveListResponse
from app.schemas.hr import HRDashboardStats, CreateEmployeeRequest
from app.services import hr_service

router = APIRouter(prefix="/api/v1/hr", tags=["HR Administration"])


@router.post("/employees", response_model=UserProfile, status_code=201)
async def create_employee(
    data: CreateEmployeeRequest,
    hr_user: dict = Depends(require_role("hr", "admin")),
):
    """
    Add a new employee to LMS.users and initialize LMS.leave_balances in MongoDB.
    Only accessible by HR or Admin roles.
    """
    return await hr_service.create_employee(data)


@router.get("/employees", response_model=List[UserProfile])
async def get_employees(
    current_user: dict = Depends(require_role("manager", "hr", "admin")),
):
    """
    Get all active employees in the organization.
    Accessible by Manager, HR, or Admin roles.
    """
    return await hr_service.get_all_employees()


@router.get("/managers", response_model=List[UserProfile])
async def get_managers(
    current_user: dict = Depends(require_role("manager", "hr", "admin")),
):
    """
    Get all active managers in the organization.
    Accessible by Manager, HR, or Admin roles.
    """
    return await hr_service.get_all_managers()


@router.get("/leaves", response_model=LeaveListResponse)
async def get_organizational_leaves(
    employee_id: Optional[str] = Query(None, description="Filter by employee user ID"),
    manager_id: Optional[str] = Query(None, description="Filter by manager user ID"),
    status: Optional[str] = Query(None, description="Filter by request status (pending/approved/rejected/cancelled)"),
    leave_type: Optional[str] = Query(None, description="Filter by leave type"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    hr_user: dict = Depends(require_role("hr", "admin")),
):
    """
    Get organizational leave requests with filtering and pagination.
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


@router.get("/statistics", response_model=HRDashboardStats)
async def get_statistics(
    hr_user: dict = Depends(require_role("hr", "admin")),
):
    """
    Get organizational leave metrics and stats distribution.
    Only accessible by HR or Admin roles.
    """
    return await hr_service.get_leave_statistics()
