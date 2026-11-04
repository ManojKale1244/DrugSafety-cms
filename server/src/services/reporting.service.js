import mongoose from 'mongoose';
import { ReportingRule } from '../models/ReportingRule.js';
import { RegulatoryReport } from '../models/RegulatoryReport.js';
import { Case } from '../models/Case.js';
import { MedicalAssessment } from '../models/MedicalAssessment.js';
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

export const SYNTHETIC_REPORTING_RULES_SEED = [
  {
    ruleCode: 'RR-FDA-15D',
    jurisdiction: 'FDA',
    name: 'FDA 15-Day Expedited Alert Report',
    reportType: '15-Day Expedited ICSR',
    conditions: {
      seriousness: 'Serious',
      expectedness: 'ANY',
      country: 'ANY',
    },
    deadlineDays: 15,
    version: 1,
    description: 'Post-marketing 15-day expedited safety report for serious suspected adverse drug experiences (21 CFR 314.80).',
  },
  {
    ruleCode: 'RR-EMA-7D',
    jurisdiction: 'EMA',
    name: 'EMA 7-Day Fatal/Life-Threatening ICSR',
    reportType: '7-Day Fatal/Life-Threatening ICSR',
    conditions: {
      seriousness: 'Serious',
      expectedness: 'ANY',
      seriousnessCriteria: ['death', 'lifeThreatening'],
      country: 'ANY',
    },
    deadlineDays: 7,
    version: 1,
    description: 'Expedited 7-day reporting obligation for fatal or life-threatening adverse reactions under GVP Module VI.',
  },
  {
    ruleCode: 'RR-EMA-15D',
    jurisdiction: 'EMA',
    name: 'EMA 15-Day Serious Non-Fatal ICSR',
    reportType: '15-Day Serious ICSR',
    conditions: {
      seriousness: 'Serious',
      expectedness: 'ANY',
      country: 'ANY',
    },
    deadlineDays: 15,
    version: 1,
    description: 'Expedited 15-day reporting obligation for serious non-fatal adverse reactions under EU GVP.',
  },
  {
    ruleCode: 'RR-CDSCO-14D',
    jurisdiction: 'CDSCO',
    name: 'CDSCO 14-Day Serious Adverse Event',
    reportType: '14-Day Expedited SAE',
    conditions: {
      seriousness: 'Serious',
      expectedness: 'ANY',
      country: 'India',
    },
    deadlineDays: 14,
    version: 1,
    description: 'Indian Pharmacovigilance Programme of India (PvPI) / CDSCO 14-day serious adverse event reporting.',
  },
  {
    ruleCode: 'RR-WHO-30D',
    jurisdiction: 'WHO',
    name: 'WHO-UMC 30-Day Global Spontaneous ICSR',
    reportType: '30-Day Global ICSR',
    conditions: {
      seriousness: 'ANY',
      expectedness: 'ANY',
      country: 'ANY',
    },
    deadlineDays: 30,
    version: 1,
    description: 'VigiBase global pharmacovigilance registry transmission obligation to Uppsala Monitoring Centre.',
  },
  {
    ruleCode: 'RR-FDA-90D',
    jurisdiction: 'FDA',
    name: 'FDA 90-Day Periodic Safety Summary',
    reportType: '90-Day Periodic Summary',
    conditions: {
      seriousness: 'Non-Serious',
      expectedness: 'ANY',
      country: 'ANY',
    },
    deadlineDays: 90,
    version: 1,
    description: 'Quarterly periodic safety update summary report for non-serious adverse drug experiences.',
  },
];

/**
 * Initializes default synthetic reporting rules if none exist.
 */
export async function seedDefaultReportingRules() {
  const count = await ReportingRule.countDocuments();
  if (count === 0) {
    for (const rule of SYNTHETIC_REPORTING_RULES_SEED) {
      await ReportingRule.create({
        ...rule,
        active: true,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      });
    }
  }
}

/**
 * Evaluates active regulatory reporting rules for a case and creates report obligations.
 * Never alters historical deadlines or rule versions of existing reports!
 */
export async function evaluateReportingObligations(caseIdOrNumber, user, req = null) {
  await seedDefaultReportingRules();

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

  const latestAssessment = await MedicalAssessment.findOne({ caseId: caseDoc._id, isLatest: true }).lean();
  const activeRules = await ReportingRule.find({ active: true }).sort({ jurisdiction: 1, deadlineDays: 1 });

  const existingReports = await RegulatoryReport.find({ caseId: caseDoc._id });
  const existingRuleIds = new Set(existingReports.map((r) => String(r.ruleId)));

  const newReportsCreated = [];

  for (const rule of activeRules) {
    // 1. Seriousness Condition
    if (rule.conditions.seriousness !== 'ANY' && rule.conditions.seriousness !== caseDoc.seriousness) {
      continue;
    }

    // 2. Expectedness Condition
    if (
      rule.conditions.expectedness !== 'ANY' &&
      latestAssessment &&
      rule.conditions.expectedness !== latestAssessment.expectedness
    ) {
      continue;
    }

    // 3. Seriousness Criteria (e.g. fatal or life-threatening)
    if (rule.conditions.seriousnessCriteria && rule.conditions.seriousnessCriteria.length > 0) {
      const flags = caseDoc.seriousnessFlags || {};
      const matchesCriteria = rule.conditions.seriousnessCriteria.some((c) => flags[c] === true);
      if (!matchesCriteria) continue;
    }

    // 4. Country Condition
    if (rule.conditions.country !== 'ANY') {
      const caseCountry = (caseDoc.country || '').trim().toLowerCase();
      const ruleCountry = rule.conditions.country.trim().toLowerCase();
      if (caseCountry !== ruleCountry) continue;
    }

    // Check if report already exists for this case & rule
    if (existingRuleIds.has(String(rule._id))) {
      // Historical report exists: PRESERVE DUE DATE AND SNAPSHOT! Do not modify.
      continue;
    }

    // Calculate due date based on case receiptDate
    const receiptDate = caseDoc.receiptDate ? new Date(caseDoc.receiptDate) : new Date(caseDoc.createdAt || Date.now());
    const dueDate = new Date(receiptDate.getTime() + rule.deadlineDays * 24 * 60 * 60 * 1000);

    // Initial status: check if already overdue based on current time
    const initialStatus = dueDate < new Date() ? 'OVERDUE' : 'DRAFT';

    // Construct synthetic ICH E2B(R3) payload summary
    const payloadSummary = {
      ichMessageHeader: {
        messageType: 'ichicsr',
        messageFormatVersion: '2.1',
        messageFormatRelease: 'R3',
        messageSenderId: 'PV-SAFETY-CORP',
        messageReceiverId: rule.jurisdiction,
        messageDateTime: new Date().toISOString(),
      },
      safetyReport: {
        safetyReportId: caseDoc.caseNumber,
        primarySourceCountry: caseDoc.country || 'India',
        receiptDate: receiptDate.toISOString().split('T')[0],
        seriousness: caseDoc.seriousness,
        patient: {
          reference: caseDoc.patient?.reference || 'ANONYMIZED',
          age: caseDoc.patient?.age,
          sex: caseDoc.patient?.sex || 'Unknown',
        },
        suspectProducts: (caseDoc.caseProducts || []).map((p) => ({
          productName: p.productName,
          role: p.role,
          dose: p.dose,
        })),
        reactions: (caseDoc.reactions || []).map((r) => ({
          verbatim: r.verbatim,
          pt: r.pt,
          meddraCode: r.meddraCode,
          outcome: r.outcome,
        })),
        medicalAssessment: {
          expectedness: latestAssessment?.expectedness || 'Unknown',
          causality: latestAssessment?.causalityMatrix || [],
          status: latestAssessment?.status || 'UNASSESSED',
        },
      },
    };

    const report = await RegulatoryReport.create({
      caseId: caseDoc._id,
      caseNumber: caseDoc.caseNumber,
      ruleId: rule._id,
      ruleCode: rule.ruleCode,
      ruleVersion: rule.version,
      ruleName: rule.name,
      jurisdiction: rule.jurisdiction,
      reportType: rule.reportType,
      deadlineDays: rule.deadlineDays,
      receiptDate,
      dueDate,
      status: initialStatus,
      payloadSummary,
      history: [
        {
          fromStatus: 'INITIAL',
          toStatus: initialStatus,
          by: user?._id || null,
          byName: user?.name || 'Engine',
          at: new Date(),
          note: `Obligation created under synthetic rule ${rule.ruleCode} v${rule.version}. Due in ${rule.deadlineDays} days.`,
        },
      ],
    });

    newReportsCreated.push(report);
  }

  // Also check for any existing reports that should be flagged overdue
  await checkAndFlagOverdueReports();

  const allReports = await RegulatoryReport.find({ caseId: caseDoc._id }).sort({ dueDate: 1 });

  if (newReportsCreated.length > 0 && user) {
    await recordAudit({
      actor: user,
      action: 'REPORTING_OBLIGATIONS_EVALUATED',
      entity: 'RegulatoryReport',
      entityId: String(caseDoc._id),
      summary: `Evaluated reporting rules for case ${caseDoc.caseNumber}. Generated ${newReportsCreated.length} new obligations.`,
      details: {
        caseNumber: caseDoc.caseNumber,
        newObligationsCount: newReportsCreated.length,
        totalObligationsCount: allReports.length,
      },
      req,
    });
  }

  return allReports;
}

/**
 * Validates a draft regulatory report against E2B(R3) core consistency rules.
 */
export async function validateReport(reportId, user, req = null) {
  const report = await RegulatoryReport.findById(reportId);
  if (!report) {
    throw new NotFoundError(`Regulatory report not found: ${reportId}`);
  }

  const caseDoc = await Case.findById(report.caseId).lean();
  if (!caseDoc) {
    throw new NotFoundError(`Case not found for report: ${report.caseId}`);
  }

  const latestAssessment = await MedicalAssessment.findOne({ caseId: caseDoc._id, isLatest: true }).lean();

  const validationErrors = [];

  // 1. Patient Demographics
  if (!caseDoc.patient?.reference && caseDoc.patient?.age == null && (!caseDoc.patient?.sex || caseDoc.patient.sex === 'Unknown')) {
    validationErrors.push({
      field: 'patient',
      message: 'ICH E2B(R3) requires at least one identifiable patient criterion (reference, age, or sex).',
      severity: 'ERROR',
    });
  }

  // 2. Suspect Product
  const suspectProducts = (caseDoc.caseProducts || []).filter((p) => p.role === 'Suspect');
  if (suspectProducts.length === 0 && !caseDoc.product) {
    validationErrors.push({
      field: 'products',
      message: 'At least one medicinal product must have the role "Suspect".',
      severity: 'ERROR',
    });
  }

  // 3. Reaction with MedDRA PT
  const reactions = caseDoc.reactions || [];
  if (reactions.length === 0 && !caseDoc.eventSummary) {
    validationErrors.push({
      field: 'reactions',
      message: 'At least one adverse reaction must be recorded.',
      severity: 'ERROR',
    });
  }
  const uncoded = reactions.filter((r) => !r.pt || !r.meddraCode);
  if (uncoded.length > 0) {
    validationErrors.push({
      field: 'coding',
      message: `${uncoded.length} reaction(s) are missing MedDRA Preferred Term (PT) coding.`,
      severity: 'ERROR',
    });
  }

  // 4. Primary Reporter
  if (!caseDoc.reporter?.name || !caseDoc.reporter.name.trim()) {
    validationErrors.push({
      field: 'reporter',
      message: 'Primary reporter name is required for health authority transmission.',
      severity: 'ERROR',
    });
  }

  // 5. Medical Review Signoff
  if (!latestAssessment || latestAssessment.status !== 'SIGNED') {
    validationErrors.push({
      field: 'assessment',
      message: 'A signed medical review and causality assessment is required before regulatory report signoff.',
      severity: 'ERROR',
    });
  }

  // 6. Clinical Narrative
  if (!caseDoc.narrative || !caseDoc.narrative.trim()) {
    validationErrors.push({
      field: 'narrative',
      message: 'Case narrative text cannot be empty.',
      severity: 'WARNING',
    });
  }

  const isValid = validationErrors.filter((e) => e.severity === 'ERROR').length === 0;
  const previousStatus = report.status;
  const newStatus = isValid ? 'VALIDATED' : 'DRAFT';

  report.validationErrors = validationErrors;
  report.isValid = isValid;
  report.status = newStatus;
  report.history.push({
    fromStatus: previousStatus,
    toStatus: newStatus,
    by: user._id,
    byName: user.name,
    at: new Date(),
    note: isValid ? 'ICH E2B(R3) schema validation successful.' : `${validationErrors.length} validation errors detected.`,
  });

  await report.save();

  await recordAudit({
    actor: user,
    action: isValid ? 'REPORT_VALIDATED' : 'REPORT_VALIDATION_FAILED',
    entity: 'RegulatoryReport',
    entityId: String(report._id),
    summary: `Regulatory report ${report.reportType} for ${report.caseNumber} validation outcome: ${isValid ? 'PASSED' : 'FAILED'}.`,
    details: {
      reportId: String(report._id),
      caseNumber: report.caseNumber,
      isValid,
      errorsCount: validationErrors.length,
    },
    req,
  });

  return report;
}

/**
 * Approves a validated regulatory report for electronic submission.
 */
export async function approveReport(reportId, user, req = null) {
  const report = await RegulatoryReport.findById(reportId);
  if (!report) {
    throw new NotFoundError(`Regulatory report not found: ${reportId}`);
  }

  if (report.status !== 'VALIDATED') {
    throw new ValidationError(`Report cannot be approved in "${report.status}" status. It must be VALIDATED first.`);
  }

  const previousStatus = report.status;
  report.status = 'APPROVED';
  report.approvedBy = user._id;
  report.approvedByName = user.name;
  report.approvedAt = new Date();
  report.history.push({
    fromStatus: previousStatus,
    toStatus: 'APPROVED',
    by: user._id,
    byName: user.name,
    at: new Date(),
    note: 'Approved for transmission to health authority gateway.',
  });

  await report.save();

  await recordAudit({
    actor: user,
    action: 'REPORT_APPROVED',
    entity: 'RegulatoryReport',
    entityId: String(report._id),
    summary: `Regulatory report ${report.reportType} (${report.jurisdiction}) for case ${report.caseNumber} approved by ${user.name}.`,
    details: {
      reportId: String(report._id),
      caseNumber: report.caseNumber,
      approvedAt: report.approvedAt,
    },
    req,
  });

  return report;
}

/**
 * Submits an approved regulatory report to the synthetic transmission gateway.
 * Records status only; no real network transmission to external agencies.
 */
export async function submitReport(reportId, user, req = null) {
  const report = await RegulatoryReport.findById(reportId);
  if (!report) {
    throw new NotFoundError(`Regulatory report not found: ${reportId}`);
  }

  if (report.status !== 'APPROVED') {
    throw new ValidationError(`Report cannot be submitted in "${report.status}" status. It must be APPROVED first.`);
  }

  const previousStatus = report.status;
  const transmissionId = `TX-${report.jurisdiction}-${Date.now().toString(36).toUpperCase()}-${report.caseNumber}`;

  report.status = 'SUBMITTED';
  report.submittedBy = user._id;
  report.submittedByName = user.name;
  report.submittedAt = new Date();
  report.transmissionId = transmissionId;
  report.history.push({
    fromStatus: previousStatus,
    toStatus: 'SUBMITTED',
    by: user._id,
    byName: user.name,
    at: new Date(),
    note: `Dispatched to synthetic ${report.jurisdiction} gateway (Transmission ID: ${transmissionId}).`,
  });

  await report.save();

  await recordAudit({
    actor: user,
    action: 'REPORT_SUBMITTED',
    entity: 'RegulatoryReport',
    entityId: String(report._id),
    summary: `Regulatory report ${report.reportType} (${report.jurisdiction}) for ${report.caseNumber} submitted. TX ID: ${transmissionId}.`,
    details: {
      reportId: String(report._id),
      caseNumber: report.caseNumber,
      transmissionId,
      submittedAt: report.submittedAt,
    },
    req,
  });

  return report;
}

/**
 * Acknowledges receipt of a submitted regulatory report (ACK message receipt).
 */
export async function acknowledgeReport(reportId, { ackRef = '' } = {}, user, req = null) {
  const report = await RegulatoryReport.findById(reportId);
  if (!report) {
    throw new NotFoundError(`Regulatory report not found: ${reportId}`);
  }

  if (report.status !== 'SUBMITTED') {
    throw new ValidationError(`Only SUBMITTED reports can be acknowledged. Current status: "${report.status}".`);
  }

  const previousStatus = report.status;
  const generatedAck = ackRef.trim() || `ACK-${report.jurisdiction}-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  report.status = 'ACKNOWLEDGED';
  report.ackRef = generatedAck;
  report.acknowledgedAt = new Date();
  report.acknowledgedBy = user.name;
  report.history.push({
    fromStatus: previousStatus,
    toStatus: 'ACKNOWLEDGED',
    by: user._id,
    byName: user.name,
    at: new Date(),
    note: `Receipt acknowledged by ${report.jurisdiction} agency gateway. Reference: ${generatedAck}.`,
  });

  await report.save();

  await recordAudit({
    actor: user,
    action: 'REPORT_ACKNOWLEDGED',
    entity: 'RegulatoryReport',
    entityId: String(report._id),
    summary: `Regulatory report ${report.reportType} acknowledged by ${report.jurisdiction}. AckRef: ${generatedAck}.`,
    details: {
      reportId: String(report._id),
      caseNumber: report.caseNumber,
      ackRef: generatedAck,
      acknowledgedAt: report.acknowledgedAt,
    },
    req,
  });

  return report;
}

/**
 * Nightly background job / checker: finds past-due reports and flags them as OVERDUE.
 */
export async function checkAndFlagOverdueReports() {
  const now = new Date();

  const overdueReports = await RegulatoryReport.find({
    dueDate: { $lt: now },
    status: { $in: ['DRAFT', 'VALIDATED', 'APPROVED'] },
  });

  for (const rep of overdueReports) {
    const prevStatus = rep.status;
    rep.status = 'OVERDUE';
    rep.history.push({
      fromStatus: prevStatus,
      toStatus: 'OVERDUE',
      by: null,
      byName: 'Nightly Compliance Job',
      at: now,
      note: `Statutory regulatory deadline expired on ${rep.dueDate.toLocaleDateString()}. Flagged as OVERDUE.`,
    });
    await rep.save();
  }

  return overdueReports.length;
}

/**
 * Creates a new version of a reporting rule without modifying historical reports.
 * Acceptance criteria: changing a rule creates a new version without altering existing due dates.
 */
export async function createOrUpdateRule(ruleData, user, req = null) {
  const { ruleCode, jurisdiction, name, reportType, conditions, deadlineDays, description } = ruleData;

  if (!ruleCode || !jurisdiction || !deadlineDays || !name || !reportType) {
    throw new ValidationError('ruleCode, jurisdiction, name, reportType, and deadlineDays are required.');
  }

  const existingRule = await ReportingRule.findOne({ ruleCode, active: true });
  let newRule = null;

  if (existingRule) {
    // 1. Deactivate old version so it remains for audit history
    existingRule.active = false;
    existingRule.effectiveTo = new Date();
    await existingRule.save();

    // 2. Create new version
    newRule = await ReportingRule.create({
      ruleCode,
      jurisdiction: jurisdiction || existingRule.jurisdiction,
      name: name || existingRule.name,
      reportType: reportType || existingRule.reportType,
      conditions: conditions || existingRule.conditions,
      deadlineDays: Number(deadlineDays),
      version: existingRule.version + 1,
      effectiveFrom: new Date(),
      active: true,
      description: description || existingRule.description,
    });
  } else {
    // Fresh rule
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
    });
  }

  await recordAudit({
    actor: user,
    action: 'REPORTING_RULE_UPDATED',
    entity: 'ReportingRule',
    entityId: String(newRule._id),
    summary: `Reporting rule ${newRule.ruleCode} v${newRule.version} created/updated with deadline ${newRule.deadlineDays} days.`,
    details: {
      ruleCode: newRule.ruleCode,
      version: newRule.version,
      deadlineDays: newRule.deadlineDays,
    },
    req,
  });

  return newRule;
}

/**
 * Retrieves reports with filtering (status, jurisdiction, caseId, etc.).
 */
export async function getReports({ caseId, status, jurisdiction, page = 1, limit = 50 } = {}) {
  await seedDefaultReportingRules();
  await checkAndFlagOverdueReports();

  const query = {};
  if (caseId) query.caseId = caseId;
  if (status) query.status = status;
  if (jurisdiction) query.jurisdiction = jurisdiction;

  const total = await RegulatoryReport.countDocuments(query);
  const reports = await RegulatoryReport.find(query)
    .sort({ dueDate: 1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('approvedBy', 'name email')
    .populate('submittedBy', 'name email')
    .lean();

  return {
    reports,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves calendar overview and statutory countdowns.
 */
export async function getCalendarOverview() {
  await seedDefaultReportingRules();
  await checkAndFlagOverdueReports();

  const now = new Date();
  const reports = await RegulatoryReport.find().sort({ dueDate: 1 }).lean();

  const activeReports = reports.filter((r) => r.status !== 'SUBMITTED' && r.status !== 'ACKNOWLEDGED');
  const overdueList = reports.filter((r) => r.status === 'OVERDUE' || (new Date(r.dueDate) < now && r.status !== 'SUBMITTED' && r.status !== 'ACKNOWLEDGED'));
  const submittedList = reports.filter((r) => r.status === 'SUBMITTED' || r.status === 'ACKNOWLEDGED');

  return {
    totalActive: activeReports.length,
    overdueCount: overdueList.length,
    submittedCount: submittedList.length,
    reports,
    overdueList,
  };
}

/**
 * Returns all active rules and version histories.
 */
export async function getRules() {
  await seedDefaultReportingRules();
  return ReportingRule.find().sort({ ruleCode: 1, version: -1 }).lean();
}

