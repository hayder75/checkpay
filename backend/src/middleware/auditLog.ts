import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from './auth';

/**
 * Logs API requests for audit purposes
 */
export async function auditLog(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Don't await - let it run in background
  const logPromise = (async () => {
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: `${req.method} ${req.path}`,
          endpoint: req.path,
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string || undefined,
          metadata: {
            method: req.method,
            query: req.query,
            body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
          },
        },
      });
    } catch (error) {
      // Don't fail the request if audit logging fails
      console.error('Audit log error:', error);
    }
  })();

  // Continue with the request
  next();
}

