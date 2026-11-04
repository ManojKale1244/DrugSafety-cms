import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as controller from '../controllers/attachment.controller.js';
import { getStorageAdapter } from '../services/storage/s3Adapter.js';

const router = Router();

// Configure Multer with in-memory buffering for magic-byte, hash, and virus scanning
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB transport ceiling; strict 25MB enforced in service
  },
});

/**
 * Middleware: Allow request if user is authenticated OR valid presigned token is present.
 * Direct unauthenticated requests without a token are strictly rejected with 401.
 */
function requireAuthOrPresignedToken(req, res, next) {
  const hasSession =
    req.cookies?.drug_safety_token || req.headers.authorization?.startsWith('Bearer ');

  if (hasSession) {
    return requireAuth(req, res, next);
  }

  const { token, expires } = req.query;
  const { id } = req.params;

  if (token && expires && id) {
    const storageAdapter = getStorageAdapter();
    const isValid = storageAdapter.verifyPresignedToken(id, token, expires);
    if (isValid) {
      req.isPresignedAccess = true;
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Access denied: Authentication or valid presigned token required to access this document.',
  });
}

// Case attachment routes
router.post(
  '/cases/:caseId/attachments',
  requireAuth,
  requirePermission('case.update'),
  upload.single('file'),
  controller.uploadAttachmentHandler,
);

router.get(
  '/cases/:caseId/attachments',
  requireAuth,
  requirePermission('case.read'),
  controller.getCaseAttachmentsHandler,
);

// Intake attachment routes
router.post(
  '/intakes/:intakeId/attachments',
  requireAuth,
  requirePermission('case.update'),
  upload.single('file'),
  controller.uploadIntakeAttachmentHandler,
);

router.get(
  '/intakes/:intakeId/attachments',
  requireAuth,
  requirePermission('case.read'),
  controller.getIntakeAttachmentsHandler,
);

// Document repository global stats and search
router.get(
  '/attachments/stats',
  requireAuth,
  requirePermission('case.read'),
  controller.getAttachmentStatsHandler,
);

router.get(
  '/attachments',
  requireAuth,
  requirePermission('case.read'),
  controller.getAllAttachmentsHandler,
);

// Attachment versioning
router.post(
  '/attachments/:id/version',
  requireAuth,
  requirePermission('case.update'),
  upload.single('file'),
  controller.uploadNewVersionHandler,
);

// Presigned URL generation
router.get(
  '/attachments/:id/presigned-url',
  requireAuth,
  requirePermission('case.read'),
  controller.getPresignedUrlHandler,
);

// Document streaming / in-app preview (protected by session auth or presigned token)
router.get(
  '/attachments/:id/stream',
  requireAuthOrPresignedToken,
  controller.streamAttachmentHandler,
);

// Soft-delete / archive attachment
router.delete(
  '/attachments/:id',
  requireAuth,
  requirePermission('case.delete'),
  controller.deleteAttachmentHandler,
);

export default router;

