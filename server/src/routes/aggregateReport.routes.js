import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as controller from '../controllers/aggregateReport.controller.js';

const router = Router();

router.use(requireAuth);

// Definitions CRUD & Preview
router.get('/definitions', requirePermission('case.read'), controller.getDefinitionsHandler);
router.post('/definitions', requirePermission('case.update'), controller.createDefinitionHandler);
router.post('/preview', requirePermission('case.read'), controller.previewReportHandler);

// Execute run
router.post('/definitions/:id/run', requirePermission('case.update'), controller.executeRunHandler);

// Runs & History
router.get('/runs', requirePermission('case.read'), controller.getRunsHandler);
router.get('/runs/:id', requirePermission('case.read'), controller.getRunByIdHandler);

// Approval workflow
router.post('/runs/:id/submit-approval', requirePermission('case.update'), controller.submitForApprovalHandler);
router.post('/runs/:id/approve', requirePermission('case.update'), controller.approveRunHandler);

// File exports
router.get('/runs/:id/export/csv', requirePermission('case.read'), controller.exportCsvHandler);
router.get('/runs/:id/export/pdf', requirePermission('case.read'), controller.exportPdfHandler);

export default router;

