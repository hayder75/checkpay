/**
 * Headless JS Task for processing SMS in background
 * This runs even when the app is closed/killed
 */

import { AppRegistry } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDefaultSMSApp } from '../utils/smsRole';

// Storage keys (must match storage.ts and config.ts)
const STORAGE_KEYS = {
  LOCAL_TRANSACTIONS: 'local_transactions',
  PROCESSED_SMS_IDS: 'processed_sms_ids',
  INSTALLATION_DATE: 'checkpay_installation_date',
  TOKEN: 'checkpay_token', // Matches STORAGE_KEYS.TOKEN from config.ts
  COUNTRY_CODE: 'country_code', // Matches storage.getCountryCode()
  API_KEY: 'checkpay_api_key', // Matches STORAGE_KEYS.API_KEY from config.ts
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
    const defaultRoleGranted = await isDefaultSMSApp();
    if (!defaultRoleGranted) {
      console.log('⏭️ [HeadlessJS] Skipping SMS processing: app is not default SMS app');
      return;
    }

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

    // Get auth credentials
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    const apiKey = await AsyncStorage.getItem(STORAGE_KEYS.API_KEY);
    const countryCode = await AsyncStorage.getItem(STORAGE_KEYS.COUNTRY_CODE);
    
    if (!token && !apiKey) {
      console.log('⚠️ [HeadlessJS] No auth token or API key - saving SMS for later processing');
      await saveRawSMSForLater(taskData, smsId);
      return;
    }

    if (!countryCode) {
      console.log('⚠️ [HeadlessJS] No country code - saving SMS for later processing');
      await saveRawSMSForLater(taskData, smsId);
      return;
    }

    // Try to process SMS in background
    console.log('🔄 [HeadlessJS] Attempting to process SMS in background...');
    const processed = await processSMSInBackground(taskData, token, apiKey, countryCode);
    
    if (processed) {
      // Mark as processed
      processedIds.push(dedupKey);
      // Keep only last 100
      const limitedIds = processedIds.slice(-100);
      await AsyncStorage.setItem(STORAGE_KEYS.PROCESSED_SMS_IDS, JSON.stringify(limitedIds));
      console.log('✅ [HeadlessJS] SMS processed and sent to backend');
    } else {
      // Processing failed - save for later
      console.log('⚠️ [HeadlessJS] Processing failed - saving SMS for later processing');
      await saveRawSMSForLater(taskData, smsId);
    }
  } catch (error) {
    console.error('❌ [HeadlessJS] Error processing SMS:', error);
    // Save for later processing even on error
    try {
      const smsId = `bg_${taskData.timestamp}_${Math.random().toString(36).substr(2, 9)}`;
      await saveRawSMSForLater(taskData, smsId);
    } catch (saveError) {
      console.error('❌ [HeadlessJS] Error saving SMS for later:', saveError);
    }
  }
}

/**
 * Process SMS in background - fetch patterns, match, and send to backend
 */
async function processSMSInBackground(
  smsData: SMSData,
  token: string | null,
  apiKey: string | null,
  countryCode: string
): Promise<boolean> {
  try {
    // Dynamically import required modules (can't import at top level in headless task)
    const { patternsAPI, institutionPatternsAPI, ingestTransaction } = await import('./api');
    const { findMatchingInstitutionPattern } = await import('../utils/patternMatcher');
    
    // Fetch patterns from backend
    let userPatterns: any[] = [];
    let institutionPatterns: any[] = [];
    
    try {
      if (token) {
        // Fetch user patterns
        const userPatternsResponse = await patternsAPI.getAll();
        if (userPatternsResponse.success && userPatternsResponse.data) {
          userPatterns = Array.isArray(userPatternsResponse.data) ? userPatternsResponse.data : [];
          console.log(`✅ [HeadlessJS] Fetched ${userPatterns.length} user patterns`);
        }
        
        // Fetch institution patterns
        try {
          const institutionResponse = await institutionPatternsAPI.getCountryPatterns(countryCode);
          if (institutionResponse.success && institutionResponse.data) {
            const rawPatterns = Array.isArray(institutionResponse.data) ? institutionResponse.data : [];
            institutionPatterns = rawPatterns.map((p: any) => ({
              ...p,
              name: p.name || p.institution || p.bank || 'Institution Pattern',
            }));
            console.log(`✅ [HeadlessJS] Fetched ${institutionPatterns.length} institution patterns`);
          }
        } catch (error) {
          // Institution patterns are optional
          console.log('⚠️ [HeadlessJS] Could not fetch institution patterns:', error);
        }
      }
    } catch (error) {
      console.error('❌ [HeadlessJS] Error fetching patterns:', error);
      return false;
    }
    
    // Convert user patterns to InstitutionPattern format
    const userInstitutionPatterns = userPatterns.map((p: any) => ({
      id: p.id,
      name: p.name || p.bank || 'User Pattern',
      institution: p.bank || null,
      regex: p.regex,
      extractFields: p.extractFields || p.extraction || {},
      bank: p.bank || null,
      currency: p.currency || null,
      usageCount: 0,
      smsExample: null,
      type: 'institution',
      // Include security fields
      allowedSenders: p.allowedSenders || null,
      requireSenderVerification: p.requireSenderVerification !== false,
      senderVerificationMode: p.senderVerificationMode || 'STRICT',
      maxAmountThreshold: p.maxAmountThreshold || null,
      requireContactCheck: p.requireContactCheck !== false,
    }));
    
    // Combine all patterns
    const allPatterns = [...userInstitutionPatterns, ...institutionPatterns];
    
    if (allPatterns.length === 0) {
      console.log('⚠️ [HeadlessJS] No patterns available - cannot process SMS');
      return false;
    }
    
    // Match SMS against patterns
    const matchResult = findMatchingInstitutionPattern(smsData.body, allPatterns, smsData.sender);
    
    if (!matchResult.matched || !matchResult.data) {
      console.log('⏭️ [HeadlessJS] SMS did not match any pattern');
      return false;
    }
    
    // Only process deposits (positive amounts)
    if (matchResult.data.amount <= 0) {
      console.log('⏭️ [HeadlessJS] Skipping withdrawal (negative amount)');
      return false;
    }
    
    // Extract sender name
    let senderName = matchResult.data.sender || '';
    if (!senderName && matchResult.data.sendFrom) {
      senderName = matchResult.data.sendFrom;
    }
    if (!senderName && matchResult.data.bank) {
      senderName = matchResult.data.bank;
    }
    if (!senderName) {
      senderName = 'Unknown';
    }
    
    // Prepare transaction payload
    // Use smsData.sender (actual SMS sender address) for sendFrom to enable backend verification
    const transaction = {
      txnId: matchResult.data.txnId,
      amount: matchResult.data.amount,
      sender: senderName,
      sendFrom: smsData.sender || matchResult.data.sendFrom || null, // Use actual SMS sender address for verification
      sendTo: matchResult.data.sendTo || null,
      bank: matchResult.data.bank || matchResult.data.patternName || '',
      pattern: matchResult.data.patternName || 'SMS Pattern',
      smsText: smsData.body,
      source: 'SMS' as const,
    };
    
    console.log('📤 [HeadlessJS] Sending transaction to backend:', {
      txnId: transaction.txnId,
      amount: transaction.amount,
      sender: transaction.sender,
      bank: transaction.bank,
    });
    
    // Send to backend
    try {
      await ingestTransaction(transaction);
      console.log('✅ [HeadlessJS] Transaction sent to backend successfully');
      return true;
    } catch (error: any) {
      console.error('❌ [HeadlessJS] Failed to send transaction to backend:', {
        error: error.message,
        status: error.response?.status,
        txnId: transaction.txnId,
      });
      return false;
    }
  } catch (error: any) {
    console.error('❌ [HeadlessJS] Error processing SMS in background:', error);
    return false;
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
