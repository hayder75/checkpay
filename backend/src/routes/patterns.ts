import { Router } from 'express';
import {
  createPattern,
  getPatterns,
  getPattern,
  updatePattern,
  deletePattern,
  validatePatternEndpoint,
} from '../controllers/patternController';
import { authenticate } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// All pattern routes require authentication
router.use(authenticate as any);
router.use(auditLog as any);

router.post('/', createPattern as any);
router.get('/', getPatterns as any);
router.get('/:id', getPattern as any);
router.put('/:id', updatePattern as any);
router.delete('/:id', deletePattern as any);
router.post('/validate', validatePatternEndpoint as any);

export default router;

