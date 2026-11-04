import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Paperclip,
  UploadCloud,
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
  Plus,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Layers,
  ArrowRight,
  Maximize2,
} from 'lucide-react';
import api from '../../services/api';

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
  if (safeMime.includes('pdf')) return <FileText className="w-6 h-6 text-rose-600" />;
  if (safeMime.includes('image')) return <ImageIcon className="w-6 h-6 text-blue-600" />;
  if (safeMime.includes('csv') || safeMime.includes('sheet') || safeMime.includes('excel'))
    return <FileSpreadsheet className="w-6 h-6 text-emerald-600" />;
  if (safeMime.includes('xml') || safeMime.includes('json'))
    return <FileCode className="w-6 h-6 text-purple-600" />;
  return <File className="w-6 h-6 text-gray-600" />;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function CaseAttachmentsManager({ caseId, intakeId, onAttachmentChange }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Filter
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('SOURCE_DOCUMENT');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // In-app preview modal state
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Version drawer state
  const [versionDrawerAttachment, setVersionDrawerAttachment] = useState(null);
  const [newVersionFile, setNewVersionFile] = useState(null);
  const [newVersionReason, setNewVersionReason] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);

  // Copied hash state
  const [copiedHashId, setCopiedHashId] = useState(null);

  const fetchAttachments = useCallback(async () => {
    const endpoint = caseId
      ? `/cases/${caseId}/attachments`
      : intakeId
      ? `/intakes/${intakeId}/attachments`
      : null;
    if (!endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(endpoint);
      if (res.data.success) {
        setAttachments(res.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [caseId, intakeId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Handle file drop
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Upload file pipeline
  const uploadFile = async (file) => {
    if (!file) return;

    // Client-side quick checks
    if (file.size > 25 * 1024 * 1024) {
      setToastMessage({
        type: 'error',
        text: `File '${file.name}' (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum statutory limit of 25MB.`,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', uploadCategory);

    try {
      const uploadEndpoint = caseId
        ? `/cases/${caseId}/attachments`
        : `/intakes/${intakeId}/attachments`;

      const res = await api.post(uploadEndpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          const percent = Math.min(95, Math.round((progressEvent.loaded * 100) / total));
          setUploadProgress(percent);
        },
      });

      setUploadProgress(100);

      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: `File '${file.name}' uploaded and audited successfully!`,
        });
        fetchAttachments();
        if (onAttachmentChange) onAttachmentChange();
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'File upload rejected by server.',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open In-App Preview
  const handleOpenPreview = async (attachment) => {
    setPreviewAttachment(attachment);
    setLoadingPreview(true);
    try {
      // Get short-lived presigned URL or direct streaming link
      const res = await api.get(`/attachments/${attachment._id}/presigned-url`);
      if (res.data.success && res.data.data.presignedUrl) {
        setPreviewUrl(res.data.data.presignedUrl);
      } else {
        setPreviewUrl(`/api/attachments/${attachment._id}/stream`);
      }
    } catch {
      setPreviewUrl(`/api/attachments/${attachment._id}/stream`);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Download Attachment
  const handleDownloadAttachment = async (attachment, version = null) => {
    try {
      const res = await api.get(`/attachments/${attachment._id}/stream`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: attachment.mime || 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to download document',
      });
    }
  };

  // Delete Attachment
  const handleDeleteAttachment = async (attachmentId, name) => {
    if (!window.confirm(`Are you sure you want to archive attachment '${name}'? This action is audited.`)) {
      return;
    }

    try {
      const res = await api.delete(`/attachments/${attachmentId}`);
      if (res.data.success) {
        setToastMessage({
          type: 'success',
          text: `Attachment '${name}' archived.`,
        });
        fetchAttachments();
        if (onAttachmentChange) onAttachmentChange();
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to delete attachment',
      });
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
        if (onAttachmentChange) onAttachmentChange();
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

  // Copy SHA-256 Hash
  const handleCopyHash = (id, hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  // Filtered attachments
  const filteredAttachments = attachments.filter((att) => {
    if (selectedCategory === 'ALL') return true;
    return att.category === selectedCategory;
  });

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

      {/* Security & Access Notice */}
      <div className="p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-xl flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-indigo-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 space-y-0.5">
          <p className="font-bold text-indigo-900">
            21 CFR Part 11 Controlled Document Storage & Audit Policy
          </p>
          <p>
            All clinical source documents, laboratory profiles, and regulatory submissions are validated against magic-byte signatures, scanned for threats, and immutably versioned. Direct unauthenticated URL access is prohibited; all streaming and download actions are logged to the case audit trail.
          </p>
        </div>
      </div>

      {/* Drag and Drop Uploader */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`p-6 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center space-y-3 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-900">
            Drag and drop clinical source documents here
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            PDF, PNG, JPEG, WebP, CSV, Word DOCX up to 25MB (magic-byte validated)
          </p>
        </div>

        {/* Upload Category Selector */}
        <div className="flex items-center space-x-2 pt-1">
          <label htmlFor="uploadCatSelect" className="text-xs font-semibold text-gray-600">
            Document Category:
          </label>
          <select
            id="uploadCatSelect"
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="text-xs rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-1.5 border"
          >
            <option value="SOURCE_DOCUMENT">Source Document</option>
            <option value="LAB_RESULT">Lab Result / Pathology</option>
            <option value="HOSPITAL_RECORD">Hospital Discharge Record</option>
            <option value="CORRESPONDENCE">Follow-Up Correspondence</option>
            <option value="REGULATORY_SUBMISSION">Regulatory Submission</option>
            <option value="LITERATURE">Literature Article</option>
            <option value="OTHER">Other Clinical Record</option>
          </select>

          <input
            ref={fileInputRef}
            type="file"
            id="fileInput"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) uploadFile(e.target.files[0]);
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            Browse Files
          </button>
        </div>

        {/* Progress Bar */}
        {isUploading && (
          <div className="w-full max-w-md pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Validating & Uploading...</span>
              <span className="font-bold">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${
              selectedCategory === cat.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>{cat.label}</span>
            {cat.id === 'ALL' ? (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500 text-white">
                {attachments.length}
              </span>
            ) : (
              <span className="ml-1 text-[10px] opacity-80">
                ({attachments.filter((a) => a.category === cat.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* File Cards Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading case documents...</p>
        </div>
      ) : filteredAttachments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200">
          <Paperclip className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-gray-800">No documents found</h4>
          <p className="text-xs text-gray-500 mt-1">
            {selectedCategory === 'ALL'
              ? 'No clinical records attached to this case. Drag and drop a file above to add documentation.'
              : `No documents categorized under '${CATEGORY_MAP[selectedCategory]?.label || selectedCategory}'.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAttachments.map((att) => {
            const catInfo = CATEGORY_MAP[att.category] || CATEGORY_MAP.OTHER;

            return (
              <div
                key={att._id}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top Bar with Icon & Category */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                        {getFileTypeIcon(att.mime)}
                      </div>
                      <div className="max-w-[170px]">
                        <h5
                          className="font-bold text-gray-900 text-xs truncate"
                          title={att.name}
                        >
                          {att.name}
                        </h5>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {formatBytes(att.size)} &bull;{' '}
                          {att.mime?.includes('/')
                            ? att.mime.split('/')[1]?.toUpperCase()
                            : att.name?.split('.').pop()?.toUpperCase() || 'FILE'}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      v{att.version}
                    </span>
                  </div>

                  {/* Category Pill */}
                  <div className="mt-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${catInfo.color}`}
                    >
                      {catInfo.label}
                    </span>
                  </div>

                  {/* Checksum Hash Preview */}
                  <div className="mt-2.5 p-1.5 bg-gray-50 rounded text-[10px] font-mono text-gray-600 flex items-center justify-between border border-gray-100">
                    <span className="truncate" title={att.hash}>
                      SHA-256: {att.hash?.substring(0, 16)}...
                    </span>
                    <button
                      onClick={() => handleCopyHash(att._id, att.hash)}
                      className="p-1 hover:text-indigo-600"
                      title="Copy SHA-256 Checksum"
                    >
                      {copiedHashId === att._id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer with Metadata & Actions */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div className="text-[11px] text-gray-400">
                    {new Date(att.createdAt).toLocaleDateString()}
                  </div>

                  <div className="flex items-center space-x-1">
                    {/* In-app Preview Button */}
                    <button
                      onClick={() => handleOpenPreview(att)}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded"
                      title="Preview Document"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownloadAttachment(att)}
                      className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                      title="Download File"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Version History Drawer Button */}
                    <button
                      onClick={() => setVersionDrawerAttachment(att)}
                      className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded"
                      title="Version History"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    {/* Delete Attachment Button */}
                    <button
                      onClick={() => handleDeleteAttachment(att._id, att.name)}
                      className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                      title="Archive Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  {getFileTypeIcon(previewAttachment.mime)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm flex items-center space-x-2">
                    <span>{previewAttachment.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      v{previewAttachment.version}
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-500 font-mono">
                    SHA-256: {previewAttachment.hash}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadAttachment(previewAttachment)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => {
                    setPreviewAttachment(null);
                    setPreviewUrl(null);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer */}
            <div className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-4">
              {loadingPreview ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Loading document preview...</p>
                </div>
              ) : previewAttachment?.mime?.includes('pdf') ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  className="w-full h-full rounded-lg shadow-inner bg-white"
                >
                  <div className="p-8 text-center text-gray-600">
                    <p className="font-semibold text-sm">PDF preview not natively supported by this browser.</p>
                    <button
                      onClick={() => handleDownloadAttachment(previewAttachment)}
                      className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold"
                    >
                      Download to View
                    </button>
                  </div>
                </object>
              ) : previewAttachment?.mime?.includes('image') ? (
                <div className="max-w-full max-h-full flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={previewAttachment.name}
                    className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg border bg-white"
                  />
                </div>
              ) : (
                <div className="text-center p-12 bg-white rounded-xl shadow-sm border max-w-md">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h4 className="font-bold text-gray-900 text-sm">
                    {previewAttachment.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Direct in-app rendering is not available for format &lsquo;{previewAttachment.mime}&rsquo;. Please download the file to inspect the contents.
                  </p>
                  <button
                    onClick={() => handleDownloadAttachment(previewAttachment)}
                    className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Version Drawer */}
      {versionDrawerAttachment && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm truncate max-w-[280px]">
                    Version Lineage: {versionDrawerAttachment.name}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    21 CFR Part 11 audit history of clinical source amendments
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVersionDrawerAttachment(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Current Active Version */}
              <div className="p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">
                    Version {versionDrawerAttachment.version} (Active)
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    {formatBytes(versionDrawerAttachment.size)}
                  </span>
                </div>
                <div className="text-xs font-mono text-gray-600 break-all">
                  SHA-256: {versionDrawerAttachment.hash}
                </div>
                <div className="text-[11px] text-gray-500 pt-1 flex items-center justify-between">
                  <span>Uploaded by: {versionDrawerAttachment.uploadedByName || 'Specialist'}</span>
                  <span>{new Date(versionDrawerAttachment.updatedAt || versionDrawerAttachment.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Upload New Version Box */}
              <form onSubmit={handleUploadVersion} className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Plus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Upload Superceding Version (v{versionDrawerAttachment.version + 1})</span>
                </h4>

                <div>
                  <label htmlFor="newVerFile" className="text-[11px] font-bold text-gray-600 block mb-1">
                    Select Replacement File *
                  </label>
                  <input
                    id="newVerFile"
                    type="file"
                    required
                    onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                    className="w-full text-xs border rounded p-1.5 bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="newVerReason" className="text-[11px] font-bold text-gray-600 block mb-1">
                    Statutory Reason for Revision *
                  </label>
                  <input
                    id="newVerReason"
                    type="text"
                    required
                    placeholder="e.g. Added differential lab counts / official hospital discharge summary"
                    value={newVersionReason}
                    onChange={(e) => setNewVersionReason(e.target.value)}
                    className="w-full text-xs border rounded p-2 bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploadingVersion || !newVersionFile}
                  className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {uploadingVersion ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>Commit Version {versionDrawerAttachment.version + 1}</span>
                </button>
              </form>

              {/* Historical Versions */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Historical Version Archive
                </h4>

                {versionDrawerAttachment.versionHistory?.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                    No previous revisions. This is the initial clinical source upload (v1).
                  </p>
                ) : (
                  <div className="space-y-3">
                    {versionDrawerAttachment.versionHistory.map((vh, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-gray-200 rounded-xl text-xs space-y-1.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-800">
                            Version {vh.version} (Archived)
                          </span>
                          <span className="text-[11px] text-gray-500 font-mono">
                            {formatBytes(vh.size)}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-gray-500 break-all">
                          SHA-256: {vh.hash}
                        </div>
                        {vh.reason && (
                          <div className="text-[11px] text-gray-700 bg-gray-50 p-1.5 rounded">
                            <span className="font-semibold">Reason:</span> {vh.reason}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 pt-1 flex items-center justify-between">
                          <span>Archived on {new Date(vh.uploadedAt).toLocaleString()}</span>
                          <span>By: {vh.uploadedByName || 'System'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setVersionDrawerAttachment(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border rounded-lg hover:bg-gray-100"
              >
                Close Version History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

