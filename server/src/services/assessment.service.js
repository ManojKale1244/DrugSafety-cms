import mongoose from 'mongoose';
import { MedicalAssessment } from '../models/MedicalAssessment.js';
import { Case } from '../models/Case.js';
import { User } from '../models/User.js';
import { ActionItem } from '../models/ActionItem.js';
import { recordAudit } from '../utils/audit.js';

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

export class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
  }
}

/**
 * Builds baseline product × reaction causality pairs from a Case document.
 */
export function buildDefaultCausalityPairs(caseDoc) {
  const pairs = [];
  const products = caseDoc.caseProducts?.length > 0
    ? caseDoc.caseProducts
    : [{ _id: new mongoose.Types.ObjectId(), productName: caseDoc.product || 'Suspect Product', role: 'Suspect' }];

  const reactions = caseDoc.reactions?.length > 0
    ? caseDoc.reactions
    : [{ _id: new mongoose.Types.ObjectId(), verbatim: caseDoc.eventSummary || 'Adverse Event', pt: caseDoc.eventSummary || '' }];

  for (const prod of products) {
    for (const rxn of reactions) {
      pairs.push({
        productId: prod._id,
        productName: prod.productName,
        reactionId: rxn._id,
        reactionVerbatim: rxn.verbatim,
        reactionPt: rxn.pt || '',
        causality: rxn.causality && rxn.causality !== 'Not Assessed' ? rxn.causality : 'Possible',
        notes: '',
      });
    }
  }

  return pairs;
}

/**
 * Retrieves the latest medical assessment and all version history for a case.
 */
export async function getCaseAssessments(caseIdOrNumber) {
  let caseDoc = null;
  if (mongoose.Types.ObjectId.isValid(caseIdOrNumber)) {
    caseDoc = await Case.findOne({
      $or: [{ _id: caseIdOrNumber }, { caseNumber: String(caseIdOrNumber).toUpperCase() }],
    })
      .populate('assignedTo', 'name email')
      .lean();
  } else {
    caseDoc = await Case.findOne({ caseNumber: String(caseIdOrNumber).toUpperCase() })
      .populate('assignedTo', 'name email')
      .lean();
  }

  if (!caseDoc) {
    throw new NotFoundError(`Case not found: ${caseIdOrNumber}`);
  }

  const allAssessments = await MedicalAssessment.find({ caseId: caseDoc._id })
    .sort({ version: -1, createdAt: -1 })
    .populate('reviewerId', 'name email role')
    .populate('signedBy', 'name email role')
    .populate('requestsForInfo.assignedTo', 'name email')
    .lean();

  let currentAssessment = allAssessments.find((a) => a.isLatest) || allAssessments[0] || null;

  // If no assessment has been drafted yet, construct an ephemeral default draft
  if (!currentAssessment) {
    const defaultPairs = buildDefaultCausalityPairs(caseDoc);
    const defaultSeriousness = [];
    if (caseDoc.seriousnessFlags) {
      if (caseDoc.seriousnessFlags.death) defaultSeriousness.push('death');
      if (caseDoc.seriousnessFlags.lifeThreatening) defaultSeriousness.push('life-threatening');
      if (caseDoc.seriousnessFlags.hospitalization) defaultSeriousness.push('hospitalization');
      if (caseDoc.seriousnessFlags.disability) defaultSeriousness.push('disability');
      if (caseDoc.seriousnessFlags.congenitalAnomaly) defaultSeriousness.push('congenital anomaly');
      if (caseDoc.seriousnessFlags.otherMedicallyImportant) defaultSeriousness.push('medically important');
    }

    currentAssessment = {
      caseId: caseDoc._id,
      reviewerId: null,
      reviewerName: '',
      seriousnessCriteria: defaultSeriousness,
      expectedness: caseDoc.assessment?.listedness?.toLowerCase() || 'unknown',
      causality: defaultPairs,
      medicalComment: caseDoc.assessment?.medicalReviewerComments || '',
      requestsForInfo: [],
      status: 'DRAFT',
      version: 1,
      isLatest: true,
      history: [],
      isEphemeral: true,
    };
  }

  return {
    case: caseDoc,
    currentAssessment,
    versions: allAssessments,
    totalVersions: allAssessments.length,
  };
}

/**
 * Creates or drafts an initial medical assessment.
 */
export async function createAssessment(caseIdOrNumber, data = {}, user, req = null) {
  let caseDoc = null;
  if (mongoose.Types.ObjectId.isValid(caseIdOrNumber)) {
    caseDoc = await Case.findOne({
      $or: [{ _id: caseIdOrNumber }, { caseNumber: String(caseIdOrNumber).toUpperCase() }],
    });
  } else {
    caseDoc = await Case.findOne({ caseNumber: String(caseIdOrNumber).toUpperCase() });
  }

  if (!caseDoc) {
    throw new NotFoundError(`Case not found: ${caseIdOrNumber}`);
  }

  // Check if an assessment already exists
  const existingLatest = await MedicalAssessment.findOne({ caseId: caseDoc._id, isLatest: true });

  if (existingLatest) {
    if (existingLatest.status === 'DRAFT') {
      // Update the existing draft
      return updateAssessment(existingLatest._id, data, user, req);
    }
    // If existing is SIGNED, creating a new one supersedes it
    return supersedeAssessment(existingLatest._id, data, user, req);
  }

  const causalityPairs = data.causality?.length > 0 ? data.causality : buildDefaultCausalityPairs(caseDoc);

  const assessment = await MedicalAssessment.create({
    caseId: caseDoc._id,
    reviewerId: user._id,
    reviewerName: user.name || 'Medical Reviewer',
    seriousnessCriteria: data.seriousnessCriteria || [],
    expectedness: data.expectedness || 'unknown',
    causality: causalityPairs,
    medicalComment: data.medicalComment || '',
    requestsForInfo: [],
    status: 'DRAFT',
    version: 1,
    isLatest: true,
    history: [],
  });

  await recordAudit({
    actor: user,
    action: 'MEDICAL_ASSESSMENT_DRAFTED',
    entity: 'MedicalAssessment',
    entityId: String(assessment._id),
    summary: `Drafted Medical Assessment v1 for case ${caseDoc.caseNumber} by ${user.name}`,
    details: {
      caseId: String(caseDoc._id),
      caseNumber: caseDoc.caseNumber,
      version: 1,
      seriousnessCriteria: assessment.seriousnessCriteria,
      expectedness: assessment.expectedness,
    },
    req,
  });

  return assessment;
}

/**
 * Updates an assessment. If signed, requires supersedeReason and forks to new version.
 */
export async function updateAssessment(idOrCaseId, data = {}, user, req = null) {
  let assessment = null;
  if (mongoose.Types.ObjectId.isValid(idOrCaseId)) {
    assessment = await MedicalAssessment.findById(idOrCaseId);
  }
  if (!assessment) {
    assessment = await MedicalAssessment.findOne({ caseId: idOrCaseId, isLatest: true });
  }
  if (!assessment) {
    // If no existing assessment, create one
    return createAssessment(idOrCaseId, data, user, req);
  }

  // 21 CFR Part 11 Rule: Signed assessments are immutable
  if (assessment.status === 'SIGNED') {
    if (!data.supersedeReason || !data.supersedeReason.trim()) {
      throw new ValidationError(
        `Signed Medical Assessment v${assessment.version} is immutable under 21 CFR Part 11. To revise this assessment, a supersedeReason is strictly required to create Version ${assessment.version + 1}.`,
      );
    }
    return supersedeAssessment(assessment._id, data, user, req);
  }

  // Draft update
  if (data.seriousnessCriteria !== undefined) assessment.seriousnessCriteria = data.seriousnessCriteria;
  if (data.expectedness !== undefined) assessment.expectedness = data.expectedness;
  if (data.causality !== undefined) assessment.causality = data.causality;
  if (data.medicalComment !== undefined) assessment.medicalComment = data.medicalComment;

  assessment.reviewerId = user._id;
  assessment.reviewerName = user.name || assessment.reviewerName;

  await assessment.save();

  await recordAudit({
    actor: user,
    action: 'MEDICAL_ASSESSMENT_UPDATED',
    entity: 'MedicalAssessment',
    entityId: String(assessment._id),
    summary: `Updated draft Medical Assessment v${assessment.version} by ${user.name}`,
    details: {
      assessmentId: String(assessment._id),
      version: assessment.version,
      seriousnessCriteria: assessment.seriousnessCriteria,
      expectedness: assessment.expectedness,
    },
    req,
  });

  return assessment;
}

/**
 * Supersedes a signed assessment to create a new draft version.
 */
export async function supersedeAssessment(existingId, data = {}, user, req = null) {
  const oldAssessment = await MedicalAssessment.findById(existingId);
  if (!oldAssessment) {
    throw new NotFoundError(`Assessment not found: ${existingId}`);
  }

  const supersedeReason = data.supersedeReason?.trim() || 'Medical reassessment based on follow-up data';
  const newVersion = oldAssessment.version + 1;

  // Archive old version snapshot
  const historySnapshot = {
    version: oldAssessment.version,
    reviewerId: oldAssessment.reviewerId,
    reviewerName: oldAssessment.reviewerName,
    seriousnessCriteria: oldAssessment.seriousnessCriteria,
    expectedness: oldAssessment.expectedness,
    causality: oldAssessment.causality,
    medicalComment: oldAssessment.medicalComment,
    status: oldAssessment.status,
    signedAt: oldAssessment.signedAt,
    signedByName: oldAssessment.signedByName,
    signedRole: oldAssessment.signedRole,
    supersededAt: new Date(),
    supersededBy: user._id,
    supersedeReason,
  };

  const newAssessment = await MedicalAssessment.create({
    caseId: oldAssessment.caseId,
    reviewerId: user._id,
    reviewerName: user.name || 'Medical Reviewer',
    seriousnessCriteria: data.seriousnessCriteria !== undefined ? data.seriousnessCriteria : oldAssessment.seriousnessCriteria,
    expectedness: data.expectedness !== undefined ? data.expectedness : oldAssessment.expectedness,
    causality: data.causality !== undefined ? data.causality : oldAssessment.causality,
    medicalComment: data.medicalComment !== undefined ? data.medicalComment : oldAssessment.medicalComment,
    requestsForInfo: oldAssessment.requestsForInfo || [],
    status: 'DRAFT',
    version: newVersion,
    isLatest: true,
    supersedes: oldAssessment._id,
    history: [...oldAssessment.history, historySnapshot],
  });

  // Mark old assessment as superseded
  oldAssessment.isLatest = false;
  oldAssessment.supersededBy = newAssessment._id;
  await oldAssessment.save();

  // Load case for audit
  const caseDoc = await Case.findById(oldAssessment.caseId).select('caseNumber');

  await recordAudit({
    actor: user,
    action: 'MEDICAL_ASSESSMENT_SUPERSEDED',
    entity: 'MedicalAssessment',
    entityId: String(newAssessment._id),
    summary: `Superseded signed Assessment v${oldAssessment.version} -> Created Draft v${newVersion} for case ${caseDoc?.caseNumber}. Reason: ${supersedeReason}`,
    details: {
      caseId: String(oldAssessment.caseId),
      previousVersion: oldAssessment.version,
      newVersion,
      supersedeReason,
    },
    req,
  });

  return newAssessment;
}

/**
 * Electronically signs a medical assessment (Part 11 compliant).
 */
export async function signAssessment(id, { signatureStatement = '' } = {}, user, req = null) {
  const assessment = await MedicalAssessment.findById(id);
  if (!assessment) {
    throw new NotFoundError(`Assessment not found: ${id}`);
  }

  if (assessment.status === 'SIGNED') {
    throw new ValidationError('This assessment has already been electronically signed.');
  }

  const caseDoc = await Case.findById(assessment.caseId);
  if (!caseDoc) {
    throw new NotFoundError('Associated safety case not found.');
  }

  // 1. Sign Assessment
  assessment.status = 'SIGNED';
  assessment.signedAt = new Date();
  assessment.signedBy = user._id;
  assessment.signedByName = user.name;
  assessment.signedRole = user.role?.displayName || user.role?.name || 'Safety Physician / Reviewer';
  assessment.signatureStatement =
    signatureStatement.trim() ||
    'I electronically confirm that this medical review and causality assessment represents my clinical judgment based on all available clinical evidence.';

  await assessment.save();

  // 2. Synchronize Case Document
  // Extract primary company causality from pairs
  let primaryCausality = 'Unassessed';
  if (assessment.causality && assessment.causality.length > 0) {
    const suspectPair = assessment.causality.find((p) => p.causality && p.causality !== 'Not Assessed');
    primaryCausality = suspectPair ? suspectPair.causality : assessment.causality[0].causality;
  }

  // Map to Case.assessment
  if (!caseDoc.assessment) caseDoc.assessment = {};
  caseDoc.assessment.companyCausality = ['Certain', 'Probable', 'Possible'].includes(primaryCausality) ? 'Related' : 'Not Related';
  caseDoc.assessment.listedness = assessment.expectedness
    ? assessment.expectedness.charAt(0).toUpperCase() + assessment.expectedness.slice(1).toLowerCase()
    : 'Unknown';
  caseDoc.assessment.medicalReviewerComments = assessment.medicalComment;
  caseDoc.assessment.reviewedBy = user._id;
  caseDoc.assessment.reviewedAt = new Date();

  // Update Seriousness classification from assessment criteria
  const hasSeriousCriteria = assessment.seriousnessCriteria && assessment.seriousnessCriteria.length > 0;
  caseDoc.seriousness = hasSeriousCriteria ? 'Serious' : 'Non-Serious';
  if (!caseDoc.seriousnessFlags) caseDoc.seriousnessFlags = {};
  caseDoc.seriousnessFlags.isSerious = hasSeriousCriteria;
  caseDoc.seriousnessFlags.death = assessment.seriousnessCriteria.includes('death');
  caseDoc.seriousnessFlags.lifeThreatening = assessment.seriousnessCriteria.includes('life-threatening');
  caseDoc.seriousnessFlags.hospitalization = assessment.seriousnessCriteria.includes('hospitalization');
  caseDoc.seriousnessFlags.disability = assessment.seriousnessCriteria.includes('disability');
  caseDoc.seriousnessFlags.congenitalAnomaly = assessment.seriousnessCriteria.includes('congenital anomaly');
  caseDoc.seriousnessFlags.otherMedicallyImportant = assessment.seriousnessCriteria.includes('medically important');

  // Mark workflow medical review step complete
  if (!caseDoc.workflow) caseDoc.workflow = {};
  caseDoc.workflow.medicalReviewCompleted = true;

  caseDoc.version = (caseDoc.version || 1) + 1;
  await caseDoc.save();

  // 3. 21 CFR Part 11 Audit Trail Entry
  await recordAudit({
    actor: user,
    action: 'MEDICAL_ASSESSMENT_SIGNED',
    entity: 'MedicalAssessment',
    entityId: String(assessment._id),
    summary: `Medical Assessment v${assessment.version} electronically signed by ${user.name} (${user.email}) for case ${caseDoc.caseNumber}`,
    details: {
      caseId: String(caseDoc._id),
      caseNumber: caseDoc.caseNumber,
      assessmentId: String(assessment._id),
      version: assessment.version,
      signedByName: assessment.signedByName,
      signedRole: assessment.signedRole,
      signedAt: assessment.signedAt,
      signatureStatement: assessment.signatureStatement,
      seriousnessCriteria: assessment.seriousnessCriteria,
      expectedness: assessment.expectedness,
      primaryCausality,
    },
    req,
  });

  return {
    assessment,
    case: caseDoc,
  };
}

/**
 * Creates a Request for Information (RFI) and generates an ActionItem follow-up task.
 */
export async function createRequestForInfo(
  id,
  { query, priority = 'Routine', assignedTo = null, dueDate = null },
  user,
  req = null,
) {
  if (!query || !query.trim()) {
    throw new ValidationError('A non-empty clinical query is strictly required for requesting information.');
  }

  const assessment = await MedicalAssessment.findById(id);
  if (!assessment) {
    throw new NotFoundError(`Assessment not found: ${id}`);
  }

  const caseDoc = await Case.findById(assessment.caseId);
  if (!caseDoc) {
    throw new NotFoundError('Associated safety case not found.');
  }

  let assignedUser = null;
  if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
    assignedUser = await User.findById(assignedTo);
  }

  const resolvedDueOn = dueDate
    ? new Date(dueDate)
    : new Date(Date.now() + (priority === 'Urgent' ? 3 : 7) * 24 * 60 * 60 * 1000);

  // Create follow-up ActionItem task
  const actionItem = await ActionItem.create({
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    title: `Medical RFI: ${query.trim().substring(0, 60)}...`,
    description: `Clinical query raised by ${user.name}: ${query.trim()}`,
    owner: assignedUser ? assignedUser._id : user._id,
    dueOn: resolvedDueOn,
    status: 'pending',
  });

  const rfiEntry = {
    query: query.trim(),
    priority,
    status: 'Pending',
    assignedTo: assignedUser ? assignedUser._id : null,
    assignedToName: assignedUser ? assignedUser.name : 'Unassigned',
    dueDate: resolvedDueOn,
    requestedAt: new Date(),
    requestedBy: user._id,
    requestedByName: user.name,
    response: '',
    actionItemId: actionItem._id,
  };

  assessment.requestsForInfo.push(rfiEntry);
  await assessment.save();

  await recordAudit({
    actor: user,
    action: 'MEDICAL_REQUEST_FOR_INFO',
    entity: 'MedicalAssessment',
    entityId: String(assessment._id),
    summary: `Medical Request for Information created for case ${caseDoc.caseNumber} by ${user.name}: "${query.trim()}"`,
    details: {
      assessmentId: String(assessment._id),
      caseId: String(caseDoc._id),
      caseNumber: caseDoc.caseNumber,
      actionItemId: String(actionItem._id),
      priority,
      dueDate: resolvedDueOn,
      query: query.trim(),
    },
    req,
  });

  return {
    assessment,
    actionItem,
    rfi: assessment.requestsForInfo[assessment.requestsForInfo.length - 1],
  };
}

