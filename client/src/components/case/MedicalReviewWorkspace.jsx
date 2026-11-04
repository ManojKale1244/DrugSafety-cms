import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stethoscope,
  Shield,
  ShieldCheck,
  AlertTriangle,
  FileText,
  User,
  Pill,
  History,
  CheckCircle2,
  Clock,
  HelpCircle,
  Layers,
  ChevronRight,
  ExternalLink,
  Lock,
  Send,
  Loader2,
  X,
  Info,
  Calendar,
  Sparkles,
  GitCompare,
  Plus,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DataOriginBadge from './DataOriginBadge';

const CAUSALITY_SCALES = [
  { id: 'Certain', label: 'Certain', color: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { id: 'Probable', label: 'Probable', color: 'bg-teal-600 text-white hover:bg-teal-700' },
  { id: 'Possible', label: 'Possible', color: 'bg-sky-600 text-white hover:bg-sky-700' },
  { id: 'Unlikely', label: 'Unlikely', color: 'bg-slate-500 text-white hover:bg-slate-600' },
  { id: 'Conditional', label: 'Conditional', color: 'bg-amber-600 text-white hover:bg-amber-700' },
  { id: 'Unassessable', label: 'Unassessable', color: 'bg-purple-600 text-white hover:bg-purple-700' },
  { id: 'Not Assessed', label: 'Not Assessed', color: 'bg-slate-200 text-slate-700 hover:bg-slate-300' },
];

const SERIOUSNESS_DEFINITIONS = [
  {
    id: 'death',
    label: 'Results in Death',
    tooltip: 'Adverse event resulted directly or indirectly in patient death.',
  },
  {
    id: 'life-threatening',
    label: 'Life-Threatening',
    tooltip: 'Patient was at immediate risk of death at the time of the event (ICH E2A standard).',
  },
  {
    id: 'hospitalization',
    label: 'Inpatient Hospitalization / Prolongation',
    tooltip: 'Event necessitated hospitalization or prolonged existing in-hospital stay.',
  },
  {
    id: 'disability',
    label: 'Persistent / Significant Disability',
    tooltip: 'Event caused substantial disruption in the ability to conduct normal life functions.',
  },
  {
    id: 'congenital anomaly',
    label: 'Congenital Anomaly / Birth Defect',
    tooltip: 'Exposure prior to conception or during pregnancy resulted in an adverse offspring outcome.',
  },
  {
    id: 'medically important',
    label: 'Other Medically Important Condition',
    tooltip: 'Medical intervention required to prevent one of the other 5 serious outcomes listed above.',
  },
];

/**
 * Medical Review & Causality Assessment Workspace (Module 7)
 */
export default function MedicalReviewWorkspace({
  caseId,
  isClosed = false,
  onCaseUpdated = () => {},
}) {
  const { user, hasPermission } = useAuth();
  const canReview = hasPermission('medical.review') || user?.role?.name === 'admin' || user?.role?.name === 'reviewer';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [versions, setVersions] = useState([]);

  // Form State
  const [seriousnessCriteria, setSeriousnessCriteria] = useState([]);
  const [expectedness, setExpectedness] = useState('unknown');
  const [causalityMatrix, setCausalityMatrix] = useState([]);
  const [medicalComment, setMedicalComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Modals
  const [showSignModal, setShowSignModal] = useState(false);
  const [signatureStatement, setSignatureStatement] = useState(
    'I confirm that this medical assessment represents my clinical judgment based on all available clinical evidence.',
  );
  const [signing, setSigning] = useState(false);

  const [showSupersedeModal, setShowSupersedeModal] = useState(false);
  const [supersedeReason, setSupersedeReason] = useState('');
  const [superseding, setSuperseding] = useState(false);

  const [showRfiModal, setShowRfiModal] = useState(false);
  const [rfiQuery, setRfiQuery] = useState('');
  const [rfiPriority, setRfiPriority] = useState('Routine');
  const [rfiDueDate, setRfiDueDate] = useState('');
  const [submittingRfi, setSubmittingRfi] = useState(false);

  const [showCompareDrawer, setShowCompareDrawer] = useState(false);
  const [selectedVersionToCompare, setSelectedVersionToCompare] = useState(null);

  // Tooltip hover
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Fetch assessment data
  const fetchAssessmentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/cases/${caseId}/assessments`);
      if (res.data.success) {
        setCaseData(res.data.case);
        setVersions(res.data.versions || []);
        const cur = res.data.currentAssessment;
        setAssessment(cur);

        // Populate local form fields
        setSeriousnessCriteria(cur.seriousnessCriteria || []);
        setExpectedness(cur.expectedness || 'unknown');
        setCausalityMatrix(cur.causality || []);
        setMedicalComment(cur.medicalComment || '');
        setIsDirty(false);

        if (res.data.versions?.length > 1) {
          setSelectedVersionToCompare(res.data.versions[1]);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load medical assessment');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchAssessmentData();
  }, [fetchAssessmentData]);

  const isSigned = assessment?.status === 'SIGNED';

  // Toggle seriousness criterion
  const toggleSeriousness = (criterionId) => {
    if (isSigned || !canReview || isClosed) return;
    setIsDirty(true);
    setSeriousnessCriteria((prev) =>
      prev.includes(criterionId) ? prev.filter((id) => id !== criterionId) : [...prev, criterionId],
    );
  };

  // Update causality for a specific pair
  const updateCausalityScore = (pairIndex, scaleId) => {
    if (isSigned || !canReview || isClosed) return;
    setIsDirty(true);
    setCausalityMatrix((prev) => {
      const next = [...prev];
      next[pairIndex] = { ...next[pairIndex], causality: scaleId };
      return next;
    });
  };

  const updateCausalityNote = (pairIndex, note) => {
    if (isSigned || !canReview || isClosed) return;
    setIsDirty(true);
    setCausalityMatrix((prev) => {
      const next = [...prev];
      next[pairIndex] = { ...next[pairIndex], notes: note };
      return next;
    });
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!canReview || isClosed) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        seriousnessCriteria,
        expectedness,
        causality: causalityMatrix,
        medicalComment,
      };

      const res = await api.patch(`/cases/${caseId}/assessments`, payload);
      if (res.data.success) {
        await fetchAssessmentData();
        onCaseUpdated();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save draft assessment');
    } finally {
      setSaving(false);
    }
  };

  // Execute sign
  const handleConfirmSign = async () => {
    if (!assessment?._id || !canReview || isClosed) return;
    setSigning(true);
    setError(null);
    try {
      const res = await api.post(`/assessments/${assessment._id}/sign`, {
        signatureStatement,
      });
      if (res.data.success) {
        setShowSignModal(false);
        await fetchAssessmentData();
        onCaseUpdated();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to electronically sign assessment');
    } finally {
      setSigning(false);
    }
  };

  // Execute supersede
  const handleConfirmSupersede = async () => {
    if (!assessment?._id || !canReview || isClosed) return;
    if (!supersedeReason.trim()) {
      setError('A clinical justification reason is strictly required to supersede a signed assessment.');
      return;
    }
    setSuperseding(true);
    setError(null);
    try {
      const payload = {
        supersedeReason: supersedeReason.trim(),
        seriousnessCriteria,
        expectedness,
        causality: causalityMatrix,
        medicalComment,
      };

      const res = await api.patch(`/assessments/${assessment._id}`, payload);
      if (res.data.success) {
        setShowSupersedeModal(false);
        setSupersedeReason('');
        await fetchAssessmentData();
        onCaseUpdated();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to supersede assessment');
    } finally {
      setSuperseding(false);
    }
  };

  // Submit Request for Information
  const handleCreateRfi = async () => {
    if (!assessment?._id || !rfiQuery.trim()) return;
    setSubmittingRfi(true);
    try {
      const payload = {
        query: rfiQuery.trim(),
        priority: rfiPriority,
        dueDate: rfiDueDate || null,
      };

      const res = await api.post(`/assessments/${assessment._id}/request-info`, payload);
      if (res.data.success) {
        setShowRfiModal(false);
        setRfiQuery('');
        await fetchAssessmentData();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit Request for Information');
    } finally {
      setSubmittingRfi(false);
    }
  };

  if (loading && !assessment) {
    return (
      <div className="card p-12 bg-white flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        <span className="text-xs text-slate-500 font-medium">Loading clinical assessment workspace...</span>
      </div>
    );
  }

  const products = caseData?.caseProducts?.length > 0
    ? caseData.caseProducts
    : [{ productName: caseData?.product || 'Primary Product', role: 'Suspect' }];

  const reactions = caseData?.reactions?.length > 0
    ? caseData.reactions
    : [{ verbatim: caseData?.eventSummary || 'Adverse Event', pt: caseData?.eventSummary || '' }];

  return (
    <div className="space-y-6">
      {/* ── PERSISTENT REGULATORY NOTICE (Clinical Distinction Gate) ── */}
      <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 flex items-start gap-3 shadow-xs">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-950 text-xs sm:text-sm">
              Reporter statements ≠ assessment. Causality is a clinical judgment.
            </span>
            <span className="badge bg-amber-200 text-amber-900 text-[10px] font-bold">ICH E2D Regulatory Rule</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Reported verbatim descriptions and consumer statements represent subjective complaints. The medical reviewer's responsibility is to evaluate objective clinical evidence, latency, dechallenge/rechallenge kinetics, and known pharmacological mechanisms to establish formal causality and seriousness.
          </p>
        </div>
      </div>

      {/* ── ERROR BANNER ────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── WORKSPACE SPLIT-VIEW (Case Evidence vs Assessment Form) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ═════════════════════════════════════════════════════════════
            LEFT PANE: Read-Only Case Evidence, Narrative & Facts
            ═════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 space-y-5">
          <div className="card p-5 bg-white border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Case Evidence & Clinical History
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Read-Only Source</span>
            </div>

            {/* VISUAL CATEGORY 1: REPORTER STATEMENTS (Amber outline) */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                  Reporter Statements
                </span>
                <DataOriginBadge origin="reported" />
              </div>

              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Primary Reported Event:</span>
                  <p className="font-semibold text-slate-900">
                    "{caseData?.eventSummary || reactions[0]?.verbatim || 'Adverse event report'}"
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">Reported Clinical Narrative:</span>
                  <p className="text-slate-700 text-xs italic bg-white/70 p-2.5 rounded-lg border border-amber-100/70 whitespace-pre-wrap">
                    {caseData?.narrative || 'No comprehensive narrative recorded at intake.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-600">
                  <span>Reporter: <strong>{caseData?.reporter?.name || 'Anonymous'}</strong> ({caseData?.reporter?.qualification || 'Physician'})</span>
                  <span>Country: <strong>{caseData?.reporter?.country || 'India'}</strong></span>
                </div>
              </div>
            </div>

            {/* VISUAL CATEGORY 2: ENTERED CLINICAL FACTS (Blue/Slate outline) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  Entered Clinical Facts
                </span>
                <DataOriginBadge origin="entered" />
              </div>

              {/* Patient Demographics */}
              <div className="space-y-1 text-xs">
                <span className="text-[11px] font-bold text-slate-600 block">Patient Profile</span>
                <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Reference</span>
                    <strong className="text-slate-800">{caseData?.patient?.reference || 'PT-REF'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Age / Sex</span>
                    <strong className="text-slate-800">
                      {caseData?.patient?.age ? `${caseData.patient.age}y` : 'N/A'} • {caseData?.patient?.sex || 'Unknown'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Weight</span>
                    <strong className="text-slate-800">
                      {caseData?.patient?.weight ? `${caseData.patient.weight} kg` : 'N/A'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Medicinal Products */}
              <div className="space-y-1 text-xs">
                <span className="text-[11px] font-bold text-slate-600 block">Medicinal Products ({products.length})</span>
                <div className="space-y-1.5">
                  {products.map((p, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{p.productName}</span>
                        <span className="text-[11px] text-slate-500 block">
                          Indication: {p.indication || 'Unspecified'} • Dose: {p.dose || 'Standard'}
                        </span>
                      </div>
                      <span className={`badge text-[10px] font-semibold ${p.role === 'Suspect' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                        {p.role || 'Suspect'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coded Reactions */}
              <div className="space-y-1 text-xs">
                <span className="text-[11px] font-bold text-slate-600 block">Adverse Reactions ({reactions.length})</span>
                <div className="space-y-1.5">
                  {reactions.map((r, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{r.pt || r.verbatim}</span>
                        {r.meddraCode && (
                          <span className="badge bg-indigo-50 text-indigo-700 font-mono text-[10px]">
                            {r.meddraCode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        SOC: {r.soc || 'General'} • Outcome: <strong className="capitalize">{r.outcome || 'Unknown'}</strong>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* VISUAL CATEGORY 3: PRIOR ASSESSMENTS (Indigo outline) */}
            {versions.length > 0 && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                    Assessment Version Records
                  </span>
                  <DataOriginBadge origin="assessed" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Total Versions: <strong>{versions.length}</strong></span>
                  <button
                    type="button"
                    onClick={() => setShowCompareDrawer(true)}
                    className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-indigo-700 hover:text-indigo-900"
                  >
                    <GitCompare className="h-3 w-3" /> Compare Versions
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            RIGHT PANE: Medical Assessment Workspace Form
            ═════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 space-y-5">
          <div className="card p-6 bg-white border border-slate-200 space-y-5 shadow-xs">
            {/* Header: Status, Version & Signature Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Stethoscope className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Medical Review & Causality Assessment
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Version {assessment?.version || 1} • {isSigned ? 'Electronic Signature Active' : 'Draft In Progress'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isSigned ? (
                  <span className="badge bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs px-3 py-1 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    SIGNED (v{assessment.version})
                  </span>
                ) : (
                  <span className="badge bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs px-3 py-1 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    DRAFT (v{assessment?.version || 1})
                  </span>
                )}

                {isSigned && canReview && !isClosed && (
                  <button
                    type="button"
                    onClick={() => setShowSupersedeModal(true)}
                    className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 text-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Supersede (v{(assessment?.version || 1) + 1})
                  </button>
                )}
              </div>
            </div>

            {/* Processor Notice (If user cannot review) */}
            {!canReview && (
              <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 text-xs text-slate-600 flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-400" />
                <span>
                  <strong>Read-only access:</strong> You are viewing this evaluation as a data entry processor. Only users with the <code className="font-mono bg-slate-200 px-1 rounded">medical.review</code> permission can modify or sign assessments.
                </span>
              </div>
            )}

            {/* Signed Banner with Signature Details */}
            {isSigned && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> 21 CFR Part 11 Electronic Signature Stamp
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {new Date(assessment.signedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-emerald-950 font-medium">
                  Signed by: <strong>{assessment.signedByName}</strong> ({assessment.signedRole})
                </p>
                <p className="text-slate-600 italic text-[11px] bg-white/70 p-2 rounded border border-emerald-100">
                  "{assessment.signatureStatement}"
                </p>
                <p className="text-slate-500 text-[10px]">
                  This version is sealed and immutable. To make further clinical modifications, click "Supersede" to author a new revision with justification.
                </p>
              </div>
            )}

            {/* ── 1. SERIOUSNESS CRITERIA CHECKBOXES ────────────────── */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                  Seriousness Criteria (ICH E2A Standard)
                </label>
                <span className="text-[11px] text-slate-400">
                  {seriousnessCriteria.length > 0 ? (
                    <strong className="text-rose-600 font-bold">Serious Case ({seriousnessCriteria.length} flagged)</strong>
                  ) : (
                    <strong className="text-emerald-600 font-bold">Non-Serious</strong>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {SERIOUSNESS_DEFINITIONS.map((crit) => {
                  const isChecked = seriousnessCriteria.includes(crit.id);
                  return (
                    <label
                      key={crit.id}
                      className={`relative flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'border-rose-400 bg-rose-50/60 text-rose-950 font-semibold'
                          : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100/60'
                      } ${isSigned || !canReview || isClosed ? 'cursor-default opacity-85' : ''}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          disabled={isSigned || !canReview || isClosed}
                          checked={isChecked}
                          onChange={() => toggleSeriousness(crit.id)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        />
                        <span className="truncate">{crit.label}</span>
                      </div>

                      {/* Tooltip trigger */}
                      <div
                        className="text-slate-400 hover:text-slate-600"
                        onMouseEnter={() => setActiveTooltip(crit.id)}
                        onMouseLeave={() => setActiveTooltip(null)}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        {activeTooltip === crit.id && (
                          <div className="absolute right-2 bottom-full mb-1 z-30 max-w-xs bg-slate-900 text-white text-[11px] rounded-lg p-2 shadow-lg leading-normal">
                            {crit.tooltip}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* ── 2. EXPECTEDNESS / LISTEDNESS ──────────────────────── */}
            <div className="space-y-1.5 pt-2">
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                Listedness / Expectedness (SmPC / Reference Safety Information)
              </label>
              <select
                disabled={isSigned || !canReview || isClosed}
                value={expectedness}
                onChange={(e) => {
                  setExpectedness(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none font-semibold text-slate-800"
              >
                <option value="listed">Listed (Adverse event documented in approved label)</option>
                <option value="unlisted">Unlisted (Unexpected adverse reaction)</option>
                <option value="unknown">Unknown / Not Yet Documented</option>
              </select>
            </div>

            {/* ── 3. CAUSALITY MATRIX (Products × Reactions) ────────── */}
            <div className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                  Causality Matrix (Products × Reactions)
                </label>
                <span className="text-[11px] text-slate-400">WHO-UMC Standard Criteria</span>
              </div>

              <div className="space-y-3">
                {causalityMatrix.map((pair, pIdx) => (
                  <div
                    key={pIdx}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 text-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                      <div className="space-y-0.5">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Medicinal Product:</span>
                        <p className="font-bold text-slate-900">{pair.productName}</p>
                      </div>
                      <div className="space-y-0.5 sm:text-right">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Adverse Reaction:</span>
                        <p className="font-semibold text-indigo-900">{pair.reactionPt || pair.reactionVerbatim}</p>
                      </div>
                    </div>

                    {/* Causality Pill Selectors */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Assessed Causality: <strong className="text-slate-800">{pair.causality}</strong>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {CAUSALITY_SCALES.map((scale) => {
                          const isSelected = pair.causality === scale.id;
                          return (
                            <button
                              key={scale.id}
                              type="button"
                              disabled={isSigned || !canReview || isClosed}
                              onClick={() => updateCausalityScore(pIdx, scale.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                isSelected
                                  ? `${scale.color} ring-2 ring-offset-1 ring-slate-400 shadow-xs font-bold`
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              } ${isSigned || !canReview || isClosed ? 'cursor-default' : ''}`}
                            >
                              {scale.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pair Notes Input */}
                    <div>
                      <input
                        type="text"
                        disabled={isSigned || !canReview || isClosed}
                        value={pair.notes || ''}
                        onChange={(e) => updateCausalityNote(pIdx, e.target.value)}
                        placeholder="Clinical rationale (e.g. positive rechallenge, plausible onset latency)..."
                        className="w-full rounded-lg border border-slate-200 p-2 text-[11px] bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 4. CLINICAL COMMENT / NARRATIVE EVALUATION ────────── */}
            <div className="space-y-1.5 pt-2">
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                Medical Reviewer Clinical Summary & Comments
              </label>
              <textarea
                rows={4}
                disabled={isSigned || !canReview || isClosed}
                value={medicalComment}
                onChange={(e) => {
                  setMedicalComment(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Comprehensive clinical synthesis: evaluate biological plausibility, chronological latency, concomitant risk factors, and differential diagnoses..."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* ── 5. REQUESTS FOR INFORMATION (RFI) LIST ────────────── */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-slate-500" />
                  Requests for Information (RFI Follow-ups)
                </label>
                {canReview && !isClosed && (
                  <button
                    type="button"
                    onClick={() => setShowRfiModal(true)}
                    className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> New Follow-up Request
                  </button>
                )}
              </div>

              {assessment?.requestsForInfo?.length > 0 ? (
                <div className="space-y-2">
                  {assessment.requestsForInfo.map((rfi, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`badge font-semibold ${rfi.priority === 'Urgent' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'}`}>
                          {rfi.priority} RFI
                        </span>
                        <span className="text-slate-400">
                          Due: {rfi.dueDate ? new Date(rfi.dueDate).toLocaleDateString() : '7 days'}
                        </span>
                      </div>
                      <p className="text-slate-800 font-medium">"{rfi.query}"</p>
                      <p className="text-[10px] text-slate-500">
                        Status: <strong className="capitalize">{rfi.status}</strong> • Requested by {rfi.requestedByName}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-xs italic">No follow-up inquiries requested yet.</p>
              )}
            </div>

            {/* ── ACTION BUTTONS ────────────────────────────────────── */}
            {canReview && !isClosed && (
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                {!isSigned ? (
                  <>
                    <button
                      type="button"
                      disabled={saving || !isDirty}
                      onClick={handleSaveDraft}
                      className="btn btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSignModal(true)}
                      className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <ShieldCheck className="h-4 w-4" /> Sign Assessment (21 CFR Part 11)
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSupersedeModal(true)}
                    className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Create Superseding Version (v{(assessment?.version || 1) + 1})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ELECTRONIC SIGNATURE MODAL ──────────────────────────────── */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="card max-w-lg w-full p-6 bg-white space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Electronic Signature & Attestation (21 CFR Part 11)
                </h3>
              </div>
              <button type="button" onClick={() => setShowSignModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                By executing this electronic signature, you formally seal Version {assessment?.version || 1} of this Medical Assessment. The document will become immutable.
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Signatory:</span>
                  <strong className="text-slate-800">{user?.name} ({user?.email})</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Role:</span>
                  <strong className="text-slate-800">{user?.role?.displayName || user?.role?.name || 'Reviewer'}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Timestamp:</span>
                  <strong className="text-slate-800">{new Date().toLocaleString()}</strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Attestation Statement:</label>
                <textarea
                  rows={2}
                  value={signatureStatement}
                  onChange={(e) => setSignatureStatement(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={signing}
                onClick={() => setShowSignModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={signing}
                onClick={handleConfirmSign}
                className="btn btn-primary text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {signing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm & Seal Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUPERSEDE JUSTIFICATION MODAL ───────────────────────────── */}
      {showSupersedeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="card max-w-lg w-full p-6 bg-white space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Supersede Signed Assessment (Version {(assessment?.version || 1) + 1})
                </h3>
              </div>
              <button type="button" onClick={() => setShowSupersedeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Under pharmacovigilance compliance rules, signed assessments cannot be altered directly. Superseding will archive Version {assessment?.version} into the permanent audit trail and spawn an editable Version {(assessment?.version || 1) + 1} draft.
              </p>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Reason for Superseding <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={supersedeReason}
                  onChange={(e) => setSupersedeReason(e.target.value)}
                  placeholder="e.g. New laboratory findings arrived confirming hepatic transaminase recovery; specialist consultation..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={superseding}
                onClick={() => setShowSupersedeModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={superseding || !supersedeReason.trim()}
                onClick={handleConfirmSupersede}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                {superseding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Generate Version {(assessment?.version || 1) + 1}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST FOR INFORMATION (RFI) MODAL ─────────────────────── */}
      {showRfiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="card max-w-lg w-full p-6 bg-white space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Request for Information (Follow-up Task)
                </h3>
              </div>
              <button type="button" onClick={() => setShowRfiModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Clinical Inquiry / Information Needed <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rfiQuery}
                  onChange={(e) => setRfiQuery(e.target.value)}
                  placeholder="e.g. Please obtain hospital discharge summary, baseline ECG, and concomitant herbal supplement history..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Inquiry Priority</label>
                  <select
                    value={rfiPriority}
                    onChange={(e) => setRfiPriority(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs bg-slate-50 focus:bg-white"
                  >
                    <option value="Routine">Routine (7-day timeline)</option>
                    <option value="Urgent">Urgent (3-day expedited)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={rfiDueDate}
                    onChange={(e) => setRfiDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={submittingRfi}
                onClick={() => setShowRfiModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRfi || !rfiQuery.trim()}
                onClick={handleCreateRfi}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                {submittingRfi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Dispatch Follow-up Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VERSION COMPARE DRAWER / MODAL ──────────────────────────── */}
      {showCompareDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="card max-w-4xl w-full max-h-[85vh] flex flex-col p-6 bg-white space-y-4 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Medical Assessment Version Comparison
                </h3>
              </div>
              <button type="button" onClick={() => setShowCompareDrawer(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Version Selector */}
            <div className="flex items-center gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700">Compare Current (v{assessment?.version}) with:</span>
              <select
                value={selectedVersionToCompare?._id || ''}
                onChange={(e) => {
                  const target = versions.find((v) => v._id === e.target.value);
                  setSelectedVersionToCompare(target);
                }}
                className="rounded-lg border border-slate-200 p-1.5 text-xs bg-white font-medium"
              >
                {versions.map((ver) => (
                  <option key={ver._id} value={ver._id}>
                    Version {ver.version} ({ver.status}) — {new Date(ver.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-2 gap-4 text-xs overflow-y-auto pr-1 flex-1">
              {/* CURRENT VERSION */}
              <div className="card p-4 bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900 text-sm">Current Assessment (v{assessment?.version})</span>
                  <span className="badge bg-indigo-100 text-indigo-800 text-[10px]">{assessment?.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">Seriousness Criteria:</span>
                  <p className="text-slate-800">
                    {seriousnessCriteria.length > 0 ? seriousnessCriteria.join(', ') : 'Non-Serious'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">Expectedness:</span>
                  <p className="text-slate-800 capitalize">{expectedness}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">Causality Ratings:</span>
                  <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                    {causalityMatrix.map((c, i) => (
                      <li key={i}>
                        {c.productName} × {c.reactionPt || c.reactionVerbatim}: <strong>{c.causality}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">Reviewer Comments:</span>
                  <p className="text-slate-700 italic">{medicalComment || 'No comment.'}</p>
                </div>
              </div>

              {/* HISTORICAL VERSION */}
              <div className="card p-4 bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900 text-sm">
                    Historical Assessment (v{selectedVersionToCompare?.version || 'N/A'})
                  </span>
                  <span className="badge bg-slate-200 text-slate-700 text-[10px]">
                    {selectedVersionToCompare?.status || 'Archived'}
                  </span>
                </div>
                {selectedVersionToCompare ? (
                  <>
                    <div>
                      <span className="text-slate-400 block text-[11px] font-bold">Seriousness Criteria:</span>
                      <p className="text-slate-800">
                        {selectedVersionToCompare.seriousnessCriteria?.length > 0
                          ? selectedVersionToCompare.seriousnessCriteria.join(', ')
                          : 'Non-Serious'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px] font-bold">Expectedness:</span>
                      <p className="text-slate-800 capitalize">{selectedVersionToCompare.expectedness}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px] font-bold">Causality Ratings:</span>
                      <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                        {selectedVersionToCompare.causality?.map((c, i) => (
                          <li key={i}>
                            {c.productName} × {c.reactionPt || c.reactionVerbatim}: <strong>{c.causality}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px] font-bold">Reviewer Comments:</span>
                      <p className="text-slate-700 italic">{selectedVersionToCompare.medicalComment || 'No comment.'}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 italic">No historical version selected.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCompareDrawer(false)}
                className="btn btn-secondary text-xs"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

