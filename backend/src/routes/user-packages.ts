import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { getSystemConfig } from '../utils/systemConfigStore';

const router = Router();

const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 30;

function getTrialWindow(createdAt: Date) {
  const trialStartAt = new Date(createdAt);
  const trialEndsAt = new Date(createdAt.getTime() + TRIAL_DAYS * MILLIS_IN_DAY);
  return { trialStartAt, trialEndsAt };
}

async function getActivePackage(userId: string) {
  return prisma.userPackage.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    include: {
      package: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

router.use(authenticate as any);

router.get('/me', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user?.id) {
    throw new AppError(401, 'Authentication required');
  }

  const config = await getSystemConfig();

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, createdAt: true },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const { trialStartAt, trialEndsAt } = getTrialWindow(user.createdAt);
  const trialActive = trialEndsAt.getTime() > Date.now();
  const activePackage = await getActivePackage(req.user.id);

  res.json({
    success: true,
    data: activePackage,
    meta: {
      billingMode: config.billingMode,
      trial: {
        isActive: trialActive,
        startsAt: trialStartAt.toISOString(),
        endsAt: trialEndsAt.toISOString(),
      },
    },
  });
}));

router.get('/purchases', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user?.id) {
    throw new AppError(401, 'Authentication required');
  }

  const purchases = await prisma.packagePurchase.findMany({
    where: { userId: req.user.id },
    include: {
      package: {
        select: {
          id: true,
          name: true,
          price: true,
          tier: true,
          billingCycle: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: purchases });
}));

router.post('/purchase', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user?.id) {
    throw new AppError(401, 'Authentication required');
  }

  const payload = z.object({
    packageId: z.string().min(1),
    transactionNumber: z.string().min(3),
  }).parse(req.body);

  const pkg = await prisma.package.findUnique({ where: { id: payload.packageId } });
  if (!pkg || !pkg.isActive) {
    throw new AppError(404, 'Package not found or inactive');
  }

  const purchase = await prisma.packagePurchase.create({
    data: {
      userId: req.user.id,
      packageId: payload.packageId,
      transactionNumber: payload.transactionNumber,
      status: 'PENDING',
    },
    include: {
      package: {
        select: {
          id: true,
          name: true,
          price: true,
          tier: true,
          billingCycle: true,
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: purchase,
    message: 'Purchase submitted for verification',
  });
}));

router.post('/activate', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user?.id) {
    throw new AppError(401, 'Authentication required');
  }

  const payload = z.object({
    packageId: z.string().min(1),
    notes: z.string().optional(),
  }).parse(req.body);

  const pkg = await prisma.package.findUnique({ where: { id: payload.packageId } });
  if (!pkg || !pkg.isActive) {
    throw new AppError(404, 'Package not found or inactive');
  }

  const now = new Date();
  const endsAt = pkg.billingCycle === 'MONTHLY'
    ? new Date(now.getTime() + 30 * MILLIS_IN_DAY)
    : pkg.billingCycle === 'SIX_MONTH'
      ? new Date(now.getTime() + 180 * MILLIS_IN_DAY)
      : pkg.billingCycle === 'YEARLY'
        ? new Date(now.getTime() + 365 * MILLIS_IN_DAY)
        : pkg.durationDays
          ? new Date(now.getTime() + pkg.durationDays * MILLIS_IN_DAY)
          : null;

  await prisma.userPackage.updateMany({
    where: { userId: req.user.id, status: 'ACTIVE' },
    data: { status: 'EXPIRED', endsAt: now },
  });

  const activated = await prisma.userPackage.create({
    data: {
      userId: req.user.id,
      packageId: payload.packageId,
      status: 'ACTIVE',
      startsAt: now,
      endsAt,
      phoneTxnsRemaining: pkg.maxPhoneTxns,
      verifiedTxnsRemaining: pkg.maxVerifiedTxns,
      notes: payload.notes,
    },
    include: { package: true },
  });

  res.status(201).json({ success: true, data: activated });
}));

router.patch('/:id/quotas', authenticate as any, requireAdmin as any, asyncHandler(async (req, res) => {
  const payload = z.object({
    phoneTxnsRemaining: z.number().int().nullable().optional(),
    verifiedTxnsRemaining: z.number().int().nullable().optional(),
  }).parse(req.body);

  const updated = await prisma.userPackage.update({
    where: { id: req.params.id },
    data: payload,
  });

  res.json({ success: true, data: updated });
}));

router.get('/:id', authenticate as any, requireAdmin as any, asyncHandler(async (req, res) => {
  const userPackage = await prisma.userPackage.findUnique({
    where: { id: req.params.id },
    include: { package: true, user: { select: { id: true, email: true, phone: true } } },
  });

  if (!userPackage) {
    throw new AppError(404, 'User package not found');
  }

  res.json({ success: true, data: userPackage });
}));

export default router;
