/**
 * Enhanced Regex Generator with Multi-Language Support
 * Supports English, Amharic, and other common languages
 * Focused on extracting key values: transaction ID, amount, sender, reference ID
 */
import { extractTransactionIds } from './transactionIdExtractor';
import { extractBanksFromText } from './sameBankValidator';

// Language-specific keywords for transaction SMS
const languageKeywords = {
  english: {
    transactionId: ['transaction number', 'transaction id', 'txn', 'txn no', 'ref', 'reference', 'bank ref'],
    amount: ['amount', 'received', 'credited', 'debited', 'balance', 'etb', 'kes', 'ngn', 'usd'],
    sender: ['from', 'dear', 'sender', 'sent by'],
    received: ['received', 'credited', 'deposited'],
    sent: ['sent', 'debited', 'transferred'],
  },
  amharic: {
    transactionId: ['የግብይት', 'ግብይት', 'የገንዘብ ዝውውር', 'መለያ', 'ቁጥር', 'የማጣቀሻ', 'ማጣቀሻ'],
    amount: ['መጠን', 'ብር', 'ከ', 'ወደ', 'ቀሪ ሒሳብ'],
    sender: ['ከ', 'ውድ', 'ያገኘው', 'በ'],
    received: ['ተቀብለዋል', 'ደርሷል', 'ተገኘ'],
    sent: ['ተላከ', 'ወጣ', 'ተሰጠ'],
  },
};

interface ExtractionResult {
  regex: string;
  extractFields: any;
  bank: string | null;
  currency: string | null;
  extractedValues: {
    txnId: string | null;
    referenceTxnId: string | null;
    amount: number | null;
    sender: string | null;
    senderBank: string | null;
    receiverBank: string | null;
    currency: string | null;
  };
  confidence: number; // 0-1 score of how confident we are in the extraction
}

/**
 * Detect language from SMS text
 */
function detectLanguage(smsText: string): 'english' | 'amharic' | 'mixed' {
  const amharicPattern = /[\u1200-\u137F]/; // Amharic Unicode range
  const hasAmharic = amharicPattern.test(smsText);
  const hasEnglish = /[a-zA-Z]/.test(smsText);
  if (hasAmharic && hasEnglish) return 'mixed';
  if (hasAmharic) return 'amharic';
  return 'english';
}

/**
 * Extract amount with multi-language support
 * Returns {value, original} to preserve exact format for matching
 */
function extractAmount(smsText: string, language: string): {value: number, original: string} | null {
  const upperText = smsText.toUpperCase();

  // Currency patterns (universal)
  const currencyPatterns = [
    /(?:ETB|KES|NGN|GHS|USD|EUR)\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*(?:ETB|KES|NGN|GHS|USD|EUR)/i,
    /(?:ብር|birr)\s*([\d,]+\.?\d*)/i, // Amharic "birr"
    /([\d,]+\.?\d*)\s*(?:ብር|birr)/i,
  ];
  // Amount keywords (language-specific)
  const amountKeywords = {
    english: [/amount[:\s]+([\d,]+\.?\d*)/i, /received[:\s]+(?:ETB|KES|NGN|USD|EUR)?\s*([\d,]+\.?\d*)/i],
    amharic: [/መጠን[:\s]+([\d,]+\.?\d*)/i, /([\d,]+\.?\d*)\s*ብር/i],
    mixed: [/amount[:\s]+([\d,]+\.?\d*)/i, /([\d,]+\.?\d*)\s*(?:ETB|KES|NGN|USD|EUR|ብር)/i],
  };
  // Try currency patterns first
  for (const pattern of currencyPatterns) {
    const match = smsText.match(pattern);
    if (match && match[1]) {
      const amountStr = match[1].replace(/,/g, '');
      const parsed = parseFloat(amountStr);
      if (!isNaN(parsed) && parsed > 0) {
        return {value: parsed, original: match[1]};
      }
    }
  }
  // Try language-specific patterns
  const patterns = amountKeywords[language as keyof typeof amountKeywords] || amountKeywords.english;
  for (const pattern of patterns) {
    const match = smsText.match(pattern);
    if (match && match[1]) {
      const amountStr = match[1].replace(/,/g, '');
      const parsed = parseFloat(amountStr);
      if (!isNaN(parsed) && parsed > 0) {
        return {value: parsed, original: match[1]};
      }
    }
  }
  // Fallback: look for numbers with currency context
  const numberPattern = /([\d,]+\.?\d{2})\s*(?:ETB|KES|NGN|USD|EUR|ብር|birr)/i;
  const match = smsText.match(numberPattern);
  if (match && match[1]) {
    const amountStr = match[1].replace(/,/g, '');
    const parsed = parseFloat(amountStr);
    if (!isNaN(parsed) && parsed > 0) {
      return {value: parsed, original: match[1]};
    }
  }
  return null;
}

/**
 * Extract sender name with multi-language support
 */
function extractSender(smsText: string, language: string): string | null {
  const senderPatterns = {
    english: [
      /from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+to|\s+on|\.|\(|$)/i,
      /received\s+from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+on|\.|\(|$)/i,
      /credited\s+with\s+.*?\s+from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*,|\s+on|\.|$)/i,
      /from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)\s*\(/i,
      /sender[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s|$)/i,
      /dear\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*\n|,|\.|your|account|you)/i,
    ],
    amharic: [
      /ውድ\s+([^\s]+(?:\s+[^\s]+){0,4})(?:\s*\n|,|\.|፣)/i,
      /ከ([^\s]+(?:\s+[^\s]+){0,4})(?:\s+በ|\s+ወደ|\.|፣)/i,
      /([A-Za-z]+(?:\s+[A-Za-z]+)*?)\s*\(?\d{3,}\)/i,
      /ለ([^\s]+(?:\s+[^\s]+){0,4})\s+\d/i,
    ],
    mixed: [
      /(?:dear|ውድ)\s+([A-Za-z\u1200-\u137F]+(?:\s+[A-Za-z\u1200-\u137F]+)*?)(?:\s*\n|,|\.)/i,
      /(?:from|ከ)\s+([A-Za-z\u1200-\u137F]+(?:\s+[A-Za-z\u1200-\u137F]+)*?)(?:\s+to|\s+on|\.|\(|$)/i,
      /([A-Za-z\u1200-\u137F]+(?:\s+[A-Za-z\u1200-\u137F]+)*?)\s*\(?\d{3,}\)/i,
    ],
  };
  const patterns = senderPatterns[language as keyof typeof senderPatterns] || senderPatterns.english;

  for (const pattern of patterns) {
    const match = smsText.match(pattern);
    if (match && match[1]) {
      const sender = match[1].trim();
      const cleaned = sender
        .replace(/\s*\n.*$/, '') // Remove everything after newline
        .replace(/\s*(\(|\)|,|\.|፣).*$/, '') // Remove suffixes
        .trim();
      if (cleaned.length > 2 && cleaned.length < 50) {
        return cleaned;
      }
    }
  }
  return null;
}

/**
 * Generate regex pattern from SMS text with multi-language support
 * Simplified and fast - focuses on extracting key values (txnId, amount, sender, referenceTxnId)
 */
export function generateRegexPattern(smsText: string): ExtractionResult {
  const language = detectLanguage(smsText);

  // Extract transaction IDs
  const extractedIds = extractTransactionIds(smsText);

  // Extract banks
  const banks = extractBanksFromText(smsText);

  // Extract amount (now an object)
  const amountObj = extractAmount(smsText, language);
  const amount = amountObj ? amountObj.value : null;
  const amountStr = amountObj ? amountObj.original : null;

  // Extract sender
  const sender = extractSender(smsText, language);

  // Determine currency
  let currency: string | null = null;
  if (smsText.match(/ETB|ብር|birr/i)) currency = 'ETB';
  else if (smsText.match(/KES/i)) currency = 'KES';
  else if (smsText.match(/NGN/i)) currency = 'NGN';
  else if (smsText.match(/GHS/i)) currency = 'GHS';
  else if (smsText.match(/USD/i)) currency = 'USD';
  else if (smsText.match(/EUR/i)) currency = 'EUR';

  // Determine bank
  let bank: string | null = null;
  if (banks.senderBank) bank = banks.senderBank;
  else if (banks.receiverBank) bank = banks.receiverBank;
  else if (smsText.match(/CBE|COMMERCIAL BANK OF ETHIOPIA/i)) bank = 'CBE';
  else if (smsText.match(/M-PESA|MPESA/i)) bank = 'M-PESA';
  else if (smsText.match(/TELEBIRR|telebirr/i)) bank = 'Telebirr';
  else if (smsText.match(/AWASH/i)) bank = 'Awash';
  else if (smsText.match(/DASHE/i)) bank = 'Dashen';
  else if (smsText.match(/SAFARICOM/i)) bank = 'Safaricom';

  // Build regex pattern - start with original text
  let regex = smsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const extractFields: any = {};
  let groupIndex = 1;

  // Replace transaction ID with capture group (case-insensitive search)
  if (extractedIds.primaryTxnId) {
    const txnId = extractedIds.primaryTxnId;
    const txnIdContexts = [
      `transaction number is ${txnId}`,
      `Transaction number is ${txnId}`,
      `transaction number: ${txnId}`,
      `Transaction number: ${txnId}`,
      `txn: ${txnId}`,
      `Txn: ${txnId}`,
      `ref no ${txnId}`,
      `Ref No ${txnId}`,
      `ref: ${txnId}`,
      `Ref: ${txnId}`,
      `reference ${txnId}`,
      `Reference ${txnId}`,
      `with ref no ${txnId}`,
      `with Ref No ${txnId}`,
      `with ref: ${txnId}`,
      `with Ref: ${txnId}`,
      `bank ref ${txnId}`,
      `Bank Ref ${txnId}`,
      `መለያ ቁጥር ${txnId}`,
      txnId,
    ];
    let found = false;
    for (const context of txnIdContexts) {
      const lowerRegex = regex.toLowerCase();
      const lowerContext = context.toLowerCase();
      const lastIndex = lowerRegex.lastIndexOf(lowerContext);
      if (lastIndex !== -1) {
        const idIndex = lastIndex + context.length - txnId.length;
        regex = regex.substring(0, idIndex) +
                `([A-Z0-9]{${Math.max(6, txnId.length)},})` +
                regex.substring(idIndex + txnId.length);
        extractFields.txnId = { group: groupIndex++, type: 'string' };
        found = true;
        break;
      }
    }
    if (!found) {
      // Fallback to replacing the ID alone
      const lowerRegex = regex.toLowerCase();
      const lowerTxnId = txnId.toLowerCase();
      const lastIndex = lowerRegex.lastIndexOf(lowerTxnId);
      if (lastIndex !== -1) {
        regex = regex.substring(0, lastIndex) +
                `([A-Z0-9]{${Math.max(6, txnId.length)},})` +
                regex.substring(lastIndex + txnId.length);
        extractFields.txnId = { group: groupIndex++, type: 'string' };
      }
    }
  }

  // Replace reference ID with capture group
  if (extractedIds.referenceTxnId && extractedIds.referenceTxnId !== extractedIds.primaryTxnId) {
    const refId = extractedIds.referenceTxnId;
    const refContexts = [
      `ref no ${refId}`,
      `Ref No ${refId}`,
      `ref: ${refId}`,
      `Ref: ${refId}`,
      `reference ${refId}`,
      `Reference ${refId}`,
      `with ref no ${refId}`,
      `with Ref No ${refId}`,
      `with ref: ${refId}`,
      `with Ref: ${refId}`,
      refId,
    ];
    let found = false;
    for (const context of refContexts) {
      const lowerRegex = regex.toLowerCase();
      const lowerContext = context.toLowerCase();
      const lastIndex = lowerRegex.lastIndexOf(lowerContext);
      if (lastIndex !== -1) {
        const idIndex = lastIndex + context.length - refId.length;
        regex = regex.substring(0, idIndex) +
                `([A-Z0-9]{${Math.max(6, refId.length)},})` +
                regex.substring(idIndex + refId.length);
        extractFields.referenceTxnId = { group: groupIndex++, type: 'string' };
        found = true;
        break;
      }
    }
    if (!found) {
      // Fallback to replacing the ID alone
      const lowerRegex = regex.toLowerCase();
      const lowerRefId = refId.toLowerCase();
      const lastIndex = lowerRegex.lastIndexOf(lowerRefId);
      if (lastIndex !== -1) {
        regex = regex.substring(0, lastIndex) +
                `([A-Z0-9]{${Math.max(6, refId.length)},})` +
                regex.substring(lastIndex + refId.length);
        extractFields.referenceTxnId = { group: groupIndex++, type: 'string' };
      }
    }
  }

  // Replace dates with generic patterns (from end to start)
  const dateMatches: Array<{ index: number; length: number; replacement: string }> = [];
  const datePatterns = [
    /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g,
    /\b(\d{4}-\d{1,2}-\d{1,2})\b/g,
    /\b(\d{1,2}-\d{1,2}-\d{4})\b/g,
  ];

  for (const pattern of datePatterns) {
    let dateMatch;
    pattern.lastIndex = 0;
    while ((dateMatch = pattern.exec(regex)) !== null) {
      if (dateMatch[1] && dateMatch.index !== undefined) {
        let replacement: string;
        if (dateMatch[1].includes('/')) {
          replacement = '\\d{1,2}/\\d{1,2}/\\d{4}';
        } else if (dateMatch[1].startsWith('20') || dateMatch[1].startsWith('19')) {
          replacement = '\\d{4}-\\d{1,2}-\\d{1,2}';
        } else {
          replacement = '\\d{1,2}-\\d{1,2}-\\d{4}';
        }
        dateMatches.push({
          index: dateMatch.index,
          length: dateMatch[1].length,
          replacement,
        });
      }
    }
  }

  // Replace dates from end to start
  dateMatches.sort((a, b) => b.index - a.index);
  for (const dm of dateMatches) {
    regex = regex.substring(0, dm.index) +
            dm.replacement +
            regex.substring(dm.index + dm.length);
  }

  // Replace times with generic pattern
  regex = regex.replace(/\b(\d{1,2}:\d{2}:\d{2})\b/g, '\\d{1,2}:\\d{2}:\\d{2}');

  // Replace amount with capture group (use original amountStr for accurate matching)
  // Make the context around amount flexible (e.g., "Credited with ETB" vs "ETB")
  if (amount && amountStr) {
    const amountVariations = [
      amountStr,
      amountStr.replace('.', ','),
      amountStr.replace(',', '.'),
    ];
    const currencyPrefixes = ['ETB', 'KES', 'NGN', 'GHS', 'USD', 'EUR', 'ብር', 'birr'];
    for (const currency of currencyPrefixes) {
      amountVariations.push(`${currency} ${amountStr}`);
    }
    let amountFound = false;
    for (const amountVar of amountVariations) {
      const contexts = [
        `amount ${amountVar}`,
        `received ${amountVar}`,
        `Received ${amountVar}`,
        `credited with ${amountVar}`,
        `Credited with ${amountVar}`,
        `deposited ${amountVar}`,
        `Deposited ${amountVar}`,
        amountVar,
      ];
      for (const context of contexts) {
        const lowerRegex = regex.toLowerCase();
        const lowerContext = context.toLowerCase();
        const contextIndex = lowerRegex.indexOf(lowerContext);
        if (contextIndex !== -1) {
          const amountIndex = contextIndex + context.length - amountVar.length;
          const beforeAmount = regex.substring(Math.max(0, amountIndex - 30), amountIndex);
          if (!beforeAmount.includes('(') || beforeAmount.lastIndexOf('(') < beforeAmount.lastIndexOf(')')) {
            // Check if there's a currency or action word before the amount
            const hasCurrencyBefore = /(?:ETB|KES|NGN|GHS|USD|EUR|ብር|birr)\s*$/i.test(beforeAmount);
            const hasActionBefore = /(?:credited|received|deposited|amount)\s+(?:with\s+)?(?:ETB|KES|NGN|GHS|USD|EUR|ብር|birr)?\s*$/i.test(beforeAmount);
            
            // Replace amount and make context optional
            regex = regex.substring(0, amountIndex) +
                    '([\\d,]+(?:\\.\\d{1,2})?)' + // Generic for amounts with optional decimal
                    regex.substring(amountIndex + amountVar.length);
            extractFields.amount = { group: groupIndex++, type: 'number' };
            amountFound = true;
          }
        }
        if (amountFound) break;
      }
      if (amountFound) break;
    }
    if (!amountFound) {
      // Fallback: look for currency + number pattern
      const amountPattern = /(?:ETB|KES|NGN|GHS|USD|EUR|ብር|birr)\s+([\d,]+\.?\d*)/i;
      const match = regex.match(amountPattern);
      if (match && match[1]) {
        const amountIndex = match.index! + match[0].length - match[1].length;
        const beforeAmount = regex.substring(Math.max(0, amountIndex - 10), amountIndex);
        if (!beforeAmount.includes('(') || beforeAmount.lastIndexOf('(') < beforeAmount.lastIndexOf(')')) {
          regex = regex.substring(0, amountIndex) +
                  '([\\d,]+(?:\\.\\d{1,2})?)' +
                  regex.substring(amountIndex + match[1].length);
          extractFields.amount = { group: groupIndex++, type: 'number' };
        }
      }
    }
  }

  // Replace recipient names with generic pattern - make it optional and flexible
  // Process only the FIRST occurrence to avoid duplicates
  const recipientNamePatterns = [
    /(Dear|ውድ|ውድዬ)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/gi,
    /(Dear|ውድ|ውድዬ)\s+([A-Z]+)/g,
  ];

  let recipientReplaced = false;
  for (const pattern of recipientNamePatterns) {
    if (recipientReplaced) break;
    pattern.lastIndex = 0;
    const recipientMatch = pattern.exec(regex);
    if (recipientMatch && recipientMatch[2]) {
      const nameIndex = recipientMatch.index + recipientMatch[1].length + 1; // After "Dear "
      // Make the name pattern optional and flexible - don't capture it as it's not essential
      const namePattern = language === 'amharic' 
        ? '[\\u1200-\\u137Fa-zA-Z ]+?' 
        : '[A-Z][A-Za-z ]*?'; // Non-capturing: Capitalized name with spaces
      regex = regex.substring(0, nameIndex) +
              namePattern +
              regex.substring(nameIndex + recipientMatch[2].length);
      recipientReplaced = true;
    }
  }

  // Replace sender with capture group (simplified pattern)
  // Make "from" keyword optional to handle variations
  if (sender) {
    const senderMatches: Array<{ index: number; length: number; contextBefore?: string }> = [];
    const lowerRegex = regex.toLowerCase();
    const lowerSender = sender.toLowerCase();
    let searchIndex = 0;

    while (true) {
      const foundIndex = lowerRegex.indexOf(lowerSender, searchIndex);
      if (foundIndex === -1) break;

      const beforeSender = regex.substring(Math.max(0, foundIndex - 20), foundIndex);
      if (!beforeSender.includes('(') || beforeSender.lastIndexOf('(') < beforeSender.lastIndexOf(')')) {
        // Check if "from" appears before the sender name
        const fromMatch = beforeSender.match(/\bfrom\s+$/i);
        senderMatches.push({
          index: foundIndex,
          length: sender.length,
          contextBefore: fromMatch ? '(?:from\\s+)?' : undefined,
        });
      }
      searchIndex = foundIndex + 1;
    }

    // Replace from end to start
    senderMatches.sort((a, b) => b.index - a.index);

    let isFirstSender = true;
    for (const sm of senderMatches) {
      const namePattern = language === 'amharic' 
        ? '([\\u1200-\\u137Fa-zA-Z ]+?)' 
        : language === 'mixed'
        ? '([\\u1200-\\u137Fa-zA-Z ]+?)'
        : '([A-Za-z ]+?)'; // Simplified: Names with spaces
      
      // If we have contextBefore, replace "from SenderName" with "(?:from\s+)?([A-Za-z ]+?)"
      if (sm.contextBefore) {
        const fromIndex = sm.index - 4; // "from" is 4 chars
        regex = regex.substring(0, fromIndex) +
                sm.contextBefore +
                namePattern +
                regex.substring(sm.index + sm.length);
      } else {
        regex = regex.substring(0, sm.index) +
                namePattern +
                regex.substring(sm.index + sm.length);
      }

      // Only add to extractFields for the first occurrence (the actual sender)
      if (isFirstSender) {
        extractFields.sender = { group: groupIndex++, type: 'string' };
        isFirstSender = false;
      }
    }
  }

  // Replace balance amounts with generic pattern (non-capturing to avoid extra groups)
  const balanceMatches: Array<{ index: number; amountIndex: number; amountLength: number }> = [];
  const balancePatterns = [
    /(?:current\s+)?(?:account\s+)?balance\s+(?:is\s+)?(?:ETB|KES|NGN|GHS|USD|EUR|ብር|birr)?\s*([\d,]+\.?\d*)/gi,
    /balance\s+(?:of\s+)?(?:ETB|KES|NGN|GHS|USD|EUR|ብር|birr)?\s*([\d,]+\.?\d*)/gi,
  ];

  for (const pattern of balancePatterns) {
    let balanceMatch;
    pattern.lastIndex = 0;
    while ((balanceMatch = pattern.exec(regex)) !== null) {
      if (balanceMatch[1]) {
        const amountIndex = balanceMatch.index + balanceMatch[0].length - balanceMatch[1].length;
        balanceMatches.push({
          index: balanceMatch.index,
          amountIndex,
          amountLength: balanceMatch[1].length,
        });
      }
    }
  }

  // Replace from end to start
  balanceMatches.sort((a, b) => b.amountIndex - a.amountIndex);
  for (const bm of balanceMatches) {
    regex = regex.substring(0, bm.amountIndex) +
            '[\\d,]+(?:\\.\\d{1,2})?' + // Non-capturing generic
            regex.substring(bm.amountIndex + bm.amountLength);
  }

  // Replace account numbers with generic pattern (non-capturing)
  // Make "your Account" optional by replacing the whole pattern
  const accountMatches: Array<{ startIndex: number; endIndex: number; replacement: string }> = [];

  // Account with asterisks - match "your Account 1***8423" or "Account 1***8423"
  const accountPattern1 = /(?:your\s+)?[Aa]ccount\s+(\d+\*+\d+)/gi;
  let accountMatch1;
  accountPattern1.lastIndex = 0;
  while ((accountMatch1 = accountPattern1.exec(regex)) !== null) {
    if (accountMatch1[1] && accountMatch1.index !== undefined) {
      accountMatches.push({
        startIndex: accountMatch1.index,
        endIndex: accountMatch1.index + accountMatch1[0].length,
        replacement: '(?:your\\s+)?[Aa]ccount\\s+\\d+\\*+\\d+', // Generic pattern with optional "your"
      });
    }
  }

  // Account without asterisks (long numbers)
  const accountPattern2 = /(?:your\s+)?[Aa]ccount\s+(\d{10,})/gi;
  let accountMatch2;
  accountPattern2.lastIndex = 0;
  while ((accountMatch2 = accountPattern2.exec(regex)) !== null) {
    if (accountMatch2[1] && accountMatch2.index !== undefined) {
      accountMatches.push({
        startIndex: accountMatch2.index,
        endIndex: accountMatch2.index + accountMatch2[0].length,
        replacement: '(?:your\\s+)?[Aa]ccount\\s+\\d{10,}', // Generic pattern with optional "your"
      });
    }
  }

  // Replace from end to start to preserve indices
  accountMatches.sort((a, b) => b.startIndex - a.startIndex);
  for (const am of accountMatches) {
    regex = regex.substring(0, am.startIndex) +
            am.replacement +
            regex.substring(am.endIndex);
  }

  // Replace phone numbers with generic pattern (non-capturing)
  const phoneMatches: Array<{ index: number; length: number }> = [];
  const phonePattern = /\(?(\d{3,5}\*+\d{3,5})\)?/g;
  let phoneMatch;
  phonePattern.lastIndex = 0;
  while ((phoneMatch = phonePattern.exec(regex)) !== null) {
    if (phoneMatch[1]) {
      phoneMatches.push({
        index: phoneMatch.index + (phoneMatch[0].startsWith('(') ? 1 : 0),
        length: phoneMatch[1].length,
      });
    }
  }

  // Replace from end to start
  phoneMatches.sort((a, b) => b.index - a.index);
  for (const pm of phoneMatches) {
    const replacement = '\\d+\\*+\\d+';
    regex = regex.substring(0, pm.index) +
            replacement +
            regex.substring(pm.index + pm.length);
  }

  // Replace URL IDs with capture group (custom length)
  if (!extractFields.referenceTxnId) {
    const urlIdMatches: Array<{ index: number; length: number }> = [];
    const urlIdPattern = /\?id=([A-Z0-9]{10,})/gi;
    let urlIdMatch;
    urlIdPattern.lastIndex = 0;
    while ((urlIdMatch = urlIdPattern.exec(regex)) !== null) {
      if (urlIdMatch[1]) {
        urlIdMatches.push({
          index: urlIdMatch.index + urlIdMatch[0].length - urlIdMatch[1].length,
          length: urlIdMatch[1].length,
        });
      }
    }

    // Replace from end to start
    urlIdMatches.sort((a, b) => b.index - a.index);
    for (const um of urlIdMatches) {
      regex = regex.substring(0, um.index) +
              `([A-Z0-9]{${um.length},})` +
              regex.substring(um.index + um.length);
      extractFields.referenceTxnId = { group: groupIndex++, type: 'string' };
      break; // Only replace the first (last in sorted) to avoid multiples
    }
  }

  // Make common phrases optional to handle variations
  // These are phrases that might appear in some messages but not others
  // Apply these BEFORE escaping to preserve the patterns
  const optionalPhrases = [
    // Make "your Account" optional and account number generic
    { pattern: /\byour\s+[Aa]ccount\s+\d+\*+\d+/gi, replacement: '(?:your\\s+)?[Aa]ccount\\s+\\d+\\*+\\d+' },
    // Make "has been" optional (for "has been Credited")
    { pattern: /\bhas\s+been\b/gi, replacement: '(?:has\\s+been\\s+)?' },
    // Handle both "Credited with" AND "received" (for telebirr vs CBE)
    { pattern: /\bCredited\s+with\b/gi, replacement: '(?:Credited\\s+with|credited\\s+with|received)' },
    { pattern: /\breceived\s+ETB\b/gi, replacement: '(?:Credited\\s+with|credited\\s+with|received)\\s+ETB' },
    // Make "with Ref No" variations optional
    { pattern: /\bwith\s+(?:Ref\s+No|ref\s+no|reference)\b/gi, replacement: '(?:with\\s+)?(?:Ref\\s+No|ref\\s+no|reference|transaction\\s+number\\s+is)' },
    // Make "transaction number is" interchangeable with "Ref No"
    { pattern: /\btransaction\s+number\s+is\b/gi, replacement: '(?:transaction\\s+number\\s+is|Ref\\s+No|reference)' },
    // Make balance phrases flexible
    { pattern: /\bYour\s+Current\s+Balance\b/gi, replacement: '(?:Your\\s+[Cc]urrent\\s+[Bb]alance|[Cc]urrent\\s+[Bb]alance|[Bb]alance)' },
    { pattern: /\bcurrent\s+E-Money\s+Account\s+balance\b/gi, replacement: '(?:[Cc]urrent\\s+[Ee]-[Mm]oney\\s+[Aa]ccount\\s+[Bb]alance|[Cc]urrent\\s+[Bb]alance|[Bb]alance)' },
    // Make closing phrases optional
    { pattern: /\bThank\s+you\s+for\s+Banking\s+with\s+[A-Z]+!?\b/gi, replacement: '(?:Thank\\s+you\\s+for\\s+[Bb]anking\\s+with\\s+[A-Z]+!?|Thank\\s+you\\s+for\\s+using\\s+telebirr)?' },
    { pattern: /\bThank\s+you\s+for\s+using\s+telebirr\b/gi, replacement: '(?:Thank\\s+you\\s+for\\s+using\\s+telebirr|Thank\\s+you\\s+for\\s+[Bb]anking\\s+with\\s+[A-Z]+!?)?' },
    // Make Ethio telecom signature optional
    { pattern: /\bEthio\s+telecom\b/gi, replacement: '(?:Ethio\\s+telecom)?' },
    // Make "from" keyword flexible
    { pattern: /\bfrom\s+([A-Z][a-z]+)/gi, replacement: '(?:from\\s+)?$1' },
  ];

  // Apply optional phrase replacements (before escaping)
  for (const phrase of optionalPhrases) {
    regex = regex.replace(phrase.pattern, phrase.replacement);
  }
  
  // Make account numbers with asterisks generic (do this after optional phrases)
  // This handles both "your Account 1***8423" and standalone "1***8423"
  regex = regex.replace(/\b(\d+\*+\d+)\b/g, '\\d+\\*+\\d+');

  // Escape all special regex characters except inside capture groups
  // More robust approach: find ALL capture groups (not just specific patterns)
  const matches: Array<{ index: number; length: number; text: string }> = [];
  
  // Helper function to check if we're inside a character class
  const isInsideCharClass = (str: string, pos: number): boolean => {
    let bracketDepth = 0;
    for (let j = 0; j < pos; j++) {
      // Skip escaped characters
      if (str[j] === '\\' && j + 1 < str.length) {
        j++; // Skip the next character
        continue;
      }
      if (str[j] === '[') {
        // Check if it's not escaped (we already checked above)
        bracketDepth++;
      } else if (str[j] === ']' && bracketDepth > 0) {
        bracketDepth--;
      }
    }
    return bracketDepth > 0;
  };
  
  // Find all opening parentheses and determine if they're capture groups
  for (let i = 0; i < regex.length; i++) {
    // Skip escaped characters
    if (regex[i] === '\\' && i + 1 < regex.length) {
      i++; // Skip the escaped character
      continue;
    }
    
    if (regex[i] === '(') {
      // Skip if inside a character class (parentheses are literal there)
      if (isInsideCharClass(regex, i)) {
        continue;
      }
      
      // Check if it's a non-capturing group (skip these - they'll be escaped)
      const nextChar = regex[i + 1];
      const nextTwoChars = regex.substring(i, i + 3);
      
      // Non-capturing groups: (?:, (?=, (?!, (?<=, (?<!, (?<, ('
      if (nextChar === '?' && 
          (regex[i + 2] === ':' || 
           regex[i + 2] === '=' || 
           regex[i + 2] === '!' ||
           nextTwoChars === '(?<' ||
           (regex[i + 2] === '<' && regex[i + 3] !== '=' && regex[i + 3] !== '!') ||
           regex[i + 2] === "'")) {
        // Skip non-capturing groups - they'll be escaped
        continue;
      }
      
      // This is a capture group - find its matching closing parenthesis
      let depth = 1;
      let endIndex = i + 1;
      while (depth > 0 && endIndex < regex.length) {
        // Skip escaped characters
        if (regex[endIndex] === '\\' && endIndex + 1 < regex.length) {
          endIndex += 2;
          continue;
        }
        if (regex[endIndex] === '(') depth++;
        if (regex[endIndex] === ')') depth--;
        endIndex++;
      }
      
      if (depth === 0) {
        // Found a complete capture group
        const groupText = regex.substring(i, endIndex);
        matches.push({
          index: i,
          length: groupText.length,
          text: groupText,
        });
        // Skip to after this group to avoid nested groups being processed separately
        i = endIndex - 1;
      }
    }
  }
  
  // Sort matches by index to process in order
  matches.sort((a, b) => a.index - b.index);

  // Build the escaped regex, preserving capture groups
  const parts: string[] = [];
  let lastIndex = 0;
  
  for (const matchInfo of matches) {
    // Escape text before capture group
    const before = regex.substring(lastIndex, matchInfo.index);
    const escapedBefore = before
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    parts.push(escapedBefore);
    // Keep capture group as-is
    parts.push(matchInfo.text);
    lastIndex = matchInfo.index + matchInfo.length;
  }

  // Add remaining text (escaped)
  const remaining = regex.substring(lastIndex);
  const escapedRemaining = remaining
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  parts.push(escapedRemaining);
  regex = parts.join('');

  // After escaping, make masked numbers (like 1***8423) generic
  // The escaping will have turned 1*********8423 into 1\*\*\*\*\*\*\*\*\*8423
  // Replace these with generic \d+\*+\d+ pattern
  regex = regex.replace(/(\d+)((?:\\?\*)+)(\d+)/g, '\\d+\\*+\\d+');
  
  // Also handle fully escaped version
  regex = regex.replace(/\\d\+\\?\*\+\\d\+/g, '\\d+\\*+\\d+');

  // If no capture groups were added, create a basic generic pattern
  if (Object.keys(extractFields).length === 0) {
    regex = smsText
      .replace(/\d+/g, '\\d+')
      .replace(/[A-Za-z]+/g, '[A-Za-z]+')
      .replace(/[\u1200-\u137F]+/g, '[\\u1200-\\u137F]+')
      .replace(/\s+/g, '\\s+')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Calculate confidence score (0-1)
  let confidence = 0;
  if (extractedIds.primaryTxnId) confidence += 0.4;
  if (amount) confidence += 0.3;
  if (sender) confidence += 0.2;
  if (bank || currency) confidence += 0.1;

  return {
    regex,
    extractFields,
    bank,
    currency,
    extractedValues: {
      txnId: extractedIds.primaryTxnId,
      referenceTxnId: extractedIds.referenceTxnId,
      amount,
      sender,
      senderBank: banks.senderBank,
      receiverBank: banks.receiverBank,
      currency,
    },
    confidence,
  };
}

/**
 * Generate regex patterns for multiple SMS texts (multi-language support)
 */
export function generateRegexPatternsMultiLanguage(smsTexts: string[]): ExtractionResult[] {
  return smsTexts.map(text => generateRegexPattern(text));
}
