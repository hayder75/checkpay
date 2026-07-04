export interface Pattern {
  id: string;
  name: string;
  description?: string;
  regex: string;
  extraction?: Record<string, any>;
  extractFields?: Record<string, any>; // Backend field name
  bank?: string;
  logoUrl?: string;
  bankLogo?: string;
  logo?: string;
  currency?: string;
  userId?: string;
  businessId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  txnId: string;
  amount: number;
  sender: string;
  bank: string;
  pattern: string;
  userId: string;
  createdAt: string;
}

export interface ParsedSMS {
  txnId: string;
  amount: number;
  sender: string;
  bank: string;
  pattern: string;
  smsText: string;
}
