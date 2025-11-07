/**
 * AI-powered pattern generation from SMS
 * Uses keyword-based extraction to handle variations in wording
 */

interface PatternExtraction {
  amount: number | null;
  sender: number | null;
  txnId: number | null;
  bank: number | null;
  currency: string | null;
  [key: string]: number | string | null;
}

interface GeneratedPattern {
  name: string;
  regex: string;
  extractFields: PatternExtraction;
  bank: string | null;
  currency: string | null;
}

/**
 * Detects currency from SMS text
 */
function detectCurrency(text: string): string | null {
  const currencies = [
    { code: 'KES', patterns: ['KES', 'Ksh', 'Kenya Shilling', 'Kenyan Shilling'] },
    { code: 'ETB', patterns: ['ETB', 'Birr', 'Ethiopian Birr'] },
    { code: 'NGN', patterns: ['NGN', 'Naira', '₦', 'Nigerian Naira'] },
    { code: 'GHS', patterns: ['GHS', 'Cedi', 'Ghana Cedi'] },
    { code: 'UGX', patterns: ['UGX', 'Uganda Shilling'] },
    { code: 'TZS', patterns: ['TZS', 'Tanzania Shilling'] },
    { code: 'RWF', patterns: ['RWF', 'Rwanda Franc'] },
    { code: 'ZAR', patterns: ['ZAR', 'Rand', 'R', 'South African Rand'] },
  ];

  const upperText = text.toUpperCase();
  for (const currency of currencies) {
    if (currency.patterns.some(p => upperText.includes(p.toUpperCase()))) {
      return currency.code;
    }
  }
  return null;
}

/**
 * Detects bank/service name from SMS
 */
function detectBank(text: string): string | null {
  const banks = [
    'M-Pesa', 'Mpesa', 'MPesa',
    'Telebirr', 'Telebir', 'Ethio telecom',
    'MTN MoMo', 'MTN Mobile Money', 'MTN',
    'Airtel Money', 'Airtel',
    'CBE Birr', 'CBE', 'Commercial Bank of Ethiopia',
    'Equity', 'KCB', 'Cooperative Bank',
    'Access Bank', 'GTBank', 'Zenith Bank',
    'Vodafone Cash', 'Tigo Pesa',
  ];

  const upperText = text.toUpperCase();
  for (const bank of banks) {
    if (upperText.includes(bank.toUpperCase())) {
      return bank;
    }
  }
  return null;
}

/**
 * Find transaction ID using multiple keyword variations
 */
function findTransactionId(text: string): { value: string; position: number } | null {
  // Multiple variations of transaction ID keywords
  const txnIdPatterns = [
    /transaction\s+number\s+([A-Z0-9]+)/i,
    /transaction\s+id\s*[: ]+([A-Z0-9]+)/i,
    /txn\s*[: ]+([A-Z0-9]+)/i,
    /ref\s*[: ]+([A-Z0-9]+)/i,
    /reference\s*[: ]+([A-Z0-9]+)/i,
    /id\s*[: ]+([A-Z0-9]+)/i,
    /transaction\s+no\s*[: ]+([A-Z0-9]+)/i,
    /txn\s+no\s*[: ]+([A-Z0-9]+)/i,
    /by\s+transaction\s+number\s+([A-Z0-9]+)/i,
  ];

  for (const pattern of txnIdPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return { value: match[1], position: match.index || 0 };
    }
  }

  // Fallback: Look for alphanumeric codes that look like transaction IDs (6+ chars, mostly uppercase)
  const fallbackMatch = text.match(/\b([A-Z0-9]{6,})\b/);
  if (fallbackMatch) {
    // Check if it's not a phone number or date
    const value = fallbackMatch[1];
    if (!value.match(/^\d{10,}$/) && !value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return { value, position: fallbackMatch.index || 0 };
    }
  }

  return null;
}

/**
 * Find amount using multiple patterns
 */
function findAmount(text: string, currency: string | null): { value: string; position: number } | null {
  // Patterns for amount detection
  const amountPatterns = [
    // Currency before amount: ETB 200.00, KES 500
    currency ? new RegExp(`${currency}\\s*(\\d+(?:\\.\\d+)?)`, 'i') : null,
    // Amount before currency: 200.00 ETB, 500 KES
    currency ? new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${currency}`, 'i') : null,
    // Generic amount patterns near keywords
    /received\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d+(?:\.\d+)?)/i,
    /credited\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d+(?:\.\d+)?)/i,
    /transferred\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d+(?:\.\d+)?)/i,
    /deposited\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d+(?:\.\d+)?)/i,
    /amount\s*[: ]+\s*(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d+(?:\.\d+)?)/i,
    // Generic: any number that looks like money
    /(\d+(?:\.\d{2})?)\s*(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR|Birr|Shilling|Naira|Cedi)/i,
  ].filter(Boolean) as RegExp[];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Don't match balance amounts (usually after "balance is")
      const beforeMatch = text.substring(0, match.index || 0);
      if (!beforeMatch.match(/balance\s+is/i)) {
        return { value: match[1], position: match.index || 0 };
      }
    }
  }

  return null;
}

/**
 * Find sender using multiple patterns
 */
function findSender(text: string): { value: string; position: number } | null {
  const senderPatterns = [
    /from\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /by\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /sent\s+by\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /sender\s*[: ]+\s*([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
  ];

  for (const pattern of senderPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      // Filter out common false positives
      if (value && !value.match(/^(transaction|amount|date|time|ref|id)$/i)) {
        return { value, position: match.index || 0 };
      }
    }
  }

  return null;
}

/**
 * Generates a flexible regex pattern from SMS text using keyword-based extraction
 */
export function generatePatternFromSMS(smsText: string, patternName: string): GeneratedPattern {
  const currency = detectCurrency(smsText);
  const bank = detectBank(smsText);

  // Find all fields using keyword-based detection
  const txnIdMatch = findTransactionId(smsText);
  const amountMatch = findAmount(smsText, currency);
  const senderMatch = findSender(smsText);

  // Build flexible regex that matches the structure
  const extractFields: PatternExtraction = {
    amount: null,
    sender: null,
    txnId: null,
    bank: null,
    currency: null,
  };

  let groupIndex = 1;
  let regexParts: string[] = [];
  let regex = '';

  // Build a simpler, more flexible regex
  // Instead of trying to match the entire message, we'll create patterns for key fields

  // Build transaction ID pattern
  if (txnIdMatch) {
    const txnIdKeywords = [
      'transaction\\s+number',
      'by\\s+transaction\\s+number',
      'transaction\\s+id',
      'txn',
      'ref',
      'reference',
      'id',
    ].join('|');
    regexParts.push(`(?:${txnIdKeywords})\\s*[: ]?\\s*([A-Z0-9]+)`);
    extractFields.txnId = groupIndex++;
  }

  // Build amount pattern
  if (amountMatch) {
    const amountKeywords = ['received', 'credited', 'transferred', 'deposited'].join('|');
    if (currency) {
      regexParts.push(`(?:${amountKeywords})\\s*(?:${currency})?\\s*(\\d+(?:\\.\\d+)?)`);
    } else {
      regexParts.push(`(?:${amountKeywords})\\s*(?:ETB|KES|NGN|GHS)?\\s*(\\d+(?:\\.\\d+)?)`);
    }
    extractFields.amount = groupIndex++;
  } else if (currency) {
    // Fallback: match currency amount
    regexParts.push(`${currency}\\s*(\\d+(?:\\.\\d+)?)`);
    extractFields.amount = groupIndex++;
  }

  // Build sender pattern
  if (senderMatch) {
    const senderKeywords = ['from', 'by', 'sent\\s+by'].join('|');
    regexParts.push(`(?:${senderKeywords})\\s+([^\\n\\.]+?)(?=\\s+to|\\s+on|\\.|$)`);
    extractFields.sender = groupIndex++;
  }

  // Combine parts with flexible matching
  if (regexParts.length > 0) {
    regex = regexParts.join('.*?');
  } else {
    // Ultimate fallback: simple pattern
    regex = smsText
      .replace(/\d+\.\d{2}/g, '(\\d+(?:\\.\\d+)?)')
      .replace(/\b([A-Z0-9]{6,})\b/g, (match, id) => {
        if (!id.match(/^\d{10,}$/) && !id.match(/^\d{4}-\d{2}-\d{2}/)) {
          return '([A-Z0-9]+)';
        }
        return match;
      })
      .replace(/\s+/g, '\\s+')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (!extractFields.amount) extractFields.amount = 1;
    if (!extractFields.txnId) extractFields.txnId = 2;
  }

  // Finalize regex - make it case-insensitive
  if (!regex) {
    // Ultimate fallback: simple pattern
    regex = smsText
      .replace(/\d+\.\d{2}/g, '(\\d+(?:\\.\\d+)?)')
      .replace(/\b([A-Z0-9]{6,})\b/g, (match, id) => {
        if (!id.match(/^\d{10,}$/) && !id.match(/^\d{4}-\d{2}-\d{2}/)) {
          return '([A-Z0-9]+)';
        }
        return match;
      })
      .replace(/\s+/g, '\\s+')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (!extractFields.amount) extractFields.amount = 1;
    if (!extractFields.txnId) extractFields.txnId = 2;
  }

  return {
    name: patternName,
    regex: `(?i)${regex}`,
    extractFields,
    bank,
    currency,
  };
}

/**
 * Validates a pattern to ensure it has required fields
 */
export function validatePattern(pattern: GeneratedPattern): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!pattern.regex || pattern.regex.length < 5) {
    errors.push('Regex pattern is too short or invalid');
  }

  if (!pattern.extractFields.amount && !pattern.extractFields.txnId) {
    errors.push('Pattern must extract at least amount or transaction ID');
  }

  // Currency is recommended but not required (make it a warning, not error)
  if (!pattern.currency) {
    // Only warn, don't fail validation
    console.warn('Pattern does not detect a currency - this is recommended but not required');
  }

  return {
    valid: errors.length === 0 || errors.every(e => e.startsWith('Warning:')),
    errors,
  };
}
