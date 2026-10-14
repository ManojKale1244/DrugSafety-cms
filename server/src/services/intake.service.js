import { Intake } from '../models/Intake.js';
import { Case } from '../models/Case.js';
import { recordAudit } from '../utils/audit.js';

/**
 * Validates the 4 ICH E2D Minimum Criteria for a valid Adverse Event Report:
 * 1. Identifiable Reporter
 * 2. Identifiable Patient
 * 3. Suspected Medicinal Product
 * 4. Reported Adverse Reaction / Event
 *
 * @param {Object} data
 * @returns {{ hasMinimumCriteria: boolean, criteriaStatus: Object, missingFields: string[] }}
 */
export function evaluateMinimumCriteria(data) {
  const missingFields = [];

  // 1. Identifiable Reporter
  const hasReporterName = !!data.reporter?.name?.trim();
  const hasReporterContact = !!data.reporter?.contact?.trim();
  const hasReporterQual = !!data.reporter?.qualification?.trim() && data.reporter?.qualification !== 'Unknown';
  const identifiableReporter = hasReporterName || hasReporterContact || hasReporterQual;

  if (!identifiableReporter) {
    missingFields.push('Identifiable Reporter (Name, Contact, or Qualification)');
  }

  // 2. Identifiable Patient
  const hasPatientRef = !!data.patient?.reference?.trim();
  const hasPatientAge = data.patient?.age != null && !isNaN(data.patient.age);
  const hasPatientSex = !!data.patient?.sex && data.patient?.sex !== 'Unknown';
  const identifiablePatient = hasPatientRef || hasPatientAge || hasPatientSex;

  if (!identifiablePatient) {
    missingFields.push('Identifiable Patient (Reference ID, Age, or Sex)');
  }

  // 3. Suspect Product
  const suspectProduct = !!data.suspectedProduct?.trim();
  if (!suspectProduct) {
    missingFields.push('Suspected Medicinal Product');
  }

  // 4. Reported Event / Reaction
  const reportedEvent = !!data.reportedReaction?.trim();
  if (!reportedEvent) {
    missingFields.push('Reported Adverse Reaction / Event');
  }

  const hasMinimumCriteria = identifiableReporter && identifiablePatient && suspectProduct && reportedEvent;

  return {
    hasMinimumCriteria,
    criteriaStatus: {
      identifiableReporter,
      identifiablePatient,
      suspectProduct,
      reportedEvent,
    },
    missingFields,
  };
}

/**
 * Screens existing cases and intakes for potential duplicate candidates.
 *
 * @param {Object} intakeData
 * @returns {Promise<Array<{ caseId: string, caseNumber: string, similarityScore: number, reason: string }>>}
 */
export async function screenDuplicates(intakeData) {
  const candidates = [];
  const product = intakeData.suspectedProduct?.trim();
  if (!product) return candidates;

  // Search cases with matching suspected product
  const potentialCases = await Case.find({
    product: { $regex: new RegExp(`^${product}$`, 'i') },
  })
    .limit(10)
    .select('caseNumber product eventSummary patientAge patientGender receivedDate');

  for (const c of potentialCases) {
    let score = 40; // Base score for matching product
    const reasons = ['Matching suspected product'];

    // Check patient demographics
    if (
      intakeData.patient?.age &&
      c.patientAge &&
      Math.abs(intakeData.patient.age - c.patientAge) <= 2
    ) {
      score += 25;
      reasons.push(`Similar patient age (${c.patientAge} yrs)`);
    }

    if (
      intakeData.patient?.sex &&
      c.patientGender &&
      intakeData.patient.sex === c.patientGender &&
      c.patientGender !== 'Unknown'
    ) {
      score += 15;
      reasons.push(`Matching patient sex (${c.patientGender})`);
    }

    // Check verbatim reaction text similarity
    const intakeReaction = (intakeData.reportedReaction || '').toLowerCase();
    const caseEvent = (c.eventSummary || '').toLowerCase();

    if (
      intakeReaction &&
      caseEvent &&
      (intakeReaction.includes(caseEvent) || caseEvent.includes(intakeReaction))
    ) {
      score += 20;
      reasons.push('Overlapping adverse event description');
    }

    if (score >= 60) {
      candidates.push({
        caseId: c._id,
        caseNumber: c.caseNumber,
        similarityScore: Math.min(100, score),
        reason: reasons.join('; '),
      });
    }
  }

  return candidates.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Generates sequential intake number: INT-YYYY-NNNNN
 */
export async function generateIntakeNumber() {
  const year = new Date().getFullYear();
  const prefix = `INT-${year}-`;

  const lastIntake = await Intake.findOne({ intakeNumber: new RegExp(`^${prefix}`) })
    .sort({ intakeNumber: -1 })
    .select('intakeNumber');

  let seq = 1;
  if (lastIntake && lastIntake.intakeNumber) {
    const parts = lastIntake.intakeNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        seq = parsed + 1;
      }
    }
  }

  return `${prefix}${String(seq).padStart(5, '0')}`;
}

/**
 * Generates sequential case number: DS-YYYY-NNNNN
 */
export async function generateCaseNumber() {
  const year = new Date().getFullYear();
  const prefix = `DS-${year}-`;

  const lastCase = await Case.findOne({ caseNumber: new RegExp(`^${prefix}`) })
    .sort({ caseNumber: -1 })
    .select('caseNumber');

  let seq = 1;
  if (lastCase && lastCase.caseNumber) {
    const parts = lastCase.caseNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        seq = parsed + 1;
      }
    }
  }

  return `${prefix}${String(seq).padStart(5, '0')}`;
}

/**
 * Create a new Intake record.
 */
export async function createIntake(payload, user, req) {
  // Validate receiptDate not in future
  const receiptDate = new Date(payload.receiptDate || Date.now());
  if (receiptDate.getTime() > Date.now()) {
    return {
      success: false,
      statusCode: 400,
      error: 'Receipt date cannot be set in the future',
    };
  }

  const intakeNumber = await generateIntakeNumber();
  const validation = evaluateMinimumCriteria(payload);
  const duplicateCandidates = await screenDuplicates(payload);
  validation.duplicateCandidates = duplicateCandidates;

  // Determine initial status based on minimum criteria
  const initialStatus = payload.status === 'VALIDATING'
    ? 'VALIDATING'
    : validation.hasMinimumCriteria
    ? 'RECEIVED'
    : 'INCOMPLETE';

  const intake = await Intake.create({
    intakeNumber,
    source: payload.source || 'physician',
    receiptDate,
    reporter: payload.reporter || {},
    patient: payload.patient || {},
    suspectedProduct: payload.suspectedProduct.trim(),
    reportedReaction: payload.reportedReaction.trim(),
    narrative: payload.narrative || '',
    attachments: payload.attachments || [],
    status: initialStatus,
    validation,
    createdBy: user?._id || null,
  });

  await recordAudit({
    actor: user,
    action: 'INTAKE_CREATE',
    entity: 'Intake',
    entityId: intake._id,
    summary: `New adverse event intake ${intake.intakeNumber} created for product ${intake.suspectedProduct} (Status: ${intake.status})`,
    details: {
      intakeNumber: intake.intakeNumber,
      product: intake.suspectedProduct,
      hasMinimumCriteria: validation.hasMinimumCriteria,
      missingFields: validation.missingFields,
      duplicateCandidatesCount: duplicateCandidates.length,
    },
    req,
  });

  return { success: true, intake };
}

/**
 * List intakes with search, status/source filters, and pagination.
 */
export async function getIntakes({
  search = '',
  status = '',
  source = '',
  page = 1,
  limit = 10,
}) {
  const query = {};

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { intakeNumber: { $regex: s, $options: 'i' } },
      { suspectedProduct: { $regex: s, $options: 'i' } },
      { reportedReaction: { $regex: s, $options: 'i' } },
      { 'patient.reference': { $regex: s, $options: 'i' } },
      { 'reporter.name': { $regex: s, $options: 'i' } },
    ];
  }

  if (status) {
    query.status = status;
  }

  if (source) {
    query.source = source;
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (safePage - 1) * safeLimit;

  const [intakes, total] = await Promise.all([
    Intake.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    Intake.countDocuments(query),
  ]);

  return {
    intakes,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * Get intake by ID.
 */
export async function getIntakeById(id) {
  return Intake.findById(id).populate('createdBy', 'name email');
}

/**
 * Update an Intake record.
 */
export async function updateIntake(id, updateData, user, req) {
  const intake = await Intake.findById(id);
  if (!intake) {
    return { success: false, statusCode: 404, error: 'Intake record not found' };
  }

  if (['CONVERTED', 'REJECTED'].includes(intake.status)) {
    return {
      success: false,
      statusCode: 400,
      error: `Cannot modify an intake that has already been ${intake.status.toLowerCase()}`,
    };
  }

  if (updateData.receiptDate) {
    const d = new Date(updateData.receiptDate);
    if (d.getTime() > Date.now()) {
      return { success: false, statusCode: 400, error: 'Receipt date cannot be in the future' };
    }
    intake.receiptDate = d;
  }

  if (updateData.source) intake.source = updateData.source;
  if (updateData.reporter) intake.reporter = { ...intake.reporter, ...updateData.reporter };
  if (updateData.patient) intake.patient = { ...intake.patient, ...updateData.patient };
  if (updateData.suspectedProduct) intake.suspectedProduct = updateData.suspectedProduct.trim();
  if (updateData.reportedReaction) intake.reportedReaction = updateData.reportedReaction.trim();
  if (updateData.narrative !== undefined) intake.narrative = updateData.narrative;
  if (updateData.attachments) intake.attachments = updateData.attachments;

  // Re-evaluate minimum criteria and duplicate screening
  const validation = evaluateMinimumCriteria(intake);
  const duplicateCandidates = await screenDuplicates(intake);
  validation.duplicateCandidates = duplicateCandidates;
  intake.validation = validation;

  if (intake.status === 'INCOMPLETE' && validation.hasMinimumCriteria) {
    intake.status = 'RECEIVED';
  } else if (intake.status === 'RECEIVED' && !validation.hasMinimumCriteria) {
    intake.status = 'INCOMPLETE';
  }

  await intake.save();

  await recordAudit({
    actor: user,
    action: 'INTAKE_UPDATE',
    entity: 'Intake',
    entityId: intake._id,
    summary: `Intake ${intake.intakeNumber} updated by ${user.email}`,
    details: {
      hasMinimumCriteria: validation.hasMinimumCriteria,
      missingFields: validation.missingFields,
    },
    req,
  });

  return { success: true, intake };
}

/**
 * Convert an Intake into a formal Case (only if all 4 minimum criteria are met).
 */
export async function convertIntakeToCase(id, user, req) {
  const intake = await Intake.findById(id);
  if (!intake) {
    return { success: false, statusCode: 404, error: 'Intake record not found' };
  }

  if (intake.status === 'CONVERTED') {
    return {
      success: false,
      statusCode: 400,
      error: `This intake was already converted into Case ${intake.convertedCaseNumber}`,
    };
  }

  if (intake.status === 'REJECTED') {
    return {
      success: false,
      statusCode: 400,
      error: 'A rejected intake cannot be converted to a case.',
    };
  }

  // Re-verify the 4 minimum criteria
  const validation = evaluateMinimumCriteria(intake);
  if (!validation.hasMinimumCriteria) {
    return {
      success: false,
      statusCode: 400,
      error: `Cannot convert intake to case: missing required criteria: ${validation.missingFields.join(', ')}`,
      missingFields: validation.missingFields,
    };
  }

  // Generate official DS-YYYY-NNNNN case number
  const caseNumber = await generateCaseNumber();

  // Determine regulatory reporting due date (e.g. 15 days from receipt)
  const dayMs = 24 * 60 * 60 * 1000;
  const regulatoryDueDate = new Date(intake.receiptDate.getTime() + 15 * dayMs);

  // Map Intake to Case
  const newCase = await Case.create({
    caseNumber,
    reportType:
      intake.source === 'literature'
        ? 'Literature'
        : intake.source === 'regulator'
        ? 'Health Authority'
        : 'Spontaneous',
    product: intake.suspectedProduct,
    eventSummary: intake.reportedReaction,
    seriousness: 'Non-Serious', // Default; updated during clinical review
    status: 'new',
    assignedTo: null,
    regulatoryDueDate,
    receivedDate: intake.receiptDate,
    reporterType: intake.reporter?.qualification || 'Physician',
    country: intake.reporter?.country || 'India',
    patientAge: intake.patient?.age || null,
    patientGender: intake.patient?.sex || 'Unknown',
  });

  // Mark intake as CONVERTED
  intake.status = 'CONVERTED';
  intake.convertedCaseId = newCase._id;
  intake.convertedCaseNumber = newCase.caseNumber;
  await intake.save();

  // Log linked audit trail
  await recordAudit({
    actor: user,
    action: 'INTAKE_CONVERTED_TO_CASE',
    entity: 'Case',
    entityId: newCase._id,
    summary: `Intake ${intake.intakeNumber} successfully converted to Case ${newCase.caseNumber} by ${user.email}`,
    details: {
      intakeNumber: intake.intakeNumber,
      caseNumber: newCase.caseNumber,
      product: newCase.product,
      eventSummary: newCase.eventSummary,
      regulatoryDueDate: newCase.regulatoryDueDate,
    },
    req,
  });

  return {
    success: true,
    message: `Intake ${intake.intakeNumber} converted successfully into Case ${newCase.caseNumber}`,
    case: newCase,
    intake,
  };
}

/**
 * Reject an Intake with a mandatory reason.
 */
export async function rejectIntake(id, reason, user, req) {
  if (!reason || !reason.trim()) {
    return {
      success: false,
      statusCode: 400,
      error: 'A detailed rejection reason is mandatory to reject an adverse event intake.',
    };
  }

  const intake = await Intake.findById(id);
  if (!intake) {
    return { success: false, statusCode: 404, error: 'Intake record not found' };
  }

  if (intake.status === 'CONVERTED') {
    return {
      success: false,
      statusCode: 400,
      error: 'Cannot reject an intake that has already been converted to an active case.',
    };
  }

  intake.status = 'REJECTED';
  intake.rejectionReason = reason.trim();
  await intake.save();

  await recordAudit({
    actor: user,
    action: 'INTAKE_REJECTED',
    entity: 'Intake',
    entityId: intake._id,
    summary: `Intake ${intake.intakeNumber} rejected by ${user.email}. Reason: ${intake.rejectionReason}`,
    details: {
      intakeNumber: intake.intakeNumber,
      rejectionReason: intake.rejectionReason,
    },
    req,
  });

  return { success: true, message: `Intake ${intake.intakeNumber} rejected`, intake };
}
