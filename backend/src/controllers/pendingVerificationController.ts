import prisma from '../utils/prisma';

const MIN_AMOUNT_TOLERANCE = 1;
const PERCENT_AMOUNT_TOLERANCE = 0.003;
const MAX_AMOUNT_TOLERANCE = 15;
const VERIFY_RETRY_DELAYS_MS = [0, 10_000, 25_000, 60_000, 120_000, 300_000, 720_000, 1_500_000];

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getAmountTolerance(amount: number): number {
  const dynamicTolerance = Math.max(MIN_AMOUNT_TOLERANCE, amount * PERCENT_AMOUNT_TOLERANCE);
  return Math.min(dynamicTolerance, MAX_AMOUNT_TOLERANCE);
}

function isAmountWithinTolerance(expectedAmount: number, providedAmount: number): boolean {
  return Math.abs(expectedAmount - providedAmount) <= getAmountTolerance(expectedAmount);
}

function jitterMs(baseMs: number): number {
  const min = Math.floor(baseMs * 0.8);
  const max = Math.ceil(baseMs * 1.2);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Process pending verifications - checks for matching transactions
 * This should be called periodically by a background job
 */
export async function processPendingVerifications() {
  const now = new Date();

  // Pull a bounded batch and use metadata.nextCheckAt to throttle retries per record.
  const pending = await prisma.pendingVerification.findMany({
    where: {
      status: 'PENDING',
      expiresAt: {
        gt: now,
      },
    },
    include: {
      user: true,
      business: true,
      project: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 300,
  });

  let processed = 0;
  let verified = 0;

  for (const verification of pending) {
    try {
      const metadata = (verification.metadata || {}) as Record<string, any>;
      const nextCheckAtRaw = metadata.nextCheckAt;
      if (typeof nextCheckAtRaw === 'string') {
        const nextCheckAtMs = Date.parse(nextCheckAtRaw);
        if (Number.isFinite(nextCheckAtMs) && nextCheckAtMs > Date.now()) {
          continue;
        }
      }

      const where: any = {
        OR: [
          { txnId: verification.txnId },
          { referenceTxnId: verification.txnId },
        ],
      };

      if (verification.projectId) {
        where.projectId = verification.projectId;
      } else if (verification.businessId) {
        where.businessId = verification.businessId;
      } else {
        where.userId = verification.userId;
      }

      const transaction = await prisma.transaction.findFirst({
        where,
        include: {
          pattern: {
            select: {
              name: true,
              bank: true,
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
        },
      });

      const requestedAmount = toNumberOrNull(metadata.requestedAmount);
      const amountMatches = transaction
        ? (requestedAmount === null || isAmountWithinTolerance(requestedAmount, transaction.amount))
        : false;

      if (transaction && amountMatches) {
        await prisma.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { verifiedAt: new Date(), isValidated: true },
          });

          await tx.pendingVerification.update({
            where: { id: verification.id },
            data: {
              status: 'VERIFIED',
              verifiedAt: new Date(),
              metadata: {
                ...metadata,
                lastCheckedAt: new Date().toISOString(),
                matchedAmount: transaction.amount,
              },
            },
          });
        });

        if (verification.webhookUrl) {
          const { queueVerificationWebhook } = await import('../utils/webhook');
          queueVerificationWebhook(verification.webhookUrl, transaction);
        }

        verified++;
      } else {
        const nextRetryCount = verification.retryCount + 1;

        if (nextRetryCount >= verification.maxRetries) {
          await prisma.pendingVerification.update({
            where: { id: verification.id },
            data: {
              status: 'FAILED',
              retryCount: nextRetryCount,
              metadata: {
                ...metadata,
                lastCheckedAt: new Date().toISOString(),
                failureReason: transaction ? 'amount_mismatch' : 'transaction_not_found',
                lastSeenAmount: transaction?.amount ?? null,
              },
            },
          });
        } else {
          const delay = jitterMs(VERIFY_RETRY_DELAYS_MS[Math.min(nextRetryCount, VERIFY_RETRY_DELAYS_MS.length - 1)]);
          const nextCheckAt = new Date(Date.now() + delay).toISOString();

          await prisma.pendingVerification.update({
            where: { id: verification.id },
            data: {
              retryCount: nextRetryCount,
              metadata: {
                ...metadata,
                lastCheckedAt: new Date().toISOString(),
                nextCheckAt,
                lastSeenAmount: transaction?.amount ?? null,
              },
            },
          });
        }
      }

      processed++;
    } catch (error: any) {
      console.error(`[PendingVerification] Error processing ${verification.id}:`, error);

      if (verification.retryCount >= verification.maxRetries - 1) {
        await prisma.pendingVerification.update({
          where: { id: verification.id },
          data: {
            status: 'FAILED',
          },
        });
      }
    }
  }

  const expiredResult = await prisma.pendingVerification.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: {
        lte: now,
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  if (expiredResult.count > 0) {
    console.log(`[PendingVerification] Expired ${expiredResult.count} verifications`);
  }

  return { processed, verified };
}

/**
 * Get pending verifications for the authenticated user
 */
export async function getPendingVerifications(userId: string, businessId?: string, projectId?: string) {
  const where: any = {
    userId,
    status: {
      in: ['PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'],
    },
  };

  if (projectId) {
    where.projectId = projectId;
  } else if (businessId) {
    where.businessId = businessId;
  }

  const verifications = await prisma.pendingVerification.findMany({
    where,
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return verifications;
}
