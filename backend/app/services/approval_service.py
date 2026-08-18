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

        if total_days <= 0:
            raise ValueError(
                "Leave duration must be greater than zero."
            )

        # -----------------------------------------------------
        # 1-2 DAYS
        # -----------------------------------------------------

        if total_days <= ApprovalService.MANAGER_MAX_DAYS:

            return {
                "current_approver": "MANAGER",
                "final_approver": "MANAGER",
                "requires_manager": True,
                "requires_hr": False,
                "approval_levels": 1,
            }

        # -----------------------------------------------------
        # 3-5 DAYS
        # -----------------------------------------------------

        if total_days < ApprovalService.HR_DIRECT_START_DAYS:

            return {
                "current_approver": "MANAGER",
                "final_approver": "HR",
                "requires_manager": True,
                "requires_hr": True,
                "approval_levels": 2,
            }

        # -----------------------------------------------------
        # 6+ DAYS
        # -----------------------------------------------------

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

        approver_id = approver.get("_id")

        approver_id_str = str(
            approver_id
        )

        status = (
            leave_request.get("status") or ""
        ).strip().lower()

        current_approver = leave_request.get(
            "current_approver"
        )

        current_approver_str = (
            str(current_approver)
            if current_approver
            else None
        )

        total_days = (
            leave_request.get("total_days")
            or leave_request.get("requested_days")
            or ApprovalService._calculate_total_days(
                leave_request
            )
        )

        route = ApprovalService.determine_approval_route(
            int(total_days)
        )

        # =====================================================
        # FINALIZED REQUEST
        # =====================================================

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

        # =====================================================
        # PENDING
        # =====================================================

        if status == "pending":

            # -------------------------------------------------
            # MANAGER
            # -------------------------------------------------

            if role == "manager":

                manager_id = leave_request.get(
                    "manager_id"
                )

                if str(manager_id) != approver_id_str:

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

                if (
                    current_approver
                    and current_approver_str
                    != approver_id_str
                ):

                    return {
                        "allowed": False,
                        "reason": (
                            "You are not the current "
                            "approver for this leave request."
                        ),
                    }

                return {
                    "allowed": True,
                    "reason": (
                        "Manager is authorized to "
                        "review this request."
                    ),
                }

            # -------------------------------------------------
            # DIRECT HR — 6+ DAYS
            # -------------------------------------------------

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
                        "HR is authorized to "
                        "review this request."
                    ),
                }

            # -------------------------------------------------
            # ADMIN
            # -------------------------------------------------

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

        # =====================================================
        # PENDING HR
        # =====================================================

        if status == "pending_hr":

            # -------------------------------------------------
            # HR SECOND-TIER APPROVAL
            #
            # IMPORTANT:
            #
            # Any authenticated HR user can perform
            # the HR approval action.
            #
            # This avoids blocking the workflow because
            # current_approver contains an outdated/mismatched
            # user ID.
            # -------------------------------------------------

            if role == "hr":

                return {
                    "allowed": True,
                    "reason": (
                        "HR is authorized for the "
                        "second approval tier."
                    ),
                }

            # -------------------------------------------------
            # ADMIN
            # -------------------------------------------------

            if role == "admin":

                return {
                    "allowed": True,
                    "reason": "Administrator override.",
                }

            # -------------------------------------------------
            # OTHER ROLES
            # -------------------------------------------------

            return {
                "allowed": False,
                "reason": (
                    "HR approval is required at "
                    "this approval stage."
                ),
            }

        # =====================================================
        # UNKNOWN STATUS
        # =====================================================

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

    @staticmethod
    def get_next_status(
        leave_request: dict,
        approver_role: str,
    ) -> str:

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
            or leave_request.get("requested_days")
            or ApprovalService._calculate_total_days(
                leave_request
            )
        )

        route = ApprovalService.determine_approval_route(
            int(total_days)
        )

        # =====================================================
        # MANAGER
        # =====================================================

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

        # =====================================================
        # HR
        # =====================================================

        if role == "hr":

            # -------------------------------------------------
            # SECOND-TIER HR
            # -------------------------------------------------

            if current_status == "pending_hr":

                return "approved"

            # -------------------------------------------------
            # DIRECT HR
            # -------------------------------------------------

            if (
                current_status == "pending"
                and not route["requires_manager"]
            ):

                return "approved"

            # -------------------------------------------------
            # MANAGER REQUIRED
            # -------------------------------------------------

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

        # =====================================================
        # ADMIN
        # =====================================================

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

        start_date = leave_request.get(
            "start_date"
        )

        end_date = leave_request.get(
            "end_date"
        )

        if (
            start_date is None
            or end_date is None
        ):

            raise ValueError(
                "Leave request does not contain "
                "a valid duration."
            )

        if hasattr(
            start_date,
            "date",
        ):

            start_date = start_date.date()

        if hasattr(
            end_date,
            "date",
        ):

            end_date = end_date.date()

        return (
            end_date - start_date
        ).days + 1