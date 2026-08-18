"""
Jira leave-impact router.

Prefix: /api/v1/jira

Provides read-only Jira workload data for manager review of leave requests.
This router does NOT write to Jira or modify any leave state.
"""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import require_role
from app.core.database import get_db
from app.services import jira_service


router = APIRouter(prefix="/api/v1/jira", tags=["Jira Integration"])


@router.get("/health", summary="Verify Jira connectivity")
async def jira_health(
    _manager: dict = Depends(require_role("manager", "hr", "admin")),
) -> dict[str, Any]:
    """Return whether the Jira credentials are valid and reachable."""
    return await jira_service.test_jira_connection()


@router.get(
    "/leave-impact",
    summary="Jira workload analysis for a leave period",
)
async def leave_impact(
    employee_name: str = Query(..., description="Employee full name"),
    employee_email: str = Query(default="", description="Employee email (improves matching)"),
    start_date: date = Query(..., description="Leave start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Leave end date (YYYY-MM-DD)"),
    manager: dict = Depends(require_role("manager", "hr", "admin")),
) -> dict[str, Any]:
    """
    Return Jira issues assigned to the employee that overlap with their leave.

    Accessible by managers, HR, and admins only.
    Safe for display: credentials are never included in the response.
    """
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date.")

    email = employee_email
    if not email:
        db = get_db()
        user_doc = await db.users.find_one({"full_name": employee_name})
        if user_doc:
            email = user_doc.get("email", "")

    employee: dict[str, Any] = {"full_name": employee_name}
    if email:
        employee["email"] = email

    return await jira_service.analyze_leave_impact(employee, start_date, end_date)


@router.get(
    "/list-link",
    summary="Jira board/list URL for an employee",
)
async def employee_list_link(
    employee_name: str = Query(..., description="Employee full name"),
    employee_email: str = Query(default="", description="Employee email (improves matching)"),
    manager: dict = Depends(require_role("manager", "hr", "admin")),
) -> dict[str, Any]:
    """
    Return the Jira List-view URL scoped to the given employee.

    The URL is assembled from the Jira base URL and the resolved account ID;
    no credentials are included in the response.
    """
    email = employee_email
    if not email:
        db = get_db()
        user_doc = await db.users.find_one({"full_name": employee_name})
        if user_doc:
            email = user_doc.get("email", "")

    employee: dict[str, Any] = {"full_name": employee_name}
    if email:
        employee["email"] = email

    return await jira_service.get_employee_jira_list_link(employee)
