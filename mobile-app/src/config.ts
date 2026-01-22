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
    // For physical device, set EXPO_PUBLIC_API_URL in your .env file
    // return 'http://172.20.10.2:3000/api';
    return "http://192.168.43.160:3000/api"
      // return "http://10.137.114.87:3000/api"
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
  // Security keys (stored in SecureStore)
  SECURITY_PIN_HASH: 'security_pin_hash',
  SECURITY_PIN_SALT: 'security_pin_salt',
  SECURITY_PIN_ENABLED: 'security_pin_enabled',
  SECURITY_BIOMETRIC_ENABLED: 'security_biometric_enabled',
  SECURITY_ONBOARDING_PROMPTED: 'security_onboarding_prompted',
} as const;
