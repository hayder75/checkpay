import { Platform } from 'react-native';


const getBaseURL = (): string => {
  // Priority 1: Environment variable (supports .env files)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Priority 2: Production URL
  if (!__DEV__) {
    return 'https://checkpay.live/api';
  }
  
  // Priority 3: Development URLs based on platform
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to access host's localhost
    // For physical device, use your computer's local IP (set via EXPO_PUBLIC_API_URL)
    return 'http://192.168.43.160:3000/api';
  }
  
  if (Platform.OS === 'ios') {
    // iOS simulator uses localhost
    return 'http://localhost:3000/api';
  }
  
  // Fallback (web or other platforms)
  return 'http://localhost:3000/api';
};

export const API_BASE_URL = getBaseURL();

export const STORAGE_KEYS = {
  TOKEN: 'checkpay_token',
  USER: 'checkpay_user',
  API_KEY: 'checkpay_api_key',
  PATTERNS: 'checkpay_patterns',
  TRANSACTIONS: 'checkpay_transactions',
} as const;
