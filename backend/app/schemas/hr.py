"""
HR schemas — request and response validation models for HR dashboard.
"""

from datetime import datetime
from fastapi.openapi.models import EmailStr
from typing import Optional
from typing import Dict
from pydantic import BaseModel, Field


class LeaveTypeDistribution(BaseModel):
    """Distribution of leaves by type (e.g. annual, sick, casual, unpaid)."""
    annual: int = 0
    sick: int = 0
    casual: int = 0
    unpaid: int = 0


class HRDashboardStats(BaseModel):
    """Statistics shown on the HR administrator dashboard."""
    total_employees: int = Field(..., description="Total count of active employees.")
    total_managers: int = Field(..., description="Total count of active managers.")
    total_requests: int = Field(..., description="Total count of leave requests in system.")
    pending_requests: int = Field(..., description="Count of requests waiting for manager approval.")
    approved_requests: int = Field(..., description="Count of approved leave requests.")
    rejected_requests: int = Field(..., description="Count of rejected leave requests.")
    leave_type_distribution: LeaveTypeDistribution = Field(
        default_factory=LeaveTypeDistribution,
        description="Distribution of all requests by leave type."
    )


class CreateEmployeeRequest(BaseModel):
    """Schema for HR adding an employee."""
    employee_id: Optional[str] = Field(None, examples=["EMP019"])
    email: EmailStr = Field(..., examples=["new.employee@company.com"])
    full_name: str = Field(..., min_length=2, max_length=100, examples=["Ananya Sharma"])
    password: Optional[str] = Field("password123", min_length=6)
    role: str = Field("employee", pattern="^(employee|manager|hr)$")
    department: str = Field("Engineering")
    region: str = Field("IN", pattern="^(IN|US|UK)$")
    manager_id: Optional[str] = Field(None)
    date_of_joining: Optional[datetime] = None
    annual_leave: Optional[int] = 20
    sick_leave: Optional[int] = 12
    casual_leave: Optional[int] = 6

