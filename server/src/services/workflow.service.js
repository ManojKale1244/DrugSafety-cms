import mongoose from 'mongoose';
import { WorkflowDefinition } from '../models/WorkflowDefinition.js';
import { WorkflowTask } from '../models/WorkflowTask.js';
import { WorkflowHistory } from '../models/WorkflowHistory.js';
import { Case } from '../models/Case.js';
import { MedicalAssessment } from '../models/MedicalAssessment.js';
import { User } from '../models/User.js';
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

export const CANONICAL_STAGES = [
  'NEW',
  'DATA_ENTRY',
  'MEDICAL_CODING',
  'MEDICAL_REVIEW',
  'QUALITY_REVIEW',
  'REGULATORY_REPORTING',
  'FINAL_REVIEW',
  'CLOSED',
];

/**
 * Normalizes legacy or lowercase stage identifiers to canonical uppercase.
 */
export function normalizeStage(stageStr) {
  if (!stageStr) return 'NEW';
  const s = String(stageStr).toUpperCase();
  const map = {
    NEW: 'NEW',
    TRIAGE: 'DATA_ENTRY',
    DATA_ENTRY: 'DATA_ENTRY',
    MEDICAL_CODING: 'MEDICAL_CODING',
    CODING: 'MEDICAL_CODING',
    MEDICAL_REVIEW: 'MEDICAL_REVIEW',
    QUALITY_REVIEW: 'QUALITY_REVIEW',
    READY_FOR_SUBMISSION: 'REGULATORY_REPORTING',
    REGULATORY_REPORTING: 'REGULATORY_REPORTING',
    SUBMITTED: 'FINAL_REVIEW',
    FINAL_REVIEW: 'FINAL_REVIEW',
    COMPLETED: 'FINAL_REVIEW',
    CLOSED: 'CLOSED',
  };
  return map[s] || s;
}

/**
 * Ensures the default workflow configuration exists in MongoDB.
 */
export async function getOrCreateDefaultWorkflow() {
  let def = await WorkflowDefinition.findOne({ isDefault: true });
  if (def) return def;

  const defaultTransitions = [
    // ── Forward Standard Transitions ──────────────────────────
    {
      from: 'NEW',
      to: 'DATA_ENTRY',
      allowedRoles: ['admin', 'case_manager', 'data_entry'],
      requiredChecks: ['MINIMUM_CRITERIA'],
      requiresReason: false,
      isBackward: false,
      label: 'Proceed to Data Entry',
    },
    {
      from: 'DATA_ENTRY',
      to: 'MEDICAL_CODING',
      allowedRoles: ['admin', 'case_manager', 'data_entry'],
      requiredChecks: ['HAS_PATIENT', 'HAS_PRODUCT', 'HAS_REACTION', 'HAS_NARRATIVE'],
      requiresReason: false,
      isBackward: false,
      label: 'Submit for Medical Coding',
    },
    {
      from: 'MEDICAL_CODING',
      to: 'MEDICAL_REVIEW',
      allowedRoles: ['admin', 'case_manager', 'data_entry', 'reviewer'],
      requiredChecks: ['ALL_REACTIONS_CODED'],
      requiresReason: false,
      isBackward: false,
      label: 'Submit for Medical Review',
    },
    {
      from: 'MEDICAL_REVIEW',
      to: 'QUALITY_REVIEW',
      allowedRoles: ['admin', 'case_manager', 'reviewer'],
      requiredChecks: ['MEDICAL_ASSESSMENT_SIGNED', 'ALL_REACTIONS_CODED'],
      requiresReason: false,
      isBackward: false,
      label: 'Submit for Quality Review',
    },
    {
      from: 'QUALITY_REVIEW',
      to: 'REGULATORY_REPORTING',
      allowedRoles: ['admin', 'case_manager', 'qa_specialist'],
      requiredChecks: ['MEDICAL_ASSESSMENT_SIGNED'],
      requiresReason: false,
      isBackward: false,
      label: 'Approve for Regulatory Reporting',
    },
    {
      from: 'REGULATORY_REPORTING',
      to: 'FINAL_REVIEW',
      allowedRoles: ['admin', 'case_manager', 'regulatory_affairs'],
      requiredChecks: [],
      requiresReason: false,
      isBackward: false,
      label: 'Submit for Final Review',
    },
    {
      from: 'FINAL_REVIEW',
      to: 'CLOSED',
      allowedRoles: ['admin', 'case_manager'],
      requiredChecks: ['CLOSURE_READINESS'],
      requiresReason: true,
      isBackward: false,
      label: 'Archive and Close Case',
    },

    // ── Backward "Return for Correction" Transitions (Reason Required) ─
    {
      from: 'DATA_ENTRY',
      to: 'NEW',
      allowedRoles: ['admin', 'case_manager', 'data_entry'],
      requiresReason: true,
      isBackward: true,
      label: 'Return to New (Intake Clarification)',
    },
    {
      from: 'MEDICAL_CODING',
      to: 'DATA_ENTRY',
      allowedRoles: ['admin', 'case_manager', 'data_entry', 'reviewer'],
      requiresReason: true,
      isBackward: true,
      label: 'Return for Data Correction',
    },
    {
      from: 'MEDICAL_REVIEW',
      to: 'MEDICAL_CODING',
      allowedRoles: ['admin', 'case_manager', 'reviewer'],
      requiresReason: true,
      isBackward: true,
      label: 'Return for Terminology Recoding',
    },
    {
      from: 'MEDICAL_REVIEW',
      to: 'DATA_ENTRY',
      allowedRoles: ['admin', 'case_manager', 'reviewer'],
      requiresReason: true,
      isBackward: true,
      label: 'Return for Verbatim/Demographics Correction',
    },
    {
      from: 'QUALITY_REVIEW',
      to: 'MEDICAL_REVIEW',
      allowedRoles: ['admin', 'case_manager', 'qa_specialist'],
      requiresReason: true,
      isBackward: true,
      label: 'Return to Medical Review for Query',
    },
    {
      from: 'QUALITY_REVIEW',
      to: 'DATA_ENTRY',
      allowedRoles: ['admin', 'case_manager', 'qa_specialist'],
      requiresReason: true,
      isBackward: true,
      label: 'Return to Data Entry for Quality Corrections',
    },
    {
      from: 'REGULATORY_REPORTING',
      to: 'QUALITY_REVIEW',
      allowedRoles: ['admin', 'case_manager', 'regulatory_affairs'],
      requiresReason: true,
      isBackward: true,
      label: 'Return to QA for Re-audit',
    },
    {
      from: 'FINAL_REVIEW',
      to: 'REGULATORY_REPORTING',
      allowedRoles: ['admin', 'case_manager'],
      requiresReason: true,
      isBackward: true,
      label: 'Return to Regulatory Reporting',
    },
    {
      from: 'FINAL_REVIEW',
      to: 'QUALITY_REVIEW',
      allowedRoles: ['admin', 'case_manager'],
      requiresReason: true,
      isBackward: true,
      label: 'Return to Quality Review',
    },
    {
      from: 'CLOSED',
      to: 'FINAL_REVIEW',
      allowedRoles: ['admin'],
      requiresReason: true,
      isBackward: true,
      label: 'Reopen Closed Case',
    },
  ];

  def = await WorkflowDefinition.create({
    name: 'Standard PV ICSR Workflow',
    description: 'ICH E2D, ICH E2A, and 21 CFR Part 11 compliant standard pharmacovigilance lifecycle',
    isDefault: true,
    stages: CANONICAL_STAGES,
    transitions: defaultTransitions,
  });

  return def;
}

/**
 * Evaluates required transition checks against a case and its medical assessment.
 */
export function evaluateCheck(checkKey, caseDoc, latestAssessment) {
  switch (checkKey) {
    case 'MINIMUM_CRITERIA': {
      const hasPatient = caseDoc.patient?.reference || caseDoc.patient?.age != null || (caseDoc.patient?.sex && caseDoc.patient.sex !== 'Unknown');
      const hasProduct = (caseDoc.caseProducts && caseDoc.caseProducts.length > 0) || !!caseDoc.product;
      const hasReaction = (caseDoc.reactions && caseDoc.reactions.length > 0) || !!caseDoc.eventSummary;
      const hasReporter = !!caseDoc.reporter?.name;
      const passed = hasPatient && hasProduct && hasReaction && hasReporter;
      return {
        key: checkKey,
        passed,
        description: 'ICH E2D 4-minimum criteria: Patient, Reporter, Suspect Product, and Reaction must be identifiable.',
        linkTab: 'patient',
      };
    }

    case 'HAS_PATIENT': {
      const passed = !!(caseDoc.patient?.reference || caseDoc.patient?.age != null || (caseDoc.patient?.sex && caseDoc.patient.sex !== 'Unknown') || caseDoc.patientAge != null);
      return {
        key: checkKey,
        passed,
        description: 'Patient demographics (Reference, Age, or Sex) must be documented.',
        linkTab: 'patient',
      };
    }

    case 'HAS_PRODUCT': {
      const passed = !!((caseDoc.caseProducts && caseDoc.caseProducts.length > 0) || caseDoc.product);
      return {
        key: checkKey,
        passed,
        description: 'At least one medicinal product must be recorded.',
        linkTab: 'products',
      };
    }

    case 'HAS_REACTION': {
      const passed = !!((caseDoc.reactions && caseDoc.reactions.length > 0) || caseDoc.eventSummary);
      return {
        key: checkKey,
        passed,
        description: 'At least one reported adverse reaction must be recorded.',
        linkTab: 'reactions',
      };
    }

    case 'HAS_NARRATIVE': {
      const passed = !!(caseDoc.narrative && caseDoc.narrative.trim().length > 0);
      return {
        key: checkKey,
        passed,
        description: 'Clinical case narrative must be documented.',
        linkTab: 'narrative',
      };
    }

    case 'ALL_REACTIONS_CODED': {
      const rxns = caseDoc.reactions || [];
      if (rxns.length === 0) {
        return { key: checkKey, passed: false, description: 'No reactions recorded to code.', linkTab: 'reactions' };
      }
      const uncoded = rxns.filter((r) => !r.pt || !r.pt.trim() || !r.meddraCode || !String(r.meddraCode).trim());
      const passed = uncoded.length === 0;
      return {
        key: checkKey,
        passed,
        description: passed
          ? 'All adverse reactions coded with MedDRA Preferred Terms.'
          : `${uncoded.length} adverse reaction(s) remain uncoded.`,
        linkTab: 'coding',
      };
    }

    case 'MEDICAL_ASSESSMENT_SIGNED': {
      const passed = latestAssessment && latestAssessment.status === 'SIGNED';
      return {
        key: checkKey,
        passed: !!passed,
        description: passed
          ? `Medical assessment v${latestAssessment.version} signed by ${latestAssessment.signedByName}.`
          : 'A signed medical review and causality assessment is required.',
        linkTab: 'assessment',
      };
    }

    case 'CLOSURE_READINESS': {
      const hasPatient = caseDoc.patient?.reference || caseDoc.patient?.age != null || (caseDoc.patient?.sex && caseDoc.patient.sex !== 'Unknown');
      const hasProduct = (caseDoc.caseProducts && caseDoc.caseProducts.length > 0) || !!caseDoc.product;
      const hasReaction = (caseDoc.reactions && caseDoc.reactions.length > 0) || !!caseDoc.eventSummary;
      const hasNarrative = !!(caseDoc.narrative && caseDoc.narrative.trim());
      const hasAssessment = latestAssessment && latestAssessment.status === 'SIGNED';
      const allCoded = !(caseDoc.reactions || []).some((r) => !r.pt || !r.meddraCode);

      const passed = hasPatient && hasProduct && hasReaction && hasNarrative && hasAssessment && allCoded;
      return {
        key: checkKey,
        passed,
        description: passed
          ? 'Case satisfies all clinical, coding, and audit criteria for archiving.'
          : 'Case has outstanding incomplete requirements for formal closure.',
        linkTab: 'overview',
      };
    }

    default:
      return { key: checkKey, passed: true, description: `Check ${checkKey} passed.`, linkTab: 'overview' };
  }
}

/**
 * Returns the current workflow status, allowed next transitions, checks, and history for a case.
 */
export async function getCaseWorkflowDetails(caseIdOrNumber) {
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

  const def = await getOrCreateDefaultWorkflow();
  const currentStage = normalizeStage(caseDoc.status);
  const latestAssessment = await MedicalAssessment.findOne({ caseId: caseDoc._id, isLatest: true }).lean();

  // Find all defined transitions originating from currentStage
  const candidateTransitions = def.transitions.filter((t) => t.from === currentStage);

  const allowedTransitions = candidateTransitions.map((t) => {
    const checkResults = (t.requiredChecks || []).map((ch) => evaluateCheck(ch, caseDoc, latestAssessment));
    const unmetChecks = checkResults.filter((ch) => !ch.passed);

    return {
      to: t.to,
      label: t.label || `Move to ${t.to}`,
      allowedRoles: t.allowedRoles,
      requiresReason: t.requiresReason,
      isBackward: t.isBackward,
      canRoute: unmetChecks.length === 0,
      checks: checkResults,
      unmetChecks,
    };
  });

  const history = await WorkflowHistory.find({ caseId: caseDoc._id })
    .sort({ at: -1 })
    .populate('by', 'name email')
    .lean();

  const activeTasks = await WorkflowTask.find({ caseId: caseDoc._id, status: { $in: ['pending', 'in_progress'] } })
    .populate('assignedTo', 'name email')
    .lean();

  return {
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    currentStage,
    stages: def.stages,
    allowedTransitions,
    history,
    activeTasks,
  };
}

/**
 * Validates transition, role permission, required checks, and executes atomic route.
 */
export async function routeCase(caseIdOrNumber, { targetStage, reason = '' } = {}, user, req = null) {
  if (!targetStage) {
    throw new ValidationError('A targetStage parameter is strictly required for routing a case.');
  }

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

  const fromStage = normalizeStage(caseDoc.status);
  const toStage = normalizeStage(targetStage);

  if (fromStage === toStage) {
    throw new ValidationError(`Case is already at stage "${fromStage}".`);
  }

  const def = await getOrCreateDefaultWorkflow();
  const transition = def.transitions.find((t) => t.from === fromStage && t.to === toStage);

  if (!transition) {
    throw new ValidationError(
      `Illegal transition: Direct transition from "${fromStage}" to "${toStage}" is not allowed under the active workflow definition.`,
    );
  }

  // Role validation
  const userRole = user?.role?.name || user?.roleName || user?.role || 'viewer';
  const isAdmin = userRole === 'admin' || user?.role?.permissions?.includes('*');

  if (!isAdmin && !transition.allowedRoles.includes(userRole)) {
    throw new ForbiddenError(
      `Your role "${userRole}" is not authorized to route this case from ${fromStage} to ${toStage}. Authorized roles: [${transition.allowedRoles.join(', ')}].`,
    );
  }

  // Reason check for backward transitions or where required
  if ((transition.requiresReason || transition.isBackward) && (!reason || !reason.trim())) {
    throw new ValidationError(
      `A non-empty justification reason is strictly required under pharmacovigilance compliance to route case from ${fromStage} to ${toStage} (${transition.isBackward ? 'Return for Correction' : 'Gate Approval'}).`,
    );
  }

  // Required checks validation
  const latestAssessment = await MedicalAssessment.findOne({ caseId: caseDoc._id, isLatest: true });
  const checkResults = (transition.requiredChecks || []).map((ch) => evaluateCheck(ch, caseDoc, latestAssessment));
  const unmetChecks = checkResults.filter((ch) => !ch.passed);

  if (unmetChecks.length > 0) {
    const errorDetails = unmetChecks.map((u) => u.description).join('; ');
    throw new ValidationError(
      `Transition blocked: Unmet required checks: ${errorDetails}`,
      unmetChecks,
    );
  }

  // ── ATOMIC EXECUTION (Mongoose Session / Resilient execution) ────────
  let session = null;
  const isReplicaSet = mongoose.connection.client?.topology?.description?.type?.includes('ReplicaSet');

  if (isReplicaSet) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    const opts = session ? { session } : {};

    // 1. Update Case
    caseDoc.status = toStage;
    if (toStage === 'CLOSED') {
      caseDoc.closedAt = new Date();
      caseDoc.closureReason = reason.trim();
    }
    caseDoc.version = (caseDoc.version || 1) + 1;
    await caseDoc.save(opts);

    // 2. Complete previous pending tasks for this case
    await WorkflowTask.updateMany(
      { caseId: caseDoc._id, status: { $in: ['pending', 'in_progress'] } },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          completedBy: user._id,
          completedByName: user.name || 'System',
        },
      },
      opts,
    );

    // 3. Create new task for target stage (unless CLOSED)
    let newTask = null;
    if (toStage !== 'CLOSED') {
      newTask = await WorkflowTask.create(
        [
          {
            caseId: caseDoc._id,
            caseNumber: caseDoc.caseNumber,
            stage: toStage,
            title: `${toStage.replace(/_/g, ' ')} for Case ${caseDoc.caseNumber}`,
            assignedTo: caseDoc.assignedTo || null,
            assignedToName: caseDoc.assignedTo ? (await User.findById(caseDoc.assignedTo).select('name').lean())?.name || 'Unassigned' : 'Unassigned',
            priority: caseDoc.priority || 'medium',
            dueAt: caseDoc.regulatoryDueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'pending',
          },
        ],
        opts,
      );
      newTask = newTask[0];
    }

    // 4. Create WorkflowHistory record
    const historyEntry = await WorkflowHistory.create(
      [
        {
          caseId: caseDoc._id,
          caseNumber: caseDoc.caseNumber,
          from: fromStage,
          to: toStage,
          by: user._id,
          byName: user.name || 'User',
          byRole: userRole,
          reason: reason.trim(),
          isBackward: transition.isBackward,
          at: new Date(),
        },
      ],
      opts,
    );

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    // 5. 21 CFR Part 11 Audit Record
    await recordAudit({
      actor: user,
      action: 'CASE_WORKFLOW_ROUTED',
      entity: 'Case',
      entityId: String(caseDoc._id),
      summary: `Case ${caseDoc.caseNumber} routed from ${fromStage} → ${toStage} by ${user.name} (${userRole}). ${reason ? `Reason: ${reason}` : ''}`,
      details: {
        caseNumber: caseDoc.caseNumber,
        from: fromStage,
        to: toStage,
        isBackward: transition.isBackward,
        reason: reason.trim(),
        version: caseDoc.version,
      },
      req,
    });

    return {
      case: caseDoc,
      from: fromStage,
      to: toStage,
      transition,
      newTask,
      history: historyEntry[0],
    };
  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    throw err;
  }
}

/**
 * Retrieves tasks assigned to the current user.
 */
export async function getMyTasks(user) {
  const tasks = await WorkflowTask.find({
    assignedTo: user._id,
    status: { $in: ['pending', 'in_progress'] },
  })
    .sort({ dueAt: 1, createdAt: -1 })
    .populate('caseId', 'priority product eventSummary status regulatoryDueDate')
    .lean();

  return tasks;
}

/**
 * Retrieves all team tasks and computes workload distribution bars per user.
 */
export async function getTeamTasks() {
  const activeTasks = await WorkflowTask.find({
    status: { $in: ['pending', 'in_progress'] },
  })
    .sort({ dueAt: 1, createdAt: -1 })
    .populate('assignedTo', 'name email role')
    .populate('caseId', 'priority product eventSummary status regulatoryDueDate')
    .lean();

  // Aggregate workload per user
  const userWorkloadMap = new Map();
  for (const t of activeTasks) {
    const userId = t.assignedTo?._id ? String(t.assignedTo._id) : 'unassigned';
    const userName = t.assignedTo?.name || 'Unassigned';

    if (!userWorkloadMap.has(userId)) {
      userWorkloadMap.set(userId, {
        userId,
        name: userName,
        role: t.assignedTo?.role || '',
        totalTasks: 0,
        stages: {},
      });
    }

    const entry = userWorkloadMap.get(userId);
    entry.totalTasks++;
    entry.stages[t.stage] = (entry.stages[t.stage] || 0) + 1;
  }

  return {
    totalActiveTasks: activeTasks.length,
    tasks: activeTasks,
    workload: Array.from(userWorkloadMap.values()).sort((a, b) => b.totalTasks - a.totalTasks),
  };
}

/**
 * Reassigns a task to another user (Manager only).
 */
export async function reassignTask(taskId, { assignedTo, reason = '' } = {}, user, req = null) {
  const task = await WorkflowTask.findById(taskId);
  if (!task) {
    throw new NotFoundError(`Task not found: ${taskId}`);
  }

  const targetUser = await User.findById(assignedTo);
  if (!targetUser) {
    throw new NotFoundError(`Target assignee user not found: ${assignedTo}`);
  }

  const oldAssigneeName = task.assignedToName;
  task.assignedTo = targetUser._id;
  task.assignedToName = targetUser.name;
  await task.save();

  // Update associated Case assignee
  await Case.findByIdAndUpdate(task.caseId, {
    assignedTo: targetUser._id,
  });

  await recordAudit({
    actor: user,
    action: 'TASK_REASSIGNED',
    entity: 'WorkflowTask',
    entityId: String(task._id),
    summary: `Task ${task.title} reassigned from ${oldAssigneeName} to ${targetUser.name} by ${user.name}. ${reason ? `Reason: ${reason}` : ''}`,
    details: {
      taskId: String(task._id),
      caseNumber: task.caseNumber,
      previousAssignee: oldAssigneeName,
      newAssignee: targetUser.name,
      reason,
    },
    req,
  });

  return task;
}

