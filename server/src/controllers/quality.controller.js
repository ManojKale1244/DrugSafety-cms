import * as qualityService from '../services/quality.service.js';

/**
 * GET /api/cases/:id/quality/auto-checks
 * Evaluates automatic quality validators on a case.
 */
export async function getAutoChecksHandler(req, res, next) {
  try {
    const { id } = req.params;
    const details = await qualityService.getCaseQualityDetails(id);
    return res.json({
      success: true,
      caseNumber: details.caseNumber,
      status: details.status,
      isReadyForApproval: details.isReadyForApproval,
      ...details.autoChecks,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/cases/:id/quality
 * Returns checklist template, auto-checks, and previous quality review history.
 */
export async function getQualityDetailsHandler(req, res, next) {
  try {
    const { id } = req.params;
    const details = await qualityService.getCaseQualityDetails(id);
    return res.json({
      success: true,
      ...details,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/cases/:id/quality
 * Submits quality review (APPROVED or RETURNED) and routes through workflow engine.
 */
export async function submitQualityReviewHandler(req, res, next) {
  try {
    const { id } = req.params;
    const result = await qualityService.submitQualityReview(id, req.body, req.user, req);

    return res.status(201).json({
      success: true,
      message:
        req.body.decision === 'APPROVED'
          ? 'Case quality review APPROVED and advanced to Regulatory Reporting.'
          : `Case quality review RETURNED to ${req.body.returnToStage || 'Medical Review'} for correction.`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/quality/metrics or GET /api/cases/quality/metrics
 * Returns quality assurance KPIs including First-Pass Yield (FPY) per processor.
 */
export async function getQualityMetricsHandler(req, res, next) {
  try {
    const metrics = await qualityService.getQualityMetrics();
    return res.json({
      success: true,
      ...metrics,
    });
  } catch (err) {
    next(err);
  }
}

