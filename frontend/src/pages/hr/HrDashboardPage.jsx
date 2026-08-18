import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeave } from '../../context/LeaveContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { HrReviewModal } from '../../components/common/HrReviewModal.jsx';

export function HrDashboardPage() {
  const navigate = useNavigate();
  const { getOrganizationStats, getOrganizationRequests, getAuditLogs } = useLeave();
  const stats = getOrganizationStats();
  const allRequests = getOrganizationRequests();
  const recentLogs = getAuditLogs().slice(0, 5);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalMode, setModalMode] = useState('review');

  const pendingRequests = allRequests.filter((r) => r.status === 'pending');
  const recentRequests = allRequests.slice(0, 6);

  const handleOpenReview = (request, mode = 'review') => {
    setSelectedRequest(request);
    setModalMode(mode);
  };

  const handleCloseReview = () => {
    setSelectedRequest(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="HR Overview"
        subtitle="Organization-wide leave activity and workforce overview."
      >
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon="description"
            onClick={() => navigate('/hr/reports')}
          >
            Leave Reports
          </Button>
          <Button
            variant="primary"
            icon="checklist"
            onClick={() => navigate('/hr/all-requests')}
          >
            Review All Requests
          </Button>
        </div>
      </PageHeader>

      {/* 6 Key Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 1. Total Employees */}
        <Card className="p-4 flex flex-col justify-between hover:border-[#00646f]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Staff</span>
            <span className="material-symbols-outlined text-[#00646f] text-[20px]">groups</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-[#0f1d27] block">{stats.totalEmployees}</span>
            <span className="text-[11px] text-[#687781]">Active team members</span>
          </div>
        </Card>

        {/* 2. Employees on leave today */}
        <Card className="p-4 flex flex-col justify-between hover:border-[#00646f]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">On Leave Today</span>
            <span className="material-symbols-outlined text-[#00646f] text-[20px]">beach_access</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-[#0f1d27] block">{stats.onLeaveToday}</span>
            <span className="text-[11px] text-[#00646f] font-semibold">{stats.onLeavePercentage}% of workforce</span>
          </div>
        </Card>

        {/* 3. Pending Requests */}
        <Card className="p-4 flex flex-col justify-between hover:border-[#b7791f]/50 transition-colors border-[#b7791f]/20 bg-[#fffdfa]">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
            <span className="material-symbols-outlined text-[#b7791f] text-[20px]">pending_actions</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-[#b7791f] block">{stats.pendingApprovals}</span>
            <span className="text-[11px] text-[#687781]">Awaiting review</span>
          </div>
        </Card>

        {/* 4. Approved this month */}
        <Card className="p-4 flex flex-col justify-between hover:border-[#22874e]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Approved (Oct)</span>
            <span className="material-symbols-outlined text-[#22874e] text-[20px]">check_circle</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-[#22874e] block">{stats.approvedThisMonth}</span>
            <span className="text-[11px] text-[#687781]">{stats.approvedThisMonthDays} days taken</span>
          </div>
        </Card>

        {/* 5. Rejected this month */}
        <Card className="p-4 flex flex-col justify-between hover:border-[#ba1a1a]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Rejected (Oct)</span>
            <span className="material-symbols-outlined text-[#ba1a1a] text-[20px]">cancel</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-[#0f1d27] block">{stats.rejectedThisMonth}</span>
            <span className="text-[11px] text-[#687781]">Policy conflicts</span>
          </div>
        </Card>

        {/* 6. Upcoming Leave */}
        <Card className="p-4 flex flex-col justify-between hover:border-[#3d6fa8]/40 transition-colors">
          <div className="flex items-center justify-between text-[#687781] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Upcoming</span>
            <span className="material-symbols-outlined text-[#3d6fa8] text-[20px]">calendar_month</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-[#3d6fa8] block">{stats.upcomingLeave}</span>
            <span className="text-[11px] text-[#687781]">Scheduled leaves</span>
          </div>
        </Card>
      </div>

      {/* Analytics & Department Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Department Utilization */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#0f1d27]">Department Leave Utilization</h3>
              <p className="text-xs text-[#687781]">Approved leave days taken per department</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#f0f4f7] text-[#3e494a]">
              YTD 2026
            </span>
          </div>

          <div className="space-y-4">
            {stats.departmentStats.map((dept) => {
              const maxDays = 50;
              const percentage = Math.min(100, Math.round((dept.totalDays / maxDays) * 100));
              return (
                <div key={dept.department} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#0f1d27]">{dept.department}</span>
                      <span className="text-[11px] text-[#687781]">({dept.employeeCount} staff)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {dept.pendingCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#fff4e5] text-[#b7791f] text-[10px] font-bold">
                          {dept.pendingCount} pending
                        </span>
                      )}
                      <span className="font-bold text-[#00646f]">{dept.totalDays} Days</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#f0f4f7] h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-[#00646f] h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 2. Leave Types & Status Split */}
        <div className="space-y-6">
          {/* Leave by Type */}
          <Card className="p-6">
            <h3 className="text-base font-bold text-[#0f1d27] mb-1">Leave Types Distribution</h3>
            <p className="text-xs text-[#687781] mb-4">Total requests filed by category</p>
            <div className="space-y-3">
              {stats.leaveTypeStats.map((item) => (
                <div key={item.key} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fbfb] border border-[#dfe5e8]/60">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-semibold text-[#0f1d27]">{item.type}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#0f1d27] block">{item.count} requests</span>
                    <span className="text-[10px] text-[#687781]">{item.days} days approved</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Stat Summary */}
          <Card className="p-6 bg-gradient-to-br from-[#f8fbfb] to-[#ebf5ff]/40 border-[#00646f]/20">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-[#00646f] text-[24px]">verified</span>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#00646f]">Statutory Quota Compliance</h4>
                <p className="text-[11px] text-[#687781]">Organization-wide leave policy audit</p>
              </div>
            </div>
            <p className="text-xs text-[#3e494a] leading-relaxed">
              All 22 active organization balances are within mandatory regulatory thresholds. Average annual PTO utilization is at <span className="font-bold text-[#0f1d27]">44.2%</span> for Q3/Q4.
            </p>
          </Card>
        </div>
      </div>

      {/* Pending Approvals & Immediate HR Actions */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#0f1d27]">Organization Requests Awaiting Action</h3>
            <p className="text-xs text-[#687781]">
              Pending leaves from all departments requiring manager or HR review
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/hr/all-requests')}
          >
            View All ({allRequests.length})
          </Button>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="p-8 text-center bg-[#f8fbfb] rounded-xl border border-[#dfe5e8] text-xs text-[#687781]">
            <span className="material-symbols-outlined text-[#22874e] text-[36px] block mb-2">
              check_circle
            </span>
            No pending leave requests in the organization queue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#dfe5e8] text-[11px] font-bold text-[#687781] uppercase tracking-wider">
                  <th className="pb-3 px-3">Employee</th>
                  <th className="pb-3 px-3">Department</th>
                  <th className="pb-3 px-3">Leave Type</th>
                  <th className="pb-3 px-3">Dates</th>
                  <th className="pb-3 px-3">Days</th>
                  <th className="pb-3 px-3">Manager</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe5e8]/60 text-xs">
                {pendingRequests.slice(0, 5).map((req) => (
                  <tr key={req.id} className="hover:bg-[#ebf5ff]/30 transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#0f1d27]">
                      {req.employeeName}
                    </td>
                    <td className="py-3 px-3 text-[#3e494a]">{req.department}</td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-[#00646f]">{req.leaveType}</span>
                    </td>
                    <td className="py-3 px-3 text-[#687781]">{req.dateDisplay}</td>
                    <td className="py-3 px-3 font-bold text-[#0f1d27]">{req.durationDays}d</td>
                    <td className="py-3 px-3 text-[#687781]">{req.managerName || 'Sarah Mitchell'}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(req, 'review')}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#00646f] hover:bg-[#ebf5ff] transition-colors cursor-pointer"
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Dialog */}
      {selectedRequest && (
        <HrReviewModal
          isOpen={!!selectedRequest}
          onClose={handleCloseReview}
          request={selectedRequest}
          initialMode={modalMode}
        />
      )}
    </div>
  );
}
