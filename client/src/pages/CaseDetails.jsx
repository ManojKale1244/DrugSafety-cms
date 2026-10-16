import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Users,
  Pill,
  Paperclip,
  History,
  Save,
  Lock,
  Calendar,
  AlertCircle,
  Stethoscope,
  Sparkles,
  BookOpen,
  Send,
  HelpCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import DataOriginBadge from '../components/case/DataOriginBadge';
import ChangeReasonModal from '../components/case/ChangeReasonModal';
import ConflictModal from '../components/case/ConflictModal';
import CloseCaseModal from '../components/case/CloseCaseModal';
import AssignCaseModal from '../components/case/AssignCaseModal';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'patient', label: 'Patient', icon: User },
  { id: 'reporter', label: 'Reporter', icon: Users },
  { id: 'products', label: 'Products', icon: Pill },
  { id: 'reactions', label: 'Reactions', icon: AlertTriangle },
  { id: 'narrative', label: 'Narrative', icon: FileText },
  { id: 'assessment', label: 'Assessment', icon: Stethoscope },
  { id: 'coding', label: 'Coding (MedDRA)', icon: Sparkles },
  { id: 'documents', label: 'Documents', icon: Paperclip },
  { id: 'followups', label: 'Follow-ups', icon: HelpCircle },
  { id: 'reporting', label: 'Reporting', icon: Send },
  { id: 'history', label: 'Audit History', icon: History },
];

const WORKFLOW_STAGES = [
  { id: 'new', label: 'Intake / New' },
  { id: 'triage', label: 'Triage' },
  { id: 'data_entry', label: 'Data Entry' },
  { id: 'medical_review', label: 'Medical Review' },
  { id: 'quality_review', label: 'Quality Review' },
  { id: 'ready_for_submission', label: 'Submission' },
  { id: 'closed', label: 'Closed' },
];

function WhatsAppIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function CaseDetails() {
  const { caseId } = useParams();

  const [caseData, setCaseData] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

  // Modals & Conflict state
  const [showChangeReasonModal, setShowChangeReasonModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [serverConflictCase, setServerConflictCase] = useState(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Audit history state
  const [auditHistory, setAuditHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [closureReadiness, setClosureReadiness] = useState(null);

  // Fetch case details
  const fetchCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/cases/${caseId}`);
      if (res.data.success) {
        setCaseData(res.data.case);
        setFormData(JSON.parse(JSON.stringify(res.data.case)));
        setClosureReadiness(res.data.closureReadiness);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load case record');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  // Load audit history when switching to History tab
  const fetchHistory = useCallback(async () => {
    if (!caseData?._id) return;
    setLoadingHistory(true);
    try {
      const res = await api.get(`/cases/${caseData._id}/history`);
      if (res.data.success) {
        setAuditHistory(res.data.history || []);
      }
    } catch (_e) {
      setAuditHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [caseData?._id]);

  useEffect(() => {
    if (activeSection === 'history') {
      fetchHistory();
    }
  }, [activeSection, fetchHistory]);

  // Check if form has unsaved modifications
  const isDirty = useMemo(() => {
    if (!caseData || !formData) return false;
    return JSON.stringify(caseData) !== JSON.stringify(formData);
  }, [caseData, formData]);

  // Handle generic form updates
  const updateField = (path, value) => {
    setFormData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let current = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return next;
    });
  };

  // Determine if sensitive fields changed requiring change reason
  const getSensitiveChanges = () => {
    if (!caseData || !formData) return [];
    const changes = [];
    if (caseData.status !== formData.status) {
      changes.push(`Workflow Status: ${caseData.status} → ${formData.status}`);
    }
    if (caseData.priority !== formData.priority) {
      changes.push(`Priority: ${caseData.priority} → ${formData.priority}`);
    }
    if (caseData.seriousness !== formData.seriousness) {
      changes.push(`Seriousness: ${caseData.seriousness} → ${formData.seriousness}`);
    }
    if (caseData.product !== formData.product) {
      changes.push(`Primary Suspect Product: ${caseData.product} → ${formData.product}`);
    }
    return changes;
  };

  // Trigger Save with Change Reason Modal if sensitive
  const handleSaveClick = (e) => {
    e?.preventDefault();
    if (!isDirty) return;

    const sensitive = getSensitiveChanges();
    if (sensitive.length > 0) {
      setShowChangeReasonModal(true);
    } else {
      executeSave('Routine clinical case field update');
    }
  };

  // Execute PATCH /api/cases/:id
  const executeSave = async (reason) => {
    setShowChangeReasonModal(false);
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        version: caseData.version,
        changeReason: reason,
      };

      const res = await api.patch(`/cases/${caseData._id}`, payload);
      if (res.data.success) {
        setCaseData(res.data.case);
        setFormData(JSON.parse(JSON.stringify(res.data.case)));
        if (activeSection === 'history') fetchHistory();
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.isConflict) {
        // Optimistic concurrency conflict detected!
        setServerConflictCase(err.response.data.currentCase);
        setShowConflictModal(true);
      } else {
        setError(err.response?.data?.error || 'Failed to save case changes');
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle Case Assignment
  const handleAssign = async (targetUserId, reason) => {
    setAssigning(true);
    try {
      const res = await api.post(`/cases/${caseData._id}/assign`, {
        assignedTo: targetUserId,
        reason,
      });
      if (res.data.success) {
        setShowAssignModal(false);
        setCaseData(res.data.case);
        setFormData(JSON.parse(JSON.stringify(res.data.case)));
        fetchCase();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign case');
    } finally {
      setAssigning(false);
    }
  };

  // Handle Case Closure
  const handleCloseCase = async (closureReason) => {
    setClosing(true);
    try {
      const res = await api.post(`/cases/${caseData._id}/close`, { closureReason });
      if (res.data.success) {
        setShowCloseModal(false);
        setCaseData(res.data.case);
        setFormData(JSON.parse(JSON.stringify(res.data.case)));
        fetchCase();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to close case');
    } finally {
      setClosing(false);
    }
  };

  // Share Individual Case Summary to WhatsApp
  const handleShareCaseWhatsApp = () => {
    if (!caseData) return;
    const prod = caseData.product || caseData.caseProducts?.[0]?.productName || 'N/A';
    const reaction = caseData.eventSummary || caseData.reactions?.[0]?.verbatim || 'N/A';
    const message = [
      `🚨 *PHARMACOVIGILANCE CASE REPORT: ${caseData.caseNumber}* 🚨`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💊 *Suspected Product:* ${prod}`,
      `⚡ *Adverse Reaction:* ${reaction}`,
      `⚠️ *Seriousness:* ${caseData.seriousness || 'N/A'}`,
      `🔥 *Priority:* ${(caseData.priority || 'medium').toUpperCase()}`,
      `📌 *Status:* ${(caseData.status || '').replace(/_/g, ' ').toUpperCase()}`,
      `👤 *Assignee:* ${caseData.assignedTo?.name || 'Unassigned'}`,
      `📅 *Report Date:* ${new Date(caseData.receiptDate).toLocaleDateString()}`,
      caseData.regulatoryDueDate ? `⏰ *Regulatory Due:* ${new Date(caseData.regulatoryDueDate).toLocaleDateString()}` : '',
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔗 *Review Case:* ${window.location.origin}/cases/${caseData.caseNumber}`,
      `🔒 _Confidential — Regulated Safety Data_`,
    ].filter(Boolean).join('\n');

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <p className="text-xs font-semibold text-slate-500">Loading safety case workspace…</p>
      </div>
    );
  }

  if (error && !caseData) {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto space-y-3">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <h2 className="text-base font-bold text-slate-900">Case Not Found</h2>
        <p className="text-xs text-slate-500">{error}</p>
        <Link to="/cases" className="btn-secondary text-xs inline-flex items-center gap-1.5 mt-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Case Directory
        </Link>
      </div>
    );
  }

  const isClosed = caseData.status === 'closed';

  return (
    <div className="space-y-6 pb-20">
      {/* ── Conflict Modal & Action Modals ──────────────────── */}
      <ConflictModal
        isOpen={showConflictModal}
        currentServerCase={serverConflictCase}
        onClose={() => setShowConflictModal(false)}
        onReload={() => {
          setShowConflictModal(false);
          fetchCase();
        }}
      />

      <ChangeReasonModal
        isOpen={showChangeReasonModal}
        onClose={() => setShowChangeReasonModal(false)}
        onConfirm={(reason) => executeSave(reason)}
        changesSummary={getSensitiveChanges()}
      />

      <CloseCaseModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onConfirm={handleCloseCase}
        closureReadiness={closureReadiness}
        closing={closing}
      />

      <AssignCaseModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onConfirm={handleAssign}
        currentAssigneeId={caseData.assignedTo?._id || caseData.assignedTo}
        assigning={assigning}
      />

      {/* ── Top Back Navigation ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          to="/cases"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Safety Cases
        </Link>

        {/* Unsaved Changes Banner */}
        {isDirty && !isClosed && (
          <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Unsaved Changes in Workspace</span>
          </div>
        )}
      </div>

      {/* ── Sticky Case Workspace Header ────────────────────── */}
      <div className="sticky top-0 z-20 rounded-2xl bg-white/95 backdrop-blur-md p-4 sm:p-5 shadow-sm border border-slate-200/90 space-y-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Case Identity & Status Pills */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {caseData.caseNumber}
              </span>

              {/* Status Pill */}
              <span className="badge font-bold uppercase tracking-wider text-xs px-2.5 py-0.5 bg-brand-50 text-brand-700 ring-brand-600/20">
                {caseData.status}
              </span>

              {/* Seriousness Pill */}
              <span
                className={`badge text-xs font-semibold ${
                  caseData.seriousness === 'Serious'
                    ? 'bg-red-50 text-red-700 ring-red-600/20'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                }`}
              >
                {caseData.seriousness}
              </span>

              {/* Priority */}
              <span className="badge text-xs font-medium bg-slate-100 text-slate-700">
                Priority: <strong className="ml-1 uppercase text-slate-900">{caseData.priority}</strong>
              </span>

              {/* Optimistic Version Pill */}
              <span className="badge text-[10px] bg-slate-50 text-slate-500 border border-slate-200">
                v{caseData.version || 1}
              </span>
            </div>

            {/* Sub-bar: Elapsed Age Clock & Assignee */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Received {new Date(caseData.receiptDate).toLocaleDateString()}
                </span>
              </div>

              {caseData.regulatoryDueDate && (
                <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Due: {new Date(caseData.regulatoryDueDate).toLocaleDateString()}</span>
                </div>
              )}

              {/* Assignee Avatar */}
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white font-bold text-[10px] uppercase">
                  {caseData.assignedTo?.name?.slice(0, 1) || 'U'}
                </div>
                <span>Assignee: <strong>{caseData.assignedTo?.name || 'Unassigned'}</strong></span>
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(true)}
                    className="text-[11px] text-brand-600 hover:text-brand-800 font-semibold underline ml-1"
                  >
                    Reassign
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action CTAs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleShareCaseWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 transition-all shadow-xs"
              title="Share clinical case summary to WhatsApp"
            >
              <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600" />
              <span>Share to WhatsApp</span>
            </button>

            {!isClosed ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={!isDirty || saving}
                  className={`btn-primary text-xs py-2 px-4 shadow-sm flex items-center gap-1.5 ${
                    !isDirty ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving…' : 'Save Changes'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCloseModal(true)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                  title="Close and archive safety case"
                >
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Close Case</span>
                </button>
              </>
            ) : (
              <div className="rounded-xl bg-slate-100 border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-500" />
                <span>Case Archived (Read-Only)</span>
              </div>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Workspace Grid: Left Nav + Main Form Area + Right Rail ── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* ── Left Section Navigator (12 Sections) ──────────── */}
        <aside className="lg:col-span-3 space-y-1">
          <div className="card p-2 bg-white sticky top-36">
            <span className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Case Sections
            </span>
            <nav className="space-y-0.5">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                    activeSection === id
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{label}</span>
                  </div>
                  {activeSection === id && <ChevronRight className="h-3.5 w-3.5 text-brand-600" />}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Main Form Area ─────────────────────────────────── */}
        <main className="lg:col-span-6 space-y-6">
          {/* SECTION: Overview */}
          {activeSection === 'overview' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">General Case Overview</h3>
                  <DataOriginBadge origin="entered" />
                </div>
                <span className="text-[11px] text-slate-400">Core administrative attributes</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Report Source / Type</label>
                  <select
                    disabled={isClosed}
                    value={formData.source || formData.reportType || 'physician'}
                    onChange={(e) => updateField('source', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="physician">Physician / HCP</option>
                    <option value="patient">Patient / Consumer</option>
                    <option value="literature">Literature Publication</option>
                    <option value="regulator">Health Authority / Regulator</option>
                    <option value="study">Clinical Study</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Country of Incidence</label>
                  <input
                    type="text"
                    disabled={isClosed}
                    value={formData.country || ''}
                    onChange={(e) => updateField('country', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Receipt Date</label>
                  <input
                    type="date"
                    disabled={isClosed}
                    value={formData.receiptDate ? new Date(formData.receiptDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => updateField('receiptDate', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Workflow Status</label>
                  <select
                    disabled={isClosed}
                    value={formData.status || 'new'}
                    onChange={(e) => updateField('status', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none font-semibold text-slate-800"
                  >
                    <option value="new">New</option>
                    <option value="triage">Triage</option>
                    <option value="data_entry">Data Entry</option>
                    <option value="medical_review">Medical Review</option>
                    <option value="quality_review">Quality Review</option>
                    <option value="ready_for_submission">Ready for Submission</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Patient */}
          {activeSection === 'patient' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Patient Demographics & Medical History</h3>
                  <DataOriginBadge origin="reported" />
                </div>
                <span className="text-[11px] text-slate-400">ICH E2B (R3) D.1-D.7</span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Patient Reference ID</label>
                  <input
                    type="text"
                    disabled={isClosed}
                    value={formData.patient?.reference || ''}
                    onChange={(e) => updateField('patient.reference', e.target.value)}
                    placeholder="e.g. PT-1004"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Age</label>
                  <input
                    type="number"
                    disabled={isClosed}
                    value={formData.patient?.age ?? ''}
                    onChange={(e) => updateField('patient.age', e.target.value ? Number(e.target.value) : null)}
                    placeholder="45"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Sex</label>
                  <select
                    disabled={isClosed}
                    value={formData.patient?.sex || 'Unknown'}
                    onChange={(e) => updateField('patient.sex', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1 text-xs">
                  Relevant Medical History & Pre-existing Conditions
                </label>
                <textarea
                  rows={4}
                  disabled={isClosed}
                  value={formData.patient?.history || ''}
                  onChange={(e) => updateField('patient.history', e.target.value)}
                  placeholder="Hypertension diagnosed in 2021; no previous history of drug hypersensitivity…"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* SECTION: Reporter */}
          {activeSection === 'reporter' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Primary Reporter Contact</h3>
                  <DataOriginBadge origin="reported" />
                </div>
                <span className="text-[11px] text-slate-400">Identifiable Reporter</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Reporter Name</label>
                  <input
                    type="text"
                    disabled={isClosed}
                    value={formData.reporter?.name || ''}
                    onChange={(e) => updateField('reporter.name', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Qualification</label>
                  <select
                    disabled={isClosed}
                    value={formData.reporter?.qualification || 'Physician'}
                    onChange={(e) => updateField('reporter.qualification', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white"
                  >
                    <option value="Physician">Physician (MD/MBBS)</option>
                    <option value="Pharmacist">Pharmacist</option>
                    <option value="Other HCP">Other Healthcare Professional</option>
                    <option value="Consumer/Patient">Consumer / Patient</option>
                    <option value="Lawyer">Lawyer</option>
                    <option value="Other">Other Non-HCP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Contact Information (Email / Tel)</label>
                  <input
                    type="text"
                    disabled={isClosed}
                    value={formData.reporter?.contact || ''}
                    onChange={(e) => updateField('reporter.contact', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Institution / Organization</label>
                  <input
                    type="text"
                    disabled={isClosed}
                    value={formData.reporter?.organization || ''}
                    onChange={(e) => updateField('reporter.organization', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Products */}
          {activeSection === 'products' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Medicinal Products</h3>
                  <DataOriginBadge origin="entered" />
                </div>
                <span className="text-[11px] text-slate-400">Suspect, Concomitant, Interacting</span>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1 text-xs">Primary Suspect Product</label>
                <input
                  type="text"
                  disabled={isClosed}
                  value={formData.product || formData.caseProducts?.[0]?.productName || ''}
                  onChange={(e) => {
                    updateField('product', e.target.value);
                    if (formData.caseProducts?.[0]) {
                      updateField('caseProducts.0.productName', e.target.value);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white font-semibold text-slate-900"
                />
              </div>

              {formData.caseProducts && formData.caseProducts.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-700 block">Product Table:</span>
                  {formData.caseProducts.map((p, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{p.productName}</span>
                        <span className="badge bg-indigo-50 text-indigo-700 font-semibold">{p.role}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                        <div>Dose: {p.dose || '—'}</div>
                        <div>Route: {p.route || 'Oral'}</div>
                        <div>Lot #: {p.lotNumber || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION: Reactions */}
          {activeSection === 'reactions' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Reported Adverse Reactions</h3>
                  <DataOriginBadge origin="reported" />
                </div>
                <span className="text-[11px] text-slate-400">Verbatim & MedDRA coded</span>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1 text-xs">Reaction Summary</label>
                <input
                  type="text"
                  disabled={isClosed}
                  value={formData.eventSummary || formData.reactions?.[0]?.verbatim || ''}
                  onChange={(e) => updateField('eventSummary', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white font-medium"
                />
              </div>

              {/* Seriousness Flags */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">Seriousness Criteria</span>
                  <DataOriginBadge origin="assessed" size="xs" />
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  {[
                    { key: 'death', label: 'Results in Death' },
                    { key: 'lifeThreatening', label: 'Life-Threatening' },
                    { key: 'hospitalization', label: 'Hospitalization / Prolonged' },
                    { key: 'disability', label: 'Disability / Incapacity' },
                    { key: 'congenitalAnomaly', label: 'Congenital Anomaly' },
                    { key: 'otherMedicallyImportant', label: 'Other Medically Important' },
                  ].map((flag) => (
                    <label key={flag.key} className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        disabled={isClosed}
                        checked={!!formData.seriousnessFlags?.[flag.key]}
                        onChange={(e) => {
                          const updated = {
                            ...(formData.seriousnessFlags || {}),
                            [flag.key]: e.target.checked,
                          };
                          updateField('seriousnessFlags', updated);
                          const isSer = Object.values(updated).some(Boolean);
                          updateField('seriousness', isSer ? 'Serious' : 'Non-Serious');
                        }}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span>{flag.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Narrative */}
          {activeSection === 'narrative' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Clinical Case Narrative</h3>
                  <DataOriginBadge origin="entered" />
                </div>
                <span className="text-[11px] text-slate-400">
                  {formData.narrative ? `${formData.narrative.split(/\s+/).filter(Boolean).length} words` : '0 words'}
                </span>
              </div>

              <div>
                <textarea
                  rows={8}
                  disabled={isClosed}
                  value={formData.narrative || ''}
                  onChange={(e) => updateField('narrative', e.target.value)}
                  placeholder="Enter detailed clinical narrative describing chronology of event, onset dates, treatment given, dechallenge, and rechallenge details…"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none font-sans leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* SECTION: Assessment */}
          {activeSection === 'assessment' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Medical Review & Causality Assessment</h3>
                  <DataOriginBadge origin="assessed" />
                </div>
                <span className="text-[11px] text-slate-400">Physician causality sign-off</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Company Causality</label>
                  <select
                    disabled={isClosed}
                    value={formData.assessment?.companyCausality || 'Unassessed'}
                    onChange={(e) => updateField('assessment.companyCausality', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white font-semibold"
                  >
                    <option value="Unassessed">Unassessed</option>
                    <option value="Related">Related (Reasonable Possibility)</option>
                    <option value="Not Related">Not Related</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">Listedness / Expectedness</label>
                  <select
                    disabled={isClosed}
                    value={formData.assessment?.listedness || 'Unknown'}
                    onChange={(e) => updateField('assessment.listedness', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white"
                  >
                    <option value="Listed">Listed (In Reference Safety Information)</option>
                    <option value="Unlisted">Unlisted (Unexpected)</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1 text-xs">Medical Reviewer Comments</label>
                <textarea
                  rows={4}
                  disabled={isClosed}
                  value={formData.assessment?.medicalReviewerComments || ''}
                  onChange={(e) => updateField('assessment.medicalReviewerComments', e.target.value)}
                  placeholder="Medical evaluation: Temporal relationship is plausible. Underlying conditions unlikely to account for acute onset. Causality assessed as Related."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* SECTION: Coding (MedDRA) */}
          {activeSection === 'coding' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">MedDRA Medical Dictionary Coding</h3>
                  <DataOriginBadge origin="entered" />
                </div>
                <span className="text-[11px] text-slate-400">Preferred Term & SOC</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Coded Preferred Term (PT):</span>
                  <span className="badge bg-indigo-50 text-indigo-700 font-mono">10037844</span>
                </div>
                <p className="font-semibold text-slate-900 text-sm">
                  {formData.reactions?.[0]?.pt || formData.eventSummary || 'Skin rash'}
                </p>
                <p className="text-slate-500 text-[11px]">
                  System Organ Class (SOC): Skin and subcutaneous tissue disorders
                </p>
              </div>
            </div>
          )}

          {/* SECTION: Documents */}
          {activeSection === 'documents' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Source Documents & Attachments</h3>
                  <DataOriginBadge origin="reported" />
                </div>
                <span className="text-[11px] text-slate-400">Hospital discharge & lab reports</span>
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-2">
                <Paperclip className="mx-auto h-8 w-8 text-slate-300" />
                <p className="font-medium text-slate-700">No documents attached to this case yet.</p>
                <p className="text-[11px] text-slate-400">PDF, JPG, PNG attachments up to 25MB.</p>
              </div>
            </div>
          )}

          {/* SECTION: Follow-ups */}
          {activeSection === 'followups' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Follow-up Communication & Inquiries</h3>
                  <DataOriginBadge origin="entered" />
                </div>
                <span className="text-[11px] text-slate-400">Query tracking</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Initial Follow-up Query:</span>
                  <span className="badge bg-amber-50 text-amber-700">Pending Response</span>
                </div>
                <p className="text-[11px]">
                  Requested discharge summary and serum creatinine lab levels from treating physician.
                </p>
              </div>
            </div>
          )}

          {/* SECTION: Reporting */}
          {activeSection === 'reporting' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Regulatory Reporting & Submissions</h3>
                  <DataOriginBadge origin="assessed" />
                </div>
                <span className="text-[11px] text-slate-400">ICH E2B (R3) Gateway</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-900 block">Health Authority Reporting Rule:</span>
                    <span className="text-slate-500 text-[11px]">
                      {caseData.seriousness === 'Serious' ? '15-Day Expedited Safety Report (ICH E2A)' : 'Non-Serious Periodic / Summary Report'}
                    </span>
                  </div>
                  <span className="badge bg-blue-50 text-blue-700 font-semibold">
                    {caseData.seriousness === 'Serious' ? '15-Day Clock Active' : 'Periodic Queue'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: History (Audit Trail) */}
          {activeSection === 'history' && (
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Electronic Audit Trail (21 CFR Part 11)</h3>
                  <DataOriginBadge origin="entered" />
                </div>
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
                >
                  {loadingHistory ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading audit history…</div>
              ) : auditHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No previous audit entries found.</div>
              ) : (
                <div className="space-y-3">
                  {auditHistory.map((evt, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/50 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{evt.summary}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Actor: <strong>{evt.actorEmail}</strong> ({evt.actorRole}) • Action: <code>{evt.action}</code>
                      </div>
                      {evt.meta?.changeReason && (
                        <div className="rounded-lg bg-amber-50/60 p-2 text-[11px] text-amber-900 border border-amber-200/60 font-medium">
                          Reason: {evt.meta.changeReason}
                        </div>
                      )}
                      {evt.meta?.diffs && evt.meta.diffs.length > 0 && (
                        <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                          <span className="font-semibold block text-slate-700">Modified Fields:</span>
                          <ul className="list-disc list-inside pl-1 space-y-0.5">
                            {evt.meta.diffs.map((d, dIdx) => (
                              <li key={dIdx}>
                                <strong>{d.label || d.field}:</strong> {String(d.oldValue || '—')} → {String(d.newValue || '—')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Right Rail (Workflow Timeline & Checklist) ─────── */}
        <aside className="lg:col-span-3 space-y-4">
          {/* Workflow Stepper */}
          <div className="card p-4 bg-white space-y-3">
            <span className="font-bold text-xs text-slate-900 block">Workflow Progress</span>
            <div className="space-y-2">
              {WORKFLOW_STAGES.map((stg, i) => {
                const isCurrent = (caseData.status === stg.id) || (stg.id === 'closed' && isClosed);
                return (
                  <div key={stg.id} className="flex items-center gap-2.5 text-xs">
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        isCurrent
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={
                        isCurrent ? 'font-bold text-slate-900' : 'text-slate-500'
                      }
                    >
                      {stg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Readiness Checklist for Closure */}
          <div className="card p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 block">Readiness for Closure</span>
              <span
                className={`badge text-[10px] font-bold ${
                  closureReadiness?.isReady
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {closureReadiness?.isReady ? 'Ready' : 'Pending'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {[
                {
                  label: 'Identifiable Patient',
                  met: !!(formData.patient?.reference || formData.patient?.age != null || formData.patient?.sex),
                },
                {
                  label: 'Suspect Product Documented',
                  met: !!(formData.product || formData.caseProducts?.length > 0),
                },
                {
                  label: 'Reported Adverse Reaction',
                  met: !!(formData.eventSummary || formData.reactions?.length > 0),
                },
                {
                  label: 'Clinical Case Narrative',
                  met: !!formData.narrative?.trim(),
                },
                {
                  label: 'Medical Review Causality',
                  met: formData.assessment?.companyCausality && formData.assessment.companyCausality !== 'Unassessed',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px]">
                  {item.met ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  )}
                  <span className={item.met ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
