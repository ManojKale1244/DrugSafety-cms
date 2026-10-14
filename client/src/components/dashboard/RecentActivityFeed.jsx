import React from 'react';
import { History } from 'lucide-react';

export default function RecentActivityFeed({ activities = [] }) {
  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'CASE_INTAKE':
        return <span className="badge bg-indigo-50 text-indigo-700 ring-indigo-600/20">Intake</span>;
      case 'CASE_ASSIGNMENT':
        return <span className="badge bg-blue-50 text-blue-700 ring-blue-600/20">Assignment</span>;
      case 'MEDICAL_REVIEW_START':
        return <span className="badge bg-purple-50 text-purple-700 ring-purple-600/20">Review</span>;
      case 'ACTION_ITEM_CREATE':
        return <span className="badge bg-amber-50 text-amber-700 ring-amber-600/20">Task Created</span>;
      case 'AUTH_LOGIN_SUCCESS':
        return <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-600/20">Signed In</span>;
      default:
        return <span className="badge bg-slate-100 text-slate-700 ring-slate-400/20">{action}</span>;
    }
  };

  const getInitials = (email = '') => {
    return email.slice(0, 2).toUpperCase() || 'PV';
  };

  return (
    <div className="card p-5 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent Audit & Safety Activity</h3>
            <p className="text-xs text-slate-400">Immutable chronological event log</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto max-h-[380px] pr-1">
        {activities.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">No recent activity events recorded.</p>
        ) : (
          activities.map((act) => (
            <div
              key={act.id}
              className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white uppercase shadow-xs">
                {getInitials(act.actorEmail)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-slate-800 truncate" title={act.actorEmail}>
                    {act.actorEmail?.split('@')[0]}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                    {getRelativeTime(act.timestamp)}
                  </span>
                </div>
                <p className="text-slate-600 leading-snug line-clamp-2">{act.summary}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  {getActionBadge(act.action)}
                  <span className="text-[10px] text-slate-400 uppercase font-mono">
                    {act.entity}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
