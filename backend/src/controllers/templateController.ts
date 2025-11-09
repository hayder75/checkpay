import { Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { generatePatternFromSMS, validatePattern } from '../utils/patternAI';

// Validation schemas
const createTemplateSchema = z.object({
  smsText: z.string().min(10),
  name: z.string().min(3).max(100),
  description: z.string().min(5).max(500),
  requiredPlan: z.enum(['FREE', 'PREMIUM']).default('FREE'),
});

const updateTemplateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().min(5).max(500).optional(),
  requiredPlan: z.enum(['FREE', 'PREMIUM']).optional(),
  regex: z.string().optional(),
  extractFields: z.record(z.any()).optional(),
  bank: z.string().optional(),
  currency: z.string().optional(),
});

/**
 * Create a template for a country (Admin only)
 */
export async function createTemplate(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { countryCode } = req.params;
  const { smsText, name, description, requiredPlan } = createTemplateSchema.parse(req.body);

  // Get country
  const country = await prisma.country.findUnique({
    where: { code: countryCode.toUpperCase() },
  });

  if (!country) {
    throw new AppError(404, 'Country not found');
  }

  // Generate pattern from SMS
  const generatedPattern = generatePatternFromSMS(smsText, name, countryCode);

  // Validate pattern
  const validation = validatePattern(generatedPattern);
  if (!validation.valid) {
    throw new AppError(400, `Invalid pattern: ${validation.errors.join(', ')}`);
  }

  // Check if template name already exists for this country
  const existing = await prisma.countryPattern.findFirst({
    where: {
      countryId: country.id,
      name,
      isTemplate: true,
    },
  });

  if (existing) {
    throw new AppError(400, 'Template name already exists for this country');
  }

  // Create template
  const template = await prisma.countryPattern.create({
    data: {
      countryId: country.id,
      name: generatedPattern.name,
      regex: generatedPattern.regex,
      extractFields: generatedPattern.extractFields,
      bank: generatedPattern.bank,
      currency: generatedPattern.currency,
      description,
      requiredPlan: requiredPlan || 'FREE',
      isTemplate: true,
      smsExample: smsText,
      isApproved: true,
    },
  });

  res.status(201).json({
    success: true,
    data: template,
  });
}

/**
 * Get all templates for a country
 */
export async function getTemplates(req: AuthRequest, res: Response) {
  const { countryCode } = req.params;
  const { plan } = req.query; // Filter by plan if provided

  // Get country
  const country = await prisma.country.findUnique({
    where: { code: countryCode.toUpperCase() },
  });

  if (!country) {
    throw new AppError(404, 'Country not found');
  }

  // Build where clause
  const where: any = {
    countryId: country.id,
    isTemplate: true,
    isApproved: true,
  };

  // Filter by plan if provided
  if (plan && (plan === 'FREE' || plan === 'PREMIUM')) {
    where.requiredPlan = plan;
  }

  const templates = await prisma.countryPattern.findMany({
    where,
    orderBy: {
      usageCount: 'desc',
    },
    include: {
      _count: {
        select: {
          subscriptions: true, // Count how many users have added this
        },
      },
    },
  });

  res.json({
    success: true,
    data: templates.map(t => ({
      ...t,
      userCount: t._count.subscriptions,
    })),
  });
}

/**
 * Get templates available for user (filtered by their country and plan)
 */
export async function getAvailableTemplates(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  // Get user's country and plan
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { country: true, plan: true },
  });

  if (!user?.country) {
    return res.json({
      success: true,
      data: [],
      message: 'Please set your country in settings to see templates',
    });
  }

  // Get country
  const country = await prisma.country.findUnique({
    where: { code: user.country },
  });

  if (!country) {
    return res.json({
      success: true,
      data: [],
    });
  }

  // Build where clause - show templates user can access
  const where: any = {
    countryId: country.id,
    isTemplate: true,
    isApproved: true,
  };

  // If FREE user, only show FREE templates
  if (user.plan === 'FREE') {
    where.requiredPlan = 'FREE';
  }
  // PREMIUM users see all templates

  // Get templates user has already added
  const userSubscriptions = await prisma.userPatternSubscription.findMany({
    where: { userId: req.user.id },
    select: { countryPatternId: true },
  });
  const addedTemplateIds = userSubscriptions.map(s => s.countryPatternId);

  // Get all available templates
  const templates = await prisma.countryPattern.findMany({
    where,
    orderBy: {
      usageCount: 'desc',
    },
    include: {
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  });

  // Check user's current pattern count
  const userPatternCount = await prisma.pattern.count({
    where: { userId: req.user.id },
  });

  const canAddMore = user.plan === 'PREMIUM' || userPatternCount < 4;

  res.json({
    success: true,
    data: templates.map(t => ({
      ...t,
      userCount: t._count.subscriptions,
      isAdded: addedTemplateIds.includes(t.id),
      canAdd: canAddMore && (user.plan === 'PREMIUM' || t.requiredPlan === 'FREE'),
    })),
    limits: {
      current: userPatternCount,
      max: user.plan === 'PREMIUM' ? null : 4,
      canAddMore,
    },
  });
}

/**
 * Add a template to user's patterns
 */
export async function addTemplate(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { templateId } = req.params;

  // Get user's plan and pattern count
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { plan: true, country: true },
  });

  if (!user) {
    throw new AppError(401, 'User not found');
  }

  // Check pattern limit for FREE users (4 total patterns max)
  if (user.plan === 'FREE') {
    const patternCount = await prisma.pattern.count({
      where: { userId: req.user.id },
    });

    if (patternCount >= 4) {
      throw new AppError(403, 'You have reached the free plan limit (4 patterns). Upgrade to Premium for unlimited patterns!');
    }
  }

  // Get template
  const template = await prisma.countryPattern.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new AppError(404, 'Template not found');
  }

  if (!template.isTemplate) {
    throw new AppError(400, 'This is not a template');
  }

  // Check if user already added this template
  const existingSubscription = await prisma.userPatternSubscription.findUnique({
    where: {
      userId_countryPatternId: {
        userId: req.user.id,
        countryPatternId: templateId,
      },
    },
  });

  if (existingSubscription) {
    throw new AppError(400, 'You have already added this template');
  }

  // Check plan requirement
  if (template.requiredPlan === 'PREMIUM' && user.plan === 'FREE') {
    throw new AppError(403, 'This template requires Premium plan. Upgrade to Premium to add it!');
  }

  // Create user's pattern from template
  const userPattern = await prisma.pattern.create({
    data: {
      userId: req.user.id,
      name: template.name,
      regex: template.regex,
      extractFields: template.extractFields as any, // Type assertion for Json field
      bank: template.bank,
      currency: template.currency,
      description: template.description || `Template: ${template.name}`,
    },
  });

  // Create subscription record
  const subscription = await prisma.userPatternSubscription.create({
    data: {
      userId: req.user.id,
      countryPatternId: templateId,
      patternId: userPattern.id,
    },
  });

  // Update template usage count
  await prisma.countryPattern.update({
    where: { id: templateId },
    data: {
      usageCount: {
        increment: 1,
      },
    },
  });

  res.status(201).json({
    success: true,
    data: {
      pattern: userPattern,
      subscription,
    },
  });
}

/**
 * Remove a template from user's patterns
 */
export async function removeTemplate(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { templateId } = req.params;

  // Find subscription
  const subscription = await prisma.userPatternSubscription.findUnique({
    where: {
      userId_countryPatternId: {
        userId: req.user.id,
        countryPatternId: templateId,
      },
    },
    include: {
      pattern: true,
    },
  });

  if (!subscription) {
    throw new AppError(404, 'Template not found in your patterns');
  }

  // Delete user's pattern created from template
  if (subscription.patternId) {
    await prisma.pattern.delete({
      where: { id: subscription.patternId },
    });
  }

  // Delete subscription
  await prisma.userPatternSubscription.delete({
    where: { id: subscription.id },
  });

  res.json({
    success: true,
    message: 'Template removed from your patterns',
  });
}

/**
 * Update a template (Admin only)
 */
export async function updateTemplate(req: AuthRequest, res: Response) {
  const { templateId } = req.params;
  const data = updateTemplateSchema.parse(req.body);

  const template = await prisma.countryPattern.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new AppError(404, 'Template not found');
  }

  if (!template.isTemplate) {
    throw new AppError(400, 'This is not a template');
  }

  const updated = await prisma.countryPattern.update({
    where: { id: templateId },
    data,
  });

  res.json({
    success: true,
    data: updated,
  });
}

/**
 * Delete a template (Admin only)
 */
export async function deleteTemplate(req: AuthRequest, res: Response) {
  const { templateId } = req.params;

  const template = await prisma.countryPattern.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new AppError(404, 'Template not found');
  }

  if (!template.isTemplate) {
    throw new AppError(400, 'This is not a template');
  }

  // Delete template (cascades to subscriptions)
  await prisma.countryPattern.delete({
    where: { id: templateId },
  });

  res.json({
    success: true,
    message: 'Template deleted',
  });
}

