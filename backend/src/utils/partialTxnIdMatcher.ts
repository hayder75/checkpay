/**
 * Partial Transaction ID Matcher
 * Matches transactions with common prefixes (e.g., FT25315HZNYL59221741 vs FT25315HZNYL50058423)
 */

/**
 * Extract common prefix from two transaction IDs
 * Returns the longest common prefix
 */
export function extractCommonPrefix(txnId1: string, txnId2: string): string {
  const minLength = Math.min(txnId1.length, txnId2.length);
  let prefix = '';

  for (let i = 0; i < minLength; i++) {
    if (txnId1[i] === txnId2[i]) {
      prefix += txnId1[i];
    } else {
      break;
    }
  }

  return prefix;
}

/**
 * Extract meaningful prefix from a transaction ID
 * Tries to find a pattern-based prefix (e.g., before first long digit sequence)
 */
export function extractPrefix(txnId: string, minPrefixLength: number = 8): string {
  if (txnId.length <= minPrefixLength) {
    return txnId;
  }

  // Try to find a pattern: letters followed by numbers
  // Example: FT25315HZNYL59221741 -> FT25315HZNYL (before the long number sequence)
  const letterNumberMatch = txnId.match(/^([A-Z]+[0-9]*[A-Z]+)/);
  if (letterNumberMatch && letterNumberMatch[1].length >= minPrefixLength) {
    return letterNumberMatch[1];
  }

  // Try to find pattern: letters + short numbers + letters
  // Example: FT25315HZNYL -> FT25315HZNYL
  const complexMatch = txnId.match(/^([A-Z0-9]{8,})(\d{6,})/);
  if (complexMatch && complexMatch[1].length >= minPrefixLength) {
    return complexMatch[1];
  }

  // Fallback: return first N characters
  return txnId.substring(0, Math.max(minPrefixLength, Math.floor(txnId.length * 0.6)));
}

/**
 * Check if two transaction IDs match (exact or partial)
 * @param txnId1 First transaction ID
 * @param txnId2 Second transaction ID
 * @param minPrefixLength Minimum prefix length for partial match (default: 8)
 * @returns Object with match result and confidence
 */
export function matchTransactionIds(
  txnId1: string,
  txnId2: string,
  minPrefixLength: number = 8
): {
  matched: boolean;
  confidence: number;
  commonPrefix: string;
  matchType: 'exact' | 'partial' | 'none';
} {
  // Normalize transaction IDs (uppercase, trim)
  const id1 = txnId1.toUpperCase().trim();
  const id2 = txnId2.toUpperCase().trim();

  // Exact match
  if (id1 === id2) {
    return {
      matched: true,
      confidence: 1.0,
      commonPrefix: id1,
      matchType: 'exact',
    };
  }

  // Partial match - find common prefix
  const commonPrefix = extractCommonPrefix(id1, id2);

  if (commonPrefix.length >= minPrefixLength) {
    // Calculate confidence based on prefix length
    const maxLength = Math.max(id1.length, id2.length);
    const confidence = Math.min(0.95, 0.7 + (commonPrefix.length / maxLength) * 0.25);

    return {
      matched: true,
      confidence,
      commonPrefix,
      matchType: 'partial',
    };
  }

  return {
    matched: false,
    confidence: 0,
    commonPrefix: '',
    matchType: 'none',
  };
}

/**
 * Find transactions with matching prefix
 * Used for verification when transaction IDs have variations
 */
export function findTransactionsByPrefix(
  transactions: Array<{ txnId: string; [key: string]: any }>,
  searchTxnId: string,
  minPrefixLength: number = 8
): Array<{
  transaction: any;
  confidence: number;
  commonPrefix: string;
  matchType: 'exact' | 'partial';
}> {
  const matches: Array<{
    transaction: any;
    confidence: number;
    commonPrefix: string;
    matchType: 'exact' | 'partial';
  }> = [];

  for (const txn of transactions) {
    const match = matchTransactionIds(searchTxnId, txn.txnId, minPrefixLength);
    if (match.matched) {
      matches.push({
        transaction: txn,
        confidence: match.confidence,
        commonPrefix: match.commonPrefix,
        matchType: match.matchType as 'exact' | 'partial',
      });
    }
  }

  // Sort by confidence (highest first), then by match type (exact before partial)
  matches.sort((a, b) => {
    if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
    if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;
    return b.confidence - a.confidence;
  });

  return matches;
}

