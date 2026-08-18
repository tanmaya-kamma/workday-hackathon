"""
Notification service — create and manage in-app notifications.

Uses Motor (PyMongo async) directly for all database operations.

Notification user_id values are stored as strings in MongoDB.
ObjectId references from users/leave_requests are therefore
normalized to strings before creating notifications.
"""

import logging

# pyrefly: ignore [missing-import]
from bson import ObjectId

from app.core.database import get_db
from app.models.notification import NotificationInDB


logger = logging.getLogger(__name__)


# ============================================================================
# INTERNAL HELPERS
# ============================================================================


def _normalize_user_id(value) -> str:
    """
    Normalize a user identifier to the string format used
    by the notifications collection.
    """
    if value is None:
        return ""

    return str(value)


# ============================================================================
# CREATE NOTIFICATIONS
# ============================================================================


async def notify_leave_submitted(
    leave_doc: dict,
    employee: dict,
) -> None:
    """
    Notify the manager that a new leave request was submitted.

    notifications.user_id is stored as a string, so manager_id
    is explicitly converted from ObjectId/string to string.
    """

    try:
        db = get_db()

        manager_id = _normalize_user_id(
            leave_doc.get("manager_id")
        )

        if not manager_id:
            logger.warning(
                "Cannot create leave_submitted notification: "
                "leave request has no manager_id."
            )
            return

        employee_name = (
            employee.get("full_name")
            or employee.get("email")
            or "Employee"
        )

        total_days = leave_doc.get(
            "requested_days",
            leave_doc.get(
                "total_days",
                1,
            ),
        )

        notification = NotificationInDB(
            user_id=manager_id,
            title="New Leave Request",
            message=(
                f"{employee_name} has applied for "
                f"{total_days} day(s) of "
                f"{leave_doc.get('leave_type', 'leave')} leave "
                f"({leave_doc.get('start_date')} to "
                f"{leave_doc.get('end_date')})."
            ),
            type="leave_request",
            reference_id=str(
                leave_doc["_id"]
            ),
        )

        await db.notifications.insert_one(
            notification.to_doc()
        )

        logger.info(
            "Leave submission notification created "
            "for user %s.",
            manager_id,
        )

    except Exception as exc:
        logger.error(
            "Failed to create leave_submitted notification: %s",
            exc,
            exc_info=True,
        )


async def notify_leave_approved(
    leave_doc: dict,
    *args,
    **kwargs,
) -> None:
    """
    Notify the employee that their leave was approved.

    notifications.user_id is stored as a string.
    """

    try:
        db = get_db()

        employee_id = _normalize_user_id(
            leave_doc.get("employee_id")
        )

        if not employee_id:
            logger.warning(
                "Cannot create leave_approved notification: "
                "leave request has no employee_id."
            )
            return

        remarks = (
            leave_doc.get("manager_remarks")
            or leave_doc.get("review_comment")
        )

        remarks_text = (
            f" Remarks: {remarks}"
            if remarks
            else ""
        )

        notification = NotificationInDB(
            user_id=employee_id,
            title="Leave Approved",
            message=(
                f"Your {leave_doc.get('leave_type', 'leave')} "
                f"leave request for "
                f"{leave_doc.get('start_date')} to "
                f"{leave_doc.get('end_date')} "
                f"has been approved."
                f"{remarks_text}"
            ),
            type="leave_approved",
            reference_id=str(
                leave_doc["_id"]
            ),
        )

        await db.notifications.insert_one(
            notification.to_doc()
        )

        logger.info(
            "Leave approval notification created "
            "for user %s.",
            employee_id,
        )

    except Exception as exc:
        logger.error(
            "Failed to create leave_approved notification: %s",
            exc,
            exc_info=True,
        )


async def notify_leave_rejected(
    leave_doc: dict,
    *args,
    **kwargs,
) -> None:
    """
    Notify the employee that their leave was rejected.

    notifications.user_id is stored as a string.
    """

    try:
        db = get_db()

        employee_id = _normalize_user_id(
            leave_doc.get("employee_id")
        )

        if not employee_id:
            logger.warning(
                "Cannot create leave_rejected notification: "
                "leave request has no employee_id."
            )
            return

        remarks = (
            leave_doc.get("manager_remarks")
            or leave_doc.get("review_comment")
        )

        remarks_text = (
            f" Reason: {remarks}"
            if remarks
            else ""
        )

        notification = NotificationInDB(
            user_id=employee_id,
            title="Leave Rejected",
            message=(
                f"Your {leave_doc.get('leave_type', 'leave')} "
                f"leave request for "
                f"{leave_doc.get('start_date')} to "
                f"{leave_doc.get('end_date')} "
                f"has been rejected."
                f"{remarks_text}"
            ),
            type="leave_rejected",
            reference_id=str(
                leave_doc["_id"]
            ),
        )

        await db.notifications.insert_one(
            notification.to_doc()
        )

        logger.info(
            "Leave rejection notification created "
            "for user %s.",
            employee_id,
        )

    except Exception as exc:
        logger.error(
            "Failed to create leave_rejected notification: %s",
            exc,
            exc_info=True,
        )


# ============================================================================
# QUERY NOTIFICATIONS
# ============================================================================


async def get_user_notifications(
    user_id: str,
) -> dict:
    """
    Fetch all notifications for a user,
    sorted newest first.
    """

    db = get_db()

    normalized_user_id = _normalize_user_id(
        user_id
    )

    cursor = (
        db.notifications
        .find(
            {
                "user_id": normalized_user_id
            }
        )
        .sort(
            "created_at",
            -1,
        )
    )

    notifications = await cursor.to_list(
        length=200
    )

    unread_count = sum(
        1
        for notification in notifications
        if not notification.get(
            "is_read",
            False,
        )
    )

    items = [
        {
            "id": str(notification["_id"]),
            "title": notification["title"],
            "message": notification["message"],
            "type": notification["type"],
            "is_read": notification.get(
                "is_read",
                False,
            ),
            "reference_id": notification.get(
                "reference_id"
            ),
            "created_at": notification["created_at"],
        }
        for notification in notifications
    ]

    return {
        "items": items,
        "total": len(items),
        "unread_count": unread_count,
    }


# ============================================================================
# MARK SINGLE NOTIFICATION AS READ
# ============================================================================


async def mark_notification_read(
    notification_id: str,
    user_id: str,
) -> bool:
    """
    Mark a single notification as read.

    user_id is stored as a string in MongoDB.
    """

    db = get_db()

    try:
        if not ObjectId.is_valid(
            notification_id
        ):
            return False

        normalized_user_id = _normalize_user_id(
            user_id
        )

        result = await db.notifications.update_one(
            {
                "_id": ObjectId(
                    notification_id
                ),
                "user_id": normalized_user_id,
            },
            {
                "$set": {
                    "is_read": True
                }
            },
        )

        return result.modified_count > 0

    except Exception as exc:
        logger.error(
            "Failed to mark notification as read: %s",
            exc,
        )
        return False


# ============================================================================
# MARK ALL NOTIFICATIONS AS READ
# ============================================================================


async def mark_all_notifications_read(
    user_id: str,
) -> int:
    """
    Mark all unread notifications for a user as read.
    """

    db = get_db()

    normalized_user_id = _normalize_user_id(
        user_id
    )

    result = await db.notifications.update_many(
        {
            "user_id": normalized_user_id,
            "is_read": False,
        },
        {
            "$set": {
                "is_read": True
            }
        },
    )

    return result.modified_count