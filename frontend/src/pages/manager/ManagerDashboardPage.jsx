import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { LeaveApprovalModal } from '../../components/common/LeaveApprovalModal.jsx';

export function ManagerDashboardPage() {
  const { currentUser } = useAuth();
  const { getTeamRequests, getPendingApprovals, getTeamMembers, approveLeaveRequest } = useLeave();
  const navigate = useNavigate();

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalMode, setModalMode] = useState('review');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Scoped strictly to the current manager's team
  const teamRequests = getTeamRequests(currentUser?.id);
  const pendingApprovals = getPendingApprovals(currentUser?.id);
  const teamMembers = getTeamMembers(currentUser?.id);

  // Calculate dynamic metrics
  const approvedTeamRequests = teamRequests.filter((r) => r.status === 'approved');

  // Currently on leave calculation (for simulated timeline / Oct 2026)
  const currentlyOnLeave = approvedTeamRequests.filter((r) => {
    // Check if date overlaps with Oct 05-15, 2026 window or active today
    return r.startDate <= '2026-10-15' && r.endDate >= '2026-10-05';
  });

  // Upcoming leave (approved requests starting after Oct 15, 2026)
  const upcomingTeamLeave = approvedTeamRequests.filter((r) => r.startDate >= '2026-10-16');

  // Filtered recent team requests for the table
  const filteredRequests = teamRequests.filter((req) => {
    const matchesSearch =
      req.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.leaveType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.reason && req.reason.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenReview = (req, mode = 'review') => {
    setSelectedRequest(req);
    setModalMode(mode);
  };

  const handleQuickApprove = (e, req) => {
    e.stopPropagation();
    approveLeaveRequest(req.id, 'Quick approved by manager');
  };

  return (
    <div className="space-y-6">
      {/* Personalized Greeting Header */}
      <PageHeader
        title={`Welcome back, ${currentUser?.name || 'Manager'}`}
        subtitle={`Overview for ${currentUser?.department || 'Department'} Team (${teamMembers.length} direct reports)`}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon="calendar_month"
            onClick={() => navigate('/manager/calendar')}
          >
            Team Calendar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="pending_actions"
            onClick={() => navigate('/manager/approvals')}
          >
            Review Approvals ({pendingApprovals.length})
          </Button>
        </div>
      </PageHeader>

      {/* Top Bento Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Pending Approvals */}
        <div
          onClick={() => navigate('/manager/approvals')}
          className="bg-white p-5 rounded-2xl border border-[#dfe5e8] shadow-xs hover:border-[#00646f] transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#687781] block">
                Pending Approvals
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold text-[#0f1d27] group-hover:text-[#00646f] transition-colors">
                  {pendingApprovals.length}
                </span>
                {pendingApprovals.length > 0 && (
                  <span className="text-xs font-semibold text-[#b7791f] bg-[#fff8e1] px-2 py-0.5 rounded-full border border-[#b7791f]/30">
                    Needs Action
                  </span>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#fff8e1] text-[#b7791f] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#dfe5e8]/60 flex items-center justify-between text-xs text-[#687781]">
            <span>Direct Reports Queue</span>
            <span className="text-[#00646f] font-semibold group-hover:translate-x-0.5 transition-transform">
              Review →
            </span>
          </div>
        </div>

        {/* Metric 2: Team Members Count */}
        <div className="bg-white p-5 rounded-2xl border border-[#dfe5e8] shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#687781] block">
                Team Size
              </span>
              <span className="text-3xl font-bold text-[#0f1d27] mt-1 block">
                {teamMembers.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#ebf5ff] text-[#3d6fa8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">group</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#dfe5e8]/60 flex items-center gap-1.5 text-xs text-[#687781]">
            <span className="material-symbols-outlined text-[16px] text-[#00646f]">domain</span>
            <span>{currentUser?.department} Department</span>
          </div>
        </div>

        {/* Metric 3: Employees Currently on Leave */}
        <div className="bg-white p-5 rounded-2xl border border-[#dfe5e8] shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#687781] block">
                Currently on Leave
              </span>
              <span className="text-3xl font-bold text-[#0f1d27] mt-1 block">
                {currentlyOnLeave.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#00646f]/10 text-[#00646f] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">flight_takeoff</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#dfe5e8]/60 flex items-center justify-between text-xs text-[#687781]">
            {currentlyOnLeave.length > 0 ? (
              <span className="text-[#00646f] font-medium truncate">
                {currentlyOnLeave.map((r) => r.employeeName.split(' ')[0]).join(', ')} away
              </span>
            ) : (
              <span>Full team available today</span>
            )}
          </div>
        </div>

        {/* Metric 4: Upcoming Team Leave */}
        <div className="bg-white p-5 rounded-2xl border border-[#dfe5e8] shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#687781] block">
                Upcoming Leaves
              </span>
              <span className="text-3xl font-bold text-[#0f1d27] mt-1 block">
                {upcomingTeamLeave.length}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#d8f3e5] text-[#22874e] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">event_available</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#dfe5e8]/60 flex items-center justify-between text-xs text-[#687781]">
            <span>Scheduled for Q4</span>
            <span
              onClick={() => navigate('/manager/calendar')}
              className="text-[#00646f] font-semibold cursor-pointer hover:underline"
            >
              View Calendar
            </span>
          </div>
        </div>
      </div>

      {/* Quick Approvals Banner if pending exists */}
      {pendingApprovals.length > 0 && (
        <div className="p-4 bg-linear-to-r from-[#fff8e1] to-[#fef3c7] rounded-2xl border border-[#b7791f]/30 flex items-center justify-between flex-wrap gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#b7791f] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">notifications_active</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f1d27]">
                You have {pendingApprovals.length} pending leave request{pendingApprovals.length > 1 ? 's' : ''} awaiting your decision
              </h3>
              <p className="text-xs text-[#687781]">
                Quick review: {pendingApprovals.map((r) => `${r.employeeName} (${r.leaveType})`).join(' • ')}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon="arrow_forward"
            iconPosition="right"
            onClick={() => navigate('/manager/approvals')}
            className="bg-[#b7791f] hover:bg-[#966316] text-white border-transparent"
          >
            Review Pending Queue
          </Button>
        </div>
      )}

      {/* Recent Team Requests Section */}
      <Card className="p-0 overflow-hidden border-[#dfe5e8]">
        {/* Table Header & Controls */}
        <div className="p-5 border-b border-[#dfe5e8] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
          <div>
            <h3 className="text-base font-bold text-[#0f1d27]">Recent Team Requests</h3>
            <p className="text-xs text-[#687781]">
              Leave activity and submissions from your direct reports
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#687781] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team requests..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f5f7f8] border border-[#dfe5e8] rounded-xl text-[#0f1d27] placeholder-[#687781] focus:outline-none focus:border-[#00646f]"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center bg-[#f5f7f8] p-1 rounded-xl border border-[#dfe5e8]">
              {['all', 'pending', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                    statusFilter === status
                      ? 'bg-white text-[#00646f] shadow-2xs'
                      : 'text-[#687781] hover:text-[#0f1d27]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fbfb] border-b border-[#dfe5e8]">
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Employee
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Leave Type
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Date Range
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Duration
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                  Status
                </th>
                <th className="p-4 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe5e8]/60">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-xs text-[#687781]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[#687781] text-[36px]">
                        inbox
                      </span>
                      <p className="font-semibold text-sm text-[#0f1d27]">
                        No team requests matching your filter criteria.
                      </p>
                      <p className="text-xs text-[#687781]">
                        Try clearing your search or status filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => handleOpenReview(req, 'review')}
                    className="hover:bg-[#ebf5ff]/30 transition-colors cursor-pointer"
                  >
                    <td className="p-4 px-6">
                      <div className="flex items-center gap-3">
                        {req.avatar ? (
                          <img
                            src={req.avatar}
                            alt={req.employeeName}
                            className="w-9 h-9 rounded-full object-cover border border-[#dfe5e8]"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-xs">
                            {req.initials || req.employeeName?.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-[#0f1d27] hover:text-[#00646f]">
                            {req.employeeName}
                          </p>
                          <p className="text-[11px] text-[#687781]">{req.position || req.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 px-6">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#00646f]">
                          {req.typeKey === 'sick' ? 'medical_services' : 'event'}
                        </span>
                        <span className="text-xs font-medium text-[#0f1d27]">{req.leaveType}</span>
                      </div>
                    </td>
                    <td className="p-4 px-6 text-xs text-[#3e494a]">{req.dateDisplay}</td>
                    <td className="p-4 px-6 text-xs font-bold text-[#00646f]">
                      {req.durationDays} {req.durationDays === 1 ? 'day' : 'days'}
                    </td>
                    <td className="p-4 px-6">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="p-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="visibility"
                          onClick={() => handleOpenReview(req, 'review')}
                        >
                          Review
                        </Button>
                        {req.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleQuickApprove(e, req)}
                              className="p-1.5 text-[#22874e] hover:bg-[#d8f3e5] rounded-lg transition-colors cursor-pointer"
                              title="Quick Approve"
                            >
                              <span className="material-symbols-outlined text-[18px]">check</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReview(req, 'reject')}
                              className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors cursor-pointer"
                              title="Reject with Reason"
                            >
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reusable Approval & Review Modal */}
      <LeaveApprovalModal
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        initialMode={modalMode}
      />
    </div>
  );
}
