import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx';
import { RoleRoute } from './components/layout/RoleRoute.jsx';
import { getRoleHome } from './utils/roleUtils.js';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { SignupPage } from './pages/auth/SignupPage.jsx';

// Employee Pages
import { EmployeeDashboardPage } from './pages/employee/EmployeeDashboardPage.jsx';
import { RequestLeavePage } from './pages/employee/RequestLeavePage.jsx';
import { MyRequestsPage } from './pages/employee/MyRequestsPage.jsx';
import { WhatIfPage } from './pages/employee/WhatIfPage.jsx';

// Manager Pages
import { ManagerDashboardPage } from './pages/manager/ManagerDashboardPage.jsx';
import { TeamRequestsPage } from './pages/manager/TeamRequestsPage.jsx';
import { PendingApprovalsPage } from './pages/manager/PendingApprovalsPage.jsx';
import { TeamCalendarPage } from './pages/manager/TeamCalendarPage.jsx';

// HR Admin Pages
import { HrDashboardPage } from './pages/hr/HrDashboardPage.jsx';
import { AllRequestsPage } from './pages/hr/AllRequestsPage.jsx';
import { DirectoryPage } from './pages/hr/DirectoryPage.jsx';
import { ReportsPage } from './pages/hr/ReportsPage.jsx';
import { AuditLogsPage } from './pages/hr/AuditLogsPage.jsx';

function RoleHomeRedirect() {
  const { role, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getRoleHome(role)} replace />;
}

export function App() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected App Layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RoleHomeRedirect />} />

        {/* Employee Routes */}
        <Route path="/employee/dashboard" element={<RoleRoute allowedRoles={['employee']}><EmployeeDashboardPage /></RoleRoute>} />
        <Route path="/employee/my-leave" element={<RoleRoute allowedRoles={['employee']}><MyRequestsPage /></RoleRoute>} />
        <Route path="/employee/request-leave" element={<RoleRoute allowedRoles={['employee']}><RequestLeavePage /></RoleRoute>} />
        <Route path="/employee/what-if" element={<RoleRoute allowedRoles={['employee']}><WhatIfPage /></RoleRoute>} />

        {/* Manager Routes */}
        <Route path="/manager/dashboard" element={<RoleRoute allowedRoles={['manager']}><ManagerDashboardPage /></RoleRoute>} />
        <Route path="/manager/my-leave" element={<RoleRoute allowedRoles={['manager']}><MyRequestsPage /></RoleRoute>} />
        <Route path="/manager/request-leave" element={<RoleRoute allowedRoles={['manager']}><RequestLeavePage /></RoleRoute>} />
        <Route path="/manager/team-requests" element={<RoleRoute allowedRoles={['manager']}><TeamRequestsPage /></RoleRoute>} />
        <Route path="/manager/approvals" element={<RoleRoute allowedRoles={['manager']}><PendingApprovalsPage /></RoleRoute>} />
        <Route path="/manager/calendar" element={<RoleRoute allowedRoles={['manager']}><TeamCalendarPage /></RoleRoute>} />
        <Route path="/manager/what-if" element={<RoleRoute allowedRoles={['manager']}><WhatIfPage /></RoleRoute>} />

        {/* HR Routes */}
        <Route path="/hr/dashboard" element={<RoleRoute allowedRoles={['hr']}><HrDashboardPage /></RoleRoute>} />
        <Route path="/hr/all-requests" element={<RoleRoute allowedRoles={['hr']}><AllRequestsPage /></RoleRoute>} />
        <Route path="/hr/directory" element={<RoleRoute allowedRoles={['hr']}><DirectoryPage /></RoleRoute>} />
        <Route path="/hr/reports" element={<RoleRoute allowedRoles={['hr']}><ReportsPage /></RoleRoute>} />
        <Route path="/hr/audit-logs" element={<RoleRoute allowedRoles={['hr']}><AuditLogsPage /></RoleRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<RoleHomeRedirect />} />
      </Route>
    </Routes>
  );
}

export default App;
