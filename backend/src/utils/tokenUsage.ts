import prisma from './prisma';
import { AppError } from '../middleware/errorHandler';
import { createNotification } from './notificationService';
import { NotificationType } from '@prisma/client';

type TokenKind = 'phone' | 'verified';

/**
 * Standardized error for token exhaustion
 */
export class TokenExhaustedError extends AppError {
  constructor(kind: 'phone' | 'verified', remaining: number = 0) {
    const message = kind === 'phone'
      ? 'Package limit reached. You have used all available phone transaction tokens. Please upgrade your package to continue.'
      : 'Package limit reached. You have used all available verification tokens. Please upgrade your package to continue.';

    super(403, message);
    this.name = 'TokenExhaustedError';
    (this as any).errorCode = 'PACKAGE_LIMIT_REACHED';
    (this as any).remaining = remaining;
  }
}

/**
 * Standardized error for expired packages
 */
export class PackageExpiredError extends AppError {
  constructor() {
    super(403, 'Package limit reached. Your package has expired. Please upgrade your package to continue.');
    this.name = 'PackageExpiredError';
    (this as any).errorCode = 'PACKAGE_EXPIRED';
  }
}

/**
 * Standardized error for no active package
 */
export class NoPackageError extends AppError {
  constructor() {
    super(403, 'Package limit reached. No active package found. Please purchase a package to continue.');
    this.name = 'NoPackageError';
    (this as any).errorCode = 'NO_PACKAGE';
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Compute an end date for a package based on billing cycle or explicit duration.
 */
function computeEndDate(
  billingCycle: string | null | undefined,
  durationDays?: number | null
): Date | null {
  if (durationDays && durationDays > 0) {
    return addDays(new Date(), durationDays);
  }

  switch (billingCycle) {
    case 'MONTHLY':
      return addDays(new Date(), 30);
    case 'SIX_MONTH':
      return addDays(new Date(), 180);
    case 'QUARTERLY':
      return addDays(new Date(), 90);
    case 'YEARLY':
      return addDays(new Date(), 365);
    case 'ONE_TIME':
      return durationDays ? addDays(new Date(), durationDays) : null;
    default:
      return null;
  }
}

/**
 * Activate a package for a user, seeding quotas from the package definition.
 * If user has existing active package, remaining tokens will be rolled over.
 */
export async function activateUserPackage(
  userId: string,
  packageId: string,
  notes?: string,
  rolloverTokens: boolean = true
) {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) {
    throw new AppError(404, 'Package not found');
  }

  const endsAt = computeEndDate(pkg.billingCycle || null, pkg.durationDays);

  // Get existing active package to rollover tokens
  let phoneTxnsToAdd = 0;
  let verifiedTxnsToAdd = 0;

  if (rolloverTokens) {
    const existingActive = await getActiveUserPackage(userId);
    if (existingActive) {
      // Rollover remaining tokens from old package
      phoneTxnsToAdd = existingActive.phoneTxnsRemaining || 0;
      verifiedTxnsToAdd = existingActive.verifiedTxnsRemaining || 0;

      // Mark old package as expired/canceled
      await prisma.userPackage.update({
        where: { id: existingActive.id },
        data: { status: 'EXPIRED' },
      });
    }
  }

  // Calculate new token amounts (package tokens + rolled over tokens)
  const newPhoneTxns = (pkg.maxPhoneTxns ?? 0) + phoneTxnsToAdd;
  const newVerifiedTxns = (pkg.maxVerifiedTxns ?? 0) + verifiedTxnsToAdd;

  return prisma.userPackage.create({
    data: {
      userId,
      packageId,
      status: 'ACTIVE',
      startsAt: new Date(),
      endsAt,
      phoneTxnsRemaining: pkg.maxPhoneTxns !== null ? newPhoneTxns : null,
      verifiedTxnsRemaining: pkg.maxVerifiedTxns !== null ? newVerifiedTxns : null,
      notes,
    },
    include: {
      package: true,
    },
  });
}

/**
 * Fetch the most recent active package for a user.
 * Returns null if no package found.
 */
export async function getActiveUserPackage(userId: string) {
  const now = new Date();
  return prisma.userPackage.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      OR: [
        { endsAt: null },
        { endsAt: { gt: now } },
      ],
    },
    orderBy: {
      startsAt: 'desc',
    },
    include: {
      package: true,
    },
  });
}

/**
 * Check if user has tokens available BEFORE processing.
 * This prevents creating transactions when tokens are exhausted.
 * Returns result object instead of throwing to allow graceful handling.
 */
export async function checkTokenAvailability(
  userId: string,
  kind: TokenKind,
  userRole?: string
): Promise<{
  available: boolean;
  remaining: number | null;
  error?: TokenExhaustedError | PackageExpiredError | NoPackageError
}> {
  // Admins have unlimited tokens
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    return { available: true, remaining: null };
  }

  const active = await getActiveUserPackage(userId);
  if (!active) {
    return {
      available: false,
      remaining: 0,
      error: new NoPackageError()
    };
  }

  // Check if package expired
  if (active.endsAt && active.endsAt <= new Date()) {
    await prisma.userPackage.update({
      where: { id: active.id },
      data: { status: 'EXPIRED' },
    });
    return {
      available: false,
      remaining: 0,
      error: new PackageExpiredError()
    };
  }

  const fieldRemaining = kind === 'phone' ? 'phoneTxnsRemaining' : 'verifiedTxnsRemaining';
  const remaining = active[fieldRemaining];

  // Check if tokens are exhausted (null means unlimited)
  if (remaining !== null && remaining !== undefined && remaining <= 0) {
    return {
      available: false,
      remaining: 0,
      error: new TokenExhaustedError(kind, remaining)
    };
  }

  return {
    available: true,
    remaining: remaining
  };
}

/**
 * Combined check and consume tokens in a single transaction to reduce DB roundtrips.
 * This is the optimized version for high-performance ingestion/verification.
 */
export async function checkAndConsumeToken(
  userId: string,
  kind: TokenKind,
  userRole?: string
): Promise<{ remaining: number | null; packageId?: string }> {
  // Admins have unlimited tokens
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    return { remaining: null };
  }

  return prisma.$transaction(async (tx) => {
    // 1. Get active package
    const now = new Date();
    const active = await tx.userPackage.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [
          { endsAt: null },
          { endsAt: { gt: now } },
        ],
      },
      orderBy: { startsAt: 'desc' },
      select: {
        id: true,
        endsAt: true,
        phoneTxnsRemaining: true,
        verifiedTxnsRemaining: true,
        phoneTxnsUsed: true,
        verifiedTxnsUsed: true,
        packageId: true,
      },
    });

    if (!active) {
      throw new NoPackageError();
    }

    // 2. Check expiration (double check in transaction)
    if (active.endsAt && active.endsAt <= now) {
      await tx.userPackage.update({
        where: { id: active.id },
        data: { status: 'EXPIRED' },
      });
      throw new PackageExpiredError();
    }

    const fieldRemaining = kind === 'phone' ? 'phoneTxnsRemaining' : 'verifiedTxnsRemaining';
    const fieldUsed = kind === 'phone' ? 'phoneTxnsUsed' : 'verifiedTxnsUsed';
    const remaining = active[fieldRemaining];

    // 3. Check exhaustion
    if (remaining !== null && remaining !== undefined && remaining <= 0) {
      throw new TokenExhaustedError(kind, remaining);
    }

    // 4. Unlimited tokens (null)
    if (remaining === null) {
      return { remaining: null, packageId: active.packageId };
    }

    // 5. Consume
    const newRemaining = remaining - 1;
    const updated = await tx.userPackage.update({
      where: { id: active.id },
      data: {
        [fieldRemaining]: newRemaining,
        [fieldUsed]: (active[fieldUsed] || 0) + 1,
      },
      select: {
        packageId: true,
        [fieldRemaining]: true,
      },
    });

    return {
      packageId: updated.packageId,
      remaining: updated[fieldRemaining] as number | null,
    };
  }).then(result => {
    // Notification Logic (fire and forget)
    if (result.remaining !== null) {
      const threshold = [0, 1, 5, 10];
      if (threshold.includes(result.remaining)) {
           const type = result.remaining === 0 ? NotificationType.TOKEN_DEPLETED : NotificationType.TOKEN_LOW;
           const title = result.remaining === 0 ? 'Tokens Depleted' : 'Low Token Balance';
           const body = result.remaining === 0 
              ? `Your ${kind} tokens are depleted.`
              : `You have ${result.remaining} ${kind} tokens remaining.`;
           
           createNotification(userId, type, title, body, { kind, remaining: result.remaining })
              .catch(console.error);
      }
    }
    return result;
  });
}

/**
 * Consume a token for a given kind (phone-sent or verified).
 * Admin users have unlimited tokens.
 * Regular users must have tokens available or transaction is blocked.
 * This should be called AFTER checkTokenAvailability to ensure tokens are available.
 */
export async function consumeToken(
  userId: string,
  kind: TokenKind,
  userRole?: string // Pass user role to check if admin
): Promise<{ remaining: number | null; packageId?: string }> {
  // Check if user is admin - admins have unlimited tokens
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    return { remaining: null }; // null means unlimited
  }

  const active = await getActiveUserPackage(userId);
  if (!active) {
    throw new NoPackageError();
  }

  // If package expired, mark and block.
  if (active.endsAt && active.endsAt <= new Date()) {
    await prisma.userPackage.update({
      where: { id: active.id },
      data: { status: 'EXPIRED' },
    });
    throw new PackageExpiredError();
  }

  return prisma.$transaction(async (tx) => {
    const fresh = await tx.userPackage.findUnique({
      where: { id: active.id },
      select: {
        id: true,
        phoneTxnsRemaining: true,
        verifiedTxnsRemaining: true,
        phoneTxnsUsed: true,
        verifiedTxnsUsed: true,
        packageId: true,
      },
    });

    if (!fresh) {
      throw new AppError(404, 'Active package not found');
    }

    const fieldRemaining = kind === 'phone' ? 'phoneTxnsRemaining' : 'verifiedTxnsRemaining';
    const fieldUsed = kind === 'phone' ? 'phoneTxnsUsed' : 'verifiedTxnsUsed';

    const remaining = fresh[fieldRemaining];

    // Check if tokens are exhausted (double-check in transaction)
    if (remaining !== null && remaining !== undefined && remaining <= 0) {
      throw new TokenExhaustedError(kind, remaining);
    }

    // If remaining is null, it means unlimited (shouldn't happen for regular users, but handle it)
    if (remaining === null) {
      return { remaining: null, packageId: fresh.packageId };
    }

    const newRemaining = remaining - 1;

    const updated = await tx.userPackage.update({
      where: { id: active.id },
      data: {
        [fieldRemaining]: newRemaining,
        [fieldUsed]: (fresh[fieldUsed] || 0) + 1,
      },
      select: {
        packageId: true,
        phoneTxnsRemaining: true,
        verifiedTxnsRemaining: true,
      },
    });

    return {
      packageId: updated.packageId,
      remaining: kind === 'phone' ? updated.phoneTxnsRemaining : updated.verifiedTxnsRemaining,
    };
  });
}

/**
 * Admin ability to update remaining quotas.
 */
export async function updateUserPackageQuotas(
  userPackageId: string,
  phoneTxnsRemaining?: number | null,
  verifiedTxnsRemaining?: number | null
) {
  return prisma.userPackage.update({
    where: { id: userPackageId },
    data: {
      phoneTxnsRemaining: phoneTxnsRemaining === undefined ? undefined : phoneTxnsRemaining,
      verifiedTxnsRemaining: verifiedTxnsRemaining === undefined ? undefined : verifiedTxnsRemaining,
    },
    include: {
      user: true,
      package: true,
    },
  });
}

/**
 * Get or create the free trial package.
 * This is a special package that all new users get automatically.
 */
export async function getOrCreateFreePackage() {
  const freePackageDefaults = {
    name: 'Free Trial',
    description: 'Free trial package for new users. Includes 50 phone transactions and 50 verified transactions for 3 months.',
    price: 0,
    billingCycle: 'QUARTERLY' as const,
    durationDays: 90,
    isFreePackage: true,
    tier: 'FREE',
    maxPhoneTxns: 50,
    maxVerifiedTxns: 50,
    isActive: true,
    features: {},
  };

  // Try to find existing free package and normalize it to the current 3-month policy.
  let freePackage = await prisma.package.findFirst({
    where: { isFreePackage: true },
  });

  if (!freePackage) {
    freePackage = await prisma.package.create({
      data: freePackageDefaults,
    });
  } else {
    freePackage = await prisma.package.update({
      where: { id: freePackage.id },
      data: freePackageDefaults,
    });
  }

  return freePackage;
}

/**
 * Assign free package to a new user on registration.
 */
export async function assignFreePackageToUser(userId: string) {
  const freePackage = await getOrCreateFreePackage();
  const startsAt = new Date();
  const endsAt = computeEndDate(freePackage.billingCycle || null, freePackage.durationDays) || addDays(startsAt, 90);

  return prisma.userPackage.create({
    data: {
      userId,
      packageId: freePackage.id,
      status: 'ACTIVE',
      startsAt,
      endsAt,
      phoneTxnsRemaining: freePackage.maxPhoneTxns,
      verifiedTxnsRemaining: freePackage.maxVerifiedTxns,
      notes: 'Auto-assigned 3-month free trial on registration',
    },
    include: {
      package: true,
    },
  });
}

