import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users as UsersIcon,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  History,
  Edit2,
  AlertTriangle,
  X,
  Loader2,
  Trash2,
  Laptop,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selection for bulk actions
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Drawer / Modal states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roleId: '',
    password: '',
    mustChangePassword: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdPasswordNotice, setCreatedPasswordNotice] = useState(null);

  // Login History Modal
  const [historyUser, setHistoryUser] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load roles once
  useEffect(() => {
    async function fetchRoles() {
      try {
        const res = await api.get('/users/roles');
        if (res.data.success) {
          setRoles(res.data.roles);
        }
      } catch (_err) {
        // Handled silently
      }
    }
    fetchRoles();
  }, []);

  // Fetch users with filters
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/users', {
        params: {
          search,
          status: statusFilter,
          roleId: roleFilter,
          page,
          limit: 10,
        },
      });
      if (res.data.success) {
        setUsers(res.data.users);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, roleFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle single status toggle
  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await api.patch(`/users/${user._id}/status`, { status: nextStatus });
      if (res.data.success) {
        setUsers((prev) =>
          prev.map((u) => (u._id === user._id ? { ...u, status: nextStatus } : u)),
        );
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Could not change user status');
    }
  };

  // Open Create Drawer
  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      roleId: roles[0]?._id || '',
      password: '',
      mustChangePassword: true,
    });
    setFormError('');
    setCreatedPasswordNotice(null);
    setDrawerOpen(true);
  };

  // Open Edit Drawer
  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      roleId: user.roleId?._id || user.roleId || '',
      password: '',
      mustChangePassword: user.mustChangePassword ?? false,
    });
    setFormError('');
    setCreatedPasswordNotice(null);
    setDrawerOpen(true);
  };

  // Handle Form Submit (Create or Edit)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setCreatedPasswordNotice(null);

    try {
      if (editingUser) {
        // Edit
        const res = await api.patch(`/users/${editingUser._id}`, {
          name: formData.name,
          email: formData.email,
          roleId: formData.roleId,
          mustChangePassword: formData.mustChangePassword,
        });
        if (res.data.success) {
          setDrawerOpen(false);
          fetchUsers();
        }
      } else {
        // Create
        const payload = {
          name: formData.name,
          email: formData.email,
          roleId: formData.roleId,
          mustChangePassword: formData.mustChangePassword,
        };
        if (formData.password?.trim()) {
          payload.password = formData.password.trim();
        }

        const res = await api.post('/users', payload);
        if (res.data.success) {
          if (res.data.initialPassword) {
            setCreatedPasswordNotice(res.data.initialPassword);
            fetchUsers();
          } else {
            setDrawerOpen(false);
            fetchUsers();
          }
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save user record');
    } finally {
      setFormLoading(false);
    }
  };

  // Bulk Deactivation
  const handleConfirmBulkDeactivate = async () => {
    setBulkActionLoading(true);
    try {
      const res = await api.post('/users/bulk-status', {
        userIds: selectedUserIds,
        status: 'inactive',
      });
      if (res.data.success) {
        setShowBulkModal(false);
        setSelectedUserIds([]);
        fetchUsers();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Bulk operation failed');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Open Login History Modal
  const handleOpenHistory = async (user) => {
    setHistoryUser(user);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/users/${user._id}/login-history`);
      if (res.data.success) {
        setHistoryLogs(res.data.history);
      }
    } catch (_err) {
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      const eligible = users
        .filter((u) => u._id !== currentUser?.id)
        .map((u) => u._id);
      setSelectedUserIds(eligible);
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleToggleSelectOne = (id) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const getRoleBadge = (roleObj) => {
    const name = roleObj?.name || 'viewer';
    switch (name) {
      case 'admin':
        return <span className="badge bg-purple-50 text-purple-700 ring-purple-600/20">Admin</span>;
      case 'case_manager':
        return <span className="badge bg-blue-50 text-blue-700 ring-blue-600/20">Case Manager</span>;
      case 'reviewer':
        return <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-600/20">Reviewer</span>;
      case 'qa_specialist':
        return <span className="badge bg-amber-50 text-amber-700 ring-amber-600/20">QA Auditor</span>;
      case 'regulatory_affairs':
        return <span className="badge bg-cyan-50 text-cyan-700 ring-cyan-600/20">Regulatory</span>;
      case 'data_entry':
        return <span className="badge bg-orange-50 text-orange-700 ring-orange-600/20">Data Entry</span>;
      default:
        return <span className="badge bg-slate-50 text-slate-700 ring-slate-600/20">Viewer</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <UsersIcon className="h-6 w-6 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          </div>
          <p className="text-sm text-slate-500">
            Control enterprise user provisioning, pharmacovigilance roles, and access security
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedUserIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 shadow-sm transition-all"
            >
              <Trash2 className="h-4 w-4" />
              Deactivate Selected ({selectedUserIds.length})
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Provision New User
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-12 items-center">
          <div className="relative sm:col-span-6">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search by full name or email address…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-field pl-10"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">All Account Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">All Pharmacovigilance Roles</option>
              {roles.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <p className="text-sm font-medium text-slate-500">Loading pharmacovigilance user directory…</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">Error loading users</h3>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <button
              type="button"
              onClick={fetchUsers}
              className="btn-secondary mt-4 inline-flex"
            >
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">No users found</h3>
            <p className="mt-1 text-sm text-slate-500">Try adjusting your search criteria or role filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-surface-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th scope="col" className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedUserIds.length > 0 &&
                        users.every((u) => u._id === currentUser?.id || selectedUserIds.includes(u._id))
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      aria-label="Select all users"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3.5">User</th>
                  <th scope="col" className="px-4 py-3.5">Role</th>
                  <th scope="col" className="px-4 py-3.5">Account Status</th>
                  <th scope="col" className="px-4 py-3.5">Last Login</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {users.map((u) => {
                  const isSelf = u._id === currentUser?.id;
                  const isSelected = selectedUserIds.includes(u._id);

                  return (
                    <tr
                      key={u._id}
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-brand-50/30' : ''}`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          disabled={isSelf}
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(u._id)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                          aria-label={`Select ${u.name}`}
                        />
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-bold text-xs uppercase shadow-xs">
                            {u.name?.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              {u.name}
                              {isSelf && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">{getRoleBadge(u.roleId)}</td>

                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          } ${isSelf ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                          title={isSelf ? 'Cannot deactivate yourself' : 'Click to toggle status'}
                        >
                          {u.status === 'active' ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-slate-400" />
                              Inactive
                            </>
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}
                      </td>

                      <td className="px-4 py-3.5 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(u)}
                          className="inline-flex items-center gap-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          title="View Login History"
                        >
                          <History className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="inline-flex items-center gap-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-surface-border px-4 sm:px-6 py-3.5 text-xs text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary text-xs px-2.5 py-1"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn-secondary text-xs px-2.5 py-1"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit User Drawer ────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <UsersIcon className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-slate-900">
                    {editingUser ? 'Edit User Record' : 'Provision New User'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {createdPasswordNotice && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                    <p className="font-semibold text-emerald-950 mb-1">✓ User Created Successfully!</p>
                    <p className="mb-2">A temporary compliant password was generated for this account:</p>
                    <code className="block bg-white p-2 rounded border border-emerald-300 font-mono font-bold text-slate-900 select-all">
                      {createdPasswordNotice}
                    </code>
                    <p className="mt-2 text-[11px] text-emerald-700">
                      User will be prompted to change their password on initial login.
                    </p>
                  </div>
                )}

                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <form id="user-form" onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Dr. Jane Smith"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Enterprise Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jsmith@drugsafety.local"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pharmacovigilance Role *
                    </label>
                    <select
                      required
                      value={formData.roleId}
                      onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                      className="input-field"
                    >
                      {roles.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.displayName} ({r.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!editingUser && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Initial Password (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Leave blank to auto-generate temporary password"
                        className="input-field font-mono text-xs"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        If provided, must contain min 8 chars, uppercase, lowercase, number and symbol.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="mustChangePassword"
                      checked={formData.mustChangePassword}
                      onChange={(e) =>
                        setFormData({ ...formData, mustChangePassword: e.target.checked })
                      }
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <label htmlFor="mustChangePassword" className="text-xs font-medium text-slate-700">
                      Require password change on next sign-in
                    </label>
                  </div>
                </form>
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-surface-border p-4 flex justify-end gap-3 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="user-form"
                  disabled={formLoading}
                  className="btn-primary"
                >
                  {formLoading ? 'Saving…' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Login History Modal ──────────────────────────────── */}
      <AnimatePresence>
        {historyUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Login & Access History</h3>
                    <p className="text-xs text-slate-400">{historyUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryUser(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {historyLoading ? (
                  <div className="flex min-h-[200px] items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                  </div>
                ) : historyLogs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">
                    No login records recorded for this account.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {historyLogs.map((log) => (
                      <div
                        key={log._id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              log.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {log.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">
                              {log.success ? 'Successful Authentication' : `Failed (${log.reason || 'Invalid Credentials'})`}
                            </div>
                            <div className="flex items-center gap-3 text-slate-400 text-[11px] mt-0.5">
                              <span className="flex items-center gap-1">
                                <Laptop className="h-3 w-3" />
                                {log.ip}
                              </span>
                              <span className="truncate max-w-[200px]" title={log.userAgent}>
                                {log.userAgent}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-slate-500 font-medium text-[11px]">
                          {new Date(log.at).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-surface-border p-4 flex justify-end bg-slate-50">
                <button
                  type="button"
                  onClick={() => setHistoryUser(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Bulk Deactivation Confirmation Dialog ─────────────── */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-900">Confirm Bulk Deactivation</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Are you sure you want to deactivate <span className="font-bold text-slate-900">{selectedUserIds.length}</span> selected users?
                Deactivated users will immediately lose access and be blocked from signing in.
              </p>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkActionLoading}
                  onClick={handleConfirmBulkDeactivate}
                  className="btn-primary bg-red-600 hover:bg-red-700"
                >
                  {bulkActionLoading ? 'Deactivating…' : 'Yes, Deactivate Users'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
