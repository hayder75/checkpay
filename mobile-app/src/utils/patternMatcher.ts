import { log } from './logger';

/**
 * Institution Pattern interface (from backend)
 */
export interface InstitutionPattern {
  id: string;
  name: string;
  institution: string | null;
  regex: string;
  extractFields: Record<string, any>;
  bank?: string | null;
  currency?: string | null;
  usageCount: number;
  smsExample?: string | null;
  type: 'institution' | 'country';
}

/**
 * Clean and prepare regex for JavaScript
 */
function prepareRegex(regexStr: string): string {
  let cleaned = regexStr;
  
  // Remove PCRE case-insensitive flag - we use 'i' flag in JS
  if (cleaned.startsWith('(?i)')) {
    cleaned = cleaned.substring(4);
  }
  cleaned = cleaned.replace(/\(\?i\)/g, '');
  
  return cleaned;
}

/**
 * Extract captured groups from a match based on extractFields config
 */
function extractValues(
  match: RegExpMatchArray,
  extractFields: Record<string, any>
): {
  txnId: string;
  amount: number;
  sender: string;
  sendFrom: string | null;
  sendTo: string | null;
} {
  // Helper to get group number
  const getGroupNumber = (field: any): number | null => {
    if (typeof field === 'number') return field;
    if (field && typeof field === 'object' && 'group' in field) return field.group;
    return null;
  };
  
  // Helper to get value from group
  const getGroupValue = (field: any): string => {
    const group = getGroupNumber(field);
    if (group && match[group]) {
      return match[group].trim();
    }
    return '';
  };
  
  const txnId = getGroupValue(extractFields.txnId);
  const amountStr = getGroupValue(extractFields.amount);
  const sender = getGroupValue(extractFields.sender);
  const sendFrom = extractFields.sendFrom ? getGroupValue(extractFields.sendFrom) : null;
  const sendTo = extractFields.sendTo ? getGroupValue(extractFields.sendTo) : null;
  
  // Parse amount - remove commas and parse as float
  let amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
  
  return { txnId, amount, sender, sendFrom, sendTo };
}

/**
 * Fallback extraction for sender name from SMS text
 */
function extractSenderFromText(smsText: string): string | null {
  const senderPatterns = [
    /from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*[,(]|\s+on\s+|\s+at\s+|\.|\s+\d)/i,
    /received\s+.*?from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*[,(]|\s+on\s+|\s+at\s+|\.)/i,
    /credited\s+.*?from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*[,(]|\s+on\s+|\s+at\s+|\.)/i,
  ];
  
  for (const pattern of senderPatterns) {
    const match = smsText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Fallback extraction for phone number from SMS text
 */
function extractPhoneFromText(smsText: string): string | null {
  const phonePatterns = [
    /\((\d[\d*]+)\)/,  // (2519****4345)
    /\((\+?\d[\d\s-]+)\)/,  // (+251912345678)
  ];
  
  for (const pattern of phonePatterns) {
    const match = smsText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Detect if transaction is outgoing (debit) based on SMS text
 */
function isOutgoingTransaction(smsText: string): boolean {
  const upperSms = smsText.toUpperCase();
  
  const outgoingPatterns = [
    /YOU\s+HAVE\s+TRANSFERRED/i,
    /YOU\s+TRANSFERRED/i,
    /TRANSFERRED\s+TO/i,
    /SENT\s+TO/i,
    /DEBITED/i,
    /WITHDRAWN/i,
    /PAID\s+OUT/i,
    /TRANSFER\s+OF/i,
  ];
  
  for (const pattern of outgoingPatterns) {
    if (pattern.test(upperSms)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Match SMS against InstitutionPattern (from backend)
 */
export function matchInstitutionPattern(smsText: string, pattern: InstitutionPattern): {
  matched: boolean;
  confidence: number;
  data?: {
    txnId: string;
    amount: number;
    sender: string;
    sendFrom: string | null;
    sendTo: string | null;
    bank: string;
    currency: string;
    patternId: string;
    patternName: string;
  };
} {
  try {
    // Prepare regex
    const regexStr = prepareRegex(pattern.regex);
    
    // Try to create and match regex
    let regex: RegExp;
    try {
      regex = new RegExp(regexStr, 'is');
    } catch (syntaxError) {
      log.warn('Pattern Matcher', `Invalid regex syntax for ${pattern.name}`, syntaxError);
      return { matched: false, confidence: 0 };
    }
    
    const match = smsText.match(regex);
    
    if (!match) {
      // Only log for likely transaction messages
      const isLikelyTransaction = smsText.includes('ETB') || smsText.includes('Credited') || 
                                   smsText.includes('received') || smsText.includes('Account');
      if (isLikelyTransaction) {
        log.debug('Pattern Matcher', `No match: ${pattern.name}`, {
          smsPreview: smsText.substring(0, 80),
        });
      }
      return { matched: false, confidence: 0 };
    }
    
    log.success('Pattern Matcher', `✅ Matched: ${pattern.name}`);
    
    // Extract values
    const extracted = extractValues(match, pattern.extractFields);
    
    // Validate extracted data
    if (extracted.txnId && extracted.txnId.length < 6) {
      log.warn('Pattern Matcher', `txnId too short: ${extracted.txnId}`);
      return { matched: false, confidence: 0 };
    }
    
    if (extracted.amount <= 0) {
      log.warn('Pattern Matcher', `Invalid amount: ${extracted.amount}`);
      return { matched: false, confidence: 0 };
    }
    
    // Fallback sender extraction
    let sender = extracted.sender;
    let sendFrom = extracted.sendFrom;
    
    if (!sender) {
      sender = extractSenderFromText(smsText) || '';
    }
    
    if (!sendFrom) {
      sendFrom = extractPhoneFromText(smsText);
    }
    
    // Adjust amount sign for outgoing transactions
    let amount = extracted.amount;
    if (isOutgoingTransaction(smsText) && amount > 0) {
      amount = -Math.abs(amount);
    }
    
    // Calculate confidence
    let confidence = 0.7; // Base confidence for regex match
    if (extracted.txnId) confidence += 0.15;
    if (Math.abs(amount) > 0) confidence += 0.1;
    if (sender) confidence += 0.05;
    confidence = Math.min(confidence, 0.95);
    
    return {
      matched: true,
      confidence,
      data: {
        txnId: extracted.txnId || 'N/A',
        amount,
        sender: sender || '',
        sendFrom,
        sendTo: extracted.sendTo,
        bank: pattern.bank || pattern.institution || pattern.name || 'Unknown',
        currency: pattern.currency || 'ETB',
        patternId: pattern.id,
        patternName: pattern.name,
      },
    };
  } catch (error) {
    log.error('Pattern Matcher', 'Error matching pattern', error);
    return { matched: false, confidence: 0 };
  }
}

/**
 * Find matching pattern from a list of InstitutionPatterns
 * Returns the best match with highest confidence
 */
export function findMatchingInstitutionPattern(
  smsText: string,
  patterns: InstitutionPattern[],
  senderAddress?: string
): {
  matched: boolean;
  confidence: number;
  pattern?: InstitutionPattern;
  data?: any;
} {
  let bestMatch: {
    confidence: number;
    pattern: InstitutionPattern;
    data: any;
  } | null = null;

  for (const pattern of patterns) {
    // If we have sender address, prioritize patterns for that institution
    if (senderAddress && pattern.institution) {
      const normalizedSender = senderAddress.trim();
      const normalizedInstitution = pattern.institution.trim();
      
      // Exact match gets priority
      if (normalizedSender === normalizedInstitution) {
        const result = matchInstitutionPattern(smsText, pattern);
        if (result.matched && (!bestMatch || result.confidence > bestMatch.confidence)) {
          log.success('Pattern Matcher', `✅ Matched (sender priority): ${pattern.name}`);
          bestMatch = {
            confidence: result.confidence + 0.1, // Bonus for sender match
            pattern,
            data: result.data,
          };
        }
      }
    }

    // Try matching regardless of sender
    const result = matchInstitutionPattern(smsText, pattern);
    if (result.matched && (!bestMatch || result.confidence > bestMatch.confidence)) {
      log.success('Pattern Matcher', `✅ Matched: ${pattern.name}`);
      bestMatch = {
        confidence: result.confidence,
        pattern,
        data: result.data,
      };
    }
  }

  if (bestMatch) {
    return {
      matched: true,
      confidence: bestMatch.confidence,
      pattern: bestMatch.pattern,
      data: bestMatch.data,
    };
  }

  return { matched: false, confidence: 0 };
}
