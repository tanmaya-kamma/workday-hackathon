"""
Admin router — seed data and utility endpoints.

Prefix: /api/v1/admin

These endpoints are for development and demo purposes only.
They create sample users so you can test the system without
manual registration.
"""

from fastapi import APIRouter

from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import UserInDB, LeaveBalance

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


@router.post("/seed")
async def seed_demo_data():
    """
    Seed the database with demo users.

    Creates a manager and two employees if they don't already exist.

    **Demo credentials:**
    - Manager: sarah.manager@company.com / manager123
    - Employee 1: john.doe@company.com / employee123
    - Employee 2: jane.smith@company.com / employee123
    """
    db = get_db()
    created = []

    # ---- Manager ----
    manager_doc = await db.users.find_one({"email": "sarah.manager@company.com"})
    if not manager_doc:
        manager = UserInDB(
            employee_id="MGR-001",
            email="sarah.manager@company.com",
            full_name="Sarah Manager",
            hashed_password=hash_password("manager123"),
            role="manager",
            department="Engineering",
            leave_balances=LeaveBalance(),
        )
        result = await db.users.insert_one(manager.to_doc())
        manager_id = str(result.inserted_id)
        created.append("Sarah Manager (manager)")
    else:
        manager_id = str(manager_doc["_id"])

    # ---- Employee 1 ----
    emp1_doc = await db.users.find_one({"email": "john.doe@company.com"})
    if not emp1_doc:
        emp1 = UserInDB(
            employee_id="EMP-001",
            email="john.doe@company.com",
            full_name="John Doe",
            hashed_password=hash_password("employee123"),
            role="employee",
            department="Engineering",
            manager_id=manager_id,
            leave_balances=LeaveBalance(),
        )
        await db.users.insert_one(emp1.to_doc())
        created.append("John Doe (employee)")

    # ---- Employee 2 ----
    emp2_doc = await db.users.find_one({"email": "jane.smith@company.com"})
    if not emp2_doc:
        emp2 = UserInDB(
            employee_id="EMP-002",
            email="jane.smith@company.com",
            full_name="Jane Smith",
            hashed_password=hash_password("employee123"),
            role="employee",
            department="Engineering",
            manager_id=manager_id,
            leave_balances=LeaveBalance(),
        )
        await db.users.insert_one(emp2.to_doc())
        created.append("Jane Smith (employee)")

    # ---- HR User ----
    hr_doc = await db.users.find_one({"email": "helen.hr@company.com"})
    if not hr_doc:
        hr_user = UserInDB(
            employee_id="HR-001",
            email="helen.hr@company.com",
            full_name="Helen HR",
            hashed_password=hash_password("hr123"),
            role="hr",
            department="People Ops",
            leave_balances=LeaveBalance(),
        )
        await db.users.insert_one(hr_user.to_doc())
        created.append("Helen HR (hr)")

    if not created:
        return {"message": "Demo data already exists. No changes made."}

    return {
        "message": f"Created {len(created)} demo user(s).",
        "users_created": created,
        "credentials": {
            "hr": {"email": "helen.hr@company.com", "password": "hr123"},
            "manager": {"email": "sarah.manager@company.com", "password": "manager123"},
            "employee_1": {"email": "john.doe@company.com", "password": "employee123"},
            "employee_2": {"email": "jane.smith@company.com", "password": "employee123"},
        },
    }
