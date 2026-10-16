import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FolderOpen,
  Search,
  Download,
  Plus,
  Columns,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import Can from '../components/auth/Can';
import DataOriginBadge from '../components/case/DataOriginBadge';

const QUICK_FILTERS = [
  { id: 'all', label: 'All Cases', params: {} },
  { id: 'my_assigned', label: 'My Assigned', params: { myCases: 'true' } },
  { id: 'medical_review', label: 'Medical Review', params: { status: 'medical_review' } },
  { id: 'quality_review', label: 'Quality Review', params: { status: 'quality_review' } },
  { id: 'serious', label: 'Serious / High Priority', params: { seriousness: 'Serious', priority: 'high' } },
  { id: 'closed', label: 'Closed & Archived', params: { status: 'closed' } },
];

const ALL_COLUMNS = [
  { id: 'caseNumber', label: 'Case Number', default: true },
  { id: 'status', label: 'Workflow Status', default: true },
  { id: 'priority', label: 'Priority', default: true },
  { id: 'product', label: 'Suspect Product', default: true },
  { id: 'eventSummary', label: 'Adverse Reaction', default: true },
  { id: 'patient', label: 'Patient Info', default: true },
  { id: 'reporter', label: 'Reporter', default: false },
  { id: 'assignedTo', label: 'Assignee', default: true },
  { id: 'receiptDate', label: 'Receipt Date', default: true },
  { id: 'dueDate', label: 'Due Date', default: false },
];

export default function Cases() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & State
  const [activeQuickFilter, setActiveQuickFilter] = useState('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [seriousnessFilter, setSeriousnessFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCases, setTotalCases] = useState(0);

  // Density & Columns
  const [density, setDensity] = useState('normal'); // 'compact' | 'normal' | 'comfortable'
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const initial = {};
    ALL_COLUMNS.forEach((col) => {
      initial[col.id] = col.default;
    });
    return initial;
  });
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch Cases from API
  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qf = QUICK_FILTERS.find((f) => f.id === activeQuickFilter)?.params || {};
      const params = {
        page,
        limit: 15,
        search,
        status: statusFilter || qf.status,
        priority: priorityFilter || qf.priority,
        seriousness: seriousnessFilter || qf.seriousness,
        myCases: qf.myCases,
        sortBy: 'receiptDate',
        sortOrder: 'desc',
      };

      const res = await api.get('/cases', { params });
      if (res.data.success) {
        setCases(res.data.cases);
        setTotalPages(res.data.pagination.totalPages);
        setTotalCases(res.data.pagination.total);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load safety cases');
    } finally {
      setLoading(false);
    }
  }, [activeQuickFilter, search, statusFilter, priorityFilter, seriousnessFilter, page]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Export CSV
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const qf = QUICK_FILTERS.find((f) => f.id === activeQuickFilter)?.params || {};
      const res = await api.get('/cases/export/csv', {
        params: {
          search,
          status: statusFilter || qf.status,
          priority: priorityFilter || qf.priority,
          seriousness: seriousnessFilter || qf.seriousness,
          myCases: qf.myCases,
        },
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safety-cases-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_err) {
      alert('Failed to export cases to CSV');
    } finally {
      setExporting(false);
    }
  };

  const getStatusPill = (status) => {
    switch (status) {
      case 'new':
        return <span className="badge bg-blue-50 text-blue-700 ring-blue-600/20 font-semibold">New</span>;
      case 'data_entry':
        return <span className="badge bg-purple-50 text-purple-700 ring-purple-600/20 font-semibold">Data Entry</span>;
      case 'medical_review':
        return <span className="badge bg-amber-50 text-amber-700 ring-amber-600/20 font-semibold">Medical Review</span>;
      case 'quality_review':
        return <span className="badge bg-indigo-50 text-indigo-700 ring-indigo-600/20 font-semibold">Quality Review</span>;
      case 'ready_for_submission':
        return <span className="badge bg-cyan-50 text-cyan-700 ring-cyan-600/20 font-semibold">Ready to Submit</span>;
      case 'completed':
        return <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-600/20 font-semibold">Completed</span>;
      case 'closed':
        return <span className="badge bg-slate-100 text-slate-700 ring-slate-400/20 font-semibold">Closed</span>;
      default:
        return <span className="badge bg-slate-50 text-slate-600 ring-slate-500/20">{status}</span>;
    }
  };

  const getPriorityPill = (p) => {
    switch (p) {
      case 'urgent':
        return <span className="badge bg-rose-50 text-rose-700 ring-rose-600/20 font-bold uppercase">Urgent</span>;
      case 'high':
        return <span className="badge bg-amber-50 text-amber-700 ring-amber-600/20 font-semibold">High</span>;
      case 'medium':
        return <span className="badge bg-blue-50 text-blue-700 ring-blue-600/20">Medium</span>;
      case 'low':
      default:
        return <span className="badge bg-slate-50 text-slate-600 ring-slate-500/20">Low</span>;
    }
  };

  const toggleColumn = (colId) => {
    setVisibleColumns((prev) => ({ ...prev, [colId]: !prev[colId] }));
  };

  const densityPadding =
    density === 'compact' ? 'py-1.5 px-3' : density === 'comfortable' ? 'py-4 px-4' : 'py-3 px-3.5';

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <FolderOpen className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Safety Case Management</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Pharmacovigilance registry, clinical causality assessment, and regulatory submissions
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-sm"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export CSV</span>
          </button>

          <Can permission="case.create">
            <button
              type="button"
              onClick={() => navigate('/intakes?action=create')}
              className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>New Case Intake</span>
            </button>
          </Can>
        </div>
      </div>

      {/* ── Saved Filters (Quick Views) ────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {QUICK_FILTERS.map((qf) => (
          <button
            key={qf.id}
            type="button"
            onClick={() => {
              setActiveQuickFilter(qf.id);
              setPage(1);
            }}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all border ${
              activeQuickFilter === qf.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {qf.label}
          </button>
        ))}
      </div>

      {/* ── Search, Filters, Column Chooser & Density Toolbar ── */}
      <div className="card p-3.5 sm:p-4 space-y-3 bg-white shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Bar */}
          <div className="relative flex-1 w-full lg:max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search case #, product, adverse event, patient ref…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Filter Dropdowns & View Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="data_entry">Data Entry</option>
              <option value="medical_review">Medical Review</option>
              <option value="quality_review">Quality Review</option>
              <option value="ready_for_submission">Ready for Submission</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>

            {/* Priority Dropdown */}
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Seriousness Dropdown */}
            <select
              value={seriousnessFilter}
              onChange={(e) => {
                setSeriousnessFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">All Seriousness</option>
              <option value="Serious">Serious</option>
              <option value="Non-Serious">Non-Serious</option>
            </select>

            {/* Column Chooser Popover Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnChooser((prev) => !prev)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors"
                title="Column Chooser"
              >
                <Columns className="h-4 w-4" />
              </button>

              {showColumnChooser && (
                <div className="absolute right-0 top-full mt-1.5 z-30 w-52 rounded-xl bg-white p-3 shadow-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-900 block mb-2">Display Columns</span>
                  <div className="space-y-1.5">
                    {ALL_COLUMNS.map((col) => (
                      <label key={col.id} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!visibleColumns[col.id]}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Density Toggle */}
            <div className="hidden sm:flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`rounded-lg px-2 py-1 font-medium transition-colors ${
                  density === 'compact' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Compact Density"
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setDensity('normal')}
                className={`rounded-lg px-2 py-1 font-medium transition-colors ${
                  density === 'normal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Normal Density"
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`rounded-lg px-2 py-1 font-medium transition-colors ${
                  density === 'comfortable' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Comfortable Density"
              >
                Comfortable
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Case Table ──────────────────────────────────────── */}
      <div className="card overflow-hidden bg-white shadow-xs border border-slate-200">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" />
            <p className="text-xs font-medium">Loading safety cases…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 space-y-2">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
            <p className="text-sm font-bold">{error}</p>
            <button
              type="button"
              onClick={fetchCases}
              className="btn-secondary text-xs py-1.5 px-3 mt-2"
            >
              Retry
            </button>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <FolderOpen className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="text-base font-bold text-slate-700">No cases match your filter</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your quick filter, status criteria, or search keywords.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {visibleColumns.caseNumber && <th className="py-3 px-3.5">Case #</th>}
                  {visibleColumns.status && <th className="py-3 px-3.5">Status</th>}
                  {visibleColumns.priority && <th className="py-3 px-3.5">Priority</th>}
                  {visibleColumns.product && <th className="py-3 px-3.5">Product</th>}
                  {visibleColumns.eventSummary && <th className="py-3 px-3.5">Reaction / Event</th>}
                  {visibleColumns.patient && <th className="py-3 px-3.5">Patient</th>}
                  {visibleColumns.reporter && <th className="py-3 px-3.5">Reporter</th>}
                  {visibleColumns.assignedTo && <th className="py-3 px-3.5">Assignee</th>}
                  {visibleColumns.receiptDate && <th className="py-3 px-3.5">Receipt Date</th>}
                  {visibleColumns.dueDate && <th className="py-3 px-3.5">Due Date</th>}
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => navigate(`/cases/${c.caseNumber}`)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Case Number */}
                    {visibleColumns.caseNumber && (
                      <td className={densityPadding}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-brand-600 group-hover:text-brand-800 text-xs">
                            {c.caseNumber}
                          </span>
                          {c.seriousness === 'Serious' && (
                            <span className="badge bg-red-50 text-red-700 text-[10px] font-bold ring-red-600/20">
                              Serious
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          v{c.version || 1} • {c.reportType || c.source || 'Spontaneous'}
                        </span>
                      </td>
                    )}

                    {/* Status */}
                    {visibleColumns.status && (
                      <td className={densityPadding}>{getStatusPill(c.status)}</td>
                    )}

                    {/* Priority */}
                    {visibleColumns.priority && (
                      <td className={densityPadding}>{getPriorityPill(c.priority)}</td>
                    )}

                    {/* Suspect Product */}
                    {visibleColumns.product && (
                      <td className={densityPadding}>
                        <span className="font-semibold text-slate-800 block">
                          {c.product || c.caseProducts?.[0]?.productName || '—'}
                        </span>
                        {c.caseProducts?.length > 1 && (
                          <span className="text-[10px] text-slate-400">
                            +{c.caseProducts.length - 1} concomitant
                          </span>
                        )}
                      </td>
                    )}

                    {/* Reaction / Event */}
                    {visibleColumns.eventSummary && (
                      <td className={`${densityPadding} max-w-xs`}>
                        <div className="flex items-center gap-1.5">
                          <DataOriginBadge origin="reported" size="xs" />
                          <span className="font-medium text-slate-800 truncate block">
                            {c.eventSummary || c.reactions?.[0]?.verbatim || '—'}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Patient */}
                    {visibleColumns.patient && (
                      <td className={densityPadding}>
                        <span className="text-slate-800 font-medium block">
                          {c.patient?.reference || 'Pt-Ref'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {c.patient?.age != null ? `${c.patient.age}y` : c.patientAge != null ? `${c.patientAge}y` : 'Age N/A'} • {c.patient?.sex || c.patientGender || 'Unknown'}
                        </span>
                      </td>
                    )}

                    {/* Reporter */}
                    {visibleColumns.reporter && (
                      <td className={densityPadding}>
                        <span className="text-slate-800 font-medium block">
                          {c.reporter?.name || 'HCP'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {c.reporter?.qualification || 'Physician'}
                        </span>
                      </td>
                    )}

                    {/* Assignee */}
                    {visibleColumns.assignedTo && (
                      <td className={densityPadding}>
                        {c.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                              {c.assignedTo.name?.slice(0, 1)}
                            </div>
                            <span className="text-slate-700 font-medium truncate max-w-[120px]">
                              {c.assignedTo.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                    )}

                    {/* Receipt Date */}
                    {visibleColumns.receiptDate && (
                      <td className={densityPadding}>
                        <span className="text-slate-700">
                          {c.receiptDate ? new Date(c.receiptDate).toLocaleDateString() : '—'}
                        </span>
                      </td>
                    )}

                    {/* Regulatory Due Date */}
                    {visibleColumns.dueDate && (
                      <td className={densityPadding}>
                        <span className="text-slate-700">
                          {c.regulatoryDueDate ? new Date(c.regulatoryDueDate).toLocaleDateString() : '—'}
                        </span>
                      </td>
                    )}

                    {/* Actions */}
                    <td className={`${densityPadding} text-right`}>
                      <Link
                        to={`/cases/${c.caseNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────── */}
        {!loading && cases.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
            <div className="text-center sm:text-left">
              Showing <span className="font-semibold text-slate-900">{cases.length}</span> of{' '}
              <span className="font-semibold text-slate-900">{totalCases}</span> total cases
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-medium text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
