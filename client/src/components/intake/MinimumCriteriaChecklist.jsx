import React from 'react';
import { CheckCircle2, XCircle, ShieldAlert, ShieldCheck, Info } from 'lucide-react';

/**
 * Live ICH E2D Minimum Criteria Checklist Component.
 * Evaluates in real-time whether an intake has the 4 required safety criteria:
 * 1. Identifiable Reporter
 * 2. Identifiable Patient
 * 3. Suspected Medicinal Product
 * 4. Reported Adverse Reaction
 */
export default function MinimumCriteriaChecklist({ formData = {} }) {
  // 1. Identifiable Reporter
  const hasReporterName = !!formData.reporter?.name?.trim();
  const hasReporterContact = !!formData.reporter?.contact?.trim();
  const hasReporterQual =
    !!formData.reporter?.qualification?.trim() && formData.reporter?.qualification !== 'Unknown';
  const hasReporter = hasReporterName || hasReporterContact || hasReporterQual;

  // 2. Identifiable Patient
  const hasPatientRef = !!formData.patient?.reference?.trim();
  const hasPatientAge = formData.patient?.age != null && !isNaN(formData.patient.age);
  const hasPatientSex = !!formData.patient?.sex && formData.patient?.sex !== 'Unknown';
  const hasPatient = hasPatientRef || hasPatientAge || hasPatientSex;

  // 3. Suspect Product
  const hasProduct = !!formData.suspectedProduct?.trim();

  // 4. Reported Event / Reaction
  const hasReaction = !!formData.reportedReaction?.trim();

  const criteria = [
    {
      id: 'reporter',
      label: 'Identifiable Reporter',
      valid: hasReporter,
      details: hasReporter
        ? formData.reporter?.name || formData.reporter?.qualification || 'Contact provided'
        : 'Requires Name, Contact, or Qualification',
    },
    {
      id: 'patient',
      label: 'Identifiable Patient',
      valid: hasPatient,
      details: hasPatient
        ? formData.patient?.reference || (hasPatientAge ? `${formData.patient.age} yrs` : formData.patient?.sex)
        : 'Requires Reference ID, Age, or Sex',
    },
    {
      id: 'product',
      label: 'Suspected Medicinal Product',
      valid: hasProduct,
      details: hasProduct ? formData.suspectedProduct : 'Select or enter suspected product',
    },
    {
      id: 'reaction',
      label: 'Reported Adverse Reaction',
      valid: hasReaction,
      details: hasReaction ? formData.reportedReaction : 'Enter verbatim reaction description',
    },
  ];

  const validCount = criteria.filter((c) => c.valid).length;
  const isComplete = validCount === 4;
  const percentage = (validCount / 4) * 100;

  return (
    <div className="card p-5 bg-gradient-to-br from-white to-slate-50/80 border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <ShieldAlert className="h-4 w-4" />
            </div>
          )}
          <div>
            <h4 className="font-bold text-slate-900 text-sm">ICH E2D Minimum Criteria</h4>
            <p className="text-[11px] text-slate-400">Valid Individual Case Safety Report (ICSR)</p>
          </div>
        </div>

        <span
          className={`badge font-bold text-xs ${
            isComplete
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
              : 'bg-amber-50 text-amber-700 ring-amber-600/20'
          }`}
        >
          {validCount} of 4 Complete
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isComplete ? 'bg-emerald-500' : 'bg-brand-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Criteria Checklist */}
      <div className="space-y-2.5">
        {criteria.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-all text-xs ${
              item.valid
                ? 'border-emerald-200/80 bg-emerald-50/40 text-emerald-950'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {item.valid ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <span className="font-semibold block">{item.label}</span>
              <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                {item.details}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Regulatory Rule Callout */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 flex items-start gap-2">
        <Info className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {isComplete
            ? '✓ All four criteria satisfied. This intake can be formally converted into an active case (DS-YYYY-NNNNN).'
            : 'Per global pharmacovigilance regulations, cases cannot be provisioned until all four criteria are confirmed.'}
        </p>
      </div>
    </div>
  );
}
