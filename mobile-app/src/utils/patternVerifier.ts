/**
 * Pattern Verification Utility
 * Downloads patterns from backend and matches SMS locally on device
 * Privacy-focused: SMS never leaves the device
 */

import { storage } from '../services/storage';
import { institutionPatternsAPI } from '../services/api';
import { findMatchingInstitutionPattern, InstitutionPattern } from './patternMatcher';

/**
 * Download and store patterns for a country
 */
export async function downloadCountryPatterns(countryCode: string): Promise<InstitutionPattern[]> {
  try {
    console.log('📥 [Pattern Download] Downloading patterns for country:', countryCode);
    
    const response = await institutionPatternsAPI.getCountryPatterns(countryCode);
    
    if (response.success && response.data) {
      // Backend returns { data: { patterns: [...], countryPatterns: [...] } }
      const allPatterns = response.data.patterns || [];
      
      // Backend already formats patterns correctly, just ensure they have the right structure
      const mappedPatterns: InstitutionPattern[] = allPatterns.map((p: any) => ({
        id: p.id,
        name: p.name || p.institution || p.bank || 'Pattern',
        institution: p.institution || null,
        regex: p.regex,
        extractFields: p.extractFields || {},
        bank: p.bank || null,
        currency: p.currency || null,
        usageCount: p.usageCount || 0,
        smsExample: p.smsExample || null,
        type: p.type || (p.institution ? 'institution' : 'country'),
      }));
      
      console.log(`✅ [Pattern Download] Downloaded ${mappedPatterns.length} patterns`);
      if (mappedPatterns.length > 0) {
        console.log('📋 [Pattern Download] Sample pattern:', {
          id: mappedPatterns[0].id,
          name: mappedPatterns[0].name,
          institution: mappedPatterns[0].institution,
          hasRegex: !!mappedPatterns[0].regex,
          regexPreview: mappedPatterns[0].regex?.substring(0, 50) + '...',
          extractFields: mappedPatterns[0].extractFields,
        });
      }
      
      // Store locally
      console.log('💾 [Pattern Download] Saving patterns to storage...');
      await storage.setInstitutionPatterns(mappedPatterns);
      
      // Verify patterns were saved
      const savedPatterns = await storage.getInstitutionPatterns();
      if (savedPatterns.length === mappedPatterns.length) {
        console.log(`✅ [Pattern Download] Successfully saved and verified ${savedPatterns.length} patterns`);
      } else {
        console.error(`❌ [Pattern Download] Save verification failed: expected ${mappedPatterns.length}, got ${savedPatterns.length}`);
      }
      
      return mappedPatterns;
    }
    
    console.warn('⚠️ [Pattern Download] No patterns found for country:', countryCode);
    return [];
  } catch (error) {
    console.error('❌ [Pattern Download] Error downloading patterns:', error);
    // Return cached patterns if available
    const cached = await storage.getInstitutionPatterns();
    if (cached.length > 0) {
      console.log('📥 [Pattern Download] Using cached patterns:', cached.length);
      return cached;
    }
    return [];
  }
}

/**
 * Verify if an SMS is financial using local patterns
 * Returns verification result with confidence score
 */
export function verifyFinancialSMSWithPatterns(
  smsText: string,
  patterns: InstitutionPattern[],
  senderAddress?: string
): {
  isFinancial: boolean;
  confidence: number;
  matchedPattern?: InstitutionPattern;
  extractedData?: {
    txnId: string;
    amount: number;
    sender: string;
    bank: string;
    currency: string;
  };
} {
  if (patterns.length === 0) {
    // No patterns available - can't verify
    return { isFinancial: false, confidence: 0 };
  }

  console.log(`🔍 [Pattern Verification] Checking SMS against ${patterns.length} patterns`);
  
  // Try to match against patterns
  const matchResult = findMatchingInstitutionPattern(smsText, patterns, senderAddress);
  
  if (matchResult.matched && matchResult.pattern && matchResult.data) {
    console.log('✅ [Pattern Verification] Pattern matched:', {
      patternId: matchResult.pattern.id,
      institution: matchResult.pattern.institution,
      confidence: matchResult.confidence,
      extractedTxnId: matchResult.data.txnId,
      extractedAmount: matchResult.data.amount,
    });
    
    return {
      isFinancial: true,
      confidence: matchResult.confidence,
      matchedPattern: matchResult.pattern,
      extractedData: {
        txnId: matchResult.data.txnId,
        amount: matchResult.data.amount,
        sender: matchResult.data.sender,
        bank: matchResult.data.bank,
        currency: matchResult.data.currency,
      },
    };
  }
  
  console.log('❌ [Pattern Verification] No pattern matched');
  return { isFinancial: false, confidence: 0 };
}

/**
 * Verify multiple SMS messages against patterns
 * Returns verified list with confidence scores
 */
export async function verifyFinancialSMSBatch(
  smsList: Array<{ id: string; body: string; address: string; date: number }>,
  countryCode: string
): Promise<Array<{
  smsId: string;
  isFinancial: boolean;
  confidence: number;
  matchedPattern?: InstitutionPattern;
  extractedData?: any;
}>> {
  // Load patterns (download if needed)
  let patterns = await storage.getInstitutionPatterns();
  
  // Check if patterns are for the right country
  if (patterns.length === 0 || patterns[0]?.type === undefined) {
    console.log('📥 [Pattern Verification] No patterns cached, downloading...');
    patterns = await downloadCountryPatterns(countryCode);
  }
  
  const results = smsList.map(sms => {
    const verification = verifyFinancialSMSWithPatterns(sms.body, patterns, sms.address);
    
    return {
      smsId: sms.id,
      isFinancial: verification.isFinancial,
      confidence: verification.confidence,
      matchedPattern: verification.matchedPattern,
      extractedData: verification.extractedData,
    };
  });
  
  const verifiedCount = results.filter(r => r.isFinancial).length;
  console.log(`✅ [Pattern Verification] Verified ${verifiedCount}/${smsList.length} SMS as financial`);
  
  return results;
}

