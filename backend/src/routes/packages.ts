import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { getSystemConfig } from '../utils/systemConfigStore';

const router = Router();

const packageCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  transactionLimit: z.number().int().nullable().optional(),
  employeeLimit: z.number().int().nullable().optional(),
  businessLimit: z.number().int().nullable().optional(),
  features: z.any().default({}),
  price: z.number().nullable().optional(),
  isCustom: z.boolean().optional(),
  billingCycle: z.enum(['ONE_TIME', 'MONTHLY', 'SIX_MONTH', 'QUARTERLY', 'YEARLY']).nullable().optional(),
  durationDays: z.number().int().nullable().optional(),
  isDeveloperToken: z.boolean().optional(),
  isFreePackage: z.boolean().optional(),
  tier: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE']).nullable().optional(),
  maxPhoneTxns: z.number().int().nullable().optional(),
  maxVerifiedTxns: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
});

const packageUpdateSchema = packageCreateSchema.partial();

router.get('/', asyncHandler(async (req, res) => {
  const config = await getSystemConfig();
  const tier = typeof req.query.tier === 'string' ? req.query.tier : undefined;

  const packages = await prisma.package.findMany({
    where: {
      ...(tier ? { tier } : {}),
    },
    orderBy: [
      { isFreePackage: 'desc' },
      { price: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  res.json({
    success: true,
    data: packages,
    meta: {
      billingMode: config.billingMode,
    },
  });
}));

router.get('/free/package', asyncHandler(async (_req, res) => {
  const freePackage = await prisma.package.findFirst({
    where: { isFreePackage: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: freePackage,
  });
}));

router.put('/free/package', authenticate as any, requireAdmin as any, asyncHandler(async (req, res) => {
  const payload = z.object({
    maxPhoneTxns: z.number().int().optional(),
    maxVerifiedTxns: z.number().int().optional(),
    description: z.string().optional(),
  }).parse(req.body);

  const freePackage = await prisma.package.findFirst({ where: { isFreePackage: true } });

  if (!freePackage) {
    throw new AppError(404, 'Free package not found');
  }

  const updated = await prisma.package.update({
    where: { id: freePackage.id },
    data: payload,
  });

  res.json({
    success: true,
    data: updated,
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const pkg = await prisma.package.findUnique({ where: { id: req.params.id } });

  if (!pkg) {
    throw new AppError(404, 'Package not found');
  }

  res.json({ success: true, data: pkg });
}));

router.post('/', authenticate as any, requireAdmin as any, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user?.id) {
    throw new AppError(401, 'Authentication required');
  }

  const payload = packageCreateSchema.parse(req.body);
  const created = await prisma.package.create({
    data: {
      ...payload,
      features: payload.features || {},
    },
  });

  res.status(201).json({ success: true, data: created });
}));

router.put('/:id', authenticate as any, requireAdmin as any, asyncHandler(async (req, res) => {
  const payload = packageUpdateSchema.parse(req.body);

  const existing = await prisma.package.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    throw new AppError(404, 'Package not found');
  }

  const updated = await prisma.package.update({
    where: { id: req.params.id },
    data: payload,
  });

  res.json({ success: true, data: updated });
}));

router.put('/businesses/:businessId', authenticate as any, requireAdmin as any, asyncHandler(async (req, res) => {
  const payload = z.object({ packageId: z.string().min(1) }).parse(req.body);

  const business = await prisma.business.findUnique({ where: { id: req.params.businessId } });
  if (!business) {
    throw new AppError(404, 'Business not found');
  }

  const pkg = await prisma.package.findUnique({ where: { id: payload.packageId } });
  if (!pkg) {
    throw new AppError(404, 'Package not found');
  }

  const updatedBusiness = await prisma.business.update({
    where: { id: req.params.businessId },
    data: { packageId: payload.packageId },
  });

  res.json({ success: true, data: updatedBusiness });
}));

export default router;
