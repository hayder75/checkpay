import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../middleware/errorHandler';
import { getMyUserPackage, activatePackage, updateQuotas, submitPackagePurchase, getMyPurchases } from '../controllers/userPackageController';

const router = Router();

router.use(authenticate as any);
router.use(auditLog as any);

router.get('/me', asyncHandler(getMyUserPackage));
router.get('/purchases', asyncHandler(getMyPurchases));
router.post('/activate', asyncHandler(activatePackage));
router.post('/purchase', asyncHandler(submitPackagePurchase));
router.patch('/:id/quotas', requireAdmin, asyncHandler(updateQuotas));

export default router;

