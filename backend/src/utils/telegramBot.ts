import TelegramBot from 'node-telegram-bot-api';
import prisma from './prisma';
import * as crypto from 'crypto';

// Initialize bot (polling mode for development, webhook for production)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '';

let bot: TelegramBot | null = null;

// In-memory store for pending auth tokens (use Redis in production)
const pendingAuthTokens = new Map<string, {
  telegramId?: string;
  telegramUsername?: string;
  userId?: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  createdAt: Date;
}>();

/**
 * Initialize the Telegram bot
 */
export function initTelegramBot(): TelegramBot | null {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set - Telegram features disabled');
    return null;
  }

  if (bot) {
    return bot;
  }

  try {
    // Use polling by default unless webhook is specifically configured
    // For now, always enable polling to ensure it works on the server
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
      polling: true,
    });

    // Handle /start command for deep link authentication
    bot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString();
      const telegramUsername = msg.from?.username;
      const firstName = msg.from?.first_name;
      const lastName = msg.from?.last_name;
      const authToken = match?.[1]?.trim();

      if (!telegramId) {
        await bot?.sendMessage(chatId, '❌ Could not identify your Telegram account.');
        return;
      }

      // If there's an auth token, this is a deep link login
      if (authToken) {
        await handleDeepLinkAuth(chatId, telegramId, telegramUsername, firstName, lastName, authToken);
        return;
      }

      // Regular /start - show welcome message
      const baseUrl = process.env.API_BASE_URL || 'https://checkpay.live/api';
      const isValidHttpsUrl = baseUrl.startsWith('https://');
      const openAppUrl = `${baseUrl}/auth/telegram/open-app`;
      
      // Build keyboard - only include app button if URL is valid HTTPS
      const keyboard: Array<Array<{ text: string; url: string }>> = [];
      if (isValidHttpsUrl) {
        keyboard.push([{ text: '📱 Open CheckPay App', url: openAppUrl }]);
      }
      keyboard.push([{ text: '🌐 Open Website', url: 'https://checkpay.live' }]);
      
      await bot?.sendMessage(
        chatId,
        `👋 Welcome to CheckPay!\n\n` +
        `I can help you with:\n` +
        `• 🔐 Secure login via Telegram\n` +
        `• 🔑 One-time passwords (OTP)\n` +
        `• 🔔 Transaction notifications\n\n` +
        `To link your account, use the CheckPay app or dashboard.`,
        {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        }
      );
    });

    // Handle /link command for manual account linking
    bot.onText(/\/link (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id.toString();
      const telegramUsername = msg.from?.username;
      const linkCode = match?.[1]?.trim();

      if (!telegramId || !linkCode) {
        await bot?.sendMessage(chatId, '❌ Invalid link code. Please try again from the app.');
        return;
      }

      await handleLinkAccount(chatId, telegramId, telegramUsername, linkCode);
    });

    // Handle callback queries (button clicks)
    bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const data = query.data;

      if (!chatId || !data) return;

      // Handle different callback actions
      if (data.startsWith('confirm_link_')) {
        const userId = data.replace('confirm_link_', '');
        // Handle link confirmation
        await bot?.answerCallbackQuery(query.id, { text: 'Account linked!' });
      }
    });

    console.log('✅ Telegram bot initialized');
    return bot;
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error);
    return null;
  }
}

/**
 * Handle deep link authentication
 */
async function handleDeepLinkAuth(
  chatId: number,
  telegramId: string,
  telegramUsername: string | undefined,
  firstName: string | undefined,
  lastName: string | undefined,
  authToken: string
): Promise<void> {
  try {
    // Check if token exists and is pending
    const tokenData = pendingAuthTokens.get(authToken);
    
    // Also check database for persistent tokens
    const dbToken = await prisma.telegramAuthToken.findUnique({
      where: { token: authToken },
    });

    if (!tokenData && !dbToken) {
      await bot?.sendMessage(chatId, '❌ Invalid or expired authentication link. Please try again.');
      return;
    }

    if (dbToken && (dbToken.status !== 'PENDING' || dbToken.expiresAt < new Date())) {
      await bot?.sendMessage(chatId, '❌ This authentication link has expired. Please request a new one.');
      return;
    }

    // Find or create user with this Telegram ID
    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      // Create new user with Telegram credentials
      // Set role to BUSINESS_OWNER and profileComplete to false (needs to complete profile)
      user = await prisma.user.create({
        data: {
          telegramId,
          telegramUsername,
          telegramLinkedAt: new Date(),
          firstName: firstName || null,
          lastName: lastName || null,
          role: 'BUSINESS_OWNER',
          profileComplete: false, // Needs to complete profile (select country)
          apiKey: crypto.randomUUID(),
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
        const { assignFreePackageToUser } = await import('./tokenUsage');
        await assignFreePackageToUser(user.id);
      } catch (error) {
        console.error('Failed to assign free package:', error);
      }
    }

    // Update token status in memory
    if (tokenData) {
      pendingAuthTokens.set(authToken, {
        ...tokenData,
        telegramId,
        telegramUsername,
        userId: user.id,
        status: 'COMPLETED',
      });
    }

    // Update token status in database
    if (dbToken) {
      await prisma.telegramAuthToken.update({
        where: { id: dbToken.id },
        data: {
          telegramId,
          userId: user.id,
          status: 'COMPLETED',
        },
      });
    }

    const baseUrl = process.env.API_BASE_URL || 'https://checkpay.live/api';
    const isValidHttpsUrl = baseUrl.startsWith('https://');
    const returnToAppUrl = `${baseUrl}/auth/telegram/open-app?path=auth/success`;
    
    // Build message with or without button based on URL validity
    if (isValidHttpsUrl) {
      await bot?.sendMessage(
        chatId,
        `✅ Authentication successful!\n\n` +
        `You are now logged in as ${user.username || user.phone || 'CheckPay User'}.\n\n` +
        `Return to the app to continue.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📱 Return to App', url: returnToAppUrl }],
            ],
          },
        }
      );
    } else {
      await bot?.sendMessage(
        chatId,
        `✅ Authentication successful!\n\n` +
        `You are now logged in as ${user.username || user.phone || 'CheckPay User'}.\n\n` +
        `You can now return to the app.`
      );
    }
  } catch (error) {
    console.error('Deep link auth error:', error);
    await bot?.sendMessage(chatId, '❌ Authentication failed. Please try again.');
  }
}

/**
 * Handle manual account linking
 */
async function handleLinkAccount(
  chatId: number,
  telegramId: string,
  telegramUsername: string | undefined,
  linkCode: string
): Promise<void> {
  try {
    // Find OTP with this code
    const otp = await prisma.oTP.findFirst({
      where: {
        code: linkCode,
        purpose: 'LINK_TELEGRAM',
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp || !otp.phone) {
      await bot?.sendMessage(chatId, '❌ Invalid or expired link code. Please generate a new one from the app.');
      return;
    }

    // Find user by phone
    const user = await prisma.user.findUnique({
      where: { phone: otp.phone },
    });

    if (!user) {
      await bot?.sendMessage(chatId, '❌ User not found. Please try again.');
      return;
    }

    // Link Telegram to user account
    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId,
        telegramUsername,
        telegramLinkedAt: new Date(),
      },
    });

    // Mark OTP as used
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { used: true },
    });

    await bot?.sendMessage(
      chatId,
      `✅ Account linked successfully!\n\n` +
      `Your Telegram is now connected to your CheckPay account.\n` +
      `You can now receive OTP codes and notifications here.`
    );
  } catch (error) {
    console.error('Link account error:', error);
    await bot?.sendMessage(chatId, '❌ Failed to link account. Please try again.');
  }
}

/**
 * Generate a new auth token for deep link authentication
 */
export async function generateAuthToken(): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store in memory
  pendingAuthTokens.set(token, {
    status: 'PENDING',
    createdAt: new Date(),
  });

  // Store in database for persistence
  await prisma.telegramAuthToken.create({
    data: {
      token,
      status: 'PENDING',
      expiresAt,
    },
  });

  // Clean up expired tokens periodically
  setTimeout(() => {
    pendingAuthTokens.delete(token);
  }, 5 * 60 * 1000);

  return { token, expiresAt };
}

/**
 * Check auth token status
 */
export async function checkAuthToken(token: string): Promise<{
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  userId?: string;
  telegramId?: string;
}> {
  // Check memory first
  const memoryToken = pendingAuthTokens.get(token);
  if (memoryToken?.status === 'COMPLETED' && memoryToken.userId) {
    return {
      status: 'COMPLETED',
      userId: memoryToken.userId,
      telegramId: memoryToken.telegramId,
    };
  }

  // Check database
  const dbToken = await prisma.telegramAuthToken.findUnique({
    where: { token },
  });

  if (!dbToken) {
    return { status: 'EXPIRED' };
  }

  if (dbToken.expiresAt < new Date()) {
    return { status: 'EXPIRED' };
  }

  if (dbToken.status === 'COMPLETED' && dbToken.userId) {
    return {
      status: 'COMPLETED',
      userId: dbToken.userId,
      telegramId: dbToken.telegramId || undefined,
    };
  }

  return { status: 'PENDING' };
}

/**
 * Send OTP code to user via Telegram
 */
export async function sendOTP(telegramId: string, code: string, purpose: string = 'LOGIN'): Promise<boolean> {
  if (!bot) {
    console.error('Telegram bot not initialized');
    return false;
  }

  try {
    const purposeMessages: Record<string, string> = {
      LOGIN: '🔐 Your CheckPay login code is:',
      RESET_PASSWORD: '🔑 Your password reset code is:',
      LINK_TELEGRAM: '🔗 Your account linking code is:',
    };

    const message = purposeMessages[purpose] || '🔐 Your verification code is:';

    await bot.sendMessage(
      telegramId,
      `${message}\n\n` +
      `<code>${code}</code>\n\n` +
      `⏰ This code expires in 5 minutes.\n` +
      `⚠️ Never share this code with anyone.`,
      { parse_mode: 'HTML' }
    );

    return true;
  } catch (error) {
    console.error('Failed to send OTP via Telegram:', error);
    return false;
  }
}

/**
 * Send notification to user via Telegram
 */
export async function sendNotification(
  telegramId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  if (!bot) {
    console.error('Telegram bot not initialized');
    return false;
  }

  try {
    let message = `<b>${title}</b>\n\n${body}`;

    // Add transaction details if present
    if (data?.amount) {
      message += `\n\n💰 Amount: ${data.amount}`;
    }
    if (data?.txnId) {
      message += `\n🔖 Transaction ID: ${data.txnId}`;
    }

    await bot.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    return true;
  } catch (error) {
    console.error('Failed to send notification via Telegram:', error);
    return false;
  }
}

/**
 * Verify Telegram Login Widget data
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramWidgetData(data: Record<string, string>): boolean {
  if (!TELEGRAM_BOT_TOKEN) {
    return false;
  }

  const { hash, ...rest } = data;
  if (!hash) {
    return false;
  }

  // Check auth_date is not too old (24 hours max)
  const authDate = parseInt(rest.auth_date, 10);
  if (isNaN(authDate) || Date.now() / 1000 - authDate > 86400) {
    return false;
  }

  // Create data check string
  const dataCheckArr = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`);
  const dataCheckString = dataCheckArr.join('\n');

  // Create secret key from bot token
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();

  // Calculate HMAC
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return hmac === hash;
}

/**
 * Get bot username for deep links
 */
export function getBotUsername(): string {
  return TELEGRAM_BOT_USERNAME;
}

/**
 * Get Telegram bot instance
 */
export function getBot(): TelegramBot | null {
  return bot;
}

// Export for initialization
export default {
  initTelegramBot,
  generateAuthToken,
  checkAuthToken,
  sendOTP,
  sendNotification,
  verifyTelegramWidgetData,
  getBotUsername,
  getBot,
};
