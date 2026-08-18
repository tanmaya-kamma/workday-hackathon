"""
Approval Engine for the Workday Leave Management System.

Approval rules:

    1-2 days:
        Manager approval only.

    3-5 days:
        Manager approval followed by HR approval.

    6+ days:
        HR approval directly.

The engine is intentionally service-first.

Database operations use Motor through get_db().
Do NOT introduce PyMongo here.
"""

from typing import Optional

from app.core.database import get_db


class ApprovalService:
    """
    Multi-tier leave approval engine.

    Responsibilities:
    - Determine approval route based on leave duration
    - Validate whether an approver is authorized
    - Determine the next request status
    - Keep approval business rules separate from API routes
    """

    # =========================================================
    # APPROVAL THRESHOLDS
    # =========================================================

    MANAGER_MAX_DAYS = 2
    HR_REVIEW_START_DAYS = 3
    HR_DIRECT_START_DAYS = 6

    # =========================================================
    # DETERMINE APPROVAL ROUTE
    # =========================================================

    @staticmethod
    def determine_approval_route(
        total_days: int,
    ) -> dict:
        """
        Determine the approval route for a leave request.

        Rules:

            1-2 days:
                Manager only

            3-5 days:
                Manager -> HR

            6+ days:
                HR directly
        """

        if total_days <= 0:
            raise ValueError(
                "Leave duration must be greater than zero."
            )

        if total_days <= ApprovalService.MANAGER_MAX_DAYS:
            return {
                "current_approver": "MANAGER",
                "final_approver": "MANAGER",
                "requires_manager": True,
                "requires_hr": False,
                "approval_levels": 1,
            }

        if total_days < ApprovalService.HR_DIRECT_START_DAYS:
            return {
                "current_approver": "MANAGER",
                "final_approver": "HR",
                "requires_manager": True,
                "requires_hr": True,
                "approval_levels": 2,
            }

        return {
            "current_approver": "HR",
            "final_approver": "HR",
            "requires_manager": False,
            "requires_hr": True,
            "approval_levels": 1,
        }

    # =========================================================
    # APPROVER VALIDATION
    # =========================================================

    @staticmethod
    def validate_approver(
        leave_request: dict,
        approver: dict,
    ) -> dict:
        """
        Determine whether a user is authorized to review
        the leave request at its current approval stage.

        Returns:

            {
                "allowed": True/False,
                "reason": "..."
            }
        """

        if not leave_request:
            return {
                "allowed": False,
                "reason": "Leave request not found.",
            }

        if not approver:
            return {
                "allowed": False,
                "reason": "Approver information is required.",
            }

        role = (
            approver.get("role") or ""
        ).strip().lower()

        status = (
            leave_request.get("status") or ""
        ).strip().lower()

        total_days = (
            leave_request.get("total_days")
            or ApprovalService._calculate_total_days(
                leave_request
            )
        )

        route = ApprovalService.determine_approval_route(
            int(total_days)
        )

        # -----------------------------------------------------
        # ALREADY FINALIZED
        # -----------------------------------------------------

        if status in {
            "approved",
            "rejected",
            "cancelled",
        }:
            return {
                "allowed": False,
                "reason": (
                    f"Cannot review a leave request "
                    f"with status '{status}'."
                ),
            }

        # -----------------------------------------------------
        # MANAGER APPROVAL
        # -----------------------------------------------------

        if status == "pending":

            if role == "manager":

                manager_id = leave_request.get(
                    "manager_id"
                )

                approver_id = approver.get(
                    "_id"
                )

                if str(manager_id) != str(approver_id):
                    return {
                        "allowed": False,
                        "reason": (
                            "You are not the assigned "
                            "manager for this leave request."
                        ),
                    }

                if not route["requires_manager"]:
                    return {
                        "allowed": False,
                        "reason": (
                            "This leave request is routed "
                            "directly to HR."
                        ),
                    }

                return {
                    "allowed": True,
                    "reason": (
                        "Manager is authorized to "
                        "review this request."
                    ),
                }

            if role == "hr":

                if route["requires_manager"]:
                    return {
                        "allowed": False,
                        "reason": (
                            "Manager approval is required "
                            "before HR review."
                        ),
                    }

                return {
                    "allowed": True,
                    "reason": (
                        "HR is authorized to review "
                        "this request."
                    ),
                }

            if role == "admin":
                return {
                    "allowed": True,
                    "reason": "Administrator override.",
                }

            return {
                "allowed": False,
                "reason": (
                    "User is not authorized to "
                    "review leave requests."
                ),
            }

        # -----------------------------------------------------
        # HR SECOND-TIER APPROVAL
        # -----------------------------------------------------

        if status == "pending_hr":

            if role in {"hr", "admin"}:
                return {
                    "allowed": True,
                    "reason": (
                        "HR is authorized for the "
                        "second approval tier."
                    ),
                }

            return {
                "allowed": False,
                "reason": (
                    "HR approval is required at "
                    "this approval stage."
                ),
            }

        # -----------------------------------------------------
        # UNKNOWN STATUS
        # -----------------------------------------------------

        return {
            "allowed": False,
            "reason": (
                f"Unsupported leave request "
                f"status '{status}'."
            ),
        }

    # =========================================================
    # NEXT STATUS
    # =========================================================

    def get_next_status(
    leave_request: dict,
    approver_role: str,
) -> str:
        """
        Determine the status after an approval action.

        Examples:

            2 days + manager
                -> approved

            3 days + manager
                -> pending_hr

            3 days + HR
                -> approved

            6 days + HR
                -> approved
        """

        if not leave_request:
            raise ValueError(
                "Leave request is required."
            )

        role = (
            approver_role or ""
        ).strip().lower()

        current_status = (
            leave_request.get("status")
            or "pending"
        ).strip().lower()

        total_days = (
            leave_request.get("total_days")
            or ApprovalService._calculate_total_days(
                leave_request
            )
        )

        route = ApprovalService.determine_approval_route(
            int(total_days)
        )

        # -----------------------------------------------------
        # ADMIN OVERRIDE
        # -----------------------------------------------------

        

        # -----------------------------------------------------
        # MANAGER
        # -----------------------------------------------------

        if role == "manager":

            if current_status != "pending":
                raise ValueError(
                    "Manager can only review "
                    "a pending request."
                )

            if not route["requires_manager"]:
                raise ValueError(
                    "This request is routed directly "
                    "to HR."
                )

            if route["requires_hr"]:
                return "pending_hr"

            return "approved"

        # -----------------------------------------------------
        # HR
        # -----------------------------------------------------

        if role == "hr":

            if current_status == "pending_hr":
                return "approved"

            if (
                current_status == "pending"
                and not route["requires_manager"]
            ):
                return "approved"

            if (
                current_status == "pending"
                and route["requires_manager"]
            ):
                raise ValueError(
                    "Manager approval is required "
                    "before HR approval."
                )

            raise ValueError(
                "HR cannot approve this request "
                f"from status '{current_status}'."
            )

        # -----------------------------------------------------
        # ADMIN
        # -----------------------------------------------------

        if role == "admin":

            if current_status in {
                "pending",
                "pending_hr",
            }:
                return "approved"

        raise ValueError(
            "User is not authorized to approve "
            "this leave request."
        )

    # =========================================================
    # REJECTION STATUS
    # =========================================================

    @staticmethod
    def get_rejection_status(
        leave_request: dict,
        approver_role: str,
    ) -> str:
        """
        Validate a rejection action and return REJECTED.
        """

        if not leave_request:
            raise ValueError(
                "Leave request is required."
            )

        role = (
            approver_role or ""
        ).strip().lower()

        current_status = (
            leave_request.get("status")
            or "pending"
        ).strip().lower()

        if current_status not in {
            "pending",
            "pending_hr",
        }:
            raise ValueError(
                "Only pending leave requests "
                "can be rejected."
            )

        if role not in {
            "manager",
            "hr",
            "admin",
        }:
            raise ValueError(
                "User is not authorized to "
                "reject leave requests."
            )

        return "rejected"

    # =========================================================
    # HELPER
    # =========================================================

    @staticmethod
    def _calculate_total_days(
        leave_request: dict,
    ) -> int:
        """
        Calculate inclusive calendar days when total_days
        is not stored on the request.

        Validation Engine should normally provide the
        policy-aware charged leave days.
        """

        start_date = leave_request.get(
            "start_date"
        )

        end_date = leave_request.get(
            "end_date"
        )

        if start_date is None or end_date is None:
            raise ValueError(
                "Leave request does not contain "
                "a valid duration."
            )

        if hasattr(start_date, "date"):
            start_date = start_date.date()

        if hasattr(end_date, "date"):
            end_date = end_date.date()

        return (
            end_date - start_date
        ).days + 1