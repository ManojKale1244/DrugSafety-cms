import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as complianceController from '../controllers/compliance.controller.js';

const router = Router();

router.use(requireAuth);

// Summary & KPI metrics
router.get('/summary', requirePermission('case.read'), complianceController.getComplianceSummaryHandler);

// Overdue reports drill-down
router.get('/overdue', requirePermission('case.read'), complianceController.getOverdueHandler);

// Rule version history and diffs
router.get('/rules/:id/history', requirePermission('case.read'), complianceController.getRuleHistoryHandler);

// Rule governance & approval (admin or regulatory users)
router.post('/rules', requirePermission('case.update'), complianceController.createOrUpdateRuleHandler);
router.post('/rules/:id/approve', requirePermission('case.update'), complianceController.approveRuleHandler);

export default router;

