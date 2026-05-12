import { Router } from 'express';
import {
  createBusiness,
  getBusinesses,
  getBusiness,
  updateBusiness,
  deleteBusiness,
  switchBusiness,
  getBusinessStats,
} from '../controllers/businessController';
import {
  inviteEmployee,
  getEmployees,
  getEmployee,
  updateEmployee,
  removeEmployee,
  reauthorizeEmployee,
} from '../controllers/employeeController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate as any);
router.use(auditLog as any);

router.post('/', asyncHandler(createBusiness));
router.get('/', asyncHandler(getBusinesses));
router.get('/:id', asyncHandler(getBusiness));
router.get('/:id/stats', asyncHandler(getBusinessStats));
router.put('/:id', asyncHandler(updateBusiness));
router.delete('/:id', asyncHandler(deleteBusiness));
router.post('/:id/switch', asyncHandler(switchBusiness));

// Employee management routes under business
router.post('/:id/employees/invite', asyncHandler(inviteEmployee));
router.get('/:id/employees', asyncHandler(getEmployees));
router.get('/:id/employees/:employeeId', asyncHandler(getEmployee));
router.put('/:id/employees/:employeeId', asyncHandler(updateEmployee));
router.post('/:id/employees/:employeeId/reauthorize', asyncHandler(reauthorizeEmployee));
router.delete('/:id/employees/:employeeId', asyncHandler(removeEmployee));

export default router;

