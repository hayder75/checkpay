import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AppError } from './errorHandler';
import cache from '../utils/redis';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    apiKey: string;
    plan: 'FREE' | 'PREMIUM';
    role: string;
  };
  apiKeyType?: 'user' | 'business' | 'project';
  business?: {
    id: string;
    apiKey: string;
  };
}

/**
 * Authenticate user via JWT token
 * Validates JWT token and loads user data with caching
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication required. Please provide a valid JWT token in the Authorization header (Bearer <token>).');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      throw new AppError(401, 'Authentication token is missing. Please provide a valid JWT token.');
    }

    // Verify JWT token
    let decoded: { userId: string };
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }
      decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'Token has expired. Please sign in again.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(401, 'Invalid token. Please sign in again.');
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new AppError(401, 'Token not active yet. Please check your system clock.');
      }
      throw new AppError(401, 'Token verification failed. Please sign in again.');
    }

    if (!decoded.userId) {
      throw new AppError(401, 'Invalid token format. Please sign in again.');
    }
    
    // Try cache first (with timeout to prevent hanging)
    const cacheKey = `user:${decoded.userId}`;
    let cachedUser = null;
    try {
      // Add timeout to cache call to prevent hanging
      cachedUser = await Promise.race([
        cache.get<any>(cacheKey),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 100))
      ]);
    } catch (error) {
      // Cache failed, continue to DB
      console.log('[AUTH] Cache check failed, using DB');
    }
    
    if (cachedUser) {
      // Validate cached user structure
      if (cachedUser.id && cachedUser.role) {
        req.user = cachedUser;
        return next(); // Fast path - skip DB query!
      }
    }
    
    // Not in cache or invalid cache - query database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        apiKey: true,
        plan: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError(401, 'User not found. Your account may have been deleted. Please contact support.');
    }

    // Try to cache (non-blocking, don't wait)
    cache.set(cacheKey, user, 1800).catch(() => {
      // Ignore cache errors
    });
    
    req.user = user;
    next();
  } catch (error) {
    // Re-throw AppError as-is
    if (error instanceof AppError) {
      next(error);
      return;
    }
    
    // Handle unexpected errors
    console.error('[AUTH] Unexpected error in authenticate:', error);
    next(new AppError(500, 'Authentication error. Please try again or contact support.'));
  }
}

/**
 * Authenticate via API key (user, business, or project)
 * Supports multiple API key types with caching and validation
 */
export async function authenticateApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Only accept API key from header (query params are logged and exposed in URLs)
    const apiKey = (req.headers['x-api-key'] as string)?.trim();

    if (!apiKey) {
      throw new AppError(401, 'API key required. Please provide your API key in the X-API-Key header.');
    }

    // Validate API key format (basic check)
    if (apiKey.length < 10) {
      throw new AppError(401, 'Invalid API key format. API keys should be at least 10 characters.');
    }

    // Try cache first (with timeout to prevent hanging)
    const cacheKey = `apikey:${apiKey}`;
    let cachedAuth = null;
    try {
      cachedAuth = await Promise.race([
        cache.get<any>(cacheKey),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 100))
      ]);
    } catch (error) {
      // Cache failed, continue to DB lookup
      console.log('[AUTH] Cache check failed for API key, using DB');
    }

    if (cachedAuth) {
      // Validate cached data structure
      if (cachedAuth.user && cachedAuth.apiKeyType) {
        req.user = cachedAuth.user;
        req.apiKeyType = cachedAuth.apiKeyType;
        if (cachedAuth.business) {
          req.business = cachedAuth.business;
        }
        if (cachedAuth.project) {
          (req as any).project = cachedAuth.project;
        }
        return next(); // Fast path - skip DB queries!
      }
    }

    // Not in cache or invalid cache - query database
    // Priority order: Project API key → Business API key → User API keys

    // 1. Try project API key first (projectApiKey for backend integration)
    let project = await prisma.project.findUnique({
      where: { projectApiKey: apiKey },
      select: {
        id: true,
        name: true,
        projectApiKey: true,
        mobileApiKey: true,
        developerId: true,
        businessId: true,
        status: true,
      },
    });

    // Fallback to mobileApiKey for backward compatibility
    if (!project) {
      project = await prisma.project.findUnique({
        where: { mobileApiKey: apiKey },
        select: {
          id: true,
          name: true,
          projectApiKey: true,
          mobileApiKey: true,
          developerId: true,
          businessId: true,
          status: true,
        },
      });
    }

    if (project) {
      // Validate project status - only allow ACTIVE projects for production use
      // SETUP and READY projects are allowed for development/testing
      const allowedStatuses = ['SETUP', 'READY', 'HANDED_OVER', 'ACTIVE'];
      if (!allowedStatuses.includes(project.status)) {
        throw new AppError(403, `Project "${project.name}" is not active. Current status: ${project.status}. Please contact support.`);
      }

      req.apiKeyType = 'project';
      
      // Set project context
      (req as any).project = {
        id: project.id,
        name: project.name,
        projectApiKey: project.projectApiKey,
        mobileApiKey: project.mobileApiKey,
        status: project.status,
      };

      // If project has business, set it
      if (project.businessId) {
        req.business = {
          id: project.businessId,
          apiKey: apiKey,
        };
      }

      // Set developer as user (required for token checks and usage tracking)
      const developer = await prisma.user.findUnique({
        where: { id: project.developerId },
        select: {
          id: true,
          email: true,
          phone: true,
          apiKey: true,
          plan: true,
          role: true,
        },
      });

      if (!developer) {
        throw new AppError(500, `Project "${project.name}" has an invalid developer. Please contact support.`);
      }

      req.user = developer;

      // Cache the result (non-blocking)
      const cacheData = {
        user: developer,
        apiKeyType: 'project' as const,
        project: (req as any).project,
        ...(req.business && { business: req.business }),
      };
      cache.set(cacheKey, cacheData, 1800).catch(() => {
        // Ignore cache errors
      });

      return next();
    }

    // 2. Try business API key
    const business = await prisma.business.findUnique({
      where: { apiKey },
      select: {
        id: true,
        apiKey: true,
        ownerId: true,
        isActive: true,
        name: true,
      },
    });

    if (business) {
      // Validate business is active
      if (!business.isActive) {
        throw new AppError(403, `Business "${business.name || 'Unknown'}" is not active. Please contact support.`);
      }

      req.apiKeyType = 'business';
      req.business = {
        id: business.id,
        apiKey: business.apiKey,
      };

      // Set user for business owner (required for token checks)
      const owner = await prisma.user.findUnique({
        where: { id: business.ownerId },
        select: {
          id: true,
          email: true,
          phone: true,
          apiKey: true,
          plan: true,
          role: true,
        },
      });

      if (!owner) {
        throw new AppError(500, `Business "${business.name || 'Unknown'}" has an invalid owner. Please contact support.`);
      }

      req.user = owner;

      // Cache the result (non-blocking)
      const cacheData = {
        user: owner,
        business: req.business,
        apiKeyType: 'business' as const,
      };
      cache.set(cacheKey, cacheData, 1800).catch(() => {
        // Ignore cache errors
      });

      return next();
    }

    // 3. Try user API key
    const user = await prisma.user.findUnique({
      where: { apiKey },
      select: {
        id: true,
        email: true,
        phone: true,
        apiKey: true,
        plan: true,
        role: true,
      },
    });

    if (!user) {
      // Provide helpful error message
      throw new AppError(401, 'Invalid API key. Please check that your API key is correct and hasn\'t been regenerated.');
    }

    req.user = user;
    req.apiKeyType = 'user';

    // Cache the result (non-blocking)
    const cacheData = {
      user,
      apiKeyType: 'user' as const,
    };
    cache.set(cacheKey, cacheData, 1800).catch(() => {
      // Ignore cache errors
    });

    next();
  } catch (error) {
    // Re-throw AppError as-is
    if (error instanceof AppError) {
      next(error);
      return;
    }
    
    // Handle unexpected errors
    console.error('[AUTH] Unexpected error in authenticateApiKey:', error);
    next(new AppError(500, 'Authentication error. Please try again or contact support.'));
  }
}

/**
 * Require specific role
 */
export function requireRole(...roles: string[]): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        throw new AppError(401, 'Authentication required');
      }

      const user = await prisma.user.findUnique({
        where: { id: authReq.user.id },
        select: { role: true },
      });

      if (!user || !roles.includes(user.role)) {
        throw new AppError(403, `Access denied. Required role: ${roles.join(' or ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require business owner role
 */
export const requireBusinessOwner = requireRole('BUSINESS_OWNER', 'ADMIN', 'SUPER_ADMIN');

/**
 * Require developer role
 */
export const requireDeveloper = requireRole('DEVELOPER', 'ADMIN', 'SUPER_ADMIN');

/**
 * Require employee role
 */
export const requireEmployee = requireRole('EMPLOYEE', 'BUSINESS_OWNER', 'ADMIN', 'SUPER_ADMIN');

/**
 * Require admin role
 */
export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');

/**
 * Set business context from header or query
 */
export async function setBusinessContext(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return next();
    }

    const businessId = req.headers['x-business-id'] as string || req.query.businessId as string;

    if (businessId) {
      const { requireBusinessAccess } = await import('../utils/businessValidator');
      await requireBusinessAccess(req.user.id, businessId);
      
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      });
      
      if (business) {
        (req as any).businessContext = business;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

