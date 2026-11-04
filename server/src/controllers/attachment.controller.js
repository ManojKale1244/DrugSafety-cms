import * as attachmentService from '../services/attachment.service.js';

/**
 * POST /api/cases/:caseId/attachments
 */
export async function uploadAttachmentHandler(req, res, next) {
  try {
    const { caseId } = req.params;
    const { category } = req.body;
    const file = req.file;

    const attachment = await attachmentService.uploadCaseAttachment({
      caseId,
      file,
      category,
      user: req.user,
      req,
    });

    res.status(201).json({
      success: true,
      data: attachment,
      message: `File '${attachment.name}' uploaded and catalogued.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/attachments/:id/version
 */
export async function uploadNewVersionHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const file = req.file;

    const attachment = await attachmentService.uploadNewAttachmentVersion(id, {
      file,
      reason,
      user: req.user,
      req,
    });

    res.status(201).json({
      success: true,
      data: attachment,
      message: `Document '${attachment.name}' updated to version ${attachment.version}.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/cases/:caseId/attachments
 */
export async function getCaseAttachmentsHandler(req, res, next) {
  try {
    const { caseId } = req.params;
    const attachments = await attachmentService.getCaseAttachments(caseId);
    res.json({
      success: true,
      data: attachments,
      count: attachments.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/attachments/:id/stream
 * Authorized streaming with direct session auth or presigned token verification.
 */
export async function streamAttachmentHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { token, expires } = req.query;

    const { stream, mime, size, name } = await attachmentService.getAttachmentStream(id, {
      token,
      expires,
      user: req.user,
      req,
    });

    res.setHeader('Content-Type', mime);
    if (size) res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/attachments/:id/presigned-url
 */
export async function getPresignedUrlHandler(req, res, next) {
  try {
    const { id } = req.params;
    const result = await attachmentService.getAttachmentPresignedUrl(id, req.user, req);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/attachments/:id
 */
export async function deleteAttachmentHandler(req, res, next) {
  try {
    const { id } = req.params;
    const result = await attachmentService.deleteAttachment(id, req.user, req);
    res.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/intakes/:intakeId/attachments
 */
export async function uploadIntakeAttachmentHandler(req, res, next) {
  try {
    const { intakeId } = req.params;
    const { category } = req.body;
    const file = req.file;

    const attachment = await attachmentService.uploadIntakeAttachment({
      intakeId,
      file,
      category,
      user: req.user,
      req,
    });

    res.status(201).json({
      success: true,
      data: attachment,
      message: `File '${attachment.name}' uploaded and attached to Intake.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/intakes/:intakeId/attachments
 */
export async function getIntakeAttachmentsHandler(req, res, next) {
  try {
    const { intakeId } = req.params;
    const attachments = await attachmentService.getIntakeAttachments(intakeId);
    res.json({
      success: true,
      data: attachments,
      count: attachments.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/attachments
 * Global document search and listing.
 */
export async function getAllAttachmentsHandler(req, res, next) {
  try {
    const { category, search, caseId, intakeId, page, limit } = req.query;
    const result = await attachmentService.getAllAttachments({
      category,
      search,
      caseId,
      intakeId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    res.json({
      success: true,
      data: result.attachments,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/attachments/stats
 * Aggregated storage and mime stats.
 */
export async function getAttachmentStatsHandler(req, res, next) {
  try {
    const stats = await attachmentService.getAttachmentStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
}


