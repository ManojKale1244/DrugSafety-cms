import mongoose from 'mongoose';
import { Case } from '../models/Case.js';
import { MedicalAssessment } from '../models/MedicalAssessment.js';
import { ChecklistTemplate } from '../models/ChecklistTemplate.js';
import { QualityReview } from '../models/QualityReview.js';
import { recordAudit } from '../utils/audit.js';
import * as workflowService from './workflow.service.js';

export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

export const STANDARD_CHECKLIST_ITEMS = [
  {
    itemId: 'CH-DEMO-01',
    category: 'Demographics & Administrative',
    title: 'Patient Identification & Demographics Completeness',
    description: 'Verify identifiable patient criteria: reference code, age, sex, and consistency of medical history.',
    severity: 'CRITICAL',
    targetField: 'patient',
    isRequired: true,
  },
  {
    itemId: 'CH-DEMO-02',
    category: 'Demographics & Administrative',
    title: 'Reporter Qualification & Contact Verification',
    description: 'Confirm primary reporter name, professional qualification (e.g. Physician/Pharmacist), and country.',
    severity: 'MAJOR',
    targetField: 'reporter',
    isRequired: true,
  },
  {
    itemId: 'CH-PROD-01',
    category: 'Medicinal Products',
    title: 'Suspect Product Details & Dosage Specification',
    description: 'Ensure suspect product trade/generic name, formulation, dose, route, and therapy dates are complete.',
    severity: 'CRITICAL',
    targetField: 'products',
    isRequired: true,
  },
  {
    itemId: 'CH-PROD-02',
    category: 'Medicinal Products',
    title: 'Concomitant Medications & Drug Interactions',
    description: 'Verify concomitant drugs are distinguished from suspect products with proper roles.',
    severity: 'MINOR',
    targetField: 'products',
    isRequired: false,
  },
  {
    itemId: 'CH-EVENT-01',
    category: 'Adverse Reactions & Events',
    title: 'Adverse Event Verbatim & Chronological Timeline',
    description: 'Confirm verbatim reported event accurately mirrors reporter source statements and onset chronology.',
    severity: 'CRITICAL',
    targetField: 'reactions',
    isRequired: true,
  },
  {
    itemId: 'CH-EVENT-02',
    category: 'Adverse Reactions & Events',
    title: 'Seriousness Criteria & Clinical Outcome Verification',
    description: 'Validate seriousness flags (Death, Hospitalization, Disability) and clinical resolution outcome.',
    severity: 'CRITICAL',
    targetField: 'reactions',
    isRequired: true,
  },
  {
    itemId: 'CH-CODE-01',
    category: 'Medical Coding',
    title: 'MedDRA Preferred Term & Lowest Level Term Precision',
    description: 'Ensure 100% of reported reactions are coded to MedDRA PT without uncoded terms or ambiguity.',
    severity: 'CRITICAL',
    targetField: 'coding',
    isRequired: true,
  },
  {
    itemId: 'CH-MED-01',
    category: 'Medical Review & Assessment',
    title: 'Physician Causality Assessment & Formal Signature',
    description: 'Confirm Medical Reviewer completed product-reaction causality, listedness, and signed assessment.',
    severity: 'CRITICAL',
    targetField: 'assessment',
    isRequired: true,
  },
  {
    itemId: 'CH-NARR-01',
    category: 'Clinical Narrative',
    title: 'Clinical Narrative Coherence & 21 CFR Part 11 Integrity',
    description: 'Ensure narrative contains a clear chronological synopsis of exposure, event onset, and clinical dechallenge.',
    severity: 'MAJOR',
    targetField: 'narrative',
    isRequired: true,
  },
  {
    itemId: 'CH-DOC-01',
    category: 'Source Documentation',
    title: 'Source Document & Diagnostic Report Attachments',
    description: 'Verify hospital discharge summaries, lab reports, or source forms are attached when required.',
    severity: 'MAJOR',
    targetField: 'documents',
    isRequired: true,
  },
];

/**
 * Retrieves or initializes the default quality review checklist template.
 */
export async function getOrCreateDefaultChecklistTemplate() {
  let template = await ChecklistTemplate.findOne({ isDefault: true, isActive: true });
  if (!template) {
    template = await ChecklistTemplate.create({
      name: 'Standard ICSR Quality Review Checklist',
      version: 1,
      isDefault: true,
      isActive: true,
      description: 'ICH E2D and 21 CFR Part 11 compliant standard ICSR Quality Assurance checklist',
      items: STANDARD_CHECKLIST_ITEMS,
    });
  }
  return template;
}

/**
 * Evaluates all automated regulatory validation checks on a case.
 */
export function runAutoChecks(caseDoc, latestAssessment) {
  const checks = [];
  const now = new Date();

  // 1. REQUIRED FIELDS CHECK (CRITICAL)
  const hasPatient = !!(
    caseDoc.patient?.reference ||
    caseDoc.patient?.age != null ||
    (caseDoc.patient?.sex && caseDoc.patient.sex !== 'Unknown') ||
    caseDoc.patientAge != null
  );
  const hasReporter = !!(caseDoc.reporter?.name && caseDoc.reporter.name.trim());
  const hasProduct = !!((caseDoc.caseProducts && caseDoc.caseProducts.length > 0) || caseDoc.product);
  const hasReaction = !!((caseDoc.reactions && caseDoc.reactions.length > 0) || caseDoc.eventSummary);
  const hasNarrative = !!(caseDoc.narrative && caseDoc.narrative.trim().length > 0);

  const missingFields = [];
  if (!hasPatient) missingFields.push('Patient Demographics');
  if (!hasReporter) missingFields.push('Reporter Identification');
  if (!hasProduct) missingFields.push('Suspect Product');
  if (!hasReaction) missingFields.push('Adverse Reaction');
  if (!hasNarrative) missingFields.push('Clinical Narrative');

  checks.push({
    key: 'REQ_FIELDS',
    title: 'ICH E2D Core Minimum Fields & Narrative',
    severity: 'CRITICAL',
    passed: missingFields.length === 0,
    message:
      missingFields.length === 0
        ? 'All mandatory ICH E2D safety fields and clinical narrative are present.'
        : `Missing mandatory safety fields: ${missingFields.join(', ')}.`,
    targetField: !hasPatient ? 'patient' : !hasProduct ? 'products' : !hasReaction ? 'reactions' : 'narrative',
  });

  // 2. NO FUTURE DATES (CRITICAL)
  const futureDates = [];
  if (caseDoc.receiptDate && new Date(caseDoc.receiptDate) > now) {
    futureDates.push(`Receipt Date (${new Date(caseDoc.receiptDate).toLocaleDateString()})`);
  }
  (caseDoc.reactions || []).forEach((r, idx) => {
    if (r.startDate && new Date(r.startDate) > now) {
      futureDates.push(`Reaction #${idx + 1} Onset (${new Date(r.startDate).toLocaleDateString()})`);
    }
  });
  (caseDoc.caseProducts || []).forEach((p, idx) => {
    if (p.startDate && new Date(p.startDate) > now) {
      futureDates.push(`Product #${idx + 1} Start Date (${new Date(p.startDate).toLocaleDateString()})`);
    }
  });

  checks.push({
    key: 'DATE_NO_FUTURE',
    title: 'Temporal Consistency: No Future Dates',
    severity: 'CRITICAL',
    passed: futureDates.length === 0,
    message:
      futureDates.length === 0
        ? 'All documented receipt, onset, and administration dates are in the past or present.'
        : `Dates recorded in the future: ${futureDates.join(', ')}.`,
    targetField: 'reactions',
  });

  // 3. ONSET <= REPORT/RECEIPT DATE (CRITICAL)
  const receiptDateObj = caseDoc.receiptDate ? new Date(caseDoc.receiptDate) : null;
  const invalidOnsetDates = [];
  if (receiptDateObj) {
    (caseDoc.reactions || []).forEach((r, idx) => {
      if (r.startDate) {
        const onset = new Date(r.startDate);
        // Allow up to 24-hr tolerance for UTC timezone offsets
        if (onset.getTime() - receiptDateObj.getTime() > 24 * 60 * 60 * 1000) {
          invalidOnsetDates.push(
            `Reaction #${idx + 1} (${r.verbatim}) onset ${onset.toLocaleDateString()} is after receipt date ${receiptDateObj.toLocaleDateString()}`
          );
        }
      }
    });
  }

  checks.push({
    key: 'DATE_ONSET_LE_RECEIPT',
    title: 'Temporal Sequence: Reaction Onset ≤ Receipt Date',
    severity: 'CRITICAL',
    passed: invalidOnsetDates.length === 0,
    message:
      invalidOnsetDates.length === 0
        ? 'Chronological sequence verified: Adverse reaction onset precedes case receipt date.'
        : invalidOnsetDates.join('; '),
    targetField: 'reactions',
  });

  // 4. ONSET <= RESOLUTION DATE (MAJOR)
  const invalidStopDates = [];
  (caseDoc.reactions || []).forEach((r, idx) => {
    if (r.startDate && r.stopDate && new Date(r.startDate) > new Date(r.stopDate)) {
      invalidStopDates.push(`Reaction #${idx + 1} onset is after stop date`);
    }
  });
  (caseDoc.caseProducts || []).forEach((p, idx) => {
    if (p.startDate && p.stopDate && new Date(p.startDate) > new Date(p.stopDate)) {
      invalidStopDates.push(`Product #${idx + 1} therapy start is after stop date`);
    }
  });

  checks.push({
    key: 'DATE_INTERVAL_VALID',
    title: 'Date Consistency: Start Date ≤ Stop Date',
    severity: 'MAJOR',
    passed: invalidStopDates.length === 0,
    message:
      invalidStopDates.length === 0
        ? 'Interval validation passed: Event and product start dates precede stop dates.'
        : invalidStopDates.join('; '),
    targetField: 'reactions',
  });

  // 5. PRODUCT & REACTION COMPLETENESS (MAJOR)
  const products = caseDoc.caseProducts || [];
  const incompleteProducts = products.filter(
    (p) => !p.productName || (!p.indication && !p.dose && !p.route)
  );
  const reactions = caseDoc.reactions || [];
  const incompleteReactions = reactions.filter((r) => !r.verbatim || !r.outcome);

  const isComplete = incompleteProducts.length === 0 && incompleteReactions.length === 0 && products.length > 0 && reactions.length > 0;
  checks.push({
    key: 'COMPLETENESS_PROD_RXN',
    title: 'Product & Adverse Reaction Completeness',
    severity: 'MAJOR',
    passed: isComplete,
    message: isComplete
      ? 'All medicinal products specify dosage/indication, and all reactions have clinical outcomes.'
      : `${incompleteProducts.length} product(s) or ${incompleteReactions.length} reaction(s) have incomplete details.`,
    targetField: incompleteProducts.length > 0 ? 'products' : 'reactions',
  });

  // 6. MEDICAL CODING COMPLETE (CRITICAL)
  const uncodedReactions = reactions.filter(
    (r) => !r.pt || !r.pt.trim() || !r.meddraCode || !String(r.meddraCode).trim()
  );
  const isCodingComplete = reactions.length > 0 && uncodedReactions.length === 0;

  checks.push({
    key: 'CODING_COMPLETE',
    title: 'MedDRA Medical Coding 100% Complete',
    severity: 'CRITICAL',
    passed: isCodingComplete,
    message: isCodingComplete
      ? `All ${reactions.length} adverse reaction(s) are mapped to MedDRA Preferred Terms.`
      : `${uncodedReactions.length} adverse reaction(s) remain uncoded. Complete MedDRA coding first.`,
    targetField: 'coding',
  });

  // 7. MEDICAL ASSESSMENT SIGNED (CRITICAL)
  const isAssessmentSigned = !!(latestAssessment && latestAssessment.status === 'SIGNED');
  checks.push({
    key: 'ASSESSMENT_SIGNED',
    title: 'Physician Causality Assessment Signed',
    severity: 'CRITICAL',
    passed: isAssessmentSigned,
    message: isAssessmentSigned
      ? `Medical review v${latestAssessment.version} signed by ${latestAssessment.signedByName || 'Reviewer'}.`
      : 'Medical review and causality assessment has not been electronically signed.',
    targetField: 'assessment',
  });

  // 8. ATTACHMENTS PRESENT WHEN FLAGGED (MAJOR)
  const requiresAttachments = !!caseDoc.attachmentsFlag || caseDoc.source === 'literature';
  const hasAttachments = !!(caseDoc.attachments && caseDoc.attachments.length > 0);
  const attachmentsOk = !requiresAttachments || hasAttachments;

  checks.push({
    key: 'ATTACHMENTS_FLAGGED',
    title: 'Source Documentation & Attachments Verification',
    severity: 'MAJOR',
    passed: attachmentsOk,
    message: attachmentsOk
      ? 'Document attachment criteria met.'
      : 'Source document flag is active, but no supporting attachments are uploaded.',
    targetField: 'documents',
  });

  const criticalFailed = checks.filter((c) => c.severity === 'CRITICAL' && !c.passed);
  const majorFailed = checks.filter((c) => c.severity === 'MAJOR' && !c.passed);
  const minorFailed = checks.filter((c) => c.severity === 'MINOR' && !c.passed);

  return {
    passed: criticalFailed.length === 0,
    allPassed: checks.every((c) => c.passed),
    criticalFailedCount: criticalFailed.length,
    majorFailedCount: majorFailed.length,
    minorFailedCount: minorFailed.length,
    checks,
  };
}

/**
 * Returns quality review details, automated check results, and active template for a case.
 */
export async function getCaseQualityDetails(caseIdOrNumber) {
  let caseDoc = null;
  if (mongoose.Types.ObjectId.isValid(caseIdOrNumber)) {
    caseDoc = await Case.findOne({
      $or: [{ _id: caseIdOrNumber }, { caseNumber: String(caseIdOrNumber).toUpperCase() }],
    })
      .populate('assignedTo', 'name email role')
      .lean();
  } else {
    caseDoc = await Case.findOne({ caseNumber: String(caseIdOrNumber).toUpperCase() })
      .populate('assignedTo', 'name email role')
      .lean();
  }

  if (!caseDoc) {
    throw new NotFoundError(`Case not found: ${caseIdOrNumber}`);
  }

  const latestAssessment = await MedicalAssessment.findOne({ caseId: caseDoc._id, isLatest: true }).lean();
  const template = await getOrCreateDefaultChecklistTemplate();
  const autoChecks = runAutoChecks(caseDoc, latestAssessment);

  const previousReviews = await QualityReview.find({ caseId: caseDoc._id })
    .sort({ reviewedAt: -1 })
    .populate('reviewerId', 'name email')
    .lean();

  return {
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    status: caseDoc.status,
    template,
    autoChecks,
    previousReviews,
    latestReview: previousReviews[0] || null,
    isReadyForApproval: autoChecks.passed,
  };
}

/**
 * Submits a quality review decision (APPROVED or RETURNED).
 * If RETURNED, automatically routes the case back through the workflow engine.
 * If APPROVED, advances the case through the workflow engine.
 * Acceptance criteria: case cannot be approved while any critical auto-check fails.
 */
export async function submitQualityReview(caseIdOrNumber, reviewData, user, req = null) {
  const { results = [], decision, returnReason = '', returnToStage = 'MEDICAL_REVIEW' } = reviewData;

  if (!decision || !['APPROVED', 'RETURNED'].includes(decision)) {
    throw new ValidationError('A valid quality review decision (APPROVED or RETURNED) is required.');
  }

  let caseDoc = null;
  if (mongoose.Types.ObjectId.isValid(caseIdOrNumber)) {
    caseDoc = await Case.findOne({
      $or: [{ _id: caseIdOrNumber }, { caseNumber: String(caseIdOrNumber).toUpperCase() }],
    }).populate('assignedTo', 'name email role');
  } else {
    caseDoc = await Case.findOne({ caseNumber: String(caseIdOrNumber).toUpperCase() }).populate(
      'assignedTo',
      'name email role'
    );
  }

  if (!caseDoc) {
    throw new NotFoundError(`Case not found: ${caseIdOrNumber}`);
  }

  const latestAssessment = await MedicalAssessment.findOne({ caseId: caseDoc._id, isLatest: true }).lean();
  const autoCheckEvaluation = runAutoChecks(caseDoc, latestAssessment);

  // ACCEPTANCE GATE: Case cannot be approved while any critical auto-check fails
  if (decision === 'APPROVED') {
    const failedCritical = autoCheckEvaluation.checks.filter((c) => c.severity === 'CRITICAL' && !c.passed);
    if (failedCritical.length > 0) {
      const messages = failedCritical.map((c) => c.message).join(' | ');
      throw new ValidationError(
        `Case cannot be approved by Quality Review while critical automatic validation checks fail: ${messages}`
      );
    }

    // Also check if reviewer marked any CRITICAL checklist item as fail
    const criticalManualFails = results.filter((r) => r.severity === 'CRITICAL' && r.status === 'fail');
    if (criticalManualFails.length > 0) {
      throw new ValidationError(
        `Case cannot be approved with critical checklist item failures: ${criticalManualFails.map((r) => r.title).join(', ')}`
      );
    }
  }

  if (decision === 'RETURNED' && (!returnReason || returnReason.trim().length < 5)) {
    throw new ValidationError('A detailed justification returnReason is required when returning a case for quality correction.');
  }

  // Check whether this is the first QA review for this case (for First-Pass Yield metrics)
  const previousReviewCount = await QualityReview.countDocuments({ caseId: caseDoc._id });
  const isFirstPass = previousReviewCount === 0;

  // Save the QualityReview record
  const qualityReview = await QualityReview.create({
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    reviewerId: user._id,
    reviewerName: user.name,
    processorId: caseDoc.assignedTo?._id || null,
    processorName: caseDoc.assignedTo?.name || 'Unassigned',
    results,
    autoCheckResults: autoCheckEvaluation.checks,
    decision,
    returnReason: returnReason.trim(),
    returnToStage: decision === 'RETURNED' ? returnToStage : undefined,
    isFirstPass,
    reviewedAt: new Date(),
  });

  // Update Case workflow flags
  caseDoc.workflow.qualityReviewCompleted = decision === 'APPROVED';
  await caseDoc.save();

  // Route case through the Workflow Engine
  let workflowRouteResult = null;
  if (decision === 'RETURNED') {
    const target = returnToStage === 'DATA_ENTRY' ? 'DATA_ENTRY' : 'MEDICAL_REVIEW';
    workflowRouteResult = await workflowService.routeCase(
      caseDoc._id,
      {
        targetStage: target,
        reason: `Quality Review RETURNED: ${returnReason.trim()}`,
      },
      user,
      req
    );
  } else if (decision === 'APPROVED') {
    workflowRouteResult = await workflowService.routeCase(
      caseDoc._id,
      {
        targetStage: 'REGULATORY_REPORTING',
        reason: 'Approved by Quality Assurance Auditor',
      },
      user,
      req
    );
  }

  // 21 CFR Part 11 Audit Record
  await recordAudit({
    actor: user,
    action: decision === 'APPROVED' ? 'QUALITY_REVIEW_APPROVED' : 'QUALITY_REVIEW_RETURNED',
    entity: 'QualityReview',
    entityId: String(qualityReview._id),
    summary: `Quality review for case ${caseDoc.caseNumber} decided as ${decision} by ${user.name}. ${returnReason ? `Reason: ${returnReason.trim()}` : ''}`,
    details: {
      caseNumber: caseDoc.caseNumber,
      decision,
      isFirstPass,
      returnReason,
      returnToStage: decision === 'RETURNED' ? returnToStage : null,
      autoCheckPassed: autoCheckEvaluation.passed,
    },
    req,
  });

  return {
    review: qualityReview,
    workflowRouteResult,
    autoChecks: autoCheckEvaluation,
  };
}

/**
 * Calculates Quality Assurance Metrics, including First-Pass-Yield (FPY) per processor.
 */
export async function getQualityMetrics() {
  const allReviews = await QualityReview.find()
    .sort({ reviewedAt: -1 })
    .populate('reviewerId', 'name email')
    .populate('processorId', 'name email role')
    .lean();

  const totalReviews = allReviews.length;
  const approvedCount = allReviews.filter((r) => r.decision === 'APPROVED').length;
  const returnedCount = allReviews.filter((r) => r.decision === 'RETURNED').length;

  // First-Pass metrics: consider each unique case's first review
  const firstPassReviews = allReviews.filter((r) => r.isFirstPass);
  const firstPassTotal = firstPassReviews.length;
  const firstPassApproved = firstPassReviews.filter((r) => r.decision === 'APPROVED').length;
  const globalFirstPassYield = firstPassTotal > 0 ? Math.round((firstPassApproved / firstPassTotal) * 100) : 100;

  // Group metrics per processor
  const processorMap = new Map();

  for (const r of firstPassReviews) {
    const pid = r.processorId?._id ? String(r.processorId._id) : 'unassigned';
    const pname = r.processorId?.name || r.processorName || 'Unassigned Processor';
    const prole = r.processorId?.role || 'Data Entry / Processor';

    if (!processorMap.has(pid)) {
      processorMap.set(pid, {
        processorId: pid,
        name: pname,
        role: prole,
        totalFirstPassCases: 0,
        approvedFirstPass: 0,
        returnedFirstPass: 0,
        fpyPercentage: 100,
        recentReturns: [],
      });
    }

    const pData = processorMap.get(pid);
    pData.totalFirstPassCases++;

    if (r.decision === 'APPROVED') {
      pData.approvedFirstPass++;
    } else {
      pData.returnedFirstPass++;
      if (r.returnReason) {
        pData.recentReturns.push({
          caseNumber: r.caseNumber,
          reason: r.returnReason,
          reviewedAt: r.reviewedAt,
          returnToStage: r.returnToStage,
        });
      }
    }

    pData.fpyPercentage = Math.round((pData.approvedFirstPass / pData.totalFirstPassCases) * 100);
  }

  const processorMetrics = Array.from(processorMap.values()).sort(
    (a, b) => b.totalFirstPassCases - a.totalFirstPassCases
  );

  return {
    totalReviews,
    approvedCount,
    returnedCount,
    firstPassTotal,
    firstPassApproved,
    globalFirstPassYield,
    processorMetrics,
    recentReviews: allReviews.slice(0, 15),
  };
}
