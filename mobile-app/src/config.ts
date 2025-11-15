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
const USE_NGROK = true; // Set to true to use ngrok, false for local IP
const NGROK_URL = 'https://437ac7908692.ngrok-free.app'; // Ngrok tunnel URL (auto-started)

// Option 2: Use Local IP (Only works on same WiFi network)
// Get your IP: hostname -I (Linux) or ipconfig (Windows/Mac)
const LOCAL_IP = '192.168.43.160'; // Update this to your computer's IP

// ============================================

const getBaseURL = () => {
  // Always use ngrok if enabled (works for both dev and production builds)
//   if (USE_NGROK && NGROK_URL && !NGROK_URL.includes('your-ngrok-url')) {
//     return `${NGROK_URL}/api`;
//   }
  
//   // Development mode fallbacks
//   if (__DEV__) {
//     // For Android emulator (only works in Android Studio emulator, not Expo Go)
//     if (Platform.OS === 'android') {
//       // Uncomment if using Android Studio emulator:
//       // return 'http://10.0.2.2:3000/api';
//     }
    
//     // For iOS simulator (only works in Xcode simulator, not Expo Go)
//     if (Platform.OS === 'ios') {
//       // Uncomment if using iOS simulator:
//       // return 'http://localhost:3000/api';
//     }
    
//     // For physical device - use local IP
    return `http://${LOCAL_IP}:3000/api`;
//   }
  
//   // Production fallback
  return 'https://192.168.43.160:3000/api';
};

export const API_BASE_URL = getBaseURL();

export const STORAGE_KEYS = {
  API_KEY: 'checkpay_api_key',
  PATTERNS: 'checkpay_patterns',
  TRANSACTIONS: 'checkpay_transactions',
};
