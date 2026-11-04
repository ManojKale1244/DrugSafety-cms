import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  FileText,
  RotateCcw,
  Check,
  ExternalLink,
  Loader2,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  Code,
  Radio,
  Sparkles,
} from 'lucide-react';
import api from '../../services/api';

const JURISDICTION_COLORS = {
  FDA: 'bg-blue-100 text-blue-800 border-blue-300',
  EMA: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  CDSCO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PMDA: 'bg-rose-100 text-rose-800 border-rose-300',
  WHO: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  GLOBAL: 'bg-purple-100 text-purple-800 border-purple-300',
};

const STEPPER_STAGES = ['DRAFT', 'VALIDATED', 'APPROVED', 'SUBMITTED', 'ACKNOWLEDGED'];

export default function CaseReportingTab({ caseId, caseNumber, isClosed, onNavigateTab }) {
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // ACK modal state
  const [showAckModal, setShowAckModal] = useState(false);
  const [ackRefInput, setAckRefInput] = useState('');

  // Fetch reports for this case
  const fetchReports = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/cases/${caseId}/reporting`);
      if (res.data.success) {
        setReports(res.data.reports || []);
        if (res.data.reports?.length > 0 && !selectedReportId) {
          setSelectedReportId(res.data.reports[0]._id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load regulatory reporting obligations');
    } finally {
      setLoading(false);
    }
  }, [caseId, selectedReportId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Evaluate rules on-demand
  const handleEvaluateRules = async () => {
    setEvaluating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.post(`/cases/${caseId}/reporting/evaluate`);
      if (res.data.success) {
        setReports(res.data.reports || []);
        setSuccessMessage(res.data.message || 'Regulatory reporting obligations successfully evaluated.');
        if (res.data.reports?.length > 0) {
          setSelectedReportId(res.data.reports[0]._id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to evaluate reporting rules');
    } finally {
      setEvaluating(false);
    }
  };

  // State machine actions
  const selectedReport = reports.find((r) => r._id === selectedReportId) || reports[0] || null;

  const handleValidate = async () => {
    if (!selectedReport) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.post(`/reports/${selectedReport._id}/validate`);
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        fetchReports();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Report validation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedReport) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.post(`/reports/${selectedReport._id}/approve`);
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        fetchReports();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedReport) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.post(`/reports/${selectedReport._id}/submit`);
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        fetchReports();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gateway submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledgeConfirm = async () => {
    if (!selectedReport) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.post(`/reports/${selectedReport._id}/acknowledge`, {
        ackRef: ackRefInput.trim(),
      });
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        setShowAckModal(false);
        setAckRefInput('');
        fetchReports();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Recording acknowledgement failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper: compute countdown chip
  const getCountdownChip = (dueDate, status) => {
    if (status === 'SUBMITTED' || status === 'ACKNOWLEDGED') {
      return (
        <span className="badge bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
          Completed
        </span>
      );
    }

    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || status === 'OVERDUE') {
      return (
        <span className="badge bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-300 animate-pulse">
          OVERDUE ({Math.abs(diffDays)}d)
        </span>
      );
    }
    if (diffDays <= 2) {
      return (
        <span className="badge bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
          Due in {diffDays}d
        </span>
      );
    }
    if (diffDays <= 5) {
      return (
        <span className="badge bg-amber-50 text-amber-800 font-semibold text-[10px] border border-amber-200">
          Due in {diffDays}d
        </span>
      );
    }
    return (
      <span className="badge bg-emerald-50 text-emerald-700 font-medium text-[10px] border border-emerald-200">
        Due in {diffDays}d
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Synthetic Rules Educational Banner ──────────────── */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3 shadow-2xs">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block">
            Synthetic Regulatory Reporting Engine (Educational & Demonstration Mode)
          </span>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            Statutory deadlines, expedited 7-day/15-day alert rules, and E2B(R3) transmission gateways in this module are synthetic models.
            Validate all reporting rules with certified regulatory compliance experts and official regional health authority guidelines prior to production clinical use.
          </p>
        </div>
      </div>

      {/* ── Header Toolbar ──────────────────────────────────── */}
      <div className="card p-4 sm:p-5 bg-white border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Send className="h-4 w-4 text-brand-600" />
              <span>Regulatory Reporting Obligations & Statutory Timelines</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Evaluated against case seriousness, expectedness, criteria flags, and jurisdiction guidelines
            </p>
          </div>

          <button
            type="button"
            onClick={handleEvaluateRules}
            disabled={evaluating || isClosed}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
          >
            {evaluating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>Evaluate Obligations</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card p-12 text-center text-slate-400 space-y-2 bg-white">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
          <p className="text-xs font-semibold">Loading statutory regulatory obligations…</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="card p-12 text-center text-slate-400 space-y-3 bg-white border border-slate-200">
          <Send className="mx-auto h-10 w-10 text-slate-300" />
          <h4 className="text-sm font-bold text-slate-700">No Regulatory Obligations Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click "Evaluate Obligations" above to apply synthetic FDA, EMA, CDSCO, and WHO reporting rules against this case.
          </p>
          <button
            type="button"
            onClick={handleEvaluateRules}
            disabled={evaluating}
            className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Run Rule Evaluation</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* ── Left Column: Obligations List ─────────────────── */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Reporting Obligations ({reports.length})
              </span>
              <span className="text-[11px] text-slate-400">Select to inspect</span>
            </div>

            <div className="space-y-2.5">
              {reports.map((rep) => {
                const isSelected = selectedReport?._id === rep._id;
                const jurColor = JURISDICTION_COLORS[rep.jurisdiction] || JURISDICTION_COLORS.GLOBAL;

                return (
                  <div
                    key={rep._id}
                    onClick={() => setSelectedReportId(rep._id)}
                    className={`card p-3.5 cursor-pointer transition-all border text-xs space-y-2 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/30 ring-2 ring-brand-500/20 shadow-xs'
                        : 'border-slate-200/90 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`badge text-[10px] font-bold px-2 py-0.5 border ${jurColor}`}>
                          {rep.jurisdiction}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 font-bold">
                          {rep.ruleCode} v{rep.ruleVersion}
                        </span>
                      </div>
                      {getCountdownChip(rep.dueDate, rep.status)}
                    </div>

                    <div>
                      <span className="font-bold text-slate-900 block">{rep.reportType}</span>
                      <span className="text-[11px] text-slate-500 line-clamp-1">{rep.ruleName}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Due: {new Date(rep.dueDate).toLocaleDateString()}</span>
                      </div>
                      <span className="font-mono font-bold uppercase text-[10px] text-slate-700">
                        {rep.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right Column: Selected Report Workspace ───────── */}
          <div className="lg:col-span-7 space-y-4">
            {selectedReport && (
              <div className="card p-5 bg-white border border-slate-200 space-y-5">
                {/* Report Detail Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs font-bold px-2 py-0.5 border ${JURISDICTION_COLORS[selectedReport.jurisdiction] || ''}`}>
                        {selectedReport.jurisdiction} Gateway
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {selectedReport.ruleCode} v{selectedReport.ruleVersion}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-1">
                      {selectedReport.reportType}
                    </h4>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Statutory Deadline</span>
                    <span className="font-mono font-bold text-xs text-slate-800">
                      {new Date(selectedReport.dueDate).toLocaleDateString()} ({selectedReport.deadlineDays} days)
                    </span>
                  </div>
                </div>

                {/* Approval Stepper Progress Bar */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Submission Lifecycle Stepper
                  </span>
                  <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
                    {STEPPER_STAGES.map((stg, i) => {
                      const currentIdx = STEPPER_STAGES.indexOf(
                        selectedReport.status === 'OVERDUE' ? 'DRAFT' : selectedReport.status
                      );
                      const isCompleted = currentIdx > i;
                      const isCurrent = currentIdx === i;

                      return (
                        <div key={stg} className="flex items-center gap-1 flex-1 min-w-[70px]">
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                              isCompleted
                                ? 'bg-emerald-600 text-white'
                                : isCurrent
                                ? selectedReport.status === 'OVERDUE'
                                  ? 'bg-rose-600 text-white ring-2 ring-rose-200'
                                  : 'bg-brand-600 text-white ring-2 ring-brand-200'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                          </div>
                          <span
                            className={`text-[10px] font-bold ${
                              isCurrent ? 'text-slate-900' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                            }`}
                          >
                            {stg}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action CTA based on lifecycle state */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 block">
                      Current Action Required:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {selectedReport.status === 'DRAFT' || selectedReport.status === 'OVERDUE'
                        ? 'Run ICH E2B(R3) schema verification against case fields.'
                        : selectedReport.status === 'VALIDATED'
                        ? 'Review payload and execute regulatory approval.'
                        : selectedReport.status === 'APPROVED'
                        ? 'Transmit report to health authority gateway.'
                        : selectedReport.status === 'SUBMITTED'
                        ? 'Record agency acknowledgement message (ACK).'
                        : 'Submission cycle complete and acknowledged.'}
                    </span>
                  </div>

                  <div className="shrink-0">
                    {(selectedReport.status === 'DRAFT' || selectedReport.status === 'OVERDUE') && (
                      <button
                        type="button"
                        onClick={handleValidate}
                        disabled={actionLoading}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        <span>Validate E2B Schema</span>
                      </button>
                    )}

                    {selectedReport.status === 'VALIDATED' && (
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        <span>Approve for Submission</span>
                      </button>
                    )}

                    {selectedReport.status === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        <span>Submit to Gateway</span>
                      </button>
                    )}

                    {selectedReport.status === 'SUBMITTED' && (
                      <button
                        type="button"
                        onClick={() => setShowAckModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Record Agency ACK</span>
                      </button>
                    )}

                    {selectedReport.status === 'ACKNOWLEDGED' && (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>ACK Verified</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Validation Errors List (if any) */}
                {selectedReport.validationErrors && selectedReport.validationErrors.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 text-xs">
                    <div className="flex items-center gap-2 text-rose-800 font-bold">
                      <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>ICH E2B(R3) Schema Validation Discrepancies ({selectedReport.validationErrors.length})</span>
                    </div>

                    <div className="divide-y divide-rose-200/60 text-[11px]">
                      {selectedReport.validationErrors.map((err, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between gap-2">
                          <span className="text-rose-900 font-medium">{err.message}</span>
                          {err.field && onNavigateTab && (
                            <button
                              type="button"
                              onClick={() => onNavigateTab(err.field)}
                              className="text-brand-700 font-bold underline hover:text-brand-900 shrink-0"
                            >
                              Go to {err.field} &rarr;
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transmission & Acknowledgement Metadata */}
                {(selectedReport.transmissionId || selectedReport.ackRef) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs">
                    {selectedReport.transmissionId && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Transmission ID</span>
                        <span className="font-mono font-bold text-slate-800">{selectedReport.transmissionId}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Sent: {new Date(selectedReport.submittedAt).toLocaleString()} by {selectedReport.submittedByName}
                        </span>
                      </div>
                    )}

                    {selectedReport.ackRef && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Agency ACK Reference</span>
                        <span className="font-mono font-bold text-emerald-800">{selectedReport.ackRef}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Acked: {new Date(selectedReport.acknowledgedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Draft E2B(R3) Payload Summary Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Code className="h-3.5 w-3.5 text-brand-600" />
                      ICH E2B(R3) Message Payload Preview
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">JSON/XML Schema</span>
                  </div>

                  <pre className="rounded-xl bg-slate-900 p-3.5 text-[11px] font-mono text-slate-100 overflow-x-auto max-h-56 custom-scrollbar">
                    {JSON.stringify(selectedReport.payloadSummary || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Record Agency ACK Modal ─────────────────────────── */}
      {showAckModal && selectedReport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Health Authority ACK</h3>
                <p className="text-xs text-slate-500">
                  {selectedReport.jurisdiction} Gateway • Case {caseNumber}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Acknowledgement Tracking Number / Message ID
                </label>
                <input
                  type="text"
                  value={ackRefInput}
                  onChange={(e) => setAckRefInput(e.target.value)}
                  placeholder={`e.g. ACK-${selectedReport.jurisdiction}-2026-904812 (Leave blank to auto-generate)`}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAckModal(false)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcknowledgeConfirm}
                disabled={actionLoading}
                className="btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Acknowledgement</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

