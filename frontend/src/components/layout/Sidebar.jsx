import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLeave } from '../../context/LeaveContext.jsx';
import { ProfileModal } from '../common/ProfileModal.jsx';

export function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const { role, currentUser } = useAuth();
  const { getPendingApprovals, getOrganizationStats } = useLeave();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const pendingApprovalsCount = role === 'manager' ? getPendingApprovals(currentUser?.id).length : 0;
  const hrPendingCount = role === 'hr' ? getOrganizationStats().pendingApprovals : 0;

  const getNavLinkClass = ({ isActive }) =>
    `flex items-center px-4 py-2.5 rounded-xl transition-all font-medium text-sm gap-3 ${
      isActive
        ? 'bg-[#0875e1] text-white font-semibold shadow-xs'
        : 'text-[#1b2533] hover:bg-[#ebf5ff] hover:text-[#0875e1]'
    }`;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-[#002244]/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-[260px] bg-white z-50 flex flex-col border-r border-[#d8dde6] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-2.5 border-b border-[#d8dde6]/60">
          <div className="w-8 h-8 rounded-lg bg-[#0875e1] text-white flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[20px]">calendar_clock</span>
          </div>
          <span className="text-base font-bold text-[#002244] tracking-tight">
            LeaveTrack
          </span>
        </div>

        {/* Navigation List - Role Segregated */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {/* ================= EMPLOYEE NAVIGATION ================= */}
          {role === 'employee' && (
            <>
              <div className="px-3 pt-2 pb-1.5">
                <span className="text-[11px] font-bold text-[#687781] uppercase tracking-wider">
                  Employee Menu
                </span>
              </div>

              <NavLink
                to="/employee/dashboard"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">dashboard</span>
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/employee/my-leave"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">beach_access</span>
                <span>My Leave</span>
              </NavLink>

              <NavLink
                to="/employee/request-leave"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                <span>Request Leave</span>
              </NavLink>

              <NavLink
                to="/employee/track-requests"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">history</span>
                <span>Track Requests</span>
              </NavLink>
            </>
          )}

          {/* ================= MANAGER NAVIGATION ================= */}
          {role === 'manager' && (
            <>
              <div className="px-3 pt-2 pb-1.5">
                <span className="text-[11px] font-bold text-[#687781] uppercase tracking-wider">
                  Manager Menu
                </span>
              </div>

              <NavLink
                to="/manager/dashboard"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">dashboard</span>
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/manager/my-leave"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">beach_access</span>
                <span>My Leave</span>
              </NavLink>

              <NavLink
                to="/manager/team-requests"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">group</span>
                <span>Team Requests</span>
              </NavLink>

              <NavLink
                to="/manager/approvals"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">fact_check</span>
                <span className="flex-1">Approvals</span>
                {pendingApprovalsCount > 0 && (
                  <span className="bg-[#b7791f] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pendingApprovalsCount}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/manager/calendar"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                <span>Team Calendar</span>
              </NavLink>
            </>
          )}

          {/* ================= HR ADMIN NAVIGATION ================= */}
          {role === 'hr' && (
            <>
              <div className="px-3 pt-2 pb-1.5">
                <span className="text-[11px] font-bold text-[#687781] uppercase tracking-wider">
                  HR Administration
                </span>
              </div>

              <NavLink
                to="/hr/dashboard"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">dashboard</span>
                <span>HR Dashboard</span>
              </NavLink>

              <NavLink
                to="/hr/all-requests"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">ballot</span>
                <span className="flex-1">All Requests</span>
                {hrPendingCount > 0 && (
                  <span className="bg-[#b7791f] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {hrPendingCount}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/hr/employees"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">badge</span>
                <span>Employees</span>
              </NavLink>

              <NavLink
                to="/hr/reports"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">analytics</span>
                <span>Reports</span>
              </NavLink>

              <NavLink
                to="/hr/audit-logs"
                className={getNavLinkClass}
                onClick={onCloseMobile}
              >
                <span className="material-symbols-outlined text-[20px]">shield</span>
                <span>Audit Logs</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Footer User Info & Profile Access */}
        <div className="p-3 border-t border-[#d8dde6] bg-[#f4f6f8]/50 space-y-2">
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-[#d8dde6] hover:bg-[#ebf5ff] hover:border-[#0875e1] transition-colors flex items-center justify-between text-left cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#0875e1] text-[18px]">
                account_circle
              </span>
              <span className="text-xs font-semibold text-[#1b2533]">Profile Details</span>
            </div>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#ebf5ff] text-[#0875e1]">
              {role}
            </span>
          </button>
        </div>
      </aside>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
}
