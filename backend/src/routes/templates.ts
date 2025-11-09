import { Router } from 'express';
import {
  getAvailableTemplates,
  addTemplate,
  removeTemplate,
} from '../controllers/templateController';
import { authenticate } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// All template routes require authentication
router.use(authenticate as any);
router.use(auditLog as any);

// Get templates available for user (filtered by country and plan)
router.get('/available', asyncHandler(getAvailableTemplates));

// Add template to user's patterns
router.post('/:templateId/add', asyncHandler(addTemplate));

// Remove template from user's patterns
router.delete('/:templateId/remove', asyncHandler(removeTemplate));

export default router;

