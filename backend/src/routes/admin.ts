import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import prisma from '../utils/prisma';
import { z } from 'zod';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate as any);
router.use(requireAdmin as any);

/**
 * Get all users (admin only)
 */
async function getUsers(req: AuthRequest, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const where: any = {};

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
 * Get comprehensive analytics (admin only)
 * Enhanced with daily trends, growth metrics, top users, and more
 */
async function getAnalytics(req: AuthRequest, res: Response) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(weekStart.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Calculate date ranges for daily trends (last 30 days)
  const dailyDates: { date: string; dayStart: Date }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    dailyDates.push({
      date: date.toISOString().split('T')[0],
      dayStart: date,
    });
  }

  const [
    // Basic counts
    totalUsers,
    freeUsers,
    adminUsers,
    developerUsers,
    businessOwnerUsers,
    businessCount,
    totalTransactions,
    txnsToday,
    txnsThisMonth,
    txnsLastMonth,
    txnsThisWeek,
    txnsLastWeek,
    patternCount,
    activeCountriesCount,
    projectCount,
    employeeCount,
    // Usage aggregation
    usageAgg,
    // Distributions
    usersByCountry,
    patternsByCurrency,
    transactionsByBank,
    transactionsBySource,
    usersByRole,
    // Recent transactions for daily trends
    recentTransactions,
    recentUsers,
    // Top users by transaction count
    topUsersByTxns,
    // Package statistics
    activePackages,
    packagePurchases,
  ] = await Promise.all([
    // Basic counts
    prisma.user.count(),
    prisma.user.count({ where: { plan: 'FREE' } }),
    // Premium users count removed - system now uses tokens
    prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } }),
    prisma.user.count({ where: { role: 'DEVELOPER' } }),
    prisma.user.count({ where: { role: 'BUSINESS_OWNER' } }),
    prisma.business.count(),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.transaction.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.transaction.count({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
    prisma.transaction.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.transaction.count({ where: { createdAt: { gte: lastWeekStart, lt: weekStart } } }),
    prisma.pattern.count(),
    prisma.country.count({ where: { isActive: true } }),
    prisma.project.count(),
    prisma.employee.count(),
    // Usage aggregation
    prisma.usageStats.aggregate({
      _sum: {
        appRequestsToday: true,
        appRequestsMonth: true,
        devRequestsToday: true,
        devRequestsMonth: true,
      },
    }),
    // Distributions
    prisma.user.groupBy({
      by: ['country'],
      _count: { _all: true },
      where: { country: { not: null } },
    }),
    prisma.pattern.groupBy({
      by: ['currency'],
      _count: { _all: true },
      where: { currency: { not: null } },
    }),
    prisma.transaction.groupBy({
      by: ['bank'],
      _count: { _all: true },
      where: { bank: { not: null } },
    }),
    prisma.transaction.groupBy({
      by: ['source'],
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    }),
    // Recent data for trends
    prisma.transaction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    // Top users by transaction count
    prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { transactions: { _count: 'desc' } },
    }),
    // Package statistics
    prisma.userPackage.count({ where: { status: 'ACTIVE' } }),
    prisma.packagePurchase.count(),
  ]);

  // Calculate daily transaction trends
  const dailyTxnsMap = new Map<string, number>();
  recentTransactions.forEach((txn) => {
    const dateStr = txn.createdAt.toISOString().split('T')[0];
    dailyTxnsMap.set(dateStr, (dailyTxnsMap.get(dateStr) || 0) + 1);
  });

  const dailyTransactions = dailyDates.map(({ date }) => ({
    date,
    count: dailyTxnsMap.get(date) || 0,
  }));

  // Calculate daily user registration trends
  const dailyUsersMap = new Map<string, number>();
  recentUsers.forEach((user) => {
    const dateStr = user.createdAt.toISOString().split('T')[0];
    dailyUsersMap.set(dateStr, (dailyUsersMap.get(dateStr) || 0) + 1);
  });

  const dailyUsers = dailyDates.map(({ date }) => ({
    date,
    count: dailyUsersMap.get(date) || 0,
  }));

  // Calculate growth percentages
  const txnGrowthMonth = txnsLastMonth > 0
    ? Math.round(((txnsThisMonth - txnsLastMonth) / txnsLastMonth) * 100)
    : txnsThisMonth > 0 ? 100 : 0;
  const txnGrowthWeek = txnsLastWeek > 0
    ? Math.round(((txnsThisWeek - txnsLastWeek) / txnsLastWeek) * 100)
    : txnsThisWeek > 0 ? 100 : 0;

  // Calculate user engagement (users with transactions in last 30 days)
  const activeUsersCount = await prisma.user.count({
    where: {
      transactions: {
        some: {
          createdAt: { gte: thirtyDaysAgo },
        },
      },
    },
  });

  // Calculate pattern usage (patterns used in transactions)
  const activePatternsCount = await prisma.pattern.count({
    where: {
      transactions: {
        some: {},
      },
    },
  });

  res.json({
    success: true,
    data: {
      // Overview stats
      overview: {
        totalUsers,
        totalTransactions,
        totalPatterns: patternCount,
        totalBusinesses: businessCount,
        totalProjects: projectCount,
        activeUsers: activeUsersCount,
        activePatterns: activePatternsCount,
      },
      // User statistics
      users: {
        total: totalUsers,
        free: freeUsers,
        // Premium removed - system now uses tokens
        admin: adminUsers,
        developer: developerUsers,
        businessOwner: businessOwnerUsers,
        employee: employeeCount,
        active: activeUsersCount,
        daily: dailyUsers,
      },
      // Transaction statistics
      transactions: {
        total: totalTransactions,
        today: txnsToday,
        thisWeek: txnsThisWeek,
        thisMonth: txnsThisMonth,
        lastMonth: txnsLastMonth,
        lastWeek: txnsLastWeek,
        growthMonth: txnGrowthMonth,
        growthWeek: txnGrowthWeek,
        daily: dailyTransactions,
      },
      // Pattern statistics
      patterns: {
        total: patternCount,
        active: activePatternsCount,
      },
      // Business & Project statistics
      businesses: {
        total: businessCount,
      },
      projects: {
        total: projectCount,
      },
      // Country statistics
      countries: {
        active: activeCountriesCount,
      },
      // API Usage statistics
      usage: {
        appRequestsToday: usageAgg._sum.appRequestsToday || 0,
        appRequestsMonth: usageAgg._sum.appRequestsMonth || 0,
        devRequestsToday: usageAgg._sum.devRequestsToday || 0,
        devRequestsMonth: usageAgg._sum.devRequestsMonth || 0,
      },
      // Distributions
      distribution: {
        usersByCountry: usersByCountry
          .filter((u) => u.country)
          .map((u) => ({ country: u.country, count: u._count._all }))
          .sort((a, b) => b.count - a.count),
        usersByRole: usersByRole.map((u) => ({ role: u.role, count: u._count._all })),
        patternsByCurrency: patternsByCurrency
          .map((p) => ({ currency: p.currency, count: p._count._all }))
          .sort((a, b) => b.count - a.count),
        transactionsByBank: transactionsByBank
          .map((t) => ({ bank: t.bank, count: t._count._all }))
          .sort((a, b) => b.count - a.count),
        transactionsBySource: transactionsBySource.map((t) => ({ source: t.source, count: t._count._all })),
      },
      // Top users
      topUsers: topUsersByTxns.map((user) => ({
        id: user.id,
        username: user.username || user.email || 'Unknown',
        email: user.email,
        role: user.role,
        transactionCount: user._count.transactions,
      })),
      // Package statistics
      packages: {
        active: activePackages,
        totalPurchases: packagePurchases,
      },
    },
  });
}

/**
 * Get patterns (admin only) - Enhanced with filtering for suspicious/incomplete patterns
 */
async function getPatterns(req: AuthRequest, res: Response) {
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

  // Filter templates (admin-created patterns)
  if (req.query.isTemplate === 'true') {
    where.isTemplate = true;
  } else if (req.query.isTemplate === 'false') {
    where.isTemplate = false;
  }

  // Build OR conditions - handle both search and suspicious filters
  const orConditions: any[] = [];

  if (req.query.search) {
    orConditions.push(
      { name: { contains: req.query.search as string, mode: 'insensitive' } },
      { bank: { contains: req.query.search as string, mode: 'insensitive' } }
    );
  }

  // Filter suspicious patterns (missing required fields)
  if (req.query.suspicious === 'true') {
    orConditions.push(
      { regex: { equals: '' } },
      { regex: null },
      { extractFields: { equals: {} } },
      { extractFields: null }
    );
  }

  // Only add OR if we have conditions
  if (orConditions.length > 0) {
    where.OR = orConditions;
  }

  // Fetch all patterns first (we'll deduplicate by regex)
  // Only fetch patterns that actually exist (not soft-deleted or hard-deleted)
  const allPatterns = await prisma.pattern.findMany({
    where: {
      ...where,
      // Ensure we only get patterns that exist (no additional filters needed as Prisma handles this)
    },
    orderBy: [
      { createdAt: 'desc' }, // Most recent first
    ],
    include: {
      creator: {
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
          userPatterns: true, // Usage count = number of users who have this pattern
        },
      },
    },
  });

  // Deduplicate by regex - keep only one pattern per unique regex
  // IMPORTANT: Always prefer the ORIGINAL creator (earliest createdAt) to preserve ownership
  // Priority: admin templates > original creator (earliest) > shared patterns
  const uniquePatternsMap = new Map<string, typeof allPatterns[0]>();

  for (const pattern of allPatterns) {
    const regexKey = pattern.regex;
    if (!regexKey) continue; // Skip patterns without regex

    const existing = uniquePatternsMap.get(regexKey);

    if (!existing) {
      // First occurrence of this regex
      uniquePatternsMap.set(regexKey, pattern);
    } else {
      // Choose which pattern to keep based on priority
      // Priority 1: Admin templates (isTemplate = true)
      // Priority 2: Original creator (earliest createdAt) - OWNERSHIP NEVER CHANGES
      // Priority 3: Shared patterns (creatorId = null)

      const currentIsTemplate = pattern.isTemplate ? 1 : 0;
      const existingIsTemplate = existing.isTemplate ? 1 : 0;

      // If one is template and other isn't, prefer template
      if (currentIsTemplate > existingIsTemplate) {
        uniquePatternsMap.set(regexKey, pattern);
      } else if (existingIsTemplate > currentIsTemplate) {
        // Keep existing (it's a template)
        continue;
      } else {
        // Both same template status - prefer ORIGINAL creator (earliest createdAt)
        // This preserves ownership - the first person to create it is always the owner
        const currentCreatedAt = new Date(pattern.createdAt);
        const existingCreatedAt = new Date(existing.createdAt);

        if (currentCreatedAt < existingCreatedAt) {
          // Current pattern was created earlier - it's the original
          uniquePatternsMap.set(regexKey, pattern);
        } else if (existingCreatedAt < currentCreatedAt) {
          // Existing pattern was created earlier - keep it
          continue;
        } else {
          // Same creation time (unlikely but handle it) - prefer one with creatorId
          if (pattern.creatorId && !existing.creatorId) {
            uniquePatternsMap.set(regexKey, pattern);
          } else if (existing.creatorId && !pattern.creatorId) {
            continue;
          } else {
            // Both have same creatorId status - keep existing (first one found)
            continue;
          }
        }
      }
    }
  }

  // Convert map to array, sort by usage count (descending), then apply pagination
  const uniquePatterns = Array.from(uniquePatternsMap.values());

  // Sort by usage count (descending) - calculated from _count.userPatterns
  uniquePatterns.sort((a, b) => {
    const usageA = (a._count && 'userPatterns' in a._count ? a._count.userPatterns : null) || 0;
    const usageB = (b._count && 'userPatterns' in b._count ? b._count.userPatterns : null) || 0;
    if (usageA !== usageB) {
      return usageB - usageA; // Descending order
    }
    // If same usage, sort by createdAt (most recent first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const total = uniquePatterns.length;
  const paginatedPatterns = uniquePatterns.slice(skip, skip + limit);

  // Add validation flags for suspicious patterns
  const patternsWithValidation = paginatedPatterns.map((pattern) => {
    const extractFields = pattern.extractFields as any || {};
    const hasTxnId = extractFields.txnId !== undefined;
    const hasAmount = extractFields.amount !== undefined;
    const hasRegex = pattern.regex && pattern.regex.trim() !== '';

    const isSuspicious = !hasRegex || (!hasTxnId && !hasAmount);

    // Usage count = number of users who have this pattern in their list
    const usersUsingCount = (pattern._count && typeof pattern._count === 'object' && 'userPatterns' in pattern._count ? pattern._count.userPatterns : null) || 0;

    // For admin display: if pattern is admin-created (creatorId=null), show "Admin"
    // Otherwise show the actual creator (handle null creator gracefully)
    const displayCreator = pattern.creatorId === null
      ? { id: 'admin', username: 'Admin', email: null, phone: null } // Show as admin-created
      : (pattern.creator || { id: 'unknown', username: 'Unknown', email: null, phone: null }); // Handle deleted creator

    return {
      ...pattern,
      creator: displayCreator, // Show creator (admin or user)
      user: displayCreator, // Keep for backward compatibility
      validation: {
        hasRegex,
        hasTxnId,
        hasAmount,
        isSuspicious,
        missingFields: [
          !hasRegex ? 'regex' : null,
          !hasTxnId ? 'txnId' : null,
          !hasAmount ? 'amount' : null,
        ].filter(Boolean),
      },
      usersUsingCount, // Number of users who have this pattern in their library
      usageCount: usersUsingCount, // Alias for backward compatibility
    };
  });

  res.json({
    success: true,
    data: {
      patterns: patternsWithValidation,
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
 * Create admin pattern template (admin only) - Same as user creation but with isTemplate=true
 */
async function createAdminPattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { smsText, smsTexts, name, description, useAI } = z.object({
    smsText: z.string().min(1).optional(),
    smsTexts: z.array(z.string().min(1)).optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    useAI: z.boolean().optional().default(false),
  }).parse(req.body);

  // Normalize to array - use smsTexts if provided, otherwise use single smsText
  const texts = smsTexts && smsTexts.length > 0 ? smsTexts : (smsText ? [smsText] : []);

  if (texts.length === 0) {
    throw new AppError(400, 'At least one SMS text is required');
  }

  // If useAI is true, use AI generation
  if (useAI) {
    return createAdminPatternWithAI(req, res);
  }

  // Use smart pattern generator
  try {
    const { generateSmartPatternsMultiple } = await import('../utils/smartPatternGenerator');

    // Generate patterns for all SMS texts
    const patternResults = generateSmartPatternsMultiple(texts);

    // Use the result with highest confidence as primary
    const primaryResult = patternResults.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    // Validate that we have required fields
    const hasTxnId = primaryResult.extractedValues.txnId && primaryResult.extractedValues.txnId.trim() !== '';
    const hasAmount = primaryResult.extractedValues.amount !== null && primaryResult.extractedValues.amount > 0;

    // If smart pattern failed, try AI
    if (!hasTxnId || !hasAmount) {
      console.log('⚠️ [Admin Pattern] Smart pattern failed, trying AI...');

      try {
        const { extractPatternsMultiLanguage } = await import('../utils/geminiAI');
        const aiResults = await extractPatternsMultiLanguage(texts);

        if (aiResults.length > 0 && aiResults[0].regex && aiResults[0].extractedValues.txnId) {
          const aiResult = aiResults[0];

          const pattern = await prisma.pattern.create({
            data: {
              creatorId: null, // Admin-created patterns
              name,
              regex: aiResult.regex,
              extractFields: aiResult.extractFields,
              bank: aiResult.bank,
              currency: aiResult.currency,
              description: description || null,
              isTemplate: false,
            },
          });

          return res.status(201).json({
            success: true,
            data: pattern,
            extracted: aiResult.extractedValues,
            method: 'ai',
            confidence: aiResult.confidence,
            message: 'Admin pattern created using AI',
          });
        }
      } catch (aiError: any) {
        console.error('AI fallback failed:', aiError.message);
      }

      throw new AppError(400, 'Could not extract pattern from SMS. Please ensure the SMS contains a valid transaction with transaction ID and amount.');
    }

    // Check for duplicate patterns
    const existingPatterns = await prisma.pattern.findMany({
      where: {
        isFlagged: false,
        bank: primaryResult.bank || undefined,
      },
      select: { id: true, name: true, regex: true, creatorId: true },
    });

    // Check if any existing pattern has similar regex
    const newPrimaryRegex = primaryResult.regex;
    for (const existing of existingPatterns) {
      const normalizedExisting = existing.regex.replace(/\([^)]+\)/g, '()');
      const normalizedNew = newPrimaryRegex.replace(/\([^)]+\)/g, '()');
      if (normalizedExisting === normalizedNew ||
        Math.abs(existing.regex.length - newPrimaryRegex.length) < 10) {
        const patternOwner = existing.creatorId === null ? 'admin' : 'a user';
        throw new AppError(409, `A pattern with the same SMS format already exists: "${existing.name}" (created by ${patternOwner}). Please use a different SMS message or delete the existing pattern first.`);
      }
    }

    // Create pattern (admin-created, creatorId=null means admin-created/shared)
    // Admin-created patterns should be templates so they appear in marketplace
    const pattern = await prisma.pattern.create({
      data: {
        creatorId: null, // Admin-created patterns (shared, no specific owner)
        name,
        regex: primaryResult.regex,
        extractFields: primaryResult.extractFields,
        bank: primaryResult.bank,
        currency: primaryResult.currency,
        description: description || null,
        isTemplate: true, // Admin patterns are templates for marketplace
        isApproved: true, // Auto-approved
      },
    });

    // Return all extracted values
    const allExtracted = patternResults.map(result => result.extractedValues);

    res.status(201).json({
      success: true,
      data: pattern,
      extracted: allExtracted.length === 1 ? allExtracted[0] : allExtracted,
      method: primaryResult.method,
      confidence: primaryResult.confidence,
      message: 'Admin pattern template created successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(500, `Failed to create admin pattern: ${error.message}`);
  }
}

/**
 * Create admin pattern template using AI
 */
async function createAdminPatternWithAI(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { smsText, smsTexts, name, description } = z.object({
    smsText: z.string().min(1).optional(),
    smsTexts: z.array(z.string().min(1)).optional(),
    name: z.string().min(1),
    description: z.string().optional(),
  }).parse(req.body);

  const texts = smsTexts && smsTexts.length > 0 ? smsTexts : (smsText ? [smsText] : []);

  if (texts.length === 0) {
    throw new AppError(400, 'At least one SMS text is required');
  }

  try {
    // Import AI utility
    const { extractPatternsMultiLanguage } = await import('../utils/geminiAI');

    // Extract patterns for all SMS texts
    let aiResults;
    try {
      aiResults = await extractPatternsMultiLanguage(texts);
    } catch (aiError: any) {
      throw new AppError(500, `AI extraction failed: ${aiError.message}`);
    }

    if (!aiResults || aiResults.length === 0 || aiResults.every(r => !r.regex || r.regex.trim() === '')) {
      throw new AppError(400, 'Failed to extract pattern from SMS. Please ensure the SMS contains a valid transaction message.');
    }

    // Validate that at least one result has required fields
    const validResults = aiResults.filter(result => {
      const hasTxnId = result.extractedValues.txnId && result.extractedValues.txnId.trim() !== '';
      const hasAmount = result.extractedValues.amount !== null && result.extractedValues.amount > 0;
      return hasTxnId && hasAmount && result.regex && result.regex.trim() !== '';
    });

    if (validResults.length === 0) {
      throw new AppError(400, 'Cannot create pattern: The SMS message is missing required information (transaction ID and amount).');
    }

    const primaryResult = validResults[0];

    // Build extractFields from the primary pattern
    const extractFields: any = {};
    let groupIndex = 1;

    if (primaryResult.extractedValues.txnId) {
      extractFields.txnId = { group: groupIndex++, type: 'string' };
    }
    if (primaryResult.extractedValues.amount !== null) {
      extractFields.amount = { group: groupIndex++, type: 'number' };
    }
    if (primaryResult.extractedValues.sender) {
      extractFields.sender = { group: groupIndex++, type: 'string' };
    }

    // Check for duplicate patterns by normalizing and comparing regex structure
    // Use shared normalization function (same as user-side)
    const { normalizeRegexForComparison } = await import('../utils/patternNormalizer');
    const newPrimaryRegex = primaryResult.regex;
    const normalizedNew = normalizeRegexForComparison(newPrimaryRegex);

    // Get all existing patterns (user and admin) to check against
    const existingPatterns = await prisma.pattern.findMany({
      where: {
        isFlagged: false,
        bank: primaryResult.bank || undefined, // Same bank helps narrow down
      },
      select: { id: true, name: true, regex: true, creatorId: true },
    });

    // Check if any existing pattern has the same normalized structure
    for (const existing of existingPatterns) {
      const normalizedExisting = normalizeRegexForComparison(existing.regex);
      if (normalizedExisting === normalizedNew) {
        const patternOwner = existing.creatorId === null ? 'admin' : 'a user';
        throw new AppError(409, `A pattern with the same SMS format already exists: "${existing.name}" (created by ${patternOwner}). Please use a different SMS message or delete the existing pattern first.`);
      }
    }

    // Create pattern (admin-created)
    // Admin-created patterns should be templates so they appear in marketplace
    const pattern = await prisma.pattern.create({
      data: {
        creatorId: null, // Admin-created patterns (shared, no specific owner)
        name,
        regex: primaryResult.regex,
        extractFields,
        bank: primaryResult.bank,
        currency: primaryResult.currency,
        description: description || null,
        isTemplate: true, // Admin patterns are templates for marketplace
        isApproved: true, // Auto-approved
      },
    });

    const allExtracted = aiResults.map(result => result.extractedValues);

    res.status(201).json({
      success: true,
      data: pattern,
      extracted: allExtracted,
      method: 'ai',
      message: 'Admin pattern template created successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(500, `Failed to create admin pattern with AI: ${error.message}`);
  }
}

/**
 * Delete a pattern (admin only) - Hard delete ALL instances with same regex
 * When admin deletes a pattern, it deletes all patterns with the same regex from all users
 */
async function deletePattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  // Verify user is admin
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true },
  });

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    throw new AppError(403, 'Access denied. Admin role required.');
  }

  const { id } = req.params;

  try {
    // First check if pattern exists
    const pattern = await prisma.pattern.findUnique({
      where: { id },
      include: {
        transactions: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!pattern) {
      // Pattern doesn't exist - might have been deleted already
      // Return success to avoid frontend errors (idempotent delete)
      return res.json({
        success: true,
        message: 'Pattern not found or already deleted',
        alreadyDeleted: true,
      });
    }

    // Check if pattern has transactions
    const transactionCount = await prisma.transaction.count({
      where: {
        patternId: id,
      },
    });

    if (transactionCount > 0) {
      throw new AppError(400, `Cannot delete pattern: It has ${transactionCount} associated transaction(s). Block it instead.`);
    }

    // Delete the pattern and all UserPattern links (cascade)
    // This removes the pattern from all users' lists
    await prisma.pattern.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Pattern deleted successfully from the system',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    // Handle Prisma errors
    if (error.code === 'P2025') {
      // Record not found - already deleted
      return res.json({
        success: true,
        message: 'Pattern not found or already deleted',
        alreadyDeleted: true,
      });
    }
    throw new AppError(500, `Failed to delete pattern: ${error.message}`);
  }
}

/**
 * Block or unblock a pattern (admin only)
 */
async function blockPattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const { blocked, adminNotes } = z.object({
    blocked: z.boolean(),
    adminNotes: z.string().optional(),
  }).parse(req.body);

  const pattern = await prisma.pattern.findUnique({
    where: { id },
  });

  if (!pattern) {
    throw new AppError(404, 'Pattern not found');
  }

  const updatedPattern = await prisma.pattern.update({
    where: { id },
    data: {
      isFlagged: blocked,
      flaggedAt: blocked ? new Date() : null,
      adminNotes: adminNotes || pattern.adminNotes || null,
    } as any,
  });

  res.json({
    success: true,
    data: updatedPattern,
    message: `Pattern ${blocked ? 'blocked' : 'unblocked'} successfully`,
  });
}

/**
 * Update pattern (admin only)
 */
async function updatePattern(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { name, regex, extractFields, bank, currency, description, isTemplate } = z.object({
    name: z.string().min(1).optional(),
    regex: z.string().min(1).optional(),
    extractFields: z.record(z.any()).optional(),
    bank: z.string().optional(),
    currency: z.string().optional(),
    description: z.string().optional(),
    isTemplate: z.boolean().optional(),
  }).parse(req.body);

  const pattern = await prisma.pattern.findUnique({
    where: { id },
  });

  if (!pattern) {
    throw new AppError(404, 'Pattern not found');
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (regex) updateData.regex = regex;
  if (extractFields) updateData.extractFields = extractFields;
  if (bank !== undefined) updateData.bank = bank || null;
  if (currency !== undefined) updateData.currency = currency || null;
  if (description !== undefined) updateData.description = description || null;
  if (isTemplate !== undefined) updateData.isTemplate = isTemplate;

  const updatedPattern = await prisma.pattern.update({
    where: { id },
    data: updateData as any,
  });

  res.json({
    success: true,
    data: updatedPattern,
    message: 'Pattern updated successfully',
  });
}

/**
 * Get suspicious/incomplete patterns (admin only)
 */
async function getSuspiciousPatterns(req: AuthRequest, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  // Find patterns with missing required fields
  const allPatterns = await prisma.pattern.findMany({
    where: {
      creatorId: { not: null }, // Only user-created patterns, not admin templates
    },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  // Filter suspicious patterns
  const suspiciousPatterns = allPatterns
    .map((pattern) => {
      const extractFields = pattern.extractFields as any || {};
      const hasTxnId = extractFields.txnId !== undefined;
      const hasAmount = extractFields.amount !== undefined;
      const hasRegex = pattern.regex && pattern.regex.trim() !== '';

      const isSuspicious = !hasRegex || (!hasTxnId && !hasAmount);

      if (!isSuspicious) return null;

      return {
        ...pattern,
        validation: {
          hasRegex,
          hasTxnId,
          hasAmount,
          missingFields: [
            !hasRegex ? 'regex' : null,
            !hasTxnId ? 'txnId' : null,
            !hasAmount ? 'amount' : null,
          ].filter(Boolean),
        },
      };
    })
    .filter(Boolean)
    .slice(skip, skip + limit);

  res.json({
    success: true,
    data: {
      patterns: suspiciousPatterns,
      pagination: {
        page,
        limit,
        total: suspiciousPatterns.length,
        pages: Math.ceil(suspiciousPatterns.length / limit),
      },
    },
  });
}

/**
 * Get transactions with analytics (admin only)
 */
async function getTransactions(req: AuthRequest, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const includeAnalytics = req.query.analytics === 'true';

  const where: any = {};

  if (req.query.userId) {
    where.userId = req.query.userId;
  }
  if (req.query.bank) {
    where.bank = { contains: req.query.bank as string, mode: 'insensitive' };
  }
  if (req.query.txnId) {
    where.OR = [
      { txnId: { contains: req.query.txnId as string, mode: 'insensitive' } },
      { referenceTxnId: { contains: req.query.txnId as string, mode: 'insensitive' } },
    ];
  }
  if (req.query.fromDate) {
    where.receivedAt = { gte: new Date(req.query.fromDate as string) };
  }
  if (req.query.toDate) {
    where.receivedAt = { ...where.receivedAt, lte: new Date(req.query.toDate as string) };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Build base query promises
  const promises: any[] = [
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
          },
        },
        business: {
          select: {
            id: true,
            name: true,
          },
        },
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
        pattern: {
          select: {
            id: true,
            name: true,
            bank: true,
            currency: true,
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ];

  // Add analytics if requested
  if (includeAnalytics) {
    const analyticsWhere = { ...where };

    promises.push(
      // Total amount
      prisma.transaction.aggregate({
        where: analyticsWhere,
        _sum: { amount: true },
        _avg: { amount: true },
        _count: { id: true },
      }),
      // Today's stats
      prisma.transaction.aggregate({
        where: { ...analyticsWhere, receivedAt: { gte: todayStart } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // This week's stats
      prisma.transaction.aggregate({
        where: { ...analyticsWhere, receivedAt: { gte: weekStart } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // This month's stats
      prisma.transaction.aggregate({
        where: { ...analyticsWhere, receivedAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // By bank
      prisma.transaction.groupBy({
        by: ['bank'],
        where: { ...analyticsWhere, bank: { not: null } },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      // By source
      prisma.transaction.groupBy({
        by: ['source'],
        where: analyticsWhere,
        _sum: { amount: true },
        _count: { id: true },
      }),
      // By validation status
      prisma.transaction.groupBy({
        by: ['isValidated'],
        where: analyticsWhere,
        _count: { id: true },
      }),
      // Top users by transaction count
      prisma.transaction.groupBy({
        by: ['userId'],
        where: analyticsWhere,
        _count: { id: true },
        _sum: { amount: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      // Daily trends - build date range
      (async () => {
        const trendWhere: any = { ...analyticsWhere };
        const daysAgo = new Date(now);
        daysAgo.setDate(now.getDate() - 30);
        if (!trendWhere.receivedAt) {
          trendWhere.receivedAt = {};
        }
        if (!trendWhere.receivedAt.gte) {
          trendWhere.receivedAt.gte = daysAgo;
        }

        // Get all transactions in range and group by date in memory
        const trendTxns = await prisma.transaction.findMany({
          where: trendWhere,
          select: {
            receivedAt: true,
            amount: true,
          },
          orderBy: { receivedAt: 'asc' },
        });

        // Group by date
        const dailyMap = new Map<string, { count: number; totalAmount: number }>();
        trendTxns.forEach(txn => {
          const date = new Date(txn.receivedAt).toISOString().split('T')[0];
          const existing = dailyMap.get(date) || { count: 0, totalAmount: 0 };
          dailyMap.set(date, {
            count: existing.count + 1,
            totalAmount: existing.totalAmount + txn.amount,
          });
        });

        return Array.from(dailyMap.entries()).map(([date, data]) => ({
          date,
          count: data.count,
          totalAmount: data.totalAmount,
        })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
      })(),
    );
  }

  const results = await Promise.all(promises);
  const transactions = results[0];
  const total = results[1];

  const response: any = {
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
  };

  if (includeAnalytics) {
    const totalStats = results[2];
    const todayStats = results[3];
    const weekStats = results[4];
    const monthStats = results[5];
    const byBank = results[6];
    const bySource = results[7];
    const byValidation = results[8];
    const topUsers = results[9];
    const dailyTrends = results[10];

    // Get user details for top users
    const userIds = topUsers.map((u: any) => u.userId).filter(Boolean);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, email: true, phone: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    response.data.analytics = {
      overview: {
        total: totalStats._count.id,
        totalAmount: totalStats._sum.amount || 0,
        averageAmount: totalStats._avg.amount || 0,
        today: {
          count: todayStats._count.id,
          amount: todayStats._sum.amount || 0,
        },
        thisWeek: {
          count: weekStats._count.id,
          amount: weekStats._sum.amount || 0,
        },
        thisMonth: {
          count: monthStats._count.id,
          amount: monthStats._sum.amount || 0,
        },
      },
      distribution: {
        byBank: byBank.map((b: any) => ({
          bank: b.bank || 'Unknown',
          count: b._count.id,
          totalAmount: b._sum.amount || 0,
        })),
        bySource: bySource.map((s: any) => ({
          source: s.source,
          count: s._count.id,
          totalAmount: s._sum.amount || 0,
        })),
        byValidation: {
          validated: byValidation.find((v: any) => v.isValidated)?._count.id || 0,
          unvalidated: byValidation.find((v: any) => !v.isValidated)?._count.id || 0,
        },
      },
      topUsers: topUsers.map((u: any) => {
        const user = userMap.get(u.userId);
        return {
          userId: u.userId,
          username: user?.username || user?.email || user?.phone || 'Unknown',
          transactionCount: u._count.id,
          totalAmount: u._sum.amount || 0,
        };
      }),
      dailyTrends: Array.isArray(dailyTrends) ? dailyTrends.map((d: any) => ({
        date: typeof d.date === 'string' ? d.date : (d.date?.toISOString?.()?.split('T')[0] || ''),
        count: typeof d.count === 'number' ? d.count : parseInt(d.count || '0'),
        totalAmount: typeof d.totalAmount === 'number' ? d.totalAmount : parseFloat(d.total_amount || '0'),
      })) : [],
    };
  }

  res.json(response);
}

/**
 * Get countries (admin only)
 * Only shows countries that have users registered from them
 */
async function getCountries(req: AuthRequest, res: Response) {
  // 1. Get unique country codes ONLY from Users (not patterns)
  const [userCountries, countriesMetadata] = await Promise.all([
    prisma.user.groupBy({
      by: ['country'],
      _count: { _all: true },
      where: { country: { not: null } },
    }),
    prisma.country.findMany(),
  ]);

  // 2. Get template counts per country (isTemplate: true)
  const templateCounts = await prisma.pattern.groupBy({
    by: ['countryCode'],
    _count: { _all: true },
    where: {
      countryCode: { not: null },
      isTemplate: true, // Only count templates
    },
  });

  // 3. Get transaction counts per user country
  const transactionCounts = await prisma.user.findMany({
    where: { country: { not: null } },
    select: {
      country: true,
      _count: {
        select: { transactions: true }
      }
    }
  });

  // Aggregate transaction counts by country
  const txCountsByCountry: Record<string, number> = {};
  transactionCounts.forEach(u => {
    if (u.country) {
      txCountsByCountry[u.country] = (txCountsByCountry[u.country] || 0) + u._count.transactions;
    }
  });

  // 4. Only include countries that have users
  const allCodes = new Set(
    userCountries.map(u => u.country as string)
  );

  // 5. Map names (simple internal mapping for common ones, fallback to code)
  const countryNames: Record<string, string> = {
    'ET': 'Ethiopia',
    'KE': 'Kenya',
    'NG': 'Nigeria',
    'GH': 'Ghana',
    'ZA': 'South Africa',
    'TZ': 'Tanzania',
    'UG': 'Uganda',
    'RW': 'Rwanda',
    'US': 'United States',
    'GB': 'United Kingdom',
  };

  // 6. Build the final list
  const result = Array.from(allCodes).map(code => {
    const metadata = countriesMetadata.find(c => c.code === code);
    const userCountObj = userCountries.find(uc => uc.country === code);
    const templateCountObj = templateCounts.find(pc => pc.countryCode === code);

    return {
      id: metadata?.id || `temp-${code}`,
      code,
      name: metadata?.name || countryNames[code] || code,
      banks: metadata?.banks || [],
      currencies: metadata?.currencies || [],
      commonPhrases: metadata?.commonPhrases || [],
      isActive: metadata ? metadata.isActive : true,
      userCount: userCountObj ? userCountObj._count._all : 0,
      templateCount: templateCountObj ? templateCountObj._count._all : 0, // Templates in this country
      transactionCount: txCountsByCountry[code] || 0,
    };
  });

  // Sort by name
  result.sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    success: true,
    data: result,
  });
}

/**
 * Get templates by country (admin only)
 * Returns all templates (isTemplate: true) for a specific country
 */
async function getCountryTemplates(req: AuthRequest, res: Response) {
  const { countryCode } = req.params;

  if (!countryCode) {
    throw new AppError(400, 'Country code is required');
  }

  // Get user count for this country
  const userCount = await prisma.user.count({
    where: { country: countryCode.toUpperCase() },
  });

  // Get all templates for this country
  const templates = await prisma.pattern.findMany({
    where: {
      countryCode: countryCode.toUpperCase(),
      isTemplate: true, // Only templates
    },
    include: {
      creator: {
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

  res.json({
    success: true,
    data: {
      countryCode: countryCode.toUpperCase(),
      userCount,
      templateCount: templates.length,
      templates,
    },
  });
}

/**
 * Get missing templates - patterns used by multiple users but not in template library
 */
async function getMissingTemplates(req: AuthRequest, res: Response) {
  // Find patterns used by multiple users (at least 2)
  const patternsWithMultipleUsers = await prisma.pattern.groupBy({
    by: ['bank', 'currency'],
    where: {
      bank: { not: null },
      currency: { not: null },
    },
    _count: {
      id: true,
    },
    having: {
      id: {
        _count: {
          gt: 1, // More than 1 user
        },
      },
    },
  });

  // For each group, get the patterns and check if they're in template library
  const missingTemplates = [];

  for (const group of patternsWithMultipleUsers) {
    const patterns = await prisma.pattern.findMany({
      where: {
        bank: group.bank,
        currency: group.currency,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      take: 5, // Get up to 5 examples
    });

    // Check if any pattern is in template library (Pattern with isTemplate=true)
    const hasTemplate = await prisma.pattern.findFirst({
      where: {
        bank: group.bank,
        currency: group.currency,
        isTemplate: true,
      },
    });

    if (!hasTemplate && patterns.length > 0) {
      missingTemplates.push({
        bank: group.bank,
        currency: group.currency,
        userCount: group._count.id,
        patterns: patterns.map(p => ({
          id: p.id,
          name: p.name,
          regex: p.regex,
          extractFields: p.extractFields,
          description: p.description,
          userId: p.userId,
          user: p.creator,
          usageCount: p._count.transactions,
        })),
      });
    }
  }

  res.json({
    success: true,
    data: missingTemplates,
  });
}

/**
 * Get audit logs (admin only)
 */
async function getAuditLogs(req: AuthRequest, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
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
    where.createdAt = { ...where.createdAt, lte: new Date(req.query.toDate as string) };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, email: true, phone: true },
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
async function getSystemHealth(req: AuthRequest, res: Response) {
  const [userCount, businessCount, transactionCount] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.transaction.count(),
  ]);

  res.json({
    success: true,
    data: {
      status: 'healthy',
      users: userCount,
      businesses: businessCount,
      transactions: transactionCount,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
}

router.get('/users', asyncHandler(getUsers));
router.get('/analytics', asyncHandler(getAnalytics));
router.get('/patterns', asyncHandler(getPatterns));
router.get('/patterns/suspicious', asyncHandler(getSuspiciousPatterns));
router.post('/patterns', asyncHandler(createAdminPattern));
router.delete('/patterns/:id', asyncHandler(deletePattern));
router.put('/patterns/:id/block', asyncHandler(blockPattern));
router.put('/patterns/:id', asyncHandler(updatePattern));
router.get('/transactions', asyncHandler(getTransactions));
router.get('/countries', asyncHandler(getCountries));
router.get('/countries/:countryCode/templates', asyncHandler(getCountryTemplates));
router.get('/missing-templates', asyncHandler(getMissingTemplates));
router.get('/audit-logs', asyncHandler(getAuditLogs));
router.get('/system-health', asyncHandler(getSystemHealth));

// Package purchase routes
import { getPackagePurchases, verifyPackagePurchase, rejectPackagePurchase } from '../controllers/adminController';
router.get('/package-purchases', asyncHandler(getPackagePurchases));
router.post('/package-purchases/:id/verify', asyncHandler(verifyPackagePurchase));
router.post('/package-purchases/:id/reject', asyncHandler(rejectPackagePurchase));

export default router;

