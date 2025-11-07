import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { auditLog } from '../middleware/auditLog';

const router = Router();

router.use(authenticate as any);
router.use(auditLog as any);

const upgradeSchema = z.object({
  txnId: z.string().min(1),
});

/**
 * Upgrade to premium by providing a transaction ID
 */
async function upgradeToPremium(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { txnId } = upgradeSchema.parse(req.body);

  // Find transaction in database
  const transaction = await prisma.transaction.findFirst({
    where: {
      txnId,
      amount: {
        gte: 15, // Premium price is $15
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!transaction) {
    throw new AppError(404, 'Transaction not found or amount insufficient. Premium costs $15.');
  }

  // Check if transaction is already used for upgrade
  if (transaction.userId !== req.user.id) {
    throw new AppError(400, 'This transaction belongs to another user');
  }

  // Check if user is already premium
  if (req.user.plan === 'PREMIUM') {
    return res.json({
      success: true,
      message: 'Account is already premium',
      data: {
        plan: 'PREMIUM',
      },
    });
  }

  // Upgrade user to premium
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { plan: 'PREMIUM' },
    select: {
      id: true,
      email: true,
      phone: true,
      apiKey: true,
      plan: true,
    },
  });

  res.json({
    success: true,
    message: 'Successfully upgraded to premium',
    data: user,
  });
}

/**
 * Get premium status
 */
async function getPremiumStatus(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      plan: true,
    },
  });

  const rateLimit = user?.plan === 'PREMIUM'
    ? parseInt(process.env.RATE_LIMIT_PREMIUM_MAX || '1000000')
    : parseInt(process.env.RATE_LIMIT_FREE_MAX || '100');

  // Count transactions this month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const txnsThisMonth = await prisma.transaction.count({
    where: {
      userId: req.user.id,
      createdAt: {
        gte: monthStart,
      },
    },
  });

  res.json({
    success: true,
    data: {
      plan: user?.plan || 'FREE',
      usage: {
        used: txnsThisMonth,
        limit: rateLimit,
        remaining: Math.max(0, rateLimit - txnsThisMonth),
      },
    },
  });
}

router.post('/upgrade', upgradeToPremium as any);
router.get('/status', getPremiumStatus as any);

export default router;

