import { Router } from 'express';
import { getStats, getTransactions } from '../controllers/txnController';
import { getPendingVerifications } from '../controllers/pendingVerificationController';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../middleware/errorHandler';
import { Response } from 'express';
import prisma from '../utils/prisma';

const router = Router();

router.use(authenticate as any);
router.use(auditLog as any);

router.get('/stats', asyncHandler(getStats));
router.get('/transactions', asyncHandler(getTransactions));

// Get pending verifications for the authenticated user
router.get('/pending-verifications', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const businessId = req.query.businessId as string | undefined;
  const projectId = req.query.projectId as string | undefined;

  const verifications = await getPendingVerifications(req.user.id, businessId, projectId);

  res.json({
    success: true,
    data: verifications,
  });
}));

// Create pending verification (for developers before customer pays)
router.post('/pending-verifications', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, webhookUrl, referenceId, businessId, projectId } = req.body;
  
  const pending = await prisma.pendingVerification.create({
    data: {
      userId: req.user.id,
      businessId,
      projectId,
      amount: Number(amount),
      webhookUrl,
      referenceId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  
  res.json({ success: true, data: pending });
}));

export default router;
