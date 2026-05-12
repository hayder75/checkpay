/**
 * Smart Pattern Generator
 * Creates bank-specific regex patterns using predefined templates and AI enhancement
 */

import { extractTransactionIds } from './transactionIdExtractor';
import { extractBanksFromText } from './sameBankValidator';

interface PatternTemplate {
  bank: string;
  type: 'credit' | 'debit' | 'both';
  regex: string;
  extractFields: {
    amount: { group: number; type: string };
    sender: { group: number; type: string };
    txnId: { group: number; type: string };
    sendTo?: { group: number; type: string };
    sendFrom?: { group: number; type: string };
  };
  keywords: string[];
  sampleMatch: string;
}

/**
 * Bank-specific pattern templates
 * These are carefully crafted regex patterns for each bank's SMS format
 */
const bankPatternTemplates: PatternTemplate[] = [
  // CBE (Commercial Bank of Ethiopia) - Credit Pattern
  {
    bank: 'CBE',
    type: 'credit',
    regex: 'Dear\\s+[A-Za-z]+(?:\\s+[A-Za-z]+)*\\s+your\\s+Account\\s+[\\d*]+\\s+has\\s+been\\s+Credited\\s+with\\s+ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*),?\\s+on\\s+\\d{1,2}/\\d{1,2}/\\d{4}\\s+at\\s+\\d{1,2}:\\d{2}:\\d{2}\\s+with\\s+Ref\\s+No\\s+([A-Z0-9]{8,})',
    extractFields: {
      amount: { group: 1, type: 'number' },
      sender: { group: 2, type: 'string' },
      txnId: { group: 3, type: 'string' },
    },
    keywords: ['CBE', 'Commercial Bank of Ethiopia', 'Credited', 'Ref No'],
    sampleMatch: 'Dear Gemechu your Account 1*********8423 has been Credited with ETB 95.00 from Mukter Mohammed, on 25/12/2025 at 20:01:10 with Ref No FT25359MN53G',
  },
  // CBE - Debit Pattern
  {
    bank: 'CBE',
    type: 'debit',
    regex: 'ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+debited\\s+from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*)\\s+for\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*)\\s+[A-Z0-9-]+\\s+on\\s+\\d{1,2}-[A-Za-z]{3}-\\d{4}\\s+with\\s+transaction\\s+ID[:\\s]+([A-Z0-9]+)',
    extractFields: {
      amount: { group: 1, type: 'number' },
      sender: { group: 2, type: 'string' },
      sendTo: { group: 3, type: 'string' },
      txnId: { group: 4, type: 'string' },
    },
    keywords: ['debited', 'transaction ID', 'CBE'],
    sampleMatch: 'ETB 200.00 debited from GEMECHU GIRMA BEKELE for TESHALE ABAYNEH SAPE-ETB-5672 on 12-Dec-2025 with transaction ID: FT25346YCGM3',
  },
  // Telebirr - Credit Pattern
  {
    bank: 'Telebirr',
    type: 'credit',
    regex: '[Yy]ou\\s+have\\s+received\\s+ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*)\\s*\\(([\\d*]+)\\)\\s+on\\s+\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2}:\\d{2}\\.?\\s*[Yy]our\\s+transaction\\s+number\\s+is\\s+([A-Z0-9]{8,})',
    extractFields: {
      amount: { group: 1, type: 'number' },
      sender: { group: 2, type: 'string' },
      sendFrom: { group: 3, type: 'string' },
      txnId: { group: 4, type: 'string' },
    },
    keywords: ['telebirr', 'received', 'transaction number is'],
    sampleMatch: 'You have received ETB 100.00 from Gemechu Girma(2519****4345) on 14/11/2025 01:37:18. Your transaction number is CKE95P80LP.',
  },
  // Telebirr - Debit/Transfer Pattern
  {
    bank: 'Telebirr',
    type: 'debit',
    regex: '[Yy]ou\\s+have\\s+transferred\\s+ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+to\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*)\\s*\\(([\\d*]+)\\)\\s+on\\s+\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2}:\\d{2}\\.?\\s*[Yy]our\\s+transaction\\s+number\\s+is\\s+([A-Z0-9]{8,})',
    extractFields: {
      amount: { group: 1, type: 'number' },
      sendTo: { group: 2, type: 'string' },
      sender: { group: 3, type: 'string' },
      txnId: { group: 4, type: 'string' },
    },
    keywords: ['telebirr', 'transferred', 'transaction number is'],
    sampleMatch: 'You have transferred ETB 500.00 to John Doe(2519****1234) on 14/11/2025 01:37:18. Your transaction number is ABC123XYZ.',
  },
  // Awash Bank - Credit Pattern
  {
    bank: 'Awash Bank',
    type: 'credit',
    regex: 'Dear\\s+[A-Za-z]+,?\\s+(?:ETB)?\\s*([\\d,]+(?:\\.\\d{1,2})?)\\s+(?:has\\s+been\\s+)?credited\\s+to\\s+your\\s+account.*?from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*).*?[Rr]ef(?:erence)?[:\\s]+([A-Z0-9]{6,})',
    extractFields: {
      amount: { group: 1, type: 'number' },
      sender: { group: 2, type: 'string' },
      txnId: { group: 3, type: 'string' },
    },
    keywords: ['Awash', 'credited', 'reference'],
    sampleMatch: 'Dear Customer, ETB 1,000.00 has been credited to your account from John Doe. Ref: AWB123456789',
  },
  // Dashen Bank - Credit Pattern
  {
    bank: 'Dashen Bank',
    type: 'credit',
    regex: 'Dear\\s+[A-Za-z]+,?\\s+ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+(?:has\\s+been\\s+)?(?:credited|deposited)\\s+(?:to\\s+)?(?:your\\s+)?(?:account)?.*?from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*).*?(?:Ref|Reference|Txn)[:\\s#]+([A-Z0-9]{6,})',
    extractFields: {
      amount: { group: 1, type: 'number' },
      sender: { group: 2, type: 'string' },
      txnId: { group: 3, type: 'string' },
    },
    keywords: ['Dashen', 'credited', 'deposited'],
    sampleMatch: 'Dear Customer, ETB 500.00 has been credited to your account from Jane Smith. Ref: DSH987654321',
  },
  // M-PESA - Credit Pattern
  {
    bank: 'M-PESA',
    type: 'credit',
    regex: '([A-Z0-9]{10})\\s+Confirmed\\.?\\s+You\\s+have\\s+received\\s+Ksh([\\d,]+(?:\\.\\d{1,2})?)\\s+from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*)\\s+[\\d*]+',
    extractFields: {
      txnId: { group: 1, type: 'string' },
      amount: { group: 2, type: 'number' },
      sender: { group: 3, type: 'string' },
    },
    keywords: ['M-PESA', 'MPESA', 'Confirmed', 'received', 'Ksh'],
    sampleMatch: 'ABC1234567 Confirmed. You have received Ksh1,000.00 from John Doe 2547****1234 on 25/12/2025 at 10:00.',
  },
];

/**
 * Detect bank from SMS text
 */
export function detectBank(smsText: string): string | null {
  const upperText = smsText.toUpperCase();
  const lowerText = smsText.toLowerCase();
  
  // Check for specific bank identifiers
  if (upperText.includes('CBE') || upperText.includes('COMMERCIAL BANK OF ETHIOPIA') || lowerText.includes('cbe.com.et')) {
    return 'CBE';
  }
  if (lowerText.includes('telebirr') || lowerText.includes('ethio telecom')) {
    return 'Telebirr';
  }
  if (upperText.includes('M-PESA') || upperText.includes('MPESA') || upperText.includes('SAFARICOM')) {
    return 'M-PESA';
  }
  if (upperText.includes('AWASH')) {
    return 'Awash Bank';
  }
  if (upperText.includes('DASHEN')) {
    return 'Dashen Bank';
  }
  if (upperText.includes('ABYSSINIA')) {
    return 'Bank of Abyssinia';
  }
  if (upperText.includes('ENAT')) {
    return 'Enat Bank';
  }
  if (upperText.includes('HIBRET') || upperText.includes('UNITED')) {
    return 'Hibret Bank';
  }
  if (upperText.includes('WEGAGEN')) {
    return 'Wegagen Bank';
  }
  if (upperText.includes('BUNNA')) {
    return 'Bunna Bank';
  }
  if (upperText.includes('COOPERATIVE') || upperText.includes('COOPBANK')) {
    return 'Cooperative Bank';
  }
  if (upperText.includes('ZEMEN')) {
    return 'Zemen Bank';
  }
  if (upperText.includes('BERHAN')) {
    return 'Berhan Bank';
  }
  
  return null;
}

/**
 * Detect transaction type (credit/debit) from SMS text
 */
export function detectTransactionType(smsText: string): 'credit' | 'debit' {
  const lowerText = smsText.toLowerCase();
  
  // Debit indicators
  if (
    lowerText.includes('debited') ||
    lowerText.includes('transferred to') ||
    lowerText.includes('sent to') ||
    lowerText.includes('withdrawal') ||
    lowerText.includes('paid to') ||
    lowerText.includes('you have transferred')
  ) {
    return 'debit';
  }
  
  // Credit indicators (default)
  return 'credit';
}

/**
 * Detect currency from SMS text
 */
export function detectCurrency(smsText: string): string | null {
  const upperText = smsText.toUpperCase();
  
  if (upperText.includes('ETB') || upperText.includes('BIRR') || upperText.includes('ብር')) {
    return 'ETB';
  }
  if (upperText.includes('KES') || upperText.includes('KSH')) {
    return 'KES';
  }
  if (upperText.includes('USD') || upperText.includes('US$') || upperText.includes('$')) {
    return 'USD';
  }
  if (upperText.includes('EUR') || upperText.includes('€')) {
    return 'EUR';
  }
  if (upperText.includes('GBP') || upperText.includes('£')) {
    return 'GBP';
  }
  if (upperText.includes('NGN') || upperText.includes('NAIRA') || upperText.includes('₦')) {
    return 'NGN';
  }
  if (upperText.includes('GHS') || upperText.includes('CEDI') || upperText.includes('GH₵')) {
    return 'GHS';
  }
  
  return null;
}

/**
 * Extract values from SMS using a pattern template
 */
function extractWithTemplate(smsText: string, template: PatternTemplate): {
  matched: boolean;
  values?: {
    txnId: string | null;
    amount: number | null;
    sender: string | null;
    sendFrom: string | null;
    sendTo: string | null;
  };
} {
  try {
    const re = new RegExp(template.regex, 'is');
    const match = smsText.match(re);
    
    if (!match) {
      return { matched: false };
    }
    
    const values = {
      txnId: null as string | null,
      amount: null as number | null,
      sender: null as string | null,
      sendFrom: null as string | null,
      sendTo: null as string | null,
    };
    
    // Extract values based on extractFields
    if (template.extractFields.txnId) {
      values.txnId = match[template.extractFields.txnId.group] || null;
    }
    if (template.extractFields.amount) {
      const amountStr = match[template.extractFields.amount.group];
      if (amountStr) {
        values.amount = parseFloat(amountStr.replace(/,/g, ''));
      }
    }
    if (template.extractFields.sender) {
      values.sender = match[template.extractFields.sender.group] || null;
    }
    if (template.extractFields.sendFrom) {
      values.sendFrom = match[template.extractFields.sendFrom.group] || null;
    }
    if (template.extractFields.sendTo) {
      values.sendTo = match[template.extractFields.sendTo.group] || null;
    }
    
    return { matched: true, values };
  } catch (error) {
    return { matched: false };
  }
}

/**
 * Find the best matching template for an SMS
 */
export function findMatchingTemplate(smsText: string): PatternTemplate | null {
  const bank = detectBank(smsText);
  const txnType = detectTransactionType(smsText);
  
  // First, try bank-specific templates
  if (bank) {
    const bankTemplates = bankPatternTemplates.filter(
      t => t.bank === bank && (t.type === txnType || t.type === 'both')
    );
    
    for (const template of bankTemplates) {
      const result = extractWithTemplate(smsText, template);
      if (result.matched && result.values?.txnId && result.values?.amount) {
        return template;
      }
    }
    
    // Try all templates for this bank regardless of type
    for (const template of bankTemplates) {
      const result = extractWithTemplate(smsText, template);
      if (result.matched) {
        return template;
      }
    }
  }
  
  // Try all templates
  for (const template of bankPatternTemplates) {
    const result = extractWithTemplate(smsText, template);
    if (result.matched && result.values?.txnId && result.values?.amount) {
      return template;
    }
  }
  
  return null;
}

interface GeneratorResult {
  regex: string;
  extractFields: {
    txnId?: { group: number; type: string };
    amount?: { group: number; type: string };
    sender?: { group: number; type: string };
    sendFrom?: { group: number; type: string };
    sendTo?: { group: number; type: string };
  };
  bank: string | null;
  currency: string | null;
  extractedValues: {
    txnId: string | null;
    amount: number | null;
    sender: string | null;
    sendFrom: string | null;
    sendTo: string | null;
  };
  confidence: number;
  method: 'template' | 'generated' | 'ai';
}

/**
 * Generate a pattern using smart template matching and fallback generation
 */
export function generateSmartPattern(smsText: string): GeneratorResult {
  const bank = detectBank(smsText);
  const currency = detectCurrency(smsText);
  const txnType = detectTransactionType(smsText);
  
  // Try template matching first
  const template = findMatchingTemplate(smsText);
  
  if (template) {
    const result = extractWithTemplate(smsText, template);
    
    if (result.matched && result.values) {
      console.log(`✅ [Smart Pattern] Matched template: ${template.bank} (${template.type})`);
      
      return {
        regex: template.regex,
        extractFields: template.extractFields,
        bank: template.bank,
        currency: currency || (template.bank === 'M-PESA' ? 'KES' : 'ETB'),
        extractedValues: {
          txnId: result.values.txnId,
          amount: result.values.amount,
          sender: result.values.sender,
          sendFrom: result.values.sendFrom,
          sendTo: result.values.sendTo,
        },
        confidence: 0.95,
        method: 'template',
      };
    }
  }
  
  // No template matched - generate a custom pattern
  console.log(`⚠️ [Smart Pattern] No template matched for ${bank || 'unknown bank'}, generating custom pattern...`);
  
  // Extract values manually
  const txnIds = extractTransactionIds(smsText);
  const banks = extractBanksFromText(smsText);
  
  const txnIdMatch = smsText.match(/(?:Ref\s+No|transaction\s+number\s+is|Transaction\s+ID[:\s]|Reference[:\s])\s*([A-Z0-9]{6,})/i);
  const amountMatch = smsText.match(/(?:ETB|KES|USD|GHS|NGN|Ksh)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const senderMatch = smsText.match(/from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*[,(]|\s+on\s+|\s+at\s+|\.|\s+\d)/i);
  
  const txnId = txnIds.primaryTxnId || (txnIdMatch ? txnIdMatch[1] : null);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
  const sender = senderMatch ? senderMatch[1].trim() : null;
  
  // Build a custom regex based on detected bank
  let customRegex: string;
  let customExtractFields: GeneratorResult['extractFields'];
  
  if (bank === 'CBE') {
    customRegex = 'Dear\\s+[A-Za-z]+(?:\\s+[A-Za-z]+)*\\s+your\\s+Account\\s+[\\d*]+\\s+has\\s+been\\s+Credited\\s+with\\s+ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*),?\\s+on\\s+\\d{1,2}/\\d{1,2}/\\d{4}\\s+at\\s+\\d{1,2}:\\d{2}:\\d{2}\\s+with\\s+Ref\\s+No\\s+([A-Z0-9]{8,})';
    customExtractFields = {
      amount: { group: 1, type: 'number' },
      sender: { group: 2, type: 'string' },
      txnId: { group: 3, type: 'string' },
    };
  } else if (bank === 'Telebirr') {
    customRegex = '[Yy]ou\\s+have\\s+received\\s+ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*)\\s*\\(([\\d*]+)\\)\\s+on\\s+\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2}:\\d{2}\\.?\\s*[Yy]our\\s+transaction\\s+number\\s+is\\s+([A-Z0-9]{8,})';
    customExtractFields = {
      amount: { group: 1, type: 'number' },
      sender: { group: 2, type: 'string' },
      sendFrom: { group: 3, type: 'string' },
      txnId: { group: 4, type: 'string' },
    };
  } else {
    // Generic pattern
    customRegex = '(?:received|Credited\\s+with)\\s+(?:ETB|KES|USD)?\\s*([\\d,]+(?:\\.\\d{1,2})?).*?from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*).*?(?:Ref\\s+No|transaction\\s+number\\s+is|Reference)[:\\s]*([A-Z0-9]{6,})';
    customExtractFields = {
      amount: { group: 1, type: 'number' },
      sender: { group: 2, type: 'string' },
      txnId: { group: 3, type: 'string' },
    };
  }
  
  return {
    regex: customRegex,
    extractFields: customExtractFields,
    bank: bank || banks.senderBank || banks.receiverBank,
    currency: currency || 'ETB',
    extractedValues: {
      txnId,
      amount,
      sender,
      sendFrom: null,
      sendTo: null,
    },
    confidence: 0.7,
    method: 'generated',
  };
}

/**
 * Generate patterns for multiple SMS texts
 */
export function generateSmartPatternsMultiple(smsTexts: string[]): GeneratorResult[] {
  return smsTexts.map(text => generateSmartPattern(text));
}

/**
 * Get all available pattern templates
 */
export function getAvailableTemplates(): PatternTemplate[] {
  return bankPatternTemplates;
}

/**
 * Add a new pattern template
 */
export function addPatternTemplate(template: PatternTemplate): void {
  bankPatternTemplates.push(template);
}

