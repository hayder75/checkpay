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
    // Use sessionStorage instead of localStorage to match auth.ts
    const token = sessionStorage.getItem('token');
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
      // Clear token and redirect to login (use sessionStorage)
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// Countries API
export const countriesAPI = {
  getAll: () => api.get('/countries'),
};

// Patterns API
export const patternsAPI = {
  create: (data: {
    smsText?: string;
    smsTexts?: string[];
    name: string;
    description?: string;
    useAI?: boolean;
    countryCode?: string;
    allowedSenders?: string[];
    requireSenderVerification?: boolean;
    requireContactCheck?: boolean;
  }) =>
    api.post('/patterns', data),
  createWithAI: (data: { smsText?: string; smsTexts?: string[]; name: string; description?: string }) =>
    api.post('/patterns/create-with-ai', data),
  getAll: () => api.get('/patterns'),
  getOne: (id: string) => api.get(`/patterns/${id}`),
  update: (id: string, data: any) => api.put(`/patterns/${id}`, data),
  delete: (id: string) => api.delete(`/patterns/${id}`),
  validate: (data: { smsText: string; name: string }) =>
    api.post('/patterns/validate', data),
  browse: (params?: { bank?: string; countryCode?: string; search?: string }) =>
    api.get('/patterns/browse', { params }),
  clone: (id: string, data?: { name?: string }) =>
    api.post(`/patterns/${id}/clone`, data),
};

// Templates API (Removed - replaced by patterns system)

// Premium API (Legacy - may not exist in backend)
export const premiumAPI = {
  getStatus: () => api.get('/premium/status'),
  upgrade: (txnId: string) => api.post('/premium/upgrade', { txnId }),
};

// Business API (New)
export const businessAPI = {
  create: (data: { name: string; description?: string; logo?: string; primaryInstitution?: string; packageId?: string; ownerId?: string }) =>
    api.post('/businesses', data),
  getAll: () => api.get('/businesses'),
  getOne: (id: string) => api.get(`/businesses/${id}`),
  getStats: (id: string) => api.get(`/businesses/${id}/stats`),
  update: (id: string, data: { name?: string; description?: string; logo?: string; packageId?: string; isActive?: boolean }) =>
    api.put(`/businesses/${id}`, data),
  delete: (id: string) => api.delete(`/businesses/${id}`),
  switch: (id: string) => api.post(`/businesses/${id}/switch`),
};

// Employee API (New)
export const employeeAPI = {
  register: (data: { code?: string; qrData?: string; name: string }) =>
    api.post('/employees/register', data),
  invite: (businessId: string, data: { name: string; expiresInHours?: number }) =>
    api.post(`/employees/businesses/${businessId}/employees/invite`, data),
  getAll: (businessId: string) => api.get(`/employees/businesses/${businessId}/employees`),
  getOne: (businessId: string, employeeId: string) =>
    api.get(`/employees/businesses/${businessId}/employees/${employeeId}`),
  update: (businessId: string, employeeId: string, data: { name?: string; isActive?: boolean }) =>
    api.put(`/employees/businesses/${businessId}/employees/${employeeId}`, data),
  remove: (businessId: string, employeeId: string) =>
    api.delete(`/employees/businesses/${businessId}/employees/${employeeId}`),
};

// Project API (New - Developer)
export const projectAPI = {
  create: (data: { name: string; description?: string; businessId?: string; isOwnProject?: boolean; type?: 'STANDALONE' | 'CLUSTER' | 'TRANSFERABLE'; ingestUserApiKey?: string }) =>
    api.post('/projects', data),
  getAll: () => api.get('/projects'),
  getOne: (id: string) => api.get(`/projects/${id}`),
  update: (id: string, data: { name?: string; description?: string; status?: 'SETUP' | 'READY' | 'HANDED_OVER' | 'ACTIVE'; type?: 'STANDALONE' | 'CLUSTER' | 'TRANSFERABLE'; ingestUserApiKey?: string | null }) =>
    api.put(`/projects/${id}`, data),
  handover: (id: string, data: { ingestUserApiKey: string }) =>
    api.post(`/projects/${id}/handover`, data),
  getStatus: (id: string) => api.get(`/projects/${id}/status`),
  generateTransferCode: (id: string, data?: { phone?: string }) =>
    api.post(`/projects/${id}/generate-transfer-code`, data),
  getTransferStatus: (id: string) => api.get(`/projects/${id}/transfer-status`),
  acceptTransfer: (data: { code: string; username?: string; email?: string; phone?: string; password?: string; businessId?: string }) =>
    api.post('/projects/accept-transfer', data),
  getStats: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/projects/${id}/stats`, { params }),
  getClusterMembers: (id: string) =>
    api.get("/projects/" + id + "/cluster-members"),
};


// Vendor API
export const vendorAPI = {
  create: (projectId: string, data: { name: string; ownerCode?: string }) =>
    api.post(`/projects/${projectId}/vendors`, data),
  getAll: (projectId: string) => api.get(`/projects/${projectId}/vendors`),
  update: (projectId: string, vendorId: string, data: { name?: string; ownerCode?: string; isActive?: boolean }) =>
    api.put(`/projects/${projectId}/vendors/${vendorId}`, data),
  delete: (projectId: string, vendorId: string) =>
    api.delete(`/projects/${projectId}/vendors/${vendorId}`),
};

// Package API (New)
export const packageAPI = {
  getAll: (params?: { tier?: string }) => api.get('/packages', { params }),
  getBillingMode: () => api.get('/system-config/billing-mode'),
  getOne: (id: string) => api.get(`/packages/${id}`),
  create: (data: { name: string; description?: string; transactionLimit?: number; employeeLimit?: number; businessLimit?: number; features: any; price?: number; isCustom?: boolean; billingCycle?: 'ONE_TIME' | 'MONTHLY' | 'SIX_MONTH' | 'QUARTERLY' | 'YEARLY' | null; durationDays?: number | null; isDeveloperToken?: boolean; isFreePackage?: boolean; tier?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE' | null; maxPhoneTxns?: number | null; maxVerifiedTxns?: number | null }) =>
    api.post('/packages', data),
  update: (id: string, data: { name?: string; description?: string; transactionLimit?: number | null; employeeLimit?: number | null; businessLimit?: number | null; features?: any; price?: number | null; isCustom?: boolean; billingCycle?: 'ONE_TIME' | 'MONTHLY' | 'SIX_MONTH' | 'QUARTERLY' | 'YEARLY' | null; durationDays?: number | null; isDeveloperToken?: boolean; isFreePackage?: boolean; tier?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE' | null; maxPhoneTxns?: number | null; maxVerifiedTxns?: number | null; isActive?: boolean }) =>
    api.put(`/packages/${id}`, data),
  assignToBusiness: (businessId: string, data: { packageId: string }) =>
    api.put(`/packages/businesses/${businessId}`, data),
  getFreePackage: () => api.get('/packages/free/package'),
  updateFreePackage: (data: { maxPhoneTxns?: number; maxVerifiedTxns?: number; description?: string }) =>
    api.put('/packages/free/package', data),
};

// User Packages API
export const userPackageAPI = {
  getMyPackage: () => api.get('/user-packages/me'),
  activate: (data: { packageId: string; notes?: string }) => api.post('/user-packages/activate', data),
  purchase: (data: { packageId: string; transactionNumber: string }) => api.post('/user-packages/purchase', data),
  updateQuotas: (id: string, data: { phoneTxnsRemaining?: number | null; verifiedTxnsRemaining?: number | null }) =>
    api.patch(`/user-packages/${id}/quotas`, data),
};

// Access Code API (New)
export const accessCodeAPI = {
  generate: (businessId: string, data?: { expiresInHours?: number }) =>
    api.post(`/access-codes/businesses/${businessId}`, data),
  getAll: (businessId: string) => api.get(`/access-codes/businesses/${businessId}`),
  validate: (data: { code: string }) => api.post('/access-codes/validate', data),
  getQR: (code: string) => api.get(`/access-codes/${code}/qr`, { responseType: 'blob' }),
};

// Updated Dashboard API
export const dashboardAPI = {
  getStats: (businessId?: string) => api.get('/dashboard/stats', { params: businessId ? { businessId } : {} }),
  getTransactions: (params?: { page?: number; limit?: number; businessId?: string; projectId?: string; employeeId?: string; dateFrom?: string; dateTo?: string }) =>
    api.get('/dashboard/transactions', { params }),
  getPendingVerifications: (params?: { businessId?: string; projectId?: string }) =>
    api.get('/dashboard/pending-verifications', { params }),
};

// Updated Ingest API
export const ingestAPI = {
  ingest: (data: { txnId: string; amount: number; sender: string; businessId: string; employeeId?: string; source: 'SMS' | 'OCR' | 'MANUAL'; smsText?: string; senderBank?: string; receiverBank?: string; bank?: string; pattern?: string; sendFrom?: string; sendTo?: string }) =>
    api.post('/ingest', data),
};

// Verify API (backend)
export const verifyAPI = {
  verify: (txnId: string, apiKey: string) => {
    return api.get('/verify', {
      params: { txn: txnId },
      headers: { 'X-API-Key': apiKey },
    });
  },
};

// Updated Auth API (with role support)
export const authAPI = {
  register: (data: { username?: string; phone?: string; password: string; role?: 'DEVELOPER' | 'BUSINESS_OWNER' | 'EMPLOYEE'; country?: string }) =>
    api.post('/auth/register', data),
  login: (data: { username?: string; phone?: string; email?: string; password: string }) =>
    api.post('/auth/login', data),
  // Google auth now handled directly via redirect (no API call needed)
  // googleStart: (state?: string) => api.get('/auth/google', { params: { state } }),
  getMe: () => api.get('/auth/me'),
  updateRole: (data: { role: 'DEVELOPER' | 'BUSINESS_OWNER' | 'USER' | 'EMPLOYEE'; username?: string; country?: string }) =>
    api.put('/auth/role', data),
  updatePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/password', data),
  updateProfile: (data: { username?: string; phone?: string; country?: string }) =>
    api.put('/auth/profile', data),
  resetPassword: (data: { phone: string; newPassword: string; otp?: string }) =>
    api.post('/auth/reset-password', data),
  regenerateKey: () => api.post('/auth/regenerate-key'),
    generateQrSignup: () => api.get('/auth/generate-device-link'),
};

// Admin API (Keep existing for backward compatibility)
export const adminAPI = {
  // Users
  getUsers: (params?: { page?: number; limit?: number; plan?: string; role?: string; country?: string; search?: string }) =>
    api.get('/admin/users', { params }),
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  updateUser: (id: string, data: { plan?: string; role?: string; country?: string }) =>
    api.patch(`/admin/users/${id}`, data),

  // Billing mode
  getBillingMode: () => api.get('/admin/billing-mode'),
  updateBillingMode: (billingMode: 'COUNT_BASED' | 'FIXED_PRICE') =>
    api.put('/admin/billing-mode', { billingMode }),

  // Analytics
  getAnalytics: () => api.get('/admin/analytics'),
  getDashboardStats: () => api.get('/admin/analytics'),

  // Patterns
  getPatterns: (params?: { page?: number; limit?: number; search?: string; bank?: string; currency?: string; isTemplate?: string; suspicious?: string; userId?: string }) =>
    api.get('/admin/patterns', { params }),
  getSuspiciousPatterns: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/patterns/suspicious', { params }),
  createAdminPattern: (data: { smsText?: string; smsTexts?: string[]; name: string; description?: string; useAI?: boolean }) =>
    api.post('/admin/patterns', data),
  deletePattern: (id: string) =>
    api.delete(`/admin/patterns/${id}`),
  blockPattern: (id: string, data: { blocked: boolean; adminNotes?: string }) =>
    api.put(`/admin/patterns/${id}/block`, data),
  updatePattern: (id: string, data: any) =>
    api.put(`/admin/patterns/${id}`, data),

  // Package Purchases
  getPackagePurchases: (params?: { status?: string }) =>
    api.get('/admin/package-purchases', { params }),
  verifyPackagePurchase: (id: string, data?: { adminNotes?: string }) =>
    api.post(`/admin/package-purchases/${id}/verify`, data),
  rejectPackagePurchase: (id: string, data: { adminNotes: string }) =>
    api.post(`/admin/package-purchases/${id}/reject`, data),

  // Transactions
  getTransactions: (params?: { page?: number; limit?: number; userId?: string; bank?: string; txnId?: string; fromDate?: string; toDate?: string; analytics?: boolean }) =>
    api.get('/admin/transactions', { params }),

  // Countries
  getCountries: () => api.get('/admin/countries'),
  getCountry: (code: string) => api.get(`/admin/countries/${code}`),
  getCountryTemplates: (countryCode: string) => api.get(`/admin/countries/${countryCode}/templates`),
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

// Cluster API
export const clustersAPI = {
  getMe: () => api.get("/clusters/me"),
  createRequest: (data: { ownerCode: string; projectId?: string; message?: string; expiresInHours?: number }) =>
    api.post("/clusters/requests", data),
  getIncomingRequests: () => api.get("/clusters/requests/incoming"),
  getOutgoingRequests: () => api.get("/clusters/requests/outgoing"),
  acceptRequest: (id: string) => api.post("/clusters/requests/" + id + "/accept"),
  rejectRequest: (id: string) => api.post("/clusters/requests/" + id + "/reject"),
  cancelRequest: (id: string) => api.post("/clusters/requests/" + id + "/cancel"),
  deleteRequest: (id: string) => api.delete("/clusters/requests/" + id),
};

// Pending Verification API (Developer API for pre-payment verification)
export const pendingAPI = {
  create: (data: { amount: number; webhookUrl?: string; referenceId?: string; businessId?: string; projectId?: string }) => 
    api.post('/dashboard/pending-verifications', data),
  getAll: (params?: { businessId?: string; projectId?: string }) => 
    api.get('/dashboard/pending-verifications', { params }),
};
