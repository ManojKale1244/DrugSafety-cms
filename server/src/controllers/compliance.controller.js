import * as complianceService from '../services/compliance.service.js';

/**
 * GET /api/compliance/summary
 */
export async function getComplianceSummaryHandler(req, res, next) {
  try {
    const summary = await complianceService.getComplianceSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/compliance/rules/:id/history
 */
export async function getRuleHistoryHandler(req, res, next) {
  try {
    const { id } = req.params;
    const history = await complianceService.getRuleHistory(id);
    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/compliance/rules
 */
export async function createOrUpdateRuleHandler(req, res, next) {
  try {
    const rule = await complianceService.createOrUpdateRuleWithGovernance(
      req.body,
      req.user,
      req,
    );
    res.status(201).json({
      success: true,
      data: rule,
      message: `Reporting rule ${rule.ruleCode} version ${rule.version} recorded successfully.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/compliance/rules/:id/approve
 */
export async function approveRuleHandler(req, res, next) {
  try {
    const { id } = req.params;
    const rule = await complianceService.approveRuleVersion(
      id,
      req.body,
      req.user,
      req,
    );
    res.json({
      success: true,
      data: rule,
      message: `Reporting rule ${rule.ruleCode} version ${rule.version} approved and activated.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/compliance/overdue
 */
export async function getOverdueHandler(req, res, next) {
  try {
    const overdueList = await complianceService.getOverdueReportsDrilldown();
    res.json({
      success: true,
      data: overdueList,
      total: overdueList.length,
    });
  } catch (err) {
    next(err);
  }
}

