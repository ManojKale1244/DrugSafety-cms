import { Router } from 'express';
import {
  listUsers,
  createNewUser,
  getUser,
  updateUserDetails,
  changeUserStatus,
  bulkChangeStatus,
  getLoginHistory,
  getRolesList,
} from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  bulkStatusSchema,
} from '../validators/user.validator.js';

const router = Router();

// Protect all user management routes with authentication and admin role / permission
router.use(requireAuth);
router.use(requireRole('admin'));

// Metadata helpers
router.get('/roles', getRolesList);

// Users CRUD and management
router.get('/', listUsers);
router.post('/', validate(createUserSchema), createNewUser);
router.post('/bulk-status', validate(bulkStatusSchema), bulkChangeStatus);
router.get('/:id', getUser);
router.patch('/:id', validate(updateUserSchema), updateUserDetails);
router.patch('/:id/status', validate(updateStatusSchema), changeUserStatus);
router.get('/:id/login-history', getLoginHistory);

export default router;
