import React from 'react';
import { History, ArrowRight, RotateCcw, User, Calendar, ShieldCheck } from 'lucide-react';

const STAGE_LABELS = {
  NEW: 'New / Intake',
  DATA_ENTRY: 'Data Entry',
  MEDICAL_CODING: 'Medical Coding',
  MEDICAL_REVIEW: 'Medical Review',
  QUALITY_REVIEW: 'Quality Review',
  REGULATORY_REPORTING: 'Regulatory Reporting',
  FINAL_REVIEW: 'Final Review',
  CLOSED: 'Closed & Archived',
};

export default function WorkflowHistoryTimeline({ history = [], loading = false }) {
  if (loading) {
    return (
      <div className="card p-6 text-center text-slate-400 text-xs">
        Loading workflow transition timeline…
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400 space-y-2 bg-white">
        <History className="mx-auto h-8 w-8 text-slate-300" />
        <p className="text-xs font-semibold text-slate-600">No Stage Transitions Recorded Yet</p>
        <p className="text-[11px] text-slate-400">
          When this case is routed through workflow gates, immutable audit entries will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5 bg-white space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-brand-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Workflow Routing & Stage Transition History
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>21 CFR Part 11 Audit Trail</span>
        </div>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {history.map((entry, index) => {
          const isBackward = entry.isBackward;
          const fromLabel = STAGE_LABELS[entry.from] || entry.from;
          const toLabel = STAGE_LABELS[entry.to] || entry.to;
          const authorName = entry.by?.name || entry.byName || 'System';
          const authorEmail = entry.by?.email || '';

          return (
            <div key={entry._id || index} className="relative group">
              {/* Dot Icon */}
              <div
                className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white ${
                  isBackward ? 'bg-amber-500 ring-4 ring-amber-100' : 'bg-brand-600 ring-4 ring-brand-100'
                }`}
              >
                {isBackward ? (
                  <RotateCcw className="h-3 w-3 stroke-[2.5]" />
                ) : (
                  <ArrowRight className="h-3 w-3 stroke-[2.5]" />
                )}
              </div>

              {/* Content Card */}
              <div
                className={`rounded-xl border p-3 text-xs transition-all ${
                  isBackward
                    ? 'border-amber-200 bg-amber-50/40 text-amber-950'
                    : 'border-slate-200/80 bg-white hover:bg-slate-50/60 text-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                      {fromLabel}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded-md border shadow-2xs ${
                        isBackward
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-brand-50 border-brand-200 text-brand-800'
                      }`}
                    >
                      {toLabel}
                    </span>

                    {isBackward && (
                      <span className="badge text-[10px] font-bold uppercase bg-amber-100 text-amber-800 ring-amber-500/20">
                        Returned for Correction
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(entry.at || entry.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Reason Text */}
                {entry.reason && (
                  <div className="mt-2 text-[11px] rounded-lg bg-white/80 p-2 border border-slate-200/80">
                    <span className="font-semibold text-slate-700 block">Justification Reason:</span>
                    <p className="text-slate-600 mt-0.5 italic whitespace-pre-wrap">
                      "{entry.reason}"
                    </p>
                  </div>
                )}

                {/* Author footer */}
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    Routed by <strong className="text-slate-700">{authorName}</strong>{' '}
                    {authorEmail && <span className="text-slate-400">({authorEmail})</span>}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

