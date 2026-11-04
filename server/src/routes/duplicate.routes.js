import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as duplicateController from '../controllers/duplicate.controller.js';

const router = Router();

// Protect all duplicate detection endpoints with authentication
router.use(requireAuth);

// POST /api/duplicates/check - Runs duplicate screening for a case or payload
router.post('/check', requirePermission('case.read'), duplicateController.runDuplicateCheck);

// GET /api/duplicates/queue - List duplicate candidate queue sorted by score
router.get('/queue', requirePermission('case.read'), duplicateController.getQueue);

// GET /api/duplicates/:id - Get specific duplicate comparison review
router.get('/:id', requirePermission('case.read'), duplicateController.getReviewDetails);

// POST /api/duplicates/:id/decide - Human decision to confirm or dismiss duplicate
router.post('/:id/decide', requirePermission('case.update'), duplicateController.recordDecision);

export default router;
