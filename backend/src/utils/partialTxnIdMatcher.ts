/**
 * Partial Transaction ID Matching
 * Handles cases where transaction IDs share a common prefix
 * Example: FT25315HZNYL59221741 and FT25315HZNYL50058423 should match
 */

interface Transaction {
  id: string;
  txnId: string;
  txnIdPrefix?: string | null;
  amount: number;
  sender: string;
  bank?: string | null;
  receivedAt: Date;
  pattern?: {
    name?: string;
    bank?: string | null;
  } | null;
}

interface PartialMatch {
  transaction: Transaction;
  commonPrefix: string;
  confidence: number; // 0-1
}

/**
 * Extract prefix from transaction ID
 * @param txnId - Transaction ID
 * @param minLength - Minimum prefix length (default: 8)
 * @returns Prefix string
 */
export function extractPrefix(txnId: string, minLength: number = 8): string {
  // Extract a meaningful prefix for matching
  // For IDs like "FT25315HZNYL59221741", we want to extract enough to match similar transactions
  if (txnId.length >= minLength) {
    // Extract at least minLength, but prefer longer prefixes for better matching
    // For short IDs (< 15 chars), use the full ID minus a few chars
    // For longer IDs, use first 12-15 chars
    if (txnId.length <= 15) {
      // For IDs like "FT25315HZNYL" (12 chars), use first 10-12 chars
      return txnId.substring(0, Math.max(minLength, txnId.length - 2));
    } else {
      // For longer IDs, use first 12-15 chars
      return txnId.substring(0, Math.min(15, Math.max(minLength, 12)));
    }
  }
  return txnId;
}

/**
 * Find common prefix between two transaction IDs
 * @param txnId1 - First transaction ID
 * @param txnId2 - Second transaction ID
 * @returns Common prefix and its length
 */
export function findCommonPrefix(txnId1: string, txnId2: string): { prefix: string; length: number } {
  let commonLength = 0;
  const minLength = Math.min(txnId1.length, txnId2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (txnId1[i] === txnId2[i]) {
      commonLength++;
    } else {
      break;
    }
  }
  
  return {
    prefix: txnId1.substring(0, commonLength),
    length: commonLength,
  };
}

/**
 * Calculate confidence score for partial match
 * @param commonPrefixLength - Length of common prefix
 * @param txnIdLength - Length of the transaction ID being matched
 * @returns Confidence score (0-1)
 */
export function calculateConfidence(commonPrefixLength: number, txnIdLength: number): number {
  if (commonPrefixLength === 0) return 0;
  
  // Higher confidence for longer prefixes
  const ratio = commonPrefixLength / txnIdLength;
  
  // Minimum 8 characters for high confidence
  if (commonPrefixLength >= 12) {
    return Math.min(0.95, 0.7 + ratio * 0.25);
  } else if (commonPrefixLength >= 8) {
    return Math.min(0.85, 0.5 + ratio * 0.35);
  } else if (commonPrefixLength >= 6) {
    return Math.min(0.7, 0.3 + ratio * 0.4);
  } else {
    return Math.min(0.5, ratio * 0.5);
  }
}

/**
 * Find transactions that match by prefix
 * @param transactions - Array of transactions to search
 * @param searchTxnId - Transaction ID to search for
 * @param minPrefixLength - Minimum prefix length for matching (default: 8)
 * @returns Array of matches sorted by confidence (highest first)
 */
export function findTransactionsByPrefix(
  transactions: Transaction[],
  searchTxnId: string,
  minPrefixLength: number = 8
): PartialMatch[] {
  const matches: PartialMatch[] = [];
  
  for (const transaction of transactions) {
    // Compare the full transaction IDs, not just prefixes
    // This handles cases where stored ID is shorter than search ID
    // Example: stored "FT25315HZNYL" should match search "FT25315HZNYL59221741"
    const common = findCommonPrefix(searchTxnId, transaction.txnId);
    
    if (common.length >= minPrefixLength) {
      const confidence = calculateConfidence(common.length, Math.max(searchTxnId.length, transaction.txnId.length));
      
      matches.push({
        transaction,
        commonPrefix: common.prefix,
        confidence,
      });
    }
  }
  
  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if two transaction IDs should be considered the same transaction
 * @param txnId1 - First transaction ID
 * @param txnId2 - Second transaction ID
 * @param minPrefixLength - Minimum prefix length for matching (default: 8)
 * @returns Object with match status and confidence
 */
export function areTransactionsMatching(
  txnId1: string,
  txnId2: string,
  minPrefixLength: number = 8
): { matching: boolean; confidence: number; commonPrefix: string } {
  // Exact match
  if (txnId1 === txnId2) {
    return {
      matching: true,
      confidence: 1.0,
      commonPrefix: txnId1,
    };
  }
  
  // Partial match
  const common = findCommonPrefix(txnId1, txnId2);
  const confidence = calculateConfidence(common.length, Math.max(txnId1.length, txnId2.length));
  
  return {
    matching: common.length >= minPrefixLength && confidence >= 0.75,
    confidence,
    commonPrefix: common.prefix,
  };
}
