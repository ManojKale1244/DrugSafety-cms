import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as icsrController from '../controllers/icsr.controller.js';

const router = Router();

router.use(requireAuth);

// Export Case ICSR E2B
router.post('/export/:caseId', requirePermission('case.read'), icsrController.exportCaseHandler);

// Inbound ICSR Preview and Import
router.post('/preview', requirePermission('case.read'), icsrController.previewImportHandler);
router.post('/import', requirePermission('case.create'), icsrController.confirmImportHandler);

// Message Log & Details
router.get('/messages', requirePermission('case.read'), icsrController.getMessagesHandler);
router.get('/messages/:id', requirePermission('case.read'), icsrController.getMessageByIdHandler);

// Mock Gateway Acknowledgment
router.post('/gateway/mock-ack/:messageId', requirePermission('case.update'), icsrController.mockGatewayAckHandler);

export default router;

