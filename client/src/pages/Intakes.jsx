import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Search,
  Plus,
  Eye,
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';
import IntakeWizard from '../components/intake/IntakeWizard';

const STATUS_FILTERS = [
  { id: '', label: 'All Intakes' },
  { id: 'RECEIVED', label: 'Received (Valid)' },
  { id: 'INCOMPLETE', label: 'Incomplete' },
  { id: 'VALIDATING', label: 'Validating' },
  { id: 'CONVERTED', label: 'Converted' },
  { id: 'REJECTED', label: 'Rejected' },
];

export default function Intakes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals & Drawers
  const [showWizard, setShowWizard] = useState(searchParams.get('action') === 'create' || searchParams.get('new') === 'true');
  const [previewIntake, setPreviewIntake] = useState(null);

  // Fetch intakes list
  const fetchIntakes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/intakes', {
        params: {
          status: statusFilter,
          source: sourceFilter,
          search,
          page,
          limit: 10,
        },
      });
      if (res.data.success) {
        setIntakes(res.data.intakes);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load case intakes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, search, page]);

  useEffect(() => {
    fetchIntakes();
  }, [fetchIntakes]);

  const getStatusPill = (status) => {
    switch (status) {
      case 'RECEIVED':
        return (
          <span className="badge bg-indigo-50 text-indigo-700 ring-indigo-600/20 font-semibold">
            Received
          </span>
        );
      case 'VALIDATING':
        return (
          <span className="badge bg-blue-50 text-blue-700 ring-blue-600/20 font-semibold">
            Validating
          </span>
        );
      case 'INCOMPLETE':
        return (
          <span className="badge bg-amber-50 text-amber-700 ring-amber-600/20 font-semibold">
            Incomplete
          </span>
        );
      case 'CONVERTED':
        return (
          <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-600/20 font-semibold">
            Converted to Case
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge bg-red-50 text-red-700 ring-red-600/20 font-semibold">
            Rejected
          </span>
        );
      default:
        return <span className="badge bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <FileText className="h-6 w-6 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Case Intake Registry</h1>
          </div>
          <p className="text-sm text-slate-500">
            Adverse event intake, ICH E2D 4-criteria validation, and case conversion
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          New Case Intake
        </button>
      </div>

      {/* ── Status Filter Chips & Search Bar ─────────────────── */}
      <div className="card p-4 space-y-3">
        {/* Status Chips */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setStatusFilter(f.id);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === f.id
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search & Source Filter */}
        <div className="grid gap-3 sm:grid-cols-12 items-center">
          <div className="relative sm:col-span-8">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search by intake #, suspected product, reaction, or patient initials…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-field pl-10"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">All Source Channels</option>
              <option value="physician">Healthcare Professional / Physician</option>
              <option value="patient">Patient / Consumer Direct</option>
              <option value="literature">Literature Study</option>
              <option value="regulator">Regulatory Agency</option>
              <option value="other">Other Sources</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Intakes Data Table ────────────────────────────────── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <p className="text-sm font-medium text-slate-500">Loading intake records…</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">Error loading intakes</h3>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <button
              type="button"
              onClick={fetchIntakes}
              className="btn-secondary mt-4 inline-flex"
            >
              Retry
            </button>
          </div>
        ) : intakes.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-800">No intake reports found</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your filter chips or click "New Case Intake" to create one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-surface-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3.5">Intake #</th>
                  <th scope="col" className="px-4 py-3.5">Receipt Date</th>
                  <th scope="col" className="px-4 py-3.5">Suspected Product</th>
                  <th scope="col" className="px-4 py-3.5">Reported Reaction</th>
                  <th scope="col" className="px-4 py-3.5">Patient Ref</th>
                  <th scope="col" className="px-4 py-3.5">Criteria</th>
                  <th scope="col" className="px-4 py-3.5">Status</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {intakes.map((intake) => {
                  const hasAllCriteria = intake.validation?.hasMinimumCriteria;

                  return (
                    <tr
                      key={intake._id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        <Link
                          to={`/intakes/${intake._id}`}
                          className="hover:text-brand-600 transition-colors flex items-center gap-1"
                        >
                          {intake.intakeNumber}
                          <ExternalLink className="h-3 w-3 opacity-40" />
                        </Link>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {new Date(intake.receiptDate).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-4 py-3.5 font-medium text-indigo-700">
                        {intake.suspectedProduct}
                      </td>

                      <td className="px-4 py-3.5 max-w-xs truncate" title={intake.reportedReaction}>
                        {intake.reportedReaction}
                      </td>

                      <td className="px-4 py-3.5 text-xs font-mono text-slate-600">
                        {intake.patient?.reference || (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {hasAllCriteria ? (
                          <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-600/20 font-bold flex items-center gap-1 w-fit">
                            <ShieldCheck className="h-3 w-3" />
                            Valid (4/4)
                          </span>
                        ) : (
                          <span
                            className="badge bg-amber-50 text-amber-700 ring-amber-600/20 font-semibold flex items-center gap-1 w-fit"
                            title={`Missing: ${intake.validation?.missingFields?.join(', ')}`}
                          >
                            <ShieldAlert className="h-3 w-3" />
                            Missing Fields
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {getStatusPill(intake.status)}
                      </td>

                      <td className="px-4 py-3.5 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => setPreviewIntake(intake)}
                          className="inline-flex items-center gap-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          title="Quick Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <Link
                          to={`/intakes/${intake._id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
                        >
                          Open View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-surface-border px-4 sm:px-6 py-3.5 text-xs text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary text-xs px-2.5 py-1"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn-secondary text-xs px-2.5 py-1"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Wizard Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showWizard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden my-6"
            >
              <div className="flex items-center justify-between border-b border-surface-border px-6 py-4 bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">New Adverse Event Intake Wizard</h3>
                    <p className="text-xs text-slate-400">Step-by-step case registration & compliance checklist</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWizard(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <IntakeWizard
                  onSuccess={(created) => {
                    setShowWizard(false);
                    fetchIntakes();
                    navigate(`/intakes/${created._id}`);
                  }}
                  onCancel={() => setShowWizard(false)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Quick Preview Drawer ─────────────────────────────── */}
      <AnimatePresence>
        {previewIntake && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-surface-border px-6 py-4 bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-base">
                      {previewIntake.intakeNumber}
                    </span>
                    {getStatusPill(previewIntake.status)}
                  </div>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    Source: <span className="capitalize font-medium text-slate-700">{previewIntake.source}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewIntake(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                {/* 4 Criteria Card */}
                <div
                  className={`rounded-xl border p-3.5 ${
                    previewIntake.validation?.hasMinimumCriteria
                      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
                      : 'border-amber-200 bg-amber-50/50 text-amber-950'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {previewIntake.validation?.hasMinimumCriteria ? (
                      <>
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Valid ICSR Safety Report
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-4 w-4 text-amber-600" />
                        Missing Required Criteria
                      </>
                    )}
                  </div>
                  {previewIntake.validation?.missingFields?.length > 0 && (
                    <p className="text-[11px] text-amber-800 mt-1">
                      Missing: {previewIntake.validation.missingFields.join(', ')}
                    </p>
                  )}
                </div>

                {/* Drug & Reaction */}
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                    Suspected Medication & Reaction
                  </h4>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Product:</span>
                      <span className="font-bold text-indigo-700 text-sm">
                        {previewIntake.suspectedProduct}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Reported Event (Verbatim):</span>
                      <span className="font-semibold text-red-700">
                        {previewIntake.reportedReaction}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Patient & Reporter */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient</span>
                    <span className="font-semibold text-slate-900 block mt-1">
                      {previewIntake.patient?.reference || 'Unspecified'}
                    </span>
                    <span className="text-slate-500 block text-[11px]">
                      {previewIntake.patient?.sex} • {previewIntake.patient?.age ? `${previewIntake.patient.age} yrs` : 'Age unknown'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Reporter</span>
                    <span className="font-semibold text-slate-900 block mt-1">
                      {previewIntake.reporter?.name || 'Anonymous'}
                    </span>
                    <span className="text-slate-500 block text-[11px]">
                      {previewIntake.reporter?.qualification} ({previewIntake.reporter?.country})
                    </span>
                  </div>
                </div>

                {/* Narrative */}
                {previewIntake.narrative && (
                  <div>
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1.5">
                      Clinical Narrative
                    </h4>
                    <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-slate-600 leading-relaxed text-[11px]">
                      {previewIntake.narrative}
                    </p>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-surface-border p-4 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPreviewIntake(null)}
                  className="btn-secondary text-xs"
                >
                  Close
                </button>

                <Link
                  to={`/intakes/${previewIntake._id}`}
                  className="btn-primary text-xs"
                >
                  Full Detail View & Convert
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
