/**
 * Spatial Transaction ID Extractor
 * Uses OCR block positions to find transaction IDs near labels
 * Works offline, lightweight, perfect for low-end devices
 */

export interface OCRBlock {
  text: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
}

interface ExtractionResult {
  txnId: string | null;
  method: string;
  confidence: number;
}

/**
 * Check if text looks like a transaction ID
 */
export function isValidTxnId(text: string): boolean {
  const trimmed = text.trim();
  
  // Length check
  if (trimmed.length < 6 || trimmed.length > 20) return false;
  
  // Must be alphanumeric
  if (!/^[A-Z0-9]+$/i.test(trimmed)) return false;
  
  // Must have both letters and numbers
  const hasLetter = /[A-Z]/i.test(trimmed);
  const hasNumber = /[0-9]/.test(trimmed);
  if (!hasLetter || !hasNumber) return false;
  
  // Filter out common false positives
  const falsePositives = [
    'TRANSACTION', 'NUMBER', 'SUCCESSFUL', 'FINISHED', 
    'DOWNLOAD', 'SHARE', 'ZEMEN', 'GEBEYA', 'ETHIOPIA'
  ];
  
  const upperText = trimmed.toUpperCase();
  for (const fp of falsePositives) {
    if (upperText.includes(fp) || upperText === fp) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculate distance between two blocks
 */
function calculateDistance(block1: OCRBlock, block2: OCRBlock): number {
  const x1 = block1.boundingBox.x + block1.boundingBox.width / 2;
  const y1 = block1.boundingBox.y + block1.boundingBox.height / 2;
  const x2 = block2.boundingBox.x + block2.boundingBox.width / 2;
  const y2 = block2.boundingBox.y + block2.boundingBox.height / 2;
  
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Extract transaction ID using spatial relationships
 * Strategy 1: Find labels and look for values nearby
 */
export function extractTxnIdSpatial(blocks: OCRBlock[]): string | null {
  if (!blocks || blocks.length === 0) return null;
  
  // Find label blocks (transaction number/id labels)
  const labelBlocks = blocks.filter(block => {
    const text = block.text.toLowerCase().trim();
    return (
      (text.includes('transaction') && (text.includes('number') || text.includes('id') || text.includes('no'))) ||
      (text.includes('txn') && (text.includes('number') || text.includes('id') || text.includes('no'))) ||
      (text === 'ref' || text === 'reference')
    );
  });
  
  if (labelBlocks.length === 0) return null;
  
  // For each label, find nearby value blocks
  for (const label of labelBlocks) {
    const labelRight = label.boundingBox.x + label.boundingBox.width;
    const labelY = label.boundingBox.y;
    const labelHeight = label.boundingBox.height;
    const labelCenterY = labelY + labelHeight / 2;
    
    // Find candidate blocks
    const candidates: Array<{ block: OCRBlock; distance: number; sameRow: boolean }> = [];
    
    for (const block of blocks) {
      if (block === label) continue; // Skip the label itself
      
      const blockText = block.text.trim();
      if (!isValidTxnId(blockText)) continue;
      
      const blockX = block.boundingBox.x;
      const blockY = block.boundingBox.y;
      const blockCenterY = blockY + block.boundingBox.height / 2;
      
      // Check if block is to the right (same row)
      const yDiff = Math.abs(blockCenterY - labelCenterY);
      const sameRow = yDiff < 20 && // Within 20px vertically
                     blockX > labelRight && // To the right
                     blockX < labelRight + 400; // Not too far (within 400px)
      
      // Check if block is below (same column)
      const xDiff = Math.abs(blockX - label.boundingBox.x);
      const below = xDiff < 50 && // Aligned horizontally (within 50px)
                   blockY > labelY && // Below
                   blockY < labelY + labelHeight + 100; // Not too far below
      
      if (sameRow || below) {
        const distance = calculateDistance(label, block);
        candidates.push({
          block,
          distance,
          sameRow,
        });
      }
    }
    
    // Sort candidates: prefer same row, then by distance
    candidates.sort((a, b) => {
      if (a.sameRow && !b.sameRow) return -1;
      if (!a.sameRow && b.sameRow) return 1;
      return a.distance - b.distance;
    });
    
    if (candidates.length > 0) {
      return candidates[0].block.text.trim();
    }
  }
  
  return null;
}












