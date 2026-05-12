import prisma from './prisma';
import { AppError } from '../middleware/errorHandler';
import { getSystemConfig } from './systemConfigStore';

const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 30;

function isTrialActive(createdAt: Date): boolean {
  const trialEndsAt = new Date(createdAt.getTime() + TRIAL_DAYS * MILLIS_IN_DAY);
  return trialEndsAt.getTime() > Date.now();
}

export interface IngestEntitlementDecision {
  billingMode: 'COUNT_BASED' | 'FIXED_PRICE';
  trialActive: boolean;
  shouldDecrementPhoneQuota: boolean;
  userPackageId?: string;
}

export async function resolveIngestEntitlement(userId: string): Promise<IngestEntitlementDecision> {
  const [config, user] = await Promise.all([
    getSystemConfig(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true },
    }),
  ]);

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const trialActive = isTrialActive(user.createdAt);

  if (trialActive) {
    return {
      billingMode: config.billingMode,
      trialActive,
      shouldDecrementPhoneQuota: false,
    };
  }

  const activePackage = await prisma.userPackage.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    include: {
      package: {
        select: {
          maxPhoneTxns: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!activePackage) {
    throw new AppError(403, 'No active paid package. Your free month has ended, please purchase a package.');
  }

  if (config.billingMode === 'FIXED_PRICE') {
    return {
      billingMode: config.billingMode,
      trialActive,
      shouldDecrementPhoneQuota: false,
      userPackageId: activePackage.id,
    };
  }

  const packageCap = activePackage.package.maxPhoneTxns;
  if (packageCap === null || packageCap === undefined || packageCap < 0) {
    return {
      billingMode: config.billingMode,
      trialActive,
      shouldDecrementPhoneQuota: false,
      userPackageId: activePackage.id,
    };
  }

  const remaining = activePackage.phoneTxnsRemaining ?? (packageCap - activePackage.phoneTxnsUsed);
  if (remaining <= 0) {
    throw new AppError(403, 'Phone transaction quota exhausted for your package. Please renew or upgrade.');
  }

  return {
    billingMode: config.billingMode,
    trialActive,
    shouldDecrementPhoneQuota: true,
    userPackageId: activePackage.id,
  };
}

export async function consumePhoneQuota(userPackageId: string): Promise<void> {
  const current = await prisma.userPackage.findUnique({
    where: { id: userPackageId },
    include: {
      package: {
        select: {
          maxPhoneTxns: true,
        },
      },
    },
  });

  if (!current) {
    return;
  }

  const packageCap = current.package.maxPhoneTxns;
  const nextUsed = current.phoneTxnsUsed + 1;
  const nextRemaining =
    packageCap === null || packageCap === undefined || packageCap < 0
      ? null
      : Math.max(0, (current.phoneTxnsRemaining ?? (packageCap - current.phoneTxnsUsed)) - 1);

  await prisma.userPackage.update({
    where: { id: userPackageId },
    data: {
      phoneTxnsUsed: nextUsed,
      phoneTxnsRemaining: nextRemaining,
    },
  });
}
