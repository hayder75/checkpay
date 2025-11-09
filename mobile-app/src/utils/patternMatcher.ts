import { Pattern } from '../types';

/**
 * Match SMS text against a pattern and extract transaction data
 */
export function matchPattern(smsText: string, pattern: Pattern): {
  matched: boolean;
  data?: {
    txnId: string;
    amount: number;
    sender: string;
    bank: string;
    pattern: string;
  };
} {
  try {
    // Try to match the regex first
    // Remove (?i) flag if present (JavaScript doesn't support inline flags)
    // Backend generates regex with (?i) prefix, but we use 'i' flag in constructor
    let regexStr = pattern.regex;
    if (regexStr.startsWith('(?i)')) {
      regexStr = regexStr.substring(4); // Remove (?i) prefix
    }
    // Also handle (?i) in the middle (shouldn't happen, but just in case)
    regexStr = regexStr.replace(/\(\?i\)/g, '');
    
    const regex = new RegExp(regexStr, 'i');
    const match = smsText.match(regex);

    // If regex doesn't match, try keyword-based extraction (fallback)
    if (!match) {
      // Fallback: Use keyword-based extraction (like backend's flexibleExtract)
      return extractWithKeywords(smsText, pattern);
    }
    
    // Even if regex matches, validate that we got meaningful data
    // If regex matched but extracted wrong values, use keyword fallback
    const extraction = (pattern.extraction || pattern.extractFields) as Record<string, any>;
    const txnIdFromRegex = extraction.txnId ? (match[extraction.txnId] || '').trim() : '';
    const amountFromRegex = extraction.amount ? (match[extraction.amount] || '').trim() : '';
    
    // If regex matched but got invalid data (like "is" for txnId), use keyword fallback
    if (txnIdFromRegex && txnIdFromRegex.length < 6) {
      // Transaction ID is too short (probably matched "is" or similar)
      console.log('[PATTERN] Regex extracted invalid txnId:', txnIdFromRegex, '- using keyword fallback');
      return extractWithKeywords(smsText, pattern);
    }
    
    if (amountFromRegex && !amountFromRegex.match(/^\d/)) {
      // Amount doesn't start with digit, probably wrong
      console.log('[PATTERN] Regex extracted invalid amount:', amountFromRegex, '- using keyword fallback');
      return extractWithKeywords(smsText, pattern);
    }
    
    // Also check if txnId looks like a common word (is, the, etc.)
    const commonWords = ['is', 'the', 'and', 'or', 'to', 'from', 'by', 'on', 'at', 'in'];
    if (txnIdFromRegex && commonWords.includes(txnIdFromRegex.toLowerCase())) {
      console.log('[PATTERN] Regex extracted common word as txnId:', txnIdFromRegex, '- using keyword fallback');
      return extractWithKeywords(smsText, pattern);
    }

    // Extract data based on pattern extraction rules
    // Backend uses extractFields, but we'll support both
    
    // Try multiple field name variations and positions
    let txnId = '';
    if (extraction.txnId) {
      txnId = match[extraction.txnId] || '';
    }
    // Fallback: try all possible positions
    if (!txnId) {
      for (let i = 1; i < match.length; i++) {
        const value = match[i];
        // Check if it looks like a transaction ID (alphanumeric, 6+ chars, not a phone number)
        if (value && value.match(/^[A-Z0-9]{6,}$/) && !value.match(/^\d{10,}$/)) {
          txnId = value;
          break;
        }
      }
    }
    
    let amountStr = '';
    if (extraction.amount) {
      amountStr = match[extraction.amount] || '';
    }
    // Fallback: find first number that looks like money (with or without commas)
    if (!amountStr) {
      for (let i = 1; i < match.length; i++) {
        const value = match[i];
        // Match numbers with or without commas: 1,000.00 or 1000.00
        if (value && (value.match(/^\d{1,3}(?:,\d{3})*\.\d{2}$/) || value.match(/^\d+\.\d{2}$/))) {
          amountStr = value;
          break;
        }
      }
    }
    
    let sender = '';
    if (extraction.sender) {
      sender = match[extraction.sender] || '';
    }
    // Fallback: try to find sender
    if (!sender && extraction.sender) {
      for (let i = 1; i < match.length; i++) {
        const value = match[i];
        if (value && value.length > 3 && !value.match(/^\d+/) && value !== txnId && value !== amountStr) {
          sender = value;
          break;
        }
      }
    }
    
    const bank = extraction.bank || pattern.bank || pattern.name || 'Unknown';

    // Parse amount (remove currency symbols and commas)
    const amount = parseFloat(amountStr.replace(/[^\d.]/g, '')) || 0;

    // Require at least transaction ID OR amount
    if (!txnId && !amount) {
      return { matched: false };
    }
    
    // If we have amount but no txnId, try to extract txnId from text directly
    if (amount && !txnId) {
      const txnIdMatch = smsText.match(/(?:transaction\s+number|txn|ref|id)\s*[: ]?\s*([A-Z0-9]+)/i);
      if (txnIdMatch && txnIdMatch[1]) {
        txnId = txnIdMatch[1];
      }
    }
    
    // If we have txnId but no amount, try to extract amount from text directly (with commas)
    if (txnId && !amount) {
      // Match amounts with or without commas: 1,000.00 or 1000.00
      const amountMatch = smsText.match(/(?:received|credited|transferred|deposited|amount)\s*(?:ETB|KES|NGN|GHS)?\s*(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/i);
      if (amountMatch && amountMatch[1]) {
        amountStr = amountMatch[1];
        // Remove commas before parsing
        const parsedAmount = parseFloat(amountStr.replace(/,/g, ''));
        if (parsedAmount) {
          return {
            matched: true,
            data: {
              txnId: txnId.trim(),
              amount: parsedAmount,
              sender: sender.trim() || '',
              bank: bank.trim(),
              pattern: pattern.name,
            },
          };
        }
      }
    }
    
    if (!txnId || !amount) {
      return { matched: false };
    }

    return {
      matched: true,
      data: {
        txnId: txnId.trim(),
        amount,
        sender: sender.trim(),
        bank: bank.trim(),
        pattern: pattern.name,
      },
    };
  } catch (error) {
    console.error('Pattern matching error:', error);
    return { matched: false };
  }
}

/**
 * Keyword-based extraction fallback (when regex doesn't match)
 * This allows patterns to work even if the SMS structure varies slightly
 */
function extractWithKeywords(smsText: string, pattern: Pattern): {
  matched: boolean;
  data?: {
    txnId: string;
    amount: number;
    sender: string;
    bank: string;
    pattern: string;
  };
} {
  // Extract transaction ID (require 6+ chars to avoid matching "is", "the", etc.)
  const txnIdPatterns = [
    /transaction\s+number\s+is\s+([A-Z0-9]{6,})/i, // "transaction number is CK660DRZ8I"
    /transaction\s+number\s+([A-Z0-9]{6,})/i, // "transaction number CK660DRZ8I"
    /by\s+transaction\s+number\s+([A-Z0-9]{6,})/i,
    /transaction\s+id\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /txn\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /ref\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /reference\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /id\s*[: ]+\s*([A-Z0-9]{6,})/i,
  ];
  
  let txnId = '';
  for (const p of txnIdPatterns) {
    const m = smsText.match(p);
    if (m && m[1] && m[1].length >= 6) {
      txnId = m[1].trim();
      break;
    }
  }
  
  // Fallback: look for alphanumeric codes (6+ chars)
  if (!txnId) {
    const fallback = smsText.match(/\b([A-Z0-9]{6,})\b/);
    if (fallback && !fallback[1].match(/^\d{10,}$/) && !fallback[1].match(/^\d{4}-\d{2}-\d{2}/)) {
      txnId = fallback[1];
    }
  }
  
  // Extract amount (with comma support)
  const commaNumberPattern = '\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?';
  const currency = pattern.currency || 'ETB|KES|NGN|GHS';
  const amountPatterns = [
    new RegExp(`${currency}\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`(${commaNumberPattern})\\s*${currency}`, 'i'),
    new RegExp(`received\\s+(?:${currency})?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`credited\\s+(?:${currency})?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`transferred\\s+(?:${currency})?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`deposited\\s+(?:${currency})?\\s*(${commaNumberPattern})`, 'i'),
  ];
  
  let amount = 0;
  for (const p of amountPatterns) {
    const m = smsText.match(p);
    if (m && m[1]) {
      const beforeMatch = smsText.substring(0, m.index || 0);
      if (!beforeMatch.match(/balance\s+is/i)) {
        const amountStr = m[1].replace(/,/g, '');
        amount = parseFloat(amountStr) || 0;
        if (amount > 0) break;
      }
    }
  }
  
  // Extract sender
  const senderPatterns = [
    /from\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /by\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /sent\s+by\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
  ];
  
  let sender = '';
  for (const p of senderPatterns) {
    const m = smsText.match(p);
    if (m && m[1]) {
      const value = m[1].trim();
      if (value && !value.match(/^(transaction|amount|date|time|ref|id)$/i)) {
        sender = value;
        break;
      }
    }
  }
  
  // Detect bank from SMS if pattern has a bank
  let detectedBank = '';
  const bankKeywords = ['Telebirr', 'Commercial Bank of Ethiopia', 'CBE', 'M-Pesa', 'MTN', 'Airtel'];
  const upperSms = smsText.toUpperCase();
  for (const keyword of bankKeywords) {
    if (upperSms.includes(keyword.toUpperCase())) {
      detectedBank = keyword;
      break;
    }
  }
  
  // If pattern has a specific bank, check if it matches
  if (pattern.bank && detectedBank && pattern.bank.toUpperCase() !== detectedBank.toUpperCase()) {
    // Bank doesn't match, but still allow if we have txnId and amount
    // (some patterns might be generic)
  }
  
  const bank = pattern.bank || detectedBank || pattern.name || 'Unknown';
  
  // Require at least transaction ID OR amount
  if (!txnId && !amount) {
    return { matched: false };
  }
  
  return {
    matched: true,
    data: {
      txnId: txnId || 'N/A',
      amount: amount || 0,
      sender: sender || '',
      bank: bank.trim(),
      pattern: pattern.name,
    },
  };
}

/**
 * Find matching pattern for SMS text
 */
export function findMatchingPattern(smsText: string, patterns: Pattern[]): Pattern | null {
  for (const pattern of patterns) {
    const result = matchPattern(smsText, pattern);
    if (result.matched) {
      return pattern;
    }
  }
  return null;
}
