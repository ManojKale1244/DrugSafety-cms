import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as qualityController from '../controllers/quality.controller.js';

const router = Router();

router.use(requireAuth);

// Quality Metrics for Managers & Auditors
router.get('/metrics', requirePermission('case.read'), qualityController.getQualityMetricsHandler);

export default router;

