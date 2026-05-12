/**
 * Partial Transaction ID Matcher
 * Matches transactions with common prefixes
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

export function extractPrefix(txnId: string, minPrefixLength: number = 8): string {
  if (txnId.length <= minPrefixLength) {
    return txnId;
  }

  const letterNumberMatch = txnId.match(/^([A-Z]+[0-9]*[A-Z]+)/);
  if (letterNumberMatch && letterNumberMatch[1].length >= minPrefixLength) {
    return letterNumberMatch[1];
  }

  const complexMatch = txnId.match(/^([A-Z0-9]{8,})(\d{6,})/);
  if (complexMatch && complexMatch[1].length >= minPrefixLength) {
    return complexMatch[1];
  }

  return txnId.substring(0, Math.max(minPrefixLength, Math.floor(txnId.length * 0.6)));
}

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
  const id1 = txnId1.toUpperCase().trim();
  const id2 = txnId2.toUpperCase().trim();

  if (id1 === id2) {
    return {
      matched: true,
      confidence: 1.0,
      commonPrefix: id1,
      matchType: 'exact',
    };
  }

  const commonPrefix = extractCommonPrefix(id1, id2);

  if (commonPrefix.length >= minPrefixLength) {
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

export function findTransactionsByPrefix(
  transactions: Array<{ txnId: string; referenceTxnId?: string | null; [key: string]: any }>,
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
    // Check primary txnId
    const match = matchTransactionIds(searchTxnId, txn.txnId, minPrefixLength);
    if (match.matched) {
      matches.push({
        transaction: txn,
        confidence: match.confidence,
        commonPrefix: match.commonPrefix,
        matchType: match.matchType as 'exact' | 'partial',
      });
    }
    
    // Also check referenceTxnId if it exists
    if (txn.referenceTxnId) {
      const refMatch = matchTransactionIds(searchTxnId, txn.referenceTxnId, minPrefixLength);
      if (refMatch.matched) {
        matches.push({
          transaction: txn,
          confidence: refMatch.confidence,
          commonPrefix: refMatch.commonPrefix,
          matchType: refMatch.matchType as 'exact' | 'partial',
        });
      }
    }
  }

  matches.sort((a, b) => {
    if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
    if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;
    return b.confidence - a.confidence;
  });

  return matches;
}

