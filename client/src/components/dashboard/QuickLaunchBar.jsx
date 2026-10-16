import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ArrowRight, FolderOpen, AlertCircle } from 'lucide-react';
import Can from '../auth/Can';

export default function QuickLaunchBar({ onNewIntake }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [quickError, setQuickError] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setQuickError('');
    const clean = searchTerm.trim().toUpperCase();
    if (!clean) return;

    if (clean.startsWith('CASE-')) {
      navigate(`/cases/${clean}`);
    } else {
      navigate(`/cases?search=${encodeURIComponent(clean)}`);
    }
  };

  return (
    <div className="card p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md border-slate-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Quick Launch Input */}
        <form onSubmit={handleSearchSubmit} className="w-full lg:max-w-xl">
          <label htmlFor="quick-launch-input" className="sr-only">
            Case Quick Launch
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              id="quick-launch-input"
              type="search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setQuickError('');
              }}
              placeholder="Case Quick Launch — enter CASE-1001, product name, or adverse reaction…"
              className="w-full rounded-xl border border-white/10 bg-white/10 pl-10 pr-24 py-2.5 text-xs text-white placeholder:text-slate-400 focus:border-brand-400 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-brand-400/20 backdrop-blur-md transition-all font-sans"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 shadow-sm transition-colors flex items-center gap-1"
            >
              Launch <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {quickError && (
            <p className="mt-1 text-[11px] text-red-300 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {quickError}
            </p>
          )}
        </form>

        {/* Right: Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <Can permission="case.create">
            <button
              type="button"
              onClick={onNewIntake || (() => navigate('/intakes?action=create'))}
              className="btn-primary bg-indigo-600 hover:bg-indigo-500 text-xs py-2 px-3.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Adverse Intake
            </button>
          </Can>

          <button
            type="button"
            onClick={() => navigate('/cases')}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <FolderOpen className="h-3.5 w-3.5 text-brand-400" />
            Browse Cases
          </button>
        </div>
      </div>
    </div>
  );
}
