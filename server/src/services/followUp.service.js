import mongoose from 'mongoose';
import { FollowUp } from '../models/FollowUp.js';
import { Case } from '../models/Case.js';
import { CaseAmendment } from '../models/CaseAmendment.js';
import { WorkflowTask } from '../models/WorkflowTask.js';
import { auditTrail } from '../utils/audit.js';

/**
 * Calculates a structured diff between old case data and new updates.
 *
 * @param {Object} oldDoc
 * @param {Object} updates
 * @returns {Array<{ field: string, label: string, oldValue: any, newValue: any }>}
 */
export function computeFollowUpDiff(oldDoc, updates) {
  const diffs = [];

  const fieldDefinitions = [
    { key: 'narrative', label: 'Clinical Narrative', path: 'narrative' },
    { key: 'patient.age', label: 'Patient Age', path: 'patient.age' },
    { key: 'patient.sex', label: 'Patient Sex', path: 'patient.sex' },
    { key: 'patient.weight', label: 'Patient Weight', path: 'patient.weight' },
    { key: 'patient.history', label: 'Medical History', path: 'patient.history' },
    { key: 'reporter.contact', label: 'Reporter Contact', path: 'reporter.contact' },
    { key: 'seriousness', label: 'Case Seriousness', path: 'seriousness' },
  ];

  for (const def of fieldDefinitions) {
    const keys = def.path.split('.');
    let oldVal = oldDoc;
    let newVal = updates;

    for (const k of keys) {
      oldVal = oldVal ? oldVal[k] : undefined;
      newVal = newVal ? newVal[k] : undefined;
    }

    if (newVal !== undefined && String(oldVal || '') !== String(newVal || '')) {
      diffs.push({
        field: def.path,
        label: def.label,
        oldValue: oldVal ?? null,
        newValue: newVal,
      });
    }
  }

  // Reactions changes
  if (updates.reactions && Array.isArray(updates.reactions)) {
    const oldReactions = oldDoc.reactions || [];
    const newReactions = updates.reactions;

    newReactions.forEach((nr, idx) => {
      const or = oldReactions[idx] || {};
      if (nr.outcome && nr.outcome !== or.outcome) {
        diffs.push({
          field: `reactions[${idx}].outcome`,
          label: `Reaction (${nr.verbatim || or.verbatim || idx + 1}) Outcome`,
          oldValue: or.outcome || 'unknown',
          newValue: nr.outcome,
        });
      }
      if (nr.causality && nr.causality !== or.causality) {
        diffs.push({
          field: `reactions[${idx}].causality`,
          label: `Reaction (${nr.verbatim || or.verbatim || idx + 1}) Causality`,
          oldValue: or.causality || 'Not Assessed',
          newValue: nr.causality,
        });
      }
    });
  }

  // Fallback for custom updated fields if not explicitly caught
  if (updates && typeof updates === 'object') {
    Object.keys(updates).forEach((k) => {
      if (!['narrative', 'patient', 'reporter', 'reactions', 'seriousness', 'attachments'].includes(k)) {
        if (updates[k] !== undefined && String(oldDoc[k] || '') !== String(updates[k] || '')) {
          diffs.push({
            field: k,
            label: k.charAt(0).toUpperCase() + k.slice(1),
            oldValue: oldDoc[k] ?? null,
            newValue: updates[k],
          });
        }
      }
    });
  }

  return diffs;
}

/**
 * Creates a new follow-up inquiry for a safety case.
 */
export async function createFollowUp(caseId, data, user = null, req = null) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) {
    const error = new Error('Case not found');
    error.statusCode = 404;
    throw error;
  }

  if (!data.question || !data.question.trim()) {
    const error = new Error('Follow-up question is required');
    error.statusCode = 400;
    throw error;
  }

  if (!data.dueDate) {
    const error = new Error('Follow-up due date is required');
    error.statusCode = 400;
    throw error;
  }

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await FollowUp.countDocuments();
  const followUpNumber = `FU-${todayStr}-${String(count + 1).padStart(4, '0')}`;

  const initialCorrespondence = {
    attemptNumber: 1,
    date: new Date(),
    channel: data.recipient?.method || 'EMAIL',
    sentBy: user?._id || null,
    sentByName: user?.name || 'Safety Officer',
    notes: data.notes || 'Initial inquiry dispatched to recipient.',
    content: data.question,
  };

  const followUp = await FollowUp.create({
    followUpNumber,
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    requestedBy: user?._id || null,
    requestedByName: user?.name || 'Safety Officer',
    recipient: {
      name: data.recipient?.name || caseDoc.reporter?.name || 'Primary Reporter',
      role: data.recipient?.role || caseDoc.reporter?.qualification || 'Reporter',
      contact: data.recipient?.contact || caseDoc.reporter?.contact || '',
      method: data.recipient?.method || 'EMAIL',
    },
    question: data.question.trim(),
    dueDate: new Date(data.dueDate),
    status: 'OPEN',
    correspondence: [initialCorrespondence],
    attemptsCount: 1,
    linkedAttachments: data.attachments || [],
  });

  if (auditTrail) {
    await auditTrail({
      action: 'CREATE',
      entity: 'FollowUp',
      entityId: followUp._id,
      user,
      req,
      details: {
        followUpNumber,
        caseNumber: caseDoc.caseNumber,
        dueDate: data.dueDate,
        recipient: followUp.recipient.name,
      },
    });
  }

  return followUp;
}

/**
 * Retrieves all follow-up inquiries and statistics for a case.
 */
export async function getCaseFollowUps(caseId) {
  const followUps = await FollowUp.find({ caseId })
    .populate('requestedBy', 'name email role')
    .populate('receivedBy', 'name email role')
    .sort({ createdAt: -1 })
    .lean();

  const now = new Date();
  const stats = {
    total: followUps.length,
    openCount: followUps.filter((f) => f.status === 'OPEN').length,
    receivedCount: followUps.filter((f) => f.status === 'RECEIVED').length,
    overdueCount: followUps.filter((f) => f.status === 'OPEN' && new Date(f.dueDate) < now).length,
    totalAttempts: followUps.reduce((acc, curr) => acc + (curr.attemptsCount || 1), 0),
  };

  return { followUps, stats };
}

/**
 * Retrieves a single follow-up inquiry by ID.
 */
export async function getFollowUpById(followUpId) {
  const followUp = await FollowUp.findById(followUpId)
    .populate('requestedBy', 'name email role')
    .populate('receivedBy', 'name email role')
    .lean();

  if (!followUp) {
    const error = new Error('Follow-up not found');
    error.statusCode = 404;
    throw error;
  }

  return followUp;
}

/**
 * Logs an additional contact attempt or reminder for an open follow-up.
 */
export async function addCorrespondenceAttempt(followUpId, data, user = null, req = null) {
  const followUp = await FollowUp.findById(followUpId);
  if (!followUp) {
    const error = new Error('Follow-up not found');
    error.statusCode = 404;
    throw error;
  }

  if (followUp.status !== 'OPEN') {
    const error = new Error(`Cannot log attempt for follow-up in status ${followUp.status}`);
    error.statusCode = 400;
    throw error;
  }

  const nextAttemptNumber = (followUp.correspondence?.length || 0) + 1;

  const attempt = {
    attemptNumber: nextAttemptNumber,
    date: new Date(),
    channel: data.channel || followUp.recipient.method || 'EMAIL',
    sentBy: user?._id || null,
    sentByName: user?.name || 'Safety Officer',
    notes: data.notes || `Contact attempt #${nextAttemptNumber}`,
    content: data.content || followUp.question,
  };

  followUp.correspondence.push(attempt);
  followUp.attemptsCount = followUp.correspondence.length;
  await followUp.save();

  if (auditTrail) {
    await auditTrail({
      action: 'UPDATE',
      entity: 'FollowUp',
      entityId: followUp._id,
      user,
      req,
      details: {
        attemptNumber: nextAttemptNumber,
        channel: attempt.channel,
        followUpNumber: followUp.followUpNumber,
      },
    });
  }

  return followUp;
}

/**
 * Updates status or parameters of a follow-up (e.g. CLOSED, NO_RESPONSE).
 */
export async function updateFollowUp(followUpId, updateData, user = null, req = null) {
  const followUp = await FollowUp.findById(followUpId);
  if (!followUp) {
    const error = new Error('Follow-up not found');
    error.statusCode = 404;
    throw error;
  }

  if (updateData.status) {
    followUp.status = updateData.status;
  }
  if (updateData.dueDate) {
    followUp.dueDate = new Date(updateData.dueDate);
  }

  await followUp.save();

  if (auditTrail) {
    await auditTrail({
      action: 'UPDATE',
      entity: 'FollowUp',
      entityId: followUp._id,
      user,
      req,
      details: {
        updatedFields: Object.keys(updateData),
        followUpNumber: followUp.followUpNumber,
      },
    });
  }

  return followUp;
}

/**
 * Receives follow-up response information:
 * - Creates an immutable snapshot of original case data as a CaseAmendment.
 * - Increments Case version (never overwrites original history).
 * - Applies changes to Case.
 * - Automatically reopens review task if configured.
 * - Updates FollowUp status to 'RECEIVED'.
 */
export async function receiveFollowUpInfo(followUpId, payload, user = null, req = null) {
  const followUp = await FollowUp.findById(followUpId);
  if (!followUp) {
    const error = new Error('Follow-up not found');
    error.statusCode = 404;
    throw error;
  }

  if (followUp.status === 'RECEIVED') {
    const error = new Error('Follow-up response has already been received');
    error.statusCode = 400;
    throw error;
  }

  const caseDoc = await Case.findById(followUp.caseId);
  if (!caseDoc) {
    const error = new Error('Associated Case not found');
    error.statusCode = 404;
    throw error;
  }

  const previousVersion = caseDoc.version || 1;
  const newVersion = previousVersion + 1;

  // 1. Capture clean snapshot of original case BEFORE updates
  const originalSnapshot = JSON.parse(JSON.stringify(caseDoc.toObject ? caseDoc.toObject() : caseDoc));

  const updatedFields = payload.updatedFields || {};

  // 2. Compute field-level diff
  const diff = computeFollowUpDiff(originalSnapshot, updatedFields);

  // 3. Apply updates to the Case
  if (updatedFields.narrative) {
    // Append follow-up narrative clearly timestamped
    const fuHeader = `\n\n--- Follow-Up Response (${followUp.followUpNumber} / ${new Date().toLocaleDateString()}) ---\n`;
    caseDoc.narrative = `${caseDoc.narrative || ''}${fuHeader}${updatedFields.narrative}`.trim();
  }

  if (updatedFields.patient) {
    if (updatedFields.patient.age !== undefined) caseDoc.patient.age = updatedFields.patient.age;
    if (updatedFields.patient.sex) caseDoc.patient.sex = updatedFields.patient.sex;
    if (updatedFields.patient.weight !== undefined) caseDoc.patient.weight = updatedFields.patient.weight;
    if (updatedFields.patient.history) caseDoc.patient.history = updatedFields.patient.history;
  }

  if (updatedFields.reactions && Array.isArray(updatedFields.reactions)) {
    updatedFields.reactions.forEach((newRxn, idx) => {
      if (caseDoc.reactions[idx]) {
        if (newRxn.outcome) caseDoc.reactions[idx].outcome = newRxn.outcome;
        if (newRxn.causality) caseDoc.reactions[idx].causality = newRxn.causality;
        if (newRxn.stopDate) caseDoc.reactions[idx].stopDate = new Date(newRxn.stopDate);
      }
    });
  }

  if (updatedFields.seriousness) {
    caseDoc.seriousness = updatedFields.seriousness;
  }

  // Append new attachments
  if (payload.linkedAttachments && Array.isArray(payload.linkedAttachments)) {
    payload.linkedAttachments.forEach((att) => {
      caseDoc.attachments.push({
        name: att.name,
        url: att.url || '',
        category: 'Follow-Up Document',
        uploadedAt: new Date(),
      });
    });
  }

  // Increment version on Case
  caseDoc.version = newVersion;

  // 4. Reopen Review Task if configured
  const shouldReopen = payload.reopenReview !== false; // Default true
  let reopenedTask = null;

  if (shouldReopen) {
    // If case was closed or completed, route back to medical review
    if (['closed', 'completed', 'submitted', 'ready_for_submission'].includes(caseDoc.status.toLowerCase())) {
      caseDoc.status = 'medical_review';
    }

    if (caseDoc.workflow) {
      caseDoc.workflow.medicalReviewCompleted = false;
    }

    reopenedTask = await WorkflowTask.create({
      caseId: caseDoc._id,
      caseNumber: caseDoc.caseNumber,
      stage: 'MEDICAL_REVIEW',
      title: `Follow-Up Response Review (${followUp.followUpNumber})`,
      assignedTo: caseDoc.assignedTo || user?._id || null,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from receipt
      status: 'pending',
      priority: 'high',
    });
  }

  await caseDoc.save();

  // 5. Create immutable CaseAmendment record preserving original snapshot
  const amendment = await CaseAmendment.create({
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    version: newVersion,
    previousVersion,
    followUpId: followUp._id,
    followUpNumber: followUp.followUpNumber,
    amendmentType: 'FOLLOW_UP',
    reason: payload.summaryOfChanges || `Follow-up response received for ${followUp.followUpNumber}`,
    diff,
    snapshot: originalSnapshot,
    appliedBy: user?._id || null,
    appliedByName: user?.name || 'Safety Officer',
    appliedAt: new Date(),
  });

  // 6. Update FollowUp record
  followUp.status = 'RECEIVED';
  followUp.receivedAt = new Date();
  followUp.receivedBy = user?._id || null;
  followUp.receivedByName = user?.name || 'Safety Officer';
  followUp.receivedInfo = {
    rawResponse: payload.rawResponse || '',
    summaryOfChanges: payload.summaryOfChanges || '',
    updatedFields,
  };
  followUp.resultingCaseVersion = newVersion;
  followUp.reopenedReviewTask = shouldReopen;
  if (payload.linkedAttachments && Array.isArray(payload.linkedAttachments)) {
    followUp.linkedAttachments.push(...payload.linkedAttachments);
  }
  await followUp.save();

  // 7. Audit log
  if (auditTrail) {
    await auditTrail({
      action: 'UPDATE',
      entity: 'Case',
      entityId: caseDoc._id,
      user,
      req,
      details: {
        amendmentVersion: newVersion,
        previousVersion,
        followUpNumber: followUp.followUpNumber,
        diffCount: diff.length,
        reopenedReview: shouldReopen,
      },
    });
  }

  return {
    success: true,
    followUp,
    case: caseDoc,
    amendment,
    diff,
    reopenedTask,
  };
}

/**
 * Retrieves all amendments / version snapshots for a case.
 */
export async function getCaseAmendments(caseId) {
  const amendments = await CaseAmendment.find({ caseId })
    .populate('appliedBy', 'name email role')
    .sort({ version: -1 })
    .lean();

  return amendments;
}

