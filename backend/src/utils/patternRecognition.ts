/**
 * Pattern Recognition Engine
 * Tries multiple extraction methods in order of priority
 */

import { extractTxnIdEnhanced } from './extractFromSMS';
import { extractTxnIdWithLLM } from './llmExtractor';
import { generatePatternFromSMS } from './patternAI';

interface RecognitionResult {
  success: boolean;
  extractedTxnId: string | null;
  pattern?: any;
  confidence: number;
  method: 'url' | 'rule-based' | 'llm' | 'none';
}

/**
 * Recognize pattern from SMS and validate with user-provided transaction ID
 */
export async function recognizePattern(
  smsText: string,
  userTxnId: string
): Promise<RecognitionResult> {
  // Stage 1: Try URL extraction (fastest, highest confidence)
  const urlTxnId = extractTxnIdFromURL(smsText);
  if (urlTxnId && urlTxnId === userTxnId) {
    const pattern = generatePatternFromSMS(smsText, 'URL Pattern');
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
      const pattern = generatePatternFromSMS(smsText, 'Rule-Based Pattern');
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
        const pattern = generatePatternFromSMS(smsText, 'LLM Pattern');
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

/**
 * Extract transaction ID from URL (helper function)
 */
function extractTxnIdFromURL(text: string): string | null {
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlPattern) || [];
  
  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      
      // Check query parameters
      const txnParams = ['txn', 'transactionId', 'transaction_id', 'ref', 'reference', 'id', 'txnid'];
      for (const param of txnParams) {
        const value = urlObj.searchParams.get(param);
        if (value && value.length >= 4) {
          return value.trim();
        }
      }
      
      // Check path segments
      const pathMatch = urlObj.pathname.match(/\/(?:txn|transaction|ref|reference)\/([A-Z0-9_-]+)/i);
      if (pathMatch && pathMatch[1] && pathMatch[1].length >= 4) {
        return pathMatch[1].trim();
      }
      
      // Check hash fragments
      if (urlObj.hash) {
        const hashMatch = urlObj.hash.match(/[#&](?:txn|transactionId|ref)=([A-Z0-9_-]+)/i);
        if (hashMatch && hashMatch[1] && hashMatch[1].length >= 4) {
          return hashMatch[1].trim();
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
}





