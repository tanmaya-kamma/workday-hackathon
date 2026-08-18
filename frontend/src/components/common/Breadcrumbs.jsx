import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getRoleHome } from '../../utils/roleUtils.js';

export function Breadcrumbs() {
  const { role } = useAuth();
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const routeNameMap = {
    employee: 'Employee',
    manager: 'Manager',
    hr: 'HR Admin',
    dashboard: 'Dashboard',
    'employee-dashboard': 'Dashboard',
    'manager-dashboard': 'Dashboard',
    'hr-dashboard': 'Dashboard',
    'request-leave': 'Request Leave',
    'my-leave': 'My Leave',
    'my-requests': 'My Leave',
    'track-requests': 'Track Requests',
    'team-requests': 'Team Requests',
    approvals: 'Approvals',
    'team-approvals': 'Approvals',
    calendar: 'Team Calendar',
    'team-calendar': 'Team Calendar',
    employees: 'Employees',
    directory: 'Employees',
    'all-requests': 'All Requests',
    requests: 'All Requests',
    reports: 'Reports',
    'audit-logs': 'Audit Logs',
    profile: 'User Profile',
  };

  if (pathnames.length === 0 || location.pathname === '/login' || location.pathname === '/signup') {
    return null;
  }

  const homePath = getRoleHome(role);

  return (
    <nav className="flex items-center gap-1.5 text-xs text-[#687781] mb-4">
      <Link to={homePath} className="hover:text-[#00646f] transition-colors flex items-center gap-1">
        <span className="material-symbols-outlined text-[16px]">home</span>
        <span>Home</span>
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const displayName = routeNameMap[value] || value.replace('-', ' ');

        return (
          <React.Fragment key={to}>
            <span className="material-symbols-outlined text-[14px] text-[#bdc9ca]">
              chevron_right
            </span>
            {isLast ? (
              <span className="font-semibold text-[#0f1d27] capitalize">{displayName}</span>
            ) : (
              <Link to={to} className="hover:text-[#00646f] transition-colors capitalize">
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
