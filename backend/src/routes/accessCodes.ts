import { Router } from 'express';
import {
  generateAccessCodeForBusiness,
  getAccessCodes,
  validateAccessCode,
  getQRCode,
} from '../controllers/accessCodeController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// Validate access code is public (for employee registration)
router.post('/validate', asyncHandler(validateAccessCode));

// All other routes require authentication
router.use(authenticate as any);
router.use(auditLog as any);

router.post('/businesses/:id', asyncHandler(generateAccessCodeForBusiness));
router.get('/businesses/:id', asyncHandler(getAccessCodes));
router.get('/:code/qr', asyncHandler(getQRCode));

export default router;

