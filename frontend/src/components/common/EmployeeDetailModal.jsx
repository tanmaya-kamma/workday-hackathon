import React from 'react';
import { useLeave } from '../../context/LeaveContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { Button } from './Button.jsx';

export function EmployeeDetailModal({ isOpen, onClose, employee, onSelectRequest }) {
  const { getMyRequests, getUserBalances } = useLeave();

  if (!isOpen || !employee) return null;

  const balances = getUserBalances(employee.id);
  const employeeRequests = getMyRequests(employee.id);
  const approvedReqs = employeeRequests.filter((r) => r.status === 'approved');
  const pendingReqs = employeeRequests.filter((r) => r.status === 'pending');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#dfe5e8] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#dfe5e8] flex items-center justify-between bg-[#f8fbfb]">
          <div className="flex items-center gap-3">
            {employee.avatar ? (
              <img
                src={employee.avatar}
                alt={employee.name}
                className="w-12 h-12 rounded-full object-cover border border-[#dfe5e8]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#00646f] text-white flex items-center justify-center font-bold text-sm">
                {employee.initials || employee.name?.slice(0, 2).toUpperCase() || 'EM'}
              </div>
            )}
            <div>
              <h2 id="employee-modal-title" className="text-base font-bold text-[#0f1d27]">
                {employee.name}
              </h2>
              <p className="text-xs text-[#687781]">{employee.position || 'Team Member'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#687781] hover:bg-[#ebf5ff] hover:text-[#0f1d27] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[calc(85vh-130px)] overflow-y-auto space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f5f7f8] p-4 rounded-xl border border-[#dfe5e8]">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#687781] block">Department</span>
              <span className="text-xs font-semibold text-[#0f1d27]">{employee.department}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#687781] block">Reporting Manager</span>
              <span className="text-xs font-semibold text-[#00646f]">{employee.managerName || 'Sarah Mitchell'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#687781] block">Employment Role</span>
              <span className="text-xs font-semibold capitalize text-[#0f1d27]">{employee.role}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-[#687781] block">Joined Company</span>
              <span className="text-xs font-semibold text-[#687781]">{employee.joinDate || '2023'}</span>
            </div>
          </div>

          {/* Leave Quota Balances */}
          <div>
            <h3 className="text-xs font-bold text-[#0f1d27] uppercase tracking-wider mb-3">
              Leave Quotas & Balances
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#dfe5e8]">
                <span className="text-[11px] font-medium text-[#687781] block mb-1">Annual Leave</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-[#00646f]">{balances.annual.remaining}</span>
                  <span className="text-xs text-[#687781]">/ {balances.annual.total} days</span>
                </div>
                <div className="w-full bg-[#f0f4f7] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#00646f] h-full rounded-full"
                    style={{ width: `${(balances.annual.used / balances.annual.total) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#dfe5e8]">
                <span className="text-[11px] font-medium text-[#687781] block mb-1">Sick Leave</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-[#0f1d27]">{balances.sick.remaining}</span>
                  <span className="text-xs text-[#687781]">/ {balances.sick.total} days</span>
                </div>
                <div className="w-full bg-[#f0f4f7] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#b7791f] h-full rounded-full"
                    style={{ width: `${(balances.sick.used / balances.sick.total) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#dfe5e8]">
                <span className="text-[11px] font-medium text-[#687781] block mb-1">Casual Leave</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-[#3d6fa8]">{balances.casual.remaining}</span>
                  <span className="text-xs text-[#687781]">/ {balances.casual.total} days</span>
                </div>
                <div className="w-full bg-[#f0f4f7] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#3d6fa8] h-full rounded-full"
                    style={{ width: `${(balances.casual.used / balances.casual.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Leave History List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[#0f1d27] uppercase tracking-wider">
                Leave Requests ({employeeRequests.length})
              </h3>
              <span className="text-xs text-[#687781]">
                {pendingReqs.length} pending, {approvedReqs.length} approved
              </span>
            </div>

            {employeeRequests.length === 0 ? (
              <div className="p-6 text-center bg-[#f8fbfb] rounded-xl border border-[#dfe5e8] text-xs text-[#687781]">
                No leave requests filed yet by this employee.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {employeeRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-white rounded-xl border border-[#dfe5e8] flex items-center justify-between hover:border-[#00646f]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[#00646f] text-[20px]">
                        {req.typeKey === 'sick' ? 'medical_services' : 'event_note'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#0f1d27]">{req.leaveType}</span>
                          <span className="text-[11px] text-[#687781]">({req.durationDays} days)</span>
                        </div>
                        <span className="text-[11px] text-[#687781] block">{req.dateDisplay}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={req.status} />
                      {onSelectRequest && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectRequest(req);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#00646f] hover:bg-[#ebf5ff] transition-colors cursor-pointer"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#dfe5e8] bg-[#f8fbfb] flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
