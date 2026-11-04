import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileBarChart,
  Calendar,
  Layers,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Play,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Info,
  ShieldCheck,
  Check,
  X,
  Loader2,
  ChevronRight,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import api from '../services/api';

const REPORT_TYPE_COLORS = {
  PSUR: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  PBRER: 'bg-purple-100 text-purple-800 border-purple-200',
  DSUR: 'bg-blue-100 text-blue-800 border-blue-200',
  LINE_LISTING: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  SUMMARY_TABULATION: 'bg-amber-100 text-amber-800 border-amber-200',
  CUSTOM: 'bg-gray-100 text-gray-800 border-gray-200',
};

const APPROVAL_BADGES = {
  DRAFT: {
    bg: 'bg-gray-100 text-gray-800 border-gray-300',
    label: 'DRAFT',
  },
  PENDING_APPROVAL: {
    bg: 'bg-amber-50 text-amber-800 border-amber-300',
    label: 'PENDING APPROVAL',
  },
  APPROVED: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    label: 'APPROVED (QPPV SIGNED)',
  },
  REJECTED: {
    bg: 'bg-rose-50 text-rose-800 border-rose-300',
    label: 'REJECTED',
  },
};

export default function AggregateReports() {
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'runs' | 'definitions'
  const [definitions, setDefinitions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Selected definition for builder
  const [selectedDefId, setSelectedDefId] = useState('');
  const [builderConfig, setBuilderConfig] = useState({
    name: 'Custom Ad-Hoc Aggregate Report',
    reportType: 'PSUR',
    periodType: 'QUARTERLY',
    startDate: '',
    endDate: '',
    seriousness: 'ALL',
    productFilter: '',
    countryFilter: '',
    isScheduled: false,
    frequency: 'NONE',
  });

  // Live preview state
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewTab, setPreviewTab] = useState('tabulation'); // 'tabulation' | 'linelisting'

  // Generating a run
  const [executingRun, setExecutingRun] = useState(false);

  // Run detail drawer
  const [selectedRun, setSelectedRun] = useState(null);
  const [runDrawerOpen, setRunDrawerOpen] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);

  // Approval action in progress
  const [actionInProgress, setActionInProgress] = useState(false);

  // Create definition modal
  const [showCreateDefModal, setShowCreateDefModal] = useState(false);
  const [newDefForm, setNewDefForm] = useState({
    name: '',
    description: '',
    reportType: 'PSUR',
    periodType: 'QUARTERLY',
    seriousness: 'ALL',
    isScheduled: false,
    frequency: 'NONE',
  });
  const [creatingDef, setCreatingDef] = useState(false);

  // Fetch definitions and runs
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [defsRes, runsRes] = await Promise.all([
        api.get('/aggregate-reports/definitions'),
        api.get('/aggregate-reports/runs'),
      ]);

      if (defsRes.data.success) {
        setDefinitions(defsRes.data.data || []);
        if (defsRes.data.data?.length > 0 && !selectedDefId) {
          const first = defsRes.data.data[0];
          setSelectedDefId(first._id);
          setBuilderConfig({
            name: first.name,
            reportType: first.reportType,
            periodType: first.period?.periodType || 'QUARTERLY',
            startDate: first.period?.startDate ? first.period.startDate.split('T')[0] : '',
            endDate: first.period?.endDate ? first.period.endDate.split('T')[0] : '',
            seriousness: first.filters?.seriousness || 'ALL',
            productFilter: (first.filters?.products || []).join(', '),
            countryFilter: (first.filters?.countries || []).join(', '),
            isScheduled: first.schedule?.isScheduled || false,
            frequency: first.schedule?.frequency || 'NONE',
          });
        }
      }

      if (runsRes.data.success) {
        setRuns(runsRes.data.runs || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load aggregate report definitions and run history');
    } finally {
      setLoading(false);
    }
  }, [selectedDefId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Trigger live preview
  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const payload = {
        definitionId: selectedDefId || null,
        period: {
          periodType: builderConfig.periodType,
          startDate: builderConfig.startDate || null,
          endDate: builderConfig.endDate || null,
        },
        filters: {
          seriousness: builderConfig.seriousness,
          products: builderConfig.productFilter
            ? builderConfig.productFilter.split(',').map((p) => p.trim()).filter(Boolean)
            : [],
          countries: builderConfig.countryFilter
            ? builderConfig.countryFilter.split(',').map((c) => c.trim()).filter(Boolean)
            : [],
        },
      };

      const res = await api.post('/aggregate-reports/preview', payload);
      if (res.data.success) {
        setPreviewData(res.data.data);
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to generate live preview',
      });
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedDefId, builderConfig]);

  useEffect(() => {
    if (activeTab === 'builder') {
      fetchPreview();
    }
  }, [fetchPreview, activeTab]);

  // Execute report run
  const handleExecuteRun = async () => {
    if (!selectedDefId) {
      setToastMessage({ type: 'error', text: 'Please select a report definition to execute.' });
      return;
    }

    setExecutingRun(true);
    try {
      const payload = {
        periodOverride: {
          periodType: builderConfig.periodType,
          startDate: builderConfig.startDate || null,
          endDate: builderConfig.endDate || null,
        },
        filtersOverride: {
          seriousness: builderConfig.seriousness,
          products: builderConfig.productFilter
            ? builderConfig.productFilter.split(',').map((p) => p.trim()).filter(Boolean)
            : [],
          countries: builderConfig.countryFilter
            ? builderConfig.countryFilter.split(',').map((c) => c.trim()).filter(Boolean)
            : [],
        },
      };

      const res = await api.post(`/aggregate-reports/definitions/${selectedDefId}/run`, payload);
      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: `Report run generated successfully: v${res.data.data.version} (${res.data.data.totalCases} cases analyzed)!`,
        });
        fetchData();
        setActiveTab('runs');
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to execute report run',
      });
    } finally {
      setExecutingRun(false);
    }
  };

  // Download CSV or PDF
  const handleDownload = async (runId, format, fileName) => {
    setDownloadingFormat(format);
    try {
      const res = await api.get(`/aggregate-reports/runs/${runId}/export/${format}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || `Failed to export ${format.toUpperCase()}`,
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  // Submit Run for Approval
  const handleSubmitForApproval = async (runId) => {
    setActionInProgress(true);
    try {
      const res = await api.post(`/aggregate-reports/runs/${runId}/submit-approval`, {
        comments: 'Submitted for formal periodic pharmacovigilance review.',
      });
      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: 'Report run submitted for Senior Regulatory / QPPV approval.',
        });
        fetchData();
        if (selectedRun?._id === runId) {
          setSelectedRun(res.data.data);
        }
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to submit report for approval',
      });
    } finally {
      setActionInProgress(false);
    }
  };

  // Approve Run
  const handleApproveRun = async (runId) => {
    setActionInProgress(true);
    try {
      const res = await api.post(`/aggregate-reports/runs/${runId}/approve`, {
        comments: 'Qualified Person review completed. Dossier approved.',
      });
      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: 'Aggregate report run approved and signed.',
        });
        fetchData();
        if (selectedRun?._id === runId) {
          setSelectedRun(res.data.data);
        }
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to approve report run',
      });
    } finally {
      setActionInProgress(false);
    }
  };

  // Create Definition Handler
  const handleCreateDefinition = async (e) => {
    e.preventDefault();
    setCreatingDef(true);
    try {
      const res = await api.post('/aggregate-reports/definitions', {
        name: newDefForm.name,
        description: newDefForm.description,
        reportType: newDefForm.reportType,
        period: {
          periodType: newDefForm.periodType,
        },
        filters: {
          seriousness: newDefForm.seriousness,
        },
        schedule: {
          isScheduled: newDefForm.isScheduled,
          frequency: newDefForm.frequency,
        },
      });

      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: `Report definition ${res.data.data.name} created!`,
        });
        setShowCreateDefModal(false);
        setNewDefForm({
          name: '',
          description: '',
          reportType: 'PSUR',
          periodType: 'QUARTERLY',
          seriousness: 'ALL',
          isScheduled: false,
          frequency: 'NONE',
        });
        fetchData();
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to create report definition',
      });
    } finally {
      setCreatingDef(false);
    }
  };

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
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
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
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-100">
            <FileBarChart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Periodic Aggregate Safety Reports
            </h1>
            <p className="text-sm text-gray-500">
              PSUR, PBRER, DSUR, cumulative line listings, and MedDRA summary tabulations.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateDefModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Report Definition</span>
          </button>
        </div>
      </div>

      {/* Crucial Statutory Distinction Banner */}
      <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-amber-800 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 space-y-1">
          <p className="font-bold text-amber-900 uppercase tracking-wide">
            Statutory Principle: Aggregate Safety Reporting ≠ Individual Case Safety Reporting (ICSR)
          </p>
          <p>
            <strong>ICSRs</strong> evaluate individual adverse drug events against urgent statutory deadlines (e.g. 7-day fatal/life-threatening or 15-day expedited alerts). In contrast, <strong>Aggregate Safety Reports (PSUR/PBRER/DSUR)</strong> assess cumulative population-level benefit-risk balance across defined intervals (quarterly/annually), detecting emerging safety signals and verifying product labeling integrity.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 flex items-center space-x-6">
        <button
          onClick={() => setActiveTab('builder')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'builder'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Report Builder & Live Preview</span>
        </button>

        <button
          onClick={() => setActiveTab('runs')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'runs'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Generated Runs & Approval History</span>
          {runs.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800">
              {runs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('definitions')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'definitions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Report Definitions Catalogue</span>
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gray-100 text-gray-700">
            {definitions.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Report Builder & Live Preview */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Builder Controls Column */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Report Parameters</span>
              </h3>
              <span className="text-[11px] font-mono text-gray-500">ICH E2C / E2F</span>
            </div>

            {/* Select Definition */}
            <div>
              <label htmlFor="defSelect" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Base Report Definition
              </label>
              <select
                id="defSelect"
                value={selectedDefId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedDefId(id);
                  const def = definitions.find((d) => d._id === id);
                  if (def) {
                    setBuilderConfig({
                      name: def.name,
                      reportType: def.reportType,
                      periodType: def.period?.periodType || 'QUARTERLY',
                      startDate: def.period?.startDate ? def.period.startDate.split('T')[0] : '',
                      endDate: def.period?.endDate ? def.period.endDate.split('T')[0] : '',
                      seriousness: def.filters?.seriousness || 'ALL',
                      productFilter: (def.filters?.products || []).join(', '),
                      countryFilter: (def.filters?.countries || []).join(', '),
                      isScheduled: def.schedule?.isScheduled || false,
                      frequency: def.schedule?.frequency || 'NONE',
                    });
                  }
                }}
                className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              >
                {definitions.map((def) => (
                  <option key={def._id} value={def._id}>
                    {def.name} ({def.reportType})
                  </option>
                ))}
              </select>
            </div>

            {/* Period Picker */}
            <div>
              <label htmlFor="periodSelect" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Interval / Period Scope
              </label>
              <select
                id="periodSelect"
                value={builderConfig.periodType}
                onChange={(e) => setBuilderConfig({ ...builderConfig, periodType: e.target.value })}
                className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              >
                <option value="LAST_30_DAYS">Last 30 Days (Ad-Hoc)</option>
                <option value="MONTHLY">Monthly Interval (30 Days)</option>
                <option value="QUARTERLY">Quarterly Interval (90 Days - Standard PSUR)</option>
                <option value="SEMI_ANNUAL">Semi-Annual (180 Days)</option>
                <option value="ANNUAL">Annual Interval (365 Days - PBRER / DSUR)</option>
                <option value="CUSTOM">Custom Date Range</option>
              </select>

              {builderConfig.periodType === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label htmlFor="customStart" className="text-[11px] text-gray-500">Start Date</label>
                    <input
                      id="customStart"
                      type="date"
                      value={builderConfig.startDate}
                      onChange={(e) => setBuilderConfig({ ...builderConfig, startDate: e.target.value })}
                      className="w-full text-xs rounded border p-1.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="customEnd" className="text-[11px] text-gray-500">End Date</label>
                    <input
                      id="customEnd"
                      type="date"
                      value={builderConfig.endDate}
                      onChange={(e) => setBuilderConfig({ ...builderConfig, endDate: e.target.value })}
                      className="w-full text-xs rounded border p-1.5"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Seriousness Filter */}
            <div>
              <label htmlFor="seriousnessFilter" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Seriousness Filter
              </label>
              <select
                id="seriousnessFilter"
                value={builderConfig.seriousness}
                onChange={(e) => setBuilderConfig({ ...builderConfig, seriousness: e.target.value })}
                className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              >
                <option value="ALL">All Adverse Events (Serious & Non-Serious)</option>
                <option value="Serious">Serious Reactions Only</option>
                <option value="Non-Serious">Non-Serious Reactions Only</option>
              </select>
            </div>

            {/* Product Filter */}
            <div>
              <label htmlFor="productFilter" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Product Filter (Comma-separated)
              </label>
              <input
                id="productFilter"
                type="text"
                placeholder="e.g. CardioMax, Diazepam"
                value={builderConfig.productFilter}
                onChange={(e) => setBuilderConfig({ ...builderConfig, productFilter: e.target.value })}
                className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              />
            </div>

            {/* Country Filter */}
            <div>
              <label htmlFor="countryFilter" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Country Filter (Comma-separated)
              </label>
              <input
                id="countryFilter"
                type="text"
                placeholder="e.g. Germany, India, United States"
                value={builderConfig.countryFilter}
                onChange={(e) => setBuilderConfig({ ...builderConfig, countryFilter: e.target.value })}
                className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              />
            </div>

            {/* Schedule Option */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="scheduleCheck"
                  checked={builderConfig.isScheduled}
                  onChange={(e) => setBuilderConfig({ ...builderConfig, isScheduled: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="scheduleCheck" className="text-xs font-bold text-gray-800">
                  Automate Recurring Schedule
                </label>
              </div>

              {builderConfig.isScheduled && (
                <div className="pt-1">
                  <label htmlFor="freqSelect" className="text-[11px] text-gray-500 block mb-1">Schedule Frequency</label>
                  <select
                    id="freqSelect"
                    value={builderConfig.frequency}
                    onChange={(e) => setBuilderConfig({ ...builderConfig, frequency: e.target.value })}
                    className="w-full text-xs rounded border p-1.5"
                  >
                    <option value="WEEKLY">Weekly Automated Run</option>
                    <option value="MONTHLY">Monthly Automated Run</option>
                    <option value="QUARTERLY">Quarterly Automated Run</option>
                    <option value="ANNUAL">Annual Dossier Generation</option>
                  </select>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={fetchPreview}
                disabled={loadingPreview}
                className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPreview ? 'animate-spin' : ''}`} />
                <span>Refresh Live Preview</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteRun}
                disabled={executingRun}
                className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {executingRun ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                <span>Generate Versioned Run</span>
              </button>
            </div>
          </div>

          {/* Live Preview Area */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            {/* Preview Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/70">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Live Preview:
                </span>
                <span className="font-semibold text-gray-900 text-sm">
                  {builderConfig.name}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold border ${
                    REPORT_TYPE_COLORS[builderConfig.reportType] || 'bg-gray-100'
                  }`}
                >
                  {builderConfig.reportType}
                </span>
              </div>

              {/* Counts */}
              <div className="flex items-center space-x-3 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                  {previewData?.totalCases || 0} Cases
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  {previewData?.totalReactions || 0} Reactions
                </span>
              </div>
            </div>

            {/* Sub-tabs for Preview */}
            <div className="px-4 pt-2 border-b border-gray-200 flex items-center space-x-4 bg-white">
              <button
                onClick={() => setPreviewTab('tabulation')}
                className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
                  previewTab === 'tabulation'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Summary Tabulation ({previewData?.summaryTabulation?.length || 0})</span>
              </button>

              <button
                onClick={() => setPreviewTab('linelisting')}
                className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
                  previewTab === 'linelisting'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Line Listing ({previewData?.lineListing?.length || 0})</span>
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4 min-h-[360px]">
              {loadingPreview ? (
                <div className="py-24 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Computing aggregate data preview...</p>
                </div>
              ) : previewTab === 'tabulation' ? (
                // Summary Tabulation Table
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                      <tr>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3">MedDRA Preferred Term (PT)</th>
                        <th className="py-2 px-3">System Organ Class</th>
                        <th className="py-2 px-3 text-center">Country</th>
                        <th className="py-2 px-3 text-center">Serious</th>
                        <th className="py-2 px-3 text-center">Fatal</th>
                        <th className="py-2 px-3 text-center font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData?.summaryTabulation?.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-12 text-center text-gray-400">
                            No cases matched the current period and filter criteria.
                          </td>
                        </tr>
                      ) : (
                        previewData?.summaryTabulation?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/60">
                            <td className="py-2.5 px-3 font-semibold text-gray-900">
                              {item.product}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-gray-800">
                              {item.preferredTerm}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500">
                              {item.systemOrganClass}
                            </td>
                            <td className="py-2.5 px-3 text-center text-gray-600">
                              {item.country}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-600">
                              {item.seriousCount}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                              {item.fatalCount}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-gray-900">
                              {item.totalCount}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Line Listing Table
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                      <tr>
                        <th className="py-2 px-3">Case Number</th>
                        <th className="py-2 px-3">Receipt Date</th>
                        <th className="py-2 px-3">Country</th>
                        <th className="py-2 px-3">Patient</th>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3">Reaction PT</th>
                        <th className="py-2 px-3 text-center">Seriousness</th>
                        <th className="py-2 px-3 text-center">Causality</th>
                        <th className="py-2 px-3 text-center">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData?.lineListing?.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="py-12 text-center text-gray-400">
                            No individual case records found for this period.
                          </td>
                        </tr>
                      ) : (
                        previewData?.lineListing?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/60">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                              {item.caseNumber}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              {new Date(item.receiptDate).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              {item.country}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              {item.patientAge} / {item.patientSex}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-gray-900">
                              {item.productName}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-gray-800">
                              {item.preferredTerm}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  item.seriousness === 'Serious'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {item.seriousness}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center text-gray-700">
                              {item.causality}
                            </td>
                            <td className="py-2.5 px-3 text-center text-gray-700">
                              {item.outcome}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Generated Runs & Approval History */}
      {activeTab === 'runs' && (
        <div className="bg-white rounded-b-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Generated Aggregate Report Runs & Regulatory Sign-Offs
              </h3>
              <p className="text-xs text-gray-500">
                Immutable version history, CSV line listings, PDF dossiers, and QPPV approval status.
              </p>
            </div>
            <button
              onClick={fetchData}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border rounded-lg hover:bg-gray-100"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Runs</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600 font-semibold text-xs border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Report Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Version</th>
                  <th className="py-3 px-4">Reporting Interval</th>
                  <th className="py-3 px-4 text-center">Cases / Events</th>
                  <th className="py-3 px-4">Generated At</th>
                  <th className="py-3 px-4">Approval Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-sm text-gray-500">
                      No aggregate report runs generated yet. Use the Report Builder to generate versioned runs.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => {
                    const approvalInfo = APPROVAL_BADGES[run.approval?.status] || APPROVAL_BADGES.DRAFT;

                    return (
                      <tr key={run._id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                          <div>{run.definitionName}</div>
                          <div className="text-xs text-gray-400 font-normal">
                            Run by {run.runByName}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                              REPORT_TYPE_COLORS[run.reportType] || 'bg-gray-100'
                            }`}
                          >
                            {run.reportType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                            v{run.version}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-gray-600">
                          {new Date(run.period.startDate).toLocaleDateString()} &rarr;{' '}
                          {new Date(run.period.endDate).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-gray-800 text-xs">
                          {run.totalCases} / {run.totalReactions}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-600">
                          {new Date(run.runAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${approvalInfo.bg}`}
                          >
                            {approvalInfo.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Inspect Drawer */}
                            <button
                              onClick={() => {
                                setSelectedRun(run);
                                setRunDrawerOpen(true);
                              }}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded"
                              title="Inspect Run & History"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Download CSV */}
                            <button
                              onClick={() =>
                                handleDownload(run._id, 'csv', run.fileReference?.csvFileName || 'report.csv')
                              }
                              className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded"
                              title="Export CSV"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>

                            {/* Download PDF */}
                            <button
                              onClick={() =>
                                handleDownload(run._id, 'pdf', run.fileReference?.pdfFileName || 'report.pdf')
                              }
                              className="p-1.5 text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded"
                              title="Export PDF Dossier"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Approval Actions */}
                            {run.approval?.status === 'DRAFT' && (
                              <button
                                onClick={() => handleSubmitForApproval(run._id)}
                                disabled={actionInProgress}
                                className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100"
                              >
                                Submit Approval
                              </button>
                            )}

                            {run.approval?.status === 'PENDING_APPROVAL' && (
                              <button
                                onClick={() => handleApproveRun(run._id)}
                                disabled={actionInProgress}
                                className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-sm"
                              >
                                Approve Run
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Report Definitions Catalogue */}
      {activeTab === 'definitions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {definitions.map((def) => (
            <div
              key={def._id}
              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-indigo-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                      REPORT_TYPE_COLORS[def.reportType] || 'bg-gray-100'
                    }`}
                  >
                    {def.reportType}
                  </span>
                  <span className="text-xs font-mono text-gray-500">
                    Interval: {def.period?.periodType || 'QUARTERLY'}
                  </span>
                </div>

                <h4 className="font-bold text-gray-900 text-base">{def.name}</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {def.description}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Grouping:</span>
                  <span className="font-semibold text-gray-700">
                    {(def.grouping || []).join(', ')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Schedule:</span>
                  <span className="font-semibold text-gray-700">
                    {def.schedule?.isScheduled ? def.schedule.frequency : 'Ad-Hoc On-Demand'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setSelectedDefId(def._id);
                    setBuilderConfig({
                      name: def.name,
                      reportType: def.reportType,
                      periodType: def.period?.periodType || 'QUARTERLY',
                      startDate: def.period?.startDate ? def.period.startDate.split('T')[0] : '',
                      endDate: def.period?.endDate ? def.period.endDate.split('T')[0] : '',
                      seriousness: def.filters?.seriousness || 'ALL',
                      productFilter: (def.filters?.products || []).join(', '),
                      countryFilter: (def.filters?.countries || []).join(', '),
                      isScheduled: def.schedule?.isScheduled || false,
                      frequency: def.schedule?.frequency || 'NONE',
                    });
                    setActiveTab('builder');
                  }}
                  className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure & Run Report</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Run Detail & Lineage Drawer */}
      {runDrawerOpen && selectedRun && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <FileBarChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {selectedRun.definitionName} v{selectedRun.version}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Executed on {new Date(selectedRun.runAt).toLocaleString()} by {selectedRun.runByName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRunDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Status and Actions Banner */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 uppercase font-bold">Approval Governance</div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5">
                    Status: {selectedRun.approval?.status || 'DRAFT'}
                  </div>
                  {selectedRun.approval?.approvedByName && (
                    <div className="text-xs text-emerald-700 font-medium mt-0.5">
                      Signed off by {selectedRun.approval.approvedByName} on{' '}
                      {new Date(selectedRun.approval.approvedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() =>
                      handleDownload(
                        selectedRun._id,
                        'csv',
                        selectedRun.fileReference?.csvFileName || 'report.csv',
                      )
                    }
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownload(
                        selectedRun._id,
                        'pdf',
                        selectedRun.fileReference?.pdfFileName || 'report.pdf',
                      )
                    }
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-300 rounded-lg hover:bg-rose-100"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Summary Counts */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl">
                  <div className="text-xs text-indigo-700 font-bold uppercase">Cases Evaluated</div>
                  <div className="text-2xl font-black text-indigo-950 mt-1">
                    {selectedRun.totalCases}
                  </div>
                </div>
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                  <div className="text-xs text-emerald-700 font-bold uppercase">Total Adverse Reactions</div>
                  <div className="text-2xl font-black text-emerald-950 mt-1">
                    {selectedRun.totalReactions}
                  </div>
                </div>
              </div>

              {/* Version History Log */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Version Sign-Off & Audit History
                </h4>
                <div className="space-y-3">
                  {(selectedRun.history || []).map((h, hIdx) => (
                    <div
                      key={hIdx}
                      className="p-3 bg-white border border-gray-200 rounded-xl text-xs space-y-1 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 font-bold text-gray-900">
                          <span>{h.fromStatus}</span>
                          <span className="text-gray-400">&rarr;</span>
                          <span className="text-indigo-600">{h.toStatus}</span>
                        </div>
                        <span className="text-gray-500 font-mono text-[11px]">
                          {new Date(h.at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-gray-600">
                        <span className="font-semibold">Action by:</span> {h.byName || 'System'}
                      </div>
                      {h.note && (
                        <div className="text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 mt-1">
                          {h.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Summary Tabulations */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Summary Tabulation Sample (Top 10)
                </h4>
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                      <tr>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3">Preferred Term (PT)</th>
                        <th className="py-2 px-3 text-center">Serious</th>
                        <th className="py-2 px-3 text-center">Fatal</th>
                        <th className="py-2 px-3 text-center font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selectedRun.summaryTabulation || []).slice(0, 10).map((t, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-semibold text-gray-900">{t.product}</td>
                          <td className="py-2 px-3 text-gray-800">{t.preferredTerm}</td>
                          <td className="py-2 px-3 text-center text-amber-600">{t.seriousCount}</td>
                          <td className="py-2 px-3 text-center text-rose-600">{t.fatalCount}</td>
                          <td className="py-2 px-3 text-center font-bold text-gray-900">{t.totalCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setRunDrawerOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Report Definition Modal */}
      {showCreateDefModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-lg">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Create Report Definition
                  </h3>
                  <p className="text-xs text-gray-500">
                    Defines aggregate parameters for periodic regulatory submissions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateDefModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDefinition} className="p-6 space-y-4">
              <div>
                <label htmlFor="defNameInput" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Report Title *
                </label>
                <input
                  id="defNameInput"
                  type="text"
                  required
                  placeholder="e.g. Cardioprotective Drugs Annual PBRER"
                  value={newDefForm.name}
                  onChange={(e) => setNewDefForm({ ...newDefForm, name: e.target.value })}
                  className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                />
              </div>

              <div>
                <label htmlFor="defDescInput" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Clinical / Regulatory Description
                </label>
                <textarea
                  id="defDescInput"
                  rows="2"
                  placeholder="Scope of cumulative benefit-risk review..."
                  value={newDefForm.description}
                  onChange={(e) => setNewDefForm({ ...newDefForm, description: e.target.value })}
                  className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="defTypeSelect" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Report Type *
                  </label>
                  <select
                    id="defTypeSelect"
                    value={newDefForm.reportType}
                    onChange={(e) => setNewDefForm({ ...newDefForm, reportType: e.target.value })}
                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                  >
                    <option value="PSUR">PSUR (Periodic Safety Update)</option>
                    <option value="PBRER">PBRER (Benefit-Risk Evaluation)</option>
                    <option value="DSUR">DSUR (Clinical Development)</option>
                    <option value="LINE_LISTING">Line Listing</option>
                    <option value="SUMMARY_TABULATION">Summary Tabulation</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="defPeriodSelect" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Default Period *
                  </label>
                  <select
                    id="defPeriodSelect"
                    value={newDefForm.periodType}
                    onChange={(e) => setNewDefForm({ ...newDefForm, periodType: e.target.value })}
                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                  >
                    <option value="LAST_30_DAYS">Last 30 Days</option>
                    <option value="QUARTERLY">Quarterly (90 Days)</option>
                    <option value="SEMI_ANNUAL">Semi-Annual (180 Days)</option>
                    <option value="ANNUAL">Annual (365 Days)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="defSeriousSelect" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Seriousness Scope
                </label>
                <select
                  id="defSeriousSelect"
                  value={newDefForm.seriousness}
                  onChange={(e) => setNewDefForm({ ...newDefForm, seriousness: e.target.value })}
                  className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border"
                >
                  <option value="ALL">All Adverse Events</option>
                  <option value="Serious">Serious Events Only</option>
                  <option value="Non-Serious">Non-Serious Only</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateDefModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDef}
                  className="inline-flex items-center space-x-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  {creatingDef && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Definition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

