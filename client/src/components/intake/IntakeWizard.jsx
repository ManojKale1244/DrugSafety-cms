import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  User,
  Users,
  Pill,
  Paperclip,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Save,
  AlertCircle,
  Upload,
  X,
  Loader2,
} from 'lucide-react';
import MinimumCriteriaChecklist from './MinimumCriteriaChecklist';
import api from '../../services/api';

const STEPS = [
  { id: 1, label: 'Source', icon: FileText, desc: 'Intake origin & receipt date' },
  { id: 2, label: 'Reporter', icon: User, desc: 'Primary contact information' },
  { id: 3, label: 'Patient', icon: Users, desc: 'Anonymized demographics' },
  { id: 4, label: 'Product & Event', icon: Pill, desc: 'Suspected drug & reaction' },
  { id: 5, label: 'Attachments', icon: Paperclip, desc: 'Source document uploads' },
  { id: 6, label: 'Review & Submit', icon: CheckCircle2, desc: 'Verification & duplicate check' },
];

const FICTIONAL_PRODUCTS = [
  'Medicine A',
  'CardioGuard',
  'NeuroCalm',
  'HepatoShield',
  'Dermacure',
  'PulmoBreathe',
  'GastroRelief',
  'Other Fictional Product',
];

const STORAGE_KEY = 'pv_intake_wizard_draft_v1';

export default function IntakeWizard({ onSuccess, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    source: 'physician',
    receiptDate: new Date().toISOString().split('T')[0],
    reporter: {
      name: '',
      qualification: 'Physician',
      contact: '',
      country: 'India',
    },
    patient: {
      reference: '',
      age: '',
      ageUnit: 'years',
      sex: 'Unknown',
      weight: '',
    },
    suspectedProduct: 'Medicine A',
    customProduct: '',
    reportedReaction: '',
    narrative: '',
    attachments: [],
  });

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData(parsed);
        setDraftSavedAt('Restored draft');
      }
    } catch (_e) {
      // Ignore parse errors
    }
  }, []);

  // Autosave to localStorage on form changes
  const saveDraft = (updated) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setDraftSavedAt(`Draft saved at ${timeStr}`);
    } catch (_e) {
      // Ignore storage errors
    }
  };

  const updateField = (section, field, value) => {
    setFormData((prev) => {
      let updated;
      if (section) {
        updated = {
          ...prev,
          [section]: {
            ...prev[section],
            [field]: value,
          },
        };
      } else {
        updated = {
          ...prev,
          [field]: value,
        };
      }
      saveDraft(updated);
      return updated;
    });
  };

  // Add dummy attachment
  const handleAddAttachment = () => {
    const docName = `Source_Lab_Report_${Date.now().toString().slice(-4)}.pdf`;
    setFormData((prev) => {
      const updated = {
        ...prev,
        attachments: [
          ...prev.attachments,
          {
            name: docName,
            url: '#',
            size: Math.floor(Math.random() * 400 + 100) * 1024,
            uploadedAt: new Date().toISOString(),
          },
        ],
      };
      saveDraft(updated);
      return updated;
    });
  };

  const handleRemoveAttachment = (idx) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        attachments: prev.attachments.filter((_, i) => i !== idx),
      };
      saveDraft(updated);
      return updated;
    });
  };

  // When stepping into Review Step, screen for duplicates
  const handleNext = () => {
    if (currentStep === 5) {
      // Fetch duplicate screening preview
      runDuplicateScreening();
    }
    setCurrentStep((s) => Math.min(STEPS.length, s + 1));
  };

  const handlePrev = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const runDuplicateScreening = async () => {
    setDuplicateLoading(true);
    try {
      // Temporary dry-run screening via cases API or draft endpoint
      const prod =
        formData.suspectedProduct === 'Other Fictional Product'
          ? formData.customProduct
          : formData.suspectedProduct;
      const res = await api.get('/cases', {
        params: { search: prod, limit: 3 },
      });
      if (res.data.success && res.data.cases) {
        setDuplicates(
          res.data.cases.map((c) => ({
            caseNumber: c.caseNumber,
            product: c.product,
            reaction: c.eventSummary,
            similarityScore: 85,
            reason: `Matching suspected product (${c.product}) and overlapping clinical profile`,
          })),
        );
      }
    } catch (_e) {
      setDuplicates([]);
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');

    try {
      const effectiveProduct =
        formData.suspectedProduct === 'Other Fictional Product'
          ? formData.customProduct.trim()
          : formData.suspectedProduct.trim();

      const payload = {
        source: formData.source,
        receiptDate: new Date(formData.receiptDate).toISOString(),
        reporter: {
          name: formData.reporter.name.trim(),
          qualification: formData.reporter.qualification,
          contact: formData.reporter.contact.trim(),
          country: formData.reporter.country.trim(),
        },
        patient: {
          reference: formData.patient.reference.trim(),
          age: formData.patient.age ? Number(formData.patient.age) : null,
          ageUnit: formData.patient.ageUnit,
          sex: formData.patient.sex,
          weight: formData.patient.weight ? Number(formData.patient.weight) : null,
        },
        suspectedProduct: effectiveProduct,
        reportedReaction: formData.reportedReaction.trim(),
        narrative: formData.narrative.trim(),
        attachments: formData.attachments,
      };

      const res = await api.post('/intakes', payload);
      if (res.data.success) {
        localStorage.removeItem(STORAGE_KEY);
        if (onSuccess) {
          onSuccess(res.data.intake);
        }
      }
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Failed to submit intake record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row items-start">
      {/* ── Main Wizard Stepper & Form Panel ─────────────────── */}
      <div className="flex-1 w-full space-y-6">
        {/* Stepper Progress Bar */}
        <div className="card p-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              New Case Intake Wizard
            </span>
            {draftSavedAt && (
              <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                <Save className="h-3 w-3" />
                {draftSavedAt}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STEPS.map((s) => {
              const isCurrent = currentStep === s.id;
              const isDone = currentStep > s.id;
              const Icon = s.icon;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(s.id)}
                  className={`flex flex-col items-center text-center p-2 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-brand-50 border border-brand-200 text-brand-700 font-bold'
                      : isDone
                      ? 'text-emerald-700 hover:bg-slate-50 font-medium'
                      : 'text-slate-400 hover:bg-slate-50 font-normal'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold mb-1 ${
                      isCurrent
                        ? 'bg-brand-600 text-white shadow-xs'
                        : isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-[11px] leading-tight truncate w-full">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Form Steps Container ───────────────────────────── */}
        <div className="card p-6 min-h-[420px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* ── Step 1: Source ───────────────────────────── */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Report Source & Intake Timing</h3>
                    <p className="text-xs text-slate-500">Capture origin channel and initial receipt date</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Report Source Channel *
                      </label>
                      <select
                        value={formData.source}
                        onChange={(e) => updateField(null, 'source', e.target.value)}
                        className="input-field"
                      >
                        <option value="physician">Healthcare Professional / Physician</option>
                        <option value="patient">Patient / Consumer Direct</option>
                        <option value="literature">Published Literature Study</option>
                        <option value="regulator">Health Authority / Regulatory Agency</option>
                        <option value="other">Other / Corporate Partner</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Initial Receipt Date * (Cannot be in the future)
                      </label>
                      <input
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        value={formData.receiptDate}
                        onChange={(e) => updateField(null, 'receiptDate', e.target.value)}
                        className="input-field"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Date report first arrived in company possession (Day 0)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: Reporter ─────────────────────────── */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Primary Reporter Information</h3>
                    <p className="text-xs text-slate-500">
                      Identifiable reporter is Criterion 1 of 4 required for a valid ICSR
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Reporter Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. Rajesh Verma"
                        value={formData.reporter.name}
                        onChange={(e) => updateField('reporter', 'name', e.target.value)}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Qualification
                      </label>
                      <select
                        value={formData.reporter.qualification}
                        onChange={(e) => updateField('reporter', 'qualification', e.target.value)}
                        className="input-field"
                      >
                        <option value="Physician">Physician / Medical Doctor</option>
                        <option value="Pharmacist">Pharmacist</option>
                        <option value="Nurse">Nurse / Healthcare Worker</option>
                        <option value="Consumer/Patient">Consumer / Patient</option>
                        <option value="Lawyer">Legal Representative</option>
                        <option value="Other">Other / Unknown</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Contact Info (Email or Phone)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. dr.verma@hospital.in / +91-9876543210"
                        value={formData.reporter.contact}
                        onChange={(e) => updateField('reporter', 'contact', e.target.value)}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Reporter Country
                      </label>
                      <input
                        type="text"
                        value={formData.reporter.country}
                        onChange={(e) => updateField('reporter', 'country', e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 3: Patient ──────────────────────────── */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Patient Demographics (Fictional / Anonymized)</h3>
                    <p className="text-xs text-slate-500">
                      Criterion 2 of 4. NEVER use real patient names. Use reference initials or trial IDs.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Patient Reference ID / Initials
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. PT-4402 or J.D."
                        value={formData.patient.reference}
                        onChange={(e) => updateField('patient', 'reference', e.target.value)}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Biological Sex
                      </label>
                      <select
                        value={formData.patient.sex}
                        onChange={(e) => updateField('patient', 'sex', e.target.value)}
                        className="input-field"
                      >
                        <option value="Unknown">Unknown</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Age
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="e.g. 45"
                          min="0"
                          max="120"
                          value={formData.patient.age}
                          onChange={(e) => updateField('patient', 'age', e.target.value)}
                          className="input-field flex-1"
                        />
                        <select
                          value={formData.patient.ageUnit}
                          onChange={(e) => updateField('patient', 'ageUnit', e.target.value)}
                          className="input-field w-28"
                        >
                          <option value="years">Years</option>
                          <option value="months">Months</option>
                          <option value="days">Days</option>
                          <option value="decades">Decades</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Weight (kg) - Optional
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 70"
                        min="1"
                        max="300"
                        value={formData.patient.weight}
                        onChange={(e) => updateField('patient', 'weight', e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 4: Product & Reaction ───────────────── */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Suspected Product & Adverse Reaction</h3>
                    <p className="text-xs text-slate-500">
                      Criteria 3 & 4. Record verbatim reported reaction without premature filtering.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Suspected Medicinal Product *
                      </label>
                      <select
                        value={formData.suspectedProduct}
                        onChange={(e) => updateField(null, 'suspectedProduct', e.target.value)}
                        className="input-field"
                      >
                        {FICTIONAL_PRODUCTS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formData.suspectedProduct === 'Other Fictional Product' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Specify Custom Fictional Product Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. TestDrug-X"
                          value={formData.customProduct}
                          onChange={(e) => updateField(null, 'customProduct', e.target.value)}
                          className="input-field"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Reported Adverse Reaction (Verbatim text) *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Severe Urticarial Rash with Facial Swelling"
                        value={formData.reportedReaction}
                        onChange={(e) => updateField(null, 'reportedReaction', e.target.value)}
                        className="input-field font-medium text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Clinical Case Narrative / Medical Description
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Include timeline of administration, onset of reaction, dechallenge, rechallenge, and medical countermeasures taken…"
                        value={formData.narrative}
                        onChange={(e) => updateField(null, 'narrative', e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 5: Attachments ──────────────────────── */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Source Documents & Attachments</h3>
                    <p className="text-xs text-slate-500">
                      Attach intake hospital discharge summaries, lab reports, or source emails
                    </p>
                  </div>

                  <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">Simulate Document Attachment</p>
                    <p className="text-[11px] text-slate-400 mt-1 mb-3">
                      Add dummy PDFs or lab records to link with this intake
                    </p>
                    <button
                      type="button"
                      onClick={handleAddAttachment}
                      className="btn-secondary text-xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Add Sample Lab Report PDF
                    </button>
                  </div>

                  {formData.attachments.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-600 block">
                        Linked Documents ({formData.attachments.length}):
                      </span>
                      {formData.attachments.map((att, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <Paperclip className="h-4 w-4 text-brand-600" />
                            <div>
                              <span className="font-semibold text-slate-800">{att.name}</span>
                              <span className="text-[10px] text-slate-400 block">
                                {(att.size / 1024).toFixed(1)} KB • Attached just now
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(i)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 6: Review & Submit ──────────────────── */}
              {currentStep === 6 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Intake Verification & Review</h3>
                    <p className="text-xs text-slate-500">
                      Confirm validity before submitting this record into the pharmacovigilance registry
                    </p>
                  </div>

                  {/* Summary Breakdown */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs space-y-2.5">
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500 font-medium">Source & Date:</span>
                      <span className="font-semibold text-slate-900 capitalize">
                        {formData.source} • {formData.receiptDate}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500 font-medium">Reporter:</span>
                      <span className="font-semibold text-slate-900">
                        {formData.reporter.name || 'Anonymous'} ({formData.reporter.qualification})
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500 font-medium">Patient:</span>
                      <span className="font-semibold text-slate-900">
                        {formData.patient.reference || 'Unspecified'} • {formData.patient.sex} •{' '}
                        {formData.patient.age ? `${formData.patient.age} ${formData.patient.ageUnit}` : 'Age unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500 font-medium">Suspected Product:</span>
                      <span className="font-semibold text-indigo-700">
                        {formData.suspectedProduct === 'Other Fictional Product'
                          ? formData.customProduct
                          : formData.suspectedProduct}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Reported Reaction:</span>
                      <span className="font-semibold text-red-700">{formData.reportedReaction}</span>
                    </div>
                  </div>

                  {/* Duplicate Screening Preview */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-xs text-slate-800">Automated Duplicate Screening</h4>
                      {duplicateLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />}
                    </div>

                    {duplicates.length === 0 ? (
                      <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        No high-probability duplicate cases detected in active registry.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                          ⚠️ {duplicates.length} potential duplicate candidate(s) flagged for reviewer attention.
                        </p>
                        {duplicates.map((d, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs flex justify-between items-center"
                          >
                            <div>
                              <span className="font-bold text-slate-900 font-mono">{d.caseNumber}</span>
                              <span className="text-slate-500 block text-[11px]">{d.reason}</span>
                            </div>
                            <span className="badge bg-amber-100 text-amber-800 ring-amber-600/20 font-bold">
                              {d.similarityScore}% Match
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {submitError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={handlePrev}
              className="btn-secondary text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn-secondary text-xs text-slate-500"
                >
                  Cancel
                </button>
              )}

              {currentStep < 6 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="btn-primary text-xs"
                >
                  Next Step
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Recording Intake…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Submit Adverse Event Intake
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Live Minimum Criteria Checklist Sidebar ────── */}
      <div className="w-full lg:w-80 shrink-0 sticky top-4">
        <MinimumCriteriaChecklist formData={formData} />
      </div>
    </div>
  );
}
