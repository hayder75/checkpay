import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { activateUserPackage, getActiveUserPackage, updateUserPackageQuotas } from '../utils/tokenUsage';
import prisma from '../utils/prisma';

/**
 * Get the caller's purchase requests (pending, verified, rejected)
 */
export async function getMyPurchases(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
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

  res.json({
    success: true,
    data: purchases,
  });
}

/**
 * Get the caller's active user package and quotas.
 */
export async function getMyUserPackage(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const active = await getActiveUserPackage(req.user.id);
  res.json({
    success: true,
    data: active,
  });
}

/**
 * Activate a package for the caller.
 */
export async function activatePackage(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { packageId, notes } = z.object({
    packageId: z.string(),
    notes: z.string().optional(),
  }).parse(req.body);

  const created = await activateUserPackage(req.user.id, packageId, notes);
  res.status(201).json({
    success: true,
    data: created,
  });
}

/**
 * Admin: update quotas for a user package.
 */
export async function updateQuotas(req: AuthRequest, res: Response) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
    throw new AppError(403, 'Admin access required');
  }

  const { id } = req.params;
  const { phoneTxnsRemaining, verifiedTxnsRemaining } = z.object({
    phoneTxnsRemaining: z.number().nullable().optional(),
    verifiedTxnsRemaining: z.number().nullable().optional(),
  }).parse(req.body);

  const updated = await updateUserPackageQuotas(id, phoneTxnsRemaining, verifiedTxnsRemaining);
  res.json({
    success: true,
    data: updated,
    message: 'Quotas updated',
  });
}

/**
 * Submit a package purchase request with transaction number
 */
export async function submitPackagePurchase(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { packageId, transactionNumber } = z.object({
    packageId: z.string(),
    transactionNumber: z.string().min(1, 'Transaction number is required'),
  }).parse(req.body);

  // Verify package exists
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg) {
    throw new AppError(404, 'Package not found');
  }

  if (!pkg.isActive) {
    throw new AppError(400, 'Package is not available for purchase');
  }

  // Check if user already has a pending purchase for this package
  const existingPurchase = await prisma.packagePurchase.findFirst({
    where: {
      userId: req.user.id,
      packageId,
      status: 'PENDING',
    },
  });

  if (existingPurchase) {
    throw new AppError(400, 'You already have a pending purchase request for this package');
  }

  // Create purchase request
  const purchase = await prisma.packagePurchase.create({
    data: {
      userId: req.user.id,
      packageId,
      transactionNumber,
      status: 'PENDING',
    },
    include: {
      package: true,
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          username: true,
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: purchase,
    message: 'Purchase request submitted. Your package will be activated once the transaction is verified.',
  });
}

