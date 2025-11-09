import axios from 'axios';
import { API_BASE_URL } from '../config';
import { storage } from './storage';

// Debug: Log API configuration
console.log('🔧 API Configuration:', {
  baseURL: API_BASE_URL,
  fullURL: `${API_BASE_URL}/auth/login`,
});

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor - Add JWT token or API key
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getToken();
    const apiKey = await storage.getApiKey();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }
    
    // Debug: Log request details
    console.log('📤 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
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
    console.error('❌ API Error:', {
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
      } : 'No config',
    });
    
    if (error.response?.status === 401) {
      // Clear token and API key on unauthorized
      await storage.removeToken();
      await storage.removeApiKey();
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
  register: async (data: { username?: string; phone?: string; country?: string }) => {
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
  create: async (data: { smsText: string; name: string; description?: string }) => {
    const response = await api.post('/patterns', data);
    return response.data;
  },
  getAll: async () => {
    const response = await api.get('/patterns');
    return response.data;
  },
  validate: async (data: { smsText: string; name: string }) => {
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

// Send transaction to backend
export const ingestTransaction = async (transaction: {
  txnId: string;
  amount: number;
  sender: string;
  bank: string;
  pattern: string;
  smsText?: string;
  iccid?: string | null; // SIM card ICCID
}) => {
  // Backend expects these fields
  const payload = {
    txnId: transaction.txnId,
    amount: transaction.amount,
    sender: transaction.sender,
    bank: transaction.bank,
    pattern: transaction.pattern,
    smsText: transaction.smsText,
    ...(transaction.iccid && { iccid: transaction.iccid }),
  };
  
  const response = await api.post('/ingest', payload);
  return response.data;
};

export default api;
