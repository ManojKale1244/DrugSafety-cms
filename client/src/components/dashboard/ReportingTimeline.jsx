import React from 'react';
import { Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ReportingTimeline({ dueCasesCount = 0 }) {
  return (
    <div className="card p-5 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Regulatory Reporting Window</h3>
            <p className="text-xs text-slate-400">Expedited health authority submission deadlines (Next 7 Days)</p>
          </div>
        </div>

        <span className="badge bg-red-50 text-red-700 ring-red-600/20 font-bold">
          {dueCasesCount} Expedited
        </span>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-950">Statutory 7 & 15-Day Expedited Windows</h4>
              <p className="mt-1 text-slate-600 leading-relaxed">
                Health authority regulations mandate serious unexpected adverse reactions be processed and submitted within 7 or 15 calendar days from initial receipt.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Due in $\le$ 3 Days</span>
            <p className="text-xl font-extrabold text-red-600 mt-1">2 Cases</p>
            <span className="text-[10px] text-slate-400">Priority expedited queue</span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Due in 4–7 Days</span>
            <p className="text-xl font-extrabold text-amber-600 mt-1">3 Cases</p>
            <span className="text-[10px] text-slate-400">Under medical review</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">Strict Asia/Kolkata 23:59:59 cutoff</span>
        <Link to="/cases" className="text-brand-600 hover:text-brand-700 font-semibold inline-flex items-center gap-1">
          Review Expedited Reports <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
