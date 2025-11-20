/**
 * Pattern Matching Utility
 * Matches SMS text against existing patterns to find if a pattern already exists
 */

import { prisma } from './prisma';

interface PatternMatchResult {
  matched: boolean;
  pattern?: any;
  confidence: number;
  source: 'user' | 'institution' | 'country' | null;
  extractedData?: any;
}

/**
 * Match SMS against user's patterns
 */
async function matchUserPatterns(smsText: string, userId: string): Promise<PatternMatchResult | null> {
  const userPatterns = await prisma.pattern.findMany({
    where: { userId },
  });

  for (const pattern of userPatterns) {
    const match = tryMatchPattern(smsText, pattern);
    if (match.matched && match.confidence > 0.7) {
      return {
        matched: true,
        pattern,
        confidence: match.confidence,
        source: 'user',
        extractedData: match.extractedData,
      };
    }
  }

  return null;
}

/**
 * Match SMS against institution patterns
 */
async function matchInstitutionPatterns(
  smsText: string,
  countryCode?: string | null
): Promise<PatternMatchResult | null> {
  const where: any = { isVerified: true };
  if (countryCode) {
    where.countryCode = countryCode.toUpperCase();
  }

  const institutionPatterns = await (prisma as any).institutionPattern.findMany({
    where,
  });

  for (const pattern of institutionPatterns) {
    const match = tryMatchPattern(smsText, pattern);
    if (match.matched && match.confidence > 0.7) {
      return {
        matched: true,
        pattern,
        confidence: match.confidence,
        source: 'institution',
        extractedData: match.extractedData,
      };
    }
  }

  return null;
}

/**
 * Match SMS against country patterns
 */
async function matchCountryPatterns(
  smsText: string,
  countryCode?: string | null
): Promise<PatternMatchResult | null> {
  if (!countryCode) return null;

  const countryPatterns = await prisma.countryPattern.findMany({
    where: {
      country: {
        code: countryCode.toUpperCase(),
      },
      isApproved: true,
    },
  });

  for (const pattern of countryPatterns) {
    const match = tryMatchPattern(smsText, pattern);
    if (match.matched && match.confidence > 0.7) {
      return {
        matched: true,
        pattern,
        confidence: match.confidence,
        source: 'country',
        extractedData: match.extractedData,
      };
    }
  }

  return null;
}

/**
 * Try to match SMS against a single pattern
 */
function tryMatchPattern(smsText: string, pattern: any): {
  matched: boolean;
  confidence: number;
  extractedData?: any;
} {
  try {
    // Remove (?i) prefix if present (JavaScript doesn't support inline flags)
    let regexStr = pattern.regex;
    if (regexStr.startsWith('(?i)')) {
      regexStr = regexStr.substring(4);
    }
    regexStr = regexStr.replace(/\(\?i\)/g, '');

    const regex = new RegExp(regexStr, 'i');
    const match = smsText.match(regex);

    if (!match) {
      // Try keyword-based extraction as fallback
      return tryKeywordExtraction(smsText, pattern);
    }

    // Extract data using capture groups
    const extractFields = pattern.extractFields as Record<string, number>;
    const extractedData: any = {};

    if (extractFields.amount && match[extractFields.amount]) {
      const amountStr = match[extractFields.amount].replace(/,/g, '');
      extractedData.amount = parseFloat(amountStr) || null;
    }
    if (extractFields.txnId && match[extractFields.txnId]) {
      extractedData.txnId = match[extractFields.txnId].trim();
    }
    if (extractFields.sender && match[extractFields.sender]) {
      extractedData.sender = match[extractFields.sender].trim();
    }

    // Calculate confidence based on how many fields were extracted
    const fieldsFound = Object.keys(extractedData).length;
    const totalFields = Object.keys(extractFields).filter(
      (k) => extractFields[k] !== null
    ).length;
    const confidence = totalFields > 0 ? fieldsFound / totalFields : 0.5;

    return {
      matched: true,
      confidence: Math.max(confidence, 0.5), // Minimum 0.5 if regex matched
      extractedData,
    };
  } catch (error) {
    // Regex error - try keyword extraction
    return tryKeywordExtraction(smsText, pattern);
  }
}

/**
 * Try keyword-based extraction as fallback
 */
function tryKeywordExtraction(smsText: string, pattern: any): {
  matched: boolean;
  confidence: number;
  extractedData?: any;
} {
  const { extractActualValues } = require('./extractFromSMS');
  const extracted = extractActualValues(smsText);

  // Check if extracted values match pattern's expected fields
  const extractFields = pattern.extractFields as Record<string, number>;
  let matches = 0;
  let total = 0;

  if (extractFields.amount !== null) {
    total++;
    if (extracted.amount) matches++;
  }
  if (extractFields.txnId !== null) {
    total++;
    if (extracted.txnId) matches++;
  }
  if (extractFields.sender !== null) {
    total++;
    if (extracted.sender) matches++;
  }

  // Check bank/currency match
  if (pattern.bank && extracted.bank) {
    if (extracted.bank.toLowerCase().includes(pattern.bank.toLowerCase()) ||
        pattern.bank.toLowerCase().includes(extracted.bank.toLowerCase())) {
      matches += 0.5;
      total += 0.5;
    }
  }
  if (pattern.currency && extracted.currency) {
    if (extracted.currency === pattern.currency) {
      matches += 0.5;
      total += 0.5;
    }
  }

  const confidence = total > 0 ? matches / total : 0.3;

  return {
    matched: confidence > 0.5,
    confidence,
    extractedData: extracted,
  };
}

/**
 * Find matching pattern for SMS text
 * Checks in order: user patterns -> institution patterns -> country patterns
 */
export async function findMatchingPattern(
  smsText: string,
  userId: string,
  countryCode?: string | null
): Promise<PatternMatchResult | null> {
  // 1. Check user's patterns first (highest priority)
  const userMatch = await matchUserPatterns(smsText, userId);
  if (userMatch) {
    return userMatch;
  }

  // 2. Check institution patterns
  const institutionMatch = await matchInstitutionPatterns(smsText, countryCode);
  if (institutionMatch) {
    return institutionMatch;
  }

  // 3. Check country patterns
  const countryMatch = await matchCountryPatterns(smsText, countryCode);
  if (countryMatch) {
    return countryMatch;
  }

  return null;
}

/**
 * Check if SMS matches any existing pattern (for duplicate detection)
 */
export async function checkPatternExists(
  smsText: string,
  userId: string,
  countryCode?: string | null
): Promise<{
  exists: boolean;
  pattern?: any;
  source?: 'user' | 'institution' | 'country';
  message?: string;
}> {
  const match = await findMatchingPattern(smsText, userId, countryCode);

  if (match && match.matched) {
    return {
      exists: true,
      pattern: match.pattern,
      source: match.source || undefined,
      message: `A similar pattern already exists in your ${match.source || 'patterns'}`,
    };
  }

  return { exists: false };
}

