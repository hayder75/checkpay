/**
 * Headless JS Task for processing SMS in background
 * This runs even when the app is closed/killed
 */

import { AppRegistry } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys (must match storage.ts)
const STORAGE_KEYS = {
  LOCAL_TRANSACTIONS: 'local_transactions',
  PROCESSED_SMS_IDS: 'processed_sms_ids',
  INSTALLATION_DATE: 'checkpay_installation_date',
  TOKEN: '@checkpay:token',
  COUNTRY_CODE: 'country_code',
};

interface SMSData {
  sender: string;
  body: string;
  timestamp: number;
}

interface PendingTransaction {
  id: string;
  txnId: string;
  amount: number;
  sender: string;
  sendFrom: string | null;
  sendTo: string | null;
  bank: string | null;
  pattern: string;
  smsText: string;
  receivedAt: string;
  synced: boolean;
  createdAt: string;
}

/**
 * Headless task that processes SMS received in background
 * Called by native SMSHeadlessTaskService
 */
async function SMSReceivedTask(taskData: SMSData): Promise<void> {
  console.log('📨 [HeadlessJS] SMS received in background:', {
    sender: taskData.sender,
    preview: taskData.body.substring(0, 50),
    timestamp: taskData.timestamp,
  });

  try {
    // Check installation date - skip SMS from before installation
    const installDateStr = await AsyncStorage.getItem(STORAGE_KEYS.INSTALLATION_DATE);
    if (installDateStr) {
      const installDate = new Date(installDateStr);
      const smsDate = new Date(taskData.timestamp);
      if (smsDate < installDate) {
        console.log('⏭️ [HeadlessJS] Skipping SMS from before installation');
        return;
      }
    }

    // Generate unique ID for this SMS
    const smsId = `bg_${taskData.timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if already processed
    const processedIdsStr = await AsyncStorage.getItem(STORAGE_KEYS.PROCESSED_SMS_IDS);
    const processedIds: string[] = processedIdsStr ? JSON.parse(processedIdsStr) : [];
    
    // Use timestamp as dedup key since we don't have native SMS ID
    const dedupKey = `${taskData.sender}_${taskData.timestamp}`;
    if (processedIds.includes(dedupKey)) {
      console.log('⏭️ [HeadlessJS] SMS already processed');
      return;
    }

    // Try to fetch patterns from backend (if we have auth token)
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    const countryCode = await AsyncStorage.getItem(STORAGE_KEYS.COUNTRY_CODE);
    
    if (!token || !countryCode) {
      console.log('⚠️ [HeadlessJS] No auth token or country code - saving SMS for later processing');
      // Save raw SMS for processing when app opens
      await saveRawSMSForLater(taskData, smsId);
      return;
    }

    // Import pattern matcher (can't import at top level in headless task)
    // For background processing, we'll save the SMS and let the foreground app process it
    // This is more reliable than making network requests in headless context
    console.log('📥 [HeadlessJS] Saving SMS for foreground processing');
    await saveRawSMSForLater(taskData, smsId);

    // Mark as processed
    processedIds.push(dedupKey);
    // Keep only last 100
    const limitedIds = processedIds.slice(-100);
    await AsyncStorage.setItem(STORAGE_KEYS.PROCESSED_SMS_IDS, JSON.stringify(limitedIds));

    console.log('✅ [HeadlessJS] SMS saved for processing');
  } catch (error) {
    console.error('❌ [HeadlessJS] Error processing SMS:', error);
  }
}

/**
 * Save raw SMS data for later processing by foreground app
 */
async function saveRawSMSForLater(smsData: SMSData, smsId: string): Promise<void> {
  try {
    // Get existing pending SMS
    const pendingKey = 'pending_background_sms';
    const existingStr = await AsyncStorage.getItem(pendingKey);
    const pending: Array<SMSData & { id: string }> = existingStr ? JSON.parse(existingStr) : [];

    // Add new SMS
    pending.push({
      ...smsData,
      id: smsId,
    });

    // Keep only last 50 pending SMS
    const limited = pending.slice(-50);
    await AsyncStorage.setItem(pendingKey, JSON.stringify(limited));

    console.log(`📦 [HeadlessJS] Saved SMS to pending queue (${limited.length} total)`);
  } catch (error) {
    console.error('❌ [HeadlessJS] Error saving SMS for later:', error);
  }
}

/**
 * Register the headless task
 * This must be called in index.js before AppRegistry.registerComponent
 */
export function registerSMSHeadlessTask(): void {
  AppRegistry.registerHeadlessTask('SMSReceivedTask', () => SMSReceivedTask);
  console.log('✅ [HeadlessJS] Registered SMSReceivedTask');
}

export default SMSReceivedTask;
