import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Check,
  CheckCircle2,
  AlertTriangle,
  History,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  RefreshCw,
  Loader2,
  FileText,
  HelpCircle,
  X,
  CornerDownRight,
  ExternalLink,
} from 'lucide-react';
import api from '../../services/api';
import DataOriginBadge from './DataOriginBadge';

/**
 * Medical Coding Panel (Module 6)
 *
 * Implements synthetic MedDRA-like terminology browsing, verbatim preservation,
 * auto-suggest top 5 matches, hierarchy breadcrumb previews (SOC > HLGT > HLT > PT > LLT),
 * 21 CFR Part 11 compliant override history with audit reasons, and uncoded reaction gating.
 */
export default function MedicalCodingPanel({
  caseId,
  isClosed = false,
  onCaseUpdated = () => {},
  onCodingStatusChange = () => {},
}) {
  const [loading, setLoading] = useState(true);
  const [codingData, setCodingData] = useState(null);
  const [selectedReactionId, setSelectedReactionId] = useState(null);
  const [error, setError] = useState(null);

  // Search & Combobox State
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedTermForAction, setSelectedTermForAction] = useState(null);

  // Override / Change Reason Modal State
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingTermToCode, setPendingTermToCode] = useState(null);
  const [changeReason, setChangeReason] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [reasonError, setReasonError] = useState('');

  // Fetch case coding overview
  const fetchCodingData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/cases/${caseId}/coding`);
      if (res.data.success) {
        setCodingData(res.data);
        onCodingStatusChange(res.data);

        // Auto-select first reaction if none selected
        if (!selectedReactionId && res.data.items?.length > 0) {
          setSelectedReactionId(String(res.data.items[0].reactionId));
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load case medical coding records');
    } finally {
      setLoading(false);
    }
  }, [caseId, selectedReactionId, onCodingStatusChange]);

  useEffect(() => {
    fetchCodingData();
  }, [fetchCodingData]);

  // Debounced search for terms
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = { q: searchTerm.trim(), limit: 25 };
        if (levelFilter !== 'ALL') {
          params.level = levelFilter;
        }
        const res = await api.get('/coding/terms', { params });
        if (res.data.success) {
          setSearchResults(res.data.terms || []);
        }
      } catch (err) {
        console.error('Term search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, levelFilter]);

  // Currently active reaction item
  const activeItem = useMemo(() => {
    if (!codingData?.items || !selectedReactionId) return null;
    return codingData.items.find((it) => String(it.reactionId) === String(selectedReactionId)) || null;
  }, [codingData, selectedReactionId]);

  // Start coding action (either direct if new, or prompt reason if override)
  const handleInitiateCode = (term) => {
    if (isClosed) return;
    const isOverride = activeItem?.isCoded && activeItem?.codingRecord?.codedTermId;

    if (isOverride) {
      // Require reason for overriding already-coded term
      setPendingTermToCode(term);
      setChangeReason('');
      setReasonError('');
      setShowReasonModal(true);
    } else {
      // Direct initial coding
      executeCoding(term, 'Initial medical coding assignment');
    }
  };

  // Submit coding record to backend
  const executeCoding = async (term, reason) => {
    if (!activeItem || !term) return;
    setSubmittingCode(true);
    setReasonError('');
    try {
      const payload = {
        caseId,
        reactionId: activeItem.reactionId,
        codedTermId: term._id,
        dictionaryVersion: term.dictionaryVersion || 'SYN-MedDRA-27.0',
        reason: reason || 'Initial coding',
      };

      const res = await api.post('/coding/records', payload);
      if (res.data.success) {
        setShowReasonModal(false);
        setPendingTermToCode(null);
        setSelectedTermForAction(null);
        setSearchTerm('');
        await fetchCodingData();
        onCaseUpdated();
      }
    } catch (err) {
      setReasonError(err.response?.data?.error || 'Failed to record medical coding.');
    } finally {
      setSubmittingCode(false);
    }
  };

  // Confirm override in modal
  const handleConfirmOverride = () => {
    if (!changeReason || !changeReason.trim()) {
      setReasonError('A clear justification reason is strictly required under 21 CFR Part 11.');
      return;
    }
    executeCoding(pendingTermToCode, changeReason.trim());
  };

  if (loading && !codingData) {
    return (
      <div className="card p-12 bg-white flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        <span className="text-xs text-slate-500 font-medium">Loading medical terminology & case coding...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 bg-rose-50 border border-rose-200 text-rose-800 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <span>Error Loading Medical Coding Data</span>
        </div>
        <p className="text-xs">{error}</p>
        <button
          onClick={fetchCodingData}
          className="btn btn-secondary text-xs mt-2"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
        </button>
      </div>
    );
  }

  const items = codingData?.items || [];
  const uncodedCount = codingData?.uncodedCount || 0;
  const isAllCoded = codingData?.isAllCoded ?? false;

  return (
    <div className="space-y-6">
      {/* ── Top Summary & Dictionary Metadata Header ──────────────── */}
      <div className="card p-5 bg-white border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">MedDRA Medical Coding Panel</h3>
              <DataOriginBadge origin="entered" />
            </div>
            <p className="text-xs text-slate-500">
              ICH E2B(R3) standardized medical dictionary coding across hierarchical levels (SOC &gt; HLGT &gt; HLT &gt; PT &gt; LLT).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-slate-100 text-slate-700 text-xs font-mono px-2.5 py-1">
              Dictionary: SYN-MedDRA-27.0
            </span>
            {uncodedCount > 0 ? (
              <span className="badge bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold px-3 py-1 flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                {uncodedCount} Uncoded Reaction{uncodedCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="badge bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                All Reactions Coded
              </span>
            )}
          </div>
        </div>

        {/* Workflow Advance Block Warning Banner */}
        {uncodedCount > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Workflow Progression Gate Enforced:</span>
              <p className="text-amber-800">
                This case cannot advance past Data Entry to Medical Review or Closure while adverse reactions remain uncoded. Every reaction verbatim must be mapped to a valid MedDRA Preferred Term (PT).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Two-Column Coding Layout ──────────────────────────── */}
      {items.length === 0 ? (
        <div className="card p-12 bg-white text-center text-xs text-slate-500 space-y-2">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="font-medium text-slate-700">No adverse reactions recorded for this case.</p>
          <p className="text-slate-400">Add adverse reactions in the Reactions tab before coding.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT PANE: Reactions List & Active Reaction Workspace ─ */}
          <div className="lg:col-span-6 space-y-5">
            {/* Reaction Selector Tabs */}
            <div className="card p-4 bg-white border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Select Reaction to Code ({items.length} total)
              </span>
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const isSelected = String(item.reactionId) === String(selectedReactionId);
                  return (
                    <button
                      key={String(item.reactionId)}
                      type="button"
                      onClick={() => setSelectedReactionId(String(item.reactionId))}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">#{idx + 1}</span>
                          <span className="font-medium text-slate-900 truncate">
                            {item.verbatimText}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          {item.pt ? (
                            <span className="text-emerald-700 font-medium">PT: {item.pt}</span>
                          ) : (
                            <span className="text-rose-600 font-medium italic">Uncoded</span>
                          )}
                          {item.meddraCode && (
                            <span className="font-mono text-slate-400">({item.meddraCode})</span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {item.isCoded ? (
                          <span className="badge bg-emerald-100 text-emerald-800 text-[10px] font-semibold flex items-center gap-1">
                            <Check className="h-3 w-3" /> Coded
                          </span>
                        ) : (
                          <span className="badge bg-rose-100 text-rose-700 text-[10px] font-bold">
                            Uncoded
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Reaction Details & Verbatim Text */}
            {activeItem && (
              <div className="card p-5 bg-white border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-600" />
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Reported Verbatim Text (Preserved)
                    </h4>
                  </div>
                  <span className="badge bg-slate-100 text-slate-600 text-[10px]">Immutable</span>
                </div>

                {/* Verbatim Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                    "{activeItem.verbatimText}"
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <span>Outcome: <strong className="text-slate-700 capitalize">{activeItem.outcome || 'Unknown'}</strong></span>
                    <span>Causality: <strong className="text-slate-700">{activeItem.causality || 'Not Assessed'}</strong></span>
                    {activeItem.startDate && (
                      <span>Onset: <strong className="text-slate-700">{new Date(activeItem.startDate).toLocaleDateString()}</strong></span>
                    )}
                  </div>
                </div>

                {/* Current Coded Term Details */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Current Assigned Medical Code
                  </span>
                  {activeItem.isCoded ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 text-sm">{activeItem.pt || activeItem.codingRecord?.codedTermId?.name}</span>
                        <span className="badge bg-emerald-100 text-emerald-800 font-mono text-[11px] font-bold">
                          {activeItem.meddraCode || activeItem.codingRecord?.codedTermId?.code}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        <strong>System Organ Class (SOC):</strong> {activeItem.soc || 'General'}
                      </p>
                      {activeItem.codingRecord?.codedBy && (
                        <p className="text-slate-400 text-[10px]">
                          Coded by {activeItem.codingRecord.codedBy.name || 'Safety Officer'} on{' '}
                          {new Date(activeItem.codingRecord.codedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50/50 p-4 text-center space-y-1 text-xs">
                      <AlertTriangle className="h-5 w-5 text-rose-500 mx-auto" />
                      <p className="font-bold text-rose-800">No MedDRA Term Assigned</p>
                      <p className="text-rose-600 text-[11px]">
                        Choose from top auto-suggestions below or search the terminology directory on the right.
                      </p>
                    </div>
                  )}
                </div>

                {/* Auto-Suggest Top 5 Matches */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900">Auto-Suggested Top Matches</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Algorithmic string scoring</span>
                  </div>

                  <div className="space-y-2">
                    {activeItem.autoSuggestions?.length > 0 ? (
                      activeItem.autoSuggestions.map((sug) => {
                        const isCurrentCode =
                          activeItem.isCoded &&
                          (activeItem.meddraCode === sug.code || activeItem.pt === sug.name);

                        return (
                          <div
                            key={sug.code}
                            className="rounded-xl border border-slate-200 hover:border-brand-400 bg-white p-3 space-y-1.5 text-xs transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{sug.name}</span>
                                <span className="badge bg-indigo-50 text-indigo-700 text-[10px] font-mono">
                                  {sug.level}: {sug.code}
                                </span>
                              </div>
                              <span
                                className={`badge text-[10px] font-semibold ${
                                  sug.confidence === 'High'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : sug.confidence === 'Medium'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {sug.confidence} Match
                              </span>
                            </div>

                            {/* Hierarchy Breadcrumb Preview */}
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 overflow-x-auto py-0.5">
                              <CornerDownRight className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{sug.breadcrumb}</span>
                            </p>

                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                disabled={isClosed || isCurrentCode || submittingCode}
                                onClick={() => handleInitiateCode(sug)}
                                className={`btn text-xs py-1 px-3 ${
                                  isCurrentCode
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'btn-primary'
                                }`}
                              >
                                {isCurrentCode ? 'Currently Assigned' : activeItem.isCoded ? 'Override with This' : 'Accept Suggestion'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-slate-400 text-xs italic">No direct auto-suggestions found. Use directory search.</p>
                    )}
                  </div>
                </div>

                {/* Coding History Timeline */}
                {activeItem.codingRecord?.history?.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-slate-500" />
                      <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Coding History & Audit Log (21 CFR Part 11)
                      </h5>
                    </div>

                    <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                      {activeItem.codingRecord.history.map((hist, hIdx) => (
                        <div key={hIdx} className="relative flex items-start gap-3 text-xs pl-2">
                          <div className="h-3 w-3 rounded-full bg-slate-400 ring-4 ring-white shrink-0 mt-1" />
                          <div className="card p-3 bg-slate-50 border border-slate-200 w-full space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-800">
                                Previous: {hist.codedTermSnapshot?.name || 'Earlier Term'} ({hist.codedTermSnapshot?.code || 'N/A'})
                              </span>
                              <span className="text-slate-400">
                                {new Date(hist.codedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                              <strong>Rationale:</strong> "{hist.reason}"
                            </p>
                            <p className="text-slate-400 text-[10px]">
                              Coded by {hist.codedByName || 'Reviewer'} • {hist.dictionaryVersion}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT PANE: Searchable Combobox & Terminology Browser ─ */}
          <div className="lg:col-span-6 space-y-5">
            <div className="card p-5 bg-white border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-brand-600" />
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Medical Terminology Directory (MedDRA / WHO-Drug)
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">~340 Synthetic Terms</span>
              </div>

              {/* Search Bar & Level Filter Tabs */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by code, term, or condition (e.g. Nausea, Rash, Headache, Heart)..."
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-8 py-2 text-xs bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none font-medium text-slate-800"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-400 text-[11px] font-medium mr-1">Hierarchy Level:</span>
                  {['ALL', 'PT', 'LLT', 'SOC', 'DRUG'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevelFilter(lvl)}
                      className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-colors ${
                        levelFilter === lvl
                          ? 'bg-brand-600 text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {lvl === 'ALL' ? 'All Levels' : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Combobox Search Results List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Results {searchResults.length > 0 ? `(${searchResults.length})` : ''}</span>
                  {searching && (
                    <span className="flex items-center gap-1 text-brand-600">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                    </span>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                  {searchResults.length > 0 ? (
                    searchResults.map((term) => {
                      const isSelected = selectedTermForAction?.code === term.code;
                      return (
                        <div
                          key={term.code}
                          onClick={() => setSelectedTermForAction(term)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all space-y-1.5 text-xs ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50/50 shadow-xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{term.name}</span>
                              <span className="badge bg-slate-100 text-slate-700 font-mono text-[10px]">
                                {term.level}: {term.code}
                              </span>
                            </div>
                            <span className="badge bg-brand-50 text-brand-700 text-[10px] font-mono">
                              {term.level}
                            </span>
                          </div>

                          {/* Hierarchy Breadcrumb Preview */}
                          <div className="text-[11px] text-slate-500 bg-slate-50/80 rounded-lg p-1.5 border border-slate-100 font-mono flex items-center gap-1 overflow-x-auto">
                            <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{term.breadcrumb}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : searchTerm.trim().length >= 2 && !searching ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No medical terminology found matching "{searchTerm}".
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Type 2 or more characters above to search across the synthetic MedDRA hierarchy.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Preview Card for Selected Search Term */}
              {selectedTermForAction && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-800">
                      Selected Candidate for Assignment
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTermForAction(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 text-sm">{selectedTermForAction.name}</p>
                    <p className="text-[11px] text-slate-600 font-mono">
                      Hierarchy: {selectedTermForAction.breadcrumb}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isClosed || submittingCode || !activeItem}
                      onClick={() => handleInitiateCode(selectedTermForAction)}
                      className="btn btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
                    >
                      {activeItem?.isCoded ? 'Override Current Code' : 'Assign to Active Reaction'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 21 CFR Part 11 Override Change Reason Modal ─────────────── */}
      {showReasonModal && pendingTermToCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="card max-w-lg w-full p-6 bg-white space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Clinical Code Override Justification (21 CFR Part 11)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                You are modifying an existing coded adverse reaction. Under pharmacovigilance regulations, changes to medical terminology classifications require an audit-trail recorded justification.
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Current Assigned PT:</span>
                  <strong className="text-slate-800">{activeItem?.pt || 'Current Term'}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">New Term to Assign:</span>
                  <strong className="text-indigo-700">{pendingTermToCode.name} ({pendingTermToCode.code})</strong>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Justification / Rationale for Override <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g. Medical reviewer reclassification following physician consultation; updated verbatim context..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-brand-500 focus:outline-none"
                />
                {reasonError && (
                  <p className="text-rose-600 font-semibold text-[11px] mt-1">{reasonError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={submittingCode}
                onClick={() => setShowReasonModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingCode || !changeReason.trim()}
                onClick={handleConfirmOverride}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                {submittingCode && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm & Record Audit Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

