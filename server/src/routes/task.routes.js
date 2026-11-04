import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as workflowController from '../controllers/workflow.controller.js';

const router = Router();

// Protect all task endpoints with authentication
router.use(requireAuth);

// GET /api/tasks/my
router.get('/my', workflowController.getMyTasksHandler);

// GET /api/tasks/team (Managers / Admins / Leads)
router.get('/team', requirePermission('case.assign'), workflowController.getTeamTasksHandler);

// POST /api/tasks/:id/reassign (Managers only)
router.post('/:id/reassign', requirePermission('case.assign'), workflowController.reassignTaskHandler);

export default router;

