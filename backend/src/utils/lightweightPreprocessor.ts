/**
 * Lightweight OCR Text Preprocessor
 * Fixes common OCR errors without heavy processing
 */

export function preprocessOCRText(ocrText: string): string {
  if (!ocrText) return '';
  
  // Normalize whitespace (replace multiple spaces/newlines with single space)
  let text = ocrText.replace(/\s+/g, ' ');
  
  // Fix common OCR character errors in labels
  const labelFixes: [RegExp, string][] = [
    [/transacti0n/gi, 'transaction'],
    [/transacti0n/gi, 'transaction'],
    [/nurnber/gi, 'number'],
    [/nurnber/gi, 'number'],
    [/transacti0n\s+nurnber/gi, 'transaction number'],
    [/transacti0n\s+id/gi, 'transaction id'],
    [/transacti0n\s+no/gi, 'transaction no'],
  ];
  
  for (const [pattern, replacement] of labelFixes) {
    text = text.replace(pattern, replacement);
  }
  
  // Normalize separators (different types of colons)
  text = text.replace(/[:：]/g, ':');
  
  // Normalize common variations
  text = text.replace(/\btrans\s+no\b/gi, 'transaction number');
  text = text.replace(/\btxn\s+no\b/gi, 'transaction number');
  text = text.replace(/\btxn\s+id\b/gi, 'transaction id');
  
  return text.trim();
}












