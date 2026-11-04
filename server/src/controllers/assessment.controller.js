import * as assessmentService from '../services/assessment.service.js';

/**
 * GET /api/cases/:id/assessments
 * Retrieve current active assessment and version history for a case
 */
export async function getAssessments(req, res, next) {
  try {
    const { id } = req.params;
    const result = await assessmentService.getCaseAssessments(id);
    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/cases/:id/assessments
 * Create a new draft assessment or supersede an existing signed assessment
 */
export async function createAssessment(req, res, next) {
  try {
    const { id } = req.params;
    const assessment = await assessmentService.createAssessment(id, req.body, req.user, req);
    return res.status(201).json({
      success: true,
      message: 'Medical assessment created successfully.',
      assessment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/cases/:id/assessments OR PATCH /api/assessments/:id
 * Update draft assessment or fork new version if already signed
 */
export async function updateAssessment(req, res, next) {
  try {
    const { id } = req.params;
    const assessment = await assessmentService.updateAssessment(id, req.body, req.user, req);
    return res.json({
      success: true,
      message: 'Medical assessment updated successfully.',
      assessment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/assessments/:id/sign
 * Electronically sign a medical assessment (Part 11 compliant)
 */
export async function signAssessment(req, res, next) {
  try {
    const { id } = req.params;
    const { signatureStatement } = req.body;
    const result = await assessmentService.signAssessment(id, { signatureStatement }, req.user, req);
    return res.json({
      success: true,
      message: 'Medical assessment electronically signed and synchronized with case.',
      assessment: result.assessment,
      case: result.case,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/assessments/:id/request-info
 * Create a Request for Information and trigger follow-up action item task
 */
export async function requestInfo(req, res, next) {
  try {
    const { id } = req.params;
    const { query, priority, assignedTo, dueDate } = req.body;
    const result = await assessmentService.createRequestForInfo(
      id,
      { query, priority, assignedTo, dueDate },
      req.user,
      req,
    );
    return res.status(201).json({
      success: true,
      message: 'Request for Information created and follow-up task dispatched.',
      assessment: result.assessment,
      actionItem: result.actionItem,
      rfi: result.rfi,
    });
  } catch (err) {
    next(err);
  }
}

