/**
 * Role-based navigation and route helpers
 */

export function getRoleHome(role) {
  switch (role) {
    case 'manager':
      return '/manager/dashboard';
    case 'hr':
      return '/hr/dashboard';
    case 'employee':
    default:
      return '/employee/dashboard';
  }
}

export function isRoleAllowed(userRole, allowedRoles = []) {
  if (!userRole) return false;
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(userRole);
}
