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

  // Clear all data (logout)
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      'checkpay_token',
      'checkpay_user',
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.PATTERNS,
      'sim_iccid',
    ]);
  },
};
