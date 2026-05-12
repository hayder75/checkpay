import { Router } from 'express';
import {
  registerEmployee,
} from '../controllers/employeeController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// Employee registration - can work with or without authentication
// If not authenticated, will create user account first
router.post('/register', asyncHandler(registerEmployee));

// All other routes require authentication
router.use(authenticate as any);
router.use(auditLog as any);

export default router;

