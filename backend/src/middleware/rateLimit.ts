import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { AuthRequest } from './auth';
import prisma from '../utils/prisma';
import { getUsageStats } from '../utils/usageTracker';

/**
 * Custom rate limiter that checks business package limits
 */
export async function customRateLimiter(req: AuthRequest, res: Response, next: any) {
  if (!req.user && !req.business) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  // Get business context if available
  const businessId = (req as any).businessContext?.id || req.business?.id;
  
  let maxRequests = 100; // Default free limit
  
  if (businessId) {
    // Get business package limits
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { package: true },
    });
    
    if (business?.package) {
      maxRequests = business.package.transactionLimit || 1000000;
    }
  } else if (req.user) {
    // Check user role - admins have unlimited
    if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
      maxRequests = 1000000; // Unlimited for admins
    } else {
      const freeMax = parseInt(process.env.RATE_LIMIT_FREE_MAX || '100');
      maxRequests = freeMax;
    }
  }

  // Get usage stats
  const userId = req.user?.id;
  if (!userId) {
    return next();
  }

  const usageStats = await getUsageStats(userId);
  const totalMonthlyRequests = usageStats.appRequestsMonth + usageStats.devRequestsMonth;
  
  if (totalMonthlyRequests >= maxRequests) {
    return res.status(429).json({
      success: false,
      error: `Rate limit exceeded. ${maxRequests} requests per month.`,
      limit: maxRequests,
      remaining: 0,
      usage: {
        app: {
          today: usageStats.appRequestsToday,
          month: usageStats.appRequestsMonth,
        },
        dev: {
          today: usageStats.devRequestsToday,
          month: usageStats.devRequestsMonth,
        },
        total: totalMonthlyRequests,
      },
    });
  }

  // Add rate limit info to response headers
  const remaining = maxRequests - totalMonthlyRequests;
  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Usage-App', usageStats.appRequestsMonth.toString());
  res.setHeader('X-RateLimit-Usage-Dev', usageStats.devRequestsMonth.toString());

  next();
}

/**
 * Standard rate limiter for general endpoints
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // 2000 requests per window (increased for production dashboard usage)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});


/**
 * Stricter rate limiter for signed cluster verification endpoint.
 * Keyed per API key (or IP fallback) so each integrating system is isolated.
 */
export const clusterVerifyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.CLUSTER_VERIFY_RATE_MAX || '120', 10),
  keyGenerator: (req: Request) => {
    const apiKey = (req.headers['x-api-key'] as string | undefined)?.trim();
    return apiKey || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: 'Too many cluster verification requests. Please retry shortly.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
