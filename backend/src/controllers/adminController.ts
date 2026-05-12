import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import prisma from '../utils/prisma';
import { activateUserPackage } from '../utils/tokenUsage';

/**
 * Get all package purchases (admin only)
 */
export async function getPackagePurchases(req: AuthRequest, res: Response) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
    throw new AppError(403, 'Admin access required');
  }

  const status = req.query.status as string | undefined;
  const where: any = {};
  if (status) {
    where.status = status;
  }

  const purchases = await prisma.packagePurchase.findMany({
    where,
    include: {
      package: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    success: true,
    data: purchases,
  });
}

/**
 * Verify a package purchase and activate the package (admin only)
 */
export async function verifyPackagePurchase(req: AuthRequest, res: Response) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
    throw new AppError(403, 'Admin access required');
  }

  const { id } = req.params;
  const { adminNotes } = req.body;

  const purchase = await prisma.packagePurchase.findUnique({
    where: { id },
    include: {
      package: true,
      user: true,
    },
  });

  if (!purchase) {
    throw new AppError(404, 'Purchase request not found');
  }

  if (purchase.status !== 'PENDING') {
    throw new AppError(400, `Purchase request is already ${purchase.status.toLowerCase()}`);
  }

  // Activate the package for the user
  await activateUserPackage(purchase.userId, purchase.packageId, `Verified purchase - Transaction: ${purchase.transactionNumber}`);

  // Update purchase status
  const updated = await prisma.packagePurchase.update({
    where: { id },
    data: {
      status: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedBy: req.user.id,
      adminNotes: adminNotes || null,
    },
    include: {
      package: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
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

  res.json({
    success: true,
    data: updated,
    message: 'Package purchase verified and activated',
  });
}

/**
 * Reject a package purchase (admin only)
 */
export async function rejectPackagePurchase(req: AuthRequest, res: Response) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
    throw new AppError(403, 'Admin access required');
  }

  const { id } = req.params;
  const { adminNotes } = req.body;

  if (!adminNotes || !adminNotes.trim()) {
    throw new AppError(400, 'Admin notes are required when rejecting a purchase');
  }

  const purchase = await prisma.packagePurchase.findUnique({
    where: { id },
  });

  if (!purchase) {
    throw new AppError(404, 'Purchase request not found');
  }

  if (purchase.status !== 'PENDING') {
    throw new AppError(400, `Purchase request is already ${purchase.status.toLowerCase()}`);
  }

  const updated = await prisma.packagePurchase.update({
    where: { id },
    data: {
      status: 'REJECTED',
      verifiedAt: new Date(),
      verifiedBy: req.user.id,
      adminNotes,
    },
    include: {
      package: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
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

  res.json({
    success: true,
    data: updated,
    message: 'Package purchase rejected',
  });
}

