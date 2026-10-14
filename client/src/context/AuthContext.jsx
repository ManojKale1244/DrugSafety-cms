import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { registerSessionExpiredHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    registerSessionExpiredHandler(() => {
      setSessionExpired(true);
    });
  }, []);

  // Fetch current user details on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success && res.data.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      if (err.response?.status === 401 && window.location.pathname !== '/login') {
        // Not authenticated
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login handler
  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success && res.data.user) {
      setUser(res.data.user);
      setSessionExpired(false);
    }
    return res.data;
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (_err) {
      // Ignore logout errors
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  // Check permission helper
  const hasPermission = useCallback(
    (permission) => {
      if (!user || !user.role) return false;
      if (user.role.name === 'admin') return true;
      const permissions = user.role.permissions || [];
      if (permissions.includes('*')) return true;
      return permissions.includes(permission);
    },
    [user],
  );

  // Check role helper
  const hasRole = useCallback(
    (...roles) => {
      if (!user || !user.role) return false;
      if (user.role.name === 'admin') return true;
      return roles.includes(user.role.name);
    },
    [user],
  );

  const value = {
    user,
    role: user?.role?.name || null,
    roleDetails: user?.role || null,
    permissions: user?.role?.permissions || [],
    isAuthenticated: !!user,
    loading,
    sessionExpired,
    setSessionExpired,
    login,
    logout,
    checkAuth,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
