/**
 * Pattern Matcher
 * Matches SMS against existing patterns (global/user/institution) before extraction
 */

import prisma from './prisma';
import { flexibleExtract } from './flexibleExtractor';

interface PatternMatch {
  matched: boolean;
  pattern: any;
  source: 'user' | 'institution' | 'country' | null;
  confidence: number;
  extractedData?: {
    txnId: string | null;
    amount: number | null;
    sender: string | null;
    bank: string | null;
    currency: string | null;
  };
}

/**
 * Find matching pattern for SMS text
 * Checks in order: user patterns, institution patterns, country patterns
 * @param smsText - SMS text to match
 * @param userId - User ID (optional, for user patterns)
 * @param countryCode - Country code (optional, for institution/country patterns)
 * @returns Pattern match result
 */
export async function findMatchingPattern(
  smsText: string,
  userId?: string | null,
  countryCode?: string | null
): Promise<PatternMatch> {
  // Step 1: Check user patterns (if userId provided)
  if (userId) {
    const userPatterns = await prisma.pattern.findMany({
      where: { userId },
    });

    for (const pattern of userPatterns) {
      try {
        const extracted = flexibleExtract(smsText, pattern);
        if (extracted.txnId || extracted.amount) {
          return {
            matched: true,
            pattern,
            source: 'user',
            confidence: 0.9,
            extractedData: extracted,
          };
        }
      } catch (error) {
        // Pattern didn't match, continue
        continue;
      }
    }
  }

  // Step 2: Check institution patterns (if countryCode provided)
  if (countryCode) {
    try {
      const institutionPatterns = await (prisma as any).institutionPattern.findMany({
        where: {
          countryCode: countryCode.toUpperCase(),
          isVerified: true,
        },
      });

      for (const pattern of institutionPatterns) {
        try {
          const extracted = flexibleExtract(smsText, pattern);
          if (extracted.txnId || extracted.amount) {
            return {
              matched: true,
              pattern,
              source: 'institution',
              confidence: 0.85,
              extractedData: extracted,
            };
          }
        } catch (error) {
          // Pattern didn't match, continue
          continue;
        }
      }
    } catch (error) {
      // InstitutionPattern might not exist in schema, continue
      console.warn('Error checking institution patterns:', error);
    }
  }

  // Step 3: Check country patterns (if countryCode provided)
  if (countryCode) {
    try {
      const country = await prisma.country.findUnique({
        where: { code: countryCode.toUpperCase() },
        select: { id: true },
      });

      if (country) {
        const countryPatterns = await prisma.countryPattern.findMany({
          where: {
            countryId: country.id,
            isApproved: true,
            isTemplate: true,
          },
        });

        for (const pattern of countryPatterns) {
          try {
            const extracted = flexibleExtract(smsText, pattern);
            if (extracted.txnId || extracted.amount) {
              return {
                matched: true,
                pattern,
                source: 'country',
                confidence: 0.8,
                extractedData: extracted,
              };
            }
          } catch (error) {
            // Pattern didn't match, continue
            continue;
          }
        }
      }
    } catch (error) {
      // Error checking country patterns, continue
      console.warn('Error checking country patterns:', error);
    }
  }

  // No match found
  return {
    matched: false,
    pattern: null,
    source: null,
    confidence: 0,
  };
}

/**
 * Check if SMS matches any existing pattern
 * @param smsText - SMS text to check
 * @param userId - User ID (optional)
 * @param countryCode - Country code (optional)
 * @returns True if pattern exists, false otherwise
 */
export async function patternExists(
  smsText: string,
  userId?: string | null,
  countryCode?: string | null
): Promise<boolean> {
  const match = await findMatchingPattern(smsText, userId, countryCode);
  return match.matched;
}
