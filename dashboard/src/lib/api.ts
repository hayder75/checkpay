import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include credentials for CORS
  timeout: 10000, // 10 second timeout
});

// Request interceptor - Add JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { email?: string; phone?: string }) =>
    api.post('/auth/register', data),
  verifyOTP: (data: { phone: string; code: string }) =>
    api.post('/auth/verify-otp', data),
  resendOTP: (data: { phone: string }) =>
    api.post('/auth/resend-otp', data),
  getMe: () => api.get('/auth/me'),
  regenerateKey: () => api.post('/auth/regenerate-key'),
  googleLogin: () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  },
};

// Patterns API
export const patternsAPI = {
  create: (data: { smsText: string; name: string; description?: string }) =>
    api.post('/patterns', data),
  getAll: () => api.get('/patterns'),
  getOne: (id: string) => api.get(`/patterns/${id}`),
  update: (id: string, data: any) => api.put(`/patterns/${id}`, data),
  delete: (id: string) => api.delete(`/patterns/${id}`),
  validate: (data: { smsText: string; name: string }) =>
    api.post('/patterns/validate', data),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getTransactions: (params?: { page?: number; limit?: number }) =>
    api.get('/dashboard/transactions', { params }),
};

// Premium API
export const premiumAPI = {
  getStatus: () => api.get('/premium/status'),
  upgrade: (txnId: string) => api.post('/premium/upgrade', { txnId }),
};

// Verify API (for testing)
export const verifyAPI = {
  verify: (apiKey: string, txnId: string) =>
    api.get('/verify', {
      params: { key: apiKey, txn: txnId },
      headers: { 'X-API-Key': apiKey },
    }),
};

export default api;
