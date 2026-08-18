"""
FastAPI dependency injection — auth guards and role checks.

These are used as `Depends(...)` in route handlers to extract the
current user and enforce role-based access control.
"""

# pyrefly: ignore [missing-import]
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_access_token
from app.core.database import get_db

# OAuth2 scheme — expects "Authorization: Bearer <token>" header.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Extract and validate the current user from the JWT token.

    Returns the raw MongoDB user document (dict) with _id included.
    Raises 401 if the token is invalid or the user doesn't exist.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        db = get_db()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise credentials_exception

    if user is None:
        raise credentials_exception

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


def require_role(*allowed_roles: str):
    """
    Factory that returns a dependency checking the user's role.

    Usage in a route:
        @router.get("/team", dependencies=[Depends(require_role("manager", "admin"))])

    Or inject the user directly:
        async def handler(user: dict = Depends(require_role("manager"))):
    """
    async def _check_role(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of these roles: {', '.join(allowed_roles)}.",
            )
        return current_user

    return _check_role
