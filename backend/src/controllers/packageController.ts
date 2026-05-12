import { Response } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { requireBusinessOwnership } from '../utils/businessValidator';

/**
 * Get all packages
 * Can filter by tier query parameter
 */
export async function getPackages(req: AuthRequest, res: Response) {
  try {
    const tier = req.query.tier as string | undefined;
    
    const where: any = {
      isActive: true,
    };
    
    if (tier) {
      where.tier = tier;
    }

    // Use simpler orderBy to avoid enum/null issues
    const packages = await prisma.package.findMany({
      where,
      orderBy: [
        { price: 'asc' },
      ],
    });
    
    // Sort by tier manually after fetching (to handle null values gracefully)
    const tierOrder = ['FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE'];
    packages.sort((a, b) => {
      const tierA = a.tier || 'ZZZ';
      const tierB = b.tier || 'ZZZ';
      const indexA = tierOrder.indexOf(tierA);
      const indexB = tierOrder.indexOf(tierB);
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return tierA.localeCompare(tierB);
    });

    res.json({
      success: true,
      data: packages || [],
    });
  } catch (error: any) {
    // If there's an error (e.g., column doesn't exist), return empty array gracefully
    console.error('Error loading packages:', error.message);
    res.json({
      success: true,
      data: [],
    });
  }
}

/**
 * Get single package
 */
export async function getPackage(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const package_ = await prisma.package.findUnique({
    where: { id },
  });

  if (!package_) {
    throw new AppError(404, 'Package not found');
  }

  res.json({
    success: true,
    data: package_,
  });
}

/**
 * Create custom package (Admin only)
 */
export async function createPackage(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only admins can create packages');
  }

  const data = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    transactionLimit: z.number().nullable().optional(),
    employeeLimit: z.number().nullable().optional(),
    businessLimit: z.number().nullable().optional(),
    features: z.record(z.any()),
    price: z.number().nullable().optional(),
    isCustom: z.boolean().optional().default(true),
    billingCycle: z.enum(['ONE_TIME', 'MONTHLY', 'SIX_MONTH', 'QUARTERLY', 'YEARLY']).nullable().optional(),
    durationDays: z.number().int().positive().nullable().optional(),
    isDeveloperToken: z.boolean().optional().default(false),
    isFreePackage: z.boolean().optional().default(false),
    tier: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE']).nullable().optional(),
    maxPhoneTxns: z.number().int().nullable().optional(),
    maxVerifiedTxns: z.number().int().nullable().optional(),
  }).parse(req.body);

  const package_ = await prisma.package.create({
    data: {
      name: data.name,
      description: data.description,
      transactionLimit: data.transactionLimit ?? null,
      employeeLimit: data.employeeLimit ?? null,
      businessLimit: data.businessLimit ?? null,
      features: data.features,
      price: data.price !== null && data.price !== undefined ? new Decimal(data.price) : null,
      isCustom: data.isCustom,
      billingCycle: data.billingCycle ?? null,
      durationDays: data.durationDays ?? null,
      isDeveloperToken: data.isDeveloperToken,
      isFreePackage: data.isFreePackage,
      tier: data.tier ?? null,
      maxPhoneTxns: data.maxPhoneTxns ?? null,
      maxVerifiedTxns: data.maxVerifiedTxns ?? null,
    },
  });

  res.status(201).json({
    success: true,
    data: package_,
  });
}

/**
 * Assign package to business
 */
export async function assignPackageToBusiness(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: businessId } = req.params;
  const { packageId } = z.object({
    packageId: z.string(),
  }).parse(req.body);

  // Require business ownership
  await requireBusinessOwnership(req.user.id, businessId);

  // Verify package exists
  const package_ = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!package_) {
    throw new AppError(404, 'Package not found');
  }

  // Update business
  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      packageId,
    },
    include: {
      package: true,
    },
  });

  res.json({
    success: true,
    data: business,
    message: 'Package assigned successfully',
  });
}

/**
 * Update package (Admin only)
 */
export async function updatePackage(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only admins can update packages');
  }

  const { id } = req.params;

  const data = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    transactionLimit: z.number().nullable().optional(),
    employeeLimit: z.number().nullable().optional(),
    businessLimit: z.number().nullable().optional(),
    features: z.record(z.any()).optional(),
    price: z.number().nullable().optional(),
    isCustom: z.boolean().optional(),
    billingCycle: z.enum(['ONE_TIME', 'MONTHLY', 'SIX_MONTH', 'QUARTERLY', 'YEARLY']).nullable().optional(),
    durationDays: z.number().int().positive().nullable().optional(),
    isDeveloperToken: z.boolean().optional(),
    isFreePackage: z.boolean().optional(),
    tier: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE']).nullable().optional(),
    maxPhoneTxns: z.number().int().nullable().optional(),
    maxVerifiedTxns: z.number().int().nullable().optional(),
    isActive: z.boolean().optional(),
  }).parse(req.body);

  // Check if package exists
  const existingPackage = await prisma.package.findUnique({
    where: { id },
  });

  if (!existingPackage) {
    throw new AppError(404, 'Package not found');
  }

  // Build update data
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.transactionLimit !== undefined) updateData.transactionLimit = data.transactionLimit;
  if (data.employeeLimit !== undefined) updateData.employeeLimit = data.employeeLimit;
  if (data.businessLimit !== undefined) updateData.businessLimit = data.businessLimit;
  if (data.features !== undefined) updateData.features = data.features;
  if (data.price !== undefined) {
    updateData.price = data.price !== null ? new Decimal(data.price) : null;
  }
  if (data.isCustom !== undefined) updateData.isCustom = data.isCustom;
  if (data.billingCycle !== undefined) updateData.billingCycle = data.billingCycle;
  if (data.durationDays !== undefined) updateData.durationDays = data.durationDays;
  if (data.isDeveloperToken !== undefined) updateData.isDeveloperToken = data.isDeveloperToken;
  if (data.isFreePackage !== undefined) updateData.isFreePackage = data.isFreePackage;
  if (data.tier !== undefined) updateData.tier = data.tier;
  if (data.maxPhoneTxns !== undefined) updateData.maxPhoneTxns = data.maxPhoneTxns;
  if (data.maxVerifiedTxns !== undefined) updateData.maxVerifiedTxns = data.maxVerifiedTxns;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updatedPackage = await prisma.package.update({
    where: { id },
    data: updateData,
  });

  res.json({
    success: true,
    data: updatedPackage,
    message: 'Package updated successfully',
  });
}

/**
 * Get free package settings (Admin only)
 */
export async function getFreePackage(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only admins can view free package settings');
  }

  try {
    const freePackage = await prisma.package.findFirst({
      where: { isFreePackage: true },
    });

    if (!freePackage) {
      // Return default values if free package doesn't exist
      return res.json({
        success: true,
        data: {
          id: null,
          name: 'Free Trial',
          description: 'Free trial package for new users',
          maxPhoneTxns: 50,
          maxVerifiedTxns: 50,
          isFreePackage: true,
        },
      });
    }

    res.json({
      success: true,
      data: freePackage,
    });
  } catch (error: any) {
    // Return default values if there's an error (e.g., column doesn't exist)
    console.error('Error loading free package:', error.message);
    res.json({
      success: true,
      data: {
        id: null,
        name: 'Free Trial',
        description: 'Free trial package for new users',
        maxPhoneTxns: 50,
        maxVerifiedTxns: 50,
        isFreePackage: true,
      },
    });
  }
}

/**
 * Update free package (Admin only)
 * This updates the free package configuration which affects new user registrations
 */
export async function updateFreePackage(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only admins can update free package settings');
  }

  const data = z.object({
    maxPhoneTxns: z.number().int().positive().optional(),
    maxVerifiedTxns: z.number().int().positive().optional(),
    description: z.string().optional(),
  }).parse(req.body);

  const freePackage = await prisma.package.findFirst({
    where: { isFreePackage: true },
  });

  if (!freePackage) {
    throw new AppError(404, 'Free package not found. Please create one first.');
  }

  const updateData: any = {};
  if (data.maxPhoneTxns !== undefined) updateData.maxPhoneTxns = data.maxPhoneTxns;
  if (data.maxVerifiedTxns !== undefined) updateData.maxVerifiedTxns = data.maxVerifiedTxns;
  if (data.description !== undefined) updateData.description = data.description;

  const updatedPackage = await prisma.package.update({
    where: { id: freePackage.id },
    data: updateData,
  });

  res.json({
    success: true,
    data: updatedPackage,
    message: 'Free package updated successfully',
  });
}

