"""
Auth router — registration, login, and profile endpoints.

Prefix: /api/v1/auth
"""

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.schemas.user import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserProfile,
)
from app.services.auth_service import register_user, login_user, _doc_to_profile

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


from fastapi.security import OAuth2PasswordRequestForm


@router.post("/register", response_model=UserProfile, status_code=201)
async def register(data: UserRegister):
    """
    Register a new user account.

    Requires a unique email and employee_id. Password is hashed
    with bcrypt before storage.
    """
    return await register_user(data)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """
    Authenticate and receive a JWT access token via JSON.

    The token should be sent in subsequent requests as:
    `Authorization: Bearer <token>`
    """
    return await login_user(data)


@router.post("/token", response_model=TokenResponse, summary="OAuth2 Token Login (for Swagger UI Authorize button)")
async def token_login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 compatible token login for Swagger UI Authorize button.
    Accepts application/x-www-form-urlencoded form data with username and password.
    """
    return await login_user(UserLogin(email=form_data.username, password=form_data.password))


@router.get("/me", response_model=UserProfile)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile and leave balances."""
    return await _doc_to_profile(current_user)
