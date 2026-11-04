import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Link2,
  FileText,
  User,
  Pill,
  Calendar,
  Building,
  Info,
  Check,
  AlertCircle,
  History,
  Scale,
} from 'lucide-react';
import { fetchDuplicateReview, recordDuplicateDecision } from '../services/duplicateService';
import ScoreRing from '../components/duplicate/ScoreRing';
import { formatDuplicateReviewWhatsApp, openWhatsAppShare, WhatsAppIcon } from '../utils/whatsappFormatter';

export default function DuplicateCompare() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const [error, setError] = useState(null);

  // Decision form state
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const loadReview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchDuplicateReview(id);
      if (res.success && res.data) {
        setReview(res.data);
        if (res.data.reason) {
          setReason(res.data.reason);
        }
      } else {
        setError('Duplicate review record could not be loaded.');
      }
    } catch (err) {
      console.error('Error fetching duplicate review:', err);
      setError(err.response?.data?.error || 'Failed to load duplicate review.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReview();
  }, [id]);

  const handleDecision = async (decision) => {
    setActionError(null);
    setActionSuccess(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      setActionError('A documented rationale (minimum 5 characters) is required to justify this decision for pharmacovigilance compliance.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await recordDuplicateDecision(id, {
        decision,
        reason: trimmedReason,
      });

      if (res.success) {
        setActionSuccess(
          decision === 'CONFIRMED_DUPLICATE'
            ? 'Candidate cases confirmed as duplicate. Reciprocal case links established while preserving both histories.'
            : 'Candidate pair marked as distinct (not a duplicate). Decision recorded in audit log.',
        );
        await loadReview();
      }
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to submit decision.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="text-sm font-semibold text-slate-700">Loading side-by-side comparison…</p>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-red-600 mx-auto" />
        <h3 className="text-base font-bold text-red-900">Failed to Load Duplicate Review</h3>
        <p className="text-xs text-red-700">{error || 'Review not found.'}</p>
        <Link
          to="/duplicates"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Duplicate Queue
        </Link>
      </div>
    );
  }

  const source = review.sourceId || {};
  const candidate = review.candidateCaseId || {};
  const breakdown = review.breakdown || {};

  // Helper to extract fields safely
  const sProduct = source.product || (source.caseProducts?.[0]?.productName) || 'N/A';
  const cProduct = candidate.product || (candidate.caseProducts?.[0]?.productName) || 'N/A';

  const sReaction = source.eventSummary || source.reactions?.[0]?.verbatim || 'N/A';
  const cReaction = candidate.eventSummary || candidate.reactions?.[0]?.verbatim || 'N/A';

  const sDate = source.receiptDate ? new Date(source.receiptDate).toLocaleDateString() : 'N/A';
  const cDate = candidate.receiptDate ? new Date(candidate.receiptDate).toLocaleDateString() : 'N/A';

  const sSex = source.patient?.sex || source.patientGender || 'Unknown';
  const cSex = candidate.patient?.sex || candidate.patientGender || 'Unknown';

  const sAge = source.patient?.age != null ? `${source.patient.age} yrs` : (source.patientAge ? `${source.patientAge} yrs` : 'Unknown');
  const cAge = candidate.patient?.age != null ? `${candidate.patient.age} yrs` : (candidate.patientAge ? `${candidate.patientAge} yrs` : 'Unknown');

  const sRef = source.patient?.reference || 'None specified';
  const cRef = candidate.patient?.reference || 'None specified';

  const sRepName = source.reporter?.name || 'Unspecified';
  const cRepName = candidate.reporter?.name || 'Unspecified';

  const sRepRole = source.reporter?.qualification || 'Physician';
  const cRepRole = candidate.reporter?.qualification || 'Physician';

  const sRepOrg = source.reporter?.organization || source.reporter?.contact || source.reporter?.country || 'India';
  const cRepOrg = candidate.reporter?.organization || candidate.reporter?.contact || candidate.reporter?.country || 'India';

  const sSeriousness = source.seriousness || 'Non-Serious';
  const cSeriousness = candidate.seriousness || 'Non-Serious';

  const sNarrative = source.narrative || source.eventSummary || 'No clinical narrative recorded.';
  const cNarrative = candidate.narrative || candidate.eventSummary || 'No clinical narrative recorded.';

  // Side-by-side comparison rows
  // matching fields highlighted green, differing amber
  const comparisonRows = [
    {
      label: 'Suspected Product',
      icon: Pill,
      sourceVal: sProduct,
      candVal: cProduct,
      isMatch: breakdown.product?.score > 0,
      matchDetail: breakdown.product?.matchType === 'exact' ? 'Exact Match (30 pts)' : breakdown.product?.score > 0 ? `Fuzzy Match (${breakdown.product.score} pts)` : 'Different',
    },
    {
      label: 'Adverse Event / MedDRA Term',
      icon: AlertCircle,
      sourceVal: sReaction,
      candVal: cReaction,
      isMatch: breakdown.reaction?.score > 0,
      matchDetail: breakdown.reaction?.matchType === 'exact' ? 'Exact Match (25 pts)' : breakdown.reaction?.score > 0 ? `Fuzzy Overlap (${breakdown.reaction.score} pts)` : 'Different',
    },
    {
      label: 'Receipt / Onset Date',
      icon: Calendar,
      sourceVal: sDate,
      candVal: cDate,
      isMatch: breakdown.eventDate?.score > 0,
      matchDetail: breakdown.eventDate?.daysDifference != null ? `Δ ${breakdown.eventDate.daysDifference} days (${breakdown.eventDate.score} pts)` : (breakdown.eventDate?.score > 0 ? 'Within tolerance' : 'Beyond window'),
    },
    {
      label: 'Patient Biological Sex',
      icon: User,
      sourceVal: sSex,
      candVal: cSex,
      isMatch: breakdown.patientSex?.score > 0,
      matchDetail: breakdown.patientSex?.score > 0 ? 'Exact Match (10 pts)' : 'Mismatch / Unknown',
    },
    {
      label: 'Patient Age',
      icon: User,
      sourceVal: sAge,
      candVal: cAge,
      isMatch: breakdown.patientAge?.score > 0,
      matchDetail: breakdown.patientAge?.ageDifference != null ? `Δ ${breakdown.patientAge.ageDifference} yrs (${breakdown.patientAge.score} pts)` : (breakdown.patientAge?.score > 0 ? 'Matched' : 'Mismatch'),
    },
    {
      label: 'Patient Reference / Identifier',
      icon: FileText,
      sourceVal: sRef,
      candVal: cRef,
      isMatch: sRef !== 'None specified' && cRef !== 'None specified' && sRef.toLowerCase() === cRef.toLowerCase(),
      matchDetail: sRef !== 'None specified' && sRef === cRef ? 'Matching ID' : 'Separate Reference',
    },
    {
      label: 'Reporter Name & Role',
      icon: User,
      sourceVal: `${sRepName} (${sRepRole})`,
      candVal: `${cRepName} (${cRepRole})`,
      isMatch: breakdown.reporter?.score > 0,
      matchDetail: breakdown.reporter?.score > 0 ? `Reporter Match (${breakdown.reporter.score} pts)` : 'Different Reporters',
    },
    {
      label: 'Reporter Contact / Organization',
      icon: Building,
      sourceVal: sRepOrg,
      candVal: cRepOrg,
      isMatch: sRepOrg && cRepOrg && sRepOrg.toLowerCase() === cRepOrg.toLowerCase(),
      matchDetail: sRepOrg === cRepOrg ? 'Identical Organization' : 'Differing contact',
    },
    {
      label: 'Seriousness Classification',
      icon: Scale,
      sourceVal: sSeriousness,
      candVal: cSeriousness,
      isMatch: sSeriousness.toLowerCase() === cSeriousness.toLowerCase(),
      matchDetail: sSeriousness === cSeriousness ? 'Identical Severity' : 'Differing Seriousness',
    },
    {
      label: 'Clinical Narrative Summary',
      icon: FileText,
      sourceVal: sNarrative,
      candVal: cNarrative,
      isMatch: breakdown.reaction?.score > 0,
      matchDetail: 'Clinical Context',
      isBlock: true,
    },
  ];

  const isDecided = review.decision && review.decision !== 'PENDING';

  const handleShareWhatsApp = () => {
    if (!review) return;
    const message = formatDuplicateReviewWhatsApp(review);
    openWhatsAppShare(message);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ── Breadcrumb & Top Navigation ────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          to="/duplicates"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Duplicate Screening Queue
        </Link>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 transition-all shadow-2xs"
            title="Share duplicate assessment on WhatsApp"
          >
            <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>Share Assessment</span>
          </button>

          <span className="text-xs text-slate-500 font-medium">Review ID:</span>
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {review._id?.slice(-8)}
          </span>
        </div>
      </div>

      {/* ── Hero Match Overview Banner ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Source Case Header */}
          <div className="flex-1 text-center lg:text-left space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
              Source Safety Case
            </span>
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <h2 className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {review.sourceCaseNumber || source.caseNumber}
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                {source.status || 'Active'}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium truncate max-w-sm">
              {sProduct} — {sReaction}
            </p>
          </div>

          {/* Center: Radial Score Ring & Matched Fields */}
          <div className="flex flex-col items-center justify-center px-6 py-2 border-y lg:border-y-0 lg:border-x border-slate-100 w-full lg:w-auto">
            <ScoreRing score={review.score} size={108} strokeWidth={9} />
            <div className="flex flex-wrap justify-center gap-1 mt-2.5 max-w-xs text-center">
              {review.matchedFields && review.matchedFields.length > 0 ? (
                review.matchedFields.map((f) => (
                  <span
                    key={f}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    ✓ {f}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-slate-400">No deterministic matches</span>
              )}
            </div>
          </div>

          {/* Candidate Case Header */}
          <div className="flex-1 text-center lg:text-right space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
              Candidate Match Case
            </span>
            <div className="flex items-center justify-center lg:justify-end gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                {candidate.status || 'Active'}
              </span>
              <h2 className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {review.candidateCaseNumber || candidate.caseNumber}
              </h2>
            </div>
            <p className="text-xs text-slate-600 font-medium truncate max-w-sm lg:ml-auto">
              {cProduct} — {cReaction}
            </p>
          </div>
        </div>

        {/* Existing Decision Stamp Banner */}
        {isDecided && (
          <div
            className={`mt-6 p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              review.decision === 'CONFIRMED_DUPLICATE'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-start gap-3">
              {review.decision === 'CONFIRMED_DUPLICATE' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">
                    {review.decision === 'CONFIRMED_DUPLICATE'
                      ? 'Decision: Confirmed Duplicate'
                      : 'Decision: Not a Duplicate (Distinct Cases)'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Decided by {review.decidedBy?.name || review.decidedBy?.email || 'Safety Reviewer'} on{' '}
                    {review.decidedAt ? new Date(review.decidedAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <p className="text-xs italic opacity-90">
                  Documented Rationale: "{review.reason}"
                </p>
              </div>
            </div>

            {review.decision === 'CONFIRMED_DUPLICATE' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white text-emerald-800 border border-emerald-300 shadow-2xs shrink-0">
                <Link2 className="h-3.5 w-3.5" />
                Linked Records Preserved
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Side-by-Side Comparison Matrix ─────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Side-by-Side Attribute Comparison</h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Matching Field
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Differing Field
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {comparisonRows.map((row) => {
            const Icon = row.icon;
            // Green highlight for matches, Amber highlight for differences
            const rowClass = row.isMatch
              ? 'bg-emerald-50/60 border-l-4 border-l-emerald-500 text-emerald-950'
              : 'bg-amber-50/40 border-l-4 border-l-amber-500 text-amber-950';

            return (
              <div
                key={row.label}
                className={`p-4 transition-colors ${rowClass}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${row.isMatch ? 'text-emerald-700' : 'text-amber-700'}`} />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {row.label}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                      row.isMatch
                        ? 'bg-emerald-100/90 text-emerald-800 border-emerald-300 shadow-2xs'
                        : 'bg-amber-100/90 text-amber-800 border-amber-300 shadow-2xs'
                    }`}
                  >
                    {row.isMatch ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-700" />
                        Match ({row.matchDetail})
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 text-amber-700" />
                        Differing ({row.matchDetail})
                      </>
                    )}
                  </span>
                </div>

                {/* Values columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Source value */}
                  <div className="p-3 rounded-xl bg-white/95 border border-slate-200/80 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {review.sourceCaseNumber || source.caseNumber} (Source)
                    </div>
                    <div className={`text-xs font-semibold ${row.isBlock ? 'leading-relaxed text-slate-700 font-normal' : 'text-slate-900'}`}>
                      {row.sourceVal}
                    </div>
                  </div>

                  {/* Candidate value */}
                  <div className="p-3 rounded-xl bg-white/95 border border-slate-200/80 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {review.candidateCaseNumber || candidate.caseNumber} (Candidate)
                    </div>
                    <div className={`text-xs font-semibold ${row.isBlock ? 'leading-relaxed text-slate-700 font-normal' : 'text-slate-900'}`}>
                      {row.candVal}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Human Decision & Regulatory Sign-Off Panel ─────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Human Duplicate Decision & Compliance Sign-Off
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Regulatory compliance requires explicit human judgment and documented justification.
            </p>
          </div>
        </div>

        {/* Feedback notices */}
        {actionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Mandatory Reason Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span>Decision Reason / Clinical Justification</span>
              <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-slate-400">
              {reason.length} / minimum 5 characters
            </span>
          </div>

          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain the clinical and regulatory reasoning for this duplicate assessment (e.g. 'Confirmed duplicate: same patient age, sex, suspect drug lot, and matching adverse event onset dates reported by separate healthcare providers')..."
            className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-brand-500 focus:border-brand-500 transition-colors shadow-2xs leading-relaxed"
          />
        </div>

        {/* Audit preservation disclaimer */}
        <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 border border-slate-200 flex items-start gap-2">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p>
            <strong>Preservation Guarantee:</strong> Confirming a duplicate will reciprocally link both records. Neither case will be deleted or purged from the database, and the complete audit trail and narrative of each record will be fully maintained.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleDecision('NOT_DUPLICATE')}
            disabled={submitting || !reason.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="h-4 w-4 text-slate-500" />
            Not a Duplicate (Distinct Case)
          </button>

          <button
            type="button"
            onClick={() => handleDecision('CONFIRMED_DUPLICATE')}
            disabled={submitting || !reason.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <Link2 className="h-4 w-4" />
            {submitting ? 'Recording Decision…' : 'Confirm Duplicate & Link Cases'}
          </button>
        </div>
      </div>
    </div>
  );
}
