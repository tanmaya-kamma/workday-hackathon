"""
User schemas — request and response models for auth endpoints.

These are separate from the Beanie Document models. Documents define
what's stored in MongoDB; schemas define what the API accepts and returns.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Embedded response models
# ---------------------------------------------------------------------------

class LeaveBalanceResponse(BaseModel):
    """Leave balance breakdown returned in user profile."""
    annual: int = 20
    sick: int = 12
    casual: int = 6
    unpaid: int = 0


# ---------------------------------------------------------------------------
# Auth request schemas
# ---------------------------------------------------------------------------

class UserRegister(BaseModel):
    """POST /auth/register request body."""
    employee_id: str = Field(..., min_length=1, max_length=20, examples=["EMP-001"])
    email: EmailStr = Field(..., examples=["john.doe@company.com"])
    full_name: str = Field(..., min_length=1, max_length=100, examples=["John Doe"])
    password: str = Field(..., min_length=6, max_length=128, examples=["securepass123"])
    role: str = Field(
        default="employee",
        pattern="^(employee|manager|hr|admin)$",
        examples=["employee"],
        description="User role: employee, manager, hr, or admin.",
    )
    department: str = Field(default="General", examples=["Engineering"])
    manager_id: Optional[str] = Field(default=None, examples=[None])


class UserLogin(BaseModel):
    """POST /auth/login request body (supports Email or Employee ID)."""
    email: str = Field(..., min_length=1, examples=["john.doe@company.com", "EMP-001"], description="User email or Employee ID")
    password: str = Field(..., examples=["securepass123"])


# ---------------------------------------------------------------------------
# Auth response schemas
# ---------------------------------------------------------------------------

class TokenResponse(BaseModel):
    """Response returned after successful login."""
    access_token: str
    token_type: str = "bearer"
    user: "UserProfile"


class UserProfile(BaseModel):
    """User profile data returned by GET /auth/me and in token response."""
    id: str
    employee_id: str
    email: str
    full_name: str
    role: str
    department: str
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    leave_balances: LeaveBalanceResponse
    is_active: bool
    created_at: datetime


# Rebuild model to resolve forward reference.
TokenResponse.model_rebuild()
