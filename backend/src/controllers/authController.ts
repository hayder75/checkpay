import { Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { generateApiKey } from '../utils/generateApiKey';
import { generateOTP } from '../utils/generateOTP';
import { maskPhone } from '../utils/maskPhone';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
}).refine((data: { email?: string; phone?: string }) => data.email || data.phone, {
  message: 'Either email or phone is required',
});

const verifyOTPSchema = z.object({
  phone: z.string().min(10),
  code: z.string().length(6),
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
}).refine((data: { email?: string; phone?: string }) => data.email || data.phone, {
  message: 'Either email or phone is required',
});

/**
 * Helper function to send OTP
 */
async function sendOTP(phone: string): Promise<string> {
  const otpCode = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.oTP.create({
    data: {
      phone,
      code: otpCode,
      expiresAt,
    },
  });

  // Log OTP prominently (backend console)
  console.log(`\n🔐 ==========================================`);
  console.log(`📱 OTP for ${phone}: ${otpCode}`);
  console.log(`⏰ Expires in 10 minutes`);
  console.log(`🔐 ==========================================\n`);

  return otpCode;
}

/**
 * Register a new user
 */
export async function register(req: AuthRequest, res: Response) {
  const data = registerSchema.parse(req.body);

  let user;
  let isNewUser = false;

  // Check if user already exists
  if (data.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      // User exists - allow login by sending OTP
      user = existing;
      return res.status(200).json({
        success: true,
        message: 'Account already exists. Please login or verify with OTP.',
        data: {
          exists: true,
          user: {
            ...user,
            phone: user.phone ? maskPhone(user.phone) : null,
          },
        },
      });
    }
  }

  if (data.phone) {
    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) {
      // User exists - generate new OTP for login
      user = existing;
      
      // Generate new OTP
      const otpCode = await sendOTP(data.phone);

      return res.status(200).json({
        success: true,
        message: 'Account already exists. OTP sent to your phone for login.',
        data: {
          exists: true,
          user: {
            ...user,
            phone: maskPhone(user.phone!),
          },
          ...(process.env.NODE_ENV === 'development' && { debug: { otp: otpCode } }),
        },
      });
    }
  }

  // New user - create account
  isNewUser = true;

  // Generate both API keys
  let apiKey = generateApiKey();
  let devApiKey = generateApiKey();
  let keyExists = await prisma.user.findUnique({ where: { apiKey } });
  let devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
  while (keyExists) {
    apiKey = generateApiKey();
    keyExists = await prisma.user.findUnique({ where: { apiKey } });
  }
  while (devKeyExists) {
    devApiKey = generateApiKey();
    devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
  }

  // Create user with both API keys
  user = await prisma.user.create({
    data: {
      email: data.email,
      phone: data.phone,
      apiKey,
      devApiKey,
      usageStats: {
        create: {
          appRequestsToday: 0,
          appRequestsMonth: 0,
          devRequestsToday: 0,
          devRequestsMonth: 0,
        },
      },
    },
    select: {
      id: true,
      email: true,
      phone: true,
      apiKey: true,
      plan: true,
      createdAt: true,
    },
  });

  // Generate OTP if phone provided
  let otpCode: string | undefined;
  if (data.phone) {
    otpCode = await sendOTP(data.phone);
  }

  // Generate JWT token (only for email registration without OTP)
  let token = null;
  if (data.email && !data.phone) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new AppError(500, 'JWT_SECRET not configured');
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    token = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn } as SignOptions
    );
  }

  res.status(201).json({
    success: true,
    data: {
      user: {
        ...user,
        phone: user.phone ? maskPhone(user.phone) : null,
      },
      ...(token && { token }),
      ...(data.phone && { message: 'OTP sent to your phone' }),
      ...(process.env.NODE_ENV === 'development' && otpCode && { debug: { otp: otpCode } }),
    },
  });
}

/**
 * Resend OTP
 */
export async function resendOTP(req: AuthRequest, res: Response) {
  const { phone } = z.object({
    phone: z.string().min(10),
  }).parse(req.body);

  // Check if user exists
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    throw new AppError(404, 'User not found. Please register first.');
  }

  // Send new OTP
  const otpCode = await sendOTP(phone);

  res.json({
    success: true,
    message: 'OTP resent successfully',
    ...(process.env.NODE_ENV === 'development' && { debug: { otp: otpCode } }),
  });
}

/**
 * Verify OTP and complete registration/login
 */
export async function verifyOTP(req: AuthRequest, res: Response) {
  const { phone, code } = verifyOTPSchema.parse(req.body);

  // Trim and normalize the code
  const normalizedCode = code.trim();
  
  // Find OTP - get the most recent unused OTP for this phone
  const otp = await prisma.oTP.findFirst({
    where: {
      phone: phone.trim(),
      code: normalizedCode,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!otp) {
    // Debug: Check if there are any OTPs for this phone
    const allOtps = await prisma.oTP.findMany({
      where: { phone: phone.trim() },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    
    console.log(`\n🔍 OTP Verification Debug:`);
    console.log(`Phone: ${phone.trim()}`);
    console.log(`Code entered: "${normalizedCode}" (length: ${normalizedCode.length})`);
    console.log(`Current time: ${new Date().toISOString()}`);
    if (allOtps.length > 0) {
      console.log(`Recent OTPs:`);
      allOtps.forEach((o: any, i: number) => {
        const isExpired = new Date(o.expiresAt) < new Date();
        const matches = o.code === normalizedCode;
        console.log(`  ${i + 1}. Code: "${o.code}" | Used: ${o.used} | Expired: ${isExpired} | Matches: ${matches} | Expires: ${o.expiresAt}`);
      });
    } else {
      console.log(`No OTPs found for this phone number.`);
    }
    console.log(`\n`);
    
    throw new AppError(400, 'Invalid or expired OTP. Please check the code and try again.');
  }
  
  console.log(`✅ OTP verified successfully for ${phone}`);

  // Mark OTP as used
  await prisma.oTP.update({
    where: { id: otp.id },
    data: { used: true },
  });

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      email: true,
      phone: true,
      apiKey: true,
      plan: true,
      createdAt: true,
    },
  });

  if (!user) {
    // Create user if doesn't exist
    let apiKey = generateApiKey();
    let devApiKey = generateApiKey();
    let keyExists = await prisma.user.findUnique({ where: { apiKey } });
    let devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
    while (keyExists) {
      apiKey = generateApiKey();
      keyExists = await prisma.user.findUnique({ where: { apiKey } });
    }
    while (devKeyExists) {
      devApiKey = generateApiKey();
      devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
    }

    user = await prisma.user.create({
      data: {
        phone,
        apiKey,
        devApiKey,
        usageStats: {
          create: {
            appRequestsToday: 0,
            appRequestsMonth: 0,
            devRequestsToday: 0,
            devRequestsMonth: 0,
          },
        },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        apiKey: true,
        plan: true,
        createdAt: true,
      },
    });
  }

  // Generate JWT token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError(500, 'JWT_SECRET not configured');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign(
    { userId: user.id },
    jwtSecret,
    { expiresIn } as SignOptions
  );

  res.json({
    success: true,
    data: {
      user: {
        ...user,
        phone: maskPhone(user.phone!),
      },
      token,
    },
  });
}

/**
 * Google OAuth callback
 */
export async function googleCallback(req: AuthRequest, res: Response) {
  // This will be handled by Passport strategy
  // For now, we'll create a placeholder
  const profile = (req as any).user; // Set by Passport

  if (!profile) {
    throw new AppError(400, 'Google authentication failed');
  }

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { googleId: profile.id },
    select: {
      id: true,
      email: true,
      phone: true,
      apiKey: true,
      plan: true,
      createdAt: true,
    },
  });

  if (!user) {
    // Check if email exists
    if (profile.emails?.[0]?.value) {
      const existing = await prisma.user.findUnique({
        where: { email: profile.emails[0].value },
      });
      if (existing) {
        throw new AppError(400, 'Email already registered with different account');
      }
    }

    // Generate both API keys
    let apiKey = generateApiKey();
    let devApiKey = generateApiKey();
    let keyExists = await prisma.user.findUnique({ where: { apiKey } });
    let devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
    while (keyExists) {
      apiKey = generateApiKey();
      keyExists = await prisma.user.findUnique({ where: { apiKey } });
    }
    while (devKeyExists) {
      devApiKey = generateApiKey();
      devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
    }

    user = await prisma.user.create({
      data: {
        email: profile.emails?.[0]?.value,
        googleId: profile.id,
        apiKey,
        devApiKey,
        usageStats: {
          create: {
            appRequestsToday: 0,
            appRequestsMonth: 0,
            devRequestsToday: 0,
            devRequestsMonth: 0,
          },
        },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        apiKey: true,
        plan: true,
        createdAt: true,
      },
    });
  }

  // Generate JWT token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError(500, 'JWT_SECRET not configured');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign(
    { userId: user.id },
    jwtSecret,
    { expiresIn } as SignOptions
  );

  // Redirect to dashboard with token (or return JSON for API)
  res.json({
    success: true,
    data: {
      user,
      token,
    },
  });
}

/**
 * Get current user info
 */
export async function getMe(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      phone: true,
      apiKey: true,
      devApiKey: true,
      plan: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      ...user,
      phone: user?.phone ? maskPhone(user.phone) : null,
    },
  });
}

/**
 * Regenerate API key
 */
export async function regenerateApiKey(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  let apiKey = generateApiKey();
  let keyExists = await prisma.user.findUnique({ where: { apiKey } });
  while (keyExists) {
    apiKey = generateApiKey();
    keyExists = await prisma.user.findUnique({ where: { apiKey } });
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { apiKey },
    select: {
      id: true,
      email: true,
      phone: true,
      apiKey: true,
      plan: true,
    },
  });

  res.json({
    success: true,
    data: {
      ...user,
      phone: user.phone ? maskPhone(user.phone) : null,
    },
  });
}