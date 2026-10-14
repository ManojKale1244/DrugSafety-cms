import React from 'react';
import { useAuth } from '../../context/AuthContext';

/**
 * Permission and Role aware UI wrapper.
 * Renders children only if current user has the specified permission or role.
 *
 * @param {Object} props
 * @param {string} [props.permission] Permission code (e.g., 'case.create', 'user.manage')
 * @param {string|string[]} [props.role] Allowed role name(s) (e.g., 'admin', ['case_manager', 'reviewer'])
 * @param {boolean} [props.condition] Extra custom boolean condition
 * @param {React.ReactNode} [props.fallback=null] Fallback element to render when not authorized
 * @param {React.ReactNode} props.children
 */
export default function Can({ permission, role, condition = true, fallback = null, children }) {
  const { hasPermission, hasRole } = useAuth();

  if (!condition) {
    return <>{fallback}</>;
  }

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!hasRole(...roles)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
