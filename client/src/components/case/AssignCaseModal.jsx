import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserCheck, X, Loader2 } from 'lucide-react';
import api from '../../services/api';

export default function AssignCaseModal({ isOpen, onClose, onConfirm, currentAssigneeId, assigning = false }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(currentAssigneeId || '');
  const [reason, setReason] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(currentAssigneeId || '');
      setReason('');
      setError('');
      loadUsers();
    }
  }, [isOpen, currentAssigneeId]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users?limit=50');
      if (res.data.success) {
        setUsers(res.data.users || []);
      }
    } catch (_e) {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason for reassignment is required for the audit trail.');
      return;
    }
    setError('');
    onConfirm(selectedUserId || null, reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Assign Case Owner</h3>
              <p className="text-xs text-slate-500">Route case to a safety reviewer or specialist</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Assignee:
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                Loading active safety team…
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
              >
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.roleId?.displayName || u.roleId?.name || 'User'}) — {u.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reason for Assignment / Routing <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setError('');
              }}
              placeholder="e.g. Assigned to Dr. Sharma for clinical causality assessment"
              className={`w-full rounded-xl border p-2.5 text-xs focus:outline-none focus:ring-2 ${
                error
                  ? 'border-red-300 focus:ring-red-400/20'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500/20'
              }`}
            />
            {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={assigning}
              className="btn-secondary text-xs py-2 px-3.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assigning}
              className="btn-primary text-xs py-2 px-4 shadow-sm flex items-center gap-1.5"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {assigning ? 'Assigning…' : 'Save Assignment'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
