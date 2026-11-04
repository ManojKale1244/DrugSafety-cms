import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Calendar,
  Loader2,
  Clock,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../../services/api';
import Can from '../auth/Can';

const STAGE_COLORS = {
  NEW: 'bg-blue-500',
  DATA_ENTRY: 'bg-purple-500',
  MEDICAL_CODING: 'bg-cyan-500',
  MEDICAL_REVIEW: 'bg-amber-500',
  QUALITY_REVIEW: 'bg-indigo-500',
  REGULATORY_REPORTING: 'bg-emerald-500',
  FINAL_REVIEW: 'bg-teal-500',
  CLOSED: 'bg-slate-400',
};

export default function TeamWorkloadPanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ totalActiveTasks: 0, tasks: [], workload: [] });
  const [error, setError] = useState(null);

  // Reassign Modal State
  const [selectedTask, setSelectedTask] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState(null);
  const [reassignSuccess, setReassignSuccess] = useState(null);

  const fetchTeamWorkload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/tasks/team');
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load team workload and tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamWorkload();
  }, [fetchTeamWorkload]);

  // Load users list when reassign modal opens
  const openReassignModal = async (task) => {
    setSelectedTask(task);
    setTargetUserId(task.assignedTo?._id || '');
    setReassignReason('');
    setReassignError(null);
    setReassignSuccess(null);

    try {
      const res = await api.get('/users');
      if (res.data.success) {
        setUsersList(res.data.users || []);
      }
    } catch (_uErr) {
      // Fallback empty
    }
  };

  const handleReassignSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedTask || !targetUserId) return;

    if (!reassignReason.trim()) {
      setReassignError('A justification reason is required for 21 CFR Part 11 task reassignment.');
      return;
    }

    setReassigning(true);
    setReassignError(null);

    try {
      const res = await api.post(`/tasks/${selectedTask._id}/reassign`, {
        assignedTo: targetUserId,
        reason: reassignReason.trim(),
      });

      if (res.data.success) {
        setReassignSuccess(res.data.message || 'Task successfully reassigned');
        setTimeout(() => {
          setSelectedTask(null);
          fetchTeamWorkload();
        }, 1200);
      }
    } catch (err) {
      setReassignError(err.response?.data?.error || 'Failed to reassign task');
    } finally {
      setReassigning(false);
    }
  };

  const maxTasks = Math.max(...(data.workload.map((w) => w.totalTasks) || [1]), 1);

  return (
    <div className="space-y-6">
      {/* Overview Cards & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-600" />
            <span>Manager Workspace: Team Workload & Task Distribution</span>
          </h2>
          <p className="text-xs text-slate-500">
            Real-time capacity tracking, stage allocation bars, and regulated task reassignments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge font-mono text-xs font-bold px-3 py-1 bg-brand-50 text-brand-700 border border-brand-200">
            {data.totalActiveTasks} Active Tasks Assigned
          </span>
          <button
            type="button"
            onClick={fetchTeamWorkload}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-slate-400 space-y-2">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
          <p className="text-xs font-medium">Aggregating team workload distribution…</p>
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-rose-600 space-y-2">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      ) : (
        <>
          {/* Workload Distribution Bars */}
          <div className="card p-4 sm:p-5 bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-brand-600" />
                Workload Capacity Per Team Member
              </span>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> Intake
                <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" /> Coding
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Med Review
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" /> QA
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Reporting
              </div>
            </div>

            {data.workload.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No active tasks found across team members.
              </p>
            ) : (
              <div className="space-y-3.5">
                {data.workload.map((userWl) => {
                  const percentageOfMax = Math.round((userWl.totalTasks / maxTasks) * 100);

                  return (
                    <div key={userWl.userId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                            {userWl.name.slice(0, 1)}
                          </div>
                          <span className="font-bold text-slate-800">{userWl.name}</span>
                          {userWl.role && (
                            <span className="badge text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2">
                              {userWl.role}
                            </span>
                          )}
                        </div>

                        <span className="font-mono text-xs font-bold text-slate-900">
                          {userWl.totalTasks} task{userWl.totalTasks === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Stacked Workload Bar */}
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex shadow-inner">
                        {Object.entries(userWl.stages || {}).map(([stage, count]) => {
                          const segWidth = (count / userWl.totalTasks) * percentageOfMax;
                          const barColor = STAGE_COLORS[stage] || 'bg-slate-400';

                          return (
                            <div
                              key={stage}
                              style={{ width: `${segWidth}%` }}
                              title={`${stage}: ${count} task(s)`}
                              className={`h-full ${barColor} transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Tasks Table */}
          <div className="card overflow-hidden bg-white border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Active Team Workflow Tasks
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {data.tasks.length} total active tasks
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3.5">Task Title</th>
                    <th className="py-2.5 px-3.5">Stage</th>
                    <th className="py-2.5 px-3.5">Case #</th>
                    <th className="py-2.5 px-3.5">Assignee</th>
                    <th className="py-2.5 px-3.5">Due Date</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.tasks.map((task) => (
                    <tr key={task._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-800">
                        {task.title}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="badge text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200">
                          {task.stage}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-bold text-brand-600">
                        <Link
                          to={`/cases/${task.caseNumber}`}
                          className="hover:text-brand-800 hover:underline"
                        >
                          {task.caseNumber}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                            {task.assignedTo?.name?.slice(0, 1) || 'U'}
                          </div>
                          <span className="text-slate-700 font-medium truncate max-w-[120px]">
                            {task.assignedTo?.name || 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500">
                        {task.dueAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>{new Date(task.dueAt).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        <Can permission="case.assign">
                          <button
                            type="button"
                            onClick={() => openReassignModal(task)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 border border-brand-200 shadow-2xs transition-colors"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Reassign</span>
                          </button>
                        </Can>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Reassign Modal */}
      {selectedTask && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <div>
                <span className="font-mono text-xs font-bold text-brand-600 block">
                  {selectedTask.caseNumber}
                </span>
                <h3 className="text-sm font-bold text-slate-900">Reassign Workflow Task</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleReassignSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-1">Task:</span>
                <span className="font-semibold text-slate-800">{selectedTask.title}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select New Assignee *
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">-- Choose User --</option>
                  {usersList.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role}) - {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for Reassignment *
                </label>
                <textarea
                  rows={3}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="State operational reason for workload rebalancing or reassignment..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {reassignError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{reassignError}</span>
                </div>
              )}

              {reassignSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-800 font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{reassignSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !targetUserId || !reassignReason.trim()}
                  className="btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {reassigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Confirm Reassignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

