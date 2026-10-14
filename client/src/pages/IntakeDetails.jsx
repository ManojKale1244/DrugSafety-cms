import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  User,
  Users,
  Paperclip,
  Copy,
  History,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Ban,
  Loader2,
} from 'lucide-react';
import api from '../services/api';

const TABS = [
  { id: 'details', label: 'Intake Details', icon: FileText },
  { id: 'attachments', label: 'Source Documents', icon: Paperclip },
  { id: 'duplicates', label: 'Duplicate Screening', icon: Copy },
  { id: 'history', label: 'Audit History', icon: History },
];

export default function IntakeDetails() {
  const { id } = useParams();

  const [intake, setIntake] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');

  // Convert to Case Modal & Processing
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertSuccess, setConvertSuccess] = useState(null);
  const [convertError, setConvertError] = useState('');

  // Rejection Dialog State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // Audit Events state
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchIntake = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/intakes/${id}`);
      if (res.data.success) {
        setIntake(res.data.intake);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load intake report');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchIntake();
  }, [fetchIntake]);

  // Load audit trail when switching to History Tab
  const loadAuditHistory = useCallback(async () => {
    if (!intake) return;
    setAuditLoading(true);
    try {
      const res = await api.get('/dashboard/summary');
      if (res.data.success && res.data.recentActivity) {
        // Filter activity matching this intake
        const filtered = res.data.recentActivity.filter(
          (a) => a.entityId === intake._id || a.summary?.includes(intake.intakeNumber),
        );
        setAuditEvents(filtered);
      }
    } catch (_e) {
      setAuditEvents([]);
    } finally {
      setAuditLoading(false);
    }
  }, [intake]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadAuditHistory();
    }
  }, [activeTab, loadAuditHistory]);

  const handleConvert = async () => {
    setConverting(true);
    setConvertError('');
    try {
      const res = await api.post(`/intakes/${id}/create-case`);
      if (res.data.success) {
        setConvertSuccess(res.data.case);
        setIntake(res.data.intake);
      }
    } catch (err) {
      setConvertError(err.response?.data?.error || 'Failed to convert intake to case');
    } finally {
      setConverting(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    setRejecting(true);
    setRejectError('');
    try {
      const res = await api.post(`/intakes/${id}/reject`, { reason: rejectReason });
      if (res.data.success) {
        setShowRejectModal(false);
        setIntake(res.data.intake);
      }
    } catch (err) {
      setRejectError(err.response?.data?.error || 'Failed to reject intake');
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <p className="text-sm font-medium text-slate-500">Loading intake record details…</p>
      </div>
    );
  }

  if (error || !intake) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Intake Record Not Found</h3>
        <p className="text-sm text-slate-500 mt-1">{error || 'Record does not exist'}</p>
        <Link to="/intakes" className="btn-primary mt-6 inline-flex">
          <ArrowLeft className="h-4 w-4" />
          Back to Intake Registry
        </Link>
      </div>
    );
  }

  const hasAllCriteria = intake.validation?.hasMinimumCriteria;
  const isConverted = intake.status === 'CONVERTED';
  const isRejected = intake.status === 'REJECTED';

  const getStatusBadge = () => {
    switch (intake.status) {
      case 'RECEIVED':
        return <span className="badge bg-indigo-50 text-indigo-700 ring-indigo-600/20 font-bold">Received (Valid)</span>;
      case 'INCOMPLETE':
        return <span className="badge bg-amber-50 text-amber-700 ring-amber-600/20 font-bold">Incomplete</span>;
      case 'CONVERTED':
        return <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-600/20 font-bold">Converted to Case</span>;
      case 'REJECTED':
        return <span className="badge bg-red-50 text-red-700 ring-red-600/20 font-bold">Rejected</span>;
      default:
        return <span className="badge bg-slate-100 text-slate-700 font-bold">{intake.status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Back Button & Header ─────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/intakes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Intake Registry
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 font-mono">
              {intake.intakeNumber}
            </h1>
            {getStatusBadge()}
            <span className="text-xs font-medium text-slate-400 capitalize">
              • Source: {intake.source}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {!isConverted && !isRejected && (
            <>
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="btn-secondary text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
              >
                <Ban className="h-3.5 w-3.5" />
                Reject Submission
              </button>

              {/* Convert CTA with tooltip/disable state */}
              <div className="relative group">
                <button
                  type="button"
                  disabled={!hasAllCriteria}
                  onClick={() => setShowConvertModal(true)}
                  className={`btn-primary text-xs shadow-md ${
                    hasAllCriteria
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'opacity-50 cursor-not-allowed bg-slate-400'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Convert to Case (DS-YYYY-NNNNN)
                </button>

                {/* Tooltip explaining missing criteria if disabled */}
                {!hasAllCriteria && (
                  <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-xs z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="font-bold text-slate-900 mb-1 flex items-center gap-1 text-red-600">
                      <ShieldAlert className="h-4 w-4" />
                      Cannot Convert: Missing Criteria
                    </p>
                    <p className="text-slate-500 text-[11px] mb-2 leading-relaxed">
                      All four ICH E2D minimum criteria must be present prior to case provisioning:
                    </p>
                    <ul className="space-y-1 text-[11px] text-amber-900 font-medium list-disc pl-4">
                      {intake.validation?.missingFields?.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {isConverted && (
            <Link
              to={`/cases/${intake.convertedCaseNumber}`}
              className="btn-primary text-xs bg-emerald-700 hover:bg-emerald-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Case {intake.convertedCaseNumber}
            </Link>
          )}
        </div>
      </div>

      {/* ── Converted Banner ─────────────────────────────────── */}
      {isConverted && (
        <div className="card p-4 bg-emerald-50 border-emerald-200 text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-emerald-800">
                Converted to Pharmacovigilance Case
              </span>
              <p className="text-xs text-emerald-700 mt-0.5">
                This intake was provisioned into formal Case{' '}
                <span className="font-bold font-mono text-emerald-950">{intake.convertedCaseNumber}</span>.
              </p>
            </div>
          </div>
          <Link
            to={`/cases/${intake.convertedCaseNumber}`}
            className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1"
          >
            View Active Case Record <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* ── Rejected Banner ──────────────────────────────────── */}
      {isRejected && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-900 flex items-start gap-3">
          <Ban className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-xs uppercase tracking-wider text-red-800">
              Intake Submission Rejected
            </span>
            <p className="text-xs text-red-700 mt-0.5">
              Reason: <span className="font-medium text-slate-900">{intake.rejectionReason}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Main Layout: Tabs + Minimum Criteria Sidebar ─────── */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Tab Content (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Tab Navigation Buttons */}
          <div className="flex border-b border-surface-border gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                    isActive
                      ? 'border-brand-600 text-brand-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.id === 'duplicates' && intake.validation?.duplicateCandidates?.length > 0 && (
                    <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[10px] font-bold">
                      {intake.validation.duplicateCandidates.length}
                    </span>
                  )}
                  {tab.id === 'attachments' && intake.attachments?.length > 0 && (
                    <span className="rounded-full bg-slate-200 text-slate-700 px-1.5 py-0.2 text-[10px] font-bold">
                      {intake.attachments.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Tab 1: Details ───────────────────────────────── */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Suspected Product & Reaction Card */}
              <div className="card p-5 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                  Suspected Medication & Adverse Reaction
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold uppercase">
                      Suspected Medicinal Product
                    </span>
                    <span className="text-base font-bold text-indigo-700 block mt-0.5">
                      {intake.suspectedProduct}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold uppercase">
                      Reported Adverse Reaction (Verbatim)
                    </span>
                    <span className="text-base font-bold text-red-700 block mt-0.5">
                      {intake.reportedReaction}
                    </span>
                  </div>
                </div>

                {intake.narrative && (
                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">
                      Clinical Narrative / Event Details
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                      {intake.narrative}
                    </p>
                  </div>
                )}
              </div>

              {/* Patient & Reporter Demographics */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="card p-5 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-900 font-bold text-sm">
                    <Users className="h-4 w-4 text-brand-600" />
                    Patient Demographics
                  </div>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Reference ID:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {intake.patient?.reference || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Biological Sex:</span>
                      <span className="font-semibold text-slate-800">{intake.patient?.sex}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Age:</span>
                      <span className="font-semibold text-slate-800">
                        {intake.patient?.age ? `${intake.patient.age} ${intake.patient.ageUnit}` : 'Unspecified'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Weight:</span>
                      <span className="font-semibold text-slate-800">
                        {intake.patient?.weight ? `${intake.patient.weight} kg` : 'Unspecified'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card p-5 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-900 font-bold text-sm">
                    <User className="h-4 w-4 text-brand-600" />
                    Primary Reporter Info
                  </div>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name:</span>
                      <span className="font-semibold text-slate-800">
                        {intake.reporter?.name || 'Anonymous'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Qualification:</span>
                      <span className="font-semibold text-slate-800">{intake.reporter?.qualification}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contact:</span>
                      <span className="font-semibold text-slate-800">
                        {intake.reporter?.contact || 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Country:</span>
                      <span className="font-semibold text-slate-800">{intake.reporter?.country}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 2: Attachments ───────────────────────────── */}
          {activeTab === 'attachments' && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Source Documents & Attachments</h3>
                  <p className="text-xs text-slate-400">Linked hospital records, ICSR XML files, or PDFs</p>
                </div>
              </div>

              {(!intake.attachments || intake.attachments.length === 0) ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  <Paperclip className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  No source documents linked to this intake report.
                </div>
              ) : (
                <div className="space-y-2">
                  {intake.attachments.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <Paperclip className="h-4 w-4 text-brand-600" />
                        <div>
                          <span className="font-semibold text-slate-900">{file.name}</span>
                          <span className="text-[11px] text-slate-400 block">
                            {(file.size / 1024).toFixed(1)} KB • Attached {new Date(file.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-brand-600 hover:underline cursor-pointer">
                        Download Document
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab 3: Duplicate Screening ───────────────────── */}
          {activeTab === 'duplicates' && (
            <div className="card p-5 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm">Duplicate Screening Candidates</h3>
                <p className="text-xs text-slate-400">
                  Automated scan of existing registry records matching product, reaction, and demographics
                </p>
              </div>

              {(!intake.validation?.duplicateCandidates || intake.validation.duplicateCandidates.length === 0) ? (
                <div className="py-8 text-center text-xs text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600 mb-2" />
                  <p className="font-bold">No Probable Duplicate Cases Detected</p>
                  <p className="text-slate-500 mt-1">This report appears to be a novel safety observation.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {intake.validation.duplicateCandidates.map((dup, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            to={`/cases/${dup.caseNumber}`}
                            className="font-mono font-bold text-brand-700 hover:underline flex items-center gap-1"
                          >
                            {dup.caseNumber}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <span className="badge bg-amber-100 text-amber-800 font-bold">
                            {dup.similarityScore}% Match
                          </span>
                        </div>
                        <p className="text-slate-700">{dup.reason}</p>
                      </div>

                      <Link
                        to={`/cases/${dup.caseNumber}`}
                        className="btn-secondary text-xs"
                      >
                        Inspect Case
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab 4: Audit History ─────────────────────────── */}
          {activeTab === 'history' && (
            <div className="card p-5 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm">Immutable Audit Trail</h3>
                <p className="text-xs text-slate-400">Tamper-evident record of all intake events</p>
              </div>

              {auditLoading ? (
                <div className="flex min-h-[150px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                </div>
              ) : auditEvents.length === 0 ? (
                <div className="space-y-2 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="font-bold text-slate-900">INTAKE_CREATE</span>
                    <p className="text-slate-600 mt-0.5">
                      Intake report {intake.intakeNumber} entered system registry.
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {new Date(intake.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {auditEvents.map((evt, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-brand-700 uppercase font-mono">{evt.action}</span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(evt.timestamp).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-slate-700">{evt.summary}</p>
                      <span className="text-[10px] text-slate-400 block">Actor: {evt.actorEmail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Minimum Criteria Checklist (4 cols) */}
        <div className="lg:col-span-4 sticky top-4">
          <MinimumCriteriaChecklist formData={intake} />
        </div>
      </div>

      {/* ── Convert to Case Confirmation Modal ───────────────── */}
      <AnimatePresence>
        {showConvertModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center"
            >
              {convertSuccess ? (
                <div className="space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Case Provisioned!</h3>
                  <p className="text-xs text-slate-600">
                    Intake {intake.intakeNumber} has been successfully converted into official case:
                  </p>
                  <div className="rounded-xl bg-slate-100 p-3 font-mono font-bold text-lg text-brand-700">
                    {convertSuccess.caseNumber}
                  </div>
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConvertModal(false)}
                      className="btn-secondary text-xs"
                    >
                      Stay on Intake View
                    </button>
                    <Link
                      to={`/cases/${convertSuccess.caseNumber}`}
                      className="btn-primary text-xs"
                    >
                      Open Case File
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-brand-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Convert to Active Case</h3>
                  <p className="text-xs text-slate-600 leading-relaxed text-left">
                    All 4 ICH E2D minimum criteria have been verified for this submission. Converting will:
                  </p>
                  <ul className="text-xs text-slate-700 text-left space-y-1.5 list-disc pl-5">
                    <li>Generate official sequential case number: <span className="font-bold font-mono">DS-YYYY-NNNNN</span></li>
                    <li>Establish statutory 15-day regulatory submission deadline</li>
                    <li>Create an immutable AuditEvent and transition intake status to <span className="font-semibold text-emerald-700">CONVERTED</span></li>
                  </ul>

                  {convertError && (
                    <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                      {convertError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowConvertModal(false)}
                      className="btn-secondary text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={converting}
                      onClick={handleConvert}
                      className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700"
                    >
                      {converting ? 'Provisioning Case…' : 'Confirm & Convert'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Rejection Reason Modal ───────────────────────────── */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Ban className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Reject Intake Submission</h3>
                  <p className="text-xs text-slate-400">A documented rejection rationale is required</p>
                </div>
              </div>

              {rejectError && (
                <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                  {rejectError}
                </div>
              )}

              <form onSubmit={handleReject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Documented Rejection Reason *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Provide clear rationale (e.g., promotional spam, non-safety inquiry, duplicate of confirmed case…)"
                    className="input-field text-xs"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    This reason is recorded immutably in the compliance audit trail.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rejecting}
                    className="btn-primary text-xs bg-red-600 hover:bg-red-700"
                  >
                    {rejecting ? 'Rejecting…' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
