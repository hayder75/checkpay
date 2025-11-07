import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { AuthRequest } from './auth';
import prisma from '../utils/prisma';
import { getUsageStats } from '../utils/usageTracker';

/**
 * Custom rate limiter that checks user's plan and usage stats
 * Tracks app requests (ingest) and dev requests (verify) separately
 */
export async function customRateLimiter(req: AuthRequest, res: Response, next: any) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const apiKeyType = req.apiKeyType || 'app'; // Default to app for ingest endpoint
  const freeMax = parseInt(process.env.RATE_LIMIT_FREE_MAX || '100');
  const premiumMax = parseInt(process.env.RATE_LIMIT_PREMIUM_MAX || '1000000');
  const maxRequests = req.user.plan === 'PREMIUM' ? premiumMax : freeMax;

  // Get usage stats
  const usageStats = await getUsageStats(req.user.id);
  
  // Check monthly limit (both app and dev requests count towards total)
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
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

