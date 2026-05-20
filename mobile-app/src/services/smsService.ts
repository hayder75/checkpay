/**
 * SMS Monitoring Service
 * Monitors incoming SMS in real-time and extracts transactions
 */

import { Platform, AppState, AppStateStatus, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { storage } from './storage';
import { matchInstitutionPattern, InstitutionPattern } from '../utils/patternMatcher';
import { maskPhone } from '../utils/maskPhone';
import { ingestTransaction } from './api';
import { installationService } from './installation';
import { log } from '../utils/logger';
import { dedupeTransactionsByIdentity, normalizeTxnId } from '../utils/transactionDedup';
import { getCapturedNotifications, isNotificationAccessEnabled } from '../utils/notificationListener';
// Patterns are now always fetched from backend, no local caching

interface CapturedNotification {
  id: string;
  packageName: string;
  title: string;
  text: string;
  subText?: string;
  postedAt: number;
}

const SMS_NOTIFICATION_PACKAGES = new Set([
  'com.google.android.apps.messaging',
  'com.android.mms',
  'com.samsung.android.messaging',
  'com.miui.mms',
  'com.huawei.message',
  'com.coloros.mms',
  'com.oppo.message',
  'com.vivo.messaging',
  'com.transsion.message',
]);

const NON_SMS_MESSAGING_PACKAGES = [
  'org.telegram',
  'com.whatsapp',
  'com.facebook.orca',
  'com.instagram',
  'com.twitter',
  'com.discord',
  'com.snapchat',
  'com.skype',
  'com.google.android.gm',
  'com.microsoft.office.outlook',
];

const FINANCIAL_SIGNAL_KEYWORDS = [
  'credited',
  'deposited',
  'deposit',
  'received',
  'transferred',
  'txn',
  'transaction',
  'balance',
  'birr',
  'etb',
  'acct',
  'account',
  'ref',
  'payment',
];

const MAX_NOTIFICATION_SENDER_LENGTH = 40;
const NOTIFICATION_MAX_AGE_MS = 5 * 60 * 1000;
const NOTIFICATION_MAX_FUTURE_SKEW_MS = 30 * 1000;
const NOTIFICATION_SECURITY_AUDIT_KEY = 'notification_security_audit_log';
const MAX_NOTIFICATION_SECURITY_AUDIT_ITEMS = 500;

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
  source?: 'SMS' | 'NOTIFICATION';
  receivedAt: string;
  synced: boolean; // Whether synced to backend
  isValidated?: boolean; // Whether verified via OCR or manual entry
  createdAt: string;
}

class SMSService {
  private isMonitoring: boolean = false;
  private lastProcessedSMSId: string | null = null;
  private processedSMSIds: Set<string> = new Set(); // Track all processed SMS IDs
  private lastProcessedTimestamp: number | null = null; // Track last processed SMS timestamp
  private appState: AppStateStatus = AppState.currentState;
  private checkInterval: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null; // Subscription for AppState changes
  private lastSyncTime: number = 0;
  private syncInProgress: boolean = false;
  private lastPackageNoticeAt: number = 0;
  private installationDate: Date | null = null; // Cache installation date
  private stateLoaded: boolean = false;

  private async sendTransactionDetectedNotification(transaction: LocalTransaction): Promise<void> {
    // Keep this best-effort only. Transaction capture should not fail because of notifications.
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Transaction Detected',
          body: `${transaction.amount.toLocaleString()} ETB from ${transaction.sender}`,
          data: {
            type: 'TRANSACTION_RECEIVED',
            txnId: transaction.txnId,
            source: transaction.source || 'SMS',
          },
        },
        trigger: null,
      });
    } catch (error) {
      log.warn('SMS Service', 'Failed to show local transaction notification', error);
    }
  }

  private notifyPackageLimit(errorMessage: string): void {
    const now = Date.now();
    if (now - this.lastPackageNoticeAt < 120000) {
      return;
    }
    this.lastPackageNoticeAt = now;

    const appState = require('react-native').AppState?.currentState;
    if (appState && appState !== 'active') {
      return;
    }

    Alert.alert(
      'Package Limit Reached',
      errorMessage || 'Phone sync credits for the active package are exhausted. New SMS will be stored locally and will sync after package credits are available.'
    );
  }

  /**
   * Load persisted state from storage (processed SMS IDs and timestamp)
   */
  private async loadPersistedState(): Promise<void> {
    if (this.stateLoaded) return;
    
    try {
      // Load processed SMS IDs
      const persistedIds = await storage.getProcessedSMSIds();
      this.processedSMSIds = new Set(persistedIds);
      
      // Load last processed timestamp for gap-free resumption
      this.lastProcessedTimestamp = await storage.getLastProcessedSMSTimestamp();
      
      // Load installation date
      this.installationDate = await installationService.getInstallationDate();
      
      log.info('SMS Service', `Loaded ${persistedIds.length} processed IDs`, {
        installDate: this.installationDate?.toISOString(),
        lastProcessedTimestamp: this.lastProcessedTimestamp ? new Date(this.lastProcessedTimestamp).toISOString() : null,
      });
      this.stateLoaded = true;
    } catch (error) {
      log.error('SMS Service', 'Error loading persisted state', error);
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
   * Start monitoring transaction notifications
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('✅ [SMS Service] Notification monitoring already started');
      return;
    }

    if (Platform.OS !== 'android') {
      console.warn('⚠️ [SMS Service] Notification monitoring only supported on Android');
      return;
    }

    // Check if user has completed onboarding
    const onboardingCompleted = await storage.getOnboardingCompleted();
    if (!onboardingCompleted) {
      console.log('⚠️ [SMS Service] Onboarding not completed, skipping monitoring');
      return;
    }

    // Notification access is mandatory for auto-capture.
    try {
      const hasNotificationAccess = await isNotificationAccessEnabled();
      if (!hasNotificationAccess) {
        log.warn('SMS Service', 'Notification access not enabled, monitoring remains inactive');
        return;
      }
    } catch (error) {
      log.error('SMS Service', 'Error checking notification access', error);
      return;
    }

    this.isMonitoring = true;
      log.info('SMS Service', 'Starting notification monitoring');

    // Load persisted state (processed IDs, installation date)
    await this.loadPersistedState();

    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Start periodic checking (every 5 seconds when app is active)
    this.startPeriodicCheck();

    // Initial check
    await this.checkForNewSMS();
    
    // Sync any unsynced transactions
    this.syncAllUnsyncedTransactions().catch(err => console.error('❌ [SMS Service] Initial sync failed:', err));
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
      this.syncAllUnsyncedTransactions().catch(err => console.error('❌ [SMS Service] Foreground sync failed:', err));
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
    await this.processCapturedNotifications();
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
        
        // Also sync unsynced transactions periodically
        // We do this every 30 seconds (every 6th check) to avoid overwhelming the server
        const now = Date.now();
        if (!this.lastSyncTime || now - this.lastSyncTime > 30000) {
          this.lastSyncTime = now;
          this.syncAllUnsyncedTransactions().catch(err => console.error('❌ [SMS Service] Periodic sync failed:', err));
        }
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

  private async loadTargetPatterns(countryCode?: string | null): Promise<InstitutionPattern[]> {
    const { patternsAPI, institutionPatternsAPI } = await import('./api');

    let userPatterns: any[] = [];
    let institutionPatterns: any[] = [];

    try {
      const userPatternsResponse = await patternsAPI.getAll();
      if (userPatternsResponse.success && userPatternsResponse.data) {
        userPatterns = Array.isArray(userPatternsResponse.data) ? userPatternsResponse.data : [];
      }
    } catch (error) {
      log.warn('SMS Service', 'Failed loading user patterns for notifications', error);
    }

    if (countryCode) {
      try {
        const institutionResponse = await institutionPatternsAPI.getCountryPatterns(countryCode);
        if (institutionResponse.success && institutionResponse.data) {
          const rawPatterns = Array.isArray(institutionResponse.data) ? institutionResponse.data : [];
          institutionPatterns = rawPatterns.map((p: any) => ({
            ...p,
            name: p.name || p.institution || p.bank || 'Institution Pattern',
          }));
        }
      } catch {
        // Optional source.
      }
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
      allowedSenders: p.allowedSenders || null,
      requireSenderVerification: p.requireSenderVerification !== false,
      senderVerificationMode: p.senderVerificationMode || 'STRICT',
      maxAmountThreshold: p.maxAmountThreshold || null,
      requireContactCheck: p.requireContactCheck !== false,
    }));

    let merged = [...userInstitutionPatterns, ...institutionPatterns];

    if (merged.length === 0) {
      const localPatterns = await storage.getInstitutionPatterns();
      merged = Array.isArray(localPatterns) ? localPatterns : [];
    }

    return merged;
  }

  private buildNotificationBodies(notification: CapturedNotification): string[] {
    const textOnly = (notification.text || '').replace(/\s+/g, ' ').trim();
    const withSubText = [notification.text, notification.subText]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const fullCombined = [notification.title, notification.text, notification.subText]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return Array.from(new Set([textOnly, withSubText, fullCombined].filter(Boolean)));
  }

  private normalizeSenderValue(value: string): string {
    return String(value || '')
      .trim()
      .replace(/[\s\-()]/g, '')
      .replace(/^\+/, '')
      .toUpperCase();
  }

  private extractNotificationSenderHint(notification: CapturedNotification, body: string): string {
    const cleanText = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim();
    const title = cleanText(notification.title || '');
    const subText = cleanText(notification.subText || '');
    const content = cleanText(body || '');

    const candidates = [subText, title];
    for (const candidate of candidates) {
      if (candidate && candidate.length <= MAX_NOTIFICATION_SENDER_LENGTH) {
        return candidate;
      }
    }

    const fromMatch = content.match(/\bfrom\s+([A-Za-z0-9_\-]{3,20})\b/i);
    if (fromMatch && fromMatch[1]) {
      return fromMatch[1];
    }

    return '';
  }

  private isAllowedSenderForNotification(pattern: InstitutionPattern, senderHint: string): boolean {
    const allowedSenders = Array.isArray((pattern as any).allowedSenders)
      ? ((pattern as any).allowedSenders as string[]).filter((item) => !!String(item || '').trim())
      : [];

    // For notification-origin events we require explicit sender allowlists.
    if (!allowedSenders.length || !senderHint) {
      return false;
    }

    const normalizedHint = this.normalizeSenderValue(senderHint);
    if (!normalizedHint) {
      return false;
    }

    return allowedSenders.some((allowed) => {
      const normalizedAllowed = this.normalizeSenderValue(allowed);
      if (!normalizedAllowed) {
        return false;
      }

      if (normalizedHint === normalizedAllowed) {
        return true;
      }

      return normalizedAllowed.length >= 3 && normalizedHint.includes(normalizedAllowed);
    });
  }

  private isSmsNotificationPackage(packageName: string): boolean {
    const normalized = packageName.toLowerCase();
    if (!normalized) {
      return false;
    }

    if (NON_SMS_MESSAGING_PACKAGES.some((blocked) => normalized.includes(blocked))) {
      return false;
    }

    if (SMS_NOTIFICATION_PACKAGES.has(normalized)) {
      return true;
    }

    // Avoid package-name heuristics because they are spoofable by fraudulent apps.
    return false;
  }

  private isTargetNotification(notification: CapturedNotification): boolean {
    const packageName = (notification.packageName || '').toLowerCase();
    if (!this.isSmsNotificationPackage(packageName)) {
      return false;
    }

    // Package is trusted by allowlist. Keep notifications that include some message content.
    const haystack = `${notification.title || ''} ${notification.text || ''} ${notification.subText || ''}`.toLowerCase();
    return haystack.length > 0;
  }

  private hasFinancialSignals(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    if (!normalized) {
      return false;
    }

    const hasKeyword = FINANCIAL_SIGNAL_KEYWORDS.some((keyword) => normalized.includes(keyword));
    const hasAmount = /(\d{2,}[\d,]*(?:\.\d{1,2})?\s*(?:birr|etb|br))/i.test(normalized);
    const hasTxnRef = /(txn|trx|transaction|ref)\s*[:#-]?\s*[a-z0-9-]{4,}/i.test(normalized);

    return hasKeyword || hasAmount || hasTxnRef;
  }

  private async storeFailedNotificationRequest(notification: CapturedNotification): Promise<void> {
    const key = 'pending_notification_verify_requests';
    const raw = await storage.getItem(key);
    const existing = raw ? JSON.parse(raw) : [];

    existing.unshift({
      id: notification.id,
      source: 'NOTIFICATION',
      packageName: notification.packageName,
      title: notification.title,
      text: notification.text,
      receivedAt: new Date(notification.postedAt || Date.now()).toISOString(),
      status: 'pending_manual_review',
    });

    await storage.setItem(key, JSON.stringify(existing.slice(0, 300)));
  }

  private isNotificationTimestampTrusted(timestamp: number): boolean {
    const now = Date.now();
    const age = now - timestamp;
    return age >= -NOTIFICATION_MAX_FUTURE_SKEW_MS && age <= NOTIFICATION_MAX_AGE_MS;
  }

  private async storeNotificationSecurityAudit(entry: {
    notification: CapturedNotification;
    reason: string;
    senderHint?: string;
    patternName?: string;
  }): Promise<void> {
    try {
      const raw = await storage.getItem(NOTIFICATION_SECURITY_AUDIT_KEY);
      const existing = raw ? JSON.parse(raw) : [];

      const nextEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        capturedId: entry.notification.id,
        packageName: entry.notification.packageName,
        senderHint: entry.senderHint || null,
        patternName: entry.patternName || null,
        reason: entry.reason,
        postedAt: entry.notification.postedAt || 0,
        auditedAt: new Date().toISOString(),
        preview: String(entry.notification.text || '').slice(0, 160),
      };

      existing.unshift(nextEntry);
      await storage.setItem(
        NOTIFICATION_SECURITY_AUDIT_KEY,
        JSON.stringify(existing.slice(0, MAX_NOTIFICATION_SECURITY_AUDIT_ITEMS))
      );
    } catch (error) {
      log.warn('SMS Service', 'Failed to persist notification security audit', error);
    }
  }

  private async processCapturedNotifications(): Promise<void> {
    try {
      const countryCode = await storage.getCountryCode();
      const token = await storage.getToken();
      if (!token) {
        return;
      }

      const notifications = await getCapturedNotifications();
      if (!notifications.length) {
        return;
      }

      const patterns = await this.loadTargetPatterns(countryCode);
      if (!patterns.length) {
        log.warn('SMS Service', 'No patterns available for notification parsing');
        return;
      }

      const sorted = [...notifications].sort((a, b) => (a.postedAt || 0) - (b.postedAt || 0));

      for (const notification of sorted) {
        if (!this.isTargetNotification(notification)) {
          await this.storeNotificationSecurityAudit({
            notification,
            reason: 'rejected_untrusted_or_non_sms_package',
          });
          continue;
        }

        if (this.processedSMSIds.has(notification.id)) {
          continue;
        }

        const bodies = this.buildNotificationBodies(notification);
        if (!bodies.length) {
          this.processedSMSIds.add(notification.id);
          continue;
        }

        const financialBodies = bodies.filter((body) => this.hasFinancialSignals(body));
        if (!financialBodies.length) {
          this.processedSMSIds.add(notification.id);
          continue;
        }

        let processed = false;
        let attemptedFinancialParse = false;
        const notificationTimestamp = notification.postedAt || Date.now();

        if (!this.isNotificationTimestampTrusted(notificationTimestamp)) {
          await this.storeNotificationSecurityAudit({
            notification,
            reason: 'rejected_stale_or_invalid_timestamp',
          });
          this.processedSMSIds.add(notification.id);
          continue;
        }

        for (const body of financialBodies) {
          attemptedFinancialParse = true;

          const senderHint = this.extractNotificationSenderHint(notification, body);
          if (!senderHint) {
            log.warn('SMS Service', 'Rejecting notification: no sender hint', {
              notificationId: notification.id,
              packageName: notification.packageName,
            });
            await this.storeNotificationSecurityAudit({
              notification,
              reason: 'rejected_missing_sender_hint',
            });
            continue;
          }

          const preMatch = this.findMatchingPattern(body, patterns, senderHint);
          if (!preMatch.matched || !preMatch.pattern) {
            await this.storeNotificationSecurityAudit({
              notification,
              reason: 'no_pattern_match_for_financial_body',
              senderHint,
            });
            continue;
          }

          if (!this.isAllowedSenderForNotification(preMatch.pattern, senderHint)) {
            log.warn('SMS Service', 'Rejecting notification: sender not allowlisted for pattern', {
              notificationId: notification.id,
              senderHint,
              patternName: preMatch.pattern.name,
            });
            await this.storeNotificationSecurityAudit({
              notification,
              reason: 'rejected_sender_not_allowlisted',
              senderHint,
              patternName: preMatch.pattern.name,
            });
            continue;
          }

          const pseudoSMS = {
            id: notification.id,
            body,
            address: senderHint,
            date: notificationTimestamp,
          };

          processed = await this.processSMS(pseudoSMS, [preMatch.pattern], {
            source: 'NOTIFICATION',
          });

          if (processed) {
            break;
          }
        }

        if (!processed && attemptedFinancialParse) {
          await this.storeFailedNotificationRequest(notification);
        }

        this.processedSMSIds.add(notification.id);
        if (!this.lastProcessedTimestamp || notificationTimestamp > this.lastProcessedTimestamp) {
          this.lastProcessedTimestamp = notificationTimestamp;
        }
      }

      await this.saveProcessedIds();
      if (this.lastProcessedTimestamp) {
        await storage.setLastProcessedSMSTimestamp(this.lastProcessedTimestamp);
      }
    } catch (error) {
      log.error('SMS Service', 'Error processing captured notifications', error);
    }
  }

  /**
   * Check for new SMS and process them
   */
  private async checkForNewSMS(): Promise<void> {
    if (!this.isMonitoring) {
      console.log('⏸️ [SMS Service] Monitoring not active, skipping check');
      return;
    }

    await this.processCapturedNotifications();
  }

  /**
   * Process a single SMS message
   */
  private async processSMS(
    sms: any,
    patterns: InstitutionPattern[],
    options?: { source?: 'SMS' | 'NOTIFICATION' }
  ): Promise<boolean> {
    try {
      // Find matching pattern
      const matchResult = this.findMatchingPattern(sms.body, patterns, sms.address);
      if (!matchResult.matched || !matchResult.data) {
        log.warn('SMS Service', 'No pattern matched', {
          preview: sms.body.substring(0, 200),
          patternsCount: patterns.length,
          patternNames: patterns.map(p => p.name).slice(0, 3),
        });
        return false;
      }
      
      log.success('SMS Service', 'Pattern matched!', {
        pattern: matchResult.data.patternName,
        txnId: matchResult.data.txnId,
        amount: matchResult.data.amount,
        sender: matchResult.data.sender,
      });
      
      // Only track deposits (positive amounts), skip withdrawals
      if (matchResult.data.amount <= 0) {
        log.debug('SMS Service', 'Skipping withdrawal', {
          amount: matchResult.data.amount,
          txnId: matchResult.data.txnId,
        });
        return false;
      }

      // Verify sender, contact, timestamp and amount constraints.
      if (matchResult.pattern) {
        const { verifySMS } = await import('./smsVerification');
        const verification = await verifySMS(
          {
            address: sms.address,
            date: sms.date,
            body: sms.body,
          },
          matchResult.pattern,
          {
            amount: matchResult.data.amount,
            txnId: matchResult.data.txnId,
          },
          matchResult.confidence
        );
        
        // Check if verification passed
        if (!verification.valid) {
          log.warn('SMS Service', 'SMS verification failed', {
            txnId: matchResult.data.txnId,
            reasons: verification.reasons,
            confidence: verification.confidence,
            sender: sms.address,
            patternId: matchResult.pattern.id,
            patternName: matchResult.pattern.name,
            allowedSenders: (matchResult.pattern as any).allowedSenders,
            requireSenderVerification: (matchResult.pattern as any).requireSenderVerification,
          });
          console.warn('🚫 [SMS Service] SMS REJECTED - Verification failed:', {
            sender: sms.address,
            pattern: matchResult.pattern.name,
            reasons: verification.reasons,
            allowedSenders: (matchResult.pattern as any).allowedSenders,
          });
          return false;
        }
        
        // If requires review, log it but still process
        if (verification.requiresReview) {
          log.warn('SMS Service', 'SMS requires review', {
            txnId: matchResult.data.txnId,
            reasons: verification.reasons,
            confidence: verification.confidence,
          });
          // You might want to flag this transaction for manual review
        }
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
      // Use sms.address (actual SMS sender) for sendFrom to enable backend verification
      const transaction: LocalTransaction = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        txnId: matchResult.data.txnId,
        amount: matchResult.data.amount, // Already positive (deposits only)
        sender: maskedSender,
        sendFrom: sms.address || matchResult.data.sendFrom || null, // Use actual SMS sender address for verification
        sendTo: matchResult.data.sendTo || null,
        bank: matchResult.data.bank || matchResult.data.patternName || null,
        pattern: matchResult.data.patternName || 'Institution Pattern',
        smsText: options?.source === 'NOTIFICATION' ? '' : sms.body,
        source: options?.source || 'SMS',
        receivedAt: new Date(sms.date).toISOString(),
        synced: false,
        createdAt: new Date().toISOString(),
      };

      // Save to local storage
      const existingTransactions = await this.getLocalTransactions();
      const normalizedIncomingTxnId = normalizeTxnId(transaction.txnId);
      const isExistingTransaction = existingTransactions.some((t) => {
        const currentTxnId = normalizeTxnId(t.txnId);
        if (normalizedIncomingTxnId && currentTxnId) {
          return currentTxnId === normalizedIncomingTxnId;
        }
        return t.txnId === transaction.txnId;
      });

      await this.saveLocalTransaction(transaction);

      if (!isExistingTransaction) {
        await this.sendTransactionDetectedNotification(transaction);
      }

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
  ): { matched: boolean; data?: any; confidence?: number; pattern?: InstitutionPattern } {
    // Use findMatchingInstitutionPattern from patternMatcher which only uses backend patterns
    const { findMatchingInstitutionPattern } = require('../utils/patternMatcher');
    const result = findMatchingInstitutionPattern(smsText, patterns, senderAddress);
    
    if (result.matched && result.data) {
      return result;
    }
    
    return { matched: false, confidence: 0 };
  }

  /**
   * Save transaction to local storage
   */
  private async saveLocalTransaction(transaction: LocalTransaction): Promise<void> {
    const transactions = await this.getLocalTransactions();
    const incomingTxnId = normalizeTxnId(transaction.txnId);
    const normalizedIncoming = {
      ...transaction,
      txnId: incomingTxnId || transaction.txnId,
    };
    
    // Check if transaction already exists (normalized txnId first, then exact fallback)
    const existingIndex = transactions.findIndex((t) => {
      const currentTxnId = normalizeTxnId(t.txnId);
      if (incomingTxnId && currentTxnId) {
        return currentTxnId === incomingTxnId;
      }
      return t.txnId === transaction.txnId;
    });

    if (existingIndex >= 0) {
      // Update existing transaction
      transactions[existingIndex] = {
        ...transactions[existingIndex],
        ...normalizedIncoming,
      };
    } else {
      // Add new transaction
      transactions.unshift(normalizedIncoming); // Add to beginning
    }

    const dedupedTransactions = dedupeTransactionsByIdentity(transactions);

    // Keep only last 1000 transactions locally
    const limitedTransactions = dedupedTransactions.slice(0, 1000);
    
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
        pattern: transaction.pattern || (transaction.source === 'NOTIFICATION' ? 'Notification Pattern' : 'SMS Pattern'),
        source: transaction.source === 'NOTIFICATION' ? 'SMS' : (transaction.source || 'SMS'),
        ...(transaction.source !== 'NOTIFICATION' && transaction.smsText ? { smsText: transaction.smsText } : {}),
      };
      
      console.log('📤 [SMS Service] Sending payload:', {
        ...payload,
        smsText: payload.smsText ? payload.smsText.substring(0, 50) + '...' : undefined,
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

      const normalizedErrorMessage = String(errorMessage || '').toLowerCase();
      const isTokenExhausted = errorStatus === 403 && (
        normalizedErrorMessage.includes('out of credit') ||
        normalizedErrorMessage.includes('exhausted') ||
        normalizedErrorMessage.includes('limit reached') ||
        normalizedErrorMessage.includes('token')
      );
      const isPackageRestricted = errorStatus === 403 && normalizedErrorMessage.includes('package');

      // For expected package/token limits, store locally and notify user once (throttled).
      if (isTokenExhausted || isPackageRestricted) {
        const notice = 'Phone sync credits for the active package are exhausted. Transactions are saved locally and will sync after package credits are available.';
        this.notifyPackageLimit(notice);

        if (isTokenExhausted) {
          log.warn('SMS Service', 'Token exhausted - storing transaction locally', {
            txnId: transaction.txnId,
            errorMessage,
          });
          (transaction as any).tokenExhausted = true;
          (transaction as any).tokenExhaustedAt = new Date().toISOString();
        } else {
          log.warn('SMS Service', 'Package restriction - storing transaction locally', {
            txnId: transaction.txnId,
            errorMessage,
          });
          (transaction as any).packageRestricted = true;
          (transaction as any).packageRestrictedAt = new Date().toISOString();
        }

        await this.updateLocalTransaction(transaction);
        return;
      }
      
      console.error('❌ [SMS Service] Error syncing transaction to backend:', {
        txnId: transaction.txnId,
        error: errorMessage,
        status: errorStatus,
        code: errorCode,
        response: error.response?.data,
        hasToken: !!await storage.getToken(),
        hasApiKey: !!await storage.getApiKey(),
      });
      
      // Handle other 403 responses
      if (errorStatus === 403) {
        console.error('🚫 [SMS Service] Access forbidden - check business permissions');
      }
      
      // Provide more specific error messages for other errors
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
    if (this.syncInProgress) {
      return;
    }

    const token = await storage.getToken();
    if (!token) {
      // User may not be logged in yet (or just logged out). Skip background sync quietly.
      return;
    }

    this.syncInProgress = true;

    try {

      const transactions = await this.getLocalTransactions();
      const unsyncedCandidates = transactions.filter(
        (t: any) => !t.synced && !t.tokenExhausted && !t.packageRestricted
      );
      const unsynced = dedupeTransactionsByIdentity(unsyncedCandidates);

      if (unsynced.length === 0) {
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
        console.warn('⚠️ [SMS Service] Some transactions failed to sync:', {
          failedCount: failCount,
          totalCount: unsynced.length,
          errors: errors.slice(0, 5),
          message: `${failCount} of ${unsynced.length} transaction(s) failed to sync`,
        });
      }
    } finally {
      this.syncInProgress = false;
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
          pattern: matchResult.data.patternName,
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
    this.lastProcessedTimestamp = null;
    // Also clear from storage
    storage.setProcessedSMSIds([]).catch(() => {});
    storage.removeItem('last_processed_sms_timestamp').catch(() => {});
    // console.log('🔄 [SMS Service] Reset processed SMS IDs');
  }
}

// Export singleton instance
export const smsService = new SMSService();

