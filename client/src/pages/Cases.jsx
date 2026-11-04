import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FolderOpen,
  Search,
  FileDown,
  Plus,
  Columns,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  List,
  Kanban,
  BarChart3,
  Sliders,
  Award,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import Can from '../components/auth/Can';
import DataOriginBadge from '../components/case/DataOriginBadge';
import { formatCasesListWhatsApp, openWhatsAppShare } from '../utils/whatsappFormatter';
import KanbanBoard from '../components/workflow/KanbanBoard';
import TeamWorkloadPanel from '../components/workflow/TeamWorkloadPanel';
import CaseRouteModal from '../components/workflow/CaseRouteModal';
import QualityMetricsCard from '../components/quality/QualityMetricsCard';

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

function WhatsAppIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function Cases() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View Mode: 'table' | 'kanban' | 'workload'
  const [viewMode, setViewMode] = useState('table');
  const [routingCase, setRoutingCase] = useState(null);

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
        page: viewMode === 'kanban' ? 1 : page,
        limit: viewMode === 'kanban' ? 100 : 15,
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
  }, [activeQuickFilter, search, statusFilter, priorityFilter, seriousnessFilter, page, viewMode]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Export PDF
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const qf = QUICK_FILTERS.find((f) => f.id === activeQuickFilter)?.params || {};
      const params = {
        page: 1,
        limit: 500,
        search,
        status: statusFilter || qf.status,
        priority: priorityFilter || qf.priority,
        seriousness: seriousnessFilter || qf.seriousness,
        myCases: qf.myCases,
        sortBy: 'receiptDate',
        sortOrder: 'desc',
      };

      const res = await api.get('/cases', { params });
      const exportList = res.data?.cases?.length ? res.data.cases : cases;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      // Header Banner
      doc.setFillColor(37, 99, 235); // Brand Blue #2563eb
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 50, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('Drug Safety CMS — Pharmacovigilance Platform', 40, 32);

      // Subtitle & Report Metadata
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('Safety Case Management Report', 40, 75);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      const generatedAt = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const activeFilterName = QUICK_FILTERS.find((f) => f.id === activeQuickFilter)?.label || 'All';
      doc.text(
        `Generated: ${generatedAt}  |  Active Filter: ${activeFilterName}  |  Total Cases: ${exportList.length}`,
        40,
        92,
      );

      // Table columns & rows
      const tableHeaders = [
        ['Case #', 'Status', 'Priority', 'Seriousness', 'Suspect Product', 'Adverse Reaction', 'Patient', 'Assignee', 'Receipt Date'],
      ];

      const tableRows = exportList.map((c) => [
        c.caseNumber || 'N/A',
        (c.status || '').replace(/_/g, ' ').toUpperCase(),
        (c.priority || 'medium').toUpperCase(),
        c.seriousness || 'Non-Serious',
        c.product || c.caseProducts?.[0]?.productName || 'N/A',
        c.eventSummary || c.reactions?.[0]?.verbatim || 'N/A',
        c.patient?.reference || 'N/A',
        c.assignedTo?.name || 'Unassigned',
        c.receiptDate ? new Date(c.receiptDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 106,
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 70, fontStyle: 'bold' },
          1: { cellWidth: 75 },
          2: { cellWidth: 55 },
          3: { cellWidth: 65 },
          4: { cellWidth: 100 },
          5: { cellWidth: 150 },
          6: { cellWidth: 70 },
          7: { cellWidth: 80 },
          8: { cellWidth: 70 },
        },
        didDrawPage: (data) => {
          // Footer
          const pageCount = doc.internal.getNumberOfPages();
          const pageHeight = doc.internal.pageSize.getHeight();
          const pageWidth = doc.internal.pageSize.getWidth();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            'Confidential — Regulated Pharmacovigilance & Drug Safety Record',
            40,
            pageHeight - 20,
          );
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            pageWidth - 85,
            pageHeight - 20,
          );
        },
        margin: { left: 40, right: 40 },
      });

      doc.save(`safety-cases-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export error:', err);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Share Safety Report to WhatsApp in professional executive format
  const handleShareWhatsApp = () => {
    const qf = QUICK_FILTERS.find((f) => f.id === activeQuickFilter)?.label || 'All';
    const message = formatCasesListWhatsApp({
      cases,
      totalCases,
      activeQuickFilter: qf,
    });
    openWhatsAppShare(message);
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

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-sm hover:border-brand-300 transition-all"
            title="Download cases as PDF report"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
            ) : (
              <FileDown className="h-3.5 w-3.5 text-brand-600" />
            )}
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 transition-all shadow-xs"
            title="Share safety case report to WhatsApp"
          >
            <WhatsAppIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>Share to WhatsApp</span>
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

      {/* ── View Switcher & Saved Filters (Quick Views) ───── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Table View</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'kanban'
                ? 'bg-white text-brand-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Kanban className="h-3.5 w-3.5" />
            <span>Kanban Board</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('workload')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'workload'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Team Workload</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('quality')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'quality'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Quality Metrics</span>
          </button>
        </div>

        {viewMode !== 'workload' && viewMode !== 'quality' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_FILTERS.map((qf) => (
              <button
                key={qf.id}
                type="button"
                onClick={() => {
                  setActiveQuickFilter(qf.id);
                  setPage(1);
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-all border ${
                  activeQuickFilter === qf.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {qf.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'workload' ? (
        <TeamWorkloadPanel />
      ) : viewMode === 'quality' ? (
        <QualityMetricsCard />
      ) : viewMode === 'kanban' ? (
        <div className="space-y-4">
          {/* Quick Search for Kanban */}
          <div className="card p-3 bg-white flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter cases in board…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing <strong>{cases.length}</strong> active cases across stages
            </div>
          </div>

          <KanbanBoard cases={cases} onCaseRouted={fetchCases} />
        </div>
      ) : (
        <>
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
          <>
            {/* ── Mobile Card View (< md) ───────────────────── */}
            <div className="divide-y divide-slate-100 md:hidden">
              {cases.map((c) => (
                <div
                  key={c._id}
                  onClick={() => navigate(`/cases/${c.caseNumber}`)}
                  className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-2.5 active:bg-slate-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-brand-600 text-sm">
                        {c.caseNumber}
                      </span>
                      {c.seriousness === 'Serious' && (
                        <span className="badge bg-red-50 text-red-700 text-[10px] font-bold ring-red-600/20">
                          Serious
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getStatusPill(c.status)}
                      {getPriorityPill(c.priority)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Product</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {c.product || c.caseProducts?.[0]?.productName || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Reaction / Event</span>
                      <div className="flex items-center gap-1">
                        <DataOriginBadge origin="reported" size="xs" />
                        <span className="font-medium text-slate-800 truncate block">
                          {c.eventSummary || c.reactions?.[0]?.verbatim || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span>Pt: <strong>{c.patient?.reference || 'Pt-Ref'}</strong></span>
                      <span>•</span>
                      <span>{c.receiptDate ? new Date(c.receiptDate).toLocaleDateString() : '—'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoutingCase(c);
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
                      >
                        <Sliders className="h-3 w-3" />
                        <span>Route</span>
                      </button>

                      <Link
                        to={`/cases/${c.caseNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop & Tablet Table (md+) ─────────────── */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
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
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoutingCase(c);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:text-brand-700 hover:bg-brand-50 border border-slate-200 shadow-2xs transition-colors"
                            title="Route case through workflow engine"
                          >
                            <Sliders className="h-3 w-3" />
                            <span>Route</span>
                          </button>

                          <Link
                            to={`/cases/${c.caseNumber}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
    </>
  )}

  {/* Case Route Modal */}
  {routingCase && (
    <CaseRouteModal
      isOpen={true}
      onClose={() => setRoutingCase(null)}
      caseId={routingCase._id}
      caseNumber={routingCase.caseNumber}
      onRouteSuccess={() => {
        fetchCases();
        setRoutingCase(null);
      }}
    />
  )}
</div>
);
}
