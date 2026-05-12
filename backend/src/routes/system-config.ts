import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { getSystemConfig, setBillingMode } from '../utils/systemConfigStore';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const updateBillingModeSchema = z.object({
  billingMode: z.enum(['COUNT_BASED', 'FIXED_PRICE']),
});

router.get('/billing-mode', asyncHandler(async (_req, res) => {
  const config = await getSystemConfig();

  res.json({
    success: true,
    data: {
      billingMode: config.billingMode,
      updatedAt: config.updatedAt,
    },
  });
}));

router.get('/', authenticate as any, requireAdmin as any, asyncHandler(async (_req, res) => {
  const config = await getSystemConfig();

  res.json({
    success: true,
    data: config,
  });
}));

router.patch('/billing-mode', authenticate as any, requireAdmin as any, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user?.id) {
    throw new AppError(401, 'Authentication required');
  }

  const { billingMode } = updateBillingModeSchema.parse(req.body);
  const config = await setBillingMode(billingMode, req.user.id);

  res.json({
    success: true,
    data: config,
    message: `Billing mode updated to ${billingMode}`,
  });
}));

export default router;
