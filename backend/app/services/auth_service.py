"""
Auth service — registration and login business logic.

Uses Motor (PyMongo async) directly for all database operations, compatible with LMS database schema.
"""

import logging
from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException, status

from app.core.database import get_db

logger = logging.getLogger(__name__)
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import UserInDB, LeaveBalance
from app.schemas.user import UserRegister, UserLogin, TokenResponse, UserProfile, LeaveBalanceResponse


async def register_user(data: UserRegister) -> UserProfile:
    """
    Register a new user.
    """
    db = get_db()

    # Check for existing email.
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    # Check for existing employee ID.
    existing = await db.users.find_one({"employee_id": data.employee_id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this employee ID already exists.",
        )

    # Build the user document.
    user = UserInDB(
        employee_id=data.employee_id,
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=data.role,
        department=data.department,
        manager_id=data.manager_id,
        leave_balances=LeaveBalance(),
    )

    result = await db.users.insert_one(user.to_doc())
    user_doc = await db.users.find_one({"_id": result.inserted_id})
    return await _doc_to_profile(user_doc)


async def login_user(data: UserLogin) -> TokenResponse:
    """
    Authenticate a user and return a JWT token.
    Supports email or employee_id lookup against LMS.users.
    """
    db = get_db()

    identifier = data.email.strip()

    # Debug: check what DB and collection we're hitting
    user_count = await db.users.count_documents({})
    sample = await db.users.find_one()
    logger.info("LOGIN DEBUG — db=%s, users count=%d, sample email=%s, looking for=%s",
                db.name, user_count,
                sample.get("email") if sample else "NO DOCS",
                identifier)

    user_doc = await db.users.find_one({
        "$or": [
            {"email": identifier.lower()},
            {"email": identifier},
            {"employee_id": identifier},
            {"employee_id": identifier.upper()},
        ]
    })
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/employee ID or password.",
        )

    stored_hash = user_doc.get("password_hash") or user_doc.get("hashed_password") or ""
    # If hash is set and starts with $2 (bcrypt), verify it; if blank in demo DB, accept password
    if stored_hash and stored_hash.startswith("$2"):
        if not verify_password(data.password, stored_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    # Create JWT with user role embedded.
    token = create_access_token(
        subject=str(user_doc["_id"]),
        extra_claims={"role": user_doc["role"]},
    )

    profile = await _doc_to_profile(user_doc)

    return TokenResponse(
        access_token=token,
        user=profile,
    )


async def _doc_to_profile(doc: dict) -> UserProfile:
    """Convert a MongoDB user document (dict) to a UserProfile response."""
    db = get_db()
    
    balances = doc.get("leave_balances")
    if not balances:
        # Check LMS.leave_balances collection
        bal_doc = await db.leave_balances.find_one({"user_id": doc["_id"]})
        if not bal_doc and isinstance(doc.get("_id"), str):
            try:
                bal_doc = await db.leave_balances.find_one({"user_id": ObjectId(doc["_id"])})
            except Exception:
                pass
        
        if bal_doc and "balances" in bal_doc:
            b = bal_doc["balances"]
            vac = b.get("vacation", {})
            sk = b.get("sick", {})
            per = b.get("personal", {})
            
            annual_val = int(vac.get("remaining") if vac.get("remaining") is not None else (vac.get("total") or 20))
            sick_val = int(sk.get("remaining") if sk.get("remaining") is not None else (sk.get("total") or 12))
            casual_val = int(per.get("remaining") if per.get("remaining") is not None else (per.get("total") or 6))
            
            balances = LeaveBalanceResponse(
                annual=annual_val,
                sick=sick_val,
                casual=casual_val,
                unpaid=0
            )
        else:
            balances = LeaveBalanceResponse(annual=20, sick=12, casual=6, unpaid=0)
    elif isinstance(balances, dict):
        balances = LeaveBalanceResponse(
            annual=balances.get("annual", 20),
            sick=balances.get("sick", 12),
            casual=balances.get("casual", 6),
            unpaid=balances.get("unpaid", 0),
        )

    mgr_id = doc.get("manager_id")
    if mgr_id is not None:
        mgr_id = str(mgr_id)

    created_at_val = doc.get("created_at") or doc.get("date_of_joining") or datetime.utcnow()

    return UserProfile(
        id=str(doc["_id"]),
        employee_id=doc.get("employee_id", ""),
        email=doc.get("email", ""),
        full_name=doc.get("full_name", ""),
        role=doc.get("role", "employee"),
        department=doc.get("department", "General"),
        manager_id=mgr_id,
        leave_balances=balances,
        is_active=doc.get("is_active", True),
        created_at=created_at_val,
    )
