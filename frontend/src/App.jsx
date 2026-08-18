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

/**
 * Directs user silently to their role's specific home dashboard
 */
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

      {/* Protected App Workspace Layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* Dynamic Root Index */}
        <Route path="/" element={<RoleHomeRedirect />} />

        {/* ================= EMPLOYEE ROLE ROUTES ================= */}
        <Route
          path="/employee/dashboard"
          element={
            <RoleRoute allowedRoles={['employee']}>
              <EmployeeDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/employee/my-leave"
          element={
            <RoleRoute allowedRoles={['employee']}>
              <MyRequestsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/employee/request-leave"
          element={
            <RoleRoute allowedRoles={['employee']}>
              <RequestLeavePage />
            </RoleRoute>
          }
        />
        <Route
          path="/employee/track-requests"
          element={
            <RoleRoute allowedRoles={['employee']}>
              <MyRequestsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/employee/my-requests"
          element={
            <RoleRoute allowedRoles={['employee']}>
              <MyRequestsPage />
            </RoleRoute>
          }
        />

        {/* ================= MANAGER ROLE ROUTES ================= */}
        <Route
          path="/manager/dashboard"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <ManagerDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/manager/my-leave"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <MyRequestsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/manager/request-leave"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <RequestLeavePage />
            </RoleRoute>
          }
        />
        <Route
          path="/manager/team-requests"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <TeamRequestsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/manager/approvals"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <PendingApprovalsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/manager/calendar"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <TeamCalendarPage />
            </RoleRoute>
          }
        />
        <Route
          path="/manager/team-calendar"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <TeamCalendarPage />
            </RoleRoute>
          }
        />

        {/* ================= HR ADMIN ROLE ROUTES ================= */}
        <Route
          path="/hr/dashboard"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <HrDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/hr/all-requests"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <AllRequestsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/hr/requests"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <AllRequestsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/hr/employees"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <DirectoryPage />
            </RoleRoute>
          }
        />
        <Route
          path="/hr/directory"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <DirectoryPage />
            </RoleRoute>
          }
        />
        <Route
          path="/hr/reports"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <ReportsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/hr/audit-logs"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <AuditLogsPage />
            </RoleRoute>
          }
        />

        {/* ================= ALIAS & LEGACY URL HANDLERS (ROLE-GUARDED) ================= */}
        {/* Legacy employee URLs */}
        <Route
          path="/employee-dashboard"
          element={
            <RoleRoute allowedRoles={['employee']}>
              <Navigate to="/employee/dashboard" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/request-leave"
          element={
            <RoleRoute allowedRoles={['employee']}>
              <Navigate to="/employee/request-leave" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/my-requests"
          element={
            <RoleRoute allowedRoles={['employee']}>
              <Navigate to="/employee/my-leave" replace />
            </RoleRoute>
          }
        />

        {/* Legacy manager URLs */}
        <Route
          path="/manager-dashboard"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <Navigate to="/manager/dashboard" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/team-requests"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <Navigate to="/manager/team-requests" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/team-approvals"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <Navigate to="/manager/approvals" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/team-calendar"
          element={
            <RoleRoute allowedRoles={['manager']}>
              <Navigate to="/manager/calendar" replace />
            </RoleRoute>
          }
        />

        {/* Legacy HR URLs */}
        <Route
          path="/hr-dashboard"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <Navigate to="/hr/dashboard" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/organization"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <Navigate to="/hr/dashboard" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/directory"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <Navigate to="/hr/employees" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <Navigate to="/hr/reports" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <RoleRoute allowedRoles={['hr']}>
              <Navigate to="/hr/audit-logs" replace />
            </RoleRoute>
          }
        />

        {/* Fallback Catch-all: silently redirect to user's dashboard */}
        <Route path="*" element={<RoleHomeRedirect />} />
      </Route>
    </Routes>
  );
}

export default App;
