/**
 * Business Validator
 * Validates business ownership and access
 */

import prisma from './prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Check if user owns the business
 */
export async function validateBusinessOwnership(
  userId: string,
  businessId: string
): Promise<boolean> {
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      ownerId: userId,
    },
  });
  
  return !!business;
}

/**
 * Check if user has access to business (owner or employee)
 */
export async function validateBusinessAccess(
  userId: string,
  businessId: string
): Promise<boolean> {
  // Check if owner
  const isOwner = await validateBusinessOwnership(userId, businessId);
  if (isOwner) return true;
  
  // Check if employee
  const employee = await prisma.employee.findFirst({
    where: {
      userId,
      businessId,
      isActive: true,
    },
  });
  
  return !!employee;
}

/**
 * Require business ownership (throws error if not owner)
 */
export async function requireBusinessOwnership(
  userId: string,
  businessId: string
): Promise<void> {
  const isOwner = await validateBusinessOwnership(userId, businessId);
  if (!isOwner) {
    throw new AppError(403, 'You do not own this business');
  }
}

/**
 * Require business access (owner or employee)
 */
export async function requireBusinessAccess(
  userId: string,
  businessId: string
): Promise<void> {
  const hasAccess = await validateBusinessAccess(userId, businessId);
  if (!hasAccess) {
    throw new AppError(403, 'You do not have access to this business');
  }
}

/**
 * Get business context for user
 */
export async function getBusinessContext(userId: string, businessId?: string) {
  if (businessId) {
    // Validate access
    await requireBusinessAccess(userId, businessId);
    
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        package: true,
        institutions: {
          where: { isPrimary: true },
        },
      },
    });
    
    return business;
  }
  
  // Get user's businesses
  const businesses = await prisma.business.findMany({
    where: {
      ownerId: userId,
      isActive: true,
    },
    include: {
      package: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  
  return businesses;
}

