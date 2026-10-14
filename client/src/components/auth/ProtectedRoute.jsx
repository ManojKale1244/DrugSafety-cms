import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Route protection wrapper for React Router.
 *
 * @param {Object} props
 * @param {string} [props.permission] Required permission code
 * @param {string|string[]} [props.roles] Allowed role names
 * @param {React.ReactNode} props.children
 */
export default function ProtectedRoute({ permission, roles, children }) {
  const { isAuthenticated, loading, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          <p className="text-sm font-medium text-slate-500">Authenticating session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  if (roles) {
    const roleList = Array.isArray(roles) ? roles : [roles];
    if (!hasRole(...roleList)) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  return <>{children}</>;
}
