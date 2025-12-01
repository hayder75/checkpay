/**
 * Pattern Deduplication
 * Detects duplicate or similar patterns to prevent creating redundant patterns
 */

import prisma from './prisma';
import { flexibleExtract } from './flexibleExtractor';

interface PatternSimilarity {
  pattern: any;
  similarity: number; // 0-1
  reason: 'exact_regex' | 'similar_regex' | 'same_bank_currency' | 'same_institution';
}

/**
 * Normalize regex pattern for comparison
 * Removes whitespace, makes case-insensitive, removes anchors
 */
function normalizeRegex(regex: string): string {
  return regex
    .replace(/^\^|\$$/g, '') // Remove anchors
    .replace(/\s+/g, '') // Remove whitespace
    .toLowerCase();
}

/**
 * Compare two regex patterns for similarity
 * @param regex1 - First regex pattern
 * @param regex2 - Second regex pattern
 * @returns Similarity score (0-1)
 */
export function compareRegexPatterns(regex1: string, regex2: string): number {
  const normalized1 = normalizeRegex(regex1);
  const normalized2 = normalizeRegex(regex2);
  
  // Exact match
  if (normalized1 === normalized2) {
    return 1.0;
  }
  
  // Check if one is a substring of the other (high similarity)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.85;
  }
  
  // Calculate Jaccard similarity (character-based)
  const set1 = new Set(normalized1);
  const set2 = new Set(normalized2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Check if pattern is duplicate of existing patterns
 * @param newPattern - New pattern to check
 * @param userId - User ID (optional, for user patterns)
 * @param countryCode - Country code (optional, for institution/country patterns)
 * @returns Similar patterns found
 */
export async function findSimilarPatterns(
  newPattern: {
    regex: string;
    bank?: string | null;
    currency?: string | null;
    institution?: string | null;
  },
  userId?: string | null,
  countryCode?: string | null
): Promise<PatternSimilarity[]> {
  const similarities: PatternSimilarity[] = [];
  
  // Check user patterns
  if (userId) {
    const userPatterns = await prisma.pattern.findMany({
      where: { userId },
    });
    
    for (const pattern of userPatterns) {
      const similarity = compareRegexPatterns(newPattern.regex, pattern.regex);
      
      if (similarity >= 0.8) {
        similarities.push({
          pattern,
          similarity,
          reason: similarity === 1.0 ? 'exact_regex' : 'similar_regex',
        });
      } else if (
        newPattern.bank && pattern.bank && 
        newPattern.bank === pattern.bank &&
        newPattern.currency && pattern.currency &&
        newPattern.currency === pattern.currency
      ) {
        // Same bank + currency but different regex (might be variations)
        similarities.push({
          pattern,
          similarity: 0.6,
          reason: 'same_bank_currency',
        });
      }
    }
  }
  
  // Check institution patterns
  if (countryCode && newPattern.institution) {
    try {
      const institutionPatterns = await (prisma as any).institutionPattern.findMany({
        where: {
          countryCode: countryCode.toUpperCase(),
          institution: newPattern.institution,
        },
      });
      
      for (const pattern of institutionPatterns) {
        const similarity = compareRegexPatterns(newPattern.regex, pattern.regex);
        
        if (similarity >= 0.8) {
          similarities.push({
            pattern,
            similarity,
            reason: similarity === 1.0 ? 'exact_regex' : 'similar_regex',
          });
        } else {
          similarities.push({
            pattern,
            similarity: 0.7,
            reason: 'same_institution',
          });
        }
      }
    } catch (error) {
      // InstitutionPattern might not exist, continue
      console.warn('Error checking institution patterns:', error);
    }
  }
  
  // Sort by similarity (highest first)
  return similarities.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Check if pattern should be promoted to global library
 * Criteria: Pattern is unique, verified, and useful
 * @param pattern - Pattern to check
 * @param userId - User ID
 * @returns True if should be promoted
 */
export async function shouldPromoteToGlobal(
  pattern: {
    regex: string;
    bank?: string | null;
    currency?: string | null;
    institution?: string | null;
  },
  userId: string
): Promise<boolean> {
  // Check if similar pattern already exists in global library
  if (pattern.institution) {
    try {
      const existing = await (prisma as any).institutionPattern.findFirst({
        where: {
          institution: pattern.institution,
        },
      });
      
      if (existing) {
        const similarity = compareRegexPatterns(pattern.regex, existing.regex);
        if (similarity >= 0.8) {
          return false; // Similar pattern already exists
        }
      }
    } catch (error) {
      // Continue if error
    }
  }
  
  // Check if multiple users have similar patterns (indicates it's useful)
  const similarUserPatterns = await prisma.pattern.findMany({
    where: {
      bank: pattern.bank || undefined,
      currency: pattern.currency || undefined,
      userId: { not: userId }, // Exclude current user
    },
  });
  
  // If 3+ users have similar patterns, it's worth promoting
  if (similarUserPatterns.length >= 3) {
    return true;
  }
  
  return false;
}

/**
 * Test if SMS matches pattern (for validation)
 * @param smsText - SMS text to test
 * @param pattern - Pattern to test against
 * @returns True if pattern matches SMS
 */
export function testPatternMatch(smsText: string, pattern: any): boolean {
  try {
    const extracted = flexibleExtract(smsText, pattern);
    return !!(extracted.txnId || extracted.amount);
  } catch (error) {
    return false;
  }
}


