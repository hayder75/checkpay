import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../config';
import { Pattern } from '../types';
import { log } from '../utils/logger';

/**
 * Secure storage service
 * Uses expo-secure-store for sensitive data (tokens, API keys)
 * Uses AsyncStorage for non-sensitive data
 */
export const storage = {
  // JWT Token (stored in secure storage)
  async getToken(): Promise<string | null> {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
      if (token) {
        log.debug('Storage', 'Token retrieved', { hasToken: true });
      } else {
        log.debug('Storage', 'No token found in storage');
      }
      return token;
    } catch (error) {
      log.error('Storage', 'Error getting token', error);
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
      log.debug('Storage', 'Token saved', { hasToken: true });
    } catch (error) {
      log.error('Storage', 'Error saving token', error);
      throw error;
    }
  },

  async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
      log.debug('Storage', 'Token removed');
    } catch (error) {
      log.error('Storage', 'Error removing token', error);
    }
  },

  // User Data (stored in AsyncStorage - non-sensitive)
  async getUser(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (data) {
        const user = JSON.parse(data);
        log.debug('Storage', 'User retrieved', { 
          username: user.username || user.phone || 'Unknown' 
        });
        return user;
      } else {
        log.debug('Storage', 'No user found in storage');
        return null;
      }
    } catch (error) {
      log.error('Storage', 'Error getting user', error);
      return null;
    }
  },

  async setUser(user: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      log.debug('Storage', 'User saved', { 
        username: user.username || user.phone || 'Unknown' 
      });
    } catch (error) {
      log.error('Storage', 'Error saving user', error);
      throw error;
    }
  },

  async removeUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      log.debug('Storage', 'User removed');
    } catch (error) {
      log.error('Storage', 'Error removing user', error);
    }
  },

  // API Key (stored in secure storage)
  async getApiKey(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.API_KEY);
    } catch (error) {
      log.error('Storage', 'Error getting API key', error);
      return null;
    }
  },

  async setApiKey(apiKey: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, apiKey);
      log.debug('Storage', 'API key saved');
    } catch (error) {
      log.error('Storage', 'Error saving API key', error);
      throw error;
    }
  },

  async removeApiKey(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.API_KEY);
      log.debug('Storage', 'API key removed');
    } catch (error) {
      log.error('Storage', 'Error removing API key', error);
    }
  },

  // Patterns
  async getPatterns(): Promise<Pattern[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PATTERNS);
    return data ? JSON.parse(data) : [];
  },

  async setPatterns(patterns: Pattern[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(patterns));
  },

  // Save single pattern (for institution pattern)
  async savePattern(pattern: any): Promise<void> {
    const patterns = await this.getPatterns();
    // Check if pattern already exists
    const existingIndex = patterns.findIndex(p => p.id === pattern.id);
    if (existingIndex >= 0) {
      patterns[existingIndex] = pattern;
    } else {
      patterns.push(pattern);
    }
    await this.setPatterns(patterns);
  },

  // Selected Institution
  async getSelectedInstitution(): Promise<string | null> {
    return await AsyncStorage.getItem('selected_institution');
  },

  async saveSelectedInstitution(institution: string): Promise<void> {
    await AsyncStorage.setItem('selected_institution', institution);
  },

  // Country Code
  async getCountryCode(): Promise<string | null> {
    return await AsyncStorage.getItem('country_code');
  },

  async setCountryCode(countryCode: string): Promise<void> {
    await AsyncStorage.setItem('country_code', countryCode);
  },

  // Local Transactions (stored on device)
  async getLocalTransactions(): Promise<any[]> {
    const data = await AsyncStorage.getItem('local_transactions');
    return data ? JSON.parse(data) : [];
  },

  async setLocalTransactions(transactions: any[]): Promise<void> {
    await AsyncStorage.setItem('local_transactions', JSON.stringify(transactions));
  },

  async getTransactionsLastSyncAt(): Promise<number> {
    const raw = await AsyncStorage.getItem('transactions_last_sync_at');
    return raw ? parseInt(raw, 10) || 0 : 0;
  },

  async setTransactionsLastSyncAt(timestamp: number): Promise<void> {
    await AsyncStorage.setItem('transactions_last_sync_at', String(timestamp));
  },

  async addLocalTransaction(transaction: any): Promise<void> {
    const transactions = await this.getLocalTransactions();
    transactions.unshift(transaction);
    // Keep only last 1000
    const limited = transactions.slice(0, 1000);
    await this.setLocalTransactions(limited);
  },

  // SIM ICCID
  async getSimIccid(): Promise<string | null> {
    return await AsyncStorage.getItem('sim_iccid');
  },

  async setSimIccid(iccid: string): Promise<void> {
    await AsyncStorage.setItem('sim_iccid', iccid);
  },

  async removeSimIccid(): Promise<void> {
    await AsyncStorage.removeItem('sim_iccid');
  },

  // Onboarding
  async getOnboardingCompleted(): Promise<boolean> {
    const completed = await AsyncStorage.getItem('onboarding_completed');
    return completed === 'true';
  },

  async setOnboardingCompleted(completed: boolean): Promise<void> {
    await AsyncStorage.setItem('onboarding_completed', completed ? 'true' : 'false');
  },

  // Customer Onboarding
  async getCustomerOnboardingCompleted(): Promise<boolean> {
    const completed = await AsyncStorage.getItem('customer_onboarding_completed');
    return completed === 'true';
  },

  async setCustomerOnboardingCompleted(completed: boolean): Promise<void> {
    await AsyncStorage.setItem('customer_onboarding_completed', completed ? 'true' : 'false');
  },

  // User Country
  async getUserCountry(): Promise<string | null> {
    return await AsyncStorage.getItem('user_country');
  },

  async setUserCountry(country: string): Promise<void> {
    await AsyncStorage.setItem('user_country', country);
  },

  // Selected Banks
  async getSelectedBanks(): Promise<string[]> {
    const data = await AsyncStorage.getItem('selected_banks');
    return data ? JSON.parse(data) : [];
  },

  async setSelectedBanks(banks: string[]): Promise<void> {
    await AsyncStorage.setItem('selected_banks', JSON.stringify(banks));
  },

  // Institution Patterns (for local matching)
  async getInstitutionPatterns(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem('institution_patterns');
      const patterns = data ? JSON.parse(data) : [];
      log.debug('Storage', `Retrieved ${patterns.length} patterns from storage`);
      if (__DEV__ && patterns.length > 0) {
        log.debug('Storage', 'Sample pattern', {
          id: patterns[0].id,
          name: patterns[0].name,
          institution: patterns[0].institution,
          hasRegex: !!patterns[0].regex,
        });
      }
      return patterns;
    } catch (error) {
      log.error('Storage', 'Error reading patterns', error);
      return [];
    }
  },

  async setInstitutionPatterns(patterns: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem('institution_patterns', JSON.stringify(patterns));
      log.debug('Storage', `Saved ${patterns.length} patterns to storage`);
      
      // Verify save was successful (only in dev mode)
      if (__DEV__) {
        const verified = await this.getInstitutionPatterns();
        if (verified.length === patterns.length) {
          log.debug('Storage', `Verified save: ${verified.length} patterns stored`);
        } else {
          log.warn('Storage', `Save verification failed: expected ${patterns.length}, got ${verified.length}`);
        }
      }
    } catch (error) {
      log.error('Storage', 'Error saving patterns', error);
      throw error;
    }
  },

  async clearInstitutionPatterns(): Promise<void> {
    await AsyncStorage.removeItem('institution_patterns');
  },

  async getCachedInstitutions(): Promise<string[]> {
    const data = await AsyncStorage.getItem('cached_institutions');
    return data ? JSON.parse(data) : [];
  },

  async setCachedInstitutions(institutions: string[]): Promise<void> {
    await AsyncStorage.setItem('cached_institutions', JSON.stringify(institutions));
    await AsyncStorage.setItem('cached_institutions_sync_at', String(Date.now()));
  },

  async getCachedInstitutionsSyncAt(): Promise<number> {
    const raw = await AsyncStorage.getItem('cached_institutions_sync_at');
    return raw ? parseInt(raw, 10) || 0 : 0;
  },

  async getPackageUsageCache(): Promise<{
    currentPackage: any | null;
    availablePackages: any[];
    pendingPurchases: any[];
    lastSyncAt: number;
  }> {
    const raw = await AsyncStorage.getItem('package_usage_cache');
    if (!raw) {
      return {
        currentPackage: null,
        availablePackages: [],
        pendingPurchases: [],
        lastSyncAt: 0,
      };
    }

    try {
      const parsed = JSON.parse(raw);
      return {
        currentPackage: parsed?.currentPackage || null,
        availablePackages: Array.isArray(parsed?.availablePackages) ? parsed.availablePackages : [],
        pendingPurchases: Array.isArray(parsed?.pendingPurchases) ? parsed.pendingPurchases : [],
        lastSyncAt: Number(parsed?.lastSyncAt) || 0,
      };
    } catch (error) {
      log.error('Storage', 'Error parsing package usage cache', error);
      return {
        currentPackage: null,
        availablePackages: [],
        pendingPurchases: [],
        lastSyncAt: 0,
      };
    }
  },

  async setPackageUsageCache(data: {
    currentPackage: any | null;
    availablePackages: any[];
    pendingPurchases: any[];
    lastSyncAt?: number;
  }): Promise<void> {
    const payload = {
      currentPackage: data.currentPackage || null,
      availablePackages: Array.isArray(data.availablePackages) ? data.availablePackages : [],
      pendingPurchases: Array.isArray(data.pendingPurchases) ? data.pendingPurchases : [],
      lastSyncAt: data.lastSyncAt || Date.now(),
    };
    await AsyncStorage.setItem('package_usage_cache', JSON.stringify(payload));
  },

  // Last Processed SMS Timestamp (for resuming after restart)
  async getLastProcessedSMSTimestamp(): Promise<number | null> {
    const timestamp = await AsyncStorage.getItem('last_processed_sms_timestamp');
    return timestamp ? parseInt(timestamp, 10) : null;
  },

  async setLastProcessedSMSTimestamp(timestamp: number): Promise<void> {
    await AsyncStorage.setItem('last_processed_sms_timestamp', timestamp.toString());
  },

  // Processed SMS IDs (to avoid reprocessing)
  async getProcessedSMSIds(): Promise<string[]> {
    const data = await AsyncStorage.getItem('processed_sms_ids');
    return data ? JSON.parse(data) : [];
  },

  async setProcessedSMSIds(ids: string[]): Promise<void> {
    // Keep only last 500 IDs to avoid memory issues while ensuring gap-free resumption
    const limitedIds = ids.slice(-500);
    await AsyncStorage.setItem('processed_sms_ids', JSON.stringify(limitedIds));
  },

  // Business ID
  async getBusinessId(): Promise<string | null> {
    return await AsyncStorage.getItem('checkpay_business_id');
  },

  async setBusinessId(businessId: string): Promise<void> {
    await AsyncStorage.setItem('checkpay_business_id', businessId);
  },

  async removeBusinessId(): Promise<void> {
    await AsyncStorage.removeItem('checkpay_business_id');
  },

  // Validate token exists and is not empty
  async hasValidToken(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return !!token && token.trim().length > 0;
    } catch (error) {
      log.error('Storage', 'Error checking token', error);
      return false;
    }
  },

  // Generic storage methods for arbitrary keys
  async getItem(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  // Get all auth data for debugging (only in dev mode, no sensitive data)
  async getAuthData(): Promise<{
    hasToken: boolean;
    hasUser: boolean;
    hasApiKey: boolean;
    userPreview?: string;
  }> {
    try {
      const token = await this.getToken();
      const user = await this.getUser();
      const apiKey = await this.getApiKey();
      
      return {
        hasToken: !!token,
        hasUser: !!user,
        hasApiKey: !!apiKey,
        userPreview: user ? (user.username || user.phone || 'Unknown') : undefined,
      };
    } catch (error) {
      log.error('Storage', 'Error getting auth data', error);
      return {
        hasToken: false,
        hasUser: false,
        hasApiKey: false,
      };
    }
  },

  // Clear all data (logout)
  async clearAll(): Promise<void> {
    try {
      log.info('Storage', 'Clearing all data...');
      
      // Clear secure storage (tokens, API keys)
      await Promise.all([
        this.removeToken(),
        this.removeApiKey(),
      ]).catch(error => {
        log.warn('Storage', 'Error clearing secure storage', error);
      });
      
      // Clear AsyncStorage
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER,
        STORAGE_KEYS.PATTERNS,
        'sim_iccid',
        'onboarding_completed',
        'user_country',
        'selected_banks',
        'institution_patterns',
        'checkpay_business_id',
        'country_code',
        'processed_sms_ids',
        'last_processed_sms_timestamp',
        'pending_background_sms',
        'customer_onboarding_completed',
      ]);
      
      log.info('Storage', 'All data cleared');
    } catch (error) {
      log.error('Storage', 'Error clearing data', error);
      throw error;
    }
  },
};
