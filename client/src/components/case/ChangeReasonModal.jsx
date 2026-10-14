import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ShieldAlert } from 'lucide-react';

const COMMON_REASONS = [
  'Receipt of clinical follow-up data from reporter',
  'Correction of typographical or data entry error',
  'Medical reviewer causality reassessment',
  'Regulatory authority query response',
  'Quality review compliance adjustment',
  'Coding term refinement (MedDRA)',
];

export default function ChangeReasonModal({ isOpen, onClose, onConfirm, changesSummary = [] }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A reason for change is strictly required under 21 CFR Part 11 audit compliance.');
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Reason for Change Required</h3>
              <p className="text-xs text-slate-500">21 CFR Part 11 / GxP Electronic Audit Trail</p>
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

        {changesSummary.length > 0 && (
          <div className="my-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 text-xs text-slate-700">
            <span className="font-semibold block mb-1 text-slate-900">Pending Field Modifications:</span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600">
              {changesSummary.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select standard justification or write a custom reason:
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setReason(r);
                    setError('');
                  }}
                  className={`text-[11px] rounded-lg px-2.5 py-1 text-left border transition-all ${
                    reason === r
                      ? 'bg-brand-50 border-brand-300 text-brand-800 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setError('');
              }}
              placeholder="Provide a clinical or regulatory justification for this change…"
              className={`w-full rounded-xl border p-3 text-xs focus:outline-none focus:ring-2 ${
                error
                  ? 'border-red-300 focus:ring-red-400/20'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500/20'
              }`}
            />
            {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs py-2 px-3.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-xs py-2 px-4 shadow-sm"
            >
              Sign & Save Edits
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
