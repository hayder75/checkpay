import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from './auth';

export async function auditLog(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Log after response is sent
  res.on('finish', async () => {
    try {
      const userId = req.user?.id;
      const action = `${req.method} ${req.path}`;
      const endpoint = req.path;
      const ipAddress = req.ip || req.socket.remoteAddress || undefined;
      
      const metadata: any = {
        method: req.method,
        query: req.query,
      };
      
      if (req.body && Object.keys(req.body).length > 0) {
        // Don't log sensitive data
        const sanitizedBody = { ...req.body };
        if (sanitizedBody.password) delete sanitizedBody.password;
        if (sanitizedBody.code) delete sanitizedBody.code;
        metadata.body = sanitizedBody;
      }
      
      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action,
          endpoint,
          ipAddress,
          metadata,
        },
      });
    } catch (error) {
      // Don't fail request if audit logging fails
      console.error('Audit log error:', error);
    }
  });
  
  next();
}

