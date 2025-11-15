/**
 * SMS Monitoring Service
 * Monitors incoming SMS in real-time and extracts transactions
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import { storage } from './storage';
import { matchInstitutionPattern, InstitutionPattern } from '../utils/patternMatcher';
import { maskPhone } from '../utils/maskPhone';
import { ingestTransaction } from './api';
import { downloadCountryPatterns } from '../utils/patternVerifier';

export interface LocalTransaction {
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
  synced: boolean; // Whether synced to backend
  createdAt: string;
}

class SMSService {
  private isMonitoring: boolean = false;
  private lastProcessedSMSId: string | null = null;
  private processedSMSIds: Set<string> = new Set(); // Track all processed SMS IDs
  private appState: AppStateStatus = 'active';
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring SMS messages
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('SMS monitoring already started');
      return;
    }

    if (Platform.OS !== 'android') {
      console.warn('SMS monitoring only supported on Android');
      return;
    }

    // Check if user has completed onboarding
    const onboardingCompleted = await storage.getOnboardingCompleted();
    if (!onboardingCompleted) {
      console.log('Onboarding not completed, skipping SMS monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log('Starting SMS monitoring...');

    // Listen to app state changes
    AppState.addEventListener('change', this.handleAppStateChange);

    // Start periodic checking (every 5 seconds when app is active)
    this.startPeriodicCheck();

    // Initial check
    await this.checkForNewSMS();
  }

  /**
   * Stop monitoring SMS messages
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    console.log('Stopping SMS monitoring...');

    AppState.removeEventListener('change', this.handleAppStateChange);

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground - resume monitoring
      console.log('App came to foreground, resuming SMS monitoring');
      this.startPeriodicCheck();
      this.checkForNewSMS();
    } else if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
      // App went to background - reduce frequency or pause
      console.log('App went to background, pausing SMS monitoring');
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }
    this.appState = nextAppState;
  };

  /**
   * Start periodic checking for new SMS
   */
  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check every 5 seconds when app is active
    this.checkInterval = setInterval(() => {
      if (this.appState === 'active') {
        this.checkForNewSMS();
      }
    }, 5000);
  }

  /**
   * Check for new SMS and process them
   */
  private async checkForNewSMS(): Promise<void> {
    try {
      // Get country code
      const countryCode = await storage.getCountryCode();
      if (!countryCode) {
        console.log('⚠️ [SMS Service] No country code set, skipping SMS check');
        return;
      }

      // Get institution patterns for the country
      let patterns = await storage.getInstitutionPatterns();
      console.log(`📋 [SMS Service] Cached patterns: ${patterns.length}`);
      
      // If no patterns cached, download them
      if (patterns.length === 0) {
        console.log('📥 [SMS Service] No patterns cached, downloading...');
        patterns = await downloadCountryPatterns(countryCode);
        console.log(`📥 [SMS Service] Downloaded ${patterns.length} patterns`);
        
        // Verify patterns are now available
        const verifiedPatterns = await storage.getInstitutionPatterns();
        if (verifiedPatterns.length > 0) {
          patterns = verifiedPatterns;
          console.log(`✅ [SMS Service] Verified ${patterns.length} patterns are now available`);
        }
      }

      if (patterns.length === 0) {
        console.warn('⚠️ [SMS Service] No patterns available, skipping SMS check');
        console.warn('⚠️ [SMS Service] This means SMS matching will not work.');
        console.warn('⚠️ [SMS Service] Please ensure:');
        console.warn('   1. You have completed onboarding');
        console.warn('   2. You have signed in');
        console.warn('   3. Patterns have been downloaded for your country');
        return;
      }
      
      // Log pattern details for debugging
      console.log(`📋 [SMS Service] Using ${patterns.length} patterns for matching:`, 
        patterns.map(p => ({
          id: p.id?.substring(0, 8),
          name: p.name,
          institution: p.institution,
          hasRegex: !!p.regex,
        }))
      );

      // Read recent SMS (last 20 messages to catch more)
      try {
        const { readSMSMessages } = await import('../utils/smsReader');
        const smsMessages = await readSMSMessages(20);
        
        console.log(`📱 [SMS Service] Read ${smsMessages?.length || 0} SMS messages`);
        
        if (!smsMessages || smsMessages.length === 0) {
          return;
        }

        // Process each SMS - try to match against patterns
        let processedCount = 0;
        for (const sms of smsMessages) {
          // Skip if already processed (check both last ID and set)
          if (this.processedSMSIds.has(sms.id)) {
            continue;
          }

          console.log(`🔍 [SMS Service] Checking SMS: ${sms.body.substring(0, 50)}...`);
          const result = await this.processSMS(sms, patterns);
          if (result) {
            processedCount++;
            // Mark as processed
            this.processedSMSIds.add(sms.id);
            // Keep set size manageable (last 100)
            if (this.processedSMSIds.size > 100) {
              const firstId = Array.from(this.processedSMSIds)[0];
              this.processedSMSIds.delete(firstId);
            }
          }
          this.lastProcessedSMSId = sms.id;
        }
        
        if (processedCount > 0) {
          console.log(`✅ [SMS Service] Processed ${processedCount} new transaction(s)`);
        }
      } catch (importError) {
        console.warn('⚠️ [SMS Service] SMS reader not available:', importError);
        return;
      }
    } catch (error) {
      console.error('❌ [SMS Service] Error checking for new SMS:', error);
    }
  }

  /**
   * Process a single SMS message
   */
  private async processSMS(sms: any, patterns: InstitutionPattern[]): Promise<boolean> {
    try {
      // Find matching pattern
      const matchResult = this.findMatchingPattern(sms.body, patterns, sms.address);
      if (!matchResult.matched || !matchResult.data) {
        console.log('❌ [SMS Service] No pattern matched for SMS:', sms.body.substring(0, 50));
        return false;
      }
      
      console.log('✅ [SMS Service] Pattern matched!', {
        txnId: matchResult.data.txnId,
        amount: matchResult.data.amount,
        pattern: matchResult.data.patternName,
      });

      // Mask phone number
      const maskedSender = maskPhone(matchResult.data.sender);

      // Create transaction object
      const transaction: LocalTransaction = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        txnId: matchResult.data.txnId,
        amount: matchResult.data.amount,
        sender: maskedSender,
        sendFrom: matchResult.data.sendFrom || null,
        sendTo: matchResult.data.sendTo || null,
        bank: matchResult.data.bank || null,
        pattern: matchResult.data.patternName || 'Institution Pattern',
        smsText: sms.body,
        receivedAt: new Date(sms.date).toISOString(),
        synced: false,
        createdAt: new Date().toISOString(),
      };

      // Save to local storage
      await this.saveLocalTransaction(transaction);

      // Try to sync to backend if authenticated (using JWT token)
      const token = await storage.getToken();
      console.log('🔑 [SMS Service] Authentication check:', {
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
      });
      
      if (token) {
        console.log('🔄 [SMS Service] Attempting to sync transaction to backend...');
        await this.syncTransactionToBackend(transaction);
      } else {
        console.warn('⚠️ [SMS Service] No authentication token found - transaction will not be synced to backend');
        console.warn('⚠️ [SMS Service] User needs to sign in to sync transactions');
      }

      console.log('✅ [SMS Service] Transaction processed:', transaction.txnId);
      return true;
    } catch (error) {
      console.error('❌ [SMS Service] Error processing SMS:', error);
      return false;
    }
  }

  /**
   * Find matching pattern for SMS
   */
  private findMatchingPattern(
    smsText: string, 
    patterns: InstitutionPattern[], 
    senderAddress?: string
  ): { matched: boolean; data?: any } {
    // First try regex matching
    for (const pattern of patterns) {
      const result = matchInstitutionPattern(smsText, pattern);
      if (result.matched && result.data) {
        return result;
      }
    }
    
    // If regex didn't match, try keyword-based extraction
    console.log('🔍 [SMS Service] Regex didn\'t match, trying keyword-based extraction...');
    const keywordResult = this.extractWithKeywords(smsText, patterns, senderAddress);
    if (keywordResult.matched) {
      console.log('✅ [SMS Service] Keyword-based extraction succeeded');
      return keywordResult;
    }
    
    return { matched: false };
  }
  
  /**
   * Keyword-based extraction fallback when regex doesn't match
   */
  private extractWithKeywords(
    smsText: string,
    patterns: InstitutionPattern[],
    senderAddress?: string
  ): { matched: boolean; data?: any } {
    // Look for financial transaction keywords
    const hasReceived = /received|credited|transferred|deposited/i.test(smsText);
    const hasAmount = /(?:ETB|KES|NGN|GHS|ብር)\s*[\d,]+\.?\d*|[\d,]+\.?\d*\s*(?:ETB|KES|NGN|GHS|ብር)/i.test(smsText);
    
    if (!hasReceived && !hasAmount) {
      return { matched: false };
    }
    
    // Try to extract transaction ID
    const txnIdPatterns = [
      /transaction\s+number\s+is\s+([A-Z0-9]{6,})/i,
      /transaction\s+number\s+([A-Z0-9]{6,})/i,
      /by\s+transaction\s+number\s+([A-Z0-9]{6,})/i,
      /transaction\s+id\s*[: ]+\s*([A-Z0-9]{6,})/i,
      /txn\s*[: ]+\s*([A-Z0-9]{6,})/i,
      /ref\s*[: ]+\s*([A-Z0-9]{6,})/i,
      /reference\s*[: ]+\s*([A-Z0-9]{6,})/i,
    ];
    
    let txnId = '';
    for (const p of txnIdPatterns) {
      const m = smsText.match(p);
      if (m && m[1] && m[1].length >= 6) {
        txnId = m[1].trim();
        break;
      }
    }
    
    // Fallback: look for alphanumeric codes (6+ chars) that look like transaction IDs
    if (!txnId) {
      const codes = smsText.match(/\b([A-Z0-9]{6,})\b/g);
      if (codes) {
        for (const code of codes) {
          // Skip phone numbers and dates
          if (!code.match(/^\d{10,}$/) && !code.match(/^\d{4}-\d{2}-\d{2}/)) {
            txnId = code;
            break;
          }
        }
      }
    }
    
    // Extract amount
    const amountPatterns = [
      /(?:ETB|KES|NGN|GHS|ብር)\s*(\d{1,3}(?:,\d{3})*\.?\d*)/i,
      /(\d{1,3}(?:,\d{3})*\.?\d*)\s*(?:ETB|KES|NGN|GHS|ብር)/i,
      /received\s+(?:ETB|KES|NGN|GHS|ብር)?\s*(\d{1,3}(?:,\d{3})*\.?\d*)/i,
      /credited\s+(?:ETB|KES|NGN|GHS|ብር)?\s*(\d{1,3}(?:,\d{3})*\.?\d*)/i,
    ];
    
    let amount = 0;
    for (const p of amountPatterns) {
      const m = smsText.match(p);
      if (m && m[1]) {
        const amountStr = m[1].replace(/,/g, '');
        amount = parseFloat(amountStr) || 0;
        if (amount > 0) break;
      }
    }
    
    // Extract sender
    let sender = '';
    const senderPatterns = [
      /from\s+([^\n\.\(]+?)(?:\s+\(|\s+on|\.|$)/i,
      /by\s+([^\n\.\(]+?)(?:\s+\(|\s+on|\.|$)/i,
    ];
    
    for (const p of senderPatterns) {
      const m = smsText.match(p);
      if (m && m[1]) {
        const value = m[1].trim();
        if (value && value.length > 2 && !value.match(/^(transaction|amount|date|time|ref|id|ETB|KES)$/i)) {
          sender = value;
          break;
        }
      }
    }
    
    // Detect bank/institution from SMS or pattern
    let bank = 'Unknown';
    let institution = null;
    
    // Check patterns for institution match
    for (const pattern of patterns) {
      if (pattern.institution && smsText.toLowerCase().includes(pattern.institution.toLowerCase())) {
        institution = pattern.institution;
        bank = pattern.bank || pattern.institution;
        break;
      }
      if (pattern.bank && smsText.toLowerCase().includes(pattern.bank.toLowerCase())) {
        bank = pattern.bank;
        institution = pattern.institution;
        break;
      }
    }
    
    // Fallback: detect from keywords
    if (bank === 'Unknown') {
      const bankKeywords = ['Telebirr', 'Commercial Bank of Ethiopia', 'CBE', 'M-Pesa', 'Mpesa', 'MTN', 'Airtel'];
      const upperSms = smsText.toUpperCase();
      for (const keyword of bankKeywords) {
        if (upperSms.includes(keyword.toUpperCase())) {
          bank = keyword;
          break;
        }
      }
    }
    
    // Require at least amount (txnId is optional for keyword matching)
    if (amount <= 0) {
      return { matched: false };
    }
    
    // If no txnId found, generate one from timestamp
    if (!txnId) {
      txnId = `KW${Date.now().toString(36).toUpperCase()}`;
    }
    
    return {
      matched: true,
      data: {
        txnId,
        amount,
        sender: sender || '',
        sendFrom: null,
        sendTo: null,
        bank: bank || 'Unknown',
        currency: 'ETB',
        patternId: patterns[0]?.id || 'keyword',
        patternName: patterns[0]?.name || 'Keyword Match',
      },
    };
  }

  /**
   * Save transaction to local storage
   */
  private async saveLocalTransaction(transaction: LocalTransaction): Promise<void> {
    const transactions = await this.getLocalTransactions();
    
    // Check if transaction already exists (by txnId)
    const existingIndex = transactions.findIndex(t => t.txnId === transaction.txnId);
    if (existingIndex >= 0) {
      // Update existing transaction
      transactions[existingIndex] = transaction;
    } else {
      // Add new transaction
      transactions.unshift(transaction); // Add to beginning
    }

    // Keep only last 1000 transactions locally
    const limitedTransactions = transactions.slice(0, 1000);
    
    await storage.setLocalTransactions(limitedTransactions);
  }

  /**
   * Sync transaction to backend (uses JWT token authentication)
   */
  private async syncTransactionToBackend(transaction: LocalTransaction): Promise<void> {
    try {
      // Verify we have a token before attempting sync
      const token = await storage.getToken();
      if (!token) {
        console.warn('⚠️ [SMS Service] No JWT token available, cannot sync transaction');
        throw new Error('No authentication token available');
      }
      
      console.log('🔄 [SMS Service] Syncing transaction to backend:', {
        txnId: transaction.txnId,
        amount: transaction.amount,
        bank: transaction.bank,
        hasToken: !!token,
      });
      
      // Don't send ICCID - backend doesn't require it for JWT auth
      const payload: any = {
        txnId: transaction.txnId,
        amount: transaction.amount,
        sender: transaction.sender,
        sendFrom: transaction.sendFrom || null,
        sendTo: transaction.sendTo || null,
        bank: transaction.bank || '',
        pattern: transaction.pattern,
        smsText: transaction.smsText,
      };
      
      console.log('📤 [SMS Service] Sending payload:', {
        ...payload,
        smsText: payload.smsText?.substring(0, 50) + '...',
      });
      
      const result = await ingestTransaction(payload);

      // Mark as synced
      transaction.synced = true;
      await this.updateLocalTransaction(transaction);

      console.log('✅ [SMS Service] Transaction synced to backend successfully:', {
        txnId: transaction.txnId,
        result: result.success,
        transactionId: result.data?.id,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      const errorStatus = error.response?.status;
      
      console.error('❌ [SMS Service] Error syncing transaction to backend:', {
        txnId: transaction.txnId,
        error: errorMessage,
        status: errorStatus,
        response: error.response?.data,
        stack: error.stack?.substring(0, 200),
      });
      
      // Don't mark as synced if there was an error
      // Will retry on next sync attempt
      throw error; // Re-throw so caller knows it failed
    }
  }

  /**
   * Update local transaction
   */
  private async updateLocalTransaction(transaction: LocalTransaction): Promise<void> {
    const transactions = await this.getLocalTransactions();
    const index = transactions.findIndex(t => t.id === transaction.id);
    if (index >= 0) {
      transactions[index] = transaction;
      await storage.setLocalTransactions(transactions);
    }
  }

  /**
   * Get all local transactions
   */
  async getLocalTransactions(): Promise<LocalTransaction[]> {
    return await storage.getLocalTransactions();
  }

  /**
   * Sync all unsynced transactions to backend (uses JWT token authentication)
   */
  async syncAllUnsyncedTransactions(): Promise<void> {
    const token = await storage.getToken();
    if (!token) {
      console.warn('⚠️ [SMS Service] No authentication token, skipping sync');
      console.warn('⚠️ [SMS Service] User needs to sign in to sync transactions');
      throw new Error('No authentication token. Please sign in to sync transactions.');
    }

    const transactions = await this.getLocalTransactions();
    const unsynced = transactions.filter(t => !t.synced);

    if (unsynced.length === 0) {
      console.log('✅ [SMS Service] No unsynced transactions to sync');
      return;
    }

    console.log(`🔄 [SMS Service] Syncing ${unsynced.length} unsynced transactions...`);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const transaction of unsynced) {
      try {
        await this.syncTransactionToBackend(transaction);
        successCount++;
        console.log(`✅ [SMS Service] Synced transaction ${transaction.txnId} (${successCount}/${unsynced.length})`);
      } catch (error: any) {
        failCount++;
        const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
        errors.push(`${transaction.txnId}: ${errorMsg}`);
        console.error(`❌ [SMS Service] Failed to sync transaction ${transaction.txnId}:`, errorMsg);
      }
    }

    console.log(`✅ [SMS Service] Sync complete: ${successCount} succeeded, ${failCount} failed`);
    
    if (failCount > 0) {
      console.warn('⚠️ [SMS Service] Some transactions failed to sync:', errors);
      throw new Error(`${failCount} transaction(s) failed to sync. Check logs for details.`);
    }
  }

  /**
   * Get monitoring status
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Manually trigger SMS check (for debugging/testing)
   */
  async manualCheck(): Promise<void> {
    console.log('🔄 [SMS Service] Manual check triggered');
    await this.checkForNewSMS();
  }

  /**
   * Reset processed SMS IDs (for testing - allows re-processing same SMS)
   */
  resetProcessedSMS(): void {
    this.processedSMSIds.clear();
    this.lastProcessedSMSId = null;
    console.log('🔄 [SMS Service] Reset processed SMS IDs');
  }
}

// Export singleton instance
export const smsService = new SMSService();

