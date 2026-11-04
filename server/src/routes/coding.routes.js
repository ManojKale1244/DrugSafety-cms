import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as codingController from '../controllers/coding.controller.js';

const router = Router();

// Protect all coding routes with authentication
router.use(requireAuth);

// GET /api/coding/terms?q=
router.get('/terms', codingController.getTerms);

// POST /api/coding/records
router.post('/records', requirePermission('case.update'), codingController.createRecord);

// PATCH /api/coding/records/:id
router.patch('/records/:id', requirePermission('case.update'), codingController.updateRecord);

// GET /api/coding/cases/:id (alias for GET /api/cases/:id/coding)
router.get('/cases/:id', requirePermission('case.read'), codingController.getCaseCoding);

export default router;

