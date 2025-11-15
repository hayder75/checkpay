/**
 * Flexible field extraction using keyword-based detection
 * This extracts fields from SMS even when wording varies
 */

interface ExtractedFields {
  amount: number | null;
  sender: string | null;
  txnId: string | null;
  bank: string | null;
  currency: string | null;
  sendFrom: string | null;
  sendTo: string | null;
}

/**
 * Extract transaction ID using multiple keyword variations
 */
function extractTransactionId(text: string): string | null {
  const patterns = [
    /transaction\s+number\s+is\s+([A-Z0-9]{6,})/i, // "transaction number is CK660DRZ8I"
    /transaction\s+number\s+([A-Z0-9]{6,})/i, // "transaction number CK660DRZ8I"
    /transaction\s+id\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /by\s+transaction\s+number\s+([A-Z0-9]{6,})/i,
    /txn\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /ref\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /reference\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /id\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /transaction\s+no\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /txn\s+no\s*[: ]+\s*([A-Z0-9]{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 6) {
      return match[1].trim();
    }
  }

  // Fallback: Look for alphanumeric codes (6+ chars, mostly uppercase)
  const fallback = text.match(/\b([A-Z0-9]{6,})\b/);
  if (fallback && !fallback[1].match(/^\d{10,}$/) && !fallback[1].match(/^\d{4}-\d{2}-\d{2}/)) {
    return fallback[1];
  }

  return null;
}

/**
 * Extract amount using multiple patterns
 * Handles comma-separated numbers like 1,000.00
 */
function extractAmount(text: string, currency: string | null): number | null {
  // Pattern for comma-separated numbers: 1,000.00 or 1,000,000.50
  const commaNumberPattern = '\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?';
  
  const patterns = [
    // Currency before amount with commas: ETB 1,000.00
    currency ? new RegExp(`${currency}\\s*(${commaNumberPattern})`, 'i') : null,
    // Amount before currency with commas: 1,000.00 ETB
    currency ? new RegExp(`(${commaNumberPattern})\\s*${currency}`, 'i') : null,
    // Near keywords with commas
    new RegExp(`received\\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`credited\\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`transferred\\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`deposited\\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    new RegExp(`amount\\s*[: ]+\\s*(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(${commaNumberPattern})`, 'i'),
    // Fallback: simple numbers without commas (for backward compatibility)
    currency ? new RegExp(`${currency}\\s*(\\d+(?:\\.\\d+)?)`, 'i') : null,
    currency ? new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${currency}`, 'i') : null,
    /received\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d+(?:\.\d+)?)/i,
    /credited\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d+(?:\.\d+)?)/i,
  ].filter(Boolean) as RegExp[];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Don't match balance amounts
      const beforeMatch = text.substring(0, match.index || 0);
      if (!beforeMatch.match(/balance\s+is/i)) {
        // Remove commas before parsing: "1,000.00" -> "1000.00"
        const amountStr = match[1].replace(/,/g, '');
        return parseFloat(amountStr);
      }
    }
  }

  return null;
}

/**
 * Extract sender using multiple patterns
 */
function extractSender(text: string): string | null {
  const patterns = [
    /from\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /by\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /sent\s+by\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /sender\s*[: ]+\s*([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value && !value.match(/^(transaction|amount|date|time|ref|id)$/i)) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Extract send from (institution/account sending money)
 */
function extractSendFrom(text: string): string | null {
  const patterns = [
    /from\s+([A-Za-z0-9\s\-]+?)(?:\s+to|\s+account|\s+on|\.|$)/i,
    /sent\s+from\s+([A-Za-z0-9\s\-]+?)(?:\s+to|\s+account|\s+on|\.|$)/i,
    /transfer\s+from\s+([A-Za-z0-9\s\-]+?)(?:\s+to|\s+account|\s+on|\.|$)/i,
    /debit\s+from\s+([A-Za-z0-9\s\-]+?)(?:\s+to|\s+account|\s+on|\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      // Check if it looks like an institution name (not just a phone number)
      if (value && (value.length > 3 || value.match(/[A-Za-z]/))) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Extract send to (institution/account receiving money)
 */
function extractSendTo(text: string): string | null {
  const patterns = [
    /to\s+([A-Za-z0-9\s\-]+?)(?:\s+account|\s+on|\s+from|\.|$)/i,
    /sent\s+to\s+([A-Za-z0-9\s\-]+?)(?:\s+account|\s+on|\s+from|\.|$)/i,
    /transfer\s+to\s+([A-Za-z0-9\s\-]+?)(?:\s+account|\s+on|\s+from|\.|$)/i,
    /credit\s+to\s+([A-Za-z0-9\s\-]+?)(?:\s+account|\s+on|\s+from|\.|$)/i,
    /received\s+by\s+([A-Za-z0-9\s\-]+?)(?:\s+account|\s+on|\s+from|\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      // Check if it looks like an institution name (not just a phone number)
      if (value && (value.length > 3 || value.match(/[A-Za-z]/))) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Flexible extraction that works even if regex doesn't match perfectly
 */
export function flexibleExtract(smsText: string, pattern: any): ExtractedFields {
  const currency = pattern.currency || detectCurrency(smsText);
  const bank = pattern.bank || detectBank(smsText);

  // Try regex first
  try {
    // Remove (?i) flag if present (for backward compatibility with old patterns)
    let regexStr = pattern.regex;
    if (regexStr.startsWith('(?i)')) {
      regexStr = regexStr.substring(4);
    }
    regexStr = regexStr.replace(/\(\?i\)/g, ''); // Remove any (?i) flags
    
    const regex = new RegExp(regexStr, 'i');
    const match = smsText.match(regex);
    
    if (match && pattern.extractFields) {
      const extraction = pattern.extractFields;
      const txnId = match[extraction.txnId] || '';
      const amountStr = match[extraction.amount] || '';
      const sender = match[extraction.sender] || '';
      const amount = parseFloat(amountStr.replace(/[^\d.]/g, '')) || null;

      if (txnId && amount) {
        const sendFrom = match[extraction.sendFrom] || '';
        const sendTo = match[extraction.sendTo] || '';
        return {
          txnId: txnId.trim(),
          amount,
          sender: sender.trim() || null,
          bank,
          currency,
          sendFrom: sendFrom.trim() || null,
          sendTo: sendTo.trim() || null,
        };
      }
    }
  } catch (error) {
    console.error('Regex extraction failed:', error);
  }

  // Fallback: keyword-based extraction
  const txnId = extractTransactionId(smsText);
  const amount = extractAmount(smsText, currency);
  const sender = extractSender(smsText);
  const sendFrom = extractSendFrom(smsText);
  const sendTo = extractSendTo(smsText);

  return {
    txnId: txnId || null,
    amount,
    sender,
    bank,
    currency,
    sendFrom,
    sendTo,
  };
}

function detectCurrency(text: string): string | null {
  const currencies = [
    { code: 'ETB', patterns: ['ETB', 'Birr'] },
    { code: 'KES', patterns: ['KES', 'Ksh'] },
    { code: 'NGN', patterns: ['NGN', 'Naira'] },
    { code: 'GHS', patterns: ['GHS', 'Cedi'] },
  ];

  const upperText = text.toUpperCase();
  for (const currency of currencies) {
    if (currency.patterns.some(p => upperText.includes(p.toUpperCase()))) {
      return currency.code;
    }
  }
  return null;
}

function detectBank(text: string): string | null {
  const banks = [
    'Telebirr', 'Commercial Bank of Ethiopia', 'CBE',
    'M-Pesa', 'MTN MoMo', 'Airtel Money',
  ];

  const upperText = text.toUpperCase();
  for (const bank of banks) {
    if (upperText.includes(bank.toUpperCase())) {
      return bank;
    }
  }
  return null;
}

