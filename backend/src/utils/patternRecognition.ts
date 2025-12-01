/**
 * Pattern Recognition Engine
 * Tries multiple extraction methods in order of priority:
 * 1. Pattern matching (existing patterns)
 * 2. URL extraction
 * 3. Rule-based extraction
 * 4. LLM extraction (last resort)
 */

import { extractTxnIdEnhanced } from './extractFromSMS';
import { extractTxnIdWithLLM } from './llmExtractor';
import { generatePatternFromSMS } from './patternAI';
import { findMatchingPattern } from './patternMatcher';
import { extractTxnIdFromURL, generatePatternFromURL } from './urlPatternGenerator';

interface RecognitionResult {
  success: boolean;
  extractedTxnId: string | null;
  pattern?: any;
  confidence: number;
  method: 'existing' | 'url' | 'rule-based' | 'llm' | 'none';
  source?: 'user' | 'institution' | 'country' | null;
}

/**
 * Comprehensive rule-based pattern generator
 * Extracts ALL fields and generates complete pattern object
 */
export async function generateComprehensiveRuleBasedPattern(
  smsText: string,
  patternName: string,
  countryCode?: string | null
): Promise<any> {
  // Use existing generatePatternFromSMS which already does comprehensive extraction
  return generatePatternFromSMS(smsText, patternName, countryCode);
}

/**
 * Recognize pattern from SMS and validate with user-provided transaction ID
 * Implements smart flow: existing patterns → URL → rule-based → AI
 */
export async function recognizePattern(
  smsText: string,
  userTxnId: string,
  userId?: string | null,
  countryCode?: string | null
): Promise<RecognitionResult> {
  // Stage 0: Check existing patterns first (fastest, no extraction needed)
  if (userId || countryCode) {
    const patternMatch = await findMatchingPattern(smsText, userId, countryCode);
    if (patternMatch.matched && patternMatch.extractedData?.txnId === userTxnId) {
      return {
        success: true,
        extractedTxnId: patternMatch.extractedData.txnId,
        pattern: patternMatch.pattern,
        confidence: patternMatch.confidence,
        method: 'existing',
        source: patternMatch.source,
      };
    }
  }

  // Stage 1: Try URL extraction (fastest, highest confidence)
  const urlTxnId = extractTxnIdFromURL(smsText);
  if (urlTxnId && urlTxnId === userTxnId) {
    // Try to generate pattern from URL
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = smsText.match(urlPattern) || [];
    if (urls.length > 0) {
      const generatedPattern = generatePatternFromURL(urls[0], smsText);
      if (generatedPattern) {
        return {
          success: true,
          extractedTxnId: urlTxnId,
          pattern: {
            regex: generatedPattern.regex,
            extractFields: generatedPattern.extractFields,
            name: 'URL Pattern',
          },
          confidence: 0.95,
          method: 'url',
        };
      }
    }
    // Fallback to regular pattern generation
    const pattern = generatePatternFromSMS(smsText, 'URL Pattern', countryCode);
    return {
      success: true,
      extractedTxnId: urlTxnId,
      pattern,
      confidence: 0.95,
      method: 'url',
    };
  }

  // Stage 2: Try rule-based extraction
  const ruleBasedTxnId = extractTxnIdEnhanced(smsText);
  if (ruleBasedTxnId) {
    if (ruleBasedTxnId === userTxnId) {
      // Perfect match
      const pattern = await generateComprehensiveRuleBasedPattern(smsText, 'Rule-Based Pattern', countryCode);
      return {
        success: true,
        extractedTxnId: ruleBasedTxnId,
        pattern,
        confidence: 0.85,
        method: 'rule-based',
      };
    } else {
      // Extracted something but doesn't match - low confidence
      return {
        success: false,
        extractedTxnId: ruleBasedTxnId,
        confidence: 0.3,
        method: 'rule-based',
      };
    }
  }

  // Stage 3: Try LLM extraction (if rule-based failed or low confidence)
  try {
    const llmResult = await extractTxnIdWithLLM(smsText);
    if (llmResult.txnId) {
      if (llmResult.txnId === userTxnId) {
        // LLM match
        const pattern = generatePatternFromSMS(smsText, 'LLM Pattern', countryCode);
        return {
          success: true,
          extractedTxnId: llmResult.txnId,
          pattern,
          confidence: llmResult.confidence,
          method: 'llm',
        };
      } else {
        // LLM extracted something but doesn't match
        return {
          success: false,
          extractedTxnId: llmResult.txnId,
          confidence: 0.4,
          method: 'llm',
        };
      }
    }
  } catch (error) {
    console.error('LLM extraction failed:', error);
    // Continue to return failure
  }

  // No extraction method worked
  return {
    success: false,
    extractedTxnId: null,
    confidence: 0,
    method: 'none',
  };
}





