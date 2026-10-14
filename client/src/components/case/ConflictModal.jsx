import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RotateCcw, X } from 'lucide-react';

export default function ConflictModal({ isOpen, currentServerCase, onReload, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-red-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-red-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Concurrent Edit Conflict</h3>
              <p className="text-xs text-red-600 font-medium">Optimistic Concurrency Control (Version Conflict)</p>
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

        <div className="my-4 space-y-3 text-xs text-slate-600">
          <p className="leading-relaxed">
            Another team member has updated and saved this case while you had it open. To prevent accidental overwriting of clinical data, your local changes cannot be saved directly over their edits.
          </p>

          {currentServerCase && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <span className="font-bold text-slate-800 block text-xs">
                Current Server Record (v{currentServerCase.version}):
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Status:</span>
                  <span className="font-semibold text-slate-800">{currentServerCase.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Priority:</span>
                  <span className="font-semibold text-slate-800">{currentServerCase.priority}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Product:</span>
                  <span className="font-semibold text-slate-800">{currentServerCase.product}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Assigned To:</span>
                  <span className="font-semibold text-slate-800">
                    {currentServerCase.assignedTo?.name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs py-2 px-3.5"
          >
            Keep Reviewing Form
          </button>
          <button
            type="button"
            onClick={onReload}
            className="btn-primary bg-red-600 hover:bg-red-700 text-xs py-2 px-4 shadow-sm flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reload Latest from Server
          </button>
        </div>
      </motion.div>
    </div>
  );
}
