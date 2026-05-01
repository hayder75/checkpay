import { Platform } from 'react-native';


const getBaseURL = (): string => {
  // Priority 1: Environment variable (supports .env files)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Default to hosted backend for both development and production.
  // Use www host as default because some mobile networks/proxies route it more reliably.
  // Override with EXPO_PUBLIC_API_URL when needed.
  return 'https://www.checkpay.live/api';
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
