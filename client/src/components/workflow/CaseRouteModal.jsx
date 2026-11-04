import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import api from '../../services/api';

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

export default function CaseRouteModal({
  isOpen,
  onClose,
  caseId,
  caseNumber,
  initialTargetStage = null,
  onRouteSuccess,
  onNavigateTab,
}) {
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState(false);
  const [workflowDetails, setWorkflowDetails] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(initialTargetStage || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !caseId) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    api
      .get(`/cases/${caseId}/workflow`)
      .then((res) => {
        if (!mounted) return;
        if (res.data.success) {
          setWorkflowDetails(res.data);
          const transitions = res.data.allowedTransitions || [];
          if (initialTargetStage) {
            setSelectedTarget(initialTargetStage);
          } else if (transitions.length > 0) {
            // Default select first available forward transition, or the first transition
            const forward = transitions.find((t) => !t.isBackward);
            setSelectedTarget(forward ? forward.to : transitions[0].to);
          }
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.response?.data?.error || 'Failed to load workflow transitions');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, caseId, initialTargetStage]);

  if (!isOpen) return null;

  const currentStage = workflowDetails?.currentStage || 'NEW';
  const transitions = workflowDetails?.allowedTransitions || [];
  const activeTransition = transitions.find((t) => t.to === selectedTarget);
  const isBackward = activeTransition?.isBackward || false;
  const requiresReason = activeTransition?.requiresReason || isBackward;
  const unmetChecks = activeTransition?.unmetChecks || [];
  const canRoute = activeTransition?.canRoute && (!requiresReason || reason.trim().length >= 3);

  const handleRoute = async (e) => {
    e?.preventDefault();
    if (!selectedTarget) return;

    if (requiresReason && !reason.trim()) {
      setError('A formal justification reason is required for this transition.');
      return;
    }

    setRouting(true);
    setError(null);

    try {
      const res = await api.post(`/cases/${caseId}/route`, {
        targetStage: selectedTarget,
        reason: reason.trim(),
      });

      if (res.data.success) {
        onRouteSuccess?.(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Workflow transition failed');
    } finally {
      setRouting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-brand-600">
                {caseNumber || workflowDetails?.caseNumber || 'Case'}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-700">Workflow Routing Engine</span>
            </div>
            <h2 className="text-base font-bold text-slate-900">Route Case to Next Stage</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
              <p className="text-xs font-medium">Evaluating regulatory transition checks…</p>
            </div>
          ) : error && !workflowDetails ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to fetch workflow rules</p>
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Current Stage Indicator */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs font-medium text-slate-500">Current Stage</span>
                <span className="font-mono font-bold text-xs uppercase px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 shadow-2xs">
                  {STAGE_LABELS[currentStage] || currentStage}
                </span>
              </div>

              {/* Destination Stage Choices */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Available Target Stages
                </label>
                {transitions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-50 border border-slate-200">
                    No active transitions configured from this stage.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {transitions.map((t) => {
                      const isSelected = selectedTarget === t.to;
                      const hasUnmet = t.unmetChecks && t.unmetChecks.length > 0;
                      return (
                        <button
                          key={t.to}
                          type="button"
                          onClick={() => {
                            setSelectedTarget(t.to);
                            setError(null);
                          }}
                          className={`flex flex-col text-left p-3 rounded-xl border text-xs transition-all ${
                            isSelected
                              ? t.isBackward
                                ? 'border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20 shadow-xs'
                                : 'border-brand-500 bg-brand-50/70 text-brand-950 ring-2 ring-brand-500/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1.5">
                              {t.isBackward ? (
                                <RotateCcw className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              ) : (
                                <ArrowRight className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                              )}
                              <span className="font-bold">{STAGE_LABELS[t.to] || t.to}</span>
                            </div>
                            {t.isBackward && (
                              <span className="badge text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                                Return
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 mt-1 line-clamp-1">{t.label}</span>
                          {hasUnmet && (
                            <span className="text-[10px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {t.unmetChecks.length} unmet check(s)
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Transition Checks Evaluation */}
              {activeTransition && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Automated Pre-Transition Checks
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        activeTransition.canRoute
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {activeTransition.canRoute ? 'All checks satisfied' : `${unmetChecks.length} check(s) pending`}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200/70 text-xs">
                    {activeTransition.checks?.map((check) => (
                      <div key={check.key} className="py-2 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          {check.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span
                              className={`font-semibold ${
                                check.passed ? 'text-slate-700' : 'text-rose-900 font-bold'
                              }`}
                            >
                              {check.description}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block">{check.key}</span>
                          </div>
                        </div>

                        {!check.passed && check.linkTab && onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => {
                              onNavigateTab(check.linkTab);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 shrink-0 transition-colors"
                          >
                            <span>Fix in {check.linkTab}</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Justification / Reason Field */}
              {activeTransition && (
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1">
                      <span>Reason / Justification</span>
                      {requiresReason && <span className="text-rose-500 font-bold">*</span>}
                    </span>
                    {requiresReason && (
                      <span className="text-[11px] font-medium text-amber-700">
                        Required for backward correction or gated audit
                      </span>
                    )}
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      isBackward
                        ? 'State specific correction requested (e.g. "Reactions require re-coding to LLT per physician review")...'
                        : 'Optional clinical routing remarks or transfer notes...'
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleRoute}
            disabled={!canRoute || routing || loading}
            className={`btn-primary text-xs py-2 px-4 shadow-sm flex items-center gap-1.5 ${
              !canRoute || routing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {routing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Routing Case…</span>
              </>
            ) : isBackward ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Confirm Return for Correction</span>
              </>
            ) : (
              <>
                <ArrowRight className="h-3.5 w-3.5" />
                <span>Route to {STAGE_LABELS[selectedTarget] || selectedTarget || 'Next'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

