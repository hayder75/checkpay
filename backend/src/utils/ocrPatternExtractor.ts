/**
 * OCR Pattern Extractor
 * Dynamic system for storing and extracting values from OCR text using patterns
 */

import prisma from './prisma';

export interface OCRPatternDefinition {
  id?: string;
  institution: string;
  countryCode: string;
  name: string;
  description?: string;
  regex: string;
  extractFields: {
    txnId?: { group: number; type: string };
    amount?: { group: number; type: string };
    sender?: { group: number; type: string };
    sendFrom?: { group: number; type: string };
    sendTo?: { group: number; type: string };
    date?: { group: number; type: string };
    time?: { group: number; type: string };
    commission?: { group: number; type: string };
    vat?: { group: number; type: string };
    totalAmount?: { group: number; type: string };
    transactionType?: { group: number; type: string };
  };
  bank?: string;
  currency?: string;
  sampleImageUrl?: string;
  ocrExample?: string;
  isVerified?: boolean;
  isActive?: boolean;
}

export interface ExtractedOCRData {
  txnId: string | null;
  amount: number | null;
  sender: string | null;
  sendFrom: string | null;
  sendTo: string | null;
  date: string | null;
  time: string | null;
  commission: number | null;
  vat: number | null;
  totalAmount: number | null;
  bank: string | null;
  currency: string | null;
}

export interface OCRMatchResult {
  matched: boolean;
  confidence: number;
  pattern?: OCRPatternDefinition;
  data?: ExtractedOCRData;
  error?: string;
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
 * Extract values from OCR text using a pattern
 */
export function extractOCRValues(
  ocrText: string,
  pattern: OCRPatternDefinition
): ExtractedOCRData {
  const result: ExtractedOCRData = {
    txnId: null,
    amount: null,
    sender: null,
    sendFrom: null,
    sendTo: null,
    date: null,
    time: null,
    commission: null,
    vat: null,
    totalAmount: null,
    bank: pattern.bank || null,
    currency: pattern.currency || null,
  };

  try {
    const regexStr = prepareRegex(pattern.regex);
    const regex = new RegExp(regexStr, 'is');
    const match = ocrText.match(regex);

    if (!match) {
      return result;
    }

    // Helper to get group value
    const getGroupValue = (field: { group: number; type: string } | undefined): string | null => {
      if (!field) return null;
      const group = field.group;
      if (group && match[group]) {
        return match[group].trim();
      }
      return null;
    };

    // Extract txnId
    if (pattern.extractFields.txnId) {
      result.txnId = getGroupValue(pattern.extractFields.txnId);
    }

    // Extract amount
    if (pattern.extractFields.amount) {
      const amountStr = getGroupValue(pattern.extractFields.amount);
      if (amountStr) {
        let amount = parseFloat(amountStr.replace(/,/g, '')) || null;
        // Check if OCR text has negative sign before the amount (for debit transactions)
        if (amount !== null && ocrText.match(new RegExp(`-\\s*${amountStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))) {
          amount = -Math.abs(amount);
        }
        result.amount = amount;
      }
    }

    // Extract sender
    if (pattern.extractFields.sender) {
      result.sender = getGroupValue(pattern.extractFields.sender);
    }

    // Extract sendFrom
    if (pattern.extractFields.sendFrom) {
      result.sendFrom = getGroupValue(pattern.extractFields.sendFrom);
    }

    // Extract sendTo
    if (pattern.extractFields.sendTo) {
      result.sendTo = getGroupValue(pattern.extractFields.sendTo);
    }
    
    // Fallback: Extract receiver name for Zemen GEBEYA pattern if not found
    if (!result.sendTo && pattern.institution === 'Zemen GEBEYA') {
      // Look for name after "Transfer Money" and before transaction ID
      const transferIndex = ocrText.search(/Transfer\s+Money/i);
      if (transferIndex >= 0) {
        const afterTransfer = ocrText.substring(transferIndex + 13); // Skip past "Transfer Money"
        // Split by lines and find first name that's not Zemen-related
        const lines = afterTransfer.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
        for (const line of lines) {
          // Skip Zemen-related lines, common labels, and long descriptive text
          if (line.toLowerCase().includes('zemen') || 
              line.toLowerCase().includes('transaction') ||
              line.toLowerCase().includes('number') ||
              line.toLowerCase().includes('successful') ||
              line.toLowerCase().includes('finished') ||
              line.toLowerCase().includes('download') ||
              line.toLowerCase().includes('share') ||
              line.toLowerCase().includes('qr code') ||
              line.toLowerCase().includes('where') ||
              line.toLowerCase().includes('shops') ||
              line.toLowerCase().includes('digitally') ||
              line.toLowerCase().includes('transfer') ||
              line.toLowerCase().includes('money') ||
              line.length > 30 || // Skip long descriptive text
              line.match(/^\d/) || // Skip lines starting with numbers
              line.match(/^[A-Z0-9]{8,}$/)) { // Skip transaction IDs
            continue;
          }
          // Found a potential name (short, proper case name)
          if (line.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/) && line.length < 30) {
            result.sendTo = line.trim();
            break;
          }
        }
      }
    }
    
    // Fallback: Extract date if not found
    if (!result.date) {
      const dateMatch = ocrText.match(/(\d{4}[\/-]\d{2}[\/-]\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{1,2}-[A-Za-z]{3}-\d{4})/);
      if (dateMatch) {
        result.date = dateMatch[1];
      }
    }
    
    // Fallback: Extract time if not found
    if (!result.time) {
      const timeMatch = ocrText.match(/(\d{2}:\d{2}(?::\d{2})?)/);
      if (timeMatch) {
        result.time = timeMatch[1];
      }
    }

    // Extract date
    if (pattern.extractFields.date) {
      result.date = getGroupValue(pattern.extractFields.date);
    }

    // Extract time
    if (pattern.extractFields.time) {
      result.time = getGroupValue(pattern.extractFields.time);
    }

    // Extract commission
    if (pattern.extractFields.commission) {
      const commissionStr = getGroupValue(pattern.extractFields.commission);
      if (commissionStr) {
        result.commission = parseFloat(commissionStr.replace(/,/g, '')) || null;
      }
    }

    // Extract VAT
    if (pattern.extractFields.vat) {
      const vatStr = getGroupValue(pattern.extractFields.vat);
      if (vatStr) {
        result.vat = parseFloat(vatStr.replace(/,/g, '')) || null;
      }
    }

    // Extract totalAmount
    if (pattern.extractFields.totalAmount) {
      const totalAmountStr = getGroupValue(pattern.extractFields.totalAmount);
      if (totalAmountStr) {
        result.totalAmount = parseFloat(totalAmountStr.replace(/,/g, '')) || null;
      }
    }
  } catch (error) {
    console.error('Error extracting OCR values:', error);
  }

  return result;
}

/**
 * Match OCR text against a pattern (flexible - allows partial matches)
 */
export function matchOCRPattern(
  ocrText: string,
  pattern: OCRPatternDefinition
): OCRMatchResult {
  try {
    const regexStr = prepareRegex(pattern.regex);
    const regex = new RegExp(regexStr, 'is');
    const match = ocrText.match(regex);

    // Extract values even if regex doesn't fully match
    // This allows us to get partial data when screen components change
    let extracted = extractOCRValues(ocrText, pattern);

    // If regex didn't match, try to extract at least transaction ID
    if (!match) {
      // Try fallback extraction for transaction ID
      const fallbackTxnId = extractTransactionIdFallback(ocrText);
      if (fallbackTxnId) {
        extracted.txnId = fallbackTxnId;
        // Return partial match with lower confidence
        return {
          matched: true,
          confidence: 0.5, // Lower confidence for partial match
          pattern,
          data: extracted,
        };
      }
      return {
        matched: false,
        confidence: 0,
      };
    }

    // Validate extracted data - be lenient
    if (extracted.txnId && extracted.txnId.length < 6) {
      // Try fallback extraction
      const fallbackTxnId = extractTransactionIdFallback(ocrText);
      if (fallbackTxnId) {
        extracted.txnId = fallbackTxnId;
      } else {
        return {
          matched: false,
          confidence: 0,
          error: 'Transaction ID too short',
        };
      }
    }

    // If we don't have amount from pattern, try fallback
    if (extracted.amount === null) {
      const fallbackAmount = extractAmountFallback(ocrText);
      if (fallbackAmount !== null) {
        extracted.amount = fallbackAmount;
      }
    } else if (extracted.amount === 0) {
      // Try fallback amount extraction if amount is zero (invalid)
      const fallbackAmount = extractAmountFallback(ocrText);
      if (fallbackAmount !== null) {
        extracted.amount = fallbackAmount;
      }
    }

    // If we don't have transaction ID from pattern, try fallback
    if (!extracted.txnId) {
      const fallbackTxnId = extractTransactionIdFallback(ocrText);
      if (fallbackTxnId) {
        extracted.txnId = fallbackTxnId;
      }
    }

    // Calculate confidence - prioritize transaction ID
    let confidence = 0.6; // Base confidence (lower for flexibility)
    if (extracted.txnId) {
      confidence += 0.25; // Transaction ID is most important
    } else {
      // Without transaction ID, confidence is much lower
      confidence = 0.3;
    }
    if (extracted.amount !== null && Math.abs(extracted.amount) > 0) confidence += 0.1;
    if (extracted.sender) confidence += 0.05;
    if (extracted.sendTo) confidence += 0.05;
    confidence = Math.min(confidence, 0.95);

    // Require at least transaction ID for a valid match
    if (!extracted.txnId) {
      return {
        matched: false,
        confidence: 0,
        error: 'No transaction ID found',
      };
    }

    return {
      matched: true,
      confidence,
      pattern,
      data: extracted,
    };
  } catch (error: any) {
    return {
      matched: false,
      confidence: 0,
      error: error.message,
    };
  }
}

/**
 * Fallback: Extract transaction ID from OCR text when patterns don't match
 * This is a flexible extractor that works even when screen components change
 */
export function extractTransactionIdFallback(ocrText: string): string | null {
  if (!ocrText) return null;

  // Common false positives to filter out
  const falsePositives = [
    'TRANSACTION', 'NUMBER', 'SUCCESSFUL', 'FINISHED', 'DOWNLOAD', 'SHARE', 
    'PRIZES', 'ABOVE', 'ZEMEN', 'GEBEYA', 'ETHIOPIA', 'SHOPS', 'DIGITALLY',
    'COMMERCIAL', 'BANK', 'ETHIOPIA', 'RELY', 'ALWAYS'
  ];

  // Pattern 1: Explicit transaction number patterns (most reliable)
  const explicitPatterns = [
    /transaction\s+number\s*[:\\s]+\s*([A-Z0-9]{6,})/i,
    /transaction\s+id\s*[:\\s]+\s*([A-Z0-9]{6,})/i,
    /txn\s*[:\\s]+\s*([A-Z0-9]{6,})/i,
    /txn\s+no\s*[:\\s]+\s*([A-Z0-9]{6,})/i,
    /transaction\s+no\s*[:\\s]+\s*([A-Z0-9]{6,})/i,
    /ref\s*[:\\s]+\s*([A-Z0-9]{6,})/i,
    /reference\s*[:\\s]+\s*([A-Z0-9]{6,})/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1] && match[1].length >= 6) {
      const txnId = match[1].trim();
      // Filter out common false positives
      const isFalsePositive = falsePositives.some(fp => 
        txnId.toUpperCase().includes(fp) || txnId.toUpperCase() === fp
      );
      if (!isFalsePositive && txnId.match(/[A-Z0-9]/)) {
        return txnId;
      }
    }
  }

  // Pattern 2: Look for alphanumeric codes that look like transaction IDs
  // These are codes with both letters and numbers, 8+ characters
  const alphanumericPattern = /\b([A-Z0-9]{8,})\b/g;
  const matches = Array.from(ocrText.matchAll(alphanumericPattern));
  
  // Filter and prioritize codes that look like transaction IDs
  const validCodes = matches
    .map(m => ({ code: m[1], index: m.index || 0 }))
    .filter(({ code }) => {
      // Must have both letters and numbers
      const hasLetters = code.match(/[A-Z]/);
      const hasNumbers = code.match(/[0-9]/);
      
      if (!hasLetters || !hasNumbers) return false;
      
      // Filter out false positives
      const isFalsePositive = falsePositives.some(fp => 
        code.toUpperCase().includes(fp) || code.toUpperCase() === fp
      );
      if (isFalsePositive) return false;
      
      // Not a phone number, date, or time
      if (code.match(/^\d{10,}$/)) return false; // Phone number
      if (code.match(/^\d{4}[\/-]\d{2}[\/-]\d{2}/)) return false; // Date
      if (code.match(/^\d{2}:\d{2}:\d{2}/)) return false; // Time
      
      // Must be 8+ characters
      if (code.length < 8) return false;
      
      return true;
    })
    .sort((a, b) => {
      // Prefer codes that come after "Transaction Number:" label
      const aAfterLabel = ocrText.substring(0, a.index).toLowerCase().includes('transaction number');
      const bAfterLabel = ocrText.substring(0, b.index).toLowerCase().includes('transaction number');
      if (aAfterLabel && !bAfterLabel) return -1;
      if (!aAfterLabel && bAfterLabel) return 1;
      // Otherwise prefer later matches
      return b.index - a.index;
    });

  // Return the best candidate
  if (validCodes.length > 0) {
    return validCodes[0].code;
  }

  return null;
}

/**
 * Fallback: Extract amount from OCR text
 */
export function extractAmountFallback(ocrText: string): number | null {
  // Look for currency amounts with negative sign (debits) or positive
  // Prioritize larger amounts (transaction amounts, not small numbers like "734" from "LTE 734")
  const amountPatterns = [
    /-(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*\(?ET[BE]\)?/i, // Negative amount with currency
    /-(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s|$)/, // Negative amount standalone
    /(?:ETB|ETE)\s*:?\s*-?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /-?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:ETB|ETE)/i,
  ];

  const candidates: Array<{ amount: number; isNegative: boolean; index: number }> = [];

  for (const pattern of amountPatterns) {
    const matches = Array.from(ocrText.matchAll(new RegExp(pattern.source, 'gi')));
    for (const match of matches) {
      if (match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          const fullMatch = match[0];
          const isNegative = fullMatch.startsWith('-');
          candidates.push({
            amount: isNegative ? -amount : amount,
            isNegative,
            index: match.index || 0,
          });
        }
      }
    }
  }

  // Filter out small amounts that are likely not transaction amounts (like "734" from "LTE 734")
  // Prefer amounts >= 10, or if all are small, return the largest
  const significantAmounts = candidates.filter(c => Math.abs(c.amount) >= 10);
  if (significantAmounts.length > 0) {
    // Return the largest absolute amount
    return significantAmounts.reduce((best, current) => 
      Math.abs(current.amount) > Math.abs(best.amount) ? current : best
    ).amount;
  }

  // If no significant amounts, return the largest of the small amounts
  if (candidates.length > 0) {
    return candidates.reduce((best, current) => 
      Math.abs(current.amount) > Math.abs(best.amount) ? current : best
    ).amount;
  }

  return null;
}

/**
 * Find matching OCR pattern from database with fallback extraction
 */
export async function findMatchingOCRPattern(
  ocrText: string,
  countryCode?: string,
  institution?: string
): Promise<OCRMatchResult> {
  const where: any = {
    isActive: true,
    isVerified: true,
  };

  if (countryCode) {
    where.countryCode = countryCode.toUpperCase();
  }

  if (institution) {
    where.institution = {
      contains: institution,
      mode: 'insensitive',
    };
  }

  const patterns = await prisma.oCRPattern.findMany({
    where,
    orderBy: [
      { usageCount: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  let bestMatch: OCRMatchResult | null = null;
  let partialMatch: ExtractedOCRData | null = null;

  // Try full pattern matching first
  for (const dbPattern of patterns) {
    const pattern: OCRPatternDefinition = {
      id: dbPattern.id,
      institution: dbPattern.institution,
      countryCode: dbPattern.countryCode,
      name: dbPattern.name,
      description: dbPattern.description || undefined,
      regex: dbPattern.regex,
      extractFields: dbPattern.extractFields as any,
      bank: dbPattern.bank || undefined,
      currency: dbPattern.currency || undefined,
      sampleImageUrl: dbPattern.sampleImageUrl || undefined,
      ocrExample: dbPattern.ocrExample || undefined,
      isVerified: dbPattern.isVerified,
      isActive: dbPattern.isActive,
    };

    const result = matchOCRPattern(ocrText, pattern);

    if (result.matched && (!bestMatch || result.confidence > bestMatch.confidence)) {
      bestMatch = result;
    } else if (!result.matched && result.data) {
      // Partial match - pattern didn't fully match but extracted some data
      if (!partialMatch || (result.data.txnId && !partialMatch.txnId)) {
        partialMatch = result.data;
      }
    }
  }

  // If we have a full match, ensure fallback extraction is applied for missing fields
  if (bestMatch && bestMatch.matched) {
    // Ensure amount is extracted via fallback if not already present
    if (bestMatch.data && bestMatch.data.amount === null) {
      const fallbackAmount = extractAmountFallback(ocrText);
      if (fallbackAmount !== null) {
        bestMatch.data.amount = fallbackAmount;
      }
    }
    return bestMatch;
  }

    // Fallback: Try to extract transaction ID even if patterns didn't match
    const fallbackTxnId = extractTransactionIdFallback(ocrText);
    const fallbackAmount = extractAmountFallback(ocrText);

    if (fallbackTxnId || fallbackAmount !== null) {
    // Use partial match data if available, otherwise create new
    const fallbackData: ExtractedOCRData = partialMatch || {
      txnId: null,
      amount: null,
      sender: null,
      sendFrom: null,
      sendTo: null,
      date: null,
      time: null,
      commission: null,
      vat: null,
      totalAmount: null,
      bank: institution || null,
      currency: 'ETB',
    };

    // Override with fallback extracted values
    if (fallbackTxnId) {
      fallbackData.txnId = fallbackTxnId;
    }
    if (fallbackAmount !== null) {
      fallbackData.amount = fallbackAmount;
    }

    // Calculate confidence based on what we extracted
    let confidence = 0.5; // Lower confidence for fallback
    if (fallbackData.txnId) confidence += 0.2;
    if (fallbackData.amount !== null) confidence += 0.15;
    if (fallbackData.date) confidence += 0.1;
    confidence = Math.min(confidence, 0.85);

    return {
      matched: true,
      confidence,
      data: fallbackData,
    };
  }

  // No match and no fallback extraction possible
  return { matched: false, confidence: 0 };
}

/**
 * Create a new OCR pattern in the database
 */
export async function createOCRPattern(
  pattern: OCRPatternDefinition,
  contributedBy?: string
): Promise<any> {
  // Check if pattern already exists
  const existing = await prisma.oCRPattern.findUnique({
    where: {
      institution_countryCode_name: {
        institution: pattern.institution,
        countryCode: pattern.countryCode,
        name: pattern.name,
      },
    },
  });

  if (existing) {
    throw new Error(
      `Pattern "${pattern.name}" for ${pattern.institution} (${pattern.countryCode}) already exists`
    );
  }

  const created = await prisma.oCRPattern.create({
    data: {
      institution: pattern.institution,
      countryCode: pattern.countryCode,
      name: pattern.name,
      description: pattern.description || null,
      regex: pattern.regex,
      extractFields: pattern.extractFields as any,
      bank: pattern.bank || null,
      currency: pattern.currency || null,
      sampleImageUrl: pattern.sampleImageUrl || null,
      ocrExample: pattern.ocrExample || null,
      isVerified: pattern.isVerified || false,
      isActive: pattern.isActive !== false,
      contributedBy: contributedBy || null,
    },
  });

  return created;
}

/**
 * Get all active OCR patterns
 */
export async function getAllOCRPatterns(
  countryCode?: string,
  institution?: string
): Promise<OCRPatternDefinition[]> {
  const where: any = {
    isActive: true,
  };

  if (countryCode) {
    where.countryCode = countryCode.toUpperCase();
  }

  if (institution) {
    where.institution = {
      contains: institution,
      mode: 'insensitive',
    };
  }

  const patterns = await prisma.oCRPattern.findMany({
    where,
    orderBy: [
      { usageCount: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return patterns.map((p) => ({
    id: p.id,
    institution: p.institution,
    countryCode: p.countryCode,
    name: p.name,
    description: p.description || undefined,
    regex: p.regex,
    extractFields: p.extractFields as any,
    bank: p.bank || undefined,
    currency: p.currency || undefined,
    sampleImageUrl: p.sampleImageUrl || undefined,
    ocrExample: p.ocrExample || undefined,
    isVerified: p.isVerified,
    isActive: p.isActive,
  }));
}

