import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as followUpController from '../controllers/followUp.controller.js';

const router = Router();

router.use(requireAuth);

// Direct FollowUp actions
router.get('/:id', requirePermission('case.read'), followUpController.getFollowUpByIdHandler);
router.patch('/:id', requirePermission('case.update'), followUpController.updateFollowUpHandler);

// Receive follow-up response and create new case amendment version
router.post('/:id/receive', requirePermission('case.update'), followUpController.receiveFollowUpInfoHandler);
router.post('/:id/response', requirePermission('case.update'), followUpController.receiveFollowUpInfoHandler);

export default router;

