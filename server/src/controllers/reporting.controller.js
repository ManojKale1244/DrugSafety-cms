import * as reportingService from '../services/reporting.service.js';

/**
 * POST /api/cases/:id/reporting/evaluate
 * Evaluates reporting rules for a case and creates/returns regulatory report obligations.
 */
export async function evaluateCaseObligationsHandler(req, res, next) {
  try {
    const { id } = req.params;
    const reports = await reportingService.evaluateReportingObligations(id, req.user, req);

    return res.json({
      success: true,
      message: `Evaluated reporting rules for case. ${reports.length} report obligations identified.`,
      count: reports.length,
      reports,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/cases/:id/reporting
 * Returns all reporting obligations for a specific case.
 */
export async function getCaseReportsHandler(req, res, next) {
  try {
    const { id } = req.params;
    const reports = await reportingService.evaluateReportingObligations(id, null, null);
    return res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports
 * Lists all regulatory reports with optional filters.
 */
export async function getReportsHandler(req, res, next) {
  try {
    const { caseId, status, jurisdiction, page, limit } = req.query;
    const result = await reportingService.getReports({ caseId, status, jurisdiction, page, limit });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reports/:id/validate
 * Validates report against ICH E2B(R3) schemas.
 */
export async function validateReportHandler(req, res, next) {
  try {
    const { id } = req.params;
    const report = await reportingService.validateReport(id, req.user, req);

    return res.json({
      success: true,
      message: report.isValid ? 'Report schema validated successfully.' : 'Validation errors detected.',
      report,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reports/:id/approve
 * Approves a validated report for regulatory transmission.
 */
export async function approveReportHandler(req, res, next) {
  try {
    const { id } = req.params;
    const report = await reportingService.approveReport(id, req.user, req);

    return res.json({
      success: true,
      message: `Report approved by ${report.approvedByName}. Ready for gateway dispatch.`,
      report,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reports/:id/submit
 * Dispatches report to synthetic agency gateway (records status only).
 */
export async function submitReportHandler(req, res, next) {
  try {
    const { id } = req.params;
    const report = await reportingService.submitReport(id, req.user, req);

    return res.json({
      success: true,
      message: `Report submitted to ${report.jurisdiction} synthetic gateway. Transmission ID: ${report.transmissionId}.`,
      report,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reports/:id/acknowledge
 * Records agency receipt acknowledgement (ACK).
 */
export async function acknowledgeReportHandler(req, res, next) {
  try {
    const { id } = req.params;
    const report = await reportingService.acknowledgeReport(id, req.body, req.user, req);

    return res.json({
      success: true,
      message: `Receipt acknowledged by ${report.jurisdiction}. Reference: ${report.ackRef}.`,
      report,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/calendar
 * Returns calendar overview and countdowns.
 */
export async function getCalendarHandler(req, res, next) {
  try {
    const overview = await reportingService.getCalendarOverview();
    return res.json({
      success: true,
      ...overview,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/overdue
 * Returns all overdue reports.
 */
export async function getOverdueReportsHandler(req, res, next) {
  try {
    const overview = await reportingService.getCalendarOverview();
    return res.json({
      success: true,
      count: overview.overdueCount,
      overdueList: overview.overdueList,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/rules
 * Returns all reporting rules and versions.
 */
export async function getRulesHandler(req, res, next) {
  try {
    const rules = await reportingService.getRules();
    return res.json({
      success: true,
      count: rules.length,
      rules,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reports/rules
 * Creates a new version of a reporting rule without modifying historical reports.
 */
export async function createOrUpdateRuleHandler(req, res, next) {
  try {
    const newRule = await reportingService.createOrUpdateRule(req.body, req.user, req);
    return res.status(201).json({
      success: true,
      message: `Reporting rule ${newRule.ruleCode} v${newRule.version} created successfully.`,
      rule: newRule,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reports/nightly-job
 * Manually or automatically triggers the nightly overdue checker job.
 */
export async function runNightlyJobHandler(req, res, next) {
  try {
    const overdueCount = await reportingService.checkAndFlagOverdueReports();
    return res.json({
      success: true,
      message: `Nightly compliance job executed. ${overdueCount} overdue reports updated.`,
      overdueCount,
    });
  } catch (err) {
    next(err);
  }
}

