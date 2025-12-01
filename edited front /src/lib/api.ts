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

// Countries API
export const countriesAPI = {
  getAll: () => api.get('/countries'),
};

// Auth API
export const authAPI = {
  register: (data: { username?: string; phone?: string; country?: string }) =>
    api.post('/auth/register', data),
  login: (data: { username?: string; phone?: string; password: string }) =>
    api.post('/auth/login', data),
  verifyOTP: (data: { phone?: string; email?: string; code: string; password?: string; iccid?: string; country?: string }) =>
    api.post('/auth/verify-otp', data),
  resendOTP: (data: { phone?: string; email?: string }) =>
    api.post('/auth/resend-otp', data),
  getMe: () => api.get('/auth/me'),
  regenerateKey: () => api.post('/auth/regenerate-key'),
  getSimCards: () => api.get('/auth/sims'),
  addSimCard: (data: { iccid: string; phoneNumber: string }) =>
    api.post('/auth/sims', data),
  removeSimCard: (id: string) =>
    api.delete('/auth/sims', { data: { id } }),
  checkSimCard: (iccid: string) =>
    api.get(`/auth/sims/check?iccid=${iccid}`),
};

// Patterns API
export const patternsAPI = {
  create: (data: { smsText: string; name: string; description?: string; useAI?: boolean }) =>
    api.post('/patterns', data),
  createWithAI: (data: { smsText: string; name: string; description?: string }) =>
    api.post('/patterns/create-with-ai', data),
  getAll: () => api.get('/patterns'),
  getOne: (id: string) => api.get(`/patterns/${id}`),
  update: (id: string, data: any) => api.put(`/patterns/${id}`, data),
  delete: (id: string) => api.delete(`/patterns/${id}`),
  validate: (data: { smsText: string; name: string }) =>
    api.post('/patterns/validate', data),
};

// Templates API
export const templatesAPI = {
  getAvailable: () => api.get('/templates/available'),
  add: (templateId: string) => api.post(`/templates/${templateId}/add`),
  remove: (templateId: string) => api.delete(`/templates/${templateId}/remove`),
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

// Admin API
export const adminAPI = {
  // Users
  getUsers: (params?: { page?: number; limit?: number; plan?: string; role?: string; country?: string; search?: string }) =>
    api.get('/admin/users', { params }),
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  updateUser: (id: string, data: { plan?: string; role?: string; country?: string }) =>
    api.patch(`/admin/users/${id}`, data),
  
  // Analytics
  getAnalytics: () => api.get('/admin/analytics'),
  
  // Patterns
  getPatterns: (params?: { page?: number; limit?: number; userId?: string; bank?: string; currency?: string; search?: string }) =>
    api.get('/admin/patterns', { params }),
  
  // Transactions
  getTransactions: (params?: { page?: number; limit?: number; userId?: string; bank?: string; txnId?: string; fromDate?: string; toDate?: string }) =>
    api.get('/admin/transactions', { params }),
  
  // Countries
  getCountries: () => api.get('/admin/countries'),
  getCountry: (code: string) => api.get(`/admin/countries/${code}`),
  updateCountry: (code: string, data: { name?: string; banks?: string[]; currencies?: string[]; commonPhrases?: string[]; isActive?: boolean }) =>
    api.patch(`/admin/countries/${code}`, data),
  
  // Templates
  createTemplate: (countryCode: string, data: { smsText: string; name: string; description: string; requiredPlan?: 'FREE' | 'PREMIUM' }) =>
    api.post(`/admin/countries/${countryCode}/templates`, data),
  getTemplates: (countryCode: string, params?: { plan?: 'FREE' | 'PREMIUM' }) =>
    api.get(`/admin/countries/${countryCode}/templates`, { params }),
  updateTemplate: (templateId: string, data: { name?: string; description?: string; requiredPlan?: 'FREE' | 'PREMIUM'; regex?: string; extractFields?: any; bank?: string; currency?: string }) =>
    api.put(`/admin/templates/${templateId}`, data),
  deleteTemplate: (templateId: string) =>
    api.delete(`/admin/templates/${templateId}`),
  
  // Missing Templates
  getMissingTemplates: () => api.get('/admin/missing-templates'),
  addMissingTemplate: (patternId: string, data: { countryCode: string; name: string; description: string; requiredPlan?: 'FREE' | 'PREMIUM' }) =>
    api.post(`/admin/missing-templates/${patternId}/add`, data),
  dismissMissingTemplate: (patternId: string, data?: { reason?: string }) =>
    api.post(`/admin/missing-templates/${patternId}/dismiss`, data),
  
  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; userId?: string; action?: string; fromDate?: string; toDate?: string }) =>
    api.get('/admin/audit-logs', { params }),
  
  // System Health
  getSystemHealth: () => api.get('/admin/system-health'),
};

export default api;
