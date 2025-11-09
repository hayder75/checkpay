import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    apiKey: string;
    devApiKey: string;
    plan: 'FREE' | 'PREMIUM';
  };
  apiKeyType?: 'app' | 'dev'; // Track which API key was used
}

/**
 * Authenticate user via JWT token
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError(401, 'Authentication required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        apiKey: true,
        devApiKey: true,
        plan: true,
      },
    });

    if (!user) {
      throw new AppError(401, 'User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError(401, 'Invalid token'));
    }
    next(error);
  }
}

/**
 * Authenticate user via API key (for mobile app and verification endpoint)
 * Detects which API key was used (app or dev)
 */
export async function authenticateApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const apiKey = req.headers['x-api-key'] as string || req.query.key as string;

    if (!apiKey) {
      throw new AppError(401, 'API key required');
    }

    // Try app API key first
    let user = await prisma.user.findUnique({
      where: { apiKey },
      select: {
        id: true,
        email: true,
        phone: true,
        apiKey: true,
        devApiKey: true,
        plan: true,
      },
    });

    let apiKeyType: 'app' | 'dev' = 'app';

    // If not found, try dev API key
    if (!user) {
      user = await prisma.user.findUnique({
        where: { devApiKey: apiKey },
        select: {
          id: true,
          email: true,
          phone: true,
          apiKey: true,
          devApiKey: true,
          plan: true,
        },
      });
      apiKeyType = 'dev';
    }

    if (!user) {
      throw new AppError(401, 'Invalid API key');
    }

    req.user = user;
    req.apiKeyType = apiKeyType;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require admin role
 */
export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      throw new AppError(403, 'Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
}

