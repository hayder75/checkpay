/**
 * Transaction ID Extractor
 * Extracts multiple transaction IDs from SMS text
 * Some wallets send both their own transaction ID AND the bank's reference number
 */

interface ExtractedIds {
  primaryTxnId: string | null;
  referenceTxnId: string | null;
  allIds: string[]; // All transaction IDs found
}

/**
 * Extract transaction IDs from SMS text
 * Looks for patterns like:
 * - "Transaction number: MPESA123, Ref: CBE456"
 * - "Txn: ABC123, Bank Ref: XYZ789"
 * - Multiple transaction IDs in the same message
 */
export function extractTransactionIds(smsText: string, providedTxnId?: string): ExtractedIds {
  if (!smsText) {
    return {
      primaryTxnId: providedTxnId || null,
      referenceTxnId: null,
      allIds: providedTxnId ? [providedTxnId] : [],
    };
  }

  const upperText = smsText.toUpperCase();
  const allIds: string[] = [];
  
  // Pattern 1: Explicit transaction number patterns
  const txnIdPatterns = [
    /transaction\s+number\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /transaction\s+id\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /txn\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /txn\s+no\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /transaction\s+no\s*[: ]+\s*([A-Z0-9]{6,})/i,
  ];

  // Pattern 2: Reference number patterns (bank reference)
  const refPatterns = [
    /ref\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /reference\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /bank\s+ref\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /bank\s+reference\s*[: ]+\s*([A-Z0-9]{6,})/i,
    /reference\s+number\s*[: ]+\s*([A-Z0-9]{6,})/i,
  ];

  // Pattern 3: Generic alphanumeric codes (6+ chars) that look like transaction IDs
  const genericPattern = /\b([A-Z0-9]{6,})\b/g;

  // Extract explicit transaction IDs
  for (const pattern of txnIdPatterns) {
    const match = smsText.match(pattern);
    if (match && match[1] && match[1].length >= 6) {
      const id = match[1].trim();
      if (!allIds.includes(id)) {
        allIds.push(id);
      }
    }
  }

  // Extract reference numbers
  for (const pattern of refPatterns) {
    const match = smsText.match(pattern);
    if (match && match[1] && match[1].length >= 6) {
      const id = match[1].trim();
      if (!allIds.includes(id)) {
        allIds.push(id);
      }
    }
  }

  // Extract generic codes (fallback)
  const genericMatches = smsText.matchAll(genericPattern);
  for (const match of genericMatches) {
    const id = match[1];
    // Skip if it's a phone number, date, or already found
    if (
      id.length >= 6 &&
      !id.match(/^\d{10,}$/) && // Not a phone number
      !id.match(/^\d{4}-\d{2}-\d{2}/) && // Not a date
      !allIds.includes(id) &&
      !id.match(/^(ETB|KES|NGN|GHS|USD|EUR)/i) // Not a currency code
    ) {
      allIds.push(id);
    }
  }

  // Remove duplicates and sort by length (longer IDs are usually more specific)
  const uniqueIds = Array.from(new Set(allIds)).sort((a, b) => b.length - a.length);

  // Determine primary and reference IDs
  let primaryTxnId: string | null = null;
  let referenceTxnId: string | null = null;

  if (providedTxnId) {
    // If user provided a transaction ID, use it as primary
    primaryTxnId = providedTxnId;
    // Check if it's in the extracted IDs, if not add it
    if (!uniqueIds.includes(providedTxnId)) {
      uniqueIds.unshift(providedTxnId);
    }
  } else if (uniqueIds.length > 0) {
    // Use the first (longest) extracted ID as primary
    primaryTxnId = uniqueIds[0];
  }

  // If we have multiple IDs, use the second one as reference
  if (uniqueIds.length > 1) {
    // If primary was provided, use first extracted as reference
    // Otherwise, use second extracted as reference
    const referenceIndex = providedTxnId ? 0 : 1;
    if (uniqueIds[referenceIndex] && uniqueIds[referenceIndex] !== primaryTxnId) {
      referenceTxnId = uniqueIds[referenceIndex];
    }
  }

  // If we have more than 2 IDs, prioritize ones that look like references
  if (uniqueIds.length > 2 && !referenceTxnId) {
    // Look for IDs that appear after "ref", "reference", "bank ref" keywords
    const refKeywords = /(?:ref|reference|bank\s+ref|bank\s+reference)\s*[: ]+\s*([A-Z0-9]{6,})/gi;
    const refMatch = smsText.match(refKeywords);
    if (refMatch) {
      // Extract the ID after the keyword
      const refPattern = /(?:ref|reference|bank\s+ref|bank\s+reference)\s*[: ]+\s*([A-Z0-9]{6,})/i;
      const match = smsText.match(refPattern);
      if (match && match[1] && match[1] !== primaryTxnId) {
        referenceTxnId = match[1].trim();
      }
    }
  }

  return {
    primaryTxnId: primaryTxnId || providedTxnId || null,
    referenceTxnId,
    allIds: uniqueIds,
  };
}

/**
 * Check if SMS text contains multiple transaction IDs
 */
export function hasMultipleTransactionIds(smsText: string): boolean {
  const extracted = extractTransactionIds(smsText);
  return extracted.allIds.length > 1;
}

