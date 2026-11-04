import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Info,
  Layers,
  Filter,
  Plus,
  Loader2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import api from '../services/api';

const JURISDICTION_BADGES = {
  FDA: 'bg-blue-100 text-blue-800 border-blue-300',
  EMA: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  CDSCO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PMDA: 'bg-rose-100 text-rose-800 border-rose-300',
  WHO: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  GLOBAL: 'bg-purple-100 text-purple-800 border-purple-300',
};

export default function ReportingCalendar() {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'overdue' | 'rules'
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ totalActive: 0, overdueCount: 0, submittedCount: 0, reports: [], overdueList: [] });
  const [rules, setRules] = useState([]);
  const [error, setError] = useState(null);
  const [nightlyRunning, setNightlyRunning] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Filter state for reports
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Rule creation modal state
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    ruleCode: 'RR-FDA-15D',
    jurisdiction: 'FDA',
    name: 'FDA 15-Day Expedited Alert Report',
    reportType: '15-Day Expedited ICSR',
    deadlineDays: 15,
    description: '',
  });
  const [savingRule, setSavingRule] = useState(false);

  // Load calendar overview and rules
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [calRes, rulesRes] = await Promise.all([
        api.get('/reports/calendar'),
        api.get('/reports/rules'),
      ]);

      if (calRes.data.success) {
        setData(calRes.data);
      }
      if (rulesRes.data.success) {
        setRules(rulesRes.data.rules || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load regulatory calendar and reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Run Nightly Overdue Job
  const handleRunNightlyJob = async () => {
    setNightlyRunning(true);
    setToastMessage(null);
    try {
      const res = await api.post('/reports/nightly-job');
      if (res.data.success) {
        setToastMessage(res.data.message);
        fetchOverview();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to run nightly compliance job');
    } finally {
      setNightlyRunning(false);
    }
  };

  // Create or Update Rule (demonstrating versioning without altering existing due dates)
  const handleSaveRule = async (e) => {
    e?.preventDefault();
    setSavingRule(true);
    setError(null);
    try {
      const res = await api.post('/reports/rules', ruleForm);
      if (res.data.success) {
        setToastMessage(res.data.message);
        setShowRuleModal(false);
        fetchOverview();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update rule');
    } finally {
      setSavingRule(false);
    }
  };

  // Filter reports
  const filteredReports = data.reports.filter((r) => {
    if (selectedJurisdiction !== 'ALL' && r.jurisdiction !== selectedJurisdiction) return false;
    if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Calendar className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Regulatory Reporting & Submission Calendar
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Statutory submission tracking, health authority gateways, and synthetic rule governance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRunNightlyJob}
            disabled={nightlyRunning}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-sm"
            title="Execute automated nightly overdue compliance check"
          >
            {nightlyRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-brand-600" />
            )}
            <span>Run Nightly Overdue Job</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRuleModal(true)}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Configure Rule</span>
          </button>
        </div>
      </div>

      {/* ── Synthetic Rules Educational Banner ──────────────── */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-3 shadow-2xs">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block">
            Synthetic Regulatory Rules Engine Notice
          </span>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            All regional submission rules (FDA 15-day, EMA 7-day fatal/life-threatening, CDSCO 14-day SAE) are data-driven synthetic models for training and educational simulation.
            Due dates are stamped immutably with rule version tracking. Always validate with regional regulatory authorities prior to production use.
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-emerald-700 font-bold px-1">
            ✕
          </button>
        </div>
      )}

      {/* ── KPI Metrics Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="card p-4 bg-white border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Active Obligations</span>
          <span className="font-mono text-2xl font-bold text-slate-900 block mt-1">
            {data.totalActive}
          </span>
          <span className="text-[11px] text-slate-500">pending transmission</span>
        </div>

        <div className="card p-4 bg-white border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-rose-500 block">Overdue Submissions</span>
          <span className="font-mono text-2xl font-bold text-rose-600 block mt-1">
            {data.overdueCount}
          </span>
          <span className="text-[11px] text-rose-700 font-medium">requires immediate remediation</span>
        </div>

        <div className="card p-4 bg-white border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block">Submitted & Acknowledged</span>
          <span className="font-mono text-2xl font-bold text-emerald-700 block mt-1">
            {data.submittedCount}
          </span>
          <span className="text-[11px] text-emerald-600">health authority ACK recorded</span>
        </div>

        <div className="card p-4 bg-white border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Rule Versions</span>
          <span className="font-mono text-2xl font-bold text-indigo-700 block mt-1">
            {rules.filter((r) => r.active).length}
          </span>
          <span className="text-[11px] text-slate-500">FDA, EMA, CDSCO, WHO</span>
        </div>
      </div>

      {/* ── View Switcher & Toolbar ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'calendar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Calendar & Timeline</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'overdue' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Overdue Reports ({data.overdueCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'rules' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Synthetic Rules Explorer</span>
          </button>
        </div>

        {/* Filter controls */}
        {activeTab === 'calendar' && (
          <div className="flex items-center gap-2">
            <select
              value={selectedJurisdiction}
              onChange={(e) => setSelectedJurisdiction(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Jurisdictions</option>
              <option value="FDA">FDA (US)</option>
              <option value="EMA">EMA (Europe)</option>
              <option value="CDSCO">CDSCO (India)</option>
              <option value="WHO">WHO-UMC</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="VALIDATED">Validated</option>
              <option value="APPROVED">Approved</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
        )}
      </div>

      {/* ── TAB 1: Calendar & Timeline Grid ─────────────────── */}
      {activeTab === 'calendar' && (
        <div className="card overflow-hidden bg-white border border-slate-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Statutory Reporting Deadlines Timeline
            </span>
            <span className="text-[11px] text-slate-500">
              Showing {filteredReports.length} regulatory reports
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading reports…</div>
          ) : filteredReports.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Calendar className="mx-auto h-8 w-8 text-slate-300" />
              <p className="text-xs font-semibold">No reports match your selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3.5">Case #</th>
                    <th className="py-3 px-3.5">Jurisdiction</th>
                    <th className="py-3 px-3.5">Report Type</th>
                    <th className="py-3 px-3.5">Rule Snapshot</th>
                    <th className="py-3 px-3.5">Due Date & Countdown</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.map((r) => {
                    const now = new Date();
                    const due = new Date(r.dueDate);
                    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isOver = diffDays < 0 || r.status === 'OVERDUE';

                    return (
                      <tr key={r._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-bold text-brand-600">
                          <Link to={`/cases/${r.caseNumber}`} className="hover:underline">
                            {r.caseNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-3.5">
                          <span className={`badge text-[10px] font-bold px-2 py-0.5 border ${JURISDICTION_BADGES[r.jurisdiction] || ''}`}>
                            {r.jurisdiction}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-medium text-slate-800">
                          {r.reportType}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-[10px] text-slate-500">
                          {r.ruleCode} v{r.ruleVersion} ({r.deadlineDays}d)
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 block">
                              {due.toLocaleDateString()}
                            </span>
                            <span
                              className={`text-[10px] font-bold ${
                                isOver
                                  ? 'text-rose-600 font-bold'
                                  : diffDays <= 2
                                  ? 'text-amber-600 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              {r.status === 'SUBMITTED' || r.status === 'ACKNOWLEDGED'
                                ? 'Completed'
                                : isOver
                                ? `OVERDUE by ${Math.abs(diffDays)}d`
                                : `${diffDays} days remaining`}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <span
                            className={`badge text-[10px] font-mono font-bold uppercase px-2 py-0.5 ${
                              r.status === 'OVERDUE'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                : r.status === 'ACKNOWLEDGED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : r.status === 'SUBMITTED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : r.status === 'APPROVED'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <Link
                            to={`/cases/${r.caseNumber}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Overdue Submissions List ─────────────────── */}
      {activeTab === 'overdue' && (
        <div className="card overflow-hidden bg-white border border-rose-200 shadow-sm space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-950">
                  Critical Overdue Reporting Obligations ({data.overdueList.length})
                </h3>
                <p className="text-[11px] text-rose-700">
                  Cases exceeding statutory health authority submission windows. Flagged by the automated compliance engine.
                </p>
              </div>
            </div>
          </div>

          {data.overdueList.length === 0 ? (
            <div className="p-8 text-center text-emerald-700 space-y-2">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="text-xs font-bold">Zero Overdue Reporting Obligations!</p>
              <p className="text-[11px] text-slate-500">All regulatory cases are within their statutory submission timelines.</p>
            </div>
          ) : (
            <div className="divide-y divide-rose-100 text-xs">
              {data.overdueList.map((r) => {
                const now = new Date();
                const due = new Date(r.dueDate);
                const daysOver = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));

                return (
                  <div key={r._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link to={`/cases/${r.caseNumber}`} className="font-mono font-bold text-brand-600 hover:underline">
                          {r.caseNumber}
                        </Link>
                        <span className={`badge text-[10px] font-bold px-2 py-0.5 border ${JURISDICTION_BADGES[r.jurisdiction] || ''}`}>
                          {r.jurisdiction}
                        </span>
                        <span className="badge text-[10px] bg-rose-100 text-rose-800 font-bold border border-rose-300">
                          {daysOver} day{daysOver === 1 ? '' : 's'} past deadline
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900 block">{r.reportType}</span>
                      <span className="text-[11px] text-slate-500">
                        Rule: {r.ruleCode} v{r.ruleVersion} • Due Date was {due.toLocaleDateString()}
                      </span>
                    </div>

                    <Link
                      to={`/cases/${r.caseNumber}`}
                      className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <span>Resolve in Case Workspace</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Synthetic Regulatory Rules Explorer ──────── */}
      {activeTab === 'rules' && (
        <div className="card overflow-hidden bg-white border border-slate-200 space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand-600" />
                <span>Synthetic Regulatory Rules & Version Catalog</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Rules are data-driven. Modifying a rule generates an immutable new version without retroactively recalculating existing due dates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRuleModal(true)}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Rule Version</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Rule Code & Version</th>
                  <th className="py-2.5 px-3">Jurisdiction</th>
                  <th className="py-2.5 px-3">Report Name</th>
                  <th className="py-2.5 px-3">Conditions</th>
                  <th className="py-2.5 px-3">Deadline Days</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Effective From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <tr key={rule._id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono font-bold text-brand-600">
                      {rule.ruleCode} v{rule.version}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`badge text-[10px] font-bold px-2 py-0.5 border ${JURISDICTION_BADGES[rule.jurisdiction] || ''}`}>
                        {rule.jurisdiction}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{rule.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      Seriousness: <strong>{rule.conditions?.seriousness || 'ANY'}</strong>
                      {rule.conditions?.country && rule.conditions.country !== 'ANY' && (
                        <span> • Country: {rule.conditions.country}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {rule.deadlineDays} days
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`badge text-[10px] font-bold ${
                          rule.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {rule.active ? 'Active' : 'Archived v' + rule.version}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {new Date(rule.effectiveFrom).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Configure Rule Modal ────────────────────────────── */}
      {showRuleModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configure Synthetic Reporting Rule</h3>
                <p className="text-xs text-slate-500">
                  Modifying an existing rule code creates a new version while preserving historical case due dates.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rule Code *</label>
                  <input
                    type="text"
                    value={ruleForm.ruleCode}
                    onChange={(e) => setRuleForm({ ...ruleForm, ruleCode: e.target.value })}
                    placeholder="e.g. RR-FDA-15D"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jurisdiction *</label>
                  <select
                    value={ruleForm.jurisdiction}
                    onChange={(e) => setRuleForm({ ...ruleForm, jurisdiction: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold"
                  >
                    <option value="FDA">FDA (United States)</option>
                    <option value="EMA">EMA (European Union)</option>
                    <option value="CDSCO">CDSCO (India)</option>
                    <option value="PMDA">PMDA (Japan)</option>
                    <option value="WHO">WHO-UMC (Global)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Display Name *</label>
                <input
                  type="text"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g. FDA 15-Day Expedited Alert Report"
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Report Type *</label>
                  <input
                    type="text"
                    value={ruleForm.reportType}
                    onChange={(e) => setRuleForm({ ...ruleForm, reportType: e.target.value })}
                    placeholder="e.g. 15-Day Expedited ICSR"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Deadline Days *</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={ruleForm.deadlineDays}
                    onChange={(e) => setRuleForm({ ...ruleForm, deadlineDays: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Regulatory Context Notes</label>
                <textarea
                  rows={2}
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  placeholder="Reference 21 CFR or ICH GVP guidelines..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
                >
                  {savingRule && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Rule (Increment Version)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

