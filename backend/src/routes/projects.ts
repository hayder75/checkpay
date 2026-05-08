import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  handoverProject,
  getProjectStatus,
  generateTransferCode,
  acceptTransfer,
  getTransferCodeStatus,
  getProjectStats,
  getProjectClusterMembers,
  createVendor,
  getVendors,
  updateVendor,
  deleteVendor,
} from '../controllers/projectController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// Public route for accepting transfer (no auth required)
router.post('/accept-transfer', asyncHandler(acceptTransfer));

// Protected routes (require authentication)
router.use(authenticate as any);
router.use(auditLog as any);

router.post('/', asyncHandler(createProject));
router.get('/', asyncHandler(getProjects));
router.get('/:id', asyncHandler(getProject));
router.put('/:id', asyncHandler(updateProject));
router.post('/:id/handover', asyncHandler(handoverProject));
router.get('/:id/status', asyncHandler(getProjectStatus));
router.post('/:id/generate-transfer-code', asyncHandler(generateTransferCode));
router.get('/:id/transfer-status', asyncHandler(getTransferCodeStatus));
router.get('/:id/stats', asyncHandler(getProjectStats));
router.get('/:id/cluster-members', asyncHandler(getProjectClusterMembers));

// Vendor management routes
router.post('/:id/vendors', asyncHandler(createVendor));
router.get('/:id/vendors', asyncHandler(getVendors));
router.put('/:id/vendors/:vendorId', asyncHandler(updateVendor));
router.delete('/:id/vendors/:vendorId', asyncHandler(deleteVendor));

export default router;
