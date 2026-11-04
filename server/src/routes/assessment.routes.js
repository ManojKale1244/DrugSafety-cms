import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as assessmentController from '../controllers/assessment.controller.js';

const router = Router();

// Protect all routes with authentication
router.use(requireAuth);

// Direct assessment actions
router.patch('/:id', requirePermission('medical.review'), assessmentController.updateAssessment);
router.post('/:id/sign', requirePermission('medical.review'), assessmentController.signAssessment);
router.post('/:id/request-info', requirePermission('medical.review'), assessmentController.requestInfo);

export default router;

