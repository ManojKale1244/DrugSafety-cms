import React from 'react';
import { Sparkles, Stethoscope, FileText } from 'lucide-react';

/**
 * Origin Badge for Pharmacovigilance data elements:
 * - 'reported': Raw, verbatim information from primary reporter (patient/HCP).
 * - 'entered': PV Specialist validated and structured data.
 * - 'assessed': Medical reviewer causality and safety assessment.
 */
export default function DataOriginBadge({ origin = 'entered', size = 'sm' }) {
  const configs = {
    reported: {
      label: 'Reported',
      tooltip: 'Primary verbatim data received from original reporter',
      bg: 'bg-sky-50 text-sky-700 border-sky-200/80 ring-sky-500/10',
      dot: 'bg-sky-500',
      icon: FileText,
    },
    entered: {
      label: 'Entered',
      tooltip: 'Standardized and structured data entry by PV specialist',
      bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 ring-indigo-500/10',
      dot: 'bg-indigo-500',
      icon: Sparkles,
    },
    assessed: {
      label: 'Assessed',
      tooltip: 'Clinical assessment formulated by qualified medical reviewer',
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 ring-emerald-500/10',
      dot: 'bg-emerald-500',
      icon: Stethoscope,
    },
  };

  const current = configs[origin] || configs.entered;
  const Icon = current.icon;

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[9px] gap-1'
      : 'px-2 py-0.5 text-[10px] gap-1.5';

  return (
    <span
      title={current.tooltip}
      className={`inline-flex items-center rounded-md font-semibold border ring-1 select-none uppercase tracking-wider ${current.bg} ${sizeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      <Icon className="h-2.5 w-2.5" />
      <span>{current.label}</span>
    </span>
  );
}
