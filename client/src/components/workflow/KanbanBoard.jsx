import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Clock,
  User,
  Eye,
  Sliders,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import api from '../../services/api';
import { normalizeStageKey, CANONICAL_STAGES } from './StageStepper';
import CaseRouteModal from './CaseRouteModal';

export default function KanbanBoard({
  cases = [],
  onCaseRouted,
  onNavigateTab,
}) {
  const [draggedCase, setDraggedCase] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [routingId, setRoutingId] = useState(null);
  const [routeErrorToast, setRouteErrorToast] = useState(null);

  // Modal routing state
  const [modalCase, setModalCase] = useState(null);
  const [modalTargetStage, setModalTargetStage] = useState(null);

  // Group cases by normalized canonical stage
  const casesByStage = CANONICAL_STAGES.reduce((acc, stage) => {
    acc[stage.id] = [];
    return acc;
  }, {});

  cases.forEach((c) => {
    const stageKey = normalizeStageKey(c.status);
    if (casesByStage[stageKey]) {
      casesByStage[stageKey].push(c);
    } else {
      casesByStage['NEW'] = casesByStage['NEW'] || [];
      casesByStage['NEW'].push(c);
    }
  });

  const handleDragStart = (e, caseItem) => {
    setDraggedCase(caseItem);
    e.dataTransfer.setData('text/plain', caseItem._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedCase(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== stageId) {
      setDragOverCol(stageId);
    }
  };

  const handleDragLeave = (e, stageId) => {
    if (dragOverCol === stageId) {
      setDragOverCol(null);
    }
  };

  const handleDrop = async (e, targetStageId) => {
    e.preventDefault();
    setDragOverCol(null);

    if (!draggedCase) return;
    const currentStageKey = normalizeStageKey(draggedCase.status);

    if (currentStageKey === targetStageId) {
      return; // Dropped in same stage
    }

    const c = draggedCase;
    setDraggedCase(null);
    setRoutingId(c._id);
    setRouteErrorToast(null);

    try {
      // First attempt direct route
      const res = await api.post(`/cases/${c._id}/route`, {
        targetStage: targetStageId,
        reason: 'Routed via Kanban workspace',
      });

      if (res.data.success) {
        onCaseRouted?.(res.data);
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || `Cannot route case ${c.caseNumber} to ${targetStageId}`;
      setRouteErrorToast({
        caseNumber: c.caseNumber,
        message: errMsg,
      });

      // Automatically open the routing modal so the user can inspect unmet checks or fill mandatory reason
      setModalCase(c);
      setModalTargetStage(targetStageId);

      // Dismiss error toast after 7s
      setTimeout(() => {
        setRouteErrorToast(null);
      }, 7000);
    } finally {
      setRoutingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Route Error Notification Toast */}
      {routeErrorToast && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold">Workflow Rule Rejection:</span>{' '}
              <span>{routeErrorToast.message}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRouteErrorToast(null)}
            className="text-rose-600 hover:text-rose-900 font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Kanban Columns Grid */}
      <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
        {CANONICAL_STAGES.map((stage) => {
          const stageCases = casesByStage[stage.id] || [];
          const isOver = dragOverCol === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={(e) => handleDragLeave(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage.id)}
              className={`flex flex-col w-72 shrink-0 rounded-2xl border transition-all ${
                isOver
                  ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20 shadow-md'
                  : 'border-slate-200/90 bg-slate-50/70'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-3 border-b border-slate-200/80 bg-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900 tracking-tight">
                    {stage.label}
                  </span>
                  <span className="badge font-mono text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                    {stageCases.length}
                  </span>
                </div>
              </div>

              {/* Column Body / Cards list */}
              <div className="p-2 space-y-2 flex-1 min-h-[360px] max-h-[680px] overflow-y-auto custom-scrollbar">
                {stageCases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-36 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl p-3">
                    <span className="text-[11px] font-medium">No cases in this stage</span>
                    <span className="text-[10px] text-slate-400 mt-1">Drag cases here to route</span>
                  </div>
                ) : (
                  stageCases.map((c) => {
                    const isBeingRouted = routingId === c._id;

                    return (
                      <div
                        key={c._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, c)}
                        onDragEnd={handleDragEnd}
                        className={`rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:shadow-sm hover:border-brand-300 transition-all cursor-grab active:cursor-grabbing space-y-2.5 ${
                          isBeingRouted ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        {/* Card Header: Case #, Seriousness, Priority */}
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/cases/${c.caseNumber}`}
                            className="font-mono font-bold text-xs text-brand-600 hover:text-brand-800 hover:underline"
                          >
                            {c.caseNumber}
                          </Link>

                          <div className="flex items-center gap-1">
                            {c.seriousness === 'Serious' && (
                              <span className="badge bg-red-50 text-red-700 text-[9px] font-bold ring-red-600/20 px-1.5 py-0.2">
                                Serious
                              </span>
                            )}
                            <span
                              className={`badge text-[9px] font-semibold uppercase px-1.5 py-0.2 ${
                                c.priority === 'urgent'
                                  ? 'bg-rose-50 text-rose-700 ring-rose-600/20 font-bold'
                                  : c.priority === 'high'
                                  ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {c.priority || 'med'}
                            </span>
                          </div>
                        </div>

                        {/* Product & Reaction summary */}
                        <div className="space-y-1 text-xs">
                          <div className="text-slate-800 font-semibold truncate" title={c.product || c.caseProducts?.[0]?.productName}>
                            {c.product || c.caseProducts?.[0]?.productName || 'No Product'}
                          </div>
                          <div
                            className="text-slate-500 text-[11px] truncate flex items-center gap-1"
                            title={c.eventSummary || c.reactions?.[0]?.verbatim}
                          >
                            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                            <span>{c.eventSummary || c.reactions?.[0]?.verbatim || 'No Reaction'}</span>
                          </div>
                        </div>

                        {/* Footer: Assignee & Action */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-600">
                              {c.assignedTo?.name?.slice(0, 1) || 'U'}
                            </div>
                            <span className="truncate max-w-[80px] text-slate-600 font-medium">
                              {c.assignedTo?.name || 'Unassigned'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setModalCase(c);
                                setModalTargetStage(null);
                              }}
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-brand-700 hover:bg-slate-100 transition-colors"
                              title="Route case via modal"
                            >
                              <Sliders className="h-3 w-3" />
                              <span>Route</span>
                            </button>

                            <Link
                              to={`/cases/${c.caseNumber}`}
                              className="p-1 text-slate-400 hover:text-brand-600 transition-colors"
                              title="View case details"
                            >
                              <Eye className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Case Route Modal */}
      {modalCase && (
        <CaseRouteModal
          isOpen={true}
          onClose={() => {
            setModalCase(null);
            setModalTargetStage(null);
          }}
          caseId={modalCase._id}
          caseNumber={modalCase.caseNumber}
          initialTargetStage={modalTargetStage}
          onRouteSuccess={(data) => {
            onCaseRouted?.(data);
            setModalCase(null);
            setModalTargetStage(null);
          }}
          onNavigateTab={onNavigateTab}
        />
      )}
    </div>
  );
}

