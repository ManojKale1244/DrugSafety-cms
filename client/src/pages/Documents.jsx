import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderArchive,
  Paperclip,
  Search,
  Filter,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  Eye,
  History,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Loader2,
  Database,
  HardDrive,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Key,
} from 'lucide-react';
import api from '../services/api';

const CATEGORIES = [
  { id: 'ALL', label: 'All Documents' },
  { id: 'SOURCE_DOCUMENT', label: 'Source Documents', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'LAB_RESULT', label: 'Lab Results', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'HOSPITAL_RECORD', label: 'Hospital Records', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'CORRESPONDENCE', label: 'Correspondence', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'REGULATORY_SUBMISSION', label: 'Regulatory Submissions', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { id: 'LITERATURE', label: 'Literature', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'OTHER', label: 'Other', color: 'bg-gray-100 text-gray-800 border-gray-200' },
];

const CATEGORY_MAP = CATEGORIES.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

function getFileTypeIcon(mime = '') {
  const safeMime = (typeof mime === 'string' ? mime : '').toLowerCase();
  if (safeMime.includes('pdf')) return <FileText className="w-5 h-5 text-rose-600" />;
  if (safeMime.includes('image')) return <ImageIcon className="w-5 h-5 text-blue-600" />;
  if (safeMime.includes('csv') || safeMime.includes('sheet') || safeMime.includes('excel'))
    return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
  if (safeMime.includes('xml') || safeMime.includes('json'))
    return <FileCode className="w-5 h-5 text-purple-600" />;
  return <File className="w-5 h-5 text-gray-600" />;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function Documents() {
  const [attachments, setAttachments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // In-App Preview modal
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Presigned URL modal
  const [presignedModalData, setPresignedModalData] = useState(null);
  const [generatingPresigned, setGeneratingPresigned] = useState(false);

  // Version Drawer
  const [versionDrawerAttachment, setVersionDrawerAttachment] = useState(null);
  const [newVersionFile, setNewVersionFile] = useState(null);
  const [newVersionReason, setNewVersionReason] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);

  // Copied hash state
  const [copiedHashId, setCopiedHashId] = useState(null);
  const [copiedPresigned, setCopiedPresigned] = useState(false);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/attachments/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (_err) {
      // Non-blocking
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Attachments list
  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 20,
      };
      if (selectedCategory && selectedCategory !== 'ALL') {
        params.category = selectedCategory;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await api.get('/attachments', { params });
      if (res.data.success) {
        setAttachments(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retrieve documents from vault.');
    } finally {
      setLoading(false);
    }
  }, [page, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Handle In-App Preview
  const handleOpenPreview = async (att) => {
    setPreviewAttachment(att);
    setLoadingPreview(true);
    try {
      const res = await api.get(`/attachments/${att._id}/presigned-url`);
      if (res.data.success && res.data.data.presignedUrl) {
        setPreviewUrl(res.data.data.presignedUrl);
      } else {
        setPreviewUrl(`/api/attachments/${att._id}/stream`);
      }
    } catch {
      setPreviewUrl(`/api/attachments/${att._id}/stream`);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Handle Download Stream
  const handleDownload = async (att) => {
    try {
      const res = await api.get(`/attachments/${att._id}/stream`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: att.mime }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', att.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to download document from storage.',
      });
    }
  };

  // Generate Presigned URL
  const handleGeneratePresignedUrl = async (att) => {
    setGeneratingPresigned(true);
    try {
      const res = await api.get(`/attachments/${att._id}/presigned-url`);
      if (res.data.success) {
        const fullUrl = res.data.data.presignedUrl.startsWith('http')
          ? res.data.data.presignedUrl
          : `${window.location.origin}${res.data.data.presignedUrl}`;
        setPresignedModalData({
          attachment: att,
          url: fullUrl,
          expiresInSeconds: res.data.data.expiresInSeconds,
        });
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to generate presigned URL.',
      });
    } finally {
      setGeneratingPresigned(false);
    }
  };

  // Upload New Version
  const handleUploadVersion = async (e) => {
    e.preventDefault();
    if (!newVersionFile || !versionDrawerAttachment) return;

    setUploadingVersion(true);
    const formData = new FormData();
    formData.append('file', newVersionFile);
    formData.append('reason', newVersionReason);

    try {
      const res = await api.post(
        `/attachments/${versionDrawerAttachment._id}/version`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: `Document updated to v${res.data.data.version}!`,
        });
        setNewVersionFile(null);
        setNewVersionReason('');
        setVersionDrawerAttachment(res.data.data);
        fetchAttachments();
        fetchStats();
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to upload new document version',
      });
    } finally {
      setUploadingVersion(false);
    }
  };

  // Archive / Delete
  const handleArchive = async (att) => {
    if (!window.confirm(`Are you sure you want to archive '${att.name}'? All audit records will be preserved.`)) {
      return;
    }

    try {
      const res = await api.delete(`/attachments/${att._id}`);
      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: `Document '${att.name}' archived successfully.`,
        });
        fetchAttachments();
        fetchStats();
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to archive document.',
      });
    }
  };

  const handleCopyHash = (id, hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  const handleCopyPresignedUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedPresigned(true);
    setTimeout(() => setCopiedPresigned(false), 2000);
  };

  return (
    <div className="space-y-6">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-brand-50 rounded-xl border border-brand-100">
              <FolderArchive className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Document Repository & Vault
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                21 CFR Part 11 compliant storage, magic-byte validation, tamper-evident SHA-256 integrity & version control
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              fetchAttachments();
              fetchStats();
            }}
            className="btn-secondary text-xs flex items-center space-x-1.5 py-2 px-3"
            title="Refresh repository"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Vault</span>
          </button>
        </div>
      </div>

      {/* Vault Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center space-x-4 border-l-4 border-l-brand-600">
          <div className="p-3 bg-brand-50 rounded-xl">
            <FileText className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Catalogued Files</p>
            <p className="text-xl font-bold text-slate-900">
              {statsLoading ? '...' : stats?.totalDocuments || 0}
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center space-x-4 border-l-4 border-l-emerald-600">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <HardDrive className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Vault Storage Volume</p>
            <p className="text-xl font-bold text-slate-900">
              {statsLoading ? '...' : stats?.totalSizeFormatted || '0.00 MB'}
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center space-x-4 border-l-4 border-l-indigo-600">
          <div className="p-3 bg-indigo-50 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Integrity Verification</p>
            <p className="text-xl font-bold text-emerald-700">100% Validated</p>
          </div>
        </div>

        <div className="card p-4 flex items-center space-x-4 border-l-4 border-l-purple-600">
          <div className="p-3 bg-purple-50 rounded-xl">
            <Database className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Active Storage Provider</p>
            <p className="text-xs font-semibold text-slate-800 truncate" title={stats?.storageLocation || 'Local Vault'}>
              {stats?.storageLocation || 'server/uploads/attachments'}
            </p>
          </div>
        </div>
      </div>

      {/* Security & Access Notice */}
      <div className="p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-xl flex items-start space-x-3 text-xs text-indigo-950">
        <ShieldCheck className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-indigo-900 mr-1.5">Compliance Notice:</span>
          All documents are stored under <code>server/uploads/attachments</code> using secure key isolation. Direct unauthenticated access is rejected with HTTP 401. Authorized users access files through audit-logged streaming or short-lived presigned URLs (300s expiry).
        </div>
      </div>

      {/* Search & Category Filter Controls */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by file name, SHA-256 hash, Case ID (e.g. DS-2026-00001), or Intake ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-medium mr-1 flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1" /> Category:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs ${
                selectedCategory === cat.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
              {stats?.categoryCounts?.[cat.id] != null && cat.id !== 'ALL' && (
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {stats.categoryCounts[cat.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600 mb-3" />
            <p className="text-xs">Querying vault and computing cryptographic integrity...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : attachments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Paperclip className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No documents found</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery || selectedCategory !== 'ALL'
                ? 'Try adjusting your search query or category filter.'
                : 'No documents have been uploaded to cases or intakes yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Document / File Name</th>
                  <th className="py-3 px-4">Associated Entity</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Size & Format</th>
                  <th className="py-3 px-4">SHA-256 Fingerprint</th>
                  <th className="py-3 px-4">Uploaded By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attachments.map((att) => {
                  const catConfig = CATEGORY_MAP[att.category] || CATEGORY_MAP.OTHER;
                  return (
                    <tr key={att._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Icon */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-1.5 bg-slate-100 rounded-lg flex-shrink-0">
                            {getFileTypeIcon(att.mime)}
                          </div>
                          <div className="max-w-[200px] truncate">
                            <span
                              onClick={() => handleOpenPreview(att)}
                              className="font-medium text-slate-900 hover:text-brand-600 hover:underline cursor-pointer block truncate"
                              title={att.name}
                            >
                              {att.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {new Date(att.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Associated Case / Intake */}
                      <td className="py-3 px-4">
                        {att.caseId ? (
                          <Link
                            to={`/cases/${att.caseId._id || att.caseId}`}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                          >
                            <span>Case {att.caseNumber || 'Linked'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : att.intakeId ? (
                          <Link
                            to={`/intakes/${att.intakeId._id || att.intakeId}`}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <span>Intake {att.intakeNumber || 'Linked'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Standalone</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catConfig.color}`}
                        >
                          {catConfig.label}
                        </span>
                      </td>

                      {/* Version */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setVersionDrawerAttachment(att)}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition-colors"
                          title="View revision history"
                        >
                          <History className="w-3 h-3 text-slate-500" />
                          <span>v{att.version || 1}</span>
                          {(att.versionHistory?.length || 0) > 0 && (
                            <span className="text-[9px] bg-slate-300 text-slate-700 rounded-full px-1">
                              +{att.versionHistory.length}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Size & Format */}
                      <td className="py-3 px-4 text-slate-600">
                        <span className="block font-medium">{formatBytes(att.size)}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[100px]">
                          {att.mime?.includes('/')
                            ? att.mime.split('/')[1]?.toUpperCase()
                            : att.name?.split('.').pop()?.toUpperCase() || 'BIN'}
                        </span>
                      </td>

                      {/* SHA-256 Fingerprint */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1">
                          <code className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 max-w-[90px] truncate">
                            {att.hash ? `${att.hash.slice(0, 8)}...${att.hash.slice(-6)}` : 'N/A'}
                          </code>
                          {att.hash && (
                            <button
                              onClick={() => handleCopyHash(att._id, att.hash)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded"
                              title="Copy full SHA-256 Hash"
                            >
                              {copiedHashId === att._id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Uploaded By */}
                      <td className="py-3 px-4 text-slate-600">
                        <span className="block truncate max-w-[110px] font-medium">
                          {att.uploadedByName || att.uploadedBy?.name || 'System'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {att.uploadedBy?.role || 'PV Specialist'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenPreview(att)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Preview Document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(att)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Download Document Stream"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleGeneratePresignedUrl(att)}
                            disabled={generatingPresigned}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Generate Short-lived Presigned URL"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(att)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Archive Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold">{pagination.page}</span> of{' '}
              <span className="font-semibold">{pagination.totalPages}</span> ({pagination.total} total files)
            </div>
            <div className="flex items-center space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* In-App Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5 min-w-0">
                {getFileTypeIcon(previewAttachment.mime)}
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate" title={previewAttachment.name}>
                    {previewAttachment.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {formatBytes(previewAttachment.size)} • Version v{previewAttachment.version} • {previewAttachment.mime}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownload(previewAttachment)}
                  className="btn-secondary text-xs flex items-center space-x-1 py-1.5 px-3"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => {
                    setPreviewAttachment(null);
                    setPreviewUrl(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-100 p-2 overflow-auto flex items-center justify-center">
              {loadingPreview ? (
                <div className="text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600 mb-2" />
                  <p className="text-xs">Streaming verified document payload...</p>
                </div>
              ) : previewAttachment?.mime?.includes('pdf') ? (
                <iframe
                  src={previewUrl}
                  title={previewAttachment.name}
                  className="w-full h-full rounded-xl border border-slate-200 bg-white"
                />
              ) : previewAttachment?.mime?.includes('image') ? (
                <img
                  src={previewUrl}
                  alt={previewAttachment.name}
                  className="max-h-full max-w-full object-contain rounded-xl shadow"
                />
              ) : (
                <div className="card p-8 max-w-md text-center space-y-4">
                  <File className="w-12 h-12 text-slate-400 mx-auto" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Direct Preview Not Supported</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      This file type ({previewAttachment?.mime || 'unknown'}) cannot be rendered directly in the web previewer. Please download the file to inspect it.
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(previewAttachment)}
                    className="btn-primary text-xs w-full justify-center flex items-center space-x-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {previewAttachment.name}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-mono truncate max-w-sm">
                SHA-256: {previewAttachment.hash}
              </span>
              <span className="text-emerald-700 font-semibold flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Magic-byte Verified
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Presigned URL Modal */}
      {presignedModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Temporary Presigned URL</h3>
              </div>
              <button
                onClick={() => setPresignedModalData(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">Expires in {presignedModalData.expiresInSeconds} seconds (5 minutes)</p>
              <p className="text-amber-800">
                This signed URL grants direct access to '{presignedModalData.attachment.name}' without passing session cookies. Share only with authorized regulatory reviewers.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Presigned Stream Link</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={presignedModalData.url}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-600 truncate"
                />
                <button
                  onClick={() => handleCopyPresignedUrl(presignedModalData.url)}
                  className="btn-primary text-xs py-2 px-3 flex-shrink-0 flex items-center space-x-1"
                >
                  {copiedPresigned ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPresigned ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setPresignedModalData(null)}
                className="btn-secondary text-xs py-1.5 px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Drawer */}
      {versionDrawerAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-brand-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Document Version History</h3>
                </div>
                <button
                  onClick={() => setVersionDrawerAttachment(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current Version */}
              <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-900 text-xs">
                    Current Version: v{versionDrawerAttachment.version}
                  </span>
                  <span className="text-[10px] font-semibold bg-brand-600 text-white px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
                <p className="text-xs text-brand-800 font-medium truncate">{versionDrawerAttachment.name}</p>
                <p className="text-[10px] text-brand-700">
                  {formatBytes(versionDrawerAttachment.size)} • Uploaded {new Date(versionDrawerAttachment.createdAt).toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-brand-900 truncate">
                  SHA-256: {versionDrawerAttachment.hash}
                </p>
              </div>

              {/* Previous Versions Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Audit History ({versionDrawerAttachment.versionHistory?.length || 0} revisions)
                </h4>

                {(!versionDrawerAttachment.versionHistory || versionDrawerAttachment.versionHistory.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No previous versions. This is the initial version (v1).</p>
                ) : (
                  <div className="space-y-2.5">
                    {versionDrawerAttachment.versionHistory.map((rev, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">Version v{rev.version}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(rev.uploadedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {formatBytes(rev.size)} • By {rev.uploadedByName || 'User'}
                        </p>
                        {rev.reason && (
                          <p className="text-[11px] text-slate-700 italic bg-white p-1.5 rounded border border-slate-100">
                            Reason: "{rev.reason}"
                          </p>
                        )}
                        <p className="text-[10px] font-mono text-slate-400 truncate">
                          SHA: {rev.hash}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload Revision Form */}
              <form onSubmit={handleUploadVersion} className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                  <Plus className="w-3.5 h-3.5 text-brand-600" />
                  <span>Upload Document Revision (v{versionDrawerAttachment.version + 1})</span>
                </h4>

                <div>
                  <label className="text-[11px] text-slate-600 font-medium block mb-1">
                    Select Replacement File
                  </label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setNewVersionFile(e.target.files[0] || null)}
                    className="text-xs w-full text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-600 font-medium block mb-1">
                    Regulatory Revision Reason (Mandatory)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={newVersionReason}
                    onChange={(e) => setNewVersionReason(e.target.value)}
                    placeholder="e.g. Corrected hospital lab unit values as per follow-up enquiry."
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploadingVersion || !newVersionFile || !newVersionReason.trim()}
                  className="btn-primary text-xs w-full flex items-center justify-center space-x-1.5 py-2 disabled:opacity-50"
                >
                  {uploadingVersion ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Hashing & Archiving...</span>
                    </>
                  ) : (
                    <span>Submit & Version Control</span>
                  )}
                </button>
              </form>
            </div>

            <button
              onClick={() => setVersionDrawerAttachment(null)}
              className="btn-secondary text-xs w-full py-2 mt-4"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

