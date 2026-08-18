import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getRoleHome, isRoleAllowed } from '../../utils/roleUtils.js';

/**
 * Route guard that enforces role access.
 * If user is not authenticated -> redirect to /login.
 * If user attempts to access an unauthorized route -> silently redirect to their own dashboard.
 * No "Access Restricted" or role switcher UI is displayed.
 */
export function RoleRoute({ allowedRoles = [], children }) {
  const { role, isAuthenticated } = useAuth();

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />;
  }

  const isAllowed = isRoleAllowed(role, allowedRoles);

  if (!isAllowed) {
    // Silently redirect unauthorized role to their own home dashboard
    return <Navigate to={getRoleHome(role)} replace />;
  }

  return children;
}
