import { Router } from 'express';
import {
  listIntakes,
  getIntake,
  createIntakeRecord,
  updateIntakeRecord,
  convertIntake,
  rejectIntakeRecord,
} from '../controllers/intake.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createIntakeSchema,
  updateIntakeSchema,
  rejectIntakeSchema,
} from '../validators/intake.validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', listIntakes);
router.post('/', validate(createIntakeSchema), createIntakeRecord);
router.get('/:id', getIntake);
router.patch('/:id', validate(updateIntakeSchema), updateIntakeRecord);
router.post('/:id/create-case', convertIntake);
router.post('/:id/reject', validate(rejectIntakeSchema), rejectIntakeRecord);

export default router;
