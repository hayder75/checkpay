import { Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { generatePatternFromSMS, validatePattern } from '../utils/patternAI';
import { extractActualValues } from '../utils/extractFromSMS';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Validation schemas
const createPatternSchema = z.object({
  smsText: z.string().min(10),
  name: z.string().min(3).max(100),
  description: z.string().optional(),
});

const updatePatternSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  regex: z.string().optional(),
  extractFields: z.record(z.any()).optional(),
  bank: z.string().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Create a new pattern from SMS text
 */
export async function createPattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { smsText, name, description } = createPatternSchema.parse(req.body);

  // Get user's country and plan
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { country: true, plan: true },
  });

  // Check pattern limit for FREE users (4 total patterns max)
  if (user?.plan === 'FREE') {
    const patternCount = await prisma.pattern.count({
      where: { userId: req.user.id },
    });

    if (patternCount >= 4) {
      throw new AppError(403, 'You have reached the free plan limit (4 patterns). Upgrade to Premium for unlimited patterns!');
    }
  }

  // Generate pattern using AI (with country code if available)
  const generatedPattern = generatePatternFromSMS(smsText, name, user?.country || null);

  // Validate pattern
  const validation = validatePattern(generatedPattern);
  if (!validation.valid) {
    throw new AppError(400, `Invalid pattern: ${validation.errors.join(', ')}`);
  }

  // Check if pattern name already exists for this user
  const existing = await prisma.pattern.findFirst({
    where: {
      userId: req.user.id,
      name,
    },
  });

  if (existing) {
    throw new AppError(400, 'Pattern name already exists');
  }

  // Create pattern
  const pattern = await prisma.pattern.create({
    data: {
      userId: req.user.id,
      name: generatedPattern.name,
      regex: generatedPattern.regex,
      extractFields: generatedPattern.extractFields,
      bank: generatedPattern.bank,
      currency: generatedPattern.currency,
      description,
    },
  });

  // Trigger missing template analysis in background (non-blocking)
  // This will check if similar patterns exist and flag if missing from templates
  setImmediate(async () => {
    try {
      // Check if similar patterns exist (same bank + currency)
      const similarPatterns = await prisma.pattern.findMany({
        where: {
          bank: generatedPattern.bank,
          currency: generatedPattern.currency,
          ...({ isFlagged: false } as any), // Type assertion for Prisma client
        },
        select: { userId: true },
      });

      // If 3+ unique users have similar pattern, check if template exists
      const uniqueUsers = new Set(similarPatterns.map(p => p.userId));
      if (uniqueUsers.size >= 3) {
        const existingTemplate = await prisma.countryPattern.findFirst({
          where: {
            ...({ isTemplate: true } as any), // Type assertion for Prisma client
            bank: generatedPattern.bank,
            currency: generatedPattern.currency,
          },
        });

        // If no template exists, flag this pattern
        if (!existingTemplate) {
          await prisma.pattern.update({
            where: { id: pattern.id },
            data: {
              isFlagged: true,
              flaggedAt: new Date(),
              usageCount: uniqueUsers.size,
            } as any, // Type assertion for Prisma client
          });
        }
      }
    } catch (error) {
      console.error('Error in pattern analysis:', error);
      // Don't fail the request if analysis fails
    }
  });

  res.status(201).json({
    success: true,
    data: pattern,
  });
}

/**
 * Get all patterns for the user
 */
export async function getPatterns(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const patterns = await prisma.pattern.findMany({
    where: {
      userId: req.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    success: true,
    data: patterns,
  });
}

/**
 * Get a single pattern
 */
export async function getPattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;

  const pattern = await prisma.pattern.findFirst({
    where: {
      id,
      userId: req.user.id,
    },
  });

  if (!pattern) {
    throw new AppError(404, 'Pattern not found');
  }

  res.json({
    success: true,
    data: pattern,
  });
}

/**
 * Update a pattern
 */
export async function updatePattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const data = updatePatternSchema.parse(req.body);

  // Check if pattern exists and belongs to user
  const existing = await prisma.pattern.findFirst({
    where: {
      id,
      userId: req.user.id,
    },
  });

  if (!existing) {
    throw new AppError(404, 'Pattern not found');
  }

  // Update pattern
  const pattern = await prisma.pattern.update({
    where: { id },
    data,
  });

  res.json({
    success: true,
    data: pattern,
  });
}

/**
 * Delete a pattern
 */
export async function deletePattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;

  // Check if pattern exists and belongs to user
  const existing = await prisma.pattern.findFirst({
    where: {
      id,
      userId: req.user.id,
    },
  });

  if (!existing) {
    throw new AppError(404, 'Pattern not found');
  }

  await prisma.pattern.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Pattern deleted successfully',
  });
}

/**
 * Validate a pattern before saving
 */
export async function validatePatternEndpoint(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { smsText, name } = z.object({
    smsText: z.string().min(10),
    name: z.string().min(3).max(100),
  }).parse(req.body);

  // Get user's country for country-specific templates
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { country: true },
  });

  const generatedPattern = generatePatternFromSMS(smsText, name, user?.country || null);
  const validation = validatePattern(generatedPattern);
  
  // Extract actual values to show in preview
  const extractedValues = extractActualValues(smsText);

  res.json({
    success: true,
    data: {
      pattern: generatedPattern,
      validation,
      extractedValues, // Show what will actually be extracted
    },
  });
}

