import { Expo, ExpoPushMessage, ExpoPushReceiptId, ExpoPushTicket } from 'expo-server-sdk';
import { PrismaClient, NotificationType } from '@prisma/client';
import { sendNotification as sendTelegramNotification } from './telegramBot';

const prisma = new PrismaClient();
const expo = new Expo();

/**
 * Process push notification receipts for delivery tracking
 * Note: Receipt IDs don't map directly to tokens, so we mainly use this for logging
 * Invalid tokens are handled in the immediate ticket response
 */
const processReceipts = async (receiptIds: ExpoPushReceiptId[]): Promise<void> => {
  if (receiptIds.length === 0) return;

  try {
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    let errorCount = 0;

    for (const chunk of receiptIdChunks) {
      try {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        
        for (const receiptId of Object.keys(receipts)) {
          const receipt = receipts[receiptId];
          
          if (receipt.status === 'error') {
            errorCount++;
            const error = receipt as any;
            console.warn(`[Notification] Receipt error for ${receiptId}:`, error.details?.error || error.message);
          }
        }
      } catch (error) {
        console.error('[Notification] Error processing receipts:', error);
      }
    }

    if (errorCount > 0) {
      console.log(`[Notification] Found ${errorCount} error(s) in receipts (tokens already cleaned up from immediate response)`);
    }
  } catch (error) {
    console.error('[Notification] Failed to process receipts:', error);
  }
};

/**
 * Check for duplicate notifications within the last 5 minutes
 */
const checkDuplicate = async (
  userId: string,
  type: NotificationType,
  title: string,
  body: string
): Promise<boolean> => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  const duplicate = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      title,
      body,
      createdAt: {
        gte: fiveMinutesAgo,
      },
    },
  });

  return !!duplicate;
};

/**
 * Create a notification and send push notifications
 * Includes deduplication, receipt handling, error tracking, and Telegram delivery
 */
export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: any,
  skipDeduplication: boolean = false
) => {
  // Check for duplicates (unless explicitly skipped)
  if (!skipDeduplication) {
    const isDuplicate = await checkDuplicate(userId, type, title, body);
    if (isDuplicate) {
      console.log(`[Notification] Skipping duplicate notification for user ${userId}`);
      return null;
    }
  }

  // 1. Save to database
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data || {},
    },
  });

  // 2. Get user's info including Telegram ID
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true },
  });

  // 3. Send via Telegram if user has Telegram linked (priority)
  let telegramSent = false;
  if (user?.telegramId) {
    try {
      telegramSent = await sendTelegramNotification(user.telegramId, title, body, data);
      if (telegramSent) {
        console.log(`[Notification] Sent notification via Telegram to user ${userId}`);
      }
    } catch (error) {
      console.error('[Notification] Failed to send Telegram notification:', error);
    }
  }

  // 4. Get user's push tokens
  const pushTokens = await prisma.pushToken.findMany({
    where: { userId },
  });

  if (pushTokens.length === 0) {
    console.log(`[Notification] No push tokens found for user ${userId}`);
    return notification;
  }

  // 3. Send push notifications
  const messages: ExpoPushMessage[] = [];
  const tokenToMessageMap = new Map<string, ExpoPushMessage>();

  for (const pushToken of pushTokens) {
    if (!Expo.isExpoPushToken(pushToken.token)) {
      console.error(`[Notification] Invalid Expo push token: ${pushToken.token.substring(0, 20)}...`);
      continue;
    }

    const message: ExpoPushMessage = {
      to: pushToken.token,
      sound: 'default',
      title,
      body,
      data: { ...data, notificationId: notification.id },
    };

    messages.push(message);
    tokenToMessageMap.set(pushToken.token, message);
  }

  if (messages.length === 0) {
    return notification;
  }

  const chunks = expo.chunkPushNotifications(messages);
  const receiptIds: ExpoPushReceiptId[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      
      // Collect receipt IDs for tickets that need receipts
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'ok' && ticket.id) {
          receiptIds.push(ticket.id);
          successCount++;
        } else if (ticket.status === 'error') {
          failureCount++;
          const error = ticket as any;
          console.error(`[Notification] Push notification failed:`, error.message || error.details);
          
          // Handle invalid tokens immediately
          if (error.details?.error === 'DeviceNotRegistered' || 
              error.details?.error === 'InvalidCredentials') {
            const message = chunk[i];
            if (message && typeof message.to === 'string') {
              const tokenRecord = await prisma.pushToken.findFirst({
                where: { token: message.to },
              });
              
              if (tokenRecord) {
                await prisma.pushToken.delete({
                  where: { id: tokenRecord.id },
                });
                console.log(`[Notification] Removed invalid push token: ${message.to.substring(0, 20)}...`);
              }
            }
          }
        }
      }
    } catch (error) {
      failureCount += chunk.length;
      console.error('[Notification] Failed to send push notifications chunk:', error);
    }
  }

  // Process receipts asynchronously (don't block)
  if (receiptIds.length > 0) {
    processReceipts(receiptIds).catch(err => {
      console.error('[Notification] Error processing receipts:', err);
    });
  }

  console.log(`[Notification] Sent ${successCount} push notification(s), ${failureCount} failed${telegramSent ? ', +1 Telegram' : ''} for notification ${notification.id}`);

  return notification;
};

/**
 * Send a push notification to a specific token
 * Includes receipt handling and error tracking
 */
export const sendPushNotification = async (
  token: string,
  title: string,
  body: string,
  data?: any
): Promise<boolean> => {
  if (!Expo.isExpoPushToken(token)) {
    console.error(`[Notification] Invalid Expo push token: ${token.substring(0, 20)}...`);
    return false;
  }
  
  const message: ExpoPushMessage = {
    to: token,
    sound: 'default',
    title,
    body,
    data,
  };
  
  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);
    const ticket = tickets[0];
    
    if (ticket.status === 'ok') {
      if (ticket.id) {
        // Process receipt asynchronously
        processReceipts([ticket.id]).catch(err => {
          console.error('[Notification] Error processing receipt:', err);
        });
      }
      return true;
    } else {
      const error = ticket as any;
      console.error(`[Notification] Push notification failed:`, error.message || error.details);
      
      // Remove invalid token
      if (error.details?.error === 'DeviceNotRegistered' || 
          error.details?.error === 'InvalidCredentials') {
        const tokenRecord = await prisma.pushToken.findFirst({
          where: { token },
        });
        
        if (tokenRecord) {
          await prisma.pushToken.delete({
            where: { id: tokenRecord.id },
          });
          console.log(`[Notification] Removed invalid push token: ${token.substring(0, 20)}...`);
        }
      }
      
      return false;
    }
  } catch (error) {
    console.error('[Notification] Failed to send push notification:', error);
    return false;
  }
};

