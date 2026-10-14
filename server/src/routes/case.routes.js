import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as caseController from '../controllers/case.controller.js';

const router = Router();

// Protect all case endpoints with authentication
router.use(requireAuth);

// Export CSV before /:id param route
router.get('/export/csv', requirePermission('case.read'), caseController.exportCasesCsvHandler);

// CRUD Endpoints
router.get('/', requirePermission('case.read'), caseController.getCasesHandler);
router.post('/', requirePermission('case.create'), caseController.createCaseHandler);

router.get('/:id', requirePermission('case.read'), caseController.getCaseByIdHandler);
router.patch('/:id', requirePermission('case.update'), caseController.updateCaseHandler);

// Specific Case Actions
router.get('/:id/history', requirePermission('case.read'), caseController.getCaseHistoryHandler);
router.post('/:id/assign', requirePermission('case.update'), caseController.assignCaseHandler);
router.post('/:id/close', requirePermission('case.update'), caseController.closeCaseHandler);

export default router;
