/**
 * Extract actual values from SMS text using keyword-based detection
 * This is used to show preview of what will be extracted
 */

interface ExtractedData {
  amount: number | null;
  sender: string | null;
  txnId: string | null;
  bank: string | null;
  currency: string | null;
}

/**
 * Extract transaction ID from SMS
 */
function extractTxnId(text: string): string | null {
  const patterns = [
    /transaction\s+number\s+is\s+([A-Z0-9]{6,})/i, // "transaction number is CK660DRZ8I"
    /transaction\s+number\s+([A-Z0-9]{6,})/i, // "transaction number CK660DRZ8I"
    /by\s+transaction\s+number\s+([A-Z0-9]{6,})/i,
    /transaction\s+id\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /txn\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /ref\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /reference\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /id\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /transaction\s+no\s*[: ]+\s*([A-Z0-9]{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 6) {
      return match[1].trim();
    }
  }

  // Fallback: look for alphanumeric codes (6+ chars)
  const fallback = text.match(/\b([A-Z0-9]{6,})\b/);
  if (fallback && !fallback[1].match(/^\d{10,}$/) && !fallback[1].match(/^\d{4}-\d{2}-\d{2}/)) {
    return fallback[1];
  }

  return null;
}

/**
 * Extract amount from SMS
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
    // Generic patterns with commas
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
 * Extract sender from SMS
 */
function extractSender(text: string): string | null {
  const patterns = [
    /from\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /by\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
    /sent\s+by\s+([^\n\.]+?)(?:\s+to|\s+on|\.|$)/i,
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
 * Detect currency
 */
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

/**
 * Detect bank
 */
function detectBank(text: string): string | null {
  const banks = [
    'Telebirr', 'Ethio telecom',
    'Commercial Bank of Ethiopia', 'CBE',
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

/**
 * Extract actual values from SMS text
 */
export function extractActualValues(smsText: string): ExtractedData {
  const currency = detectCurrency(smsText);
  const bank = detectBank(smsText);
  const txnId = extractTxnId(smsText);
  const amount = extractAmount(smsText, currency);
  const sender = extractSender(smsText);

  return {
    amount,
    sender,
    txnId,
    bank,
    currency,
  };
}

