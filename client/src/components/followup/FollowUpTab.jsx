import React, { useState, useEffect, useCallback } from 'react';
import {
  PhoneCall,
  MessageSquare,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  History,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  Layers,
  ArrowRight,
  GitCommit,
  User,
  Mail,
  Phone,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Eye,
  Check,
} from 'lucide-react';
import api from '../../services/api';

export default function FollowUpTab({ caseId, caseNumber, caseData, onCaseUpdated }) {
  const [followUps, setFollowUps] = useState([]);
  const [amendments, setAmendments] = useState([]);
  const [stats, setStats] = useState({ total: 0, openCount: 0, receivedCount: 0, overdueCount: 0, totalAttempts: 0 });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('threads'); // 'threads' | 'amendments'
  const [expandedThreads, setExpandedThreads] = useState({});

  // Modals state
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAttemptModal, setShowAttemptModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState(null);
  const [viewingSnapshot, setViewingSnapshot] = useState(null);

  // New follow-up form state
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientRole, setNewRecipientRole] = useState('Reporter');
  const [newRecipientContact, setNewRecipientContact] = useState('');
  const [newRecipientMethod, setNewRecipientMethod] = useState('EMAIL');
  const [newQuestion, setNewQuestion] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [submittingNew, setSubmittingNew] = useState(false);

  // Attempt form state
  const [attemptChannel, setAttemptChannel] = useState('PHONE');
  const [attemptNotes, setAttemptNotes] = useState('');
  const [attemptContent, setAttemptContent] = useState('');
  const [submittingAttempt, setSubmittingAttempt] = useState(false);

  // Response form state
  const [rawResponse, setRawResponse] = useState('');
  const [summaryOfChanges, setSummaryOfChanges] = useState('');
  const [updateNarrative, setUpdateNarrative] = useState('');
  const [updatePatientWeight, setUpdatePatientWeight] = useState('');
  const [updatePatientHistory, setUpdatePatientHistory] = useState('');
  const [updateReactionOutcome, setUpdateReactionOutcome] = useState('');
  const [updateReactionCausality, setUpdateReactionCausality] = useState('');
  const [reopenReview, setReopenReview] = useState(true);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const [fuRes, amendRes] = await Promise.all([
        api.get(`/cases/${caseId}/follow-ups`),
        api.get(`/cases/${caseId}/follow-ups/amendments`),
      ]);

      if (fuRes.data.success) {
        setFollowUps(fuRes.data.followUps || []);
        if (fuRes.data.stats) setStats(fuRes.data.stats);

        // Auto-expand all threads by default
        const initialExpanded = {};
        (fuRes.data.followUps || []).forEach((f) => {
          initialExpanded[f._id] = true;
        });
        setExpandedThreads(initialExpanded);
      }

      if (amendRes.data.success) {
        setAmendments(amendRes.data.amendments || []);
      }
    } catch (err) {
      console.error('Error fetching follow-ups:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pre-fill new follow up modal defaults
  const handleOpenNewModal = () => {
    setNewRecipientName(caseData?.reporter?.name || '');
    setNewRecipientRole(caseData?.reporter?.qualification || 'Reporter');
    setNewRecipientContact(caseData?.reporter?.contact || '');
    setNewRecipientMethod('EMAIL');
    setNewQuestion('');
    // Default due date: +7 days from today
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setNewDueDate(d.toISOString().slice(0, 10));
    setNewNotes('');
    setShowNewModal(true);
  };

  const handleCreateFollowUp = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newDueDate) return;

    setSubmittingNew(true);
    try {
      const res = await api.post(`/cases/${caseId}/follow-ups`, {
        recipient: {
          name: newRecipientName,
          role: newRecipientRole,
          contact: newRecipientContact,
          method: newRecipientMethod,
        },
        question: newQuestion.trim(),
        dueDate: newDueDate,
        notes: newNotes.trim(),
      });

      if (res.data.success) {
        showToast('Follow-up inquiry dispatched successfully');
        setShowNewModal(false);
        fetchData();
        if (onCaseUpdated) onCaseUpdated();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create follow-up');
    } finally {
      setSubmittingNew(false);
    }
  };

  // Open Log Attempt Modal
  const handleOpenAttemptModal = (fu) => {
    setSelectedFollowUp(fu);
    setAttemptChannel(fu.recipient?.method || 'PHONE');
    setAttemptNotes('');
    setAttemptContent('');
    setShowAttemptModal(true);
  };

  const handleSubmitAttempt = async (e) => {
    e.preventDefault();
    if (!selectedFollowUp) return;

    setSubmittingAttempt(true);
    try {
      const res = await api.post(
        `/cases/${caseId}/follow-ups/${selectedFollowUp._id}/correspondence`,
        {
          channel: attemptChannel,
          notes: attemptNotes.trim(),
          content: attemptContent.trim() || selectedFollowUp.question,
        }
      );

      if (res.data.success) {
        showToast('Contact attempt logged successfully');
        setShowAttemptModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to log attempt');
    } finally {
      setSubmittingAttempt(false);
    }
  };

  // Open Log Response Modal
  const handleOpenResponseModal = (fu) => {
    setSelectedFollowUp(fu);
    setRawResponse('');
    setSummaryOfChanges('');
    setUpdateNarrative('');
    setUpdatePatientWeight(caseData?.patient?.weight || '');
    setUpdatePatientHistory(caseData?.patient?.history || '');
    const firstRxn = caseData?.reactions?.[0];
    setUpdateReactionOutcome(firstRxn?.outcome || '');
    setUpdateReactionCausality(firstRxn?.causality || '');
    setReopenReview(true);
    setShowResponseModal(true);
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!selectedFollowUp || !rawResponse.trim()) return;

    setSubmittingResponse(true);
    try {
      const updatedFields = {};

      if (updateNarrative.trim()) {
        updatedFields.narrative = updateNarrative.trim();
      }

      const patientUpdates = {};
      if (updatePatientWeight !== '' && Number(updatePatientWeight) !== caseData?.patient?.weight) {
        patientUpdates.weight = Number(updatePatientWeight);
      }
      if (updatePatientHistory.trim() && updatePatientHistory.trim() !== caseData?.patient?.history) {
        patientUpdates.history = updatePatientHistory.trim();
      }
      if (Object.keys(patientUpdates).length > 0) {
        updatedFields.patient = patientUpdates;
      }

      if (updateReactionOutcome || updateReactionCausality) {
        const reactionsList = JSON.parse(JSON.stringify(caseData?.reactions || []));
        if (reactionsList[0]) {
          if (updateReactionOutcome) reactionsList[0].outcome = updateReactionOutcome;
          if (updateReactionCausality) reactionsList[0].causality = updateReactionCausality;
          updatedFields.reactions = reactionsList;
        }
      }

      const res = await api.post(`/follow-ups/${selectedFollowUp._id}/receive`, {
        rawResponse: rawResponse.trim(),
        summaryOfChanges: summaryOfChanges.trim() || 'Follow-up information integrated into safety record.',
        updatedFields,
        reopenReview,
      });

      if (res.data.success) {
        showToast(`Response applied! Case amended to v${res.data.case?.version || 'N'}`);
        setShowResponseModal(false);
        fetchData();
        if (onCaseUpdated) onCaseUpdated();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to process response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const toggleThread = (id) => {
    setExpandedThreads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getChannelIcon = (ch) => {
    switch (ch?.toUpperCase()) {
      case 'PHONE':
        return <Phone className="h-3.5 w-3.5 text-blue-600" />;
      case 'LETTER':
        return <FileText className="h-3.5 w-3.5 text-amber-600" />;
      case 'PORTAL':
        return <FileCode className="h-3.5 w-3.5 text-purple-600" />;
      case 'EMAIL':
      default:
        return <Mail className="h-3.5 w-3.5 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white px-4 py-3 shadow-xl border border-slate-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Top Bar & KPI Summary ───────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-brand-600" />
            <span>Follow-Up & Query Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track inquiries dispatched to reporters, schedule follow-up reminders, record received responses, and audit
            case version amendments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Follow-Up Inquiry</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total Inquiries</span>
          <span className="text-lg font-bold text-slate-900 mt-0.5 block">{stats.total}</span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-xs">
          <span className="text-[11px] font-medium text-amber-700 block">Open & Pending</span>
          <span className="text-lg font-bold text-amber-900 mt-0.5 block">{stats.openCount}</span>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-xs">
          <span className="text-[11px] font-medium text-emerald-700 block">Responses Received</span>
          <span className="text-lg font-bold text-emerald-900 mt-0.5 block">{stats.receivedCount}</span>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 shadow-xs">
          <span className="text-[11px] font-medium text-blue-700 block">Total Contact Attempts</span>
          <span className="text-lg font-bold text-blue-900 mt-0.5 block">{stats.totalAttempts}</span>
        </div>
      </div>

      {/* ── View Switcher: Threads vs Amendments ──────────────── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('threads')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'threads'
                ? 'bg-brand-50 text-brand-700 border border-brand-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Correspondence Threads ({followUps.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('amendments')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'amendments'
                ? 'bg-brand-50 text-brand-700 border border-brand-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Case Version Amendments & Diffs ({amendments.length})</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          Current Case Version: <strong>v{caseData?.version || 1}</strong>
        </span>
      </div>

      {/* ── VIEW 1: Threads & Inquiries ────────────────────────── */}
      {activeView === 'threads' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-500 mb-2" />
              <span className="text-xs">Loading follow-up inquiries…</span>
            </div>
          ) : followUps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-white space-y-2">
              <PhoneCall className="h-8 w-8 text-slate-300 mx-auto" />
              <h3 className="text-xs font-bold text-slate-700">No Follow-Up Inquiries Initiated</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Need more information from the reporter or treating physician? Initiate a follow-up query to track
                correspondence attempts and integrate responses into new case versions.
              </p>
              <button
                type="button"
                onClick={handleOpenNewModal}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Initiate First Inquiry</span>
              </button>
            </div>
          ) : (
            followUps.map((fu) => {
              const isExpanded = !!expandedThreads[fu._id];
              const isReceived = fu.status === 'RECEIVED';
              const isOverdue = fu.status === 'OPEN' && new Date(fu.dueDate) < new Date();

              return (
                <div
                  key={fu._id}
                  className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all"
                >
                  {/* Thread Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/70 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                        {fu.followUpNumber}
                      </span>

                      {/* Status Pill */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isReceived
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isReceived ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : isOverdue ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        <span>{isOverdue ? 'OVERDUE' : fu.status}</span>
                      </span>

                      {/* Attempts Counter */}
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {fu.attemptsCount} Attempt{fu.attemptsCount > 1 ? 's' : ''}
                      </span>

                      {/* Due date countdown */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>Due: {new Date(fu.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isReceived && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenAttemptModal(fu)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                            title="Log another contact attempt or reminder"
                          >
                            <Send className="h-3 w-3 text-slate-500" />
                            <span>Log Reminder / Attempt</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenResponseModal(fu)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition-colors shadow-2xs"
                            title="Record received response and update case"
                          >
                            <Check className="h-3 w-3" />
                            <span>Log Response</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleThread(fu._id)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-200/80 transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Thread Expanded Body */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      {/* Recipient & Inquiry Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/80 p-3 rounded-lg border border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Recipient</span>
                          <span className="font-semibold text-slate-900">{fu.recipient.name}</span>
                          <span className="text-slate-500 block text-[11px]">{fu.recipient.role}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Contact Method</span>
                          <div className="flex items-center gap-1.5 mt-0.5 text-slate-700">
                            {getChannelIcon(fu.recipient.method)}
                            <span className="font-medium">{fu.recipient.method}</span>
                            {fu.recipient.contact && (
                              <span className="text-slate-400 text-[11px]">({fu.recipient.contact})</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Requested By</span>
                          <span className="font-medium text-slate-800">{fu.requestedByName || 'Safety Officer'}</span>
                          <span className="text-slate-400 block text-[11px]">
                            {new Date(fu.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Question / Inquiry Content */}
                      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
                        <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
                          Inquiry Question Sent to Reporter:
                        </span>
                        <p className="text-xs text-slate-800 leading-relaxed font-sans bg-slate-50 p-2.5 rounded border border-slate-100">
                          {fu.question}
                        </p>
                      </div>

                      {/* Correspondence Timeline (Thread attempts) */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-700 block">
                          Correspondence Attempts ({fu.correspondence?.length || 0})
                        </span>
                        <div className="relative pl-4 space-y-3 border-l-2 border-slate-200 ml-2">
                          {(fu.correspondence || []).map((att, idx) => (
                            <div key={idx} className="relative text-xs space-y-1">
                              {/* Timeline dot */}
                              <div className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-4 ring-white" />

                              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">
                                    Attempt #{att.attemptNumber}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 font-medium">
                                    {getChannelIcon(att.channel)}
                                    <span>{att.channel}</span>
                                  </span>
                                  <span>by {att.sentByName || 'Safety Officer'}</span>
                                </div>
                                <span>{new Date(att.date).toLocaleString()}</span>
                              </div>

                              {att.notes && (
                                <p className="text-slate-700 bg-slate-50/70 p-2 rounded border border-slate-100 text-[11px]">
                                  {att.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Received Information Block (if status is RECEIVED) */}
                      {isReceived && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span>Response Received & Case Version Updated</span>
                            </div>
                            <span className="text-[11px] font-mono text-emerald-800">
                              Received {new Date(fu.receivedAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs">
                            <span className="font-semibold text-emerald-900 block">Response Summary:</span>
                            <p className="text-emerald-950 bg-white/80 p-2 rounded-lg border border-emerald-100 leading-relaxed">
                              {fu.receivedInfo?.summaryOfChanges || fu.receivedInfo?.rawResponse || 'Response recorded.'}
                            </p>
                          </div>

                          {fu.resultingCaseVersion && (
                            <div className="flex items-center justify-between text-[11px] text-emerald-800 pt-1">
                              <span>
                                Resulting Case Version: <strong>v{fu.resultingCaseVersion}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveView('amendments')}
                                className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-900 underline"
                              >
                                <span>View Amendment Diff</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── VIEW 2: Version Amendments & Diffs ─────────────────── */}
      {activeView === 'amendments' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 leading-relaxed shadow-xs">
            <strong className="text-slate-900 block font-semibold mb-1">
              Immutable Case Version History (21 CFR Part 11 Audit Trail):
            </strong>
            When follow-up information is received, a new case version is generated automatically. The original data from
            previous versions is never overwritten and remains permanently accessible below with full field-by-field diffs.
          </div>

          {amendments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-white text-xs text-slate-400">
              No version amendments recorded yet. Original version (v1) remains active.
            </div>
          ) : (
            amendments.map((amend) => (
              <div key={amend._id} className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-600 text-white font-mono font-bold text-xs">
                      <GitCommit className="h-3.5 w-3.5" />
                      <span>v{amend.previousVersion} ➔ v{amend.version}</span>
                    </span>

                    <div>
                      <span className="font-bold text-slate-900 text-xs block">
                        {amend.reason}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Amended by <strong>{amend.appliedByName}</strong> on{' '}
                        {new Date(amend.appliedAt).toLocaleString()}
                        {amend.followUpNumber && ` (${amend.followUpNumber})`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingSnapshot(amend.snapshot)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    <Eye className="h-3 w-3" />
                    <span>View Preserved v{amend.previousVersion} Snapshot</span>
                  </button>
                </div>

                {/* Diff Viewer Table */}
                <div className="p-4 space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">
                    Field-Level Differences ({amend.diff?.length || 0}):
                  </span>

                  {amend.diff?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No structured field discrepancies detected.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="py-2 px-3">Field Name</th>
                            <th className="py-2 px-3">Original Value (v{amend.previousVersion})</th>
                            <th className="py-2 px-3">Amended Value (v{amend.version})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {amend.diff.map((d, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {d.label || d.field}
                              </td>
                              <td className="py-2.5 px-3 text-rose-800 bg-rose-50/40 font-mono text-[11px]">
                                {typeof d.oldValue === 'object'
                                  ? JSON.stringify(d.oldValue)
                                  : String(d.oldValue ?? 'None / Unset')}
                              </td>
                              <td className="py-2.5 px-3 text-emerald-800 bg-emerald-50/40 font-mono text-[11px] font-semibold">
                                {typeof d.newValue === 'object'
                                  ? JSON.stringify(d.newValue)
                                  : String(d.newValue ?? 'None / Unset')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MODAL 1: New Follow-Up Inquiry ─────────────────────── */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Initiate Follow-Up Inquiry</h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFollowUp} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    value={newRecipientName}
                    onChange={(e) => setNewRecipientName(e.target.value)}
                    placeholder="e.g. Dr. John Watson"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Recipient Role</label>
                  <input
                    type="text"
                    value={newRecipientRole}
                    onChange={(e) => setNewRecipientRole(e.target.value)}
                    placeholder="Physician, Patient, Reporter"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Channel</label>
                  <select
                    value={newRecipientMethod}
                    onChange={(e) => setNewRecipientMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  >
                    <option value="EMAIL">Email</option>
                    <option value="PHONE">Phone Call</option>
                    <option value="LETTER">Written Letter</option>
                    <option value="PORTAL">HCP Portal</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Details</label>
                  <input
                    type="text"
                    value={newRecipientContact}
                    onChange={(e) => setNewRecipientContact(e.target.value)}
                    placeholder="Email address or phone number"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Question / Clinical Clarification *
                </label>
                <textarea
                  rows={4}
                  required
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="State clearly what specific information or laboratory records are requested..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Response Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Initial Dispatch Notes</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Optional notes for attempt #1"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-white font-semibold hover:bg-brand-500 shadow-xs flex items-center gap-1.5"
                >
                  {submittingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Dispatch Follow-Up</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Log Attempt / Reminder ────────────────────── */}
      {showAttemptModal && selectedFollowUp && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Log Contact Attempt #{selectedFollowUp.attemptsCount + 1}
              </h3>
              <button
                type="button"
                onClick={() => setShowAttemptModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAttempt} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Contact Channel</label>
                <select
                  value={attemptChannel}
                  onChange={(e) => setAttemptChannel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                >
                  <option value="PHONE">Phone Call</option>
                  <option value="EMAIL">Email Reminder</option>
                  <option value="LETTER">Postal Reminder</option>
                  <option value="PORTAL">HCP Portal Notification</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes / Call Outcome</label>
                <textarea
                  rows={3}
                  required
                  value={attemptNotes}
                  onChange={(e) => setAttemptNotes(e.target.value)}
                  placeholder="Spoke with receptionist; doctor in surgery, requested callback tomorrow..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAttemptModal(false)}
                  className="rounded-xl border border-slate-300 px-3.5 py-1.5 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAttempt}
                  className="rounded-xl bg-brand-600 px-3.5 py-1.5 text-white font-semibold hover:bg-brand-500 shadow-xs flex items-center gap-1.5"
                >
                  {submittingAttempt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Record Attempt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Log Received Response ─────────────────────── */}
      {showResponseModal && selectedFollowUp && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Log Received Response ({selectedFollowUp.followUpNumber})
                </h3>
                <p className="text-xs text-slate-500">
                  Applying this response will increment the case version and log an immutable amendment snapshot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResponseModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitResponse} className="p-6 space-y-4 text-xs max-h-[calc(85vh-160px)] overflow-y-auto">
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <span className="text-amber-900 leading-relaxed">
                  <strong>Version Control Notice:</strong> The original data for version v{caseData?.version || 1} will
                  be preserved in the amendment ledger. Case will advance to <strong>v{(caseData?.version || 1) + 1}</strong>.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Raw Received Response Text *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rawResponse}
                  onChange={(e) => setRawResponse(e.target.value)}
                  placeholder="Paste or transcribe the verbatim response from reporter / lab..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Summary of New Clinical Information
                </label>
                <input
                  type="text"
                  value={summaryOfChanges}
                  onChange={(e) => setSummaryOfChanges(e.target.value)}
                  placeholder="e.g. Confirmed patient recovery; discontinued suspect medication"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                />
              </div>

              {/* Optional Field Updates */}
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-3 bg-slate-50/50">
                <span className="font-bold text-slate-800 block">
                  Selectively Apply Updates to Safety Case:
                </span>

                <div>
                  <label className="text-slate-600 block mb-1">Append to Clinical Narrative:</label>
                  <textarea
                    rows={2}
                    value={updateNarrative}
                    onChange={(e) => setUpdateNarrative(e.target.value)}
                    placeholder="New narrative details to append to existing case story..."
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 block mb-1">Updated Patient Weight (kg):</label>
                    <input
                      type="number"
                      value={updatePatientWeight}
                      onChange={(e) => setUpdatePatientWeight(e.target.value)}
                      placeholder="e.g. 68"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">Updated Reaction Outcome:</label>
                    <select
                      value={updateReactionOutcome}
                      onChange={(e) => setUpdateReactionOutcome(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      <option value="">Keep Existing</option>
                      <option value="recovered">Recovered</option>
                      <option value="recovering">Recovering</option>
                      <option value="not_recovered">Not Recovered</option>
                      <option value="fatal">Fatal</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reopenReview"
                  checked={reopenReview}
                  onChange={(e) => setReopenReview(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="reopenReview" className="font-semibold text-slate-800 cursor-pointer">
                  Automatically reopen Medical Review workflow task for this amended case
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowResponseModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResponse}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-white font-semibold hover:bg-emerald-500 shadow-xs flex items-center gap-1.5"
                >
                  {submittingResponse ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>Commit Response & Advance Version</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: Viewing Preserved Version Snapshot ────────── */}
      {viewingSnapshot && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  Preserved Case Snapshot (v{viewingSnapshot.version || 1})
                </h3>
                <span className="text-xs text-slate-500">
                  Immutable state prior to amendment. Original data preserved per CFR requirements.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingSnapshot(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 max-h-[calc(80vh-140px)] overflow-y-auto text-xs space-y-4 font-mono">
              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto leading-relaxed">
                <pre>{JSON.stringify(viewingSnapshot, null, 2)}</pre>
              </div>
            </div>

            <div className="flex justify-end p-4 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewingSnapshot(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

