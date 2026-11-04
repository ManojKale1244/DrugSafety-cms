import mongoose from 'mongoose';
import { ReportingRule } from '../models/ReportingRule.js';
import { RegulatoryReport } from '../models/RegulatoryReport.js';
import { ComplianceSnapshot } from '../models/ComplianceSnapshot.js';
import { recordAudit } from '../utils/audit.js';
import { seedDefaultReportingRules, checkAndFlagOverdueReports } from './reporting.service.js';

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

/**
 * Calculates a field-by-field diff between two rule versions.
 */
function computeRuleDiff(oldRule, newRuleData) {
  const diffs = [];

  const compareField = (field, label, oldVal, newVal) => {
    const sOld = JSON.stringify(oldVal ?? null);
    const sNew = JSON.stringify(newVal ?? null);
    if (sOld !== sNew) {
      diffs.push({
        field,
        label,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  };

  compareField('name', 'Rule Title', oldRule.name, newRuleData.name);
  compareField('jurisdiction', 'Jurisdiction', oldRule.jurisdiction, newRuleData.jurisdiction);
  compareField('reportType', 'Report Type', oldRule.reportType, newRuleData.reportType);
  compareField('deadlineDays', 'Deadline (Days)', oldRule.deadlineDays, newRuleData.deadlineDays);
  compareField('description', 'Description', oldRule.description, newRuleData.description);

  if (newRuleData.conditions) {
    compareField(
      'conditions.seriousness',
      'Seriousness Filter',
      oldRule.conditions?.seriousness,
      newRuleData.conditions.seriousness,
    );
    compareField(
      'conditions.expectedness',
      'Expectedness Filter',
      oldRule.conditions?.expectedness,
      newRuleData.conditions.expectedness,
    );
    compareField(
      'conditions.seriousnessCriteria',
      'Specific Criteria',
      oldRule.conditions?.seriousnessCriteria,
      newRuleData.conditions.seriousnessCriteria,
    );
  }

  return diffs;
}

/**
 * Computes the overall compliance summary, on-time rate, jurisdiction breakdown,
 * overdue count, and upcoming statutory deadlines.
 */
export async function getComplianceSummary() {
  if (mongoose.connection.readyState === 1) {
    try {
      await seedDefaultReportingRules();
      await checkAndFlagOverdueReports();
    } catch {
      // ignore
    }
  }

  const now = new Date();
  const reports = await RegulatoryReport.find().lean();
  const rules = await ReportingRule.find({ active: true }).lean();

  let onTimeCount = 0;
  let lateCount = 0;
  let overdueCount = 0;
  let pendingCount = 0;

  const jurisdictionStats = {
    FDA: { total: 0, onTimeCount: 0, lateCount: 0, overdueCount: 0, pendingCount: 0 },
    EMA: { total: 0, onTimeCount: 0, lateCount: 0, overdueCount: 0, pendingCount: 0 },
    CDSCO: { total: 0, onTimeCount: 0, lateCount: 0, overdueCount: 0, pendingCount: 0 },
    PMDA: { total: 0, onTimeCount: 0, lateCount: 0, overdueCount: 0, pendingCount: 0 },
    MHRA: { total: 0, onTimeCount: 0, lateCount: 0, overdueCount: 0, pendingCount: 0 },
    WHO: { total: 0, onTimeCount: 0, lateCount: 0, overdueCount: 0, pendingCount: 0 },
    GLOBAL: { total: 0, onTimeCount: 0, lateCount: 0, overdueCount: 0, pendingCount: 0 },
  };

  const ruleStats = {};
  for (const rule of rules) {
    ruleStats[rule.ruleCode] = {
      ruleCode: rule.ruleCode,
      ruleName: rule.name,
      jurisdiction: rule.jurisdiction,
      activeVersion: rule.version,
      total: 0,
      onTimeCount: 0,
      lateCount: 0,
      overdueCount: 0,
      pendingCount: 0,
    };
  }

  let within7Days = 0;
  let within15Days = 0;

  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  for (const r of reports) {
    const isSubmitted = r.status === 'SUBMITTED' || r.status === 'ACKNOWLEDGED';
    const dueDate = new Date(r.dueDate);
    const jur = jurisdictionStats[r.jurisdiction] || (jurisdictionStats[r.jurisdiction] = {
      total: 0, onTimeCount: 0, lateCount: 0, overdueCount: 0, pendingCount: 0,
    });

    jur.total += 1;

    if (!ruleStats[r.ruleCode]) {
      ruleStats[r.ruleCode] = {
        ruleCode: r.ruleCode,
        ruleName: r.ruleName || r.ruleCode,
        jurisdiction: r.jurisdiction,
        activeVersion: r.ruleVersion,
        total: 0,
        onTimeCount: 0,
        lateCount: 0,
        overdueCount: 0,
        pendingCount: 0,
      };
    }
    ruleStats[r.ruleCode].total += 1;

    if (isSubmitted) {
      const submittedAt = r.submittedAt ? new Date(r.submittedAt) : new Date(r.updatedAt || r.dueDate);
      if (submittedAt <= dueDate) {
        onTimeCount += 1;
        jur.onTimeCount += 1;
        ruleStats[r.ruleCode].onTimeCount += 1;
      } else {
        lateCount += 1;
        jur.lateCount += 1;
        ruleStats[r.ruleCode].lateCount += 1;
      }
    } else if (r.status === 'OVERDUE' || now > dueDate) {
      overdueCount += 1;
      jur.overdueCount += 1;
      ruleStats[r.ruleCode].overdueCount += 1;
    } else {
      pendingCount += 1;
      jur.pendingCount += 1;
      ruleStats[r.ruleCode].pendingCount += 1;

      if (dueDate >= now && dueDate <= sevenDaysFromNow) {
        within7Days += 1;
      }
      if (dueDate >= now && dueDate <= fifteenDaysFromNow) {
        within15Days += 1;
      }
    }
  }

  // Calculate On-Time Rate
  const evaluatedObligations = onTimeCount + lateCount + overdueCount;
  let onTimeRate = 100;
  if (evaluatedObligations > 0) {
    onTimeRate = Math.round((onTimeCount / evaluatedObligations) * 1000) / 10;
  }

  const getRiskLevel = (rate, overdues) => {
    if (overdues > 0 || rate < 85) return 'CRITICAL';
    if (rate < 95) return 'WARNING';
    return 'HEALTHY';
  };

  const overallRiskLevel = getRiskLevel(onTimeRate, overdueCount);

  // Jurisdiction breakdown formatting
  const jurisdictionBreakdown = Object.entries(jurisdictionStats).map(([jur, stats]) => {
    const jurEvaluated = stats.onTimeCount + stats.lateCount + stats.overdueCount;
    const jurRate = jurEvaluated > 0 ? Math.round((stats.onTimeCount / jurEvaluated) * 1000) / 10 : 100;
    return {
      jurisdiction: jur,
      ...stats,
      onTimeRate: jurRate,
      riskLevel: getRiskLevel(jurRate, stats.overdueCount),
    };
  });

  // Rule breakdown formatting
  const ruleBreakdown = Object.values(ruleStats).map((stats) => {
    const ruleEvaluated = stats.onTimeCount + stats.lateCount + stats.overdueCount;
    const ruleRate = ruleEvaluated > 0 ? Math.round((stats.onTimeCount / ruleEvaluated) * 1000) / 10 : 100;
    return {
      ...stats,
      onTimeRate: ruleRate,
      riskLevel: getRiskLevel(ruleRate, stats.overdueCount),
    };
  });

  const recentDecisions = reports
    .filter((r) => r.status === 'SUBMITTED' || r.status === 'ACKNOWLEDGED')
    .sort((a, b) => new Date(b.submittedAt || b.updatedAt) - new Date(a.submittedAt || a.updatedAt))
    .slice(0, 10)
    .map((r) => {
      const subDate = new Date(r.submittedAt || r.updatedAt);
      const dueDate = new Date(r.dueDate);
      return {
        id: r._id,
        caseId: r.caseId,
        caseNumber: r.caseNumber,
        ruleCode: r.ruleCode,
        ruleVersion: r.ruleVersion,
        ruleName: r.ruleName,
        jurisdiction: r.jurisdiction,
        submittedAt: r.submittedAt,
        dueDate: r.dueDate,
        wasOnTime: subDate <= dueDate,
        status: r.status,
      };
    });

  const summary = {
    overallMetrics: {
      totalObligations: reports.length,
      onTimeCount,
      lateCount,
      overdueCount,
      pendingCount,
      onTimeRate,
      riskLevel: overallRiskLevel,
    },
    jurisdictionBreakdown,
    ruleBreakdown,
    upcomingDeadlines: {
      within7Days,
      within15Days,
    },
    recentDecisions,
    syntheticNotice:
      'Compliance metrics derived strictly from synthetic educational cases and statutory rule versions. Validate with PV compliance officer.',
  };

  // Persist a snapshot if not recently saved
  if (mongoose.connection.readyState === 1) {
    try {
      await ComplianceSnapshot.create({
        overallMetrics: summary.overallMetrics,
        jurisdictionBreakdown: summary.jurisdictionBreakdown,
        ruleBreakdown: summary.ruleBreakdown,
        upcomingDeadlines: summary.upcomingDeadlines,
      });
    } catch {
      // Ignore snapshot persistence error in transient environments
    }
  }

  return summary;
}

/**
 * Returns complete version history, change history, and diffs for a given rule.
 */
export async function getRuleHistory(ruleIdOrCode) {
  let rule;
  if (mongoose.Types.ObjectId.isValid(ruleIdOrCode)) {
    rule = await ReportingRule.findById(ruleIdOrCode).lean();
  }

  const ruleCode = rule ? rule.ruleCode : ruleIdOrCode;

  const versions = await ReportingRule.find({ ruleCode })
    .sort({ version: -1 })
    .populate('approval.requestedBy', 'name email role')
    .populate('approval.approvedBy', 'name email role')
    .lean();

  if (!versions || versions.length === 0) {
    throw new NotFoundError(`No reporting rule found for identifier ${ruleIdOrCode}`);
  }

  // Aggregate all change history entries
  const aggregatedHistory = [];
  for (const v of versions) {
    if (v.changeHistory && Array.isArray(v.changeHistory)) {
      for (const entry of v.changeHistory) {
        aggregatedHistory.push({
          ...entry,
          ruleCode: v.ruleCode,
          ruleVersion: v.version,
        });
      }
    }
  }

  aggregatedHistory.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

  return {
    ruleCode,
    currentVersion: versions[0]?.version || 1,
    versions,
    changeHistory: aggregatedHistory,
  };
}

/**
 * Creates or updates a reporting rule with versioning and change audit history.
 */
export async function createOrUpdateRuleWithGovernance(
  {
    ruleCode,
    jurisdiction,
    name,
    reportType,
    conditions,
    deadlineDays,
    description,
    reason = '',
    requireApproval = false,
  },
  user,
  req,
) {
  if (!ruleCode || !jurisdiction || !name || !reportType || deadlineDays === undefined || deadlineDays === null) {
    throw new ValidationError('ruleCode, jurisdiction, name, reportType, and deadlineDays are required.');
  }

  if (Number(deadlineDays) < 1) {
    throw new ValidationError('deadlineDays must be at least 1 day.');
  }

  // Find currently active or latest version of this rule
  const existingRule = await ReportingRule.findOne({ ruleCode }).sort({ version: -1 });

  let newRule;

  if (existingRule) {
    // Calculate diff against existing rule
    const diff = computeRuleDiff(existingRule, {
      name,
      jurisdiction,
      reportType,
      conditions: conditions || existingRule.conditions,
      deadlineDays: Number(deadlineDays),
      description: description || existingRule.description,
    });

    const nextVersion = existingRule.version + 1;

    const previousDefinition = {
      name: existingRule.name,
      jurisdiction: existingRule.jurisdiction,
      reportType: existingRule.reportType,
      conditions: existingRule.conditions,
      deadlineDays: existingRule.deadlineDays,
      description: existingRule.description,
      version: existingRule.version,
    };

    const changeHistoryEntry = {
      version: nextVersion,
      changedBy: user?._id || null,
      changedByName: user?.name || 'Regulatory Administrator',
      changedAt: new Date(),
      reason: reason || 'Statutory regulatory update or periodic policy revision.',
      previousDefinition,
      diff,
    };

    const combinedHistory = [...(existingRule.changeHistory || []), changeHistoryEntry];

    if (requireApproval) {
      // Create new version in PENDING_APPROVAL status without deactivating old rule yet
      newRule = await ReportingRule.create({
        ruleCode,
        jurisdiction: jurisdiction || existingRule.jurisdiction,
        name: name || existingRule.name,
        reportType: reportType || existingRule.reportType,
        conditions: conditions || existingRule.conditions,
        deadlineDays: Number(deadlineDays),
        version: nextVersion,
        effectiveFrom: new Date(),
        active: false,
        description: description || existingRule.description,
        changeHistory: combinedHistory,
        approval: {
          status: 'PENDING_APPROVAL',
          requestedBy: user?._id || null,
          requestedByName: user?.name || 'Regulatory Specialist',
          requestedAt: new Date(),
        },
      });
    } else {
      // Immediately approved / direct update
      existingRule.active = false;
      existingRule.effectiveTo = new Date();
      await existingRule.save();

      newRule = await ReportingRule.create({
        ruleCode,
        jurisdiction: jurisdiction || existingRule.jurisdiction,
        name: name || existingRule.name,
        reportType: reportType || existingRule.reportType,
        conditions: conditions || existingRule.conditions,
        deadlineDays: Number(deadlineDays),
        version: nextVersion,
        effectiveFrom: new Date(),
        active: true,
        description: description || existingRule.description,
        changeHistory: combinedHistory,
        approval: {
          status: 'APPROVED',
          approvedBy: user?._id || null,
          approvedByName: user?.name || 'Regulatory Administrator',
          approvedAt: new Date(),
        },
      });
    }
  } else {
    // Brand new rule (Version 1)
    newRule = await ReportingRule.create({
      ruleCode,
      jurisdiction,
      name,
      reportType,
      conditions: conditions || { seriousness: 'Serious', expectedness: 'ANY', country: 'ANY' },
      deadlineDays: Number(deadlineDays),
      version: 1,
      effectiveFrom: new Date(),
      active: true,
      description,
      changeHistory: [
        {
          version: 1,
          changedBy: user?._id || null,
          changedByName: user?.name || 'Regulatory Administrator',
          changedAt: new Date(),
          reason: reason || 'Initial statutory rule creation.',
          diff: [],
        },
      ],
      approval: {
        status: 'APPROVED',
        approvedBy: user?._id || null,
        approvedByName: user?.name || 'Regulatory Administrator',
        approvedAt: new Date(),
      },
    });
  }

  await recordAudit({
    actor: user,
    action: 'REPORTING_RULE_GOVERNANCE_UPDATED',
    entity: 'ReportingRule',
    entityId: String(newRule._id),
    summary: `Rule ${newRule.ruleCode} v${newRule.version} created (Status: ${newRule.approval?.status || 'APPROVED'}).`,
    details: {
      ruleCode: newRule.ruleCode,
      version: newRule.version,
      approvalStatus: newRule.approval?.status,
      deadlineDays: newRule.deadlineDays,
    },
    req,
  });

  return newRule;
}

/**
 * Approves a pending rule version, activates it, and deactivates any older versions.
 */
export async function approveRuleVersion(ruleId, { reason = '' } = {}, user, req) {
  const rule = await ReportingRule.findById(ruleId);
  if (!rule) {
    throw new NotFoundError(`ReportingRule not found with id ${ruleId}`);
  }

  if (rule.approval?.status === 'APPROVED' && rule.active) {
    return rule;
  }

  // Deactivate prior versions
  await ReportingRule.updateMany(
    { ruleCode: rule.ruleCode, _id: { $ne: rule._id }, active: true },
    { $set: { active: false, effectiveTo: new Date() } },
  );

  rule.active = true;
  rule.effectiveFrom = new Date();
  rule.approval = {
    status: 'APPROVED',
    requestedBy: rule.approval?.requestedBy || null,
    requestedByName: rule.approval?.requestedByName || '',
    requestedAt: rule.approval?.requestedAt || null,
    approvedBy: user?._id || null,
    approvedByName: user?.name || 'Regulatory Approver',
    approvedAt: new Date(),
    rejectionReason: '',
  };

  await rule.save();

  await recordAudit({
    actor: user,
    action: 'REPORTING_RULE_APPROVED',
    entity: 'ReportingRule',
    entityId: String(rule._id),
    summary: `Rule ${rule.ruleCode} v${rule.version} approved by ${user?.name || 'Regulatory Approver'}.`,
    details: {
      ruleCode: rule.ruleCode,
      version: rule.version,
      reason,
    },
    req,
  });

  return rule;
}

/**
 * Returns detailed drill-down of all currently overdue reports with delay calculation.
 */
export async function getOverdueReportsDrilldown() {
  if (mongoose.connection.readyState === 1) {
    try {
      await seedDefaultReportingRules();
      await checkAndFlagOverdueReports();
    } catch {
      // ignore
    }
  }

  const now = new Date();
  const overdueReports = await RegulatoryReport.find({
    $or: [
      { status: 'OVERDUE' },
      {
        status: { $nin: ['SUBMITTED', 'ACKNOWLEDGED'] },
        dueDate: { $lt: now },
      },
    ],
  })
    .sort({ dueDate: 1 })
    .populate('caseId', 'caseNumber classification stage assignedTo')
    .lean();

  return overdueReports.map((r) => {
    const due = new Date(r.dueDate);
    const delayMs = Math.max(0, now - due);
    const daysOverdue = Math.ceil(delayMs / (1000 * 60 * 60 * 24));

    return {
      _id: r._id,
      caseId: r.caseId?._id || r.caseId,
      caseNumber: r.caseNumber || r.caseId?.caseNumber || 'N/A',
      jurisdiction: r.jurisdiction,
      reportType: r.reportType,
      ruleCode: r.ruleCode,
      ruleVersion: r.ruleVersion,
      ruleName: r.ruleName,
      dueDate: r.dueDate,
      daysOverdue,
      status: r.status,
      assignedTo: r.caseId?.assignedTo || null,
    };
  });
}
