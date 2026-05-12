/**
 * Confidence-based Transaction ID Filter
 * Uses OCR confidence scores to filter high-quality candidates
 */

import { OCRBlock } from './spatialTxnIdExtractor';
import { isValidTxnId } from './spatialTxnIdExtractor';

/**
 * Filter blocks by minimum confidence
 */
export function filterByConfidence(
  blocks: OCRBlock[],
  minConfidence: number = 0.7
): OCRBlock[] {
  return blocks.filter(block => 
    (block.confidence ?? 0.8) >= minConfidence
  );
}

/**
 * Extract transaction ID from high-confidence blocks near transaction labels
 */
export function extractHighConfidenceTxnId(blocks: OCRBlock[]): string | null {
  if (!blocks || blocks.length === 0) return null;
  
  // Filter to high confidence blocks
  const highConfBlocks = filterByConfidence(blocks, 0.75);
  
  if (highConfBlocks.length === 0) return null;
  
  // Find transaction-related labels
  const labelBlocks = highConfBlocks.filter(block => {
    const text = block.text.toLowerCase();
    return /transaction|txn|ref/i.test(text) && 
           (text.includes('number') || text.includes('id') || text.includes('no'));
  });
  
  if (labelBlocks.length === 0) return null;
  
  // For each label, find nearby high-confidence transaction IDs
  for (const label of labelBlocks) {
    const labelY = label.boundingBox.y;
    const labelX = label.boundingBox.x;
    
    // Find high-confidence transaction IDs near this label
    const candidates = highConfBlocks
      .filter(block => {
        if (block === label) return false;
        
        const blockText = block.text.trim();
        if (!isValidTxnId(blockText)) return false;
        
        // Check proximity (within 200px horizontally or vertically)
        const yDiff = Math.abs(block.boundingBox.y - labelY);
        const xDiff = Math.abs(block.boundingBox.x - labelX);
        
        return (yDiff < 30 && xDiff < 300) || (xDiff < 50 && yDiff < 100);
      })
      .sort((a, b) => {
        // Sort by confidence (higher first), then by distance
        const confDiff = (b.confidence ?? 0) - (a.confidence ?? 0);
        if (Math.abs(confDiff) > 0.1) return confDiff;
        
        const distA = Math.abs(a.boundingBox.y - labelY) + Math.abs(a.boundingBox.x - labelX);
        const distB = Math.abs(b.boundingBox.y - labelY) + Math.abs(b.boundingBox.x - labelX);
        return distA - distB;
      });
    
    if (candidates.length > 0) {
      return candidates[0].text.trim();
    }
  }
  
  return null;
}












