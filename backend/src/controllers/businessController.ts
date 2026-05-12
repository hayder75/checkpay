import { Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { requireBusinessOwnership, getBusinessContext } from '../utils/businessValidator';
import { generateApiKey } from '../utils/generateApiKey';

const createBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  logo: z.union([z.string().url(), z.literal('')]).optional(),
  packageId: z.string().optional(),
  primaryInstitution: z.string().optional(), // Optional: Primary bank/institution
  ownerId: z.string().optional(), // For developers to assign to existing user
});

const updateBusinessSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  packageId: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Create a new business
 */
export async function createBusiness(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  // Only business owners and developers can create businesses
  if (!['BUSINESS_OWNER', 'DEVELOPER', 'ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    throw new AppError(403, 'Only business owners and developers can create businesses');
  }

  const data = createBusinessSchema.parse(req.body);

  // Determine owner ID
  let ownerId = req.user.id;
  
  // If developer provided ownerId, validate and use it
  if (data.ownerId && req.user.role === 'DEVELOPER') {
    const targetUser = await prisma.user.findUnique({
      where: { id: data.ownerId },
      select: { id: true, role: true },
    });
    
    if (!targetUser) {
      throw new AppError(404, 'User not found');
    }
    
    // Upgrade user to BUSINESS_OWNER if needed
    if (targetUser.role !== 'BUSINESS_OWNER' && targetUser.role !== 'ADMIN' && targetUser.role !== 'SUPER_ADMIN') {
      await prisma.user.update({
        where: { id: targetUser.id },
        data: { role: 'BUSINESS_OWNER' },
      });
    }
    
    ownerId = data.ownerId;
  }

  // Generate unique API key
  let apiKey = generateApiKey();
  let keyExists = await prisma.business.findUnique({ where: { apiKey } });
  while (keyExists) {
    apiKey = generateApiKey();
    keyExists = await prisma.business.findUnique({ where: { apiKey } });
  }

  // Create business
  const business = await prisma.business.create({
    data: {
      name: data.name,
      description: data.description || null,
      logo: data.logo && data.logo.trim() !== '' ? data.logo : null,
      ownerId,
      developerId: req.user.role === 'DEVELOPER' ? req.user.id : undefined,
      packageId: data.packageId || null,
      apiKey,
    },
    include: {
      package: true,
      institutions: true,
    },
  });

  // Create primary institution if provided
  if (data.primaryInstitution) {
    await prisma.businessInstitution.create({
      data: {
        businessId: business.id,
        institution: data.primaryInstitution,
        isPrimary: true,
      },
    });
  }

  // Reload with institutions
  const businessWithInstitutions = await prisma.business.findUnique({
    where: { id: business.id },
    include: {
      package: true,
      institutions: true,
    },
  });

  res.status(201).json({
    success: true,
    data: businessWithInstitutions,
  });
}

/**
 * Get all businesses for user
 */
export async function getBusinesses(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  let businesses;

  if (req.user.role === 'BUSINESS_OWNER') {
    // Business owners see their own businesses
    businesses = await prisma.business.findMany({
      where: {
        ownerId: req.user.id,
      },
      include: {
        package: true,
        institutions: true,
        businessPatterns: true,
        _count: {
          select: {
            employees: true,
            transactions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } else if (req.user.role === 'DEVELOPER') {
    // Developers see businesses they created
    businesses = await prisma.business.findMany({
      where: {
        developerId: req.user.id,
      },
      include: {
        package: true,
        institutions: true,
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } else if (req.user.role === 'EMPLOYEE') {
    // Employees see businesses they work for
    const employees = await prisma.employee.findMany({
      where: {
        userId: req.user.id,
        isActive: true,
      },
      include: {
        business: {
          include: {
            package: true,
            institutions: true,
          },
        },
      },
    });
    businesses = employees.map(e => e.business);
  } else {
    // Admin sees all
    businesses = await prisma.business.findMany({
      include: {
        package: true,
        institutions: true,
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  res.json({
    success: true,
    data: businesses,
  });
}

/**
 * Get single business
 */
export async function getBusiness(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;

  // Validate access
  const { requireBusinessAccess } = await import('../utils/businessValidator');
  await requireBusinessAccess(req.user.id, id);

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      package: true,
      institutions: true,
      businessPatterns: true,
      owner: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      developer: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      _count: {
        select: {
          employees: true,
          transactions: true,
        },
      },
    },
  });

  if (!business) {
    throw new AppError(404, 'Business not found');
  }

  res.json({
    success: true,
    data: business,
  });
}

/**
 * Update business
 */
export async function updateBusiness(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const data = updateBusinessSchema.parse(req.body);

  // Require ownership
  await requireBusinessOwnership(req.user.id, id);

  const business = await prisma.business.update({
    where: { id },
    data,
    include: {
      package: true,
      institutions: true,
    },
  });

  res.json({
    success: true,
    data: business,
  });
}

/**
 * Delete business
 */
export async function deleteBusiness(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;

  // Require ownership
  await requireBusinessOwnership(req.user.id, id);

  await prisma.business.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({
    success: true,
    message: 'Business deleted successfully',
  });
}

/**
 * Switch active business context
 */
export async function switchBusiness(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;

  // Validate access
  const { requireBusinessAccess } = await import('../utils/businessValidator');
  await requireBusinessAccess(req.user.id, id);

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      package: true,
      institutions: true,
    },
  });

  if (!business) {
    throw new AppError(404, 'Business not found');
  }

  res.json({
    success: true,
    data: business,
    message: 'Business context switched',
  });
}

/**
 * Get business statistics (employees, transactions, amounts)
 */
export async function getBusinessStats(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;  // Validate access
  const { requireBusinessAccess } = await import('../utils/businessValidator');
  await requireBusinessAccess(req.user.id, id);

  // Get business with employees
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      package: true,
      employees: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!business) {
    throw new AppError(404, 'Business not found');
  }

  // Get all transactions for this business
  const transactions = await prisma.transaction.findMany({
    where: {
      businessId: id,
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Calculate totals
  const totalTransactions = transactions.length;
  const totalAmount = transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
  const verifiedCount = transactions.filter(txn => txn.isValidated).length;
  const verifiedAmount = transactions
    .filter(txn => txn.isValidated)
    .reduce((sum, txn) => sum + (txn.amount || 0), 0);

  // Calculate stats per employee
  const employeeStats = business.employees.map(employee => {
    const employeeTransactions = transactions.filter(txn => txn.employeeId === employee.id);
    const employeeTotal = employeeTransactions.length;
    const employeeAmount = employeeTransactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
    const employeeVerified = employeeTransactions.filter(txn => txn.isValidated).length;
    const employeeVerifiedAmount = employeeTransactions
      .filter(txn => txn.isValidated)
      .reduce((sum, txn) => sum + (txn.amount || 0), 0);

    return {
      id: employee.id,
      name: employee.name,
      isActive: employee.isActive,
      joinedAt: employee.createdAt,
      allowAccessAllTransactions: employee.allowAccessAllTransactions,
      user: employee.user,
      stats: {
        totalTransactions: employeeTotal,
        totalAmount: employeeAmount,
        verifiedTransactions: employeeVerified,
        verifiedAmount: employeeVerifiedAmount,
      },
    };
  });

  // Get recent transactions (last 10)
  const recentTransactions = await prisma.transaction.findMany({
    where: {
      businessId: id,
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  res.json({
    success: true,
    data: {
      business: {
        id: business.id,
        name: business.name,
        description: business.description,
        logo: business.logo,
        package: business.package,
        createdAt: business.createdAt,
      },
      summary: {
        totalEmployees: business.employees.length,
        activeEmployees: business.employees.filter(e => e.isActive).length,
        totalTransactions,
        totalAmount,
        verifiedTransactions: verifiedCount,
        verifiedAmount,
      },
      employees: employeeStats,
      recentTransactions: recentTransactions.map(txn => ({
        id: txn.id,
        txnId: txn.txnId,
        amount: txn.amount,
        sender: txn.sender,
        isValidated: txn.isValidated,
        receivedAt: txn.receivedAt,
        createdAt: txn.createdAt,
        employee: txn.employee ? {
          id: txn.employee.id,
          name: txn.employee.name,
        } : null,
      })),
    },
  });
}