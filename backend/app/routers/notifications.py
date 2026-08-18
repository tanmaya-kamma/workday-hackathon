"""
Notifications router — fetch and manage in-app notifications.

Prefix: /api/v1/notifications
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.schemas.notification import NotificationListResponse
from app.services import notification_service

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    current_user: dict = Depends(get_current_user),
):
    """Get all notifications for the current user, newest first."""
    result = await notification_service.get_user_notifications(str(current_user["_id"]))
    return result


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a single notification as read."""
    success = await notification_service.mark_notification_read(
        notification_id, str(current_user["_id"])
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    return {"message": "Notification marked as read."}


@router.patch("/read-all")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all of the current user's notifications as read."""
    count = await notification_service.mark_all_notifications_read(str(current_user["_id"]))
    return {"message": f"{count} notification(s) marked as read."}
