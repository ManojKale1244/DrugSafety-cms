import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as reportingController from '../controllers/reporting.controller.js';

const router = Router();

router.use(requireAuth);

// Overview, Calendar & Overdue
router.get('/calendar', requirePermission('case.read'), reportingController.getCalendarHandler);
router.get('/overdue', requirePermission('case.read'), reportingController.getOverdueReportsHandler);

// Rules management
router.get('/rules', requirePermission('case.read'), reportingController.getRulesHandler);
router.post('/rules', requirePermission('case.update'), reportingController.createOrUpdateRuleHandler);

// Nightly Job trigger
router.post('/nightly-job', requirePermission('case.update'), reportingController.runNightlyJobHandler);

// CRUD & State machine
router.get('/', requirePermission('case.read'), reportingController.getReportsHandler);
router.post('/:id/validate', requirePermission('case.update'), reportingController.validateReportHandler);
router.post('/:id/approve', requirePermission('case.update'), reportingController.approveReportHandler);
router.post('/:id/submit', requirePermission('case.update'), reportingController.submitReportHandler);
router.post('/:id/acknowledge', requirePermission('case.update'), reportingController.acknowledgeReportHandler);

export default router;

