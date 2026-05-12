import prisma from './prisma';
import cache from './redis';

/**
 * Track usage for app requests (ingest) or dev requests (verify)
 */
export async function trackUsage(
  userId: string,
  type: 'app' | 'dev',
  userRole?: string // User role to check if admin (unlimited tokens)
): Promise<void> {
  if (!userId) {
    return;
  }
  // Note: Token consumption is now handled directly by controllers 
  // to allow for better error handling and transaction rollbacks.

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get or create usage stats
  let usageStats = await prisma.usageStats.findUnique({
    where: { userId },
  });

  if (!usageStats) {
    usageStats = await prisma.usageStats.create({
      data: {
        userId,
        appRequestsToday: 0,
        appRequestsMonth: 0,
        devRequestsToday: 0,
        devRequestsMonth: 0,
        lastResetDate: todayStart,
      },
    });
  }

  // Reset daily counters if it's a new day
  const lastReset = new Date(usageStats.lastResetDate);
  const shouldResetDaily = lastReset < todayStart;
  const shouldResetMonthly = lastReset < monthStart;

  const updates: any = {};

  if (type === 'app') {
    updates.appRequestsToday = shouldResetDaily ? 1 : usageStats.appRequestsToday + 1;
    updates.appRequestsMonth = shouldResetMonthly ? 1 : usageStats.appRequestsMonth + 1;
  } else {
    updates.devRequestsToday = shouldResetDaily ? 1 : usageStats.devRequestsToday + 1;
    updates.devRequestsMonth = shouldResetMonthly ? 1 : usageStats.devRequestsMonth + 1;
  }

  if (shouldResetDaily) {
    updates.lastResetDate = todayStart;
  }

  await prisma.usageStats.update({
    where: { userId },
    data: updates,
  });

  // Invalidate usage cache
  await cache.del(`usage:${userId}`);
  // Also invalidate stats cache
  await cache.delPattern(`stats:${userId}:*`);
}

/**
 * Get usage stats for a user
 */
export async function getUsageStats(userId: string) {
  // Try cache first
  const cacheKey = `usage:${userId}`;
  const cached = await cache.get<any>(cacheKey);
  if (cached) {
    return cached; // Fast path!
  }

  let usageStats = await prisma.usageStats.findUnique({
    where: { userId },
  });

  if (!usageStats) {
    usageStats = await prisma.usageStats.create({
      data: {
        userId,
        appRequestsToday: 0,
        appRequestsMonth: 0,
        devRequestsToday: 0,
        devRequestsMonth: 0,
      },
    });
  }

  // Cache for 2 minutes
  await cache.set(cacheKey, usageStats, 120);

  return usageStats;
}

