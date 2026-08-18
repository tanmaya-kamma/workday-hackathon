import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { LeaveApprovalModal } from '../../components/common/LeaveApprovalModal.jsx';
import api from '../../api.js';


// ---------------------------------------------------------------------------
// Impact level styling
// ---------------------------------------------------------------------------

const IMPACT_STYLES = {
  high:   { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700' },
  medium: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200', dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700' },
  low:    { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200', dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600' },
};

const STATUS_ICONS = {
  'in progress':              'play_circle',
  'in review':                'rate_review',
  'to do':                    'checklist',
  'selected for development': 'code',
  'testing':                  'bug_report',
  'blocked':                  'block',
  'done':                     'check_circle',
};


// ---------------------------------------------------------------------------
// Jira panel (fetches employee-specific data)
// ---------------------------------------------------------------------------

function JiraPanel({ employeeName, startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.get('/jira/leave-impact', {
      params: {
        employee_name: employeeName,
        start_date: startDate,
        end_date: endDate,
      },
    })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail || 'Could not load Jira data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [employeeName, startDate, endDate]);

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-[#e2e8f0]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-6 justify-center">
          <div className="w-5 h-5 border-2 border-[#0052cc] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#687781]">Loading Jira tasks for {employeeName}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 pt-4 border-t border-[#e2e8f0]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-4 bg-red-50 rounded-xl border border-red-200">
          <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
          <span className="text-xs text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, leave_impact_issues = [], other_active_issues = [], jira_list_url, jira_available, jira_match } = data;
  const allIssues = [...leave_impact_issues, ...other_active_issues];

  return (
    <div className="mt-4 pt-4 border-t border-[#e2e8f0]" onClick={(e) => e.stopPropagation()}>

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0052cc] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.53 2.13a.75.75 0 0 0-1.06 0L2.13 10.47a.75.75 0 0 0 0 1.06l8.34 8.34a.75.75 0 0 0 1.06 0l8.34-8.34a.75.75 0 0 0 0-1.06zm-.53 14.6L3.69 11 11 3.69 18.31 11z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-[#0f1d27] block leading-tight">
              {employeeName}'s Jira Tasks
            </span>
            <span className="text-[11px] text-[#687781]">
              {jira_match ? 'Matched via account' : 'Showing project-level view'}
            </span>
          </div>
        </div>

        {jira_list_url && (
          <a
            href={jira_list_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#0052cc] hover:bg-[#0747a6] px-3 py-2 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            Open in Jira
          </a>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0] text-center">
            <span className="text-lg font-bold text-[#0f1d27] block">{summary.total_assigned}</span>
            <span className="text-[10px] uppercase font-semibold text-[#687781]">Total Assigned</span>
          </div>
          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0] text-center">
            <span className="text-lg font-bold text-[#0052cc] block">{summary.active}</span>
            <span className="text-[10px] uppercase font-semibold text-[#687781]">Active</span>
          </div>
          <div className={`rounded-xl p-3 border text-center ${summary.leave_impact > 0 ? 'bg-red-50 border-red-200' : 'bg-[#f8fafc] border-[#e2e8f0]'}`}>
            <span className={`text-lg font-bold block ${summary.leave_impact > 0 ? 'text-red-600' : 'text-[#0f1d27]'}`}>{summary.leave_impact}</span>
            <span className="text-[10px] uppercase font-semibold text-[#687781]">Leave Impact</span>
          </div>
          <div className="bg-[#f8fafc] rounded-xl p-3 border border-[#e2e8f0] text-center">
            <span className="text-lg font-bold text-[#0f1d27] block">{summary.other_active_work || 0}</span>
            <span className="text-[10px] uppercase font-semibold text-[#687781]">Other Active</span>
          </div>
        </div>
      )}

      {/* Issue list */}
      {allIssues.length === 0 ? (
        <div className="text-center py-6 text-sm text-[#687781]">
          <span className="material-symbols-outlined text-[28px] text-[#c4cdd5] block mb-1">task_alt</span>
          No active Jira tasks found for this employee.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {allIssues.map((issue) => {
            const style = IMPACT_STYLES[issue.impact_level] || IMPACT_STYLES.low;
            const statusIcon = STATUS_ICONS[(issue.status || '').toLowerCase()] || 'radio_button_unchecked';

            return (
              <a
                key={issue.key}
                href={issue.jira_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all hover:shadow-sm group ${style.bg} ${style.border}`}
              >
                {/* Status icon */}
                <div className="pt-0.5 shrink-0">
                  <span className={`material-symbols-outlined text-[18px] ${style.text}`}>{statusIcon}</span>
                </div>

                {/* Issue details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-mono font-bold text-[#687781]">{issue.key}</span>
                    {issue.leave_impact && (
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${style.badge}`}>
                        {issue.impact_level}
                      </span>
                    )}
                    {issue.deployment_related && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                        Deploy
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-[#0f1d27] truncate group-hover:text-[#0052cc] transition-colors">
                    {issue.summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <span className={`text-[10px] font-semibold ${style.text}`}>
                      {issue.status}
                    </span>
                    {issue.priority && (
                      <span className="text-[10px] text-[#687781]">
                        {issue.priority} priority
                      </span>
                    )}
                    {issue.sprint && (
                      <span className="text-[10px] text-[#687781]">
                        {issue.sprint}
                      </span>
                    )}
                    {issue.due_date && (
                      <span className="text-[10px] text-[#687781]">
                        Due {issue.due_date}
                      </span>
                    )}
                  </div>

                  {/* Impact reasons */}
                  {issue.reasons && issue.reasons.length > 0 && issue.leave_impact && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {issue.reasons.map((reason, i) => (
                        <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${style.badge}`}>
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Open link arrow */}
                <span className="material-symbols-outlined text-[16px] text-[#c4cdd5] group-hover:text-[#0052cc] transition-colors shrink-0 mt-0.5">
                  arrow_outward
                </span>
              </a>
            );
          })}
        </div>
      )}

      {/* No match warning */}
      {jira_available && !jira_match && (
        <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5 shrink-0">info</span>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            Could not match <strong>{employeeName}</strong> to a Jira account. Showing the full project board.
            To enable per-employee filtering, ensure their email in this system matches their Jira account email.
          </p>
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function PendingApprovalsPage() {
  const { currentUser } = useAuth();
  const { getPendingApprovals, approveLeaveRequest, getUserBalances } = useLeave();

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalMode, setModalMode] = useState('review');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const pendingRequests = getPendingApprovals(currentUser?.id);

  const handleSelectAll = () => {
    if (selectedIds.length === pendingRequests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingRequests.map((r) => r.id));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    selectedIds.forEach((id) => {
      approveLeaveRequest(id, 'Batch approved by manager');
    });
    setSelectedIds([]);
    setBulkProcessing(false);
  };

  const handleOpenReview = (req, mode = 'review') => {
    setSelectedRequest(req);
    setModalMode(mode);
  };

  const handleQuickApprove = (e, req) => {
    e.stopPropagation();
    approveLeaveRequest(req.id, 'Approved by manager');
  };

  const handleToggleExpand = (e, id) => {
    e.stopPropagation();
    setExpandedId((prev) => (prev === id ? null : id));
  };


  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Pending Approvals"
        subtitle="Review and take action on leave requests from members in your direct team."
      >
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 animate-in fade-in duration-150">
            <span className="text-xs text-[#687781] font-semibold">
              {selectedIds.length} request{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <Button
              variant="primary"
              size="sm"
              icon="check_circle"
              loading={bulkProcessing}
              onClick={handleBulkApprove}
              className="bg-[#22874e] hover:bg-[#1a6e3e]"
            >
              Approve Selected ({selectedIds.length})
            </Button>
          </div>
        )}
      </PageHeader>


      {/* Queue Info */}
      <div className="bg-white p-4 rounded-2xl border border-[#dfe5e8] shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#fff8e1] text-[#b7791f] flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">pending_actions</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f1d27]">
              Approval Queue ({pendingRequests.length} Pending)
            </h3>
            <p className="text-xs text-[#687781]">
              Approve or reject requests with full audit trail for payroll and project planning.
            </p>
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-semibold text-[#00646f] hover:underline cursor-pointer px-2 py-1"
            >
              {selectedIds.length === pendingRequests.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}
      </div>


      {/* Pending requests */}
      {pendingRequests.length === 0 ? (
        <Card className="p-12 text-center border-[#dfe5e8]">
          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#d8f3e5] text-[#22874e] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[36px]">task_alt</span>
            </div>
            <h3 className="text-lg font-bold text-[#0f1d27]">All Caught Up!</h3>
            <p className="text-xs sm:text-sm text-[#687781] leading-relaxed">
              There are no pending leave requests for your team at this time. New submissions from your team will appear here automatically.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((req) => {
            const balances = getUserBalances(req.userId);
            const isSelected = selectedIds.includes(req.id);
            const isExpanded = expandedId === req.id;

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl border p-5 sm:p-6 transition-all shadow-xs hover:shadow-md ${
                  isSelected
                    ? 'border-[#00646f] ring-2 ring-[#00646f]/10 bg-[#f8fbfb]'
                    : 'border-[#dfe5e8] hover:border-[#00646f]/40'
                }`}
              >
                {/* Main row */}
                <div
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 cursor-pointer"
                  onClick={() => handleOpenReview(req, 'review')}
                >
                  {/* Employee info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="pt-1" onClick={(e) => { e.stopPropagation(); handleToggleSelect(req.id); }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-[#00646f] focus:ring-[#00646f] border-[#dfe5e8] cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-3.5">
                      {req.avatar ? (
                        <img
                          src={req.avatar}
                          alt={req.employeeName}
                          className="w-12 h-12 rounded-full object-cover border border-[#dfe5e8]"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-sm">
                          {req.initials || req.employeeName?.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#0f1d27] hover:text-[#00646f]">
                            {req.employeeName}
                          </h4>
                          <span className="text-xs font-mono text-[#687781]">({req.id})</span>
                        </div>
                        <p className="text-xs text-[#687781]">{req.position || 'Team Member'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-[#00646f] font-semibold bg-[#ebf5ff] px-2 py-0.5 rounded-md">
                            {req.department}
                          </span>
                          <span className="text-[11px] text-[#687781]">
                            Submitted {req.submittedDisplay || req.submittedAt}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Leave info */}
                  <div className="flex flex-wrap items-center gap-6 lg:border-l lg:border-r border-[#dfe5e8] lg:px-6 py-2 lg:py-0">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#687781] block">Leave Type</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="material-symbols-outlined text-[18px] text-[#00646f]">
                          {req.typeKey === 'sick' ? 'medical_services' : 'event'}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[#0f1d27]">{req.leaveType}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#687781] block">Period & Duration</span>
                      <div className="mt-0.5">
                        <span className="text-xs sm:text-sm font-bold text-[#0f1d27] block">{req.dateDisplay}</span>
                        <span className="text-xs text-[#00646f] font-semibold">
                          {req.durationDays} Working Day{req.durationDays > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#687781] block">Balance Remaining</span>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs font-bold text-[#22874e] bg-[#d8f3e5] px-2 py-0.5 rounded-md">
                          {req.typeKey === 'sick'
                            ? `${balances.sick.remaining}d Sick left`
                            : `${balances.annual.remaining}d Annual left`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      title="View Jira Tasks"
                      onClick={(e) => handleToggleExpand(e, req.id)}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                        isExpanded
                          ? 'bg-[#0052cc] text-white border-[#0052cc] shadow-sm'
                          : 'bg-white text-[#0052cc] border-[#0052cc]/30 hover:bg-[#ebf5ff] hover:border-[#0052cc]/50'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.53 2.13a.75.75 0 0 0-1.06 0L2.13 10.47a.75.75 0 0 0 0 1.06l8.34 8.34a.75.75 0 0 0 1.06 0l8.34-8.34a.75.75 0 0 0 0-1.06zm-.53 14.6L3.69 11 11 3.69 18.31 11z" />
                      </svg>
                      Jira
                      <span className="material-symbols-outlined text-[14px]">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    <Button variant="ghost" size="sm" icon="visibility" onClick={() => handleOpenReview(req, 'review')}>
                      Review
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon="check_circle"
                      onClick={(e) => handleQuickApprove(e, req)}
                      className="bg-[#22874e] hover:bg-[#1a6e3e]"
                    >
                      Approve
                    </Button>
                    <Button variant="danger" size="sm" icon="cancel" onClick={() => handleOpenReview(req, 'reject')}>
                      Reject
                    </Button>
                  </div>
                </div>

                {/* Reason */}
                {req.reason && (
                  <div className="mt-4 pt-3 border-t border-[#dfe5e8]/70 flex items-start gap-2 bg-[#f8fbfb] p-3 rounded-xl">
                    <span className="material-symbols-outlined text-[16px] text-[#687781] shrink-0 mt-0.5">chat_bubble_outline</span>
                    <p className="text-xs text-[#3e494a] italic leading-relaxed">"{req.reason}"</p>
                  </div>
                )}

                {/* Jira panel */}
                {isExpanded && (
                  <JiraPanel
                    employeeName={req.employeeName}
                    startDate={req.startDate}
                    endDate={req.endDate}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}


      {/* Review Modal */}
      <LeaveApprovalModal
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        initialMode={modalMode}
      />
    </div>
  );
}
