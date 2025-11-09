import { Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

/**
 * Analyze patterns to find missing templates
 * Groups similar patterns and flags if used by 3+ users but not in templates
 */
export async function analyzeMissingTemplates() {
  // Get all user patterns grouped by bank and currency
  const patterns = await prisma.pattern.findMany({
    where: {
      isFlagged: false, // Don't re-analyze already flagged
    },
    select: {
      id: true,
      userId: true,
      name: true,
      bank: true,
      currency: true,
      regex: true,
      description: true,
    },
  });

  // Group patterns by bank + currency combination
  const patternGroups = new Map<string, {
    patterns: typeof patterns;
    bank: string | null;
    currency: string | null;
  }>();

  for (const pattern of patterns) {
    const key = `${pattern.bank || 'unknown'}_${pattern.currency || 'unknown'}`;
    if (!patternGroups.has(key)) {
      patternGroups.set(key, {
        patterns: [],
        bank: pattern.bank,
        currency: pattern.currency,
      });
    }
    patternGroups.get(key)!.patterns.push(pattern);
  }

  // Find groups with 3+ users
  const missingTemplates: Array<{
    bank: string | null;
    currency: string | null;
    userCount: number;
    patternIds: string[];
    samplePattern: typeof patterns[0];
  }> = [];

  for (const [key, group] of patternGroups.entries()) {
    if (group.patterns.length >= 3) {
      // Check if similar template exists in CountryPattern
      const existingTemplate = await prisma.countryPattern.findFirst({
        where: {
          isTemplate: true,
          bank: group.bank,
          currency: group.currency,
        },
      });

      // If no template exists, flag this group
      if (!existingTemplate) {
        // Get unique user count
        const uniqueUsers = new Set(group.patterns.map(p => p.userId));
        
        missingTemplates.push({
          bank: group.bank,
          currency: group.currency,
          userCount: uniqueUsers.size,
          patternIds: group.patterns.map(p => p.id),
          samplePattern: group.patterns[0],
        });
      }
    }
  }

  // Flag patterns for admin review
  for (const missing of missingTemplates) {
    // Flag the first pattern as representative
    await prisma.pattern.update({
      where: { id: missing.samplePattern.id },
      data: {
        isFlagged: true,
        flaggedAt: new Date(),
        usageCount: missing.userCount,
      },
    });
  }

  return missingTemplates;
}

/**
 * Get missing templates (flagged patterns)
 */
export async function getMissingTemplates(req: AuthRequest, res: Response) {
  // Get all flagged patterns
  const flaggedPatterns = await prisma.pattern.findMany({
    where: {
      isFlagged: true,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          country: true,
        },
      },
    },
    orderBy: {
      usageCount: 'desc',
    },
  });

  // Group by bank + currency for display
  const grouped = new Map<string, typeof flaggedPatterns>();
  
  for (const pattern of flaggedPatterns) {
    const key = `${pattern.bank || 'unknown'}_${pattern.currency || 'unknown'}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(pattern);
  }

  const result = Array.from(grouped.entries()).map(([key, patterns]) => {
    const [bank, currency] = key.split('_');
    return {
      bank: bank === 'unknown' ? null : bank,
      currency: currency === 'unknown' ? null : currency,
      userCount: patterns[0].usageCount,
      patterns: patterns.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        regex: p.regex,
        userId: p.userId,
        user: p.user,
        flaggedAt: p.flaggedAt,
      })),
    };
  });

  res.json({
    success: true,
    data: result,
  });
}

/**
 * Add missing template to template library (Admin)
 */
const addMissingTemplateSchema = z.object({
  countryCode: z.string().length(2),
  name: z.string().min(3).max(100),
  description: z.string().min(5).max(500),
  requiredPlan: z.enum(['FREE', 'PREMIUM']).default('FREE'),
});

export async function addMissingTemplate(req: AuthRequest, res: Response) {
  const { patternId } = req.params;
  const { countryCode, name, description, requiredPlan } = addMissingTemplateSchema.parse(req.body);

  // Get the flagged pattern
  const pattern = await prisma.pattern.findUnique({
    where: { id: patternId },
  });

  if (!pattern) {
    throw new AppError(404, 'Pattern not found');
  }

  if (!pattern.isFlagged) {
    throw new AppError(400, 'Pattern is not flagged as missing template');
  }

  // Get country
  const country = await prisma.country.findUnique({
    where: { code: countryCode.toUpperCase() },
  });

  if (!country) {
    throw new AppError(404, 'Country not found');
  }

  // Create template from pattern
  const template = await prisma.countryPattern.create({
    data: {
      countryId: country.id,
      name,
      description,
      regex: pattern.regex,
      extractFields: pattern.extractFields as any, // Type assertion for Json field
      bank: pattern.bank,
      currency: pattern.currency,
      requiredPlan: requiredPlan || 'FREE',
      isTemplate: true,
      isApproved: true,
      contributedBy: pattern.userId,
    },
  });

  // Unflag the pattern and related similar patterns
  await prisma.pattern.updateMany({
    where: {
      bank: pattern.bank,
      currency: pattern.currency,
      isFlagged: true,
    },
    data: {
      isFlagged: false,
      adminNotes: `Added to templates as: ${name}`,
    },
  });

  res.status(201).json({
    success: true,
    data: template,
    message: 'Template added to library',
  });
}

/**
 * Dismiss missing template flag (Admin)
 */
export async function dismissMissingTemplate(req: AuthRequest, res: Response) {
  const { patternId } = req.params;
  const { reason } = req.body;

  const pattern = await prisma.pattern.findUnique({
    where: { id: patternId },
  });

  if (!pattern) {
    throw new AppError(404, 'Pattern not found');
  }

  // Unflag the pattern
  await prisma.pattern.update({
    where: { id: patternId },
    data: {
      isFlagged: false,
      adminNotes: reason || 'Dismissed by admin',
    },
  });

  res.json({
    success: true,
    message: 'Pattern flag dismissed',
  });
}

