/**
 * Mock Authentication Service
 * Provides mock user data and authentication for testing without backend
 */

export interface MockUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  apiKey: string;
  role: 'USER' | 'BUSINESS_OWNER' | 'EMPLOYEE';
  plan?: 'FREE' | 'PREMIUM';
  country?: string;
}

// Mock user data
const MOCK_USER: MockUser = {
  id: 'mock-user-123',
  username: 'testuser',
  email: 'test@checkpay.com',
  phone: '+1234567890',
  apiKey: 'mock-api-key-12345',
  role: 'USER',
  plan: 'FREE',
  country: 'KE',
};

// Mock OTP storage (for testing)
let mockOTP: string | null = null;

/**
 * Mock login - always succeeds (matches API response format)
 */
export async function mockLogin(data: { username?: string; phone?: string; password: string }): Promise<{
  success: boolean;
  data: { user: MockUser; token: string };
}> {
  console.log('🔐 [MOCK AUTH] Login attempt:', { 
    username: data.username, 
    phone: data.phone, 
    hasPassword: !!data.password 
  });
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  const token = `mock-jwt-token-${Date.now()}`;
  
  console.log('✅ [MOCK AUTH] Login successful:', {
    userId: MOCK_USER.id,
    username: MOCK_USER.username,
    token: token.substring(0, 20) + '...',
  });
  
  return {
    success: true,
    data: {
      user: {
        ...MOCK_USER,
        phone: data.phone || MOCK_USER.phone,
        username: data.username || MOCK_USER.username,
      },
      token,
    },
  };
}

/**
 * Mock register - always succeeds (matches API response format)
 */
export async function mockRegister(data: { username?: string; phone?: string; country?: string }): Promise<{
  success: boolean;
  data?: { debug?: { otp: string } };
  exists?: boolean;
  message?: string;
}> {
  console.log('📝 [MOCK AUTH] Register attempt:', { 
    username: data.username, 
    phone: data.phone, 
    country: data.country 
  });
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  // Generate mock OTP
  mockOTP = '123456'; // Fixed OTP for easy testing
  
  console.log('✅ [MOCK AUTH] Registration successful');
  console.log(`\n🔐 ==========================================`);
  console.log(`📱 OTP Code: ${mockOTP}`);
  console.log(`⏰ Use this code to verify your account`);
  console.log(`🔐 ==========================================\n`);
  
  return {
    success: true,
    data: {
      debug: {
        otp: mockOTP,
      },
    },
    exists: false,
    message: 'OTP sent successfully',
  };
}

/**
 * Mock resend OTP - always succeeds
 */
export async function mockResendOTP(data: { phone: string }): Promise<{
  success: boolean;
  data?: { debug?: { otp: string } };
}> {
  console.log('📤 [MOCK AUTH] Resend OTP request:', { phone: data.phone });
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  // Generate mock OTP
  mockOTP = '123456'; // Fixed OTP for easy testing
  
  console.log(`\n🔐 ==========================================`);
  console.log(`📱 OTP Code: ${mockOTP}`);
  console.log(`⏰ Use this code to verify your account`);
  console.log(`🔐 ==========================================\n`);
  
  return {
    success: true,
    data: {
      debug: {
        otp: mockOTP,
      },
    },
  };
}

/**
 * Mock verify OTP - always succeeds (matches API response format)
 */
export async function mockVerifyOTP(data: { 
  phone?: string; 
  email?: string; 
  code: string; 
  password?: string; 
  country?: string;
}): Promise<{
  success: boolean;
  data: { user: MockUser; token: string };
}> {
  console.log('🔢 [MOCK AUTH] OTP verification:', { 
    phone: data.phone, 
    email: data.email,
    code: data.code,
    hasPassword: !!data.password 
  });
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  const token = `mock-jwt-token-${Date.now()}`;
  
  console.log('✅ [MOCK AUTH] OTP verified successfully');
  
  return {
    success: true,
    data: {
      user: {
        ...MOCK_USER,
        phone: data.phone || MOCK_USER.phone,
        country: data.country || MOCK_USER.country,
      },
      token,
    },
  };
}

/**
 * Mock getMe - returns current user (matches API response format)
 */
export async function mockGetMe(): Promise<{
  success: boolean;
  data: MockUser;
}> {
  console.log('👤 [MOCK AUTH] Get current user');
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200));
  
  return {
    success: true,
    data: MOCK_USER,
  };
}

/**
 * Mock fetch patterns - returns empty array (matches API response format)
 */
export async function mockFetchPatterns(apiKey: string): Promise<{
  success: boolean;
  data: { patterns: any[] };
}> {
  console.log('📋 [MOCK AUTH] Fetch patterns:', { apiKey: apiKey.substring(0, 10) + '...' });
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  // Return empty patterns array (user can add patterns manually)
  return {
    success: true,
    data: {
      patterns: [],
    },
  };
}

/**
 * Get mock user
 */
export function getMockUser(): MockUser {
  return MOCK_USER;
}

/**
 * Get mock OTP (for testing)
 */
export function getMockOTP(): string | null {
  return mockOTP;
}

/**
 * Mock ingest transaction - logs to console instead of sending to backend
 */
export async function mockIngestTransaction(transactionData: {
  txnId: string;
  amount: number;
  sender?: string;
  bank?: string;
  pattern?: string;
  source: 'SMS' | 'OCR' | 'MANUAL';
  ocrText?: string;
  sendFrom?: string | null;
  sendTo?: string | null;
}): Promise<void> {
  console.log('📤 [MOCK API] Ingest Transaction:', {
    ...transactionData,
    timestamp: new Date().toISOString(),
    userId: MOCK_USER.id,
    apiKey: MOCK_USER.apiKey,
  });
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  
  console.log('✅ [MOCK API] Transaction ingested successfully (mocked)');
}

