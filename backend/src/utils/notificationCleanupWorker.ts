import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let workerInterval: NodeJS.Timeout | null = null;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 30; // Keep notifications for 30 days

/**
 * Clean up old read notifications
 * Deletes read notifications older than RETENTION_DAYS
 */
export async function cleanupOldNotifications(): Promise<{ deleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  try {
    const result = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    if (result.count > 0) {
      console.log(`[NotificationCleanup] Deleted ${result.count} old read notification(s) older than ${RETENTION_DAYS} days`);
    }

    return { deleted: result.count };
  } catch (error) {
    console.error('[NotificationCleanup] Error cleaning up notifications:', error);
    throw error;
  }
}

/**
 * Start the background worker to clean up old notifications
 */
export function startNotificationCleanupWorker() {
  if (workerInterval) {
    console.log('[NotificationCleanup] Already running');
    return;
  }

  console.log(`[NotificationCleanup] Starting background worker (interval: 24 hours, retention: ${RETENTION_DAYS} days)`);

  // Clean up immediately on start
  cleanupOldNotifications().catch(err => {
    console.error('[NotificationCleanup] Initial cleanup error:', err);
  });

  // Then clean up every 24 hours
  workerInterval = setInterval(async () => {
    try {
      const result = await cleanupOldNotifications();
      if (result.deleted > 0) {
        console.log(`[NotificationCleanup] Cleaned up ${result.deleted} old notification(s)`);
      }
    } catch (error) {
      console.error('[NotificationCleanup] Error:', error);
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the background worker
 */
export function stopNotificationCleanupWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[NotificationCleanup] Stopped');
  }
}
