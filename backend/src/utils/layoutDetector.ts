/**
 * Simple Layout Detector
 * Groups text blocks into rows and detects form-like structures
 */

import { OCRBlock } from './spatialTxnIdExtractor';
import { isValidTxnId } from './spatialTxnIdExtractor';

interface FormField {
  label: string;
  value: string;
  type: 'txnId' | 'amount' | 'date' | 'other';
}

/**
 * Group blocks into rows based on Y position
 */
function groupIntoRows(blocks: OCRBlock[], yTolerance: number = 15): OCRBlock[][] {
  const rows: OCRBlock[][] = [];
  
  for (const block of blocks) {
    const y = block.boundingBox.y;
    let foundRow = false;
    
    // Try to add to existing row
    for (const row of rows) {
      const rowY = row[0].boundingBox.y;
      if (Math.abs(rowY - y) < yTolerance) {
        row.push(block);
        foundRow = true;
        break;
      }
    }
    
    // Create new row if not found
    if (!foundRow) {
      rows.push([block]);
    }
  }
  
  // Sort blocks in each row by X position (left to right)
  for (const row of rows) {
    row.sort((a, b) => a.boundingBox.x - b.boundingBox.x);
  }
  
  return rows;
}

/**
 * Infer field type from label text
 */
function inferFieldType(label: string): FormField['type'] {
  const lower = label.toLowerCase();
  if (lower.includes('transaction') && (lower.includes('number') || lower.includes('id'))) {
    return 'txnId';
  }
  if (lower.includes('amount') || lower.includes('total')) {
    return 'amount';
  }
  if (lower.includes('date') || lower.includes('time')) {
    return 'date';
  }
  return 'other';
}

/**
 * Detect form layout and extract fields
 */
export function detectFormLayout(blocks: OCRBlock[]): FormField[] {
  if (!blocks || blocks.length === 0) return [];
  
  const rows = groupIntoRows(blocks);
  const fields: FormField[] = [];
  
  for (const row of rows) {
    // Look for label-value pairs in the row
    for (let i = 0; i < row.length - 1; i++) {
      const potentialLabel = row[i];
      const potentialValue = row[i + 1];
      
      const labelText = potentialLabel.text.toLowerCase().trim();
      const valueText = potentialValue.text.trim();
      
      // Check if this looks like a label-value pair
      const isLabel = labelText.includes(':') || 
                     labelText.includes('transaction') ||
                     labelText.includes('txn') ||
                     labelText.includes('ref') ||
                     labelText.includes('amount') ||
                     labelText.includes('date');
      
      if (isLabel) {
        const fieldType = inferFieldType(potentialLabel.text);
        
        // For transaction ID, validate the value
        if (fieldType === 'txnId' && isValidTxnId(valueText)) {
          fields.push({
            label: potentialLabel.text,
            value: valueText,
            type: 'txnId',
          });
        } else if (fieldType !== 'txnId') {
          // For other fields, accept any value
          fields.push({
            label: potentialLabel.text,
            value: valueText,
            type: fieldType,
          });
        }
      }
    }
  }
  
  return fields;
}

/**
 * Extract transaction ID from form layout
 */
export function extractTxnIdFromLayout(blocks: OCRBlock[]): string | null {
  const fields = detectFormLayout(blocks);
  const txnIdField = fields.find(f => f.type === 'txnId');
  return txnIdField ? txnIdField.value : null;
}












