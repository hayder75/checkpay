import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config';
import { Pattern } from '../types';

export const storage = {
  // JWT Token
  async getToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      if (token) {
        console.log('🔑 [Storage] Token retrieved:', token.substring(0, 20) + '...');
      } else {
        console.warn('⚠️ [Storage] No token found in storage');
      }
      return token;
    } catch (error) {
      console.error('❌ [Storage] Error getting token:', error);
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      console.log('✅ [Storage] Token saved:', token.substring(0, 20) + '...');
    } catch (error) {
      console.error('❌ [Storage] Error saving token:', error);
      throw error;
    }
  },

  async removeToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      console.log('🗑️ [Storage] Token removed');
    } catch (error) {
      console.error('❌ [Storage] Error removing token:', error);
    }
  },

  // User Data
  async getUser(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (data) {
        const user = JSON.parse(data);
        console.log('👤 [Storage] User retrieved:', user.username || user.phone || 'Unknown');
        return user;
      } else {
        console.warn('⚠️ [Storage] No user found in storage');
        return null;
      }
    } catch (error) {
      console.error('❌ [Storage] Error getting user:', error);
      return null;
    }
  },

  async setUser(user: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      console.log('✅ [Storage] User saved:', user.username || user.phone || 'Unknown');
    } catch (error) {
      console.error('❌ [Storage] Error saving user:', error);
      throw error;
    }
  },

  async removeUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      console.log('🗑️ [Storage] User removed');
    } catch (error) {
      console.error('❌ [Storage] Error removing user:', error);
    }
  },

  // API Key
  async getApiKey(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.API_KEY);
  },

  async setApiKey(apiKey: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
  },

  async removeApiKey(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.API_KEY);
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
      console.log(`📦 [Storage] Retrieved ${patterns.length} patterns from storage`);
      if (patterns.length > 0) {
        console.log('📦 [Storage] Sample pattern:', {
          id: patterns[0].id,
          name: patterns[0].name,
          institution: patterns[0].institution,
          hasRegex: !!patterns[0].regex,
        });
      }
      return patterns;
    } catch (error) {
      console.error('❌ [Storage] Error reading patterns:', error);
      return [];
    }
  },

  async setInstitutionPatterns(patterns: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem('institution_patterns', JSON.stringify(patterns));
      console.log(`💾 [Storage] Saved ${patterns.length} patterns to storage`);
      
      // Verify save was successful
      const verified = await this.getInstitutionPatterns();
      if (verified.length === patterns.length) {
        console.log(`✅ [Storage] Verified save: ${verified.length} patterns stored`);
      } else {
        console.warn(`⚠️ [Storage] Save verification failed: expected ${patterns.length}, got ${verified.length}`);
      }
    } catch (error) {
      console.error('❌ [Storage] Error saving patterns:', error);
      throw error;
    }
  },

  async clearInstitutionPatterns(): Promise<void> {
    await AsyncStorage.removeItem('institution_patterns');
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
    // Keep only last 100 IDs to avoid memory issues
    const limitedIds = ids.slice(-100);
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
      console.error('❌ [Storage] Error checking token:', error);
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

  // Get all auth data for debugging
  async getAuthData(): Promise<{
    hasToken: boolean;
    hasUser: boolean;
    hasApiKey: boolean;
    tokenPreview?: string;
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
        tokenPreview: token ? token.substring(0, 20) + '...' : undefined,
        userPreview: user ? (user.username || user.phone || 'Unknown') : undefined,
      };
    } catch (error) {
      console.error('❌ [Storage] Error getting auth data:', error);
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
      console.log('🗑️ [Storage] Clearing all data...');
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.API_KEY,
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
      ]);
      console.log('✅ [Storage] All data cleared');
    } catch (error) {
      console.error('❌ [Storage] Error clearing data:', error);
      throw error;
    }
  },
};
