import { Router } from 'express';
import { contactController } from '../controllers/contact.controller';
import validate from '../middlewares/validate.middleware';
import { identifySchema } from '../validators/contact.validator';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

/**
 * POST /identify
 * Body: { email?: string, phoneNumber?: string }
 * Response: { contact: ConsolidatedContact }
 */
router.post(
  '/identify',
  validate(identifySchema),
  asyncHandler((req, res) => contactController.identify(req, res)),
);

export default router;