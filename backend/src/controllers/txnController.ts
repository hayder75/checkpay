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
  iccid: z.string().optional(), // SIM card ICCID from mobile app
});

/**
 * Ingest transaction from mobile app
 */
export async function ingestTransaction(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const data = ingestSchema.parse(req.body);

  // Check SIM card registration if ICCID provided
  if (data.iccid) {
    const simCard = await prisma.simCard.findFirst({
      where: {
        iccid: data.iccid,
        userId: req.user.id,
        isActive: true,
      },
    });

    if (!simCard) {
      throw new AppError(403, 'This SIM card is not registered. Please use the SIM card you registered with, or upgrade to Premium to add more SIMs.');
    }
  }

  // Check usage limits
  const usageStats = await getUsageStats(req.user.id);
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { plan: true },
  });

  // Free plan: 100 transactions/month
  if (user?.plan === 'FREE' && usageStats.appRequestsMonth >= 100) {
    throw new AppError(403, 'Free plan limit reached (100/100 transactions). Upgrade to Premium for unlimited transactions or wait until next month.');
  }

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
    console.log(`[INGEST] Duplicate transaction detected: userId=${req.user.id}, txnId=${data.txnId}`);
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
  try {
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

    console.log(`[INGEST] Transaction created: id=${transaction.id}, userId=${req.user.id}, txnId=${data.txnId}, amount=${data.amount}`);

    // Track usage for app requests (ingest)
    await trackUsage(req.user.id, 'app');

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    console.error('[INGEST] Error creating transaction:', error);
    // If it's a unique constraint violation, it means duplicate was created between check and insert
    if (error.code === 'P2002') {
      // Try to find the existing transaction
      const existingTxn = await prisma.transaction.findUnique({
        where: {
          userId_txnId: {
            userId: req.user.id,
            txnId: data.txnId,
          },
        },
      });
      if (existingTxn) {
        return res.json({
          success: true,
          data: existingTxn,
          message: 'Transaction already exists',
        });
      }
    }
    throw new AppError(500, 'Failed to create transaction');
  }
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

