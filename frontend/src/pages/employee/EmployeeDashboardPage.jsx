import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { LeaveDetailsModal } from '../../components/common/LeaveDetailsModal.jsx';

export function EmployeeDashboardPage() {
  const { currentUser } = useAuth();
  const { getMyRequests, getUserBalances } = useLeave();
  const navigate = useNavigate();
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Dynamic user data & isolated requests
  const myRequests = getMyRequests(currentUser?.id);
  const balances = getUserBalances(currentUser?.id);

  // Summary counts
  const pendingRequests = myRequests.filter((r) => r.status === 'pending');
  const draftRequests = myRequests.filter((r) => r.status === 'draft');
  const recentRequests = myRequests.slice(0, 5);

  // Upcoming approved leave
  const upcomingApproved = myRequests.find(
    (r) => r.status === 'approved' && new Date(r.startDate) >= new Date('2026-08-01')
  );

  const firstName = currentUser?.name?.split(' ')[0] || 'Rahul';

  return (
    <div className="space-y-6">
      {/* Welcome Banner Card */}
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6">
        <div className="flex items-center gap-4">
          {currentUser?.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#087f8c] text-[#effdff] flex items-center justify-center font-bold text-xl shadow-sm">
              {currentUser?.initial || currentUser?.name?.charAt(0) || 'R'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f1d27]">
              Welcome back, {firstName}
            </h1>
            <p className="text-xs sm:text-sm text-[#687781] mt-0.5">
              {pendingRequests.length > 0 ? (
                <span>
                  You have{' '}
                  <strong className="text-[#b7791f]">
                    {pendingRequests.length} pending leave {pendingRequests.length === 1 ? 'request' : 'requests'}
                  </strong>{' '}
                  awaiting review.
                </span>
              ) : (
                'Here is an overview of your leave balances and recent activity.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {draftRequests.length > 0 && (
            <Button
              variant="outline"
              icon="edit_note"
              onClick={() => navigate('/employee/my-leave')}
              className="flex-1 md:flex-none"
            >
              Drafts ({draftRequests.length})
            </Button>
          )}
          <Button
            variant="outline"
            icon="history"
            onClick={() => navigate('/employee/my-leave')}
            className="flex-1 md:flex-none"
          >
            Track Requests
          </Button>
          <Button
            variant="primary"
            icon="add"
            onClick={() => navigate('/employee/request-leave')}
            className="flex-1 md:flex-none"
          >
            Request Leave
          </Button>
        </div>
      </Card>

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Annual Leave */}
        <Card className="flex flex-col justify-between hover:-translate-y-0.5 transition-all p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-[#0f1d27]">
              <span className="material-symbols-outlined text-[#00646f] p-1.5 bg-[#ebf5ff] rounded-lg text-[20px]">
                flight_takeoff
              </span>
              <h2 className="text-sm font-semibold">Annual Leave</h2>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-3xl font-bold text-[#0f1d27]">
                {balances.annual?.remaining ?? 8}
              </span>
              <span className="text-sm text-[#687781]">days available</span>
            </div>
            <p className="text-xs text-[#687781] mb-3">
              {balances.annual?.used ?? 0} of {balances.annual?.total ?? 20} days used
            </p>
            <div className="w-full bg-[#d5e4f3] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#00646f] h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, ((balances.annual?.remaining ?? 8) / (balances.annual?.total ?? 20)) * 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </Card>

        {/* Sick Leave */}
        <Card className="flex flex-col justify-between hover:-translate-y-0.5 transition-all p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-[#0f1d27]">
              <span className="material-symbols-outlined text-[#b7791f] p-1.5 bg-[#b7791f]/10 rounded-lg text-[20px]">
                medical_services
              </span>
              <h2 className="text-sm font-semibold">Sick Leave</h2>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-3xl font-bold text-[#0f1d27]">
                {balances.sick?.remaining ?? 8}
              </span>
              <span className="text-sm text-[#687781]">days available</span>
            </div>
            <p className="text-xs text-[#687781] mb-3">
              {balances.sick?.used ?? 0} of {balances.sick?.total ?? 12} days used
            </p>
            <div className="w-full bg-[#d5e4f3] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#b7791f] h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, ((balances.sick?.remaining ?? 8) / (balances.sick?.total ?? 12)) * 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </Card>

        {/* Casual Leave */}
        <Card className="flex flex-col justify-between hover:-translate-y-0.5 transition-all p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-[#0f1d27]">
              <span className="material-symbols-outlined text-[#3d6fa8] p-1.5 bg-[#3d6fa8]/10 rounded-lg text-[20px]">
                event_available
              </span>
              <h2 className="text-sm font-semibold">Casual Leave</h2>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-3xl font-bold text-[#0f1d27]">
                {balances.casual?.remaining ?? 2}
              </span>
              <span className="text-sm text-[#687781]">days available</span>
            </div>
            <p className="text-xs text-[#687781] mb-3">
              {balances.casual?.used ?? 0} of {balances.casual?.total ?? 6} days used
            </p>
            <div className="w-full bg-[#d5e4f3] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#3d6fa8] h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, ((balances.casual?.remaining ?? 2) / (balances.casual?.total ?? 6)) * 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Split: Recent Requests & Upcoming Leave Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Requests Table */}
        <Card className="lg:col-span-2 p-0 overflow-hidden flex flex-col">
          <div className="p-5 px-6 border-b border-[#dfe5e8] flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00646f]">history</span>
              <h3 className="text-base font-semibold text-[#0f1d27]">Recent Requests</h3>
            </div>
            <button
              onClick={() => navigate('/employee/my-leave')}
              className="text-xs font-semibold text-[#00646f] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>View All</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f7f8]/70 border-b border-[#dfe5e8]">
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="p-3.5 px-6 text-xs font-semibold text-[#687781] uppercase tracking-wider text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe5e8]/60">
                {recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-xs text-[#687781]">
                      No leave requests found. Click "Request Leave" to submit your first request.
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-[#ebf5ff]/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedRequest(req)}
                    >
                      <td className="p-4 px-6">
                        <div className="flex items-center gap-2">
                          {req.typeKey === 'annual' && (
                            <span className="material-symbols-outlined text-[#00646f] text-[18px]">
                              flight_takeoff
                            </span>
                          )}
                          {req.typeKey === 'sick' && (
                            <span className="material-symbols-outlined text-[#b7791f] text-[18px]">
                              medical_services
                            </span>
                          )}
                          {req.typeKey === 'casual' && (
                            <span className="material-symbols-outlined text-[#3d6fa8] text-[18px]">
                              event_available
                            </span>
                          )}
                          {req.typeKey === 'unpaid' && (
                            <span className="material-symbols-outlined text-[#687781] text-[18px]">
                              calendar_today
                            </span>
                          )}
                          <span className="text-sm font-medium text-[#0f1d27]">
                            {req.leaveType}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 px-6 text-xs text-[#3e494a]">{req.dateDisplay}</td>
                      <td className="p-4 px-6 text-xs text-[#3e494a] font-medium">
                        {req.durationDays} {req.durationDays === 1 ? 'day' : 'days'}
                      </td>
                      <td className="p-4 px-6 text-right">
                        <Badge variant={req.status}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Upcoming Approved Leave Card */}
        <Card className="p-0 overflow-hidden flex flex-col justify-between">
          <div className="p-5 px-6 border-b border-[#dfe5e8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00646f]">upcoming</span>
              <h3 className="text-base font-semibold text-[#0f1d27]">Upcoming Leave</h3>
            </div>
            {upcomingApproved && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#2e7d5b]/10 text-[#2e7d5b]">
                Approved
              </span>
            )}
          </div>

          <div className="p-6 flex flex-col gap-4">
            {upcomingApproved ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#00646f] mt-0.5">event_available</span>
                  <div>
                    <h4 className="text-sm font-bold text-[#0f1d27]">
                      {upcomingApproved.reason?.split('•')[0] || 'Scheduled Time Off'}
                    </h4>
                    <p className="text-xs text-[#687781] mt-0.5">
                      {upcomingApproved.leaveType} &middot; {upcomingApproved.durationDays} Days
                    </p>
                  </div>
                </div>

                <div className="bg-[#f5f7fa] flex items-center justify-between p-3 rounded-lg border border-[#dfe5e8]">
                  <div className="text-left">
                    <div className="text-[10px] font-bold text-[#687781] uppercase">Starts</div>
                    <div className="text-xs font-semibold text-[#0f1d27]">
                      {upcomingApproved.startDate}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#687781] text-[18px]">
                    arrow_right_alt
                  </span>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-[#687781] uppercase">Ends</div>
                    <div className="text-xs font-semibold text-[#0f1d27]">
                      {upcomingApproved.endDate}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-4 text-center">
                <span className="material-symbols-outlined text-[#b0bec5] text-4xl mb-2">event_busy</span>
                <p className="text-sm text-[#687781]">No upcoming leave scheduled</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Details Modal */}
      <LeaveDetailsModal
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
      />
    </div>
  );
}
