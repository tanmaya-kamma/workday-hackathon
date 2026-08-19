import React, { useState, useEffect } from "react";
import { useLeave } from "../../context/LeaveContext.jsx";
import { StatusBadge } from "./StatusBadge.jsx";
import { Button } from "./Button.jsx";

export function HrReviewModal({
  isOpen,
  onClose,
  request,
  initialMode = "review",
}) {
  const { hrApproveLeaveRequest, hrRejectLeaveRequest, getUserBalances } =
    useLeave();

  const [decision, setDecision] = useState(
    initialMode === "reject" ? "reject" : "approve",
  );

  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDecision(initialMode === "reject" ? "reject" : "approve");
      setComment("");
      setError("");
      setLoading(false);
    }
  }, [isOpen, initialMode, request]);

  if (!isOpen || !request) {
    return null;
  }

  /*
   * IMPORTANT:
   *
   * HR can act on both:
   *
   * pending
   * pending_hr
   *
   * pending_hr is the second-tier HR approval state.
   */

  const isPending =
    request.status === "pending" || request.status === "pending_hr";

  const isCancelled = request.status === "cancelled";

  const balances = getUserBalances(request.userId);

  // =========================================================
  // APPROVE
  // =========================================================

  const handleApprove = async () => {
    setError("");
    setLoading(true);

    try {
      const success = await hrApproveLeaveRequest(request.id, comment.trim());

      if (success) {
        onClose();
      }
    } catch (err) {
      setError(err?.message || "Failed to approve leave request.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // REJECT
  // =========================================================

  const handleReject = async () => {
    if (!comment.trim()) {
      setError(
        "Please provide a mandatory reason for HR records before rejecting.",
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      const success = await hrRejectLeaveRequest(request.id, comment.trim());

      if (success) {
        onClose();
      }
    } catch (err) {
      setError(err?.message || "Failed to reject leave request.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // FORM SUBMIT
  // =========================================================

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    if (decision === "approve") {
      await handleApprove();
    } else {
      await handleReject();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#dfe5e8] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hr-approval-modal-title"
      >
        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="px-6 py-5 border-b border-[#dfe5e8] flex items-center justify-between bg-[#f8fbfb]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00646f]/10 text-[#00646f] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">
                admin_panel_settings
              </span>
            </div>

            <div>
              <h2
                id="hr-approval-modal-title"
                className="text-base font-bold text-[#0f1d27]"
              >
                HR Leave Management & Review
              </h2>

              <p className="text-xs text-[#687781]">
                Request ID:{" "}
                <span className="font-mono text-[#00646f] font-semibold">
                  {request.id}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={request.status} stage={request.approvalStage} />

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-1.5 rounded-lg text-[#687781] hover:bg-[#ebf5ff] hover:text-[#0f1d27] transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Close dialog"
            >
              <span className="material-symbols-outlined text-[20px]">
                close
              </span>
            </button>
          </div>
        </div>

        {/* =====================================================
            CONTENT
        ====================================================== */}

        <div className="p-6 max-h-[calc(85vh-130px)] overflow-y-auto flex flex-col gap-6">
          {/* Employee Information */}

          <div className="p-4 bg-[#f5f7f8] rounded-xl border border-[#dfe5e8] flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {request.avatar ? (
                <img
                  src={request.avatar}
                  alt={request.employeeName}
                  className="w-12 h-12 rounded-full object-cover border border-[#dfe5e8]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-sm">
                  {request.initials ||
                    request.employeeName?.slice(0, 2).toUpperCase() ||
                    "EM"}
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-[#0f1d27]">
                  {request.employeeName}
                </h3>

                <p className="text-xs text-[#687781]">
                  {request.position || "Team Member"}
                </p>

                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#3e494a] font-medium">
                    <span className="material-symbols-outlined text-[14px] text-[#00646f]">
                      domain
                    </span>

                    {request.department}
                  </span>

                  <span className="text-xs text-[#dfe5e8]">•</span>

                  <span className="inline-flex items-center gap-1 text-[11px] text-[#687781]">
                    <span className="material-symbols-outlined text-[14px] text-[#687781]">
                      supervisor_account
                    </span>
                    Manager: {request.managerName || "Not Assigned"}
                  </span>
                </div>
              </div>
            </div>

            {/* Leave Balances */}

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#dfe5e8] shadow-2xs">
              <div className="text-center px-1.5">
                <span className="block text-[10px] uppercase font-bold text-[#687781]">
                  Annual PTO
                </span>

                <span className="text-xs font-bold text-[#00646f]">
                  {balances?.annual?.remaining ?? 0}d left
                </span>
              </div>

              <div className="w-px h-6 bg-[#dfe5e8]" />

              <div className="text-center px-1.5">
                <span className="block text-[10px] uppercase font-bold text-[#687781]">
                  Sick
                </span>

                <span className="text-xs font-bold text-[#0f1d27]">
                  {balances?.sick?.remaining ?? 0}d left
                </span>
              </div>

              <div className="w-px h-6 bg-[#dfe5e8]" />

              <div className="text-center px-1.5">
                <span className="block text-[10px] uppercase font-bold text-[#687781]">
                  Casual
                </span>

                <span className="text-xs font-bold text-[#3d6fa8]">
                  {balances?.casual?.remaining ?? 0}d left
                </span>
              </div>
            </div>
          </div>

          {/* Request Details */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-[#dfe5e8] bg-white">
              <span className="text-[11px] font-semibold text-[#687781] uppercase tracking-wider block mb-1">
                Leave Type & Duration
              </span>

              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00646f] text-[20px]">
                  {request.typeKey === "sick"
                    ? "medical_services"
                    : "flight_takeoff"}
                </span>

                <div>
                  <span className="text-sm font-bold text-[#0f1d27] block">
                    {request.leaveType}
                    {request.unpaidDays > 0 && (
                      <span className="ml-1.5 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#ffdad6] text-[#ba1a1a] align-middle">
                        +{request.unpaidDays}d unpaid
                      </span>
                    )}
                  </span>

                  <span className="text-xs text-[#00646f] font-semibold">
                    {request.unpaidDays > 0
                      ? `${request.durationDays} Working Day(s) — ${Math.max(0, request.durationDays - request.unpaidDays)} paid · ${request.unpaidDays} unpaid`
                      : `${request.durationDays} Working Day(s)`}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#dfe5e8] bg-white">
              <span className="text-[11px] font-semibold text-[#687781] uppercase tracking-wider block mb-1">
                Scheduled Dates
              </span>

              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3d6fa8] text-[20px]">
                  event
                </span>

                <div>
                  <span className="text-sm font-bold text-[#0f1d27] block">
                    {request.dateDisplay}
                  </span>

                  <span className="text-xs text-[#687781]">
                    Submitted:{" "}
                    {request.submittedDisplay || request.submittedAt || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Reason */}

          <div className="p-4 rounded-xl bg-white border border-[#dfe5e8]">
            <span className="text-[11px] font-semibold text-[#687781] uppercase tracking-wider block mb-1.5">
              Employee Reason
            </span>

            <p className="text-xs sm:text-sm text-[#3e494a] leading-relaxed italic bg-[#f8fbfb] p-3 rounded-lg border border-[#dfe5e8]/60">
              "{request.reason || "No detailed reason provided."}"
            </p>
          </div>

          {/* Previous Reviews */}

          {(request.reviewedBy ||
            request.hrReviewedBy ||
            request.cancelReason) && (
            <div className="p-4 rounded-xl bg-[#f5f7f8] border border-[#dfe5e8] space-y-2">
              <span className="text-[11px] font-semibold text-[#687781] uppercase tracking-wider block">
                Previous Review Notes
              </span>

              {request.reviewedBy && (
                <div className="text-xs text-[#3e494a]">
                  <span className="font-semibold text-[#0f1d27]">
                    Manager ({request.reviewedBy}):
                  </span>{" "}
                  <span className="italic">
                    {request.reviewReason || "Approved"}
                  </span>
                </div>
              )}

              {request.hrReviewedBy && (
                <div className="text-xs text-[#3e494a]">
                  <span className="font-semibold text-[#00646f]">
                    HR ({request.hrReviewedBy}):
                  </span>{" "}
                  <span className="italic">
                    {request.hrReviewReason || "Approved"}
                  </span>
                </div>
              )}

              {request.cancelReason && (
                <div className="text-xs text-[#ba1a1a]">
                  <span className="font-semibold">Cancellation Note:</span>{" "}
                  <span className="italic">{request.cancelReason}</span>
                </div>
              )}
            </div>
          )}

          {/* ===================================================
              HR ACTION CONTROLS

              IMPORTANT:
              Both pending and pending_hr are actionable.
          ==================================================== */}

          {isPending && !isCancelled && (
            <form
              onSubmit={handleFormSubmit}
              className="flex flex-col gap-4 pt-2 border-t border-[#dfe5e8]"
            >
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#3e494a] block mb-2">
                  HR Action & Decision
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {/* APPROVE */}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setDecision("approve");
                      setError("");
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer font-semibold text-xs transition-all disabled:opacity-50 ${
                      decision === "approve"
                        ? "bg-[#d8f3e5] border-[#22874e] text-[#126b3a] shadow-xs"
                        : "bg-white border-[#dfe5e8] text-[#687781] hover:bg-[#f5f7f8]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      check_circle
                    </span>

                    <span>HR Approve</span>
                  </button>

                  {/* REJECT */}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setDecision("reject");
                      setError("");
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer font-semibold text-xs transition-all disabled:opacity-50 ${
                      decision === "reject"
                        ? "bg-[#ffdad6] border-[#ba1a1a] text-[#ba1a1a] shadow-xs"
                        : "bg-white border-[#dfe5e8] text-[#687781] hover:bg-[#f5f7f8]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      cancel
                    </span>

                    <span>HR Reject</span>
                  </button>
                </div>
              </div>

              {/* HR COMMENT */}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="hr-comment"
                  className="text-xs font-semibold text-[#3e494a] flex items-center justify-between"
                >
                  <span>
                    {decision === "reject"
                      ? "Rejection Reason (Required for HR records)"
                      : "HR Review Note (Optional)"}
                  </span>

                  {decision === "reject" && (
                    <span className="text-[11px] text-[#ba1a1a] font-medium">
                      * Required
                    </span>
                  )}
                </label>

                <textarea
                  id="hr-comment"
                  rows={3}
                  value={comment}
                  disabled={loading}
                  onChange={(e) => {
                    setComment(e.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder={
                    decision === "reject"
                      ? "Specify regulatory, policy, or quota reasons for rejection..."
                      : "Add an optional HR note..."
                  }
                  className={`w-full text-xs sm:text-sm p-3 rounded-xl border bg-white focus:outline-none transition-colors disabled:bg-[#f5f7f8] ${
                    error
                      ? "border-[#ba1a1a] ring-2 ring-[#ba1a1a]/20"
                      : "border-[#dfe5e8] focus:border-[#00646f]"
                  }`}
                />

                {error && (
                  <p className="text-xs text-[#ba1a1a] flex items-center gap-1 font-medium mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">
                      error
                    </span>

                    {error}
                  </p>
                )}
              </div>
            </form>
          )}

          {/* ===================================================
              WORKFLOW TIMELINE
          ==================================================== */}

          {request.timeline && request.timeline.length > 0 && (
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-[#687781] uppercase tracking-wider block mb-3">
                Lifecycle & Audit Timeline
              </span>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#dfe5e8]">
                {request.timeline.map((step, idx) => (
                  <div key={idx} className="relative flex flex-col gap-0.5">
                    <div
                      className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                        step.status === "completed"
                          ? "border-[#22874e] bg-[#22874e]"
                          : step.status === "rejected"
                            ? "border-[#ba1a1a] bg-[#ba1a1a]"
                            : step.status === "current"
                              ? "border-[#00646f] bg-white ring-2 ring-[#00646f]/20"
                              : "border-[#dfe5e8] bg-white"
                      }`}
                    >
                      {step.status === "completed" && (
                        <span className="material-symbols-outlined text-white text-[10px]">
                          check
                        </span>
                      )}

                      {step.status === "rejected" && (
                        <span className="material-symbols-outlined text-white text-[10px]">
                          close
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          step.status === "completed"
                            ? "text-[#0f1d27]"
                            : step.status === "rejected"
                              ? "text-[#ba1a1a]"
                              : step.status === "current"
                                ? "text-[#00646f]"
                                : "text-[#687781]"
                        }`}
                      >
                        {step.step}
                      </span>

                      <span className="text-[11px] text-[#687781]">
                        {step.date}
                      </span>
                    </div>

                    {step.note && (
                      <p className="text-[11px] text-[#687781]">{step.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* =====================================================
            FOOTER
        ====================================================== */}

        <div className="px-6 py-4 border-t border-[#dfe5e8] bg-[#f8fbfb] flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Close
          </Button>

          {isPending && !isCancelled && (
            <div className="flex items-center gap-2">
              {decision === "reject" ? (
                <Button
                  variant="danger"
                  size="sm"
                  loading={loading}
                  icon="cancel"
                  onClick={handleReject}
                >
                  Confirm Rejection
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  loading={loading}
                  icon="check_circle"
                  onClick={handleApprove}
                  className="bg-[#00646f] hover:bg-[#004e57]"
                >
                  Confirm HR Approval
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
