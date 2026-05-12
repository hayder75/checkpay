import { Router, Response } from 'express';
import { z } from 'zod';
import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import prisma from '../utils/prisma';
import {
  generateAuthToken,
  checkAuthToken,
  verifyTelegramWidgetData,
  getBotUsername,
} from '../utils/telegramBot';
import { generateLinkingOTP } from '../utils/otpService';
import { generateApiKey } from '../utils/generateApiKey';
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

/**
 * Initialize Telegram deep link authentication
 * POST /auth/telegram/init
 * Returns a token and deep link URL for mobile app to open Telegram
 */
router.post('/init', generalRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { token, expiresAt } = await generateAuthToken();
  const botUsername = getBotUsername();

  if (!botUsername) {
    throw new AppError(500, 'Telegram bot not configured');
  }

  // Generate deep link URL
  const deepLink = `tg://resolve?domain=${botUsername}&start=${token}`;
  const webLink = `https://t.me/${botUsername}?start=${token}`;

  res.json({
    success: true,
    data: {
      token,
      deepLink,
      webLink,
      expiresAt,
    },
  });
}));

/**
 * Check Telegram auth token status (for polling)
 * GET /auth/telegram/check/:token
 */
router.get('/check/:token', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { token } = req.params;

  if (!token) {
    throw new AppError(400, 'Token is required');
  }

  const result = await checkAuthToken(token);

  if (result.status === 'EXPIRED') {
    throw new AppError(400, 'Authentication token has expired');
  }

  if (result.status === 'COMPLETED' && result.userId) {
    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        telegramId: true,
        telegramUsername: true,
        firstName: true,
        lastName: true,
        apiKey: true,
        plan: true,
        role: true,
        country: true,
        profileComplete: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Generate JWT token
    const jwtToken = signToken(user.id);

    res.json({
      success: true,
      status: 'COMPLETED',
      data: {
        user: {
          ...user,
          phone: user.phone ? maskPhone(user.phone) : null,
        },
        token: jwtToken,
      },
    });
    return;
  }

  res.json({
    success: true,
    status: result.status,
  });
}));

/**
 * Verify Telegram Login Widget data (for dashboard)
 * POST /auth/telegram/verify-widget
 */
router.post('/verify-widget', generalRateLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    id: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    photo_url: z.string().optional(),
    auth_date: z.string(),
    hash: z.string(),
  });

  const telegramData = schema.parse(req.body);

  // Verify the data hash
  const isValid = verifyTelegramWidgetData(telegramData as Record<string, string>);

  if (!isValid) {
    throw new AppError(400, 'Invalid Telegram authentication data');
  }

  const telegramId = telegramData.id;
  const telegramUsername = telegramData.username;
  const firstName = telegramData.first_name;
  const lastName = telegramData.last_name;

  // Find or create user with this Telegram ID
  let user = await prisma.user.findUnique({
    where: { telegramId },
  });

  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    // Create new user
    let apiKey = generateApiKey();
    let keyExists = await prisma.user.findUnique({ where: { apiKey } });
    while (keyExists) {
      apiKey = generateApiKey();
      keyExists = await prisma.user.findUnique({ where: { apiKey } });
    }

    user = await prisma.user.create({
      data: {
        telegramId,
        telegramUsername,
        telegramLinkedAt: new Date(),
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'BUSINESS_OWNER',
        profileComplete: false, // Needs to complete profile (select country)
        apiKey,
        usageStats: {
          create: {
            appRequestsToday: 0,
            appRequestsMonth: 0,
            devRequestsToday: 0,
            devRequestsMonth: 0,
          },
        },
      },
    });

    // Assign free package to new user
    try {
      const { assignFreePackageToUser } = await import('../utils/tokenUsage');
      await assignFreePackageToUser(user.id);
    } catch (error) {
      console.error('Failed to assign free package:', error);
    }
  } else {
    // Update Telegram username if changed
    if (telegramUsername !== user.telegramUsername) {
      await prisma.user.update({
        where: { id: user.id },
        data: { telegramUsername },
      });
    }
  }

  // Generate JWT token
  const token = signToken(user.id);

  // Get full user data
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      telegramId: true,
      telegramUsername: true,
      firstName: true,
      lastName: true,
      apiKey: true,
      plan: true,
      role: true,
      country: true,
      profileComplete: true,
      createdAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      user: {
        ...fullUser,
        phone: fullUser?.phone ? maskPhone(fullUser.phone) : null,
      },
      token,
      isNewUser,
    },
  });
}));

/**
 * Generate code to link Telegram to existing account
 * POST /auth/telegram/link
 * Requires authentication
 */
router.post('/link', authenticate as any, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  // Check if user already has Telegram linked
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true, telegramUsername: true },
  });

  if (user?.telegramId) {
    throw new AppError(400, `Telegram is already linked (@${user.telegramUsername || 'unknown'})`);
  }

  // Generate linking code
  const result = await generateLinkingOTP(userId);

  if (!result.success) {
    throw new AppError(400, result.message);
  }

  const botUsername = getBotUsername();

  res.json({
    success: true,
    data: {
      code: result.code,
      botUsername,
      botLink: `https://t.me/${botUsername}`,
      instructions: `Send /link ${result.code} to our Telegram bot to link your account`,
      expiresIn: '10 minutes',
    },
  });
}));

/**
 * Unlink Telegram from account
 * DELETE /auth/telegram/link
 * Requires authentication
 */
router.delete('/link', authenticate as any, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  // Check if user has Telegram linked
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true, phone: true, email: true, password: true },
  });

  if (!user?.telegramId) {
    throw new AppError(400, 'No Telegram account is linked');
  }

  // Ensure user has another way to login
  const hasPassword = !!user.password;
  const hasPhoneOrEmail = !!(user.phone || user.email);

  if (!hasPassword && !hasPhoneOrEmail) {
    throw new AppError(400, 'Cannot unlink Telegram - you need at least one other login method (phone/email with password) to access your account');
  }

  // Unlink Telegram
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
    },
  });

  res.json({
    success: true,
    message: 'Telegram account unlinked successfully',
  });
}));

/**
 * Get Telegram link status
 * GET /auth/telegram/status
 * Requires authentication
 */
router.get('/status', authenticate as any, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telegramId: true,
      telegramUsername: true,
      telegramLinkedAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      isLinked: !!user?.telegramId,
      telegramUsername: user?.telegramUsername || null,
      linkedAt: user?.telegramLinkedAt || null,
    },
  });
}));

/**
 * Get bot info for display
 * GET /auth/telegram/bot-info
 */
router.get('/bot-info', asyncHandler(async (req: AuthRequest, res: Response) => {
  const botUsername = getBotUsername();

  if (!botUsername) {
    throw new AppError(500, 'Telegram bot not configured');
  }

  res.json({
    success: true,
    data: {
      botUsername,
      botLink: `https://t.me/${botUsername}`,
    },
  });
}));

/**
 * Redirect to mobile app - serves an HTML page that redirects to the app
 * GET /auth/telegram/open-app
 * This is used by Telegram buttons since they only support https:// URLs
 */
router.get('/open-app', (req, res) => {
  const { path } = req.query;
  const appPath = typeof path === 'string' ? path : '';
  const appUrl = `checkpay://${appPath}`;
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.checkpay.mobile';
  const appStoreUrl = 'https://apps.apple.com/app/checkpay';
  const fallbackUrl = process.env.DASHBOARD_URL || 'https://checkpay.live';

  // Serve HTML page that tries to open the app
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Opening CheckPay...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    .container {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 { margin: 0 0 10px 0; font-size: 24px; }
    p { margin: 10px 0; opacity: 0.9; }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .buttons { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
    a.btn {
      display: inline-block;
      padding: 12px 24px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    a.btn:hover { transform: scale(1.05); }
    a.btn.secondary { background: rgba(255,255,255,0.2); color: white; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">📱</div>
    <h1>Opening CheckPay</h1>
    <p>Please wait while we open the app...</p>
    <div class="spinner"></div>
    <div class="buttons" id="buttons" style="display: none;">
      <p>App not opening?</p>
      <a href="${playStoreUrl}" class="btn">Get on Google Play</a>
      <a href="${appStoreUrl}" class="btn">Get on App Store</a>
      <a href="${fallbackUrl}" class="btn secondary">Continue on Web</a>
    </div>
  </div>
  <script>
    // Try to open the app
    const appUrl = "${appUrl}";
    const startTime = Date.now();
    
    // Create hidden iframe to try opening the app
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appUrl;
    document.body.appendChild(iframe);
    
    // Also try direct navigation
    window.location.href = appUrl;
    
    // If still on page after 2 seconds, show fallback buttons
    setTimeout(() => {
      if (Date.now() - startTime > 1500) {
        document.getElementById('buttons').style.display = 'flex';
        document.querySelector('.spinner').style.display = 'none';
        document.querySelector('p').textContent = 'If the app didn\\'t open, you can download it below:';
      }
    }, 2000);
  </script>
</body>
</html>
  `);
});

export default router;
