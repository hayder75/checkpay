/**
 * SMS Monitoring Service
 * Monitors incoming SMS in real-time and extracts transactions
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import { storage } from './storage';
import { matchInstitutionPattern, InstitutionPattern } from '../utils/patternMatcher';
import { maskPhone } from '../utils/maskPhone';
import { ingestTransaction } from './api';
import { installationService } from './installation';
// Patterns are now always fetched from backend, no local caching

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
  private appStateSubscription: any = null; // Subscription for AppState changes
  private installationDate: Date | null = null; // Cache installation date
  private stateLoaded: boolean = false;

  /**
   * Load persisted state from storage (processed SMS IDs)
   */
  private async loadPersistedState(): Promise<void> {
    if (this.stateLoaded) return;
    
    try {
      // Load processed SMS IDs
      const persistedIds = await storage.getProcessedSMSIds();
      this.processedSMSIds = new Set(persistedIds);
      
      // Load installation date
      this.installationDate = await installationService.getInstallationDate();
      
      console.log(`📦 [SMS Service] Loaded persisted state: ${persistedIds.length} processed IDs, install date: ${this.installationDate?.toISOString()}`);
      this.stateLoaded = true;
    } catch (error) {
      console.error('❌ [SMS Service] Error loading persisted state:', error);
    }
  }

  /**
   * Save processed SMS IDs to storage
   */
  private async saveProcessedIds(): Promise<void> {
    try {
      const ids = Array.from(this.processedSMSIds);
      await storage.setProcessedSMSIds(ids);
    } catch (error) {
      console.error('❌ [SMS Service] Error saving processed IDs:', error);
    }
  }

  /**
   * Start monitoring SMS messages
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('✅ [SMS Service] SMS monitoring already started');
      return;
    }

    if (Platform.OS !== 'android') {
      console.warn('⚠️ [SMS Service] SMS monitoring only supported on Android');
      return;
    }

    // Check if user has completed onboarding
    const onboardingCompleted = await storage.getOnboardingCompleted();
    if (!onboardingCompleted) {
      console.log('⚠️ [SMS Service] Onboarding not completed, skipping SMS monitoring');
      return;
    }

    // Check SMS reading capability before starting
    try {
      const { checkSMSReadingCapability } = await import('../utils/smsReader');
      const capability = await checkSMSReadingCapability();
      
      console.log('🔍 [SMS Service] SMS Reading Capability Check:', {
        available: capability.available,
        hasPermission: capability.hasPermission,
        hasNativeModule: capability.hasNativeModule,
        error: capability.error,
      });

      if (!capability.available) {
        console.error('❌ [SMS Service] Cannot start SMS monitoring:', capability.error);
        if (!capability.hasPermission) {
          console.error('   → SMS permission not granted. User needs to grant READ_SMS permission.');
        }
        if (!capability.hasNativeModule) {
          console.error('   → Native SMS module not available. Make sure:');
          console.error('     1. react-native-get-sms-android is installed');
          console.error('     2. App has been rebuilt (not just reloaded)');
          console.error('     3. Native modules are properly linked');
        }
        return;
      }
    } catch (error: any) {
      console.error('❌ [SMS Service] Error checking SMS capability:', error);
      // Continue anyway - the actual read will fail gracefully
    }

    this.isMonitoring = true;
    console.log('🚀 [SMS Service] Starting SMS monitoring...');

    // Load persisted state (processed IDs, installation date)
    await this.loadPersistedState();

    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Start periodic checking (every 5 seconds when app is active)
    this.startPeriodicCheck();

    // Initial check
    await this.checkForNewSMS();
  }

  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get monitoring status for debugging
   */
  getMonitoringStatus(): {
    isMonitoring: boolean;
    appState: AppStateStatus;
    hasInterval: boolean;
    processedCount: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      appState: this.appState,
      hasInterval: !!this.checkInterval,
      processedCount: this.processedSMSIds.size,
    };
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

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

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
      // Process any SMS received while in background
      this.processPendingBackgroundSMS();
      this.checkForNewSMS();
    } else if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
      // App went to background - native BroadcastReceiver will handle SMS
      console.log('App went to background, native BroadcastReceiver active');
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }
    this.appState = nextAppState;
  };

  /**
   * Process SMS that were received in background by the native BroadcastReceiver
   */
  private async processPendingBackgroundSMS(): Promise<void> {
    try {
      const pendingKey = 'pending_background_sms';
      const pendingStr = await storage.getItem(pendingKey);
      
      if (!pendingStr) {
        return;
      }

      const pendingSMS: Array<{ sender: string; body: string; timestamp: number; id: string }> = JSON.parse(pendingStr);
      
      if (pendingSMS.length === 0) {
        return;
      }

      console.log(`📥 [SMS Service] Processing ${pendingSMS.length} pending background SMS`);

      // Get patterns for processing
      const countryCode = await storage.getCountryCode();
      const token = await storage.getToken();
      
      if (!countryCode || !token) {
        console.log('⚠️ [SMS Service] Cannot process pending SMS - no auth or country');
        return;
      }

      // Clear pending queue (we'll process them now)
      await storage.setItem(pendingKey, JSON.stringify([]));

      // Process each pending SMS through normal flow
      for (const sms of pendingSMS) {
        const smsFormat = {
          id: sms.id,
          body: sms.body,
          address: sms.sender,
          date: sms.timestamp,
        };
        
        // This will go through checkForNewSMS on next cycle
        console.log(`📬 [SMS Service] Queued background SMS for processing: ${sms.body.substring(0, 50)}...`);
      }

      console.log(`✅ [SMS Service] Queued ${pendingSMS.length} background SMS for processing`);
    } catch (error) {
      console.error('❌ [SMS Service] Error processing pending SMS:', error);
    }
  }

  /**
   * Start periodic checking for new SMS
   */
  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log('⏰ [SMS Service] Starting periodic check (every 5 seconds)');
    console.log('⏰ [SMS Service] Current app state:', this.appState);

    // Check every 5 seconds when app is active
    this.checkInterval = setInterval(() => {
      console.log('⏰ [SMS Service] Periodic check triggered, app state:', this.appState);
      if (this.appState === 'active') {
        console.log('✅ [SMS Service] App is active, checking for new SMS...');
        this.checkForNewSMS();
      } else {
        console.log('⏸️ [SMS Service] App is not active, skipping SMS check');
      }
    }, 5000);
  }

  /**
   * Force check for new SMS (public method for manual triggering)
   */
  async forceCheckForNewSMS(): Promise<void> {
    console.log('🔄 [SMS Service] Force check requested');
    await this.checkForNewSMS();
  }

  /**
   * Check for new SMS and process them
   */
  private async checkForNewSMS(): Promise<void> {
    if (!this.isMonitoring) {
      console.log('⏸️ [SMS Service] Monitoring not active, skipping check');
      return;
    }

    try {
      console.log('🔍 [SMS Service] Starting check for new SMS...');
      
      // Get country code
      const countryCode = await storage.getCountryCode();
      if (!countryCode) {
        console.log('⚠️ [SMS Service] No country code set, skipping SMS check');
        return;
      }
      console.log('✅ [SMS Service] Country code:', countryCode);

      // Always fetch patterns from backend (no local storage)
      const token = await storage.getToken();
      if (!token) {
        console.log('📱 [SMS Service] No auth token, skipping SMS check');
        return;
      }
      console.log('✅ [SMS Service] Auth token present');
      
      let userPatterns: any[] = [];
      let institutionPatterns: any[] = [];
      
      try {
        // Fetch user patterns from backend
        const { patternsAPI } = await import('./api');
        try {
          const userPatternsResponse = await patternsAPI.getAll();
          console.log('📥 [SMS Service] User patterns response:', {
            success: userPatternsResponse.success,
            hasData: !!userPatternsResponse.data,
            dataType: typeof userPatternsResponse.data,
            isArray: Array.isArray(userPatternsResponse.data),
          });
          if (userPatternsResponse.success && userPatternsResponse.data) {
            userPatterns = Array.isArray(userPatternsResponse.data) ? userPatternsResponse.data : [];
            console.log(`✅ [SMS Service] Fetched ${userPatterns.length} user patterns from backend`);
          } else {
            console.warn('⚠️ [SMS Service] User patterns response was not successful:', userPatternsResponse);
          }
        } catch (userPatternsError: any) {
          console.error('❌ [SMS Service] Error fetching user patterns:', {
            message: userPatternsError.message,
            response: userPatternsError.response?.data,
            status: userPatternsError.response?.status,
          });
          // Continue - we can still use institution patterns
        }
        
        // Fetch institution patterns from backend (optional - app works with user patterns only)
        const { institutionPatternsAPI } = await import('./api');
        try {
          const institutionResponse = await institutionPatternsAPI.getCountryPatterns(countryCode);
          if (institutionResponse.success && institutionResponse.data) {
            const rawPatterns = Array.isArray(institutionResponse.data) ? institutionResponse.data : [];
            // Map backend InstitutionPattern to mobile app format (add name field)
            institutionPatterns = rawPatterns.map((p: any) => ({
              ...p,
              name: p.name || p.institution || p.bank || 'Institution Pattern',
            }));
            console.log(`✅ [SMS Service] Fetched ${institutionPatterns.length} institution patterns from backend`);
          }
        } catch (institutionPatternsError: any) {
          // Silently fail - app continues with user patterns only
          // Institution patterns are optional and may not be available for all countries
        }
        
        console.log(`📋 [SMS Service] User patterns: ${userPatterns.length}, Institution patterns: ${institutionPatterns.length}`);
      } catch (error: any) {
        console.error('❌ [SMS Service] Unexpected error fetching patterns:', {
          message: error.message,
          stack: error.stack,
          response: error.response?.data,
          status: error.response?.status,
        });
        // Continue with whatever patterns we managed to load (might be empty arrays)
      }
      
      // Combine user patterns and institution patterns
      // Convert user patterns to InstitutionPattern format
      const userInstitutionPatterns: InstitutionPattern[] = userPatterns.map((p: any) => ({
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
      }));
      
      // Combine all patterns (user patterns first, then institution patterns)
      const patterns = [...userInstitutionPatterns, ...institutionPatterns];
      
      console.log(`📋 [SMS Service] Total patterns loaded: ${patterns.length}`, {
        userPatterns: userInstitutionPatterns.length,
        institutionPatterns: institutionPatterns.length,
        patternNames: patterns.map(p => p.name).slice(0, 5),
        samplePattern: patterns[0] ? {
          id: patterns[0].id,
          name: patterns[0].name,
          institution: patterns[0].institution,
          hasRegex: !!patterns[0].regex,
          regexPreview: patterns[0].regex?.substring(0, 80),
          extractFields: patterns[0].extractFields,
        } : null,
      });

      if (patterns.length === 0) {
        console.warn('⚠️ [SMS Service] No patterns available - SMS will be read but not matched');
        console.warn('⚠️ [SMS Service] This means SMS matching will not work.');
        console.warn('⚠️ [SMS Service] Please ensure:');
        console.warn('   1. You have completed onboarding');
        console.warn('   2. You have signed in');
        console.warn('   3. Patterns exist for your country');
        console.warn('⚠️ [SMS Service] Continuing to read SMS anyway for debugging...');
        // Don't return - continue to read SMS even without patterns so we can see what's happening
      }
      
      console.log(`📋 [SMS Service] Loaded ${patterns.length} patterns (${userInstitutionPatterns.length} user, ${institutionPatterns.length} institution)`);
      
      // Log pattern details for debugging
      // console.log(`📋 [SMS Service] Using ${patterns.length} patterns for matching:`, 
      //   patterns.map(p => ({
      //     id: p.id?.substring(0, 8),
      //     name: p.name,
      //     institution: p.institution,
      //     hasRegex: !!p.regex,
      //   }))
      // );

      // Read recent SMS (last 20 messages to catch more)
      try {
        const { readSMSMessages } = await import('../utils/smsReader');
        console.log('📱 [SMS Service] Attempting to read SMS messages...');
        console.log('📱 [SMS Service] Processed SMS IDs count:', this.processedSMSIds.size);
        console.log('📱 [SMS Service] Last processed SMS ID:', this.lastProcessedSMSId);
        
        const smsMessages = await readSMSMessages(20);
        
        console.log(`📱 [SMS Service] Read ${smsMessages?.length || 0} SMS messages`);
        
        if (!smsMessages || smsMessages.length === 0) {
          console.warn('⚠️ [SMS Service] No SMS messages found. This could mean:');
          console.warn('   1. No SMS messages in inbox');
          console.warn('   2. Permission not granted');
          console.warn('   3. Native module not properly linked');
          console.warn('   4. Error reading SMS (check logs above)');
          return;
        }
        
        console.log(`📱 [SMS Service] Checking ${smsMessages.length} SMS messages against ${patterns.length} patterns`);

        // Process each SMS - try to match against patterns
        let processedCount = 0;
        let skippedOld = 0;
        let skippedAlreadyProcessed = 0;
        
        for (const sms of smsMessages) {
          // Skip if already processed (check both last ID and set)
          if (this.processedSMSIds.has(sms.id)) {
            skippedAlreadyProcessed++;
            continue;
          }

          // Skip SMS received before installation (Requirement #2)
          if (this.installationDate) {
            const smsDate = new Date(sms.date);
            if (smsDate < this.installationDate) {
              skippedOld++;
              // Still mark as processed to avoid checking again
              this.processedSMSIds.add(sms.id);
              continue;
            }
          }

          console.log(`🔍 [SMS Service] Checking SMS ${sms.id}:`, {
            preview: sms.body.substring(0, 100),
            address: sms.address,
            date: new Date(sms.date).toISOString(),
            patternsCount: patterns.length,
          });
          
          const result = await this.processSMS(sms, patterns);
          if (result) {
            processedCount++;
            console.log(`✅ [SMS Service] Successfully processed SMS ${sms.id} as transaction`);
            // Mark as processed
            this.processedSMSIds.add(sms.id);
            // Keep set size manageable (last 100)
            if (this.processedSMSIds.size > 100) {
              const firstId = Array.from(this.processedSMSIds)[0];
              this.processedSMSIds.delete(firstId);
            }
          } else {
            console.log(`⏭️ [SMS Service] SMS ${sms.id} did not match any pattern`);
          }
          this.lastProcessedSMSId = sms.id;
        }
        
        // Persist processed IDs after each batch (Requirement #3)
        await this.saveProcessedIds();
        
        if (skippedOld > 0) {
          console.log(`⏭️ [SMS Service] Skipped ${skippedOld} SMS from before installation`);
        }
        if (skippedAlreadyProcessed > 0) {
          console.log(`⏭️ [SMS Service] Skipped ${skippedAlreadyProcessed} already processed SMS`);
        }
        if (processedCount > 0) {
          console.log(`✅ [SMS Service] Processed ${processedCount} new transaction(s)`);
        } else {
          console.log(`ℹ️ [SMS Service] No new transactions found in this check`);
        }
      } catch (importError: any) {
        console.error('❌ [SMS Service] Error importing or using SMS reader:', importError);
        console.error('❌ [SMS Service] Error details:', {
          message: importError.message,
          stack: importError.stack,
          name: importError.name,
        });
        return;
      }
    } catch (error: any) {
      console.error('❌ [SMS Service] Error checking for new SMS:', error);
      console.error('❌ [SMS Service] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
  }

  /**
   * Process a single SMS message
   */
  private async processSMS(sms: any, patterns: InstitutionPattern[]): Promise<boolean> {
    try {
      // Find matching pattern
      console.log(`🔍 [SMS Service] Attempting to match SMS against ${patterns.length} patterns...`);
      const matchResult = this.findMatchingPattern(sms.body, patterns, sms.address);
      if (!matchResult.matched || !matchResult.data) {
        console.log('❌ [SMS Service] No pattern matched for SMS:', {
          preview: sms.body.substring(0, 150),
          patternsCount: patterns.length,
          hasPatterns: patterns.length > 0,
          patternNames: patterns.map(p => p.name).slice(0, 5),
        });
        return false;
      }
      
      console.log('✅ [SMS Service] Pattern matched!', {
        patternName: matchResult.data.patternName,
        txnId: matchResult.data.txnId,
        amount: matchResult.data.amount,
        sender: matchResult.data.sender,
      });
      
      console.log('✅ [SMS Service] Pattern matched!', {
        txnId: matchResult.data.txnId,
        amount: matchResult.data.amount,
        pattern: matchResult.data.patternName,
      });
      
      // Only track deposits (positive amounts), skip withdrawals
      if (matchResult.data.amount <= 0) {
        console.log('⏭️ [SMS Service] Skipping withdrawal transaction (only tracking deposits):', {
          amount: matchResult.data.amount,
          txnId: matchResult.data.txnId,
        });
        return false;
      }

      // Extract sender name - prefer extracted sender, then try to parse from SMS, then sendFrom, then bank name
      let senderName = matchResult.data.sender || '';
      
      // If sender is empty, try to extract from SMS text directly
      if (!senderName || senderName === '') {
        const smsTextLower = sms.body;
        // Try common patterns to extract sender name
        const senderPatterns = [
          // "from NAME (phone)" or "from NAME"
          /from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
          // "received ... from NAME"
          /received\s+.*?from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
          // "credited ... from NAME"
          /credited\s+.*?from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on\s+|\s+at\s+|,|\.|$)/i,
        ];
        
        for (const pattern of senderPatterns) {
          const match = smsTextLower.match(pattern);
          if (match && match[1]) {
            senderName = match[1].trim();
            console.log('📝 [SMS Service] Extracted sender from SMS text:', senderName);
            break;
          }
        }
      }
      
      if (!senderName && matchResult.data.sendFrom) {
        senderName = matchResult.data.sendFrom;
      }
      if (!senderName && matchResult.data.bank) {
        senderName = matchResult.data.bank;
      }
      
      // Mask phone number if it looks like a phone number, otherwise use as-is
      const maskedSender = senderName 
        ? (senderName.match(/^\d+$/) ? maskPhone(senderName) : senderName)
        : matchResult.data.bank || 'Unknown';

      // Create transaction object with improved detail extraction
      const transaction: LocalTransaction = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        txnId: matchResult.data.txnId,
        amount: matchResult.data.amount, // Already positive (deposits only)
        sender: maskedSender,
        sendFrom: matchResult.data.sendFrom || null,
        sendTo: matchResult.data.sendTo || null,
        bank: matchResult.data.bank || matchResult.data.patternName || null,
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
      // console.log('🔑 [SMS Service] Authentication check:', {
      //   hasToken: !!token,
      //   tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
      // });
      
      if (token) {
        console.log('🔄 [SMS Service] Attempting to sync transaction to backend...', {
          txnId: transaction.txnId,
          amount: transaction.amount,
          sender: transaction.sender,
        });
        try {
          await this.syncTransactionToBackend(transaction);
          console.log('✅ [SMS Service] Transaction synced successfully:', transaction.txnId);
        } catch (syncError: any) {
          // Sync failed, but don't break SMS processing
          // Transaction is saved locally and will be synced later
          console.error('❌ [SMS Service] Failed to sync transaction (will retry later):', {
            txnId: transaction.txnId,
            error: syncError.message || syncError.response?.data?.error || 'Unknown error',
            status: syncError.response?.status,
            response: syncError.response?.data,
          });
          // Transaction remains unsynced, will be retried on manual sync
        }
      } else {
        console.warn('⚠️ [SMS Service] No authentication token found - transaction will not be synced to backend');
        console.warn('⚠️ [SMS Service] User needs to sign in to sync transactions');
      }

      // console.log('✅ [SMS Service] Transaction processed:', transaction.txnId);
      return true;
    } catch (error) {
      // console.error('❌ [SMS Service] Error processing SMS:', error);
      return false;
    }
  }

  /**
   * Find matching pattern for SMS (only uses backend patterns)
   */
  private findMatchingPattern(
    smsText: string, 
    patterns: InstitutionPattern[], 
    senderAddress?: string
  ): { matched: boolean; data?: any } {
    // Use findMatchingInstitutionPattern from patternMatcher which only uses backend patterns
    const { findMatchingInstitutionPattern } = require('../utils/patternMatcher');
    const result = findMatchingInstitutionPattern(smsText, patterns, senderAddress);
    
    if (result.matched && result.data) {
      return result;
    }
    
    return { matched: false };
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
   * Sync transaction to backend (uses API key or JWT token authentication)
   */
  private async syncTransactionToBackend(transaction: LocalTransaction): Promise<void> {
    try {
      // Check for both API key and JWT token
      const token = await storage.getToken();
      const apiKey = await storage.getApiKey();
      
      if (!token && !apiKey) {
        console.warn('⚠️ [SMS Service] No authentication available (neither token nor API key), cannot sync transaction');
        throw new Error('No authentication available. Please sign in or set API key.');
      }
      
      console.log('🔄 [SMS Service] Syncing transaction to backend:', {
        txnId: transaction.txnId,
        amount: transaction.amount,
        bank: transaction.bank,
        hasToken: !!token,
        hasApiKey: !!apiKey,
        authMethod: apiKey ? 'API-Key' : 'JWT',
      });
      
      // Don't send ICCID - backend doesn't require it for JWT auth
      // Ensure sender is not empty (required by backend)
      const sender = transaction.sender?.trim() || transaction.bank || 'Unknown';
      
      const payload: any = {
        txnId: transaction.txnId,
        amount: transaction.amount,
        sender: sender, // Required - must not be empty
        sendFrom: transaction.sendFrom || null,
        sendTo: transaction.sendTo || null,
        bank: transaction.bank || '',
        pattern: transaction.pattern || 'SMS Pattern',
        smsText: transaction.smsText,
        source: 'SMS', // Mark as SMS source
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
      const errorCode = error.code;
      
      console.error('❌ [SMS Service] Error syncing transaction to backend:', {
        txnId: transaction.txnId,
        error: errorMessage,
        status: errorStatus,
        code: errorCode,
        response: error.response?.data,
        hasToken: !!await storage.getToken(),
        hasApiKey: !!await storage.getApiKey(),
      });
      
      // Provide more specific error messages
      if (errorStatus === 401) {
        const authError = error.response?.data?.error || '';
        if (authError.includes('API key') || authError.includes('api key')) {
          console.error('🔒 [SMS Service] Authentication failed - API key required or invalid');
          console.error('   The /ingest endpoint requires a valid API key');
        } else {
          console.error('🔒 [SMS Service] Authentication failed - JWT token may be expired or invalid');
        }
      } else if (errorStatus === 400) {
        console.error('📋 [SMS Service] Validation error - check transaction payload format');
        console.error('   Response:', error.response?.data);
      } else if (errorCode === 'ERR_NETWORK' || errorCode === 'ECONNREFUSED') {
        console.error('🌐 [SMS Service] Network error - cannot reach backend server');
      }
      
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
      // console.warn('⚠️ [SMS Service] No authentication token, skipping sync');
      // console.warn('⚠️ [SMS Service] User needs to sign in to sync transactions');
      throw new Error('No authentication token. Please sign in to sync transactions.');
    }

    const transactions = await this.getLocalTransactions();
    const unsynced = transactions.filter(t => !t.synced);

    if (unsynced.length === 0) {
      // console.log('✅ [SMS Service] No unsynced transactions to sync');
      return;
    }

    // console.log(`🔄 [SMS Service] Syncing ${unsynced.length} unsynced transactions...`);

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
        const errorStatus = error.response?.status;
        const errorCode = error.code;
        
        // Build detailed error message
        let detailedError = `${transaction.txnId}: ${errorMsg}`;
        if (errorStatus) {
          detailedError += ` (HTTP ${errorStatus})`;
        }
        if (errorCode === 'ERR_NETWORK' || errorCode === 'ECONNREFUSED') {
          detailedError += ' [Network Error]';
        }
        
        errors.push(detailedError);
        console.error(`❌ [SMS Service] Failed to sync transaction ${transaction.txnId}:`, {
          error: errorMsg,
          status: errorStatus,
          code: errorCode,
          txnId: transaction.txnId,
          amount: transaction.amount,
          bank: transaction.bank,
        });
      }
    }

    console.log(`✅ [SMS Service] Sync complete: ${successCount} succeeded, ${failCount} failed`);
    
    if (failCount > 0) {
      // Log detailed error information for debugging
      console.warn('⚠️ [SMS Service] Some transactions failed to sync:', {
        failedCount: failCount,
        totalCount: unsynced.length,
        errors: errors.slice(0, 5), // Show first 5 errors
        message: `${failCount} of ${unsynced.length} transaction(s) failed to sync`,
      });
      
      // Provide more detailed error message
      const errorSummary = errors.slice(0, 3).join('; ');
      const remainingErrors = errors.length > 3 ? ` and ${errors.length - 3} more` : '';
      throw new Error(`${failCount} transaction(s) failed to sync${remainingErrors}. ${errorSummary}`);
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
   * Test pattern matching with a specific SMS text (for debugging)
   */
  async testPatternMatching(smsText: string): Promise<{
    matched: boolean;
    pattern?: string;
    extracted?: any;
    error?: string;
  }> {
    try {
      const countryCode = await storage.getCountryCode();
      const token = await storage.getToken();
      
      if (!countryCode || !token) {
        return {
          matched: false,
          error: 'No country code or token',
        };
      }

      // Fetch patterns
      const { patternsAPI } = await import('./api');
      const { institutionPatternsAPI } = await import('./api');
      
      const userPatternsResponse = await patternsAPI.getAll();
      const userPatterns = userPatternsResponse.success && userPatternsResponse.data 
        ? (Array.isArray(userPatternsResponse.data) ? userPatternsResponse.data : [])
        : [];
      
      // Fetch institution patterns (optional - app works with user patterns only)
      let institutionPatterns: any[] = [];
      try {
        const institutionResponse = await institutionPatternsAPI.getCountryPatterns(countryCode);
        if (institutionResponse.success && institutionResponse.data) {
          institutionPatterns = Array.isArray(institutionResponse.data) ? institutionResponse.data : [];
        }
      } catch (error) {
        // Silently fail - app continues with user patterns only
      }

      const userInstitutionPatterns: InstitutionPattern[] = userPatterns.map((p: any) => ({
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
      }));

      const allPatterns = [
        ...userInstitutionPatterns,
        ...institutionPatterns.map((p: any) => ({
          ...p,
          name: p.name || p.institution || p.bank || 'Institution Pattern',
        })),
      ];

      console.log(`🧪 [SMS Service] Testing SMS against ${allPatterns.length} patterns`);
      
      const matchResult = this.findMatchingPattern(smsText, allPatterns);
      
      if (matchResult.matched && matchResult.data) {
        return {
          matched: true,
          pattern: matchResult.pattern?.name,
          extracted: matchResult.data,
        };
      }

      return {
        matched: false,
        error: 'No pattern matched',
      };
    } catch (error: any) {
      return {
        matched: false,
        error: error.message,
      };
    }
  }

  /**
   * Reset processed SMS IDs (for testing - allows re-processing same SMS)
   */
  resetProcessedSMS(): void {
    this.processedSMSIds.clear();
    this.lastProcessedSMSId = null;
    // console.log('🔄 [SMS Service] Reset processed SMS IDs');
  }
}

// Export singleton instance
export const smsService = new SMSService();

