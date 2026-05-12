/**
 * Hybrid Transaction ID Extractor
 * Combines multiple lightweight strategies for maximum reliability
 * Works offline, perfect for low-end devices and poor network
 */

import { OCRBlock, extractTxnIdSpatial } from './spatialTxnIdExtractor';
export { OCRBlock };
import { extractTxnIdFromLayout } from './layoutDetector';
import { extractHighConfidenceTxnId } from './confidenceFilter';
import { preprocessOCRText } from './lightweightPreprocessor';
import { extractTransactionIdFallback } from './ocrPatternExtractor';

export interface HybridExtractionResult {
  txnId: string | null;
  method: string;
  confidence: number;
}

/**
 * Extract from preprocessed text using improved patterns
 */
function extractFromPreprocessedText(text: string): string | null {
  // Enhanced patterns for preprocessed text
  const patterns = [
    /transaction\s+number\s*[:]\s*([A-Z0-9]{6,})/i,
    /transaction\s+id\s*[:]\s*([A-Z0-9]{6,})/i,
    /txn\s*[:]\s*([A-Z0-9]{6,})/i,
    /ref\s*[:]\s*([A-Z0-9]{6,})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const txnId = match[1].trim();
      if (txnId.length >= 6 && /^[A-Z0-9]+$/i.test(txnId) && /[A-Z]/i.test(txnId) && /[0-9]/.test(txnId)) {
        return txnId;
      }
    }
  }
  
  return null;
}

/**
 * Extract transaction ID using hybrid approach
 * Tries multiple strategies in order of reliability
 */
export function extractTxnIdHybrid(
  ocrText: string,
  blocks?: OCRBlock[]
): HybridExtractionResult {
  // Strategy 1: Spatial extraction (best - uses position data)
  if (blocks && blocks.length > 0) {
    const spatialResult = extractTxnIdSpatial(blocks);
    if (spatialResult) {
      return {
        txnId: spatialResult,
        method: 'spatial',
        confidence: 0.9,
      };
    }
    
    // Strategy 2: Layout detection (form reading)
    const layoutResult = extractTxnIdFromLayout(blocks);
    if (layoutResult) {
      return {
        txnId: layoutResult,
        method: 'layout',
        confidence: 0.85,
      };
    }
    
    // Strategy 3: Confidence-based filtering
    const confidenceResult = extractHighConfidenceTxnId(blocks);
    if (confidenceResult) {
      return {
        txnId: confidenceResult,
        method: 'confidence',
        confidence: 0.8,
      };
    }
  }
  
  // Strategy 4: Preprocessed text extraction
  const preprocessed = preprocessOCRText(ocrText);
  const textResult = extractFromPreprocessedText(preprocessed);
  if (textResult) {
    return {
      txnId: textResult,
      method: 'preprocessed_text',
      confidence: 0.7,
    };
  }
  
  // Strategy 5: Original fallback (regex-based)
  const fallbackResult = extractTransactionIdFallback(preprocessed);
  return {
    txnId: fallbackResult,
    method: 'fallback',
    confidence: fallbackResult ? 0.5 : 0,
  };
}












