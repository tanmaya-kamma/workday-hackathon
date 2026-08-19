import React, { useState, useEffect } from 'react';
import { useLeave } from '../../context/LeaveContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { Button } from './Button.jsx';

export function LeaveApprovalModal({ isOpen, onClose, request, initialMode = 'review' }) {
  const { approveLeaveRequest, rejectLeaveRequest, getUserBalances } = useLeave();
  const [decision, setDecision] = useState(initialMode === 'reject' ? 'reject' : 'approve');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDecision(initialMode === 'reject' ? 'reject' : 'approve');
      setComment('');
      setError('');
      setLoading(false);
    }
  }, [isOpen, initialMode, request]);

  if (!isOpen || !request) return null;

  const isPending = request.status === 'pending';
  const balances = getUserBalances(request.userId);

  const handleApprove = () => {
    setError('');
    setLoading(true);
    const success = approveLeaveRequest(request.id, comment.trim());
    setLoading(false);
    if (success) {
      onClose();
    }
  };

  const handleReject = () => {
    if (!comment || !comment.trim()) {
      setError('Please provide a reason for rejecting this leave request.');
      return;
    }
    setError('');
    setLoading(true);
    const success = rejectLeaveRequest(request.id, comment.trim());
    setLoading(false);
    if (success) {
      onClose();
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (decision === 'approve') {
      handleApprove();
    } else {
      handleReject();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#dfe5e8] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#dfe5e8] flex items-center justify-between bg-[#f8fbfb]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00646f]/10 text-[#00646f] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">verified_user</span>
            </div>
            <div>
              <h2 id="approval-modal-title" className="text-base font-bold text-[#0f1d27]">
                Review Leave Request
              </h2>
              <p className="text-xs text-[#687781]">
                Request ID: <span className="font-mono text-[#00646f]">{request.id}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={request.status} stage={request.approvalStage} />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#687781] hover:bg-[#ebf5ff] hover:text-[#0f1d27] transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[calc(85vh-130px)] overflow-y-auto flex flex-col gap-6">
          {/* Employee Information Banner */}
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
                  {request.initials || request.employeeName?.slice(0, 2).toUpperCase() || 'EM'}
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-[#0f1d27]">{request.employeeName}</h3>
                <p className="text-xs text-[#687781]">{request.position || 'Team Member'}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#3e494a] font-medium">
                    <span className="material-symbols-outlined text-[14px] text-[#00646f]">domain</span>
                    {request.department}
                  </span>
                  <span className="text-xs text-[#dfe5e8]">•</span>
                  <span className="text-[11px] text-[#687781]">
                    Submitted: {request.submittedDisplay || request.submittedAt || 'Recent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Balances Pill */}
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-[#dfe5e8] shadow-2xs">
              <div className="text-center px-1.5">
                <span className="block text-[10px] uppercase font-bold text-[#687781]">Annual</span>
                <span className="text-xs font-bold text-[#00646f]">{balances.annual.remaining}d left</span>
              </div>
              <div className="w-px h-6 bg-[#dfe5e8]"></div>
              <div className="text-center px-1.5">
                <span className="block text-[10px] uppercase font-bold text-[#687781]">Sick</span>
                <span className="text-xs font-bold text-[#0f1d27]">{balances.sick.remaining}d left</span>
              </div>
            </div>
          </div>

          {/* Request Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-[#dfe5e8] bg-white">
              <span className="text-[11px] font-semibold text-[#687781] uppercase tracking-wider block mb-1">
                Leave Type & Duration
              </span>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00646f] text-[20px]">
                  {request.typeKey === 'sick' ? 'medical_services' : 'flight_takeoff'}
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
                Requested Dates
              </span>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3d6fa8] text-[20px]">event</span>
                <div>
                  <span className="text-sm font-bold text-[#0f1d27] block">{request.dateDisplay}</span>
                  <span className="text-xs text-[#687781]">
                    {request.startDate} to {request.endDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Reason Section */}
          <div className="p-4 rounded-xl bg-white border border-[#dfe5e8]">
            <span className="text-[11px] font-semibold text-[#687781] uppercase tracking-wider block mb-1.5">
              Reason for Absence
            </span>
            <p className="text-xs sm:text-sm text-[#3e494a] leading-relaxed italic bg-[#f8fbfb] p-3 rounded-lg border border-[#dfe5e8]/60">
              "{request.reason || 'No detailed reason provided.'}"
            </p>
          </div>

          {/* Current Decision Info (If already approved/rejected) */}
          {!isPending && (
            <div
              className={`p-4 rounded-xl border ${
                request.status === 'approved'
                  ? 'bg-[#d8f3e5]/50 border-[#22874e]/30'
                  : 'bg-[#ffdad6]/50 border-[#ba1a1a]/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    request.status === 'approved' ? 'text-[#22874e]' : 'text-[#ba1a1a]'
                  }`}
                >
                  {request.status === 'approved' ? 'check_circle' : 'cancel'}
                </span>
                <span className="text-xs font-bold text-[#0f1d27]">
                  Decision: {request.status.toUpperCase()}
                </span>
                {request.reviewedBy && (
                  <span className="text-xs text-[#687781]">by {request.reviewedBy}</span>
                )}
              </div>
              {request.reviewReason && (
                <p className="text-xs text-[#3e494a] mt-1 pl-6">"{request.reviewReason}"</p>
              )}
            </div>
          )}

          {/* Manager Action Form (Only when request is Pending) */}
          {isPending && (
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 pt-2 border-t border-[#dfe5e8]">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#3e494a] block mb-2">
                  Manager Decision
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDecision('approve');
                      setError('');
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer font-semibold text-xs transition-all ${
                      decision === 'approve'
                        ? 'bg-[#d8f3e5] border-[#22874e] text-[#126b3a] shadow-xs'
                        : 'bg-white border-[#dfe5e8] text-[#687781] hover:bg-[#f5f7f8]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Approve Request</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDecision('reject');
                      setError('');
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer font-semibold text-xs transition-all ${
                      decision === 'reject'
                        ? 'bg-[#ffdad6] border-[#ba1a1a] text-[#ba1a1a] shadow-xs'
                        : 'bg-white border-[#dfe5e8] text-[#687781] hover:bg-[#f5f7f8]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    <span>Reject Request</span>
                  </button>
                </div>
              </div>

              {/* Manager Comment */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="manager-comment" className="text-xs font-semibold text-[#3e494a] flex items-center justify-between">
                  <span>
                    {decision === 'reject' ? 'Rejection Reason (Required)' : 'Manager Notes / Instructions (Optional)'}
                  </span>
                  {decision === 'reject' && (
                    <span className="text-[11px] text-[#ba1a1a] font-medium">* Required</span>
                  )}
                </label>
                <textarea
                  id="manager-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={
                    decision === 'reject'
                      ? 'Please explain why this request is rejected (e.g. team coverage conflicts, sprint critical release)...'
                      : 'Add an optional note for the employee (e.g. Ensure sprint handoff is documented)...'
                  }
                  className={`w-full text-xs sm:text-sm p-3 rounded-xl border bg-white focus:outline-none transition-colors ${
                    error ? 'border-[#ba1a1a] ring-2 ring-[#ba1a1a]/20' : 'border-[#dfe5e8] focus:border-[#00646f]'
                  }`}
                />
                {error && (
                  <p className="text-xs text-[#ba1a1a] flex items-center gap-1 font-medium mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {error}
                  </p>
                )}
              </div>
            </form>
          )}

          {/* Workflow Timeline */}
          {request.timeline && request.timeline.length > 0 && (
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-[#687781] uppercase tracking-wider block mb-3">
                Request Activity History
              </span>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#dfe5e8]">
                {request.timeline.map((step, idx) => (
                  <div key={idx} className="relative flex flex-col gap-0.5">
                    <div
                      className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                        step.status === 'completed'
                          ? 'border-[#22874e] bg-[#22874e]'
                          : step.status === 'rejected'
                          ? 'border-[#ba1a1a] bg-[#ba1a1a]'
                          : step.status === 'current'
                          ? 'border-[#00646f] bg-white ring-2 ring-[#00646f]/20'
                          : 'border-[#dfe5e8] bg-white'
                      }`}
                    >
                      {step.status === 'completed' && (
                        <span className="material-symbols-outlined text-white text-[10px]">check</span>
                      )}
                      {step.status === 'rejected' && (
                        <span className="material-symbols-outlined text-white text-[10px]">close</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          step.status === 'completed'
                            ? 'text-[#0f1d27]'
                            : step.status === 'rejected'
                            ? 'text-[#ba1a1a]'
                            : step.status === 'current'
                            ? 'text-[#00646f]'
                            : 'text-[#687781]'
                        }`}
                      >
                        {step.step}
                      </span>
                      <span className="text-[11px] text-[#687781]">{step.date}</span>
                    </div>
                    {step.note && <p className="text-[11px] text-[#687781]">{step.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#dfe5e8] bg-[#f8fbfb] flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Close
          </Button>

          {isPending && (
            <div className="flex items-center gap-2">
              {decision === 'reject' ? (
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
                  className="bg-[#22874e] hover:bg-[#1a6e3e]"
                >
                  Confirm Approval
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
