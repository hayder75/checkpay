/**
 * URL Pattern Generator
 * Generates patterns from URLs/links in SMS
 * Handles transaction IDs in URL parameters, path segments, and hash fragments
 */

interface URLPattern {
  regex: string;
  extractFields: {
    txnId: number | null;
    amount: number | null;
    sender: number | null;
    bank: number | null;
    currency: number | null;
  };
  urlPattern: string; // The URL pattern that was matched
}

/**
 * Extract transaction ID from URL
 * Enhanced version that handles more URL formats
 */
export function extractTxnIdFromURL(text: string): string | null {
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlPattern) || [];
  
  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      
      // Check query parameters: ?txn=, ?transactionId=, ?ref=, ?trx=, etc.
      const txnParams = [
        'txn', 'transactionId', 'transaction_id', 'ref', 'reference', 
        'id', 'txnid', 'trx', 'transaction', 'txn_id', 'txn_ref'
      ];
      
      for (const param of txnParams) {
        const value = urlObj.searchParams.get(param);
        if (value && value.length >= 4) {
          return value.trim();
        }
      }
      
      // Check path segments: /txn/ABC123, /transaction/ABC123, /slip/?trx=...
      const pathMatch = urlObj.pathname.match(/\/(?:txn|transaction|ref|reference|slip|verify|check)\/([A-Z0-9_-]+)/i);
      if (pathMatch && pathMatch[1] && pathMatch[1].length >= 4) {
        return pathMatch[1].trim();
      }
      
      // Check path with query: /slip/?trx=ABC123
      if (urlObj.pathname.includes('/slip') || urlObj.pathname.includes('/verify')) {
        for (const param of txnParams) {
          const value = urlObj.searchParams.get(param);
          if (value && value.length >= 4) {
            return value.trim();
          }
        }
      }
      
      // Check hash fragments: #txn=ABC123
      if (urlObj.hash) {
        const hashMatch = urlObj.hash.match(/[#&](?:txn|transactionId|ref|trx)=([A-Z0-9_-]+)/i);
        if (hashMatch && hashMatch[1] && hashMatch[1].length >= 4) {
          return hashMatch[1].trim();
        }
      }
    } catch (e) {
      // Invalid URL, skip
      continue;
    }
  }
  
  return null;
}

/**
 * Generate pattern from URL
 * Creates a regex pattern that matches SMS containing URLs with transaction IDs
 * @param url - URL string from SMS
 * @param smsText - Full SMS text (for context)
 * @returns Pattern object
 */
export function generatePatternFromURL(url: string, smsText: string): URLPattern | null {
  try {
    const urlObj = new URL(url);
    const extractFields: URLPattern['extractFields'] = {
      txnId: null,
      amount: null,
      sender: null,
      bank: null,
      currency: null,
    };
    
    let groupIndex = 1;
    let regexParts: string[] = [];
    
    // Extract domain for pattern matching
    const domain = urlObj.hostname.replace(/\./g, '\\.');
    
    // Check query parameters
    const txnParams = [
      'txn', 'transactionId', 'transaction_id', 'ref', 'reference', 
      'id', 'txnid', 'trx', 'transaction', 'txn_id', 'txn_ref'
    ];
    
    let foundTxnParam = false;
    for (const param of txnParams) {
      if (urlObj.searchParams.has(param)) {
        // Create pattern that matches this parameter
        regexParts.push(`(?:https?://[^\\s]*${domain}[^\\s]*(?:[?&]${param}=([A-Z0-9_-]+)))`);
        extractFields.txnId = groupIndex++;
        foundTxnParam = true;
        break;
      }
    }
    
    // Check path segments
    if (!foundTxnParam) {
      const pathMatch = urlObj.pathname.match(/\/(?:txn|transaction|ref|reference|slip|verify|check)\/([A-Z0-9_-]+)/i);
      if (pathMatch) {
        // Create pattern that matches this path structure
        regexParts.push(`(?:https?://[^\\s]*${domain}[^\\s]*/(?:txn|transaction|ref|reference|slip|verify|check)/([A-Z0-9_-]+))`);
        extractFields.txnId = groupIndex++;
        foundTxnParam = true;
      }
    }
    
    // If no transaction ID found in URL, return null
    if (!foundTxnParam) {
      return null;
    }
    
    // Try to extract amount from SMS text (not from URL)
    const amountMatch = smsText.match(/(?:received|credited|transferred|deposited)\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/i);
    if (amountMatch) {
      regexParts.push(`(?:received|credited|transferred|deposited)\\s+(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR)?\\s*(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)`);
      extractFields.amount = groupIndex++;
    }
    
    // Build regex pattern
    const regex = regexParts.join('.*?');
    
    return {
      regex,
      extractFields,
      urlPattern: url,
    };
  } catch (error) {
    console.error('Error generating pattern from URL:', error);
    return null;
  }
}

/**
 * Check if SMS contains a URL with transaction ID
 * @param smsText - SMS text to check
 * @returns True if URL with transaction ID found
 */
export function hasURLWithTxnId(smsText: string): boolean {
  return extractTxnIdFromURL(smsText) !== null;
}


