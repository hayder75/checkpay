import { processPendingVerifications } from '../controllers/pendingVerificationController';

let workerInterval: NodeJS.Timeout | null = null;
const PROCESS_INTERVAL_MS = 30 * 1000; // 30 seconds (throttled per item via metadata.nextCheckAt)

/**
 * Start the background worker to process pending verifications
 */
export function startPendingVerificationWorker() {
  if (workerInterval) {
    console.log('[PendingVerificationWorker] Already running');
    return;
  }

  console.log('[PendingVerificationWorker] Starting background worker (interval: 30 seconds, per-item backoff enabled)');

  // Process immediately on start
  processPendingVerifications().catch(err => {
    console.error('[PendingVerificationWorker] Initial processing error:', err);
  });

  // Then process continuously with per-record backoff
  workerInterval = setInterval(async () => {
    try {
      const result = await processPendingVerifications();
      if (result.processed > 0) {
        console.log(`[PendingVerificationWorker] Processed ${result.processed} verifications, verified ${result.verified}`);
      }
    } catch (error) {
      console.error('[PendingVerificationWorker] Error:', error);
    }
  }, PROCESS_INTERVAL_MS);
}

/**
 * Stop the background worker
 */
export function stopPendingVerificationWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[PendingVerificationWorker] Stopped');
  }
}

