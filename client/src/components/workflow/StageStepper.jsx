import React from 'react';
import { Check, ArrowRight, GitCommit, ChevronRight } from 'lucide-react';

export const CANONICAL_STAGES = [
  { id: 'NEW', label: 'New' },
  { id: 'DATA_ENTRY', label: 'Data Entry' },
  { id: 'MEDICAL_CODING', label: 'Medical Coding' },
  { id: 'MEDICAL_REVIEW', label: 'Medical Review' },
  { id: 'QUALITY_REVIEW', label: 'Quality Review' },
  { id: 'REGULATORY_REPORTING', label: 'Reporting' },
  { id: 'FINAL_REVIEW', label: 'Final Review' },
  { id: 'CLOSED', label: 'Closed' },
];

export function normalizeStageKey(stage) {
  if (!stage) return 'NEW';
  const s = String(stage).toUpperCase();
  const map = {
    NEW: 'NEW',
    INTAKE: 'NEW',
    TRIAGE: 'DATA_ENTRY',
    DATA_ENTRY: 'DATA_ENTRY',
    MEDICAL_CODING: 'MEDICAL_CODING',
    CODING: 'MEDICAL_CODING',
    MEDICAL_REVIEW: 'MEDICAL_REVIEW',
    QUALITY_REVIEW: 'QUALITY_REVIEW',
    QA: 'QUALITY_REVIEW',
    REGULATORY_REPORTING: 'REGULATORY_REPORTING',
    READY_FOR_SUBMISSION: 'REGULATORY_REPORTING',
    SUBMISSION: 'REGULATORY_REPORTING',
    SUBMITTED: 'FINAL_REVIEW',
    FINAL_REVIEW: 'FINAL_REVIEW',
    COMPLETED: 'FINAL_REVIEW',
    CLOSED: 'CLOSED',
    ARCHIVED: 'CLOSED',
  };
  return map[s] || s;
}

export default function StageStepper({
  currentStage = 'NEW',
  onOpenRouteModal,
  readOnly = false,
}) {
  const normalizedCurrent = normalizeStageKey(currentStage);
  const currentIndex = CANONICAL_STAGES.findIndex((s) => s.id === normalizedCurrent);
  const activeIdx = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 sm:p-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <GitCommit className="h-4 w-4 text-brand-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
            Workflow Stage Stepper
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            (Step {activeIdx + 1} of {CANONICAL_STAGES.length})
          </span>
        </div>

        {!readOnly && onOpenRouteModal && (
          <button
            type="button"
            onClick={onOpenRouteModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-brand-700 active:bg-brand-800 transition-colors self-start sm:self-auto"
          >
            <span>Route Case</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Stepper bar */}
      <div className="flex items-center overflow-x-auto pb-1 scrollbar-none">
        <ol className="flex items-center w-full min-w-[620px] text-xs">
          {CANONICAL_STAGES.map((stage, idx) => {
            const isCompleted = idx < activeIdx;
            const isCurrent = idx === activeIdx;
            const isUpcoming = idx > activeIdx;

            return (
              <li
                key={stage.id}
                className={`flex items-center flex-1 ${
                  idx === CANONICAL_STAGES.length - 1 ? 'flex-none' : ''
                }`}
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : isCurrent
                        ? 'bg-brand-600 text-white ring-4 ring-brand-100 shadow-xs'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] whitespace-nowrap ${
                      isCurrent
                        ? 'font-bold text-brand-900'
                        : isCompleted
                        ? 'font-semibold text-slate-700'
                        : 'font-medium text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>

                {idx < CANONICAL_STAGES.length - 1 && (
                  <div
                    className={`h-0.5 w-full mx-2 rounded-full transition-colors ${
                      idx < activeIdx ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

