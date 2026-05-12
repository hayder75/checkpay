import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from './auth';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Async handler wrapper - catches errors from async route handlers
 */
export function asyncHandler(
  fn: (req: AuthRequest, res: Response, next?: NextFunction) => Promise<any>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
  };
}

export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      errorType: 'VALIDATION',
      errorCode: 'VALIDATION_ERROR',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Custom application errors
  if (err instanceof AppError && err.isOperational) {
    // Determine error type based on error name or message
    let errorType: 'TOKEN_EXHAUSTED' | 'PACKAGE_EXPIRED' | 'NO_PACKAGE' | 'AUTH' | 'VALIDATION' | 'SERVER' = 'SERVER';
    let errorCode = 'ERROR';

    // Check error name first (for custom error classes)
    if (err.name === 'TokenExhaustedError') {
      errorType = 'TOKEN_EXHAUSTED';
      errorCode = 'TOKENS_EXHAUSTED';
    } else if (err.name === 'PackageExpiredError') {
      errorType = 'PACKAGE_EXPIRED';
      errorCode = 'PACKAGE_EXPIRED';
    } else if (err.name === 'NoPackageError') {
      errorType = 'NO_PACKAGE';
      errorCode = 'NO_PACKAGE';
    } else if (err.statusCode === 401) {
      errorType = 'AUTH';
      errorCode = 'AUTHENTICATION_REQUIRED';
    } else if (err.statusCode === 400) {
      errorType = 'VALIDATION';
      errorCode = 'VALIDATION_ERROR';
    } else {
      // Fallback: check message content for token-related errors
      const msg = err.message.toLowerCase();
      if (msg.includes('token') && (msg.includes('exhausted') || msg.includes('quota'))) {
        errorType = 'TOKEN_EXHAUSTED';
        errorCode = 'TOKENS_EXHAUSTED';
      } else if (msg.includes('package') && msg.includes('expired')) {
        errorType = 'PACKAGE_EXPIRED';
        errorCode = 'PACKAGE_EXPIRED';
      } else if (msg.includes('no active package') || (msg.includes('free') && msg.includes('exhausted'))) {
        errorType = 'NO_PACKAGE';
        errorCode = 'NO_PACKAGE';
      }
    }

    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      errorType,
      errorCode,
    });
  }

  // Unknown errors
  console.error('Error:', err);
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    errorType: 'SERVER',
    errorCode: 'INTERNAL_ERROR',
  });
}

