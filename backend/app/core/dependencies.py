"""
FastAPI dependency injection — auth guards and role checks.

These are used as Depends(...) in route handlers to extract the
current user and enforce role-based access control.
"""

# pyrefly: ignore [missing-import]
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_access_token
from app.core.database import get_db


# ---------------------------------------------------------------------------
# OAuth2 configuration
# ---------------------------------------------------------------------------
#
# IMPORTANT:
# /login accepts JSON (UserLogin).
# /token accepts OAuth2PasswordRequestForm and is therefore the endpoint
# Swagger UI must use for the OAuth2 Authorize button.
#
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/token"
)


# ---------------------------------------------------------------------------
# CURRENT USER
# ---------------------------------------------------------------------------

async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> dict:
    """
    Extract and validate the current user from the JWT token.

    Returns:
        Raw MongoDB user document.

    Raises:
        401 if the token is invalid, expired, or the user does not exist.
        403 if the user account is deactivated.
    """

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    # ------------------------------------------------------------------
    # Decode JWT
    # ------------------------------------------------------------------

    payload = decode_access_token(token)

    if payload is None:
        raise credentials_exception

    # ------------------------------------------------------------------
    # Extract subject / user ID
    # ------------------------------------------------------------------

    user_id: str | None = payload.get("sub")

    if user_id is None:
        raise credentials_exception

    # ------------------------------------------------------------------
    # Validate ObjectId
    # ------------------------------------------------------------------

    if not ObjectId.is_valid(user_id):
        raise credentials_exception

    # ------------------------------------------------------------------
    # Fetch user
    # ------------------------------------------------------------------

    try:
        db = get_db()

        user = await db.users.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

    except Exception:
        raise credentials_exception

    if user is None:
        raise credentials_exception

    # ------------------------------------------------------------------
    # Active account check
    # ------------------------------------------------------------------

    if not user.get("is_active", True):

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


# ---------------------------------------------------------------------------
# ROLE AUTHORIZATION
# ---------------------------------------------------------------------------

def require_role(*allowed_roles: str):
    """
    Factory that returns a dependency checking the user's role.

    Example:

        @router.get(
            "/team",
            dependencies=[
                Depends(
                    require_role("manager", "hr")
                )
            ],
        )

    Or:

        async def handler(
            user: dict = Depends(
                require_role("manager")
            )
        ):
            ...
    """

    async def _check_role(
        current_user: dict = Depends(
            get_current_user
        ),
    ) -> dict:

        if current_user.get("role") not in allowed_roles:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "This action requires one of these roles: "
                    + ", ".join(allowed_roles)
                    + "."
                ),
            )

        return current_user

    return _check_role