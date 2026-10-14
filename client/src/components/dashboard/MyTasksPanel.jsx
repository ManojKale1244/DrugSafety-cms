import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export default function MyTasksPanel({ tasks = [] }) {
  const getUrgencyChip = (task) => {
    if (task.isOverdue || task.urgency === 'overdue') {
      return (
        <span className="badge bg-red-100 text-red-700 ring-red-600/30 font-bold flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          OVERDUE
        </span>
      );
    }
    if (task.urgency === 'due_today') {
      return (
        <span className="badge bg-amber-100 text-amber-800 ring-amber-600/30 font-bold flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" />
          DUE TODAY (IST)
        </span>
      );
    }
    if (task.urgency === 'due_soon') {
      return (
        <span className="badge bg-blue-50 text-blue-700 ring-blue-600/20 font-semibold flex items-center gap-1">
          <Calendar className="h-3 w-3 shrink-0" />
          DUE SOON
        </span>
      );
    }
    return (
      <span className="badge bg-slate-100 text-slate-600 ring-slate-400/20">
        Scheduled
      </span>
    );
  };

  return (
    <div className="card p-5 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <CheckSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">My Action Items & Deadlines</h3>
            <p className="text-xs text-slate-400">Urgent tasks expiring at 23:59:59 IST</p>
          </div>
        </div>

        <Link
          to="/cases"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          All Cases <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Queue Clear!</p>
            <p className="text-xs text-slate-400 mt-0.5">No open action items assigned to you right now.</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`flex flex-col gap-2 rounded-xl border p-3.5 transition-all text-xs ${
                task.isOverdue
                  ? 'border-red-200 bg-red-50/40 hover:bg-red-50/70'
                  : task.urgency === 'due_today'
                  ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                  : 'border-slate-100 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      to={`/cases/${task.caseNumber}`}
                      className="font-mono font-bold text-brand-700 hover:text-brand-900 hover:underline flex items-center gap-1"
                    >
                      {task.caseNumber}
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </Link>
                    {getUrgencyChip(task)}
                  </div>
                  <h4 className="font-semibold text-slate-900 text-xs leading-snug">
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/50 pt-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due: {new Date(task.dueOn).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="capitalize font-medium text-slate-600">
                  Status: {task.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
