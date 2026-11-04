import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  ArrowRight,
  ExternalLink,
  Loader2,
  FileText,
  User,
  History,
  Lock,
} from 'lucide-react';
import api from '../../services/api';

const SEVERITY_BADGES = {
  CRITICAL: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
  MAJOR: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
  MINOR: 'bg-blue-100 text-blue-800 border-blue-200 font-medium',
};

export default function QualityReviewWorkspace({
  caseId,
  caseNumber,
  caseDoc,
  onNavigateTab,
  onReviewSubmitted,
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Quality details from API
  const [template, setTemplate] = useState(null);
  const [autoChecks, setAutoChecks] = useState(null);
  const [previousReviews, setPreviousReviews] = useState([]);

  // Checklist response state: { [itemId]: { status: 'pass'|'fail'|'na', comment: '' } }
  const [checklistResponses, setChecklistResponses] = useState({});

  // Modals state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnToStage, setReturnToStage] = useState('MEDICAL_REVIEW');

  // Load quality template, auto-checks, and previous reviews
  const fetchQualityData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/cases/${caseId}/quality`);
      if (res.data.success) {
        setTemplate(res.data.template);
        setAutoChecks(res.data.autoChecks);
        setPreviousReviews(res.data.previousReviews || []);

        // Initialize checklist responses if not already populated
        const initial = {};
        (res.data.template?.items || []).forEach((item) => {
          initial[item.itemId] = {
            itemId: item.itemId,
            title: item.title,
            category: item.category,
            severity: item.severity,
            targetField: item.targetField,
            status: 'pass', // Default to pass
            comment: '',
          };
        });
        setChecklistResponses(initial);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load quality review workspace');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchQualityData();
  }, [fetchQualityData]);

  // Handle checklist response changes
  const handleStatusChange = (itemId, status) => {
    setChecklistResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], status },
    }));
  };

  const handleCommentChange = (itemId, comment) => {
    setChecklistResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], comment },
    }));
  };

  // Compute completion progress & metrics
  const totalItems = template?.items?.length || 0;
  const answeredItems = Object.values(checklistResponses).filter((r) => r.status).length;
  const passedItems = Object.values(checklistResponses).filter((r) => r.status === 'pass').length;
  const failedItems = Object.values(checklistResponses).filter((r) => r.status === 'fail').length;
  const completionPercentage = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 100;

  // Check acceptance rule: case cannot be approved while any critical auto-check fails
  const criticalAutoChecksFailed = useMemo(() => {
    if (!autoChecks?.checks) return [];
    return autoChecks.checks.filter((c) => c.severity === 'CRITICAL' && !c.passed);
  }, [autoChecks]);

  const criticalManualChecklistFailed = useMemo(() => {
    return Object.values(checklistResponses).filter(
      (r) => r.severity === 'CRITICAL' && r.status === 'fail'
    );
  }, [checklistResponses]);

  const canApprove =
    criticalAutoChecksFailed.length === 0 &&
    criticalManualChecklistFailed.length === 0 &&
    !loading;

  // Submit Approval
  const handleApproveConfirm = async () => {
    if (!canApprove) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        decision: 'APPROVED',
        results: Object.values(checklistResponses),
      };
      const res = await api.post(`/cases/${caseId}/quality`, payload);
      if (res.data.success) {
        setSuccessMessage(res.data.message || 'Case successfully approved by Quality Review!');
        setShowApproveModal(false);
        onReviewSubmitted?.();
        fetchQualityData();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit quality review approval');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Return for Correction
  const handleReturnConfirm = async () => {
    if (!returnReason.trim()) {
      setError('A justification reason is required to return a case for quality correction.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        decision: 'RETURNED',
        returnReason: returnReason.trim(),
        returnToStage,
        results: Object.values(checklistResponses),
      };
      const res = await api.post(`/cases/${caseId}/quality`, payload);
      if (res.data.success) {
        setSuccessMessage(res.data.message || 'Case successfully returned for quality correction.');
        setShowReturnModal(false);
        onReviewSubmitted?.();
        fetchQualityData();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to return case for correction');
    } finally {
      setSubmitting(false);
    }
  };

  // Group checklist items by category
  const groupedItems = useMemo(() => {
    const map = {};
    (template?.items || []).forEach((item) => {
      const cat = item.category || 'General Quality';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [template]);

  if (loading) {
    return (
      <div className="card p-12 text-center text-slate-400 space-y-3 bg-white">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
        <p className="text-xs font-semibold">Running automated regulatory quality checks…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header & Progress Summary ───────────────────────── */}
      <div className="card p-5 bg-white border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-brand-600">{caseNumber}</span>
                <span className="text-xs text-slate-400">•</span>
                <span className="badge text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                  {caseDoc?.status || 'QUALITY_REVIEW'}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Quality Review & Compliance Audit Workspace
              </h2>
            </div>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowReturnModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
              <span>Return for Correction</span>
            </button>

            <button
              type="button"
              onClick={() => setShowApproveModal(true)}
              disabled={!canApprove}
              className={`btn-primary text-xs py-2 px-4 shadow-sm flex items-center gap-1.5 ${
                !canApprove ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={
                !canApprove
                  ? 'Approval blocked: Critical automatic validation checks or checklist criteria have failed'
                  : 'Approve quality review and route to Regulatory Reporting'
              }
            >
              <Check className="h-4 w-4" />
              <span>Approve Quality Review</span>
            </button>
          </div>
        </div>

        {/* Progress & Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Progress Ring Stat */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <svg className="h-11 w-11 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke={canApprove ? '#10b981' : '#f43f5e'}
                  strokeWidth="3.5"
                  strokeDasharray="88"
                  strokeDashoffset={88 - (88 * completionPercentage) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <span className="absolute font-mono text-[10px] font-bold text-slate-800">
                {completionPercentage}%
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Checklist Progress</span>
              <span className="font-bold text-slate-800">
                {answeredItems} / {totalItems} items
              </span>
            </div>
          </div>

          {/* Auto-check status */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Auto-Checks Gate</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {criticalAutoChecksFailed.length === 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-emerald-700">All Critical Checks Passed</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span className="font-bold text-rose-700">
                    {criticalAutoChecksFailed.length} Critical Check(s) Failed
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Pass / Fail count */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Checklist Balance</span>
            <div className="flex items-center gap-3 mt-0.5 font-bold">
              <span className="text-emerald-700">{passedItems} Passed</span>
              <span className="text-rose-700">{failedItems} Failed</span>
            </div>
          </div>

          {/* Regulatory Gate Status */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">QA Gate Status</span>
            <span
              className={`font-bold mt-0.5 ${
                canApprove ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {canApprove ? 'Ready for Quality Signoff' : 'Approval Blocked'}
            </span>
          </div>
        </div>

        {/* Global Alert Notification */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Validation Gate Rejection:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* ── Automatic Validators Panel (Green / Red Rows) ───── */}
      <div className="card p-5 bg-white border border-slate-200 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              <span>Automated Regulatory Quality Validators</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Verified server-side against ICH E2D, chronological consistency, MedDRA completeness, and medical signatures
            </p>
          </div>
          <span
            className={`badge text-[10px] font-bold px-2.5 py-1 ${
              autoChecks?.passed
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}
          >
            {autoChecks?.passed ? 'Auto-Checks Cleared' : 'Critical Violations Detected'}
          </span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100 text-xs">
          {(autoChecks?.checks || []).map((check) => {
            const isPassed = check.passed;
            return (
              <div
                key={check.key}
                className={`py-3 px-3.5 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isPassed ? 'hover:bg-slate-50/60' : 'bg-rose-50/50 border border-rose-200/70 my-1'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isPassed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isPassed ? 'text-slate-800' : 'text-rose-950 font-bold'}`}>
                        {check.title}
                      </span>
                      <span className={`badge text-[9px] px-1.5 py-0.2 border ${SEVERITY_BADGES[check.severity] || ''}`}>
                        {check.severity}
                      </span>
                    </div>
                    <p className={`text-[11px] ${isPassed ? 'text-slate-500' : 'text-rose-800 font-medium'}`}>
                      {check.message}
                    </p>
                  </div>
                </div>

                {/* Jump to field link button */}
                {!isPassed && check.targetField && onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab(check.targetField)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100/70 shrink-0 transition-colors shadow-2xs self-start sm:self-auto"
                  >
                    <span>Fix in {check.targetField}</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Configurable Checklist Form (Items with Comment & Severity) ── */}
      <div className="card p-5 bg-white border border-slate-200 space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Quality Assurance Verification Checklist
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Audit criteria per {template?.name || 'Standard Checklist'} v{template?.version || 1}. All critical items must pass before regulatory signoff.
          </p>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <span className="text-xs font-bold text-brand-900 uppercase tracking-wide bg-brand-50 px-2.5 py-1 rounded-md border border-brand-100 inline-block">
                {category}
              </span>

              <div className="space-y-3">
                {items.map((item) => {
                  const resp = checklistResponses[item.itemId] || { status: 'pass', comment: '' };
                  const isFail = resp.status === 'fail';

                  return (
                    <div
                      key={item.itemId}
                      className={`p-3.5 rounded-xl border text-xs transition-all ${
                        isFail
                          ? 'border-rose-300 bg-rose-50/30'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-400 font-bold">{item.itemId}</span>
                            <span className="font-bold text-slate-900">{item.title}</span>
                            <span className={`badge text-[9px] px-1.5 py-0.2 border ${SEVERITY_BADGES[item.severity] || ''}`}>
                              {item.severity}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-slate-500">{item.description}</p>
                          )}
                        </div>

                        {/* Status Radio Buttons: Pass / Fail / NA */}
                        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.itemId, 'pass')}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${
                              resp.status === 'pass'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.itemId, 'fail')}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${
                              resp.status === 'fail'
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Fail
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.itemId, 'na')}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-all ${
                              resp.status === 'na'
                                ? 'bg-slate-700 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            N/A
                          </button>

                          {/* Jump to field link */}
                          {item.targetField && onNavigateTab && (
                            <button
                              type="button"
                              onClick={() => onNavigateTab(item.targetField)}
                              className="p-1 text-slate-400 hover:text-brand-600 transition-colors ml-1"
                              title={`Inspect ${item.targetField} section`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Comment Input */}
                      <div className="mt-2.5">
                        <input
                          type="text"
                          value={resp.comment}
                          onChange={(e) => handleCommentChange(item.itemId, e.target.value)}
                          placeholder="Optional audit observation, discrepancy note, or compliance remark…"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-brand-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Previous Reviews History ────────────────────────── */}
      {previousReviews.length > 0 && (
        <div className="card p-5 bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <History className="h-4 w-4 text-brand-600" />
              <span>Prior Quality Reviews for this Case</span>
            </h3>
            <span className="text-[11px] text-slate-400">{previousReviews.length} recorded</span>
          </div>

          <div className="space-y-3 text-xs">
            {previousReviews.map((rev) => (
              <div
                key={rev._id}
                className={`p-3 rounded-xl border ${
                  rev.decision === 'APPROVED'
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-amber-200 bg-amber-50/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge text-[10px] font-bold ${
                        rev.decision === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rev.decision}
                    </span>
                    <span className="font-semibold text-slate-800">
                      by {rev.reviewerName || rev.reviewerId?.name || 'QA Auditor'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(rev.reviewedAt).toLocaleString()}
                  </span>
                </div>

                {rev.returnReason && (
                  <p className="mt-1.5 text-[11px] text-slate-700 italic">
                    Reason: "{rev.returnReason}" (Returned to {rev.returnToStage})
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Approve Confirm Modal ───────────────────────────── */}
      {showApproveModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirm Quality Approval</h3>
                <p className="text-xs text-slate-500">Case {caseNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              You are certifying that all required fields, date sequences, MedDRA codes, and physician causality assessments have been verified.
              This will route the case to <strong>REGULATORY_REPORTING</strong>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveConfirm}
                disabled={submitting}
                className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 shadow-sm"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Signoff</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Confirm Modal ────────────────────────────── */}
      {showReturnModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Return Case for Quality Correction</h3>
                <p className="text-xs text-slate-500">Case {caseNumber}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Return to Workflow Stage *
                </label>
                <select
                  value={returnToStage}
                  onChange={(e) => setReturnToStage(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
                >
                  <option value="MEDICAL_REVIEW">Medical Review (Physician Query / Causality)</option>
                  <option value="DATA_ENTRY">Data Entry (Demographics / Product / Verbatim)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Justification Reason for Return *
                </label>
                <textarea
                  rows={3}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="State specific discrepancy or required correction (e.g. 'Suspect product dosage requires verification against discharge summary')..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturnConfirm}
                disabled={submitting || !returnReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Return</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

