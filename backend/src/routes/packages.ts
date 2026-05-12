import { Router } from 'express';
import {
  getPackages,
  getPackage,
  createPackage,
  updatePackage,
  assignPackageToBusiness,
  getFreePackage,
  updateFreePackage,
} from '../controllers/packageController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// Public: Get packages
router.get('/', asyncHandler(getPackages));

// Protected routes
router.use(authenticate as any);
router.use(auditLog as any);

// Free package management (Admin only) - MUST be before /:id route
router.get('/free/package', requireAdmin, asyncHandler(getFreePackage));
router.put('/free/package', requireAdmin, asyncHandler(updateFreePackage));

// Package routes
router.get('/:id', asyncHandler(getPackage));
router.post('/', requireAdmin, asyncHandler(createPackage));
router.put('/:id', requireAdmin, asyncHandler(updatePackage));
router.put('/businesses/:id', asyncHandler(assignPackageToBusiness));

export default router;

