import { Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateApiKey } from '../utils/generateApiKey';
import { generateOTP } from '../utils/generateOTP';
import { maskPhone } from '../utils/maskPhone';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores').optional(),
  phone: z.string().min(10).optional(),
  country: z.string().length(2).optional(), // ISO country code (e.g., "ET", "KE")
}).refine((data: { username?: string; phone?: string }) => data.username || data.phone, {
  message: 'Either username or phone is required',
});

const verifyOTPSchema = z.object({
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  code: z.string().length(6),
  password: z.string().min(6).optional(), // Password for new users (set during registration)
  iccid: z.string().optional(), // SIM card ICCID (from mobile app)
  country: z.string().length(2).optional(), // ISO country code
}).refine((data) => data.phone || data.email, {
  message: 'Either phone or email is required',
});

const loginSchema = z.object({
  username: z.string().min(3).optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(6),
}).refine((data: { username?: string; phone?: string }) => data.username || data.phone, {
  message: 'Either username or phone is required',
});

/**
 * Helper function to send OTP
 */
async function sendOTP(phone?: string, email?: string): Promise<string> {
  const otpCode = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Only create OTP if phone is provided (OTP model requires phone)
  if (!phone) {
    throw new Error('Phone number is required to send OTP');
  }

  await prisma.oTP.create({
    data: {
      phone: phone,
      code: otpCode,
      expiresAt,
    },
  });

  // Send OTP via SMS using AfroMessage (REQUIRED - no fallback console logging)
  try {
    const { sendOTPSMS } = await import('../utils/afroSmsService');
    const smsSent = await sendOTPSMS(phone, otpCode);
    
    if (!smsSent) {
      console.error(`\n❌ ==========================================`);
      console.error(`❌ SMS SENDING FAILED for ${phone}`);
      console.error(`❌ OTP Code: ${otpCode} (NOT SENT VIA SMS)`);
      console.error(`❌ Check AfroMessage API configuration`);
      console.error(`❌ ==========================================\n`);
      throw new Error('Failed to send OTP via SMS. Please check SMS service configuration.');
    }
    
    // Only log success, not the OTP code
    console.log(`\n✅ OTP SMS sent successfully to ${phone}`);
  } catch (error: any) {
    console.error(`\n❌ ==========================================`);
    console.error(`❌ SMS SERVICE ERROR`);
    console.error(`❌ Phone: ${phone}`);
    console.error(`❌ Error: ${error.message}`);
    console.error(`❌ ==========================================\n`);
    throw new Error(`Failed to send OTP: ${error.message}`);
  }

  return otpCode;
}

/**
 * Register a new user
 */
export async function register(req: AuthRequest, res: Response) {
  const data = registerSchema.parse(req.body);

  let user;
  let isNewUser = false;

  // Check if username already exists
  if (data.username) {
    const existing = await prisma.user.findUnique({ 
      where: { username: data.username },
      select: {
        id: true,
        username: true,
        phone: true,
        email: true,
        password: true,
        apiKey: true,
        plan: true,
        country: true,
        createdAt: true,
      },
    });
    if (existing) {
      // Username taken
      throw new AppError(400, 'Username already taken. Please choose another.');
    }
  }

  // Check if phone already exists
  if (data.phone) {
    const existing = await prisma.user.findUnique({ 
      where: { phone: data.phone },
      select: {
        id: true,
        username: true,
        phone: true,
        email: true,
        password: true,
        apiKey: true,
        plan: true,
        country: true,
        createdAt: true,
      },
    });
    if (existing) {
      // User exists - check if they have password
      user = existing;
      
      if (user.password) {
        // User has password - tell them to use password login
        return res.status(200).json({
          success: true,
          message: 'Account exists. Please use password to login.',
          data: {
            exists: true,
            hasPassword: true,
            user: {
              ...user,
              phone: maskPhone(user.phone!),
            },
          },
        });
      } else {
        // User doesn't have password - send OTP to set password
        const otpCode = await sendOTP(data.phone);
        return res.status(200).json({
          success: true,
          message: 'Account exists but no password set. OTP sent to set password.',
          data: {
            exists: true,
            hasPassword: false,
            user: {
              ...user,
              phone: maskPhone(user.phone!),
            },
          },
        });
      }
    }
  }

  // New user - send OTP FIRST before creating account
  isNewUser = true;

  // Send OTP BEFORE creating user (so we don't create user if SMS fails)
  if (data.phone) {
    await sendOTP(data.phone);
  } else {
    throw new AppError(400, 'Phone number is required for registration');
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

  // Create user with both API keys (only after OTP is sent successfully)
  user = await prisma.user.create({
    data: {
      username: data.username || null,
      phone: data.phone || null,
      country: data.country || null,
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
      username: true,
      phone: true,
      apiKey: true,
      plan: true,
      country: true,
      createdAt: true,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      user: {
        ...user,
        phone: user.phone ? maskPhone(user.phone) : null,
      },
      message: 'OTP sent to your phone via SMS. Please verify to complete registration.',
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
    message: 'OTP resent successfully via SMS',
  });
}

/**
 * Verify OTP and complete registration/login
 * For new users: Sets password and creates account
 * For existing users: Just verifies and logs in
 */
export async function verifyOTP(req: AuthRequest, res: Response) {
  const { phone, email, code, password, iccid, country } = verifyOTPSchema.parse(req.body);
  
  // Determine identifier (phone or email)
  const identifier = phone || email;
  if (!identifier) {
    throw new AppError(400, 'Phone or email is required');
  }

  // Trim and normalize the code
  const normalizedCode = code.trim();
  
  // Find OTP - get the most recent unused OTP for this phone/email
  const otp = await prisma.oTP.findFirst({
    where: {
      phone: phone ? phone.trim() : undefined,
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
    // Debug: Check if there are any OTPs for this phone/email
    if (phone) {
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
    }
    
    throw new AppError(400, 'Invalid or expired OTP. Please check the code and try again.');
  }
  
  console.log(`✅ OTP verified successfully for ${identifier}`);

  // Mark OTP as used
  await prisma.oTP.update({
    where: { id: otp.id },
    data: { used: true },
  });

  // Find user by phone OR email to avoid duplicates
  let user = null;
  if (phone) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: phone.trim() },
          { email: phone.trim() }, // In case phone was used as email
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        password: true,
        apiKey: true,
        plan: true,
        role: true,
        country: true,
        createdAt: true,
      },
    });
  } else if (email) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.trim() },
          { phone: email.trim() }, // In case email was used as phone
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        password: true,
        apiKey: true,
        plan: true,
        role: true,
        country: true,
        createdAt: true,
      },
    });
  }

  const isNewUser = !user;
  
  // If user exists but is missing phone/email, update it to merge accounts
  if (user && phone && !user.phone) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { phone: phone.trim() },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        password: true,
        apiKey: true,
        plan: true,
        role: true,
        country: true,
        createdAt: true,
      },
    });
  }
  if (user && email && !user.email) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { email: email.trim() },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        password: true,
        apiKey: true,
        plan: true,
        role: true,
        country: true,
        createdAt: true,
      },
    });
  }

  if (!user) {
    // New user - require password
    if (!password) {
      throw new AppError(400, 'Password is required for new accounts');
    }

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

    // Hash password
    const hashedPassword = await bcrypt.hash(password!, 10);

    // Before creating, check one more time if user exists (race condition check)
    let existingUser = null;
    if (phone) {
      existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: phone.trim() },
            { email: phone.trim() },
          ],
        },
      });
    } else if (email) {
      existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email.trim() },
            { phone: email.trim() },
          ],
        },
      });
    }
    
    if (existingUser) {
      // User was created between our check and now - update instead
      const updateData: any = { password: hashedPassword };
      if (phone && !existingUser.phone) updateData.phone = phone.trim();
      if (email && !existingUser.email) updateData.email = email.trim();
      if (country && !existingUser.country) updateData.country = country;
      
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          password: true,
          apiKey: true,
          plan: true,
          role: true,
          country: true,
          createdAt: true,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          phone: phone ? phone.trim() : null,
          email: email ? email.trim() : null,
          password: hashedPassword,
          country: country || null,
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
          username: true,
          email: true,
          phone: true,
          password: true,
          apiKey: true,
          plan: true,
          role: true,
          country: true,
          createdAt: true,
        },
      });
    }
  } else {
    // Existing user - if password provided, update it (password reset flow)
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
        select: {
          id: true,
          email: true,
          phone: true,
          password: true,
          apiKey: true,
          plan: true,
          role: true,
          country: true,
          createdAt: true,
        },
      });
    }
  }

  // Update country if provided and user exists but country is null
  if (country && user && !user.country) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { country },
      select: {
        id: true,
        email: true,
        phone: true,
        apiKey: true,
        plan: true,
        country: true,
        createdAt: true,
      },
    });
  }

  // Register SIM card if ICCID provided (from mobile app)
  if (iccid && phone) {
    // Check if SIM already registered to another user
    const existingSim = await prisma.simCard.findUnique({
      where: { iccid },
    });

    if (existingSim && existingSim.userId !== user.id) {
      throw new AppError(400, 'This SIM card is already registered to another account');
    }

    // Check user's SIM limit
    const userSimCount = await prisma.simCard.count({
      where: { userId: user.id, isActive: true },
    });

    if (user.plan === 'FREE' && userSimCount >= 1) {
      throw new AppError(403, 'Free plan allows only 1 SIM card. Upgrade to Premium to add more.');
    }

    // Register or update SIM
    if (existingSim) {
      // Update existing SIM
      await prisma.simCard.update({
        where: { iccid },
        data: {
          phoneNumber: phone,
          isActive: true,
        },
      });
    } else {
      // Create new SIM
      await prisma.simCard.create({
        data: {
          userId: user.id,
          iccid,
          phoneNumber: phone,
          isActive: true,
        },
      });
    }
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
        password: undefined, // Don't send password back
        phone: user.phone ? maskPhone(user.phone) : null,
      },
      token,
      isNewUser,
    },
  });
}

/**
 * Login with username/phone and password
 */
export async function login(req: AuthRequest, res: Response) {
  try {
    console.log('\n🔐 ==========================================');
    console.log('📝 LOGIN ATTEMPT');
    console.log('==========================================');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('IP:', req.ip || req.socket.remoteAddress);
    console.log('User-Agent:', req.headers['user-agent']);
    
    const { username, phone, password } = loginSchema.parse(req.body);
    
    console.log('Parsed credentials:', {
      username: username || '(not provided)',
      phone: phone ? maskPhone(phone) : '(not provided)',
      passwordLength: password?.length || 0,
    });

    // Find user by username or phone
    let user = null;
    if (username) {
      console.log(`🔍 Searching for user with username: "${username}"`);
      user = await prisma.user.findUnique({
        where: { username },
        select: {
          id: true, username: true, email: true, phone: true, password: true, apiKey: true,
          devApiKey: true, plan: true, role: true, country: true, createdAt: true,
        },
      });
      if (user) {
        console.log(`✅ User found: ${user.id} (${user.username})`);
        console.log(`   Has password: ${!!user.password}`);
        console.log(`   Role: ${user.role}`);
      } else {
        console.log(`❌ No user found with username: "${username}"`);
      }
    } else if (phone) {
      console.log(`🔍 Searching for user with phone: ${maskPhone(phone)}`);
      user = await prisma.user.findUnique({
        where: { phone },
        select: {
          id: true, username: true, email: true, phone: true, password: true, apiKey: true,
          devApiKey: true, plan: true, role: true, country: true, createdAt: true,
        },
      });
      if (user) {
        console.log(`✅ User found: ${user.id} (${user.username || 'no username'})`);
        console.log(`   Has password: ${!!user.password}`);
        console.log(`   Role: ${user.role}`);
      } else {
        console.log(`❌ No user found with phone: ${maskPhone(phone)}`);
      }
    } else {
      console.log('❌ Neither username nor phone provided');
    }

    if (!user) {
      console.log('❌ LOGIN FAILED: User not found');
      console.log('==========================================\n');
      throw new AppError(401, 'Invalid username/phone or password');
    }

    // Check if user has password set
    if (!user.password) {
      console.log('❌ LOGIN FAILED: User has no password set');
      console.log('==========================================\n');
      throw new AppError(400, 'Please verify your account with OTP first to set a password');
    }

    // Verify password
    console.log('🔑 Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('❌ LOGIN FAILED: Invalid password');
      console.log('==========================================\n');
      throw new AppError(401, 'Invalid username/phone or password');
    }

    console.log('✅ Password verified successfully');

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.log('❌ LOGIN FAILED: JWT_SECRET not configured');
      console.log('==========================================\n');
      throw new AppError(500, 'JWT_SECRET not configured');
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn } as SignOptions
    );

    console.log('✅ LOGIN SUCCESS');
    console.log(`   User: ${user.username || user.phone || user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Plan: ${user.plan}`);
    console.log('==========================================\n');

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          password: undefined, // Don't send password back
          phone: user.phone ? maskPhone(user.phone) : null,
        },
        token,
      },
    });
  } catch (error: any) {
    console.error('\n❌ LOGIN ERROR:', error);
    console.error('Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    console.log('==========================================\n');
    
    // Re-throw AppError as-is
    if (error instanceof AppError) {
      throw error;
    }
    
    // Handle validation errors from zod
    if (error.name === 'ZodError') {
      console.error('Validation errors:', error.errors);
      throw new AppError(400, `Validation error: ${error.errors.map((e: any) => e.message).join(', ')}`);
    }
    
    // Unknown error
    throw new AppError(500, 'Login failed due to server error');
  }
}

// Google OAuth has been removed - use username/phone + password authentication instead

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
      username: true,
      email: true,
      phone: true,
      apiKey: true,
      devApiKey: true,
      plan: true,
      role: true,
      country: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Get user's registered SIM cards
  const simCards = await prisma.simCard.findMany({
    where: { userId: req.user.id, isActive: true },
    select: {
      id: true,
      iccid: true,
      phoneNumber: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      ...user,
      phone: user?.phone ? maskPhone(user.phone) : null,
      simCards: simCards.map((sim: any) => ({
        ...sim,
        phoneNumber: maskPhone(sim.phoneNumber),
      })),
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

/**
 * Get all registered SIM cards for the user
 */
export async function getSimCards(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const simCards = await prisma.simCard.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      iccid: true,
      phoneNumber: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.json({
    success: true,
    data: simCards.map((sim: any) => ({
      ...sim,
      phoneNumber: maskPhone(sim.phoneNumber),
    })),
  });
}

/**
 * Add a new SIM card (Premium only, or first SIM for free users)
 */
export async function addSimCard(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { iccid, phoneNumber } = z.object({
    iccid: z.string().min(10),
    phoneNumber: z.string().min(10),
  }).parse(req.body);

  // Check if SIM already registered to another user
  const existingSim = await prisma.simCard.findUnique({
    where: { iccid },
  });

  if (existingSim && existingSim.userId !== req.user.id) {
    throw new AppError(400, 'This SIM card is already registered to another account');
  }

  if (existingSim && existingSim.userId === req.user.id) {
    // Reactivate existing SIM
    const updated = await prisma.simCard.update({
      where: { iccid },
      data: {
        phoneNumber,
        isActive: true,
      },
    });

    return res.json({
      success: true,
      message: 'SIM card reactivated',
      data: {
        ...updated,
        phoneNumber: maskPhone(updated.phoneNumber),
      },
    });
  }

  // Check user's SIM limit
  const userSimCount = await prisma.simCard.count({
    where: { userId: req.user.id, isActive: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { plan: true },
  });

  if (user?.plan === 'FREE' && userSimCount >= 1) {
    throw new AppError(403, 'Free plan allows only 1 SIM card. Upgrade to Premium to add more.');
  }

  // Premium users can add up to 10 SIMs
  if (user?.plan === 'PREMIUM' && userSimCount >= 10) {
    throw new AppError(403, 'Premium plan allows up to 10 SIM cards. Please remove one to add another.');
  }

  // Create new SIM
  const simCard = await prisma.simCard.create({
    data: {
      userId: req.user.id,
      iccid,
      phoneNumber,
      isActive: true,
    },
  });

  res.json({
    success: true,
    message: 'SIM card registered successfully',
    data: {
      ...simCard,
      phoneNumber: maskPhone(simCard.phoneNumber),
    },
  });
}

/**
 * Remove/deactivate a SIM card
 */
export async function removeSimCard(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = z.object({
    id: z.string(),
  }).parse(req.body);

  // Verify SIM belongs to user
  const simCard = await prisma.simCard.findFirst({
    where: {
      id,
      userId: req.user.id,
    },
  });

  if (!simCard) {
    throw new AppError(404, 'SIM card not found');
  }

  // Deactivate instead of delete (for audit trail)
  await prisma.simCard.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({
    success: true,
    message: 'SIM card removed successfully',
  });
}

/**
 * Check if a SIM card is registered for the user
 */
export async function checkSimCard(req: AuthRequest, res: Response) {
  const { iccid } = z.object({
    iccid: z.string().min(10),
  }).parse(req.query);

  // This endpoint is for mobile app to check if SIM is registered
  // It uses API key authentication
  if (!req.user) {
    throw new AppError(401, 'API key required');
  }

  const simCard = await prisma.simCard.findFirst({
    where: {
      iccid,
      userId: req.user.id,
      isActive: true,
    },
  });

  res.json({
    success: true,
    data: {
      isRegistered: !!simCard,
      simCard: simCard ? {
        id: simCard.id,
        phoneNumber: maskPhone(simCard.phoneNumber),
      } : null,
    },
  });
}