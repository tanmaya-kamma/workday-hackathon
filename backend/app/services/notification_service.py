"""
Notification service — create and manage in-app notifications.

Uses Motor (PyMongo async) directly for all database operations.
"""

import logging

# pyrefly: ignore [missing-import]
from bson import ObjectId

from app.core.database import get_db
from app.models.notification import NotificationInDB

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Create notifications (called by leave_service)
# ---------------------------------------------------------------------------

async def notify_leave_submitted(leave_doc: dict, employee: dict) -> None:
    """Notify the manager that a new leave request was submitted."""
    try:
        db = get_db()
        notification = NotificationInDB(
            user_id=leave_doc["manager_id"],
            title="New Leave Request",
            message=(
                f"{employee['full_name']} has applied for {leave_doc['total_days']} day(s) "
                f"of {leave_doc['leave_type']} leave "
                f"({leave_doc['start_date']} to {leave_doc['end_date']})."
            ),
            type="leave_request",
            reference_id=str(leave_doc["_id"]),
        )
        await db.notifications.insert_one(notification.to_doc())
    except Exception as exc:
        logger.error("Failed to create leave_submitted notification: %s", exc)


async def notify_leave_approved(leave_doc: dict, *args, **kwargs) -> None:
    """Notify the employee that their leave was approved."""
    try:
        db = get_db()
        remarks_text = f" Remarks: {leave_doc.get('manager_remarks')}" if leave_doc.get("manager_remarks") else ""
        notification = NotificationInDB(
            user_id=leave_doc["employee_id"],
            title="Leave Approved",
            message=(
                f"Your {leave_doc['leave_type']} leave request for "
                f"{leave_doc['start_date']} to {leave_doc['end_date']} has been approved."
                + remarks_text
            ),
            type="leave_approved",
            reference_id=str(leave_doc["_id"]),
        )
        await db.notifications.insert_one(notification.to_doc())
    except Exception as exc:
        logger.error("Failed to create leave_approved notification: %s", exc)


async def notify_leave_rejected(leave_doc: dict, *args, **kwargs) -> None:
    """Notify the employee that their leave was rejected."""
    try:
        db = get_db()
        remarks_text = f" Reason: {leave_doc.get('manager_remarks')}" if leave_doc.get("manager_remarks") else ""
        notification = NotificationInDB(
            user_id=leave_doc["employee_id"],
            title="Leave Rejected",
            message=(
                f"Your {leave_doc['leave_type']} leave request for "
                f"{leave_doc['start_date']} to {leave_doc['end_date']} has been rejected."
                + remarks_text
            ),
            type="leave_rejected",
            reference_id=str(leave_doc["_id"]),
        )
        await db.notifications.insert_one(notification.to_doc())
    except Exception as exc:
        logger.error("Failed to create leave_rejected notification: %s", exc)


# ---------------------------------------------------------------------------
# Query notifications (called by routers)
# ---------------------------------------------------------------------------

async def get_user_notifications(user_id: str) -> dict:
    """Fetch all notifications for a user, sorted newest first."""
    db = get_db()

    cursor = db.notifications.find({"user_id": user_id}).sort("created_at", -1)
    notifications = await cursor.to_list(length=200)

    unread_count = sum(1 for n in notifications if not n.get("is_read", False))

    items = [
        {
            "id": str(n["_id"]),
            "title": n["title"],
            "message": n["message"],
            "type": n["type"],
            "is_read": n.get("is_read", False),
            "reference_id": n.get("reference_id"),
            "created_at": n["created_at"],
        }
        for n in notifications
    ]

    return {
        "items": items,
        "total": len(items),
        "unread_count": unread_count,
    }


async def mark_notification_read(notification_id: str, user_id: str) -> bool:
    """Mark a single notification as read. Returns True if successful."""
    db = get_db()

    try:
        result = await db.notifications.update_one(
            {"_id": ObjectId(notification_id), "user_id": user_id},
            {"$set": {"is_read": True}},
        )
        return result.modified_count > 0
    except Exception:
        return False


async def mark_all_notifications_read(user_id: str) -> int:
    """Mark all of a user's notifications as read. Returns count updated."""
    db = get_db()

    result = await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}},
    )
    return result.modified_count
