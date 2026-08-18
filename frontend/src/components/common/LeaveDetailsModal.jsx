import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Badge } from './Badge.jsx';

export function LeaveDetailsModal({ isOpen, onClose, request }) {
  const { role } = useAuth();
  const { cancelLeaveRequest, deleteDraft } = useLeave();
  const navigate = useNavigate();
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!request) return null;

  const handleEditDraft = () => {
    onClose();
    const editPath = role === 'manager' ? `/manager/request-leave?id=${request.id}` : `/employee/request-leave?id=${request.id}`;
    navigate(editPath);
  };

  const handleDeleteDraft = () => {
    deleteDraft(request.id);
    onClose();
  };

  const handleConfirmCancel = () => {
    cancelLeaveRequest(request.id, cancelReason || 'Cancelled by employee');
    setShowCancelPrompt(false);
    onClose();
  };

  // Construct approval timeline based on current status
  const getTimeline = () => {
    if (request.timeline && request.timeline.length > 0) {
      return request.timeline;
    }

    if (request.status === 'draft') {
      return [
        { step: 'Created as Draft', date: request.lastUpdated || 'Saved locally', status: 'completed' },
        { step: 'Submission for Approval', date: 'Pending action', status: 'pending' },
        { step: 'Manager Review', date: 'Pending', status: 'pending' },
        { step: 'Final Decision', date: 'Pending', status: 'pending' },
      ];
    }

    if (request.status === 'pending') {
      return [
        { step: 'Submitted for Review', date: request.submittedDisplay || request.submittedAt || 'Completed', status: 'completed' },
        { step: 'Manager Review (Alex Rivera)', date: 'In Progress', status: 'current' },
        { step: 'HR Review', date: 'Next Step', status: 'pending' },
        { step: 'Final Decision', date: 'Pending', status: 'pending' },
      ];
    }

    if (request.status === 'approved') {
      return [
        { step: 'Submitted for Review', date: request.submittedDisplay || 'Completed', status: 'completed' },
        { step: 'Manager Review', date: request.lastUpdated || 'Completed', status: 'completed', note: request.reviewedBy ? `Approved by ${request.reviewedBy}` : 'Approved' },
        { step: 'HR Review', date: request.lastUpdated || 'Completed', status: 'completed', note: 'Balance Verified' },
        { step: 'Final Decision: Approved', date: request.lastUpdated || 'Approved', status: 'completed' },
      ];
    }

    if (request.status === 'rejected') {
      return [
        { step: 'Submitted for Review', date: request.submittedDisplay || 'Completed', status: 'completed' },
        { step: 'Manager Review', date: request.lastUpdated || 'Reviewed', status: 'rejected', note: request.reviewedBy ? `Rejected by ${request.reviewedBy}` : 'Rejected' },
        { step: 'Final Decision: Rejected', date: request.lastUpdated || 'Decision Recorded', status: 'rejected' },
      ];
    }

    if (request.status === 'cancelled') {
      return [
        { step: 'Submitted for Review', date: request.submittedDisplay || 'Completed', status: 'completed' },
        { step: 'Request Cancelled', date: request.lastUpdated || 'Cancelled', status: 'rejected', note: request.cancelReason || 'Cancelled by employee' },
      ];
    }

    return [];
  };

  const timeline = getTimeline();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Leave Request Details"
      subtitle={`Request ID: ${request.id}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {request.status === 'draft' && (
              <Button variant="danger" size="sm" icon="delete" onClick={handleDeleteDraft}>
                Delete Draft
              </Button>
            )}
            {request.status === 'pending' && !showCancelPrompt && (
              <Button
                variant="outline"
                size="sm"
                icon="cancel"
                onClick={() => setShowCancelPrompt(true)}
              >
                Cancel Request
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {request.status === 'draft' && (
              <Button variant="primary" size="sm" icon="edit" onClick={handleEditDraft}>
                Edit & Submit
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Cancel Confirmation Prompt Banner */}
        {showCancelPrompt && (
          <div className="p-4 bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-xl space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-[#ba1a1a]">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>Are you sure you want to cancel this leave request?</span>
            </div>
            <input
              type="text"
              placeholder="Reason for cancellation (optional)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-white border border-[#dfe5e8] rounded-lg p-2 text-xs text-[#0f1d27]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelPrompt(false)}
              >
                No, Keep Request
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="check"
                onClick={handleConfirmCancel}
              >
                Yes, Cancel Request
              </Button>
            </div>
          </div>
        )}

        {/* Header Status & Employee Info */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-[#ebf5ff] rounded-2xl border border-[#dfe5e8]">
          <div className="flex items-center gap-3">
            {request.avatar ? (
              <img
                src={request.avatar}
                alt={request.employeeName}
                className="w-11 h-11 rounded-full object-cover border border-[#dfe5e8]"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#087f8c] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {request.initials || request.employeeName?.charAt(0) || 'R'}
              </div>
            )}
            <div>
              <h4 className="text-sm font-bold text-[#0f1d27]">{request.employeeName}</h4>
              <p className="text-xs text-[#687781]">
                {request.position || 'Senior Software Engineer'} • {request.department || 'Engineering'}
              </p>
            </div>
          </div>

          <Badge variant={request.status} size="md">
            {request.status.toUpperCase()}
          </Badge>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#f5f7f8] rounded-xl border border-[#dfe5e8]/60">
            <span className="text-[#687781] block mb-0.5">Leave Type</span>
            <span className="font-semibold text-[#0f1d27]">{request.leaveType}</span>
          </div>

          <div className="p-3 bg-[#f5f7f8] rounded-xl border border-[#dfe5e8]/60">
            <span className="text-[#687781] block mb-0.5">Working Days</span>
            <span className="font-bold text-[#00646f]">{request.durationDays} Days</span>
          </div>

          <div className="p-3 bg-[#f5f7f8] rounded-xl border border-[#dfe5e8]/60">
            <span className="text-[#687781] block mb-0.5">Start Date</span>
            <span className="font-semibold text-[#0f1d27]">{request.startDate}</span>
          </div>

          <div className="p-3 bg-[#f5f7f8] rounded-xl border border-[#dfe5e8]/60">
            <span className="text-[#687781] block mb-0.5">End Date</span>
            <span className="font-semibold text-[#0f1d27]">{request.endDate}</span>
          </div>
        </div>

        {/* Reason Section */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#687781]">
            Reason / Notes
          </label>
          <div className="p-3.5 bg-white border border-[#dfe5e8] rounded-xl text-xs text-[#0f1d27] leading-relaxed">
            {request.reason || 'No detailed reason provided.'}
          </div>
        </div>

        {/* Manager Review / Comments Section */}
        {request.reviewedBy && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#687781]">
              Manager / Reviewer Feedback
            </label>
            <div className="p-3.5 bg-[#ebf5ff] border border-[#dfe5e8] rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between text-[#00646f] font-semibold">
                <span>Reviewed by {request.reviewedBy}</span>
                <span className="text-[11px] text-[#687781] font-normal">{request.lastUpdated}</span>
              </div>
              {request.reviewReason && (
                <p className="text-[#3e494a] italic">"{request.reviewReason}"</p>
              )}
            </div>
          </div>
        )}

        {/* Approval Timeline Component */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#687781]">
              Approval Workflow Timeline
            </label>
            <span className="text-[11px] text-[#687781]">
              Submitted: {request.submittedDisplay || 'Draft'}
            </span>
          </div>

          <div className="space-y-3 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#dfe5e8]">
            {timeline.map((item, idx) => (
              <div key={idx} className="relative flex items-start justify-between gap-3 text-xs">
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                    item.status === 'completed'
                      ? 'bg-[#2e7d5b]'
                      : item.status === 'current'
                      ? 'bg-[#00646f] ring-4 ring-[#ebf5ff]'
                      : item.status === 'rejected'
                      ? 'bg-[#ba1a1a]'
                      : 'bg-[#bdc9ca]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {item.status === 'completed'
                      ? 'check'
                      : item.status === 'current'
                      ? 'hourglass_top'
                      : item.status === 'rejected'
                      ? 'close'
                      : 'circle'}
                  </span>
                </div>

                <div className="flex-1">
                  <span
                    className={`font-semibold ${
                      item.status === 'completed'
                        ? 'text-[#0f1d27]'
                        : item.status === 'current'
                        ? 'text-[#00646f]'
                        : item.status === 'rejected'
                        ? 'text-[#ba1a1a]'
                        : 'text-[#687781]'
                    }`}
                  >
                    {item.step}
                  </span>
                  {item.note && (
                    <p className="text-[11px] text-[#687781] mt-0.5">{item.note}</p>
                  )}
                </div>

                <span className="text-[11px] text-[#687781] shrink-0 font-medium">
                  {item.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
