import prisma from './prisma';
import { sendOTP as sendTelegramOTP } from './telegramBot';
import * as crypto from 'crypto';

// OTP Configuration
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);

export type OTPPurpose = 'LOGIN' | 'RESET_PASSWORD' | 'LINK_TELEGRAM';

/**
 * Generate a random numeric OTP code
 */
export function generateOTPCode(length: number = OTP_LENGTH): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return crypto.randomInt(min, max + 1).toString();
}

/**
 * Request OTP for a user
 * Sends OTP via Telegram if the user has Telegram linked
 * @returns Object indicating success and delivery channel
 */
export async function requestOTP(
  identifier: { phone?: string; userId?: string; telegramId?: string },
  purpose: OTPPurpose = 'LOGIN'
): Promise<{
  success: boolean;
  message: string;
  channel?: 'telegram';
  expiresAt?: Date;
}> {
  try {
    // Find user by phone, userId, or telegramId
    let user = null;
    
    if (identifier.userId) {
      user = await prisma.user.findUnique({
        where: { id: identifier.userId },
        select: { id: true, phone: true, telegramId: true },
      });
    } else if (identifier.phone) {
      user = await prisma.user.findUnique({
        where: { phone: identifier.phone },
        select: { id: true, phone: true, telegramId: true },
      });
    } else if (identifier.telegramId) {
      user = await prisma.user.findUnique({
        where: { telegramId: identifier.telegramId },
        select: { id: true, phone: true, telegramId: true },
      });
    }

    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    // Check if user has Telegram linked
    if (!user.telegramId) {
      return {
        success: false,
        message: 'Please link your Telegram account first to receive OTP codes',
      };
    }

    // Rate limiting: Check if user requested OTP recently
    const recentOTP = await prisma.oTP.findFirst({
      where: {
        OR: [
          { phone: user.phone },
          { telegramId: user.telegramId },
        ],
        purpose,
        createdAt: {
          gt: new Date(Date.now() - 60 * 1000), // Within last minute
        },
      },
    });

    if (recentOTP) {
      const waitTime = Math.ceil((60 * 1000 - (Date.now() - recentOTP.createdAt.getTime())) / 1000);
      return {
        success: false,
        message: `Please wait ${waitTime} seconds before requesting a new code`,
      };
    }

    // Generate OTP code
    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in database
    await prisma.oTP.create({
      data: {
        phone: user.phone,
        telegramId: user.telegramId,
        code,
        purpose,
        expiresAt,
      },
    });

    // Send OTP via Telegram
    const sent = await sendTelegramOTP(user.telegramId, code, purpose);

    if (!sent) {
      return {
        success: false,
        message: 'Failed to send OTP. Please try again.',
      };
    }

    return {
      success: true,
      message: 'OTP sent to your Telegram',
      channel: 'telegram',
      expiresAt,
    };
  } catch (error) {
    console.error('Request OTP error:', error);
    return {
      success: false,
      message: 'Failed to send OTP. Please try again.',
    };
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  identifier: { phone?: string; telegramId?: string },
  code: string,
  purpose: OTPPurpose = 'LOGIN'
): Promise<{
  success: boolean;
  message: string;
  userId?: string;
}> {
  try {
    // Find the OTP record
    const whereConditions: any[] = [];
    
    if (identifier.phone) {
      whereConditions.push({ phone: identifier.phone });
    }
    if (identifier.telegramId) {
      whereConditions.push({ telegramId: identifier.telegramId });
    }

    if (whereConditions.length === 0) {
      return {
        success: false,
        message: 'Invalid identifier',
      };
    }

    const otp = await prisma.oTP.findFirst({
      where: {
        OR: whereConditions,
        code,
        purpose,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      return {
        success: false,
        message: 'Invalid or expired OTP code',
      };
    }

    // Mark OTP as used
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // Find the user
    let user = null;
    if (otp.phone) {
      user = await prisma.user.findUnique({
        where: { phone: otp.phone },
        select: { id: true },
      });
    } else if (otp.telegramId) {
      user = await prisma.user.findUnique({
        where: { telegramId: otp.telegramId },
        select: { id: true },
      });
    }

    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    return {
      success: true,
      message: 'OTP verified successfully',
      userId: user.id,
    };
  } catch (error) {
    console.error('Verify OTP error:', error);
    return {
      success: false,
      message: 'Failed to verify OTP. Please try again.',
    };
  }
}

/**
 * Generate OTP for account linking
 * Returns the code to display to user (they send it to the bot)
 */
export async function generateLinkingOTP(userId: string): Promise<{
  success: boolean;
  code?: string;
  message: string;
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, telegramId: true },
    });

    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    if (user.telegramId) {
      return {
        success: false,
        message: 'Telegram is already linked to this account',
      };
    }

    // Generate a unique linking code
    const code = generateOTPCode(8); // Longer code for manual entry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the linking code
    await prisma.oTP.create({
      data: {
        phone: user.phone,
        code,
        purpose: 'LINK_TELEGRAM',
        expiresAt,
      },
    });

    return {
      success: true,
      code,
      message: 'Send this code to our Telegram bot to link your account',
    };
  } catch (error) {
    console.error('Generate linking OTP error:', error);
    return {
      success: false,
      message: 'Failed to generate linking code. Please try again.',
    };
  }
}

/**
 * Clean up expired OTPs (call periodically)
 */
export async function cleanupExpiredOTPs(): Promise<number> {
  const result = await prisma.oTP.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { used: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return result.count;
}

export default {
  generateOTPCode,
  requestOTP,
  verifyOTP,
  generateLinkingOTP,
  cleanupExpiredOTPs,
};
