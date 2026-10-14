import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function CloseCaseModal({ isOpen, onClose, onConfirm, closureReadiness, closing = false }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isReady = closureReadiness?.isReady;
  const missing = closureReadiness?.missingRequirements || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isReady) {
      setError('Cannot close case: Outstanding requirements must be completed first.');
      return;
    }
    if (!reason.trim()) {
      setError('A formal closure justification is required.');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Close Safety Case</h3>
              <p className="text-xs text-slate-500">Archive case record & freeze all editing</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Readiness Checklist Status */}
        <div className="my-4">
          {isReady ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">All Workflow Requirements Complete</span>
                <span>Patient, Product, Reaction, Narrative, and Medical Causality have been fully verified.</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Outstanding Workflow Requirements ({missing.length}):</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5 pl-1">
                {missing.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Formal Case Closure Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setError('');
              }}
              placeholder="e.g. All review steps completed; regulatory expedited report transmitted to FDA/EMA; case closed."
              className={`w-full rounded-xl border p-3 text-xs focus:outline-none focus:ring-2 ${
                error
                  ? 'border-red-300 focus:ring-red-400/20'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500/20'
              }`}
            />
            {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 border border-slate-200">
            <strong>Important:</strong> Once closed, the case is locked as read-only. Further edits will be blocked per regulatory compliance standards.
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={closing}
              className="btn-secondary text-xs py-2 px-3.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isReady || closing}
              className={`btn-primary bg-slate-900 hover:bg-slate-800 text-xs py-2 px-4 shadow-sm flex items-center gap-1.5 ${
                !isReady ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              {closing ? 'Closing Case…' : 'Confirm & Close Case'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
