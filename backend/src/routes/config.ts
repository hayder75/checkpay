import { Router } from 'express';
import prisma from '../utils/prisma';
import { authenticateApiKey } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';

const router = Router();

/**
 * Get configuration for mobile app (all patterns + API key)
 */
async function getConfig(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const patterns = await prisma.pattern.findMany({
    where: {
      userId: req.user.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      regex: true,
      extractFields: true,
      bank: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    success: true,
    data: {
      apiKey: req.user.apiKey,
      patterns: patterns.map(p => ({
        ...p,
        extraction: p.extractFields, // Add alias for mobile app compatibility
      })),
    },
  });
}

router.get('/', authenticateApiKey as any, getConfig as any);

export default router;

