import axios from 'axios';
import { API_BASE_URL } from '../config';
import { storage } from './storage';
import { log } from '../utils/logger';

// Log API configuration (only in dev mode)
if (__DEV__) {
  log.debug('API', 'API Configuration', {
    baseURL: API_BASE_URL,
    isNgrok: API_BASE_URL.includes('ngrok'),
  });
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Skip ngrok browser warning page (for free tier)
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 30000, // 30 second timeout (increased for mobile networks)
});

// Request interceptor - Add JWT token for most endpoints, API key for verify and ingest endpoints
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getToken();
    const apiKey = await storage.getApiKey();
    
    // OCR verify endpoint requires JWT token (not API key)
    if (config.url?.includes('/ocr/verify')) {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        log.debug('API', 'Using JWT token for OCR verify endpoint');
      } else {
        log.warn('API', 'No JWT token found for OCR verify endpoint');
      }
    }
    // Use API key for verify and ingest endpoints (they require API key authentication)
    // But allow JWT fallback for authenticated users
    else if (config.url?.includes('/verify') || config.url?.includes('/ingest')) {
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
        log.debug('API', `Using API key for ${config.url?.includes('/verify') ? 'verification' : 'ingest'} endpoint`);
      } else if (token) {
        // Fallback to JWT token if no API key (for authenticated users)
        log.debug('API', `No API key found, using JWT token for ${config.url?.includes('/verify') ? 'verification' : 'ingest'} endpoint`);
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        log.warn('API', `No API key or JWT token found for ${config.url} endpoint`);
      }
    } else {
      // Use JWT token for all other endpoints
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        log.debug('API', 'Using JWT token for authentication');
      } else {
        log.warn('API', 'No authentication token found');
      }
    }
    
    // Always add ngrok skip warning header (for free tier)
    if (config.baseURL?.includes('ngrok')) {
      config.headers['ngrok-skip-browser-warning'] = 'true';
    }
    
    // Debug: Log request details (only in dev mode, no sensitive data)
    if (__DEV__) {
      log.debug('API', 'API Request', {
        method: config.method?.toUpperCase(),
        url: config.url,
        hasAuth: !!(token || apiKey),
        hasToken: !!token,
        hasApiKey: !!apiKey,
        authType: config.url?.includes('/ocr/verify')
          ? 'JWT'
          : (config.url?.includes('/verify') || config.url?.includes('/ingest'))
          ? (apiKey ? 'API-Key' : 'JWT')
          : 'JWT',
      });
    }
    
    return config;
  },
  (error) => {
    log.error('API', 'Request interceptor error', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 errors
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      log.debug('API', 'API Response', {
        status: response.status,
        url: response.config.url,
      });
    }
    return response;
  },
  async (error) => {
    // Enhanced error logging (no sensitive data)
    const errorDetails = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      url: error.config?.url,
    };
    
    log.error('API', 'API Error', errorDetails);
    
    // Provide helpful error messages
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      log.error('API', 'Network Error', {
        baseURL: API_BASE_URL,
      });
      // Show user-friendly alert for network errors
      // We use a timeout to prevent blocking the UI immediately if multiple requests fail
      setTimeout(() => {
        // Import Alert dynamically to avoid circular dependencies if any
        const { Alert } = require('react-native');
        Alert.alert(
          'Connection Error',
          'Unable to connect to the server. Please check your internet connection and try again.'
        );
      }, 100);
    }
    
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error || '';
      const url = error.config?.url || '';
      
      // Only clear JWT token if it's a JWT authentication error (not API key error)
      // Don't clear token for /ingest or /verify endpoints - they use API keys
      if (url.includes('/ingest') || url.includes('/verify')) {
        // API key authentication failed - don't clear JWT token
        log.warn('API', `401 Unauthorized for ${url} - API key authentication failed`);
      } else {
        // JWT authentication failed - clear token
        log.warn('API', '401 Unauthorized - JWT token authentication failed, clearing token');
        await storage.removeToken();
        await storage.removeUser();
        log.info('API', 'JWT token cleared due to 401 error');
        // Keep API key as it might still be valid
      }
    }
    
    // Handle 403 Token Exhaustion errors
    if (error.response?.status === 403) {
      const errorMessage = error.response?.data?.error || '';
      const url = error.config?.url || '';
      
      // Token exhausted - show appropriate message based on token type
      if (errorMessage.includes('out of credit') || errorMessage.includes('exhausted') || errorMessage.includes('limit reached')) {
        log.warn('API', `403 Forbidden - Token exhausted for ${url}`, { errorMessage });
        
        // Determine which type of token is exhausted
        const isPhoneToken = errorMessage.toLowerCase().includes('phone') || url.includes('/ingest');
        const isVerifiedToken = errorMessage.toLowerCase().includes('verif');
        
        // Show user-friendly alert with upgrade option
        setTimeout(() => {
          const { Alert } = require('react-native');
          const tokenType = isPhoneToken ? 'phone sync' : isVerifiedToken ? 'verification' : 'transaction';
          
          Alert.alert(
            'Out of Credits',
            `You have used all your ${tokenType} credits.\n\nUpgrade your package to continue processing transactions.`,
            [
              { text: 'Later', style: 'cancel' },
              { 
                text: 'View Packages', 
                onPress: () => {
                  // Emit event for navigation (handled by app navigation)
                  log.info('API', 'User requested to view packages from token exhaustion alert');
                }
              }
            ]
          );
        }, 100);
      } else {
        // Other 403 errors (business access, permissions, etc.)
        log.warn('API', `403 Forbidden for ${url}`, { errorMessage });
      }
    }
    
    return Promise.reject(error);
  }
);

// Add API key to requests
export const setApiKey = (apiKey: string) => {
  api.defaults.headers.common['X-API-Key'] = apiKey;
};

// Remove API key
export const removeApiKey = () => {
  delete api.defaults.headers.common['X-API-Key'];
};

// Auth API
export const authAPI = {
  register: async (data: { username?: string; phone?: string; country?: string; password: string; role?: string }) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  login: async (data: { username?: string; phone?: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  verifyOTP: async (data: { phone?: string; email?: string; code: string; password?: string; country?: string }) => {
    const response = await api.post('/auth/verify-otp', data);
    return response.data;
  },
  resendOTP: async (data: { phone?: string; email?: string }) => {
    const response = await api.post('/auth/resend-otp', data);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  completeProfile: async (data: { country: string; firstName?: string; lastName?: string; role?: string }) => {
    const response = await api.post('/auth/complete-profile', data);
    return response;
  },
};

// OTP Auth API (Passwordless login via Telegram)
export const otpAuthAPI = {
  requestOTP: async (data: { phone?: string; username?: string; email?: string }) => {
    const response = await api.post('/auth/otp/request', data);
    return response.data;
  },
  verifyOTP: async (data: { phone?: string; username?: string; email?: string; code: string }) => {
    const response = await api.post('/auth/otp/verify', data);
    return response.data;
  },
  resendOTP: async (data: { phone?: string; username?: string; email?: string }) => {
    const response = await api.post('/auth/otp/resend', data);
    return response.data;
  },
  requestPasswordReset: async (data: { phone?: string; username?: string; email?: string }) => {
    const response = await api.post('/auth/otp/reset-password/request', data);
    return response.data;
  },
  verifyPasswordReset: async (data: { phone?: string; username?: string; email?: string; code: string; newPassword: string }) => {
    const response = await api.post('/auth/otp/reset-password/verify', data);
    return response.data;
  },
};

// Telegram Auth API
export const telegramAuthAPI = {
  init: async () => {
    const response = await api.post('/auth/telegram/init');
    return response.data;
  },
  checkStatus: async (token: string) => {
    const response = await api.get(`/auth/telegram/check/${token}`);
    return response.data;
  },
  link: async () => {
    const response = await api.post('/auth/telegram/link');
    return response.data;
  },
  unlink: async () => {
    const response = await api.delete('/auth/telegram/link');
    return response.data;
  },
  getStatus: async () => {
    const response = await api.get('/auth/telegram/status');
    return response.data;
  },
  getBotInfo: async () => {
    const response = await api.get('/auth/telegram/bot-info');
    return response.data;
  },
};

// Patterns API
export const patternsAPI = {
  create: async (data: { 
    smsText: string; 
    name: string; 
    description?: string; 
    useAI?: boolean;
    allowedSenders?: string[];
    requireSenderVerification?: boolean;
    requireContactCheck?: boolean;
  }) => {
    const response = await api.post('/patterns', data);
    return response.data;
  },
  createWithAI: async (data: { smsText: string; name: string; description?: string }) => {
    // Backend uses the same endpoint with useAI flag
    const response = await api.post('/patterns', { ...data, useAI: true });
    return response.data;
  },
  getAll: async () => {
    const response = await api.get('/patterns');
    return response.data;
  },
  validate: async (data: { smsText: string; name: string; useAI?: boolean }) => {
    const response = await api.post('/patterns/validate', data);
    return response.data;
  },
};



// Business API
export const businessAPI = {
  getAll: async () => {
    const response = await api.get('/businesses');
    return response.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/businesses/${id}`);
    return response.data;
  },
  create: async (data: { name: string; description?: string; primaryInstitution?: string }) => {
    const response = await api.post('/businesses', data);
    return response.data;
  },
  getStats: async (id: string) => {
    const response = await api.get(`/businesses/${id}/stats`);
    return response.data;
  },
};

// Employee API
export const employeeAPI = {
  register: async (data: { 
    code?: string; 
    qrData?: string; 
    name: string;
    username?: string;
    phone?: string;
    password?: string;
    country?: string;
  }) => {
    const response = await api.post('/employees/register', data);
    return response.data;
  },
  validateAccessCode: async (code: string) => {
    const response = await api.post('/access-codes/validate', { code });
    return response.data;
  },
  generateCode: async (businessId: string) => {
    const response = await api.post(`/access-codes/businesses/${businessId}`);
    return response.data;
  },
  delete: async (businessId: string, employeeId: string) => {
    const response = await api.delete(`/businesses/${businessId}/employees/${employeeId}`);
    return response.data;
  },
  reauthorize: async (businessId: string, employeeId: string) => {
    const response = await api.post(`/businesses/${businessId}/employees/${employeeId}/reauthorize`);
    return response.data;
  },
  update: async (businessId: string, employeeId: string, data: { name?: string; isActive?: boolean; allowAccessAllTransactions?: boolean }) => {
    const response = await api.put(`/businesses/${businessId}/employees/${employeeId}`, data);
    return response.data;
  },
};

// Dashboard API
export const dashboardAPI = {
  getTransactions: async (params?: { page?: number; limit?: number; employeeId?: string }) => {
    const response = await api.get('/dashboard/transactions', { params });
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },
};

// Countries API
export const countriesAPI = {
  getAll: async () => {
    const response = await api.get('/countries');
    return response.data;
  },
  getBanksForCountry: async (countryCode: string) => {
    const response = await api.get(`/countries/${countryCode}/banks`);
    return response.data;
  },
  detectFromSMS: async (smsMessages: string[]) => {
    const response = await api.post('/countries/detect', { smsMessages });
    return response.data;
  },
};

// Institution Patterns API (for onboarding)
export const institutionPatternsAPI = {
  // Check if pattern exists for SMS and extract data
  checkPatternAndExtract: async (data: {
    smsText: string;
    countryCode?: string;
  }) => {
    const response = await api.post('/patterns/check-and-extract', data);
    return response.data;
  },
  // Check if pattern exists for an institution
  checkPattern: async (institution: string, countryCode: string) => {
    const response = await api.get(
      `/patterns/institution/${encodeURIComponent(institution)}?country=${countryCode}`
    );
    return response.data;
  },
  // Create pattern from sample SMS using Gemini
  createFromSample: async (data: {
    institution: string;
    countryCode: string;
    smsText: string;
    txnId: string;
  }) => {
    const response = await api.post('/patterns/create-from-sample', data);
    return response.data;
  },
  // Get list of institutions with patterns for a country
  getInstitutions: async (countryCode: string) => {
    const response = await api.get(`/patterns/institutions?country=${countryCode}`);
    return response.data;
  },
  // Get all patterns for a country (for local matching)
  getCountryPatterns: async (countryCode: string) => {
    const response = await api.get(`/patterns/country/${countryCode}`);
    return response.data;
  },
};

// OCR API
export const ocrAPI = {
  // Extract transaction data from OCR text using dynamic patterns
  extract: async (data: {
    ocrText: string;
    blocks?: Array<{
      text: string;
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence?: number;
    }>;
    countryCode?: string;
    institution?: string;
  }) => {
    const response = await api.post('/ocr/extract', data);
    return response.data;
  },
  // Get all OCR patterns
  getPatterns: async (params?: {
    countryCode?: string;
    institution?: string;
  }) => {
    const response = await api.get('/ocr/patterns', { params });
    return response.data;
  },
  // Verify OCR-extracted transaction
  verify: async (data: {
    txnId: string;
    amount: number;
    sender?: string;
    receiver?: string;
    bank?: string;
    institution?: string;
    currency?: string;
    ocrText?: string;
    patternId?: string;
    businessId?: string;
    employeeId?: string;
    sendFrom?: string | null;
    sendTo?: string | null;
  }) => {
    const response = await api.post('/ocr/verify', data);
    return response.data;
  },
  // Create OCR pattern request (user submits sample image)
  createPatternRequest: async (data: {
    institution: string;
    countryCode: string;
    name?: string;
    description?: string;
    ocrText?: string;
    imageBase64?: string;
    imageType?: 'png' | 'jpg';
  }) => {
    const response = await api.post('/ocr/patterns/request', data);
    return response.data;
  },
  // Get user's OCR pattern requests
  getMyPatternRequests: async () => {
    const response = await api.get('/ocr/patterns/requests');
    return response.data;
  },
};

// Fetch patterns from backend
export const fetchPatterns = async (apiKey: string) => {
  setApiKey(apiKey);
  const response = await api.get('/config');
  return response.data;
};

// Check if SIM is registered
export const checkSimRegistration = async (iccid: string | null) => {
  if (!iccid) {
    return { isRegistered: false, error: 'SIM info not available' };
  }
  
  try {
    const response = await api.get(`/auth/sims/check?iccid=${iccid}`);
    return response.data.data;
  } catch (error: any) {
    log.error('API', 'Error checking SIM registration', error);
    return { 
      isRegistered: false, 
      error: error.response?.data?.error || 'Failed to check SIM registration' 
    };
  }
};

// Test API connection
export const testAPIConnection = async (): Promise<{ success: boolean; message: string; details?: any }> => {
  try {
    const token = await storage.getToken();
    log.debug('API', 'Testing connection', { baseURL: API_BASE_URL });
    
    // Try a simple authenticated endpoint
    const response = await api.get('/auth/me');
    
    return {
      success: true,
      message: 'Connection successful',
      details: {
        baseURL: API_BASE_URL,
        hasToken: !!token,
      },
    };
  } catch (error: any) {
    const errorDetails = {
      baseURL: API_BASE_URL,
      error: error.message,
      code: error.code,
      status: error.response?.status,
    };
    
    log.error('API', 'Connection test failed', errorDetails);
    
    let message = 'Connection failed';
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      message = `Cannot reach backend at ${API_BASE_URL}. Check if backend is running.`;
    } else if (error.response?.status === 401) {
      message = 'Authentication failed. Please sign in again.';
    } else if (error.response?.status === 404) {
      message = `Endpoint not found. Check if backend route /api/ingest exists.`;
    }
    
    return {
      success: false,
      message,
      details: errorDetails,
    };
  }
};

// Send transaction to backend
export const ingestTransaction = async (transaction: {
  txnId: string;
  amount: number;
  sender: string;
  bank: string;
  pattern: string;
  smsText?: string;
  iccid?: string | null; // SIM card ICCID
  sendFrom?: string | null;
  sendTo?: string | null;
  source?: 'SMS' | 'OCR' | 'MANUAL'; // Transaction source
}) => {
  // Get or fetch business ID (optional - backend will handle if not provided)
  let businessId = await storage.getBusinessId();
  
  // If no business ID stored, try to fetch user's businesses
  if (!businessId) {
    try {
      const businessesResponse = await businessAPI.getAll();
      if (businessesResponse.success && businessesResponse.data) {
        const businesses = Array.isArray(businessesResponse.data) ? businessesResponse.data : [];
        if (businesses.length > 0) {
          businessId = businesses[0].id;
          await storage.setBusinessId(businessId!);
          log.debug('API', 'Using business ID', { businessId });
        }
      }
    } catch (error) {
      log.error('API', 'Error fetching businesses', error);
      // Continue without businessId - backend will handle it
    }
  }
  
  // Ensure sender is not empty (required field)
  const sender = transaction.sender?.trim() || transaction.bank || 'Unknown';
  
  // Backend expects these fields
  const payload: any = {
    txnId: transaction.txnId,
    amount: transaction.amount,
    sender: sender, // Required - must not be empty
    bank: transaction.bank || '',
    pattern: transaction.pattern || '',
    smsText: transaction.smsText,
    source: transaction.source || 'SMS', // Default to SMS if not specified
    ...(businessId && { businessId }), // Only include if we have one
    ...(transaction.iccid && { iccid: transaction.iccid }),
    ...(transaction.sendFrom && { sendFrom: transaction.sendFrom }),
    ...(transaction.sendTo && { sendTo: transaction.sendTo }),
  };
  
  const token = await storage.getToken();
  const apiKey = await storage.getApiKey();
  
  if (__DEV__) {
    log.debug('API', 'Sending transaction to backend', {
      endpoint: '/ingest',
      hasToken: !!token,
      hasApiKey: !!apiKey,
      authMethod: 'API-Key (required for /ingest)',
    });
  }
  
  try {
    const response = await api.post('/ingest', payload);
    
    log.debug('API', 'Transaction sent successfully', {
      success: response.data.success,
      txnId: transaction.txnId,
      status: response.status,
    });
    
    return response.data;
  } catch (error: any) {
    const errorDetails = {
      txnId: transaction.txnId,
      error: error.message,
      code: error.code,
      status: error.response?.status,
    };
    
    log.error('API', 'Failed to send transaction', errorDetails);
    
    // Log specific error types
    if (error.response?.status === 401) {
      const errorMsg = error.response?.data?.error || '';
      if (errorMsg.includes('API key')) {
        log.error('API', 'Authentication failed - API key required for /ingest endpoint');
      } else {
        log.error('API', 'Authentication failed - token may be expired or invalid');
      }
    } else if (error.response?.status === 400) {
      log.error('API', 'Validation error - check payload format');
    } else if (error.response?.status === 403) {
      log.error('API', 'Forbidden - check business access permissions');
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      log.error('API', 'Network error - cannot reach backend server', { baseURL: API_BASE_URL });
    }
    
    throw error;
  }
};

// Verify transaction endpoint
export const verifyTransaction = async (data: { 
  txnId: string; 
  businessId?: string;
  source?: string;
  ocrText?: string;
  bank?: string;
}) => {
  log.debug('API', 'Recording verification attempt', { txnId: data.txnId });
  
  const response = await api.post('/verify', data);
  
  log.debug('API', 'Verification recording response', { success: response.data.success });
  
  return response.data;
};

// Package API
export const packageAPI = {
  // Get user's active package with usage stats
  getMyPackage: async () => {
    const response = await api.get('/user-packages/me');
    return response.data;
  },
  // Get available packages (filtered by tier)
  getPackages: async (params?: { tier?: 'FREE' | 'BUSINESS' }) => {
    const response = await api.get('/packages', { params });
    return response.data;
  },
  // Activate a package for the user
  activatePackage: async (data: { packageId: string; notes?: string }) => {
    const response = await api.post('/user-packages/activate', data);
    return response.data;
  },
  // Purchase a package
  purchasePackage: async (data: { packageId: string; transactionNumber: string }) => {
    const response = await api.post('/user-packages/purchase', data);
    return response.data;
  },
  // Get user's purchase history (pending, verified, rejected)
  getMyPurchases: async () => {
    const response = await api.get('/user-packages/purchases');
    return response.data;
  },
};

export default api;
