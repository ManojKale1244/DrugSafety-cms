import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as caseController from '../controllers/case.controller.js';
import * as codingController from '../controllers/coding.controller.js';
import * as assessmentController from '../controllers/assessment.controller.js';
import * as workflowController from '../controllers/workflow.controller.js';
import * as qualityController from '../controllers/quality.controller.js';
import * as reportingController from '../controllers/reporting.controller.js';
import * as followUpController from '../controllers/followUp.controller.js';
import * as productController from '../controllers/product.controller.js';

const router = Router();

// Protect all case endpoints with authentication
router.use(requireAuth);

// Export CSV before /:id param route
router.get('/export/csv', requirePermission('case.read'), caseController.exportCasesCsvHandler);

// Quality Metrics before /:id param route
router.get('/quality/metrics', requirePermission('case.read'), qualityController.getQualityMetricsHandler);

// CRUD Endpoints
router.get('/', requirePermission('case.read'), caseController.getCasesHandler);
router.post('/', requirePermission('case.create'), caseController.createCaseHandler);

router.get('/:id', requirePermission('case.read'), caseController.getCaseByIdHandler);
router.patch('/:id', requirePermission('case.update'), caseController.updateCaseHandler);

// Workflow Engine (Module 8)
router.get('/:id/workflow', requirePermission('case.read'), workflowController.getCaseWorkflowHandler);
router.post('/:id/route', requirePermission('case.update'), workflowController.routeCaseHandler);

// Quality Review (Module 9)
router.get('/:id/quality/auto-checks', requirePermission('case.read'), qualityController.getAutoChecksHandler);
router.get('/:id/quality', requirePermission('case.read'), qualityController.getQualityDetailsHandler);
router.post('/:id/quality', requirePermission('case.update'), qualityController.submitQualityReviewHandler);

// Regulatory Reporting (Module 10)
router.post('/:id/reporting/evaluate', requirePermission('case.update'), reportingController.evaluateCaseObligationsHandler);
router.get('/:id/reporting', requirePermission('case.read'), reportingController.getCaseReportsHandler);

// Specific Case Actions
router.get('/:id/products', requirePermission('case.read'), productController.getCaseProductsHandler);
router.post('/:id/products', requirePermission('case.update'), productController.addProductToCaseHandler);
router.patch('/:id/products/:productId', requirePermission('case.update'), productController.updateCaseProductHandler);
router.delete('/:id/products/:productId', requirePermission('case.update'), productController.removeProductFromCaseHandler);

router.get('/:id/follow-ups/amendments', requirePermission('case.read'), followUpController.getCaseAmendmentsHandler);
router.get('/:id/follow-ups', requirePermission('case.read'), followUpController.getCaseFollowUpsHandler);
router.post('/:id/follow-ups', requirePermission('case.update'), followUpController.createFollowUpHandler);
router.post('/:id/follow-ups/:followUpId/correspondence', requirePermission('case.update'), followUpController.addCorrespondenceAttemptHandler);
router.patch('/:id/follow-ups/:followUpId', requirePermission('case.update'), followUpController.updateFollowUpHandler);
router.post('/:id/follow-ups/:followUpId/receive', requirePermission('case.update'), followUpController.receiveFollowUpInfoHandler);

router.get('/:id/assessments', requirePermission('case.read'), assessmentController.getAssessments);
router.post('/:id/assessments', requirePermission('medical.review'), assessmentController.createAssessment);
router.patch('/:id/assessments', requirePermission('medical.review'), assessmentController.updateAssessment);
router.get('/:id/coding', requirePermission('case.read'), codingController.getCaseCoding);
router.get('/:id/history', requirePermission('case.read'), caseController.getCaseHistoryHandler);
router.post('/:id/assign', requirePermission('case.update'), caseController.assignCaseHandler);
router.post('/:id/close', requirePermission('case.update'), caseController.closeCaseHandler);

export default router;
