import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  FileText,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import api from '../../services/api';

/**
 * Modal to export case to synthetic E2B ICSR format (JSON or XML).
 * Includes educational compliance disclaimer and schema validation results.
 */
export default function IcsrExportModal({ isOpen, onClose, caseId, caseNumber }) {
  const [format, setFormat] = useState('JSON');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && caseId) {
      loadExport(format);
    } else {
      setExportData(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen, caseId, format]);

  const loadExport = async (fmt) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/icsr/export/${caseId}`, { format: fmt });
      if (res.data.success) {
        setExportData(res.data);
      } else {
        setError(res.data.message || 'Failed to generate ICSR message');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error generating export');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!exportData?.payload) return;
    navigator.clipboard.writeText(exportData.payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!exportData?.payload) return;
    const ext = format.toLowerCase();
    const mimeType = ext === 'xml' ? 'application/xml' : 'application/json';
    const blob = new Blob([exportData.payload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${caseNumber || 'case'}-e2b-synthetic.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const isValid = exportData?.validation?.valid;
  const validationErrors = exportData?.validation?.errors || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="icsr-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <h2 id="icsr-export-title" className="text-base font-bold text-slate-900">
                ICSR / E2B(R3) Message Export
              </h2>
              <p className="text-xs text-slate-500 font-mono">Case: {caseNumber || caseId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Persistent Regulatory Compliance Notice ───────────── */}
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold uppercase tracking-wider text-amber-950 block mb-0.5">
                Successful export ≠ regulatory compliance.
              </span>
              This module operates in synthetic educational demonstration mode with ICH E2B(R3)-aligned data
              structures. Valid transmission here does not constitute official regulatory submission or legal release.
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[calc(85vh-200px)] overflow-y-auto">
          {/* Format Selector & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFormat('JSON')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  format === 'JSON'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>JSON (E2B Object)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('XML')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  format === 'XML'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" />
                <span>XML (E2B(R3) Tagged)</span>
              </button>
            </div>

            {exportData && (
              <div className="flex items-center gap-2">
                {isValid ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Schema Valid (Synthetic)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {validationErrors.length} Schema Issue(s)
                  </span>
                )}
                {exportData.messageId && (
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    {exportData.messageId}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Validation Errors Box if any */}
          {validationErrors.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span>Schema Validation Discrepancies ({validationErrors.length})</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {validationErrors.map((err, i) => (
                  <div
                    key={i}
                    className="text-xs text-rose-800 bg-white/80 p-2 rounded-lg border border-rose-100 flex items-start gap-2"
                  >
                    <span className="font-mono text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded shrink-0">
                      {err.path}
                    </span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Code Viewer */}
          <div className="relative rounded-xl border border-slate-200 bg-slate-900 text-slate-100 shadow-inner overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-2 text-xs text-slate-400 font-mono">
              <span>{format === 'XML' ? 'ichicsr.xml' : 'ichicsr.json'}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!exportData?.payload || loading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Payload</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!exportData?.payload || loading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-400 gap-2.5 text-xs">
                <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                <span>Generating {format} ICSR payload…</span>
              </div>
            ) : (
              <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto max-h-[380px] text-slate-200 whitespace-pre">
                {exportData?.payload || 'No payload available.'}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50">
          <span className="text-[11px] text-slate-400 font-mono">
            Sender: SPONSOR-SAFETY ➔ Receiver: HEALTH-AUTHORITY-GATEWAY
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

