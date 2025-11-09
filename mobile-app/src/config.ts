// API Configuration
// For physical device testing, use your computer's IP address instead of localhost
// Get your IP: hostname -I (Linux) or ipconfig (Windows/Mac)
import { Platform } from 'react-native';

// API Base URL Configuration
// For physical devices, use your computer's IP address
// For emulators/simulators, use the special addresses below

const getBaseURL = () => {
  if (__DEV__) {
    // IMPORTANT: For physical devices (Expo Go), use your computer's IP
    // Your current IP: 192.168.48.141
    // Make sure phone and computer are on same WiFi network
    
    // For Android emulator (only works in Android Studio emulator, not Expo Go)
    // return 'http://10.0.2.2:3000/api';
    
    // For iOS simulator (only works in Xcode simulator, not Expo Go)
    // return 'http://localhost:3000/api';
    
    // For physical device (Expo Go) - USE THIS
    return 'http://192.168.48.141:3000/api';
  }
  return 'https://your-production-api.com/api';
};

export const API_BASE_URL = getBaseURL();

export const STORAGE_KEYS = {
  API_KEY: 'checkpay_api_key',
  PATTERNS: 'checkpay_patterns',
  TRANSACTIONS: 'checkpay_transactions',
};
