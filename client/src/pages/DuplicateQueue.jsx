import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Copy,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Calendar,
  User,
  Pill,
  RefreshCw,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { fetchDuplicateQueue, triggerDuplicateCheck } from '../services/duplicateService';
import ScoreRing from '../components/duplicate/ScoreRing';

export default function DuplicateQueue() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, notDuplicate: 0 });
  const [decisionFilter, setDecisionFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState(null);
  const [manualCaseInput, setManualCaseInput] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);

  // Fetch queue data
  const loadQueue = async () => {
    try {
      setLoading(true);
      const res = await fetchDuplicateQueue({
        decision: decisionFilter,
        sortBy: 'score',
        order: sortOrder,
      });
      if (res.success) {
        setData(res.data || []);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load duplicate queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [decisionFilter, sortOrder]);

  // Handle on-demand duplicate check for a case
  const handleRunScan = async (e) => {
    e.preventDefault();
    if (!manualCaseInput.trim()) return;

    try {
      setIsScanning(true);
      const res = await triggerDuplicateCheck({ caseNumber: manualCaseInput.trim().toUpperCase() });
      if (res.success) {
        setScanNotice({
          type: 'success',
          text: `Screening completed for ${manualCaseInput.trim().toUpperCase()}: ${res.count} candidate pair(s) found.`,
        });
        setShowScanModal(false);
        setManualCaseInput('');
        await loadQueue();
      }
    } catch (err) {
      setScanNotice({
        type: 'error',
        text: err.response?.data?.error || 'Failed to complete duplicate screening for case.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Filter items by client search text
  const filteredData = data.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const sNum = item.sourceCaseNumber?.toLowerCase() || '';
    const cNum = item.candidateCaseNumber?.toLowerCase() || '';
    const sProd = item.sourceId?.product?.toLowerCase() || '';
    const cProd = item.candidateCaseId?.product?.toLowerCase() || '';
    const sEvent = item.sourceId?.eventSummary?.toLowerCase() || '';
    const cEvent = item.candidateCaseId?.eventSummary?.toLowerCase() || '';

    return (
      sNum.includes(query) ||
      cNum.includes(query) ||
      sProd.includes(query) ||
      cProd.includes(query) ||
      sEvent.includes(query) ||
      cEvent.includes(query)
    );
  });

  const getDecisionBadge = (decision) => {
    switch (decision) {
      case 'CONFIRMED_DUPLICATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirmed Duplicate
          </span>
        );
      case 'NOT_DUPLICATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <XCircle className="w-3.5 h-3.5" />
            Not a Duplicate
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm ring-4 ring-brand-50">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Duplicate Detection Queue
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Module 5: Pharmacovigilance Candidate Ranking & Side-by-Side Review
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <Sparkles className="h-4 w-4" />
            Screen Case for Duplicates
          </button>

          <button
            type="button"
            onClick={loadQueue}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            title="Refresh Queue"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Notice Banner if screening performed ───────────────── */}
      {scanNotice && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs font-medium border ${
            scanNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span>{scanNotice.text}</span>
          <button
            type="button"
            onClick={() => setScanNotice(null)}
            className="text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── KPI Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Flagged Pairs</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats.total}</div>
          <span className="text-[11px] text-slate-400 font-medium">Screened by algorithm</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Review</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{stats.pending}</div>
          <span className="text-[11px] text-amber-600 font-medium">Awaiting human assessment</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Confirmed Duplicates</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{stats.confirmed}</div>
          <span className="text-[11px] text-emerald-600 font-medium">Reciprocally linked</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Dismissed (Distinct)</span>
            <div className="h-7 w-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-700 mt-2">{stats.notDuplicate}</div>
          <span className="text-[11px] text-slate-500 font-medium">Verified separate reports</span>
        </div>
      </div>

      {/* ── Strict Compliance Notice ───────────────────────────── */}
      <div className="flex items-start gap-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 p-3.5 text-xs text-indigo-900 shadow-2xs">
        <ShieldAlert className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold">Human-in-the-Loop Regulatory Standard:</span>
          <p className="text-indigo-800 leading-relaxed">
            In accordance with ICH E2B(R3) and GVP guidelines, automatic case deletion or silent merges are strictly prohibited. Every candidate match requires a formal assessment by a safety specialist with documented clinical rationale.
          </p>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Decision Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-semibold">
            {[
              { id: 'ALL', label: 'All Pairs' },
              { id: 'PENDING', label: `Pending (${stats.pending})` },
              { id: 'CONFIRMED_DUPLICATE', label: `Confirmed (${stats.confirmed})` },
              { id: 'NOT_DUPLICATE', label: `Not Duplicate (${stats.notDuplicate})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDecisionFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  decisionFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort order toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Sort Score:</span>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortOrder === 'desc' ? 'Highest Match First' : 'Lowest Match First'}
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Case Number, Suspected Product name, or Adverse Event..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-brand-500"
          />
        </div>
      </div>

      {/* ── Candidate Queue List ───────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
          <RefreshCw className="h-8 w-8 text-brand-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading Duplicate Candidates…</p>
          <p className="text-xs text-slate-400">Evaluating deterministic rules and fuzzy Levenshtein matches</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs space-y-3">
          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No duplicate candidate pairs found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? 'No candidate matches match your search terms. Try refining your filters.'
              : 'The duplicate screening queue is clean. You can trigger on-demand screening for any case using the button above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredData.map((review) => {
            const source = review.sourceId || {};
            const cand = review.candidateCaseId || {};

            return (
              <motion.div
                key={review._id}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 p-5 shadow-xs transition-all hover:shadow-md"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Left: Score Ring & Classification */}
                  <div className="flex items-center gap-4 shrink-0">
                    <ScoreRing score={review.score} size={84} strokeWidth={7} />
                    <div className="flex flex-col gap-1">
                      {getDecisionBadge(review.decision)}
                      <span className="text-[11px] text-slate-500 font-medium">
                        Similarity Score: <span className="font-bold text-slate-800">{review.score}/100</span>
                      </span>
                      {review.decidedBy && (
                        <span className="text-[10px] text-slate-400">
                          Decided by: {review.decidedBy.name || review.decidedBy.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Case Pair Comparison snippet */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3.5 border-y md:border-y-0 md:border-x border-slate-100 py-3 md:py-0 md:px-5">
                    {/* Source Case */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Source Case
                        </span>
                        <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                          {review.sourceCaseNumber || source.caseNumber || 'CASE-????'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                        <Pill className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{source.product || 'Unknown Product'}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-1 italic">
                        "{source.eventSummary || 'No reaction summary'}"
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span>Pt: {source.patient?.age ? `${source.patient.age}y` : 'Age ?'}, {source.patient?.sex || source.patientGender || 'Sex ?'}</span>
                        <span>•</span>
                        <span>{source.receiptDate ? new Date(source.receiptDate).toLocaleDateString() : 'Date ?'}</span>
                      </div>
                    </div>

                    {/* Candidate Case */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Candidate Match
                        </span>
                        <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                          {review.candidateCaseNumber || cand.caseNumber || 'CASE-????'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                        <Pill className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{cand.product || 'Unknown Product'}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-1 italic">
                        "{cand.eventSummary || 'No reaction summary'}"
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span>Pt: {cand.patient?.age ? `${cand.patient.age}y` : 'Age ?'}, {cand.patient?.sex || cand.patientGender || 'Sex ?'}</span>
                        <span>•</span>
                        <span>{cand.receiptDate ? new Date(cand.receiptDate).toLocaleDateString() : 'Date ?'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Matched Fields Tags & Action Button */}
                  <div className="flex flex-col items-start lg:items-end justify-between gap-3 shrink-0 lg:w-56">
                    <div className="flex flex-wrap gap-1 lg:justify-end">
                      {review.matchedFields && review.matchedFields.length > 0 ? (
                        review.matchedFields.slice(0, 3).map((f) => (
                          <span
                            key={f}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                          >
                            ✓ {f}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400">No exact matches</span>
                      )}
                      {review.matchedFields?.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          +{review.matchedFields.length - 3} more
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/duplicates/${review._id}`}
                      className="inline-flex items-center justify-center gap-1.5 w-full lg:w-auto rounded-xl bg-slate-900 hover:bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors"
                    >
                      <span>Compare Side-by-Side</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Screen Case Modal ──────────────────────────────────── */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Run Duplicate Screening</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScanModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRunScan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Case Number:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CASE-1001 or CASE-1013"
                  value={manualCaseInput}
                  onChange={(e) => setManualCaseInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-200 focus:outline-brand-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Scans all active safety cases using deterministic rules and Levenshtein fuzzy matching.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScanModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isScanning || !manualCaseInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50"
                >
                  {isScanning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isScanning ? 'Evaluating Matches…' : 'Screen Matches'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
