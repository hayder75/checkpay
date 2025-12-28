// API Configuration
// For physical device testing, you can use:
// 1. Ngrok (recommended) - Universal URL that works from anywhere
// 2. Local IP - Only works if phone and computer are on same WiFi

import { Platform } from 'react-native';

// ============================================
// CONFIGURATION OPTIONS
// ============================================

// Option 1: Use Ngrok (Recommended for physical devices)
// 1. Install ngrok: https://ngrok.com/download
// 2. Start your backend: npm run dev (in backend folder)
// 3. In another terminal, run: ngrok http 3000
// 4. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
// 5. Update NGROK_URL below with your ngrok URL
const USE_NGROK = false; // Set to true to use ngrok, false for local IP
const NGROK_URL = 'https://437ac7908692.ngrok-free.app'; // Ngrok tunnel URL (auto-started)

// Option 2: Use Local IP (Only works on same WiFi network)
// Get your IP: hostname -I (Linux) or ipconfig (Windows/Mac)
// const LOCAL_IP = '192.168.43.160'; // Update this to your computer's IP
const LOCAL_IP = '10.55.132.87'; // Update this to your computer's IP

// ============================================

const getBaseURL = () => {
  // Check for environment variable first
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Production: Use checkpay.live/api
  // return 'https://checkpay.live/api';
  return 'http://172.20.10.2:3000/api';
  // return 'http://192.168.43.160:3000/api';
  
  // Use ngrok if enabled (works for both dev and production builds)
  // if (USE_NGROK && NGROK_URL && !NGROK_URL.includes('your-ngrok-url')) {
  //   return `${NGROK_URL}/api`;
  // }
  
  // Development mode - use local IP for physical devices
  // if (__DEV__) {
  //   // For Android emulator (only works in Android Studio emulator, not Expo Go)
  //   if (Platform.OS === 'android') {
  //     // Use 10.0.2.2 for Android emulator (maps to host's localhost)
  //     // return 'http://192.168.43.160:3000/api';
  //     return 'http://10.55.132.87:3000/api';
  //   }
  //   
  //   // For iOS simulator (only works in Xcode simulator, not Expo Go)
  //   if (Platform.OS === 'ios') {
  //     return 'http://localhost:3000/api';
  //   }
  //   
  //   // For physical device - use local IP
  //   return `http://${LOCAL_IP}:3000/api`;
  // }
  
  // Production fallback - use local IP for physical devices
  // return `http://${LOCAL_IP}:3000/api`;
};

export const API_BASE_URL = getBaseURL();
// export const API_BASE_URL = 'http://144.217.161.251:3000/api';

export const STORAGE_KEYS = {
  TOKEN: 'checkpay_token',
  USER: 'checkpay_user',
  API_KEY: 'checkpay_api_key',
  PATTERNS: 'checkpay_patterns',
  TRANSACTIONS: 'checkpay_transactions',
};
