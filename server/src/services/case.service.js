import mongoose from 'mongoose';
import { Case } from '../models/Case.js';
import { User } from '../models/User.js';
import { recordAudit } from '../utils/audit.js';
import { AuditEvent } from '../models/AuditEvent.js';

export class ConflictError extends Error {
  constructor(message, currentCase) {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
    this.currentCase = currentCase;
  }
}

export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.details = details;
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
 * Generates sequential case number: DS-YYYY-NNNNN
 * @param {string} pattern 'DS-YYYY-NNNNN'
 */
export async function generateCaseNumber(_pattern = 'DS-YYYY-NNNNN') {
  const currentYear = new Date().getFullYear();
  const prefix = `DS-${currentYear}-`;

  const lastCase = await Case.findOne({ caseNumber: new RegExp(`^${prefix}`) })
    .sort({ caseNumber: -1 })
    .select('caseNumber')
    .lean();

  let nextSeq = 1;
  if (lastCase && lastCase.caseNumber) {
    const parts = lastCase.caseNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

/**
 * Query and filter cases with pagination and sorting
 */
export async function getCases(queryParams = {}, user = null) {
  const {
    search,
    status,
    priority,
    seriousness,
    assignedTo,
    myCases,
    dateFrom,
    dateTo,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = queryParams;

  const filter = {};

  // Status Filter
  if (status) {
    if (Array.isArray(status)) {
      filter.status = { $in: status };
    } else {
      filter.status = status;
    }
  }

  // Priority Filter
  if (priority) {
    filter.priority = priority;
  }

  // Seriousness Filter
  if (seriousness) {
    filter.seriousness = seriousness;
  }

  // Assigned To Filter
  if (assignedTo) {
    filter.assignedTo = assignedTo;
  } else if (myCases === 'true' && user) {
    filter.assignedTo = user._id;
  }

  // Date Range Filter
  if (dateFrom || dateTo) {
    filter.receiptDate = {};
    if (dateFrom) filter.receiptDate.$gte = new Date(dateFrom);
    if (dateTo) filter.receiptDate.$lte = new Date(dateTo);
  }

  // Search filter
  if (search && search.trim()) {
    const q = search.trim();
    const regex = new RegExp(q, 'i');
    filter.$or = [
      { caseNumber: regex },
      { product: regex },
      { 'caseProducts.productName': regex },
      { eventSummary: regex },
      { 'reactions.verbatim': regex },
      { 'reactions.pt': regex },
      { 'patient.reference': regex },
      { 'reporter.name': regex },
      { narrative: regex },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortDirection };

  const [cases, total] = await Promise.all([
    Case.find(filter)
      .populate('assignedTo', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Case.countDocuments(filter),
  ]);

  return {
    cases,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

/**
 * Fetch case by MongoDB _id or caseNumber
 */
export async function getCaseById(idOrNumber) {
  let query = {};
  if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
    query = { $or: [{ _id: idOrNumber }, { caseNumber: idOrNumber.toUpperCase() }] };
  } else {
    query = { caseNumber: idOrNumber.toUpperCase() };
  }

  const caseDoc = await Case.findOne(query)
    .populate('assignedTo', 'name email roleId')
    .populate('assessment.reviewedBy', 'name email')
    .lean();

  return caseDoc;
}

/**
 * Create a new case record
 */
export async function createCase(data, user) {
  const caseNumber = data.caseNumber || (await generateCaseNumber());

  // Default receiptDate validation: cannot be in future
  if (data.receiptDate && new Date(data.receiptDate) > new Date()) {
    throw new ValidationError('Receipt date cannot be in the future.');
  }

  const caseDoc = new Case({
    ...data,
    caseNumber,
    version: 1,
    receiptDate: data.receiptDate || new Date(),
    initialReceiptDate: data.initialReceiptDate || data.receiptDate || new Date(),
  });

  await caseDoc.save();

  await recordAudit({
    actor: user?._id,
    action: 'CASE_CREATE',
    entityType: 'case',
    entityId: caseDoc._id,
    summary: `Created case ${caseDoc.caseNumber} (${caseDoc.product} - ${caseDoc.eventSummary})`,
    meta: {
      caseNumber: caseDoc.caseNumber,
      source: caseDoc.source,
      priority: caseDoc.priority,
      status: caseDoc.status,
    },
  });

  return caseDoc;
}

/**
 * Calculate field diffs for sensitive fields
 */
function calculateFieldDiffs(oldDoc, newUpdates) {
  const diffs = [];
  const fieldsToCheck = [
    { key: 'status', label: 'Workflow Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'seriousness', label: 'Seriousness' },
    { key: 'narrative', label: 'Clinical Narrative' },
    { key: 'product', label: 'Suspect Product' },
    { key: 'eventSummary', label: 'Event Summary' },
  ];

  for (const field of fieldsToCheck) {
    if (newUpdates[field.key] !== undefined) {
      const oldVal = oldDoc[field.key];
      const newVal = newUpdates[field.key];
      if (String(oldVal || '') !== String(newVal || '')) {
        diffs.push({
          field: field.key,
          label: field.label,
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    }
  }

  // Check assignedTo
  if (newUpdates.assignedTo !== undefined) {
    const oldAssignee = oldDoc.assignedTo?.toString() || null;
    const newAssignee = newUpdates.assignedTo?.toString() || null;
    if (oldAssignee !== newAssignee) {
      diffs.push({
        field: 'assignedTo',
        label: 'Assignee',
        oldValue: oldAssignee,
        newValue: newAssignee,
      });
    }
  }

  // Check seriousnessFlags
  if (newUpdates.seriousnessFlags) {
    const oldFlags = oldDoc.seriousnessFlags || {};
    const newFlags = newUpdates.seriousnessFlags;
    const changedSubfields = [];
    for (const flagKey of ['death', 'lifeThreatening', 'hospitalization', 'disability', 'congenitalAnomaly', 'otherMedicallyImportant']) {
      if (oldFlags[flagKey] !== newFlags[flagKey]) {
        changedSubfields.push(`${flagKey}: ${oldFlags[flagKey]} → ${newFlags[flagKey]}`);
      }
    }
    if (changedSubfields.length > 0) {
      diffs.push({
        field: 'seriousnessFlags',
        label: 'Seriousness Criteria',
        oldValue: oldFlags,
        newValue: newFlags,
        summary: changedSubfields.join(', '),
      });
    }
  }

  return diffs;
}

/**
 * Update case with Optimistic Concurrency Control & Field-Level Audit
 */
export async function updateCase(idOrNumber, updateData, user) {
  let query = {};
  if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
    query = { $or: [{ _id: idOrNumber }, { caseNumber: idOrNumber.toUpperCase() }] };
  } else {
    query = { caseNumber: idOrNumber.toUpperCase() };
  }

  const caseDoc = await Case.findOne(query);
  if (!caseDoc) {
    return null;
  }

  // 1. Closed Case Rule: Closed cases are read-only unless reopened by admin
  if (caseDoc.status === 'closed') {
    const isReopening = updateData.status && updateData.status !== 'closed';
    const userRole = user?.role?.name || user?.roleId?.name || user?.role;
    if (!isReopening || userRole !== 'admin') {
      throw new ForbiddenError(
        'Closed cases are archived and read-only. Edits are strictly prohibited under pharmacovigilance compliance.',
      );
    }
  }

  // 2. Authorization check: Processors edit only assigned cases in editable stages
  const userRole = user?.role?.name || user?.roleId?.name || user?.role;
  const isProcessor = userRole === 'reviewer' || userRole === 'data_entry';
  if (isProcessor) {
    const isAssigned = caseDoc.assignedTo && caseDoc.assignedTo.toString() === user._id.toString();
    if (!isAssigned) {
      throw new ForbiddenError('You can only modify cases assigned directly to your workspace.');
    }
  }

  // 3. Optimistic Concurrency Check
  if (updateData.version !== undefined && updateData.version !== caseDoc.version) {
    // Reload full case with populated fields to give client context
    const currentFull = await Case.findById(caseDoc._id).populate('assignedTo', 'name email');
    throw new ConflictError(
      `Concurrent Edit Conflict: This case has been updated to version ${caseDoc.version} by another user since you loaded it.`,
      currentFull,
    );
  }

  // 4. Calculate Field-Level Diffs
  const diffs = calculateFieldDiffs(caseDoc.toObject(), updateData);

  // 5. Apply Updates
  const allowedDirectFields = [
    'priority',
    'status',
    'country',
    'assignedTo',
    'regulatoryDueDate',
    'receiptDate',
    'source',
    'patient',
    'reporter',
    'caseProducts',
    'reactions',
    'narrative',
    'seriousness',
    'seriousnessFlags',
    'assessment',
    'workflow',
    'product',
    'eventSummary',
  ];

  for (const field of allowedDirectFields) {
    if (updateData[field] !== undefined) {
      caseDoc[field] = updateData[field];
    }
  }

  // Increment version for optimistic concurrency
  caseDoc.version = (caseDoc.version || 1) + 1;

  await caseDoc.save();

  // 6. Record Audit Event with Field Diffs and Reason
  const changeReason = updateData.changeReason || 'Clinical case update';
  await recordAudit({
    actor: user?._id,
    action: 'CASE_UPDATE',
    entityType: 'case',
    entityId: caseDoc._id,
    summary: `Case ${caseDoc.caseNumber} updated to v${caseDoc.version}: ${diffs.length} field(s) changed. Reason: ${changeReason}`,
    meta: {
      caseNumber: caseDoc.caseNumber,
      version: caseDoc.version,
      changeReason,
      diffs,
    },
  });

  return caseDoc;
}

/**
 * Assign or reassign case to user
 */
export async function assignCase(idOrNumber, targetUserId, reason, user) {
  let query = {};
  if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
    query = { $or: [{ _id: idOrNumber }, { caseNumber: idOrNumber.toUpperCase() }] };
  } else {
    query = { caseNumber: idOrNumber.toUpperCase() };
  }

  const caseDoc = await Case.findOne(query);
  if (!caseDoc) {
    return null;
  }

  if (caseDoc.status === 'closed') {
    throw new ForbiddenError('Cannot reassign a closed case.');
  }

  let assigneeName = 'Unassigned';
  if (targetUserId) {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new ValidationError('Target assignee user does not exist.');
    }
    assigneeName = targetUser.name;
    caseDoc.assignedTo = targetUser._id;
  } else {
    caseDoc.assignedTo = null;
  }

  caseDoc.version = (caseDoc.version || 1) + 1;
  await caseDoc.save();

  await recordAudit({
    actor: user?._id,
    action: 'CASE_ASSIGNMENT',
    entityType: 'case',
    entityId: caseDoc._id,
    summary: `Assigned case ${caseDoc.caseNumber} to ${assigneeName}. Reason: ${reason || 'Workload distribution'}`,
    meta: {
      caseNumber: caseDoc.caseNumber,
      assignedTo: caseDoc.assignedTo,
      reason,
    },
  });

  return caseDoc;
}

/**
 * Evaluate if case meets all requirements for closure
 */
export function validateCaseClosureReadiness(caseDoc) {
  const missingRequirements = [];

  // 1. Patient Identifiability
  const hasPatient =
    caseDoc.patient?.reference ||
    caseDoc.patient?.age != null ||
    (caseDoc.patient?.sex && caseDoc.patient.sex !== 'Unknown') ||
    caseDoc.patientAge != null;
  if (!hasPatient) {
    missingRequirements.push('Patient Identifiability (Reference, Age, or Sex)');
  }

  // 2. Suspect Product
  const hasProduct =
    (caseDoc.caseProducts && caseDoc.caseProducts.length > 0) || !!caseDoc.product;
  if (!hasProduct) {
    missingRequirements.push('At least one suspect medicinal product');
  }

  // 3. Adverse Reaction
  const hasReaction =
    (caseDoc.reactions && caseDoc.reactions.length > 0) || !!caseDoc.eventSummary;
  if (!hasReaction) {
    missingRequirements.push('At least one reported adverse reaction');
  }

  // 4. Clinical Narrative
  if (!caseDoc.narrative || !caseDoc.narrative.trim()) {
    missingRequirements.push('Clinical Case Narrative');
  }

  // 5. Medical Review & Causality Assessment
  const assessment = caseDoc.assessment || {};
  if (!assessment.companyCausality || assessment.companyCausality === 'Unassessed') {
    missingRequirements.push('Company Causality Assessment (Medical Review)');
  }

  return {
    isReady: missingRequirements.length === 0,
    missingRequirements,
  };
}

/**
 * Close case with required workflow completion checks
 */
export async function closeCase(idOrNumber, closureReason, user) {
  if (!closureReason || !closureReason.trim()) {
    throw new ValidationError('A non-empty closure reason is strictly required to close a safety case.');
  }

  let query = {};
  if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
    query = { $or: [{ _id: idOrNumber }, { caseNumber: idOrNumber.toUpperCase() }] };
  } else {
    query = { caseNumber: idOrNumber.toUpperCase() };
  }

  const caseDoc = await Case.findOne(query);
  if (!caseDoc) {
    return null;
  }

  if (caseDoc.status === 'closed') {
    throw new ValidationError('This case is already closed.');
  }

  // Verify all required workflow steps are complete
  const readiness = validateCaseClosureReadiness(caseDoc);
  if (!readiness.isReady) {
    throw new ValidationError(
      `Cannot close case: Outstanding workflow items must be completed: ${readiness.missingRequirements.join(', ')}`,
      readiness.missingRequirements,
    );
  }

  caseDoc.status = 'closed';
  caseDoc.closedAt = new Date();
  caseDoc.closureReason = closureReason.trim();
  caseDoc.version = (caseDoc.version || 1) + 1;

  await caseDoc.save();

  await recordAudit({
    actor: user?._id,
    action: 'CASE_CLOSED',
    entityType: 'case',
    entityId: caseDoc._id,
    summary: `Case ${caseDoc.caseNumber} closed by ${user?.name || 'User'}. Reason: ${closureReason}`,
    meta: {
      caseNumber: caseDoc.caseNumber,
      closedAt: caseDoc.closedAt,
      closureReason: caseDoc.closureReason,
      version: caseDoc.version,
    },
  });

  return caseDoc;
}

/**
 * Fetch case audit history
 */
export async function getCaseHistory(idOrNumber) {
  let caseDoc = null;
  if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
    caseDoc = await Case.findOne({
      $or: [{ _id: idOrNumber }, { caseNumber: idOrNumber.toUpperCase() }],
    }).select('caseNumber');
  } else {
    caseDoc = await Case.findOne({ caseNumber: idOrNumber.toUpperCase() }).select('caseNumber');
  }

  if (!caseDoc) {
    return [];
  }

  const query = {
    $or: [
      { entityId: String(caseDoc._id) },
      { 'details.caseNumber': caseDoc.caseNumber },
      { 'meta.caseNumber': caseDoc.caseNumber },
      { summary: new RegExp(caseDoc.caseNumber, 'i') },
    ],
  };

  const rawEvents = await AuditEvent.find(query)
    .sort({ timestamp: -1, _id: -1 })
    .lean();

  return rawEvents.map((evt) => ({
    ...evt,
    meta: evt.details || {},
  }));
}

/**
 * Export cases to CSV string
 */
export async function exportCasesToCsv(queryParams = {}, user = null) {
  const result = await getCases({ ...queryParams, limit: 1000, page: 1 }, user);
  const cases = result.cases || [];

  const headers = [
    'Case Number',
    'Status',
    'Priority',
    'Seriousness',
    'Product',
    'Reaction',
    'Patient Reference',
    'Patient Age',
    'Patient Gender',
    'Reporter',
    'Assigned To',
    'Receipt Date',
    'Regulatory Due Date',
    'Closed At',
  ];

  const escapeCsv = (str) => {
    if (str == null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = cases.map((c) => [
    escapeCsv(c.caseNumber),
    escapeCsv(c.status),
    escapeCsv(c.priority),
    escapeCsv(c.seriousness),
    escapeCsv(c.product || c.caseProducts?.[0]?.productName || ''),
    escapeCsv(c.eventSummary || c.reactions?.[0]?.verbatim || ''),
    escapeCsv(c.patient?.reference || ''),
    escapeCsv(c.patient?.age != null ? c.patient.age : c.patientAge != null ? c.patientAge : ''),
    escapeCsv(c.patient?.sex || c.patientGender || ''),
    escapeCsv(c.reporter?.name || ''),
    escapeCsv(c.assignedTo?.name || 'Unassigned'),
    escapeCsv(c.receiptDate ? new Date(c.receiptDate).toISOString().split('T')[0] : ''),
    escapeCsv(c.regulatoryDueDate ? new Date(c.regulatoryDueDate).toISOString().split('T')[0] : ''),
    escapeCsv(c.closedAt ? new Date(c.closedAt).toISOString() : ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}
