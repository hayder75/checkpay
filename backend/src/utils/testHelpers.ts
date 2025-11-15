/**
 * Test Helpers for Payment Verification System
 * Utilities for testing pattern recognition, extraction, and verification
 */

import { recognizePattern } from './patternRecognition';
import { extractTxnIdEnhanced, extractAmount, extractSender } from './extractFromSMS';

export interface TestSMS {
  text: string;
  expectedTxnId: string;
  expectedAmount?: number;
  expectedSender?: string;
  institution?: string;
  country?: string;
}

export interface TestResult {
  success: boolean;
  sms: TestSMS;
  extractedTxnId: string | null;
  extractedAmount: number | null;
  extractedSender: string | null;
  method: 'rule-based' | 'llm' | 'none';
  error?: string;
}

/**
 * Test pattern recognition with a sample SMS
 */
export async function testPatternRecognition(sms: TestSMS): Promise<TestResult> {
  try {
    const result = await recognizePattern(sms.text, sms.expectedTxnId);
    
    let extractedAmount: number | null = null;
    let extractedSender: string | null = null;
    
    if (result.success) {
      // Try to extract additional fields
      extractedAmount = extractAmount(sms.text);
      extractedSender = extractSender(sms.text);
    }
    
    return {
      success: result.success && result.extractedTxnId === sms.expectedTxnId,
      sms,
      extractedTxnId: result.extractedTxnId,
      extractedAmount,
      extractedSender,
      method: result.method,
    };
  } catch (error: any) {
    return {
      success: false,
      sms,
      extractedTxnId: null,
      extractedAmount: null,
      extractedSender: null,
      method: 'none',
      error: error.message,
    };
  }
}

/**
 * Test multiple SMS samples
 */
export async function testMultipleSMS(samples: TestSMS[]): Promise<{
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
    methodBreakdown: {
      'rule-based': number;
      'llm': number;
      'none': number;
    };
  };
}> {
  const results: TestResult[] = [];
  
  for (const sample of samples) {
    const result = await testPatternRecognition(sample);
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  const methodBreakdown = {
    'rule-based': results.filter(r => r.method === 'rule-based').length,
    'llm': results.filter(r => r.method === 'llm').length,
    'none': results.filter(r => r.method === 'none').length,
  };
  
  return {
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      successRate: (passed / results.length) * 100,
      methodBreakdown,
    },
  };
}

/**
 * Sample SMS test cases for different institutions
 */
export const SAMPLE_SMS_TESTS: TestSMS[] = [
  // M-Pesa Kenya
  {
    text: 'RM123456.00 sent to John Doe 254712345678 on 15/01/24 at 10:30 AM. New M-PESA balance is KES 5,000.00. Transaction cost, KES 0.00. Transaction ID: MP123456789.',
    expectedTxnId: 'MP123456789',
    expectedAmount: 123456.00,
    institution: 'M-Pesa',
    country: 'KE',
  },
  // M-Pesa with URL
  {
    text: 'You have received KES 1,000.00 from Jane Doe 254712345678 on 15/01/24. Transaction ID: MP987654321. View details: https://mpesa.com/txn/MP987654321',
    expectedTxnId: 'MP987654321',
    expectedAmount: 1000.00,
    institution: 'M-Pesa',
    country: 'KE',
  },
  // CBE Ethiopia
  {
    text: 'CBE: You received ETB 500.00 from 0912345678 on Jan 15, 2024. Txn ID: CBE123456789. Balance: ETB 2,500.00',
    expectedTxnId: 'CBE123456789',
    expectedAmount: 500.00,
    institution: 'CBE',
    country: 'ET',
  },
  // Telebirr Ethiopia
  {
    text: 'Telebirr: Payment of ETB 1,500.00 received from 0912345678. Transaction Number: TBR789012345. New balance: ETB 3,000.00',
    expectedTxnId: 'TBR789012345',
    expectedAmount: 1500.00,
    institution: 'Telebirr',
    country: 'ET',
  },
  // Generic bank transfer
  {
    text: 'Your account has been credited with NGN 10,000.00 from 08012345678. Reference: TXN202401151234. Balance: NGN 50,000.00',
    expectedTxnId: 'TXN202401151234',
    expectedAmount: 10000.00,
    institution: 'Generic Bank',
    country: 'NG',
  },
];

/**
 * Generate a test report
 */
export function generateTestReport(testResults: {
  results: TestResult[];
  summary: any;
}): string {
  const { results, summary } = testResults;
  
  let report = '=== Pattern Recognition Test Report ===\n\n';
  report += `Total Tests: ${summary.total}\n`;
  report += `Passed: ${summary.passed}\n`;
  report += `Failed: ${summary.failed}\n`;
  report += `Success Rate: ${summary.successRate.toFixed(2)}%\n\n`;
  
  report += `Method Breakdown:\n`;
  report += `  - Rule-based: ${summary.methodBreakdown['rule-based']}\n`;
  report += `  - LLM: ${summary.methodBreakdown['llm']}\n`;
  report += `  - None: ${summary.methodBreakdown['none']}\n\n`;
  
  report += `Detailed Results:\n`;
  report += `${'='.repeat(80)}\n\n`;
  
  results.forEach((result, index) => {
    const status = result.success ? '✓ PASS' : '✗ FAIL';
    report += `${index + 1}. ${status} - ${result.sms.institution || 'Unknown'}\n`;
    report += `   Expected Txn ID: ${result.sms.expectedTxnId}\n`;
    report += `   Extracted Txn ID: ${result.extractedTxnId || 'N/A'}\n`;
    if (result.extractedAmount) {
      report += `   Extracted Amount: ${result.extractedAmount}\n`;
    }
    report += `   Method: ${result.method}\n`;
    if (result.error) {
      report += `   Error: ${result.error}\n`;
    }
    report += `   SMS: ${result.sms.text.substring(0, 100)}...\n\n`;
  });
  
  return report;
}





