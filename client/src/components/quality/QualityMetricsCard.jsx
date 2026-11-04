import React, { useState, useEffect, useCallback } from 'react';
import {
  Award,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Users,
  ShieldCheck,
  Loader2,
  Calendar,
} from 'lucide-react';
import api from '../../services/api';

export default function QualityMetricsCard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/cases/quality/metrics');
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load quality metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="card p-8 text-center text-slate-400 space-y-2 bg-white">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-600" />
        <p className="text-xs font-semibold">Calculating First-Pass Yield & quality metrics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-5 text-center text-rose-600 space-y-2 bg-white">
        <AlertTriangle className="mx-auto h-6 w-6 text-rose-500" />
        <p className="text-xs font-bold">{error}</p>
      </div>
    );
  }

  const globalFpy = data?.globalFirstPassYield ?? 100;
  const processors = data?.processorMetrics || [];

  return (
    <div className="card p-5 bg-white border border-slate-200/90 shadow-2xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
            <Award className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Quality Assurance Metrics: First-Pass Yield (FPY)
            </h3>
            <p className="text-[11px] text-slate-500">
              Percentage of adverse event cases passing quality review without return for correction
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchMetrics}
          className="text-xs font-semibold text-brand-600 hover:text-brand-800 self-start sm:self-auto"
        >
          Refresh
        </button>
      </div>

      {/* Summary KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Global FPY Gauge */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke={globalFpy >= 90 ? '#10b981' : globalFpy >= 75 ? '#f59e0b' : '#f43f5e'}
                strokeWidth="3.5"
                strokeDasharray="88"
                strokeDashoffset={88 - (88 * globalFpy) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-mono text-[10px] font-bold text-slate-900">{globalFpy}%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Global FPY</span>
            <span className="font-bold text-slate-800 text-xs">
              {globalFpy >= 90 ? 'Excellent' : globalFpy >= 75 ? 'Target Met' : 'Action Needed'}
            </span>
          </div>
        </div>

        {/* Total Reviews */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Reviews</span>
          <span className="font-mono text-base font-bold text-slate-900 block mt-0.5">
            {data?.totalReviews || 0}
          </span>
          <span className="text-[10px] text-slate-500">audited cases</span>
        </div>

        {/* First-Pass Approved */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">First-Pass Approved</span>
          <span className="font-mono text-base font-bold text-emerald-700 block mt-0.5">
            {data?.firstPassApproved || 0}
          </span>
          <span className="text-[10px] text-emerald-600">zero defects on submission</span>
        </div>

        {/* Returned for Correction */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Returned for Query</span>
          <span className="font-mono text-base font-bold text-amber-700 block mt-0.5">
            {data?.returnedCount || 0}
          </span>
          <span className="text-[10px] text-amber-600">rework required</span>
        </div>
      </div>

      {/* Processor Breakdown Table */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-brand-600" />
          First-Pass Yield By Case Processor / Specialist
        </span>

        {processors.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-3 text-center">
            No processor quality review data recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {processors.map((p) => {
              const fpy = p.fpyPercentage;
              const barColor =
                fpy >= 90 ? 'bg-emerald-500' : fpy >= 75 ? 'bg-amber-500' : 'bg-rose-500';

              return (
                <div key={p.processorId} className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                        {p.name.slice(0, 1)}
                      </div>
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className="badge text-[9px] font-mono bg-slate-100 text-slate-600">
                        {p.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-[11px]">
                        {p.approvedFirstPass} / {p.totalFirstPassCases} cases approved
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-900 w-12 text-right">
                        {fpy}% FPY
                      </span>
                    </div>
                  </div>

                  {/* FPY bar */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                    <div
                      style={{ width: `${fpy}%` }}
                      className={`h-full ${barColor} rounded-full transition-all duration-300`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

