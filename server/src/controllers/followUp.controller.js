import * as followUpService from '../services/followUp.service.js';

/**
 * Creates a new follow-up inquiry for a case.
 * POST /api/cases/:id/follow-ups
 */
export async function createFollowUpHandler(req, res) {
  try {
    const caseId = req.params.id;
    const followUp = await followUpService.createFollowUp(caseId, req.body, req.user, req);

    return res.status(201).json({
      success: true,
      followUp,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Fetches all follow-ups and summary statistics for a case.
 * GET /api/cases/:id/follow-ups
 */
export async function getCaseFollowUpsHandler(req, res) {
  try {
    const caseId = req.params.id;
    const { followUps, stats } = await followUpService.getCaseFollowUps(caseId);

    return res.status(200).json({
      success: true,
      followUps,
      stats,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Fetches a single follow-up by ID.
 * GET /api/follow-ups/:id
 */
export async function getFollowUpByIdHandler(req, res) {
  try {
    const followUp = await followUpService.getFollowUpById(req.params.id);

    return res.status(200).json({
      success: true,
      followUp,
    });
  } catch (err) {
    const status = err.statusCode || 404;
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Logs a contact attempt or reminder for an open follow-up.
 * POST /api/cases/:id/follow-ups/:followUpId/correspondence
 */
export async function addCorrespondenceAttemptHandler(req, res) {
  try {
    const followUpId = req.params.followUpId || req.params.id;
    const followUp = await followUpService.addCorrespondenceAttempt(followUpId, req.body, req.user, req);

    return res.status(200).json({
      success: true,
      followUp,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Updates status, due date, or parameters of a follow-up.
 * PATCH /api/cases/:id/follow-ups/:followUpId
 */
export async function updateFollowUpHandler(req, res) {
  try {
    const followUpId = req.params.followUpId || req.params.id;
    const followUp = await followUpService.updateFollowUp(followUpId, req.body, req.user, req);

    return res.status(200).json({
      success: true,
      followUp,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Receives follow-up response information:
 * Creates a new case amendment version, applies diff, and reopens review task.
 * POST /api/follow-ups/:id/receive
 */
export async function receiveFollowUpInfoHandler(req, res) {
  try {
    const followUpId = req.params.id || req.params.followUpId;
    const result = await followUpService.receiveFollowUpInfo(followUpId, req.body, req.user, req);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Fetches version amendment history and diff snapshots for a case.
 * GET /api/cases/:id/follow-ups/amendments
 */
export async function getCaseAmendmentsHandler(req, res) {
  try {
    const caseId = req.params.id;
    const amendments = await followUpService.getCaseAmendments(caseId);

    return res.status(200).json({
      success: true,
      amendments,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message,
    });
  }
}

