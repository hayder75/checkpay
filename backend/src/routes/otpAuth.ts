import { Router, Response } from 'express';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { requestOTP, verifyOTP } from '../utils/otpService';
import { generalRateLimiter } from '../middleware/rateLimit';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { maskPhone } from '../utils/maskPhone';

const router = Router();

// JWT expiry - 7 days
const expiresIn = '7d';

function signToken(userId: string) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  return jwt.sign({ userId }, jwtSecret, { expiresIn } as SignOptions);
}

// Validation schemas
const requestOTPSchema = z.object({
  phone: z.string().min(10).optional(),
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
}).refine((data) => data.phone || data.username || data.email, {
  message: 'Either phone, username, or email is required',
});

const verifyOTPSchema = z.object({
  phone: z.string().min(10).optional(),
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  code: z.string().min(4).max(8),
}).refine((data) => data.phone || data.username || data.email, {
  message: 'Either phone, username, or email is required',
});

/**
 * Request OTP for passwordless login
 * POST /auth/otp/request
 */
router.post('/request', generalRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phone, username, email } = requestOTPSchema.parse(req.body);

  // Find user by identifier
  let user = null;
  if (phone) {
    user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, telegramId: true },
    });
  } else if (username) {
    user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, phone: true, telegramId: true },
    });
  } else if (email) {
    user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, phone: true, telegramId: true },
    });
  }

  if (!user) {
    throw new AppError(404, 'User not found. Please register first.');
  }

  if (!user.telegramId) {
    throw new AppError(400, 'Please link your Telegram account first to use OTP login. Go to Settings > Link Telegram.');
  }

  // Request OTP
  const result = await requestOTP({ userId: user.id }, 'LOGIN');

  if (!result.success) {
    throw new AppError(400, result.message);
  }

  res.json({
    success: true,
    message: result.message,
    channel: result.channel,
    expiresAt: result.expiresAt,
  });
}));

/**
 * Verify OTP and login
 * POST /auth/otp/verify
 */
router.post('/verify', generalRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phone, username, email, code } = verifyOTPSchema.parse(req.body);

  // Find user by identifier to get their phone/telegramId
  let user = null;
  if (phone) {
    user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, telegramId: true, username: true, email: true, apiKey: true, plan: true, role: true, country: true, createdAt: true },
    });
  } else if (username) {
    user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, phone: true, telegramId: true, username: true, email: true, apiKey: true, plan: true, role: true, country: true, createdAt: true },
    });
  } else if (email) {
    user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, phone: true, telegramId: true, username: true, email: true, apiKey: true, plan: true, role: true, country: true, createdAt: true },
    });
  }

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Verify OTP
  const result = await verifyOTP(
    { phone: user.phone || undefined, telegramId: user.telegramId || undefined },
    code,
    'LOGIN'
  );

  if (!result.success) {
    throw new AppError(400, result.message);
  }

  // Generate JWT token
  const token = signToken(user.id);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone ? maskPhone(user.phone) : null,
        apiKey: user.apiKey,
        plan: user.plan,
        role: user.role,
        country: user.country,
        createdAt: user.createdAt,
      },
      token,
    },
  });
}));

/**
 * Resend OTP
 * POST /auth/otp/resend
 */
router.post('/resend', generalRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phone, username, email } = requestOTPSchema.parse(req.body);

  // Find user by identifier
  let user = null;
  if (phone) {
    user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, telegramId: true },
    });
  } else if (username) {
    user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, phone: true, telegramId: true },
    });
  } else if (email) {
    user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, phone: true, telegramId: true },
    });
  }

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  if (!user.telegramId) {
    throw new AppError(400, 'Please link your Telegram account first');
  }

  // Request new OTP
  const result = await requestOTP({ userId: user.id }, 'LOGIN');

  if (!result.success) {
    throw new AppError(400, result.message);
  }

  res.json({
    success: true,
    message: result.message,
    channel: result.channel,
    expiresAt: result.expiresAt,
  });
}));

/**
 * Request OTP for password reset
 * POST /auth/otp/reset-password/request
 */
router.post('/reset-password/request', generalRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phone, username, email } = requestOTPSchema.parse(req.body);

  // Find user by identifier
  let user = null;
  if (phone) {
    user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, telegramId: true },
    });
  } else if (username) {
    user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, phone: true, telegramId: true },
    });
  } else if (email) {
    user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, phone: true, telegramId: true },
    });
  }

  if (!user) {
    // Don't reveal if user exists or not for security
    res.json({
      success: true,
      message: 'If an account exists with this identifier, an OTP will be sent to the linked Telegram account.',
    });
    return;
  }

  if (!user.telegramId) {
    // Don't reveal user doesn't have Telegram linked
    res.json({
      success: true,
      message: 'If an account exists with this identifier, an OTP will be sent to the linked Telegram account.',
    });
    return;
  }

  // Request OTP for password reset
  await requestOTP({ userId: user.id }, 'RESET_PASSWORD');

  res.json({
    success: true,
    message: 'If an account exists with this identifier, an OTP will be sent to the linked Telegram account.',
  });
}));

/**
 * Verify OTP and reset password
 * POST /auth/otp/reset-password/verify
 */
router.post('/reset-password/verify', generalRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    phone: z.string().min(10).optional(),
    username: z.string().min(3).optional(),
    email: z.string().email().optional(),
    code: z.string().min(4).max(8),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }).refine((data) => data.phone || data.username || data.email, {
    message: 'Either phone, username, or email is required',
  });

  const { phone, username, email, code, newPassword } = schema.parse(req.body);

  // Find user by identifier
  let user = null;
  if (phone) {
    user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, telegramId: true },
    });
  } else if (username) {
    user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, phone: true, telegramId: true },
    });
  } else if (email) {
    user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, phone: true, telegramId: true },
    });
  }

  if (!user) {
    throw new AppError(400, 'Invalid OTP or user not found');
  }

  // Verify OTP
  const result = await verifyOTP(
    { phone: user.phone || undefined, telegramId: user.telegramId || undefined },
    code,
    'RESET_PASSWORD'
  );

  if (!result.success) {
    throw new AppError(400, result.message);
  }

  // Hash new password
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update user password
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  res.json({
    success: true,
    message: 'Password reset successfully. You can now login with your new password.',
  });
}));

export default router;
