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


async def notify_reschedule_requested(
    reschedule_doc: dict,
    manager: dict,
) -> None:
    """
    Notify the employee that their manager is requesting a reschedule
    of an existing leave request to new proposed dates.

    notifications.user_id is stored as a string.
    """

    try:
        db = get_db()

        employee_id = _normalize_user_id(
            reschedule_doc.get("employee_id")
        )

        if not employee_id:
            logger.warning(
                "Cannot create reschedule_request notification: "
                "reschedule request has no employee_id."
            )
            return

        manager_name = (
            manager.get("full_name")
            or manager.get("email")
            or "Your manager"
        )

        proposed_start = reschedule_doc.get("proposed_start_date")
        proposed_end = reschedule_doc.get("proposed_end_date")

        notification = NotificationInDB(
            user_id=employee_id,
            title="Reschedule Requested",
            message=(
                f"{manager_name} is requesting to reschedule your "
                f"{reschedule_doc.get('leave_type', 'leave')} leave "
                f"({reschedule_doc.get('original_start_date'):%Y-%m-%d} to "
                f"{reschedule_doc.get('original_end_date'):%Y-%m-%d}) to "
                f"{proposed_start:%Y-%m-%d} – {proposed_end:%Y-%m-%d}. "
                f"Reason: {reschedule_doc.get('reason', '')} "
                f"Please accept or reject from the Reschedule Requests page."
            ),
            type="reschedule_request",
            reference_id=str(
                reschedule_doc["_id"]
            ),
        )

        await db.notifications.insert_one(
            notification.to_doc()
        )

        logger.info(
            "Reschedule request notification created "
            "for user %s.",
            employee_id,
        )

    except Exception as exc:
        logger.error(
            "Failed to create reschedule_request notification: %s",
            exc,
            exc_info=True,
        )


async def notify_reschedule_responded(
    reschedule_doc: dict,
    employee: dict,
    accepted: bool,
) -> None:
    """
    Notify the manager that the employee accepted or rejected
    the reschedule request, including the employee's message.

    notifications.user_id is stored as a string.
    """

    try:
        db = get_db()

        manager_id = _normalize_user_id(
            reschedule_doc.get("manager_id")
        )

        if not manager_id:
            logger.warning(
                "Cannot create reschedule response notification: "
                "reschedule request has no manager_id."
            )
            return

        employee_name = (
            employee.get("full_name")
            or employee.get("email")
            or "Employee"
        )

        employee_message = reschedule_doc.get("employee_message")

        message_text = (
            f' Message: "{employee_message}"'
            if employee_message
            else ""
        )

        if accepted:
            title = "Reschedule Accepted"
            body = (
                f"{employee_name} accepted your reschedule request. "
                f"Their leave has been moved to "
                f"{reschedule_doc.get('proposed_start_date'):%Y-%m-%d} – "
                f"{reschedule_doc.get('proposed_end_date'):%Y-%m-%d} "
                f"and is awaiting the normal approval flow."
                f"{message_text}"
            )
        else:
            title = "Reschedule Rejected"
            body = (
                f"{employee_name} rejected your reschedule request for "
                f"{reschedule_doc.get('proposed_start_date'):%Y-%m-%d} – "
                f"{reschedule_doc.get('proposed_end_date'):%Y-%m-%d}. "
                f"The original leave dates remain unchanged."
                f"{message_text}"
            )

        notification = NotificationInDB(
            user_id=manager_id,
            title=title,
            message=body,
            type=(
                "reschedule_accepted"
                if accepted
                else "reschedule_rejected"
            ),
            reference_id=str(
                reschedule_doc["_id"]
            ),
        )

        await db.notifications.insert_one(
            notification.to_doc()
        )

        logger.info(
            "Reschedule response notification created "
            "for user %s.",
            manager_id,
        )

    except Exception as exc:
        logger.error(
            "Failed to create reschedule response notification: %s",
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