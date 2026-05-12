import { Response } from 'express';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

// Validation schemas
const updateUserSchema = z.object({
  plan: z.enum(['FREE', 'PREMIUM']).optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  country: z.string().length(2).optional(),
});

const suspendUserSchema = z.object({
  suspended: z.boolean(),
});

/**
 * Get all users with pagination
 */
export async function getUsers(req: AuthRequest, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const where: any = {};
  
  // Filters
  if (req.query.plan) {
    where.plan = req.query.plan;
  }
  if (req.query.role) {
    where.role = req.query.role;
  }
  if (req.query.country) {
    where.country = req.query.country;
  }
  if (req.query.search) {
    where.OR = [
      { username: { contains: req.query.search as string, mode: 'insensitive' } },
      { email: { contains: req.query.search as string, mode: 'insensitive' } },
      { phone: { contains: req.query.search as string, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        plan: true,
        role: true,
        country: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            patterns: true,
            transactions: true,
            simCards: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

/**
 * Get single user details
 */
export async function getUser(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        plan: true,
        role: true,
        country: true,
        apiKey: true,
        devApiKey: true,
        createdAt: true,
        updatedAt: true,
      patterns: {
        select: {
          id: true,
          name: true,
          bank: true,
          currency: true,
          createdAt: true,
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
      transactions: {
        select: {
          id: true,
          txnId: true,
          amount: true,
          bank: true,
          receivedAt: true,
        },
        take: 10,
        orderBy: { receivedAt: 'desc' },
      },
      simCards: {
        select: {
          id: true,
          iccid: true,
          phoneNumber: true,
          isActive: true,
          createdAt: true,
        },
      },
      usageStats: {
        select: {
          appRequestsToday: true,
          appRequestsMonth: true,
          devRequestsToday: true,
          devRequestsMonth: true,
          lastResetDate: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  res.json({
    success: true,
    data: user,
  });
}

/**
 * Update user (plan, role, country)
 */
export async function updateUser(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const data = updateUserSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Prevent changing super admin role unless you're super admin
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user?.id },
    select: { role: true },
  });
  if (data.role && user.role === 'SUPER_ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Cannot modify super admin');
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      phone: true,
      plan: true,
      role: true,
      country: true,
      updatedAt: true,
    },
  });

  res.json({
    success: true,
    data: updated,
  });
}

/**
 * Get analytics overview
 */
export async function getAnalytics(req: AuthRequest, res: Response) {
  const [
    totalUsers,
    freeUsers,
    premiumUsers,
    adminUsers,
    totalPatterns,
    totalTransactions,
    transactionsToday,
    transactionsThisMonth,
    usersByCountry,
    patternsByCountry,
    transactionsByCountry,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: 'FREE' } }),
    prisma.user.count({ where: { plan: 'PREMIUM' } }),
    prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } }),
    prisma.pattern.count(),
    prisma.transaction.count(),
    prisma.transaction.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.transaction.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.user.groupBy({
      by: ['country'],
      _count: true,
      where: { country: { not: null } },
    }),
    prisma.pattern.groupBy({
      by: ['currency'],
      _count: true,
      where: { currency: { not: null } },
    }),
    prisma.transaction.groupBy({
      by: ['bank'],
      _count: true,
      where: { bank: { not: null } },
    }),
  ]);

  // Get usage stats
  const usageStats = await prisma.usageStats.aggregate({
    _sum: {
      appRequestsToday: true,
      appRequestsMonth: true,
      devRequestsToday: true,
      devRequestsMonth: true,
    },
  });

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        free: freeUsers,
        premium: premiumUsers,
        admin: adminUsers,
      },
      patterns: {
        total: totalPatterns,
      },
      transactions: {
        total: totalTransactions,
        today: transactionsToday,
        thisMonth: transactionsThisMonth,
      },
      usage: {
        appRequestsToday: usageStats._sum.appRequestsToday || 0,
        appRequestsMonth: usageStats._sum.appRequestsMonth || 0,
        devRequestsToday: usageStats._sum.devRequestsToday || 0,
        devRequestsMonth: usageStats._sum.devRequestsMonth || 0,
      },
      distribution: {
        usersByCountry: usersByCountry.map((u: any) => ({
          country: u.country,
          count: u._count,
        })),
        patternsByCurrency: patternsByCountry.map((p: any) => ({
          currency: p.currency,
          count: p._count,
        })),
        transactionsByBank: transactionsByCountry.map((t: any) => ({
          bank: t.bank,
          count: t._count,
        })),
      },
    },
  });
}

/**
 * Get all patterns with filters
 */
export async function getPatterns(req: AuthRequest, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const where: any = {};
  
  if (req.query.userId) {
    where.userId = req.query.userId;
  }
  if (req.query.bank) {
    where.bank = { contains: req.query.bank as string, mode: 'insensitive' };
  }
  if (req.query.currency) {
    where.currency = req.query.currency;
  }
  if (req.query.search) {
    where.OR = [
      { name: { contains: req.query.search as string, mode: 'insensitive' } },
      { bank: { contains: req.query.search as string, mode: 'insensitive' } },
    ];
  }

  const [patterns, total] = await Promise.all([
    prisma.pattern.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
            country: true,
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    }),
    prisma.pattern.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      patterns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

/**
 * Get all transactions with filters
 */
export async function getTransactions(req: AuthRequest, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const where: any = {};
  
  if (req.query.userId) {
    where.userId = req.query.userId;
  }
  if (req.query.bank) {
    where.bank = { contains: req.query.bank as string, mode: 'insensitive' };
  }
  if (req.query.txnId) {
    where.txnId = { contains: req.query.txnId as string, mode: 'insensitive' };
  }
  if (req.query.fromDate) {
    where.receivedAt = { gte: new Date(req.query.fromDate as string) };
  }
  if (req.query.toDate) {
    where.receivedAt = {
      ...where.receivedAt,
      lte: new Date(req.query.toDate as string),
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { receivedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
            country: true,
          },
        },
        pattern: {
          select: {
            id: true,
            name: true,
            bank: true,
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

/**
 * Get all countries
 */
export async function getCountries(req: AuthRequest, res: Response) {
  const countries = await prisma.country.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          patterns: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: countries,
  });
}

/**
 * Get country details with patterns
 */
export async function getCountry(req: AuthRequest, res: Response) {
  const { code } = req.params;

  const country = await prisma.country.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      patterns: {
        where: { isApproved: true },
        orderBy: { usageCount: 'desc' },
        take: 50,
      },
    },
  });

  if (!country) {
    throw new AppError(404, 'Country not found');
  }

  res.json({
    success: true,
    data: country,
  });
}

/**
 * Update country
 */
export async function updateCountry(req: AuthRequest, res: Response) {
  const { code } = req.params;
  const { name, banks, currencies, commonPhrases, isActive } = req.body;

  const country = await prisma.country.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!country) {
    throw new AppError(404, 'Country not found');
  }

  const updated = await prisma.country.update({
    where: { code: code.toUpperCase() },
    data: {
      name,
      banks: banks || undefined,
      currencies: currencies || undefined,
      commonPhrases: commonPhrases || undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    },
  });

  res.json({
    success: true,
    data: updated,
  });
}

/**
 * Get audit logs
 */
export async function getAuditLogs(req: AuthRequest, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const skip = (page - 1) * limit;

  const where: any = {};
  
  if (req.query.userId) {
    where.userId = req.query.userId;
  }
  if (req.query.action) {
    where.action = { contains: req.query.action as string, mode: 'insensitive' };
  }
  if (req.query.fromDate) {
    where.createdAt = { gte: new Date(req.query.fromDate as string) };
  }
  if (req.query.toDate) {
    where.createdAt = {
      ...where.createdAt,
      lte: new Date(req.query.toDate as string),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
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
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

/**
 * Get system health
 */
export async function getSystemHealth(req: AuthRequest, res: Response) {
  const [
    dbStatus,
    totalUsers,
    totalTransactions,
    recentErrors,
  ] = await Promise.all([
    prisma.$queryRaw`SELECT 1 as status`.catch(() => ({ status: 0 })),
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.auditLog.findMany({
      where: {
        action: { contains: 'error', mode: 'insensitive' },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  res.json({
    success: true,
    data: {
      database: {
        status: (dbStatus as any)[0]?.status === 1 ? 'healthy' : 'unhealthy',
      },
      stats: {
        totalUsers,
        totalTransactions,
      },
      recentErrors: recentErrors.length,
      errors: recentErrors,
    },
  });
}

async function assertAdmin(userId?: string) {
  if (!userId) {
    throw new AppError(401, 'Authentication required');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    throw new AppError(403, 'Admin access required');
  }
}

const moderationSchema = z.object({
  adminNotes: z.string().optional(),
});

export async function getPackagePurchases(req: AuthRequest, res: Response) {
  await assertAdmin(req.user?.id);

  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  const purchases = await prisma.packagePurchase.findMany({
    where: status ? { status } : {},
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      package: {
        select: {
          id: true,
          name: true,
          price: true,
          billingCycle: true,
          tier: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: purchases });
}

export async function verifyPackagePurchase(req: AuthRequest, res: Response) {
  await assertAdmin(req.user?.id);

  const { adminNotes } = moderationSchema.parse(req.body || {});
  const { id } = req.params;

  const purchase = await prisma.packagePurchase.findUnique({
    where: { id },
    include: {
      package: true,
    },
  });

  if (!purchase) {
    throw new AppError(404, 'Package purchase not found');
  }

  if (purchase.status === 'VERIFIED') {
    return res.json({ success: true, data: purchase, message: 'Purchase already verified' });
  }

  const now = new Date();
  const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;
  const endsAt = purchase.package.billingCycle === 'MONTHLY'
    ? new Date(now.getTime() + 30 * MILLIS_IN_DAY)
    : purchase.package.billingCycle === 'SIX_MONTH'
      ? new Date(now.getTime() + 180 * MILLIS_IN_DAY)
      : purchase.package.billingCycle === 'YEARLY'
        ? new Date(now.getTime() + 365 * MILLIS_IN_DAY)
        : purchase.package.durationDays
          ? new Date(now.getTime() + purchase.package.durationDays * MILLIS_IN_DAY)
          : null;

  const [updatedPurchase, activatedPackage] = await prisma.$transaction(async (tx) => {
    await tx.userPackage.updateMany({
      where: {
        userId: purchase.userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
        endsAt: now,
      },
    });

    const nextUserPackage = await tx.userPackage.create({
      data: {
        userId: purchase.userId,
        packageId: purchase.packageId,
        status: 'ACTIVE',
        startsAt: now,
        endsAt,
        phoneTxnsRemaining: purchase.package.maxPhoneTxns,
        verifiedTxnsRemaining: purchase.package.maxVerifiedTxns,
        notes: `Activated from purchase ${purchase.id}`,
      },
      include: {
        package: true,
      },
    });

    const nextPurchase = await tx.packagePurchase.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedAt: now,
        verifiedBy: req.user!.id,
        adminNotes: adminNotes || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            price: true,
            billingCycle: true,
            tier: true,
          },
        },
      },
    });

    return [nextPurchase, nextUserPackage] as const;
  });

  res.json({
    success: true,
    data: {
      purchase: updatedPurchase,
      userPackage: activatedPackage,
    },
    message: 'Purchase verified and package activated',
  });
}

export async function rejectPackagePurchase(req: AuthRequest, res: Response) {
  await assertAdmin(req.user?.id);

  const { adminNotes } = z.object({
    adminNotes: z.string().min(1, 'adminNotes is required for rejection'),
  }).parse(req.body || {});

  const { id } = req.params;
  const purchase = await prisma.packagePurchase.findUnique({ where: { id } });

  if (!purchase) {
    throw new AppError(404, 'Package purchase not found');
  }

  const updated = await prisma.packagePurchase.update({
    where: { id },
    data: {
      status: 'REJECTED',
      verifiedBy: req.user!.id,
      adminNotes,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      package: {
        select: {
          id: true,
          name: true,
          price: true,
          billingCycle: true,
          tier: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: updated,
    message: 'Purchase rejected',
  });
}

