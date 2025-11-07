import { Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { trackUsage, getUsageStats } from '../utils/usageTracker';

// Validation schemas
const ingestSchema = z.object({
  txnId: z.string().min(1),
  amount: z.number().positive(),
  sender: z.string(),
  bank: z.string().optional(),
  pattern: z.string().optional(),
});

/**
 * Ingest transaction from mobile app
 */
export async function ingestTransaction(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const data = ingestSchema.parse(req.body);

  // Check if transaction already exists
  const existing = await prisma.transaction.findUnique({
    where: {
      userId_txnId: {
        userId: req.user.id,
        txnId: data.txnId,
      },
    },
  });

  if (existing) {
    // Return success but don't create duplicate
    return res.json({
      success: true,
      data: existing,
      message: 'Transaction already exists',
    });
  }

  // Find pattern if provided
  let pattern = null;
  if (data.pattern) {
    pattern = await prisma.pattern.findFirst({
      where: {
        userId: req.user.id,
        name: data.pattern,
      },
    });
  }

  // Create transaction
  const transaction = await prisma.transaction.create({
    data: {
      userId: req.user.id,
      txnId: data.txnId,
      amount: data.amount,
      sender: data.sender, // Already masked by mobile app
      bank: data.bank,
      patternId: pattern?.id,
      receivedAt: new Date(),
    },
  });

  // Track usage for app requests (ingest)
  await trackUsage(req.user.id, 'app');

  res.status(201).json({
    success: true,
    data: transaction,
  });
}

/**
 * Verify a transaction
 */
export async function verifyTransaction(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { txn } = z.object({
    txn: z.string().min(1),
  }).parse(req.query);

  const transaction = await prisma.transaction.findFirst({
    where: {
      userId: req.user.id,
      txnId: txn,
    },
    include: {
      pattern: {
        select: {
          name: true,
          bank: true,
        },
      },
    },
  });

  // Track usage for dev requests (verify)
  await trackUsage(req.user.id, 'dev');

  if (!transaction) {
    return res.json({
      success: true,
      data: {
        confirmed: false,
        message: 'Transaction not found',
      },
    });
  }

  res.json({
    success: true,
    data: {
      confirmed: true,
      amount: transaction.amount,
      sender: transaction.sender,
      bank: transaction.bank || transaction.pattern?.bank || null,
      receivedAt: transaction.receivedAt,
      txnId: transaction.txnId,
    },
  });
}

/**
 * Get transaction history
 */
export async function getTransactions(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        pattern: {
          select: {
            name: true,
            bank: true,
          },
        },
      },
    }),
    prisma.transaction.count({
      where: {
        userId: req.user.id,
      },
    }),
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
 * Get dashboard statistics
 */
export async function getStats(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [txnsToday, txnsThisMonth, totalTxns, totalPatterns, plan, usageStats] = await Promise.all([
    prisma.transaction.count({
      where: {
        userId: req.user.id,
        createdAt: {
          gte: todayStart,
        },
      },
    }),
    prisma.transaction.count({
      where: {
        userId: req.user.id,
        createdAt: {
          gte: monthStart,
        },
      },
    }),
    prisma.transaction.count({
      where: {
        userId: req.user.id,
      },
    }),
    prisma.pattern.count({
      where: {
        userId: req.user.id,
      },
    }),
    prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true },
    }),
    getUsageStats(req.user.id),
  ]);

  const rateLimit = plan?.plan === 'PREMIUM' 
    ? parseInt(process.env.RATE_LIMIT_PREMIUM_MAX || '1000000')
    : parseInt(process.env.RATE_LIMIT_FREE_MAX || '100');

  const totalRequests = usageStats.appRequestsMonth + usageStats.devRequestsMonth;

  res.json({
    success: true,
    data: {
      transactions: {
        today: txnsToday,
        thisMonth: txnsThisMonth,
        total: totalTxns,
      },
      patterns: {
        total: totalPatterns,
      },
      plan: plan?.plan || 'FREE',
      rateLimit: {
        max: rateLimit,
        remaining: Math.max(0, rateLimit - totalRequests),
        used: totalRequests,
      },
      usage: {
        app: {
          today: usageStats.appRequestsToday,
          month: usageStats.appRequestsMonth,
        },
        dev: {
          today: usageStats.devRequestsToday,
          month: usageStats.devRequestsMonth,
        },
        total: totalRequests,
      },
    },
  });
}

