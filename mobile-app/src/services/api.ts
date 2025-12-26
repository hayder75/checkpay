import axios from 'axios';
import { API_BASE_URL } from '../config';
import { storage } from './storage';

// Debug: Log API configuration
console.log('🔧 API Configuration:', {
  baseURL: API_BASE_URL,
  fullURL: `${API_BASE_URL}/auth/login`,
  isNgrok: API_BASE_URL.includes('ngrok'),
});

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
    
    // Use API key for verify and ingest endpoints (they require API key authentication)
    // But allow JWT fallback for authenticated users
    if (config.url?.includes('/verify') || config.url?.includes('/ingest')) {
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
        console.log(`🔑 [API] Using API key for ${config.url?.includes('/verify') ? 'verification' : 'ingest'} endpoint`);
      } else if (token) {
        // Fallback to JWT token if no API key (for authenticated users)
        console.log(`🔑 [API] No API key found, using JWT token for ${config.url?.includes('/verify') ? 'verification' : 'ingest'} endpoint`);
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn(`⚠️ [API] No API key or JWT token found for ${config.url} endpoint`);
      }
    } else {
      // Use JWT token for all other endpoints
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔑 [API] Using JWT token for authentication');
      } else {
        console.warn('⚠️ [API] No authentication token found');
      }
    }
    
    // Always add ngrok skip warning header (for free tier)
    if (config.baseURL?.includes('ngrok')) {
      config.headers['ngrok-skip-browser-warning'] = 'true';
    }
    
    // Debug: Log request details
    console.log('📤 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      hasAuth: !!(token || apiKey),
      authType: config.url?.includes('/verify') ? 'API-Key' : 'JWT',
    });
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 errors
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url,
    });
    return response;
  },
  async (error) => {
    // Enhanced error logging
    const errorDetails = {
      message: error.message,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
      } : 'No response (network error)',
      config: error.config ? {
        url: error.config.url,
        baseURL: error.config.baseURL,
        method: error.config.method,
        headers: error.config.headers,
      } : 'No config',
    };
    
    console.error('❌ API Error:', errorDetails);
    
    // Provide helpful error messages
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('🌐 Network Error Details:', {
        baseURL: API_BASE_URL,
        possibleCauses: [
          'Backend server is not running',
          'Ngrok tunnel is not active',
          'Network connectivity issue',
          'Firewall blocking connection',
          'Wrong API URL in config',
        ],
        troubleshooting: [
          'Check if backend is running: npm run dev (in backend folder)',
          'Check if ngrok is running: ngrok http 3000',
          'Verify ngrok URL in mobile-app/src/config.ts',
          'Check network connection',
        ],
      });
    }
    
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error || '';
      const url = error.config?.url || '';
      
      // Only clear JWT token if it's a JWT authentication error (not API key error)
      // Don't clear token for /ingest or /verify endpoints - they use API keys
      if (url.includes('/ingest') || url.includes('/verify')) {
        // API key authentication failed - don't clear JWT token
        console.warn(`🔒 [API] 401 Unauthorized for ${url} - API key authentication failed: ${errorMessage}`);
        // Only clear API key if it's invalid
        if (errorMessage.includes('Invalid API key') || errorMessage.includes('API key required')) {
          console.warn('⚠️ [API] API key may be invalid, but keeping it for retry');
        }
      } else {
        // JWT authentication failed - clear token
        console.warn('🔒 [API] 401 Unauthorized - JWT token authentication failed, clearing token');
        await storage.removeToken();
        await storage.removeUser();
        console.log('✅ [API] JWT token cleared due to 401 error');
        // Keep API key as it might still be valid
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
};

// Patterns API
export const patternsAPI = {
  create: async (data: { smsText: string; name: string; description?: string; useAI?: boolean }) => {
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

// Premium API
export const premiumAPI = {
  getStatus: async () => {
    const response = await api.get('/premium/status');
    return response.data;
  },
  upgrade: async (txnId: string) => {
    const response = await api.post('/premium/upgrade', { txnId });
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
};

// Dashboard API
export const dashboardAPI = {
  getTransactions: async (params?: { page?: number; limit?: number }) => {
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
    console.error('Error checking SIM registration:', error);
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
    console.log('🔍 [API] Testing connection to:', API_BASE_URL);
    
    // Try a simple authenticated endpoint
    const response = await api.get('/auth/me');
    
    return {
      success: true,
      message: 'Connection successful',
      details: {
        baseURL: API_BASE_URL,
        hasToken: !!token,
        user: response.data?.data,
      },
    };
  } catch (error: any) {
    const errorDetails = {
      baseURL: API_BASE_URL,
      error: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    };
    
    console.error('❌ [API] Connection test failed:', errorDetails);
    
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
          await storage.setBusinessId(businessId);
          console.log('✅ [API] Using business ID:', businessId);
        }
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
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
  console.log('📤 [API] Sending transaction to backend:', {
    endpoint: '/ingest',
    baseURL: API_BASE_URL,
    fullURL: `${API_BASE_URL}/ingest`,
    payload: { 
      ...payload, 
      smsText: payload.smsText?.substring(0, 50) + '...',
      sender: payload.sender || 'Unknown',
    },
    hasToken: !!token,
    hasApiKey: !!apiKey,
    authMethod: 'API-Key (required for /ingest)',
    apiKeyPreview: apiKey ? apiKey.substring(0, 20) + '...' : 'none',
  });
  
  try {
    const response = await api.post('/ingest', payload);
    
    console.log('✅ [API] Transaction sent successfully:', {
      success: response.data.success,
      txnId: transaction.txnId,
      transactionId: response.data.data?.id,
      status: response.status,
    });
    
    return response.data;
  } catch (error: any) {
    const errorDetails = {
      txnId: transaction.txnId,
      error: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      fullURL: `${API_BASE_URL}/ingest`,
      hasToken: !!token,
    };
    
    console.error('❌ [API] Failed to send transaction:', errorDetails);
    
    // Log specific error types
    if (error.response?.status === 401) {
      const errorMsg = error.response?.data?.error || '';
      if (errorMsg.includes('API key')) {
        console.error('🔒 [API] Authentication failed - API key required for /ingest endpoint');
        console.error('   Make sure API key is stored and being sent in X-API-Key header');
      } else {
        console.error('🔒 [API] Authentication failed - token may be expired or invalid');
      }
    } else if (error.response?.status === 400) {
      console.error('📋 [API] Validation error - check payload format:', error.response?.data);
    } else if (error.response?.status === 403) {
      console.error('🚫 [API] Forbidden - check business access permissions');
    } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('🌐 [API] Network error - cannot reach backend server');
      console.error('   Check if backend is running and API_BASE_URL is correct:', API_BASE_URL);
    }
    
    throw error;
  }
};

// Verify transaction endpoint
export const verifyTransaction = async (txnId: string) => {
  console.log('🔍 [API] Verifying transaction:', txnId);
  
  const response = await api.get('/verify', {
    params: { txn: txnId },
  });
  
  console.log('✅ [API] Verification response:', response.data);
  
  return response.data;
};

export default api;
