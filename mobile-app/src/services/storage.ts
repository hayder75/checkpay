import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config';
import { Pattern } from '../types';

export const storage = {
  // JWT Token
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('checkpay_token');
  },

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem('checkpay_token', token);
  },

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem('checkpay_token');
  },

  // User Data
  async getUser(): Promise<any | null> {
    const data = await AsyncStorage.getItem('checkpay_user');
    return data ? JSON.parse(data) : null;
  },

  async setUser(user: any): Promise<void> {
    await AsyncStorage.setItem('checkpay_user', JSON.stringify(user));
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem('checkpay_user');
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

  // Clear all data (logout)
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      'checkpay_token',
      'checkpay_user',
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.PATTERNS,
      'sim_iccid',
      'onboarding_completed',
      'user_country',
      'selected_banks',
      'institution_patterns',
    ]);
  },
};
