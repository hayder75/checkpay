import { Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { trackUsage, getUsageStats } from '../utils/usageTracker';
import { resolveIngestEntitlement, consumePhoneQuota } from '../utils/entitlement';

// Validation schemas
const ingestSchema = z.object({
  txnId: z.string().min(1),
  amount: z.number().positive(),
  sender: z.string(),
  bank: z.string().optional(),
  pattern: z.string().optional(),
  iccid: z.string().optional(), // SIM card ICCID from mobile app
  sendFrom: z.string().nullable().optional(), // Institution/account sending money
  sendTo: z.string().nullable().optional(),   // Institution/account receiving money
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

  // Mode-aware entitlement: trial, fixed-price unlimited, or count-based quotas.
  const entitlement = await resolveIngestEntitlement(req.user.id);

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

  // Extract prefix for partial matching (optional optimization)
  const { extractPrefix } = await import('../utils/partialTxnIdMatcher');
  const txnIdPrefix = extractPrefix(data.txnId, 8);

  // Create transaction
  try {
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        txnId: data.txnId,
        txnIdPrefix: txnIdPrefix,
        amount: data.amount,
        sender: data.sender, // Already masked by mobile app
        bank: data.bank,
        sendFrom: data.sendFrom || null,
        sendTo: data.sendTo || null,
        patternId: pattern?.id,
        receivedAt: new Date(),
      },
    });

    console.log(`[INGEST] Transaction created: id=${transaction.id}, userId=${req.user.id}, txnId=${data.txnId}, amount=${data.amount}`);

    // Track usage for app requests (ingest)
    await trackUsage(req.user.id, 'app');

    if (entitlement.shouldDecrementPhoneQuota && entitlement.userPackageId) {
      await consumePhoneQuota(entitlement.userPackageId);
    }

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
 * Supports exact and partial transaction ID matching
 */
export async function verifyTransaction(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  // Support both query param (GET) and body (POST)
  const txnId = (req.query.txn as string) || (req.body?.txnId as string) || (req.body?.txn as string);
  
  if (!txnId) {
    throw new AppError(400, 'Transaction ID is required');
  }

  const allowPartialMatch = req.body?.allowPartialMatch !== false; // Default to true

  // First, try exact match
  const exactMatch = await prisma.transaction.findFirst({
    where: {
      userId: req.user.id,
      txnId,
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

  if (exactMatch) {
    // Mark transaction as verified
    await prisma.transaction.update({
      where: { id: exactMatch.id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });
    
    // Track usage for dev requests (verify)
    await trackUsage(req.user.id, 'dev');
    
    return res.json({
      success: true,
      data: {
        confirmed: true,
        matchType: 'exact',
        amount: exactMatch.amount,
        sender: exactMatch.sender,
        bank: exactMatch.bank || exactMatch.pattern?.bank || null,
        receivedAt: exactMatch.receivedAt,
        txnId: exactMatch.txnId,
      },
    });
  }

  // If exact match not found and partial matching is allowed, try partial match
  if (allowPartialMatch) {
    const { findTransactionsByPrefix } = await import('../utils/partialTxnIdMatcher');
    
    // Get all transactions for this user (limit to recent ones for performance)
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
        receivedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      include: {
        pattern: {
          select: {
            name: true,
            bank: true,
          },
        },
      },
      orderBy: {
        receivedAt: 'desc',
      },
      take: 1000, // Limit to 1000 most recent transactions
    });

    const partialMatches = findTransactionsByPrefix(recentTransactions, txnId, 8);

    if (partialMatches.length > 0) {
      const bestMatch = partialMatches[0];
      
      // Only return match if confidence is high enough (>= 0.75)
      if (bestMatch.confidence >= 0.75) {
        // Mark transaction as verified
        await prisma.transaction.update({
          where: { id: bestMatch.transaction.id },
          data: {
            verified: true,
            verifiedAt: new Date(),
          },
        });
        
        // Track usage for dev requests (verify)
        await trackUsage(req.user.id, 'dev');
        
        return res.json({
          success: true,
          data: {
            confirmed: true,
            matchType: 'partial',
            confidence: bestMatch.confidence,
            commonPrefix: bestMatch.commonPrefix,
            amount: bestMatch.transaction.amount,
            sender: bestMatch.transaction.sender,
            bank: bestMatch.transaction.bank || bestMatch.transaction.pattern?.bank || null,
            receivedAt: bestMatch.transaction.receivedAt,
            txnId: bestMatch.transaction.txnId,
          },
        });
      }
    }
  }

  // Track usage for dev requests (verify) - even if not found
  await trackUsage(req.user.id, 'dev');

  // No match found
  return res.json({
    success: true,
    data: {
      confirmed: false,
      message: 'Transaction not found',
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
  const verified = req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined;
  const search = req.query.search as string | undefined;

  // Build where clause
  const where: any = {
    userId: req.user.id,
  };

  if (verified !== undefined) {
    where.verified = verified;
  }

  if (search) {
    where.OR = [
      { txnId: { contains: search, mode: 'insensitive' } },
      { sender: { contains: search, mode: 'insensitive' } },
      { bank: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [transactions, total, verifiedCount, unverifiedCount, verifiedAmount, unverifiedAmount] = await Promise.all([
    prisma.transaction.findMany({
      where,
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
    prisma.transaction.count({ where }),
    prisma.transaction.count({
      where: {
        userId: req.user.id,
        verified: true,
      },
    }),
    prisma.transaction.count({
      where: {
        userId: req.user.id,
        verified: false,
      },
    }),
    prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        verified: true,
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        verified: false,
      },
      _sum: {
        amount: true,
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
      stats: {
        verifiedCount,
        unverifiedCount,
        totalCount: verifiedCount + unverifiedCount,
        verifiedAmount: verifiedAmount._sum.amount || 0,
        unverifiedAmount: unverifiedAmount._sum.amount || 0,
        totalAmount: (verifiedAmount._sum.amount || 0) + (unverifiedAmount._sum.amount || 0),
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

