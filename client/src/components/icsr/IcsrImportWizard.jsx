import React, { useState } from 'react';
import {
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  User,
  Pill,
  Activity,
  FileText,
  Copy,
  Layers,
} from 'lucide-react';
import api from '../../services/api';

const SAMPLE_XML_ICSR = `<?xml version="1.0" encoding="UTF-8"?>
<ichicsr>
  <ichicsrmessageheader>
    <messagetype>ichicsr</messagetype>
    <messageformatversion>2.1-SYNTHETIC</messageformatversion>
    <messagesenderidentifier>HEALTH-AUTHORITY-GATEWAY</messagesenderidentifier>
    <messagereceiveridentifier>SPONSOR-SAFETY</messagereceiveridentifier>
    <messagedate>20260310</messagedate>
  </ichicsrmessageheader>
  <safetyreport>
    <safetyreportid>REG-SYNTH-2026-8801</safetyreportid>
    <receiptdate>2026-03-10</receiptdate>
    <primarysourcecountry>India</primarysourcecountry>
    <primarysource>
      <reportername>Dr. Rajesh Sharma</reportername>
      <qualification>Physician</qualification>
      <reportercountry>India</reportercountry>
      <contact>dr.sharma@aims-hospital.in</contact>
    </primarysource>
    <patient>
      <patientinitial>RS-901</patientinitial>
      <patientonsetage>58</patientonsetage>
      <patientonsetageunit>years</patientonsetageunit>
      <patientsex>1</patientsex>
      <patientweight>74</patientweight>
    </patient>
    <products>
      <product>
        <drugcharacterization>1</drugcharacterization>
        <medicinalproduct>Atorvastatin 40mg</medicinalproduct>
        <drugdosagetext>40mg Once Daily</drugdosagetext>
        <drugadministrationroute>Oral</drugadministrationroute>
        <drugindication>Hyperlipidemia</drugindication>
      </product>
    </products>
    <reactions>
      <reaction>
        <reactionverbatim>Severe generalized muscle myopathy and dark urine</reactionverbatim>
        <reactionmeddrapt>Rhabdomyolysis</reactionmeddrapt>
        <reactionmeddrasoc>Musculoskeletal and connective tissue disorders</reactionmeddrasoc>
        <reactionoutcome>2</reactionoutcome>
      </reaction>
    </reactions>
    <summary>
      <narrativeincludeclinical>58-year-old male developed severe muscle weakness, elevated creatine kinase (CK 18,000 U/L), and dark urine 3 weeks after starting Atorvastatin 40mg daily.</narrativeincludeclinical>
    </summary>
  </safetyreport>
</ichicsr>`;

export default function IcsrImportWizard({ isOpen, onClose, onImportSuccess }) {
  const [step, setStep] = useState(1); // 1: Input, 2: Validation & Preview, 3: Success
  const [rawPayload, setRawPayload] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [importResult, setImportResult] = useState(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setRawPayload(String(event.target?.result || ''));
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setRawPayload(SAMPLE_XML_ICSR);
  };

  const handleValidateAndPreview = async () => {
    if (!rawPayload.trim()) {
      setError('Please provide ICSR XML or JSON payload.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/icsr/preview', {
        payload: rawPayload.trim(),
        format: 'AUTO',
      });

      if (res.data.success) {
        setPreviewData(res.data);
        setStep(2);
      } else {
        setError(res.data.message || 'Validation failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to parse payload');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/icsr/import', {
        payload: rawPayload.trim(),
        format: previewData?.format || 'AUTO',
      });

      if (res.data.success) {
        setImportResult(res.data);
        setStep(3);
        if (onImportSuccess) {
          onImportSuccess(res.data.intake);
        }
      } else {
        setError(res.data.message || 'Failed to complete import');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Import error');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = previewData?.validation?.valid;
  const validationErrors = previewData?.validation?.errors || [];
  const duplicateWarning = previewData?.duplicateScreening?.hasDuplicateWarning;
  const matches = previewData?.duplicateScreening?.matches || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="icsr-wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 id="icsr-wizard-title" className="text-base font-bold text-slate-900">
                ICSR / E2B Inbound Import Wizard
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Step {step} of 3:</span>
                <span className="font-semibold text-slate-700">
                  {step === 1 && 'Upload / Paste Payload'}
                  {step === 2 && 'Schema Validation & Field Preview'}
                  {step === 3 && 'Intake Confirmation'}
                </span>
              </div>
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

        {/* ── Persistent Compliance Banner ──────────────────────── */}
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2.5">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
            <span className="text-xs text-amber-900 font-medium">
              <strong className="font-bold">Successful export ≠ regulatory compliance.</strong> Inbound ICSR messages
              are validated against educational synthetic E2B schemas and routed to the intake queue.
            </span>
          </div>
        </div>

        {/* Wizard Body */}
        <div className="p-6 space-y-4 max-h-[calc(85vh-200px)] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Validation or Ingestion Error</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* ── STEP 1: Upload / Input ──────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-600">
                  Upload an ICH E2B(R3) XML or JSON transmission file, or paste raw payload below.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-xs font-semibold hover:bg-brand-100 transition-colors"
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    <span>Load Synthetic Sample ICSR</span>
                  </button>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-colors shadow-xs">
                    <Upload className="h-3.5 w-3.5 text-slate-500" />
                    <span>Choose File (.xml, .json)</span>
                    <input
                      type="file"
                      accept=".xml,.json,text/xml,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={14}
                  value={rawPayload}
                  onChange={(e) => setRawPayload(e.target.value)}
                  placeholder="Paste <?xml version='1.0' ... ?> or { 'ichicsr': { ... } } here"
                  className="w-full font-mono text-xs rounded-xl border border-slate-300 p-3.5 bg-slate-900 text-slate-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* ── STEP 2: Validation & Mapped Preview ──────────────── */}
          {step === 2 && previewData && (
            <div className="space-y-5">
              {/* Validation Status Card */}
              <div
                className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
                  isValid ? 'border-emerald-200 bg-emerald-50/70' : 'border-rose-200 bg-rose-50/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  {isValid ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3
                      className={`text-sm font-bold ${
                        isValid ? 'text-emerald-950' : 'text-rose-950'
                      }`}
                    >
                      {isValid
                        ? 'Schema Validation Passed (4/4 Minimum Criteria Satisfied)'
                        : `Validation Incomplete (${validationErrors.length} Issue(s) Detected)`}
                    </h3>
                    <p
                      className={`text-xs mt-0.5 ${
                        isValid ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      Format detected: <strong className="uppercase">{previewData.format}</strong> | 
                      {isValid
                        ? ' Payload is compliant with synthetic E2B structure. Ready to import.'
                        : ' Rectify the missing fields or schema discrepancies before confirming.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Validation Errors List if any */}
              {validationErrors.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-white p-3 space-y-1.5">
                  <span className="text-xs font-bold text-rose-900 block mb-1">
                    Required Corrections:
                  </span>
                  {validationErrors.map((err, i) => (
                    <div
                      key={i}
                      className="text-xs text-rose-800 flex items-start gap-2 bg-rose-50 p-2 rounded-lg"
                    >
                      <span className="font-mono text-[10px] bg-rose-200/80 px-1.5 py-0.5 rounded text-rose-950 shrink-0">
                        {err.path}
                      </span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Duplicate Screening Banner */}
              <div
                className={`rounded-xl border p-3.5 flex items-start gap-3 ${
                  duplicateWarning
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <Layers
                  className={`h-5 w-5 shrink-0 mt-0.5 ${
                    duplicateWarning ? 'text-amber-600' : 'text-slate-400'
                  }`}
                />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        duplicateWarning ? 'text-amber-950' : 'text-slate-800'
                      }`}
                    >
                      Duplicate Screening Engine
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        duplicateWarning
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {duplicateWarning
                        ? `Potential Duplicate (${previewData.duplicateScreening.highestScore}% Match)`
                        : 'No Duplicate Detected'}
                    </span>
                  </div>
                  {duplicateWarning && (
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Matched against existing Case{' '}
                      <strong className="font-mono font-bold">
                        {previewData.duplicateScreening.matchedCaseNumber}
                      </strong>
                      . Screening will flag this incoming intake for dual review.
                    </p>
                  )}
                </div>
              </div>

              {/* Mapped Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Patient Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                    <User className="h-4 w-4 text-brand-600" />
                    <span>Mapped Patient Information</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Initial / Ref:</span>
                      <strong className="text-slate-900">
                        {previewData.mappedData.patient?.reference || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Age:</span>
                      <strong className="text-slate-900">
                        {previewData.mappedData.patient?.age
                          ? `${previewData.mappedData.patient.age} ${previewData.mappedData.patient.ageUnit || 'years'}`
                          : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Sex:</span>
                      <strong className="text-slate-900">
                        {previewData.mappedData.patient?.sex || 'Unknown'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Weight:</span>
                      <strong className="text-slate-900">
                        {previewData.mappedData.patient?.weight
                          ? `${previewData.mappedData.patient.weight} kg`
                          : 'N/A'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Reporter Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    <span>Primary Reporter Source</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px]">Name:</span>
                      <strong className="text-slate-900">
                        {previewData.mappedData.reporter?.name || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Qualification:</span>
                      <strong className="text-slate-900">
                        {previewData.mappedData.reporter?.qualification || 'Physician'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Country:</span>
                      <strong className="text-slate-900">
                        {previewData.mappedData.reporter?.country || 'India'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Suspect Products */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                    <Pill className="h-4 w-4 text-brand-600" />
                    <span>Suspected Product(s)</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Primary Suspect:</span>
                      <strong className="text-brand-900 text-sm">
                        {previewData.mappedData.suspectedProduct}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Reactions */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <span>Reported Reaction(s)</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Reported Event:</span>
                      <strong className="text-rose-900 text-sm">
                        {previewData.mappedData.reportedReaction}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Narrative */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1.5">
                <span className="text-xs font-bold text-slate-800 block">Clinical Narrative:</span>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {previewData.mappedData.narrative || 'No clinical narrative text provided.'}
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 3: Success Confirmation ────────────────────── */}
          {step === 3 && importResult && (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  ICSR Inbound Message Ingested Successfully
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  New intake ticket created and queued for safety triage. Message logged in the ICSR transmission ledger.
                </p>
              </div>

              <div className="max-w-md mx-auto rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Created Intake Number:</span>
                  <strong className="font-mono text-brand-700">
                    {importResult.intake?.intakeNumber}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transmission Message ID:</span>
                  <strong className="font-mono text-slate-800">
                    {importResult.message?.messageId}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duplicate Status:</span>
                  <span
                    className={`font-semibold ${
                      importResult.duplicateScreening?.hasDuplicateWarning
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {importResult.duplicateScreening?.hasDuplicateWarning
                      ? `Candidate duplicate identified (${importResult.duplicateScreening.highestScore}%)`
                      : 'Clean / Unique'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Payload</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {step === 3 ? 'Done' : 'Cancel'}
            </button>

            {step === 1 && (
              <button
                type="button"
                onClick={handleValidateAndPreview}
                disabled={loading || !rawPayload.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 transition-colors shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Validating Schema…</span>
                  </>
                ) : (
                  <>
                    <span>Validate & Preview</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={submitting || !isValid}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors shadow-xs ${
                  !isValid
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Creating Intake…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm & Create Intake</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

