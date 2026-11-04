import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Info,
  Layers,
  ArrowRight,
  GitBranch,
  Filter,
  Check,
  X,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  FileText,
  AlertOctagon,
  Calendar,
  Sparkles,
} from 'lucide-react';
import api from '../services/api';

const JURISDICTION_BADGES = {
  FDA: 'bg-blue-100 text-blue-800 border-blue-300',
  EMA: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  CDSCO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PMDA: 'bg-rose-100 text-rose-800 border-rose-300',
  MHRA: 'bg-amber-100 text-amber-800 border-amber-300',
  WHO: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  GLOBAL: 'bg-purple-100 text-purple-800 border-purple-300',
};

const RISK_BADGES = {
  HEALTHY: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dot: 'bg-emerald-500',
    label: 'HEALTHY (≥95%)',
    description: 'Compliant with statutory timelines',
  },
  WARNING: {
    bg: 'bg-amber-50 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
    label: 'WARNING (85-94%)',
    description: 'Statutory threshold risk',
  },
  CRITICAL: {
    bg: 'bg-rose-50 text-rose-800 border-rose-300',
    dot: 'bg-rose-500',
    label: 'CRITICAL (<85%)',
    description: 'Immediate remediation required',
  },
};

export default function ComplianceDashboard() {
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'overdue' | 'governance' | 'decisions'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [overdueList, setOverdueList] = useState([]);
  const [rules, setRules] = useState([]);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Rule Version Diff Drawer state
  const [selectedRuleHistory, setSelectedRuleHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  // Propose New Rule Version Modal state
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [submittingRule, setSubmittingRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    ruleCode: 'RR-FDA-15D',
    jurisdiction: 'FDA',
    name: 'FDA 15-Day Expedited Alert Report',
    reportType: '15-Day Expedited ICSR',
    deadlineDays: 15,
    description: '',
    reason: '',
    requireApproval: false,
  });

  // Approving a rule
  const [approvingId, setApprovingId] = useState(null);

  const fetchComplianceData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [sumRes, overRes, rulesRes] = await Promise.all([
        api.get('/compliance/summary'),
        api.get('/compliance/overdue'),
        api.get('/reports/rules'),
      ]);

      if (sumRes.data.success) {
        setSummary(sumRes.data.data);
      }
      if (overRes.data.success) {
        setOverdueList(overRes.data.data || []);
      }
      if (rulesRes.data.success) {
        setRules(rulesRes.data.rules || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load regulatory compliance metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  // View Rule History and Diffs
  const handleOpenRuleHistory = async (rule) => {
    setLoadingHistory(true);
    setHistoryDrawerOpen(true);
    try {
      const res = await api.get(`/compliance/rules/${rule._id || rule.ruleCode}/history`);
      if (res.data.success) {
        setSelectedRuleHistory(res.data.data);
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to load rule version history',
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Submit Rule Proposal
  const handleProposeRuleSubmit = async (e) => {
    e.preventDefault();
    setSubmittingRule(true);
    try {
      const res = await api.post('/compliance/rules', ruleForm);
      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: `Reporting rule ${res.data.data.ruleCode} v${res.data.data.version} recorded successfully!`,
        });
        setShowProposeModal(false);
        setRuleForm({
          ruleCode: 'RR-FDA-15D',
          jurisdiction: 'FDA',
          name: '',
          reportType: '',
          deadlineDays: 15,
          description: '',
          reason: '',
          requireApproval: false,
        });
        fetchComplianceData(true);
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to submit rule proposal',
      });
    } finally {
      setSubmittingRule(false);
    }
  };

  // Approve a pending rule version
  const handleApproveRule = async (ruleId) => {
    setApprovingId(ruleId);
    try {
      const res = await api.post(`/compliance/rules/${ruleId}/approve`, {
        reason: 'Approved by regulatory compliance review',
      });
      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: `Rule ${res.data.data.ruleCode} v${res.data.data.version} approved and active!`,
        });
        fetchComplianceData(true);
        if (selectedRuleHistory) {
          handleOpenRuleHistory({ ruleCode: res.data.data.ruleCode });
        }
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to approve rule version',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const overall = summary?.overallMetrics || {
    totalObligations: 0,
    onTimeCount: 0,
    lateCount: 0,
    overdueCount: 0,
    pendingCount: 0,
    onTimeRate: 100,
    riskLevel: 'HEALTHY',
  };

  const riskInfo = RISK_BADGES[overall.riskLevel] || RISK_BADGES.HEALTHY;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          role="alert"
          className={`p-4 rounded-xl shadow-lg border flex items-center justify-between transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center space-x-3">
            {toastMessage.type === 'error' ? (
              <AlertOctagon className="w-5 h-5 text-rose-600 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{toastMessage.text}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-gray-400 hover:text-gray-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-100">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Compliance Tracking & Governance
              </h1>
              <p className="text-sm text-gray-500">
                Health authority statutory performance, on-time submission rate gauge, and rule version lineage.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchComplianceData(true)}
            disabled={refreshing}
            className="inline-flex items-center space-x-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowProposeModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Propose Rule Version</span>
          </button>
        </div>
      </div>

      {/* Persistent Traceability & Synthetic Banner */}
      <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 space-y-1">
          <p className="font-semibold text-indigo-900">
            Immutable Regulatory Version Lineage Policy
          </p>
          <p>
            Each statutory decision references the <strong>exact rule version used</strong> at the time of case intake. Modifying or harmonizing reporting parameters increments the rule version (vN+1) without retroactively altering historical obligations, deadlines, or submitted dossiers.
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center space-x-3">
          <AlertOctagon className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* KPI Section with Gauge Ring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* On-Time Submission Gauge / Rate Ring Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              On-Time Statutory Rate
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${riskInfo.bg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${riskInfo.dot}`} />
              {riskInfo.label}
            </span>
          </div>

          <div className="flex items-center space-x-6 my-2">
            {/* SVG Circular Ring Gauge */}
            <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
              <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#f1f5f9"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={
                    overall.riskLevel === 'HEALTHY'
                      ? '#10b981'
                      : overall.riskLevel === 'WARNING'
                      ? '#f59e0b'
                      : '#ef4444'
                  }
                  strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${
                    2 * Math.PI * 40 * (1 - Math.min(overall.onTimeRate, 100) / 100)
                  }`}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-gray-900 leading-none">
                  {overall.onTimeRate}%
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5">Target: 95%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-semibold text-gray-900">
                {overall.onTimeCount} of {overall.onTimeCount + overall.lateCount + overall.overdueCount} Completed
              </div>
              <p className="text-xs text-gray-500">
                {overall.riskLevel === 'HEALTHY'
                  ? 'All evaluated reports submitted before statutory deadline.'
                  : overall.riskLevel === 'WARNING'
                  ? 'Submission rate nearing critical 85% compliance threshold.'
                  : 'Overdue or late submissions recorded. Audit exposure detected.'}
              </p>
              <div className="flex items-center space-x-2 pt-1 text-xs text-gray-500">
                <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                <span>Target: 95.0% On-Time</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Pending Submissions:</span>
            <span className="font-semibold text-gray-700">{overall.pendingCount} in progress</span>
          </div>
        </div>

        {/* 4 Metric Cards in 2x2 Grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {/* Total Obligations */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Obligations
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-gray-900">
                {overall.totalObligations}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Statutory report requirements generated across cases
              </p>
            </div>
          </div>

          {/* On-Time Submissions */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                On-Time Submissions
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-emerald-600">
                {overall.onTimeCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Dispatched before health authority cutoff
              </p>
            </div>
          </div>

          {/* Overdue Items */}
          <div
            onClick={() => setActiveTab('overdue')}
            className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all ${
              overall.overdueCount > 0
                ? 'bg-rose-50/50 border-rose-300 hover:border-rose-400'
                : 'bg-white border-gray-200/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Overdue Reports
              </span>
              <div
                className={`p-2 rounded-lg ${
                  overall.overdueCount > 0
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div
                className={`text-3xl font-black ${
                  overall.overdueCount > 0 ? 'text-rose-600' : 'text-gray-900'
                }`}
              >
                {overall.overdueCount}
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                <span>Passed health authority deadline</span>
                {overall.overdueCount > 0 && (
                  <span className="text-rose-700 font-semibold underline text-[11px]">
                    Drill down &rarr;
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Upcoming Deadlines
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline space-x-4">
              <div>
                <span className="text-3xl font-black text-amber-600">
                  {summary?.upcomingDeadlines?.within7Days || 0}
                </span>
                <span className="text-xs text-gray-500 ml-1.5">≤ 7 Days</span>
              </div>
              <div className="border-l border-gray-200 pl-4">
                <span className="text-2xl font-bold text-gray-700">
                  {summary?.upcomingDeadlines?.within15Days || 0}
                </span>
                <span className="text-xs text-gray-500 ml-1.5">≤ 15 Days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 flex items-center space-x-6">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'matrix'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Jurisdiction Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('overdue')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'overdue'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Overdue Drill-Down</span>
          {overdueList.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-600 text-white">
              {overdueList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('governance')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'governance'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Rule Governance & Diffs</span>
        </button>

        <button
          onClick={() => setActiveTab('decisions')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'decisions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Decision Traceability Log</span>
        </button>
      </div>

      {/* Tab 1: Jurisdiction Heat Table / Matrix */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-b-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Health Authority Jurisdiction Heat Table
              </h3>
              <p className="text-xs text-gray-500">
                Compliance performance breakdown across major regional health authorities.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>≥95% Healthy</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" />
              <span>85-94% Warning</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 ml-2" />
              <span>&lt;85% Critical</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600 font-semibold text-xs border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Jurisdiction</th>
                  <th className="py-3 px-4 text-center">Total Obligations</th>
                  <th className="py-3 px-4 text-center">On-Time</th>
                  <th className="py-3 px-4 text-center">Late</th>
                  <th className="py-3 px-4 text-center">Overdue</th>
                  <th className="py-3 px-4 text-center">Pending</th>
                  <th className="py-3 px-4">On-Time Compliance</th>
                  <th className="py-3 px-4 text-center">Risk Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(summary?.jurisdictionBreakdown || []).map((j) => {
                  const risk = RISK_BADGES[j.riskLevel] || RISK_BADGES.HEALTHY;
                  return (
                    <tr key={j.jurisdiction} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-900 flex items-center space-x-2">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold border ${
                            JURISDICTION_BADGES[j.jurisdiction] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {j.jurisdiction}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-gray-900">
                        {j.total}
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-emerald-600">
                        {j.onTimeCount}
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-amber-600">
                        {j.lateCount}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-rose-600">
                        {j.overdueCount > 0 ? j.overdueCount : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-500">
                        {j.pendingCount}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all duration-500 ${
                                j.riskLevel === 'HEALTHY'
                                  ? 'bg-emerald-500'
                                  : j.riskLevel === 'WARNING'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(j.onTimeRate, 100)}%` }}
                            />
                          </div>
                          <span className="font-bold text-xs text-gray-800 w-12 text-right">
                            {j.onTimeRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${risk.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${risk.dot}`} />
                          {j.riskLevel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Overdue Drill-Down */}
      {activeTab === 'overdue' && (
        <div className="bg-white rounded-b-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Overdue Reporting Obligations Drill-Down
              </h3>
              <p className="text-xs text-gray-500">
                Statutory submissions exceeding health authority timelines. Immediate escalation recommended.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
              {overdueList.length} Delayed Submissions
            </span>
          </div>

          {overdueList.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-gray-900">
                Zero Overdue Obligations
              </h4>
              <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
                All statutory expedited and periodic safety submissions are currently compliant and on-schedule.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/80 text-gray-600 font-semibold text-xs border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Case Number</th>
                    <th className="py-3 px-4">Jurisdiction</th>
                    <th className="py-3 px-4">Report Type</th>
                    <th className="py-3 px-4">Rule Code & Version</th>
                    <th className="py-3 px-4">Statutory Due Date</th>
                    <th className="py-3 px-4">Delay</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overdueList.map((item) => (
                    <tr key={item._id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        <Link
                          to={`/cases/${item.caseId}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center space-x-1"
                        >
                          <span>{item.caseNumber}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                            JURISDICTION_BADGES[item.jurisdiction] || 'bg-gray-100'
                          }`}
                        >
                          {item.jurisdiction}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-800">
                        {item.reportType}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 font-mono text-xs">
                          <span className="font-semibold text-gray-900">{item.ruleCode}</span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                            v{item.ruleVersion}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-gray-700">
                        {new Date(item.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <Clock className="w-3 h-3 mr-1 text-rose-600" />
                          +{item.daysOverdue} days overdue
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-rose-600 text-white">
                          OVERDUE
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/cases/${item.caseId}`}
                          className="inline-flex items-center space-x-1 px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <span>Review Case</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Rule Governance & Diffs */}
      {activeTab === 'governance' && (
        <div className="bg-white rounded-b-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Statutory Reporting Rules Governance & Lineage
              </h3>
              <p className="text-xs text-gray-500">
                Select any rule to inspect its version timeline, approval status, and field-level parameter diffs.
              </p>
            </div>
            <button
              onClick={() => setShowProposeModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Propose Modification</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600 font-semibold text-xs border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Rule Code</th>
                  <th className="py-3 px-4">Jurisdiction</th>
                  <th className="py-3 px-4">Rule Name</th>
                  <th className="py-3 px-4 text-center">Active Version</th>
                  <th className="py-3 px-4 text-center">Deadline</th>
                  <th className="py-3 px-4">Governance Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((rule) => {
                  const isApproved = rule.approval?.status === 'APPROVED' || !rule.approval;
                  const isPending = rule.approval?.status === 'PENDING_APPROVAL';

                  return (
                    <tr key={rule._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        {rule.ruleCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold border ${
                            JURISDICTION_BADGES[rule.jurisdiction] || 'bg-gray-100'
                          }`}
                        >
                          {rule.jurisdiction}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-800">
                        <div>{rule.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{rule.reportType}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                          v{rule.version}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-900">
                        {rule.deadlineDays} Days
                      </td>
                      <td className="py-3.5 px-4">
                        {isApproved ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Check className="w-3 h-3 mr-1 text-emerald-600" />
                            APPROVED
                          </span>
                        ) : isPending ? (
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 mr-1 text-amber-600" />
                              PENDING APPROVAL
                            </span>
                            <button
                              onClick={() => handleApproveRule(rule._id)}
                              disabled={approvingId === rule._id}
                              className="px-2 py-0.5 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {approvingId === rule._id ? 'Approving...' : 'Approve'}
                            </button>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                            {rule.approval?.status || 'ACTIVE'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenRuleHistory(rule)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          <span>View Diffs</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Recent Decisions & Lineage Log */}
      {activeTab === 'decisions' && (
        <div className="bg-white rounded-b-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Regulatory Decisions & Rule Version Lineage
              </h3>
              <p className="text-xs text-gray-500">
                Audited submissions confirming the specific statutory rule version bound to each expedited decision.
              </p>
            </div>
            <span className="text-xs font-mono text-gray-500">
              Audit Standard: 21 CFR 11 / GVP Module VI
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600 font-semibold text-xs border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Case Number</th>
                  <th className="py-3 px-4">Health Authority</th>
                  <th className="py-3 px-4">Rule Code</th>
                  <th className="py-3 px-4 text-center">Rule Version Used</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4">Statutory Deadline</th>
                  <th className="py-3 px-4 text-center">Compliance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(summary?.recentDecisions || []).length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-sm text-gray-500">
                      No statutory submissions recorded yet. Run a case through regulatory reporting to log decisions.
                    </td>
                  </tr>
                ) : (
                  (summary?.recentDecisions || []).map((dec) => (
                    <tr key={dec.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        <Link
                          to={`/cases/${dec.caseId}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {dec.caseNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                            JURISDICTION_BADGES[dec.jurisdiction] || 'bg-gray-100'
                          }`}
                        >
                          {dec.jurisdiction}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-gray-800">
                        {dec.ruleCode}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          v{dec.ruleVersion}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-gray-700">
                        {dec.submittedAt ? new Date(dec.submittedAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-gray-700">
                        {new Date(dec.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {dec.wasOnTime ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Check className="w-3 h-3 mr-1 text-emerald-600" />
                            ON-TIME
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 mr-1 text-amber-600" />
                            LATE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rule History & Version Diff Drawer */}
      {historyDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Rule Lineage: {selectedRuleHistory?.ruleCode}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Version diff viewer and &quot;who changed what&quot; audit history
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {loadingHistory ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading statutory change history...</p>
                </div>
              ) : selectedRuleHistory ? (
                <>
                  {/* Rule Versions List */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Version Hierarchy & Approvals
                    </h4>
                    <div className="space-y-3">
                      {selectedRuleHistory.versions?.map((ver) => (
                        <div
                          key={ver._id}
                          className={`p-4 rounded-xl border transition-all ${
                            ver.active
                              ? 'bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-300'
                              : 'bg-gray-50/50 border-gray-200 opacity-90'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">
                                Version {ver.version}
                              </span>
                              {ver.active && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  CURRENT ACTIVE
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono text-gray-500">
                              Deadline: {ver.deadlineDays} Days
                            </span>
                          </div>

                          <div className="mt-2 text-sm font-semibold text-gray-900">
                            {ver.name}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{ver.description}</p>

                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                            <span>
                              Effective:{' '}
                              {new Date(ver.effectiveFrom).toLocaleDateString()}
                              {ver.effectiveTo
                                ? ` - ${new Date(ver.effectiveTo).toLocaleDateString()}`
                                : ' (Present)'}
                            </span>
                            <span className="font-semibold text-gray-700">
                              Status: {ver.approval?.status || 'APPROVED'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* "Who Changed What" Timeline & Diffs */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Audit Timeline: Who Changed What
                    </h4>

                    {selectedRuleHistory.changeHistory?.length === 0 ? (
                      <p className="text-xs text-gray-500 italic p-4 bg-gray-50 rounded-xl">
                        No revisions recorded. Initial version created with baseline health authority specifications.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {selectedRuleHistory.changeHistory.map((ch, idx) => (
                          <div
                            key={idx}
                            className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-gray-900">
                                  {ch.changedByName || 'Regulatory Administrator'}
                                </span>
                                <span className="text-gray-400">&bull;</span>
                                <span className="text-gray-500">
                                  {new Date(ch.changedAt).toLocaleString()}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-mono text-xs rounded">
                                Target: v{ch.version}
                              </span>
                            </div>

                            <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                              <span className="font-semibold text-gray-900">Reason for change: </span>
                              {ch.reason || 'Statutory regulatory alignment.'}
                            </div>

                            {/* Diff Items */}
                            {ch.diff && ch.diff.length > 0 && (
                              <div className="space-y-2 pt-1">
                                <div className="text-[11px] font-bold text-gray-500 uppercase">
                                  Parameter Diffs:
                                </div>
                                {ch.diff.map((d, dIdx) => (
                                  <div
                                    key={dIdx}
                                    className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-xs space-y-1"
                                  >
                                    <div className="font-bold text-amber-900">
                                      {d.label || d.field}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                                      <div className="text-rose-700 bg-rose-50/80 p-1.5 rounded border border-rose-200">
                                        <span className="font-bold">Previous: </span>
                                        {String(d.oldValue ?? 'None')}
                                      </div>
                                      <div className="text-emerald-700 bg-emerald-50/80 p-1.5 rounded border border-emerald-200">
                                        <span className="font-bold">New: </span>
                                        {String(d.newValue ?? 'None')}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setHistoryDrawerOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
              >
                Close Lineage Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Propose New Rule Version Modal */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Propose Rule Revision
                  </h3>
                  <p className="text-xs text-gray-500">
                    Creates an incremented version without altering historical obligations.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProposeModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProposeRuleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="ruleCodeSelect" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Target Rule Code *
                </label>
                <select
                  id="ruleCodeSelect"
                  value={ruleForm.ruleCode}
                  onChange={(e) => {
                    const sel = rules.find((r) => r.ruleCode === e.target.value);
                    setRuleForm({
                      ...ruleForm,
                      ruleCode: e.target.value,
                      jurisdiction: sel?.jurisdiction || ruleForm.jurisdiction,
                      name: sel?.name || '',
                      reportType: sel?.reportType || '',
                      deadlineDays: sel?.deadlineDays || 15,
                      description: sel?.description || '',
                    });
                  }}
                  className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                  required
                >
                  <option value="RR-FDA-15D">RR-FDA-15D (FDA 15-Day Expedited)</option>
                  <option value="RR-EMA-7D">RR-EMA-7D (EMA 7-Day Fatal/Life-Threatening)</option>
                  <option value="RR-EMA-15D">RR-EMA-15D (EMA 15-Day Serious)</option>
                  <option value="RR-CDSCO-15D">RR-CDSCO-15D (CDSCO 15-Day Serious)</option>
                  <option value="RR-PMDA-15D">RR-PMDA-15D (PMDA 15-Day Expedited)</option>
                  <option value="RR-MHRA-15D">RR-MHRA-15D (MHRA 15-Day Expedited)</option>
                  <option value="RR-WHO-30D">RR-WHO-30D (WHO Periodic 30-Day)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ruleJurisdictionSelect" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Jurisdiction *
                  </label>
                  <select
                    id="ruleJurisdictionSelect"
                    value={ruleForm.jurisdiction}
                    onChange={(e) => setRuleForm({ ...ruleForm, jurisdiction: e.target.value })}
                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                    required
                  >
                    <option value="FDA">FDA (United States)</option>
                    <option value="EMA">EMA (European Union)</option>
                    <option value="CDSCO">CDSCO (India)</option>
                    <option value="PMDA">PMDA (Japan)</option>
                    <option value="MHRA">MHRA (United Kingdom)</option>
                    <option value="WHO">WHO (Global Vigibase)</option>
                    <option value="GLOBAL">GLOBAL</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ruleDeadlineInput" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Deadline (Days) *
                  </label>
                  <input
                    id="ruleDeadlineInput"
                    type="number"
                    min="1"
                    max="365"
                    value={ruleForm.deadlineDays}
                    onChange={(e) => setRuleForm({ ...ruleForm, deadlineDays: Number(e.target.value) })}
                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ruleNameInput" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Rule Name *
                </label>
                <input
                  id="ruleNameInput"
                  type="text"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="e.g. Revised FDA 10-Day Expedited Alert"
                  className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                  required
                />
              </div>

              <div>
                <label htmlFor="ruleReportTypeInput" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Report Type *
                </label>
                <input
                  id="ruleReportTypeInput"
                  type="text"
                  value={ruleForm.reportType}
                  onChange={(e) => setRuleForm({ ...ruleForm, reportType: e.target.value })}
                  placeholder="e.g. 15-Day Expedited ICSR"
                  className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                  required
                />
              </div>

              <div>
                <label htmlFor="ruleReasonInput" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Statutory Reason for Revision *
                </label>
                <textarea
                  id="ruleReasonInput"
                  rows="2"
                  value={ruleForm.reason}
                  onChange={(e) => setRuleForm({ ...ruleForm, reason: e.target.value })}
                  placeholder="State clinical or statutory rationale (e.g. ICH E2B(R3) statutory compression)."
                  className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Version Governance Rule</span>
                </div>
                <p>
                  Submitting this revision increments the statutory rule version (vN+1) with a permanent audit trail. Existing cases retain their historical deadlines.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="requireApproval"
                  checked={ruleForm.requireApproval}
                  onChange={(e) => setRuleForm({ ...ruleForm, requireApproval: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="requireApproval" className="text-xs font-medium text-gray-700">
                  Require Senior Regulatory Approval before activation (creates PENDING_APPROVAL version)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRule}
                  className="inline-flex items-center space-x-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  {submittingRule && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Submit Version</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

