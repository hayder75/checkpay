/**
 * AI-powered pattern generation from SMS
 * Uses keyword-based extraction to handle variations in wording
 * Can use country-specific templates for better accuracy
 */

import { getCountryTemplate } from './countryTemplates';

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
  // Handle "transaction number is X" pattern specifically
  const txnIdPatterns = [
    /transaction\s+number\s+is\s+([A-Z0-9]{6,})/i, // "transaction number is CK660DRZ8I"
    /transaction\s+number\s+([A-Z0-9]{6,})/i, // "transaction number CK660DRZ8I"
    /transaction\s+id\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /txn\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /ref\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /reference\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /id\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /transaction\s+no\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /txn\s+no\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /by\s+transaction\s+number\s+([A-Z0-9]{6,})/i,
  ];

  for (const pattern of txnIdPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 6) {
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
 * Handles comma-separated numbers like 1,000.00
 */
function findAmount(text: string, currency: string | null): { value: string; position: number } | null {
  // Pattern for comma-separated numbers: 1,000.00 or 1,000,000.50
  // Matches: \d{1,3}(?:,\d{3})*(?:\.\d+)?
  const commaNumberPattern = '\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?';
  
  // Patterns for amount detection
  const amountPatterns = [
    // Currency before amount: ETB 1,000.00, ETB 200.00, KES 500
    currency ? new RegExp(`${currency}\\s*(${commaNumberPattern})`, 'i') : null,
    // Amount before currency: 1,000.00 ETB, 200.00 ETB, 500 KES
    currency ? new RegExp(`(${commaNumberPattern})\\s*${currency}`, 'i') : null,
    // Generic amount patterns near keywords (with commas)
    new RegExp(`received\\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`credited\\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`transferred\\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`deposited\\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`amount\\s*[: ]+\\s*(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    // Generic: any number that looks like money (with commas)
    new RegExp(`(${commaNumberPattern})\\s*(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR|Birr|Shilling|Naira|Cedi)`, 'i'),
    // Fallback: simple numbers without commas (for backward compatibility)
    currency ? new RegExp(`${currency}\\s*(\\d+(?:\\.\\d+)?)`, 'i') : null,
    currency ? new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${currency}`, 'i') : null,
    /received\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d+(?:\.\d+)?)/i,
    /credited\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d+(?:\.\d+)?)/i,
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
 * @param smsText - The SMS text to analyze
 * @param patternName - Name for the pattern
 * @param countryCode - Optional country code to use country-specific templates
 */
export function generatePatternFromSMS(
  smsText: string,
  patternName: string,
  countryCode?: string | null
): GeneratedPattern {
  // Get country template if country code provided
  const countryTemplate = countryCode ? getCountryTemplate(countryCode) : null;
  
  // Use country-specific currency detection if template available
  const currency = countryTemplate
    ? countryTemplate.currencies.find(c => 
        smsText.toUpperCase().includes(c.toUpperCase())
      ) || detectCurrency(smsText)
    : detectCurrency(smsText);
  
  // Use country-specific bank detection if template available
  const bank = countryTemplate
    ? countryTemplate.banks.find(b => 
        smsText.toUpperCase().includes(b.toUpperCase())
      ) || detectBank(smsText)
    : detectBank(smsText);

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

  // Build transaction ID pattern (use country template if available)
  if (txnIdMatch) {
    const txnIdKeywords = countryTemplate && countryTemplate.txnIdPatterns.length > 0
      ? countryTemplate.txnIdPatterns.join('|')
      : [
          'transaction\\s+number',
          'by\\s+transaction\\s+number',
          'transaction\\s+id',
          'txn',
          'ref',
          'reference',
          'id',
        ].join('|');
    // Require transaction ID to be at least 6 characters (avoids matching "is", "the", etc.)
    // Also handle "transaction number is" or "transaction number:" patterns
    regexParts.push(`(?:${txnIdKeywords})\\s*(?:is|[: ])?\\s*([A-Z0-9]{6,})`);
    extractFields.txnId = groupIndex++;
  }

  // Build amount pattern (use country template if available)
  // Pattern for comma-separated numbers: \d{1,3}(?:,\d{3})*(?:\.\d+)?
  const commaNumberPattern = '\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?';
  
  if (amountMatch) {
    const amountKeywords = countryTemplate && countryTemplate.amountPatterns.length > 0
      ? countryTemplate.amountPatterns.join('|')
      : ['received', 'credited', 'transferred', 'deposited'].join('|');
    
    const currencyList = countryTemplate && countryTemplate.currencies.length > 0
      ? countryTemplate.currencies.join('|')
      : currency || 'ETB|KES|NGN|GHS';
    
    if (currency) {
      // Use comma-aware pattern: handles 1,000.00 and 1000.00
      regexParts.push(`(?:${amountKeywords})\\s*(?:${currency})?\\s*(${commaNumberPattern})`);
    } else {
      regexParts.push(`(?:${amountKeywords})\\s*(?:${currencyList})?\\s*(${commaNumberPattern})`);
    }
    extractFields.amount = groupIndex++;
  } else if (currency) {
    // Fallback: match currency amount (with comma support)
    regexParts.push(`${currency}\\s*(${commaNumberPattern})`);
    extractFields.amount = groupIndex++;
  }

  // Build sender pattern (use country template if available)
  if (senderMatch) {
    const senderKeywords = countryTemplate && countryTemplate.senderPatterns.length > 0
      ? countryTemplate.senderPatterns.join('|')
      : ['from', 'by', 'sent\\s+by'].join('|');
    regexParts.push(`(?:${senderKeywords})\\s+([^\\n\\.]+?)(?=\\s+to|\\s+on|\\.|$)`);
    extractFields.sender = groupIndex++;
  }

  // Combine parts with flexible matching
  // Use more flexible matching: allow parts in any order with generous spacing
  if (regexParts.length > 0) {
    // Make the regex truly order-independent by using lookahead or making parts optional
    // For now, use very generous .*? between parts (allows any order)
    // The .*? is non-greedy, so it will match the shortest possible string
    // This allows fields to appear in any order
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

  // Don't add (?i) prefix - JavaScript RegExp uses 'i' flag in constructor instead
  // The (?i) syntax is for PCRE (Perl Compatible Regular Expressions), not JavaScript
  // We'll use the 'i' flag when creating RegExp objects
  return {
    name: patternName,
    regex: regex, // No (?i) prefix - use 'i' flag in RegExp constructor
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
