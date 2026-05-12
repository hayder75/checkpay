/**
 * Sender Verification Utility
 * Provides multi-layer verification for SMS transactions
 */

export interface SenderVerificationResult {
  valid: boolean;
  confidence: number; // 0-1
  reasons: string[];
  requiresReview: boolean;
}

export interface VerificationChecks {
  senderMatch: boolean;
  notFromContact: boolean;
  timestampValid: boolean;
  amountReasonable: boolean;
  txnIdUnique: boolean;
  patternConfidence: number;
}

/**
 * Normalize sender address for comparison
 * Handles variations like +251 vs 251, spaces, etc.
 */
export function normalizeSender(sender: string): string {
  if (!sender) return '';
  
  // Remove all non-alphanumeric except + at start
  let normalized = sender.trim();
  
  // Remove spaces, dashes, parentheses
  normalized = normalized.replace(/[\s\-()]/g, '');
  
  // Handle country code variations: +251 vs 251
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }
  
  // Convert to uppercase for alphanumeric sender IDs
  normalized = normalized.toUpperCase();
  
  return normalized;
}

/**
 * Verify if sender matches allowed senders
 */
export function verifySenderMatch(
  smsSender: string,
  allowedSenders: string[] | null
): { match: boolean; matchedSender?: string } {
  if (!allowedSenders || allowedSenders.length === 0) {
    // No restrictions - allow (for backward compatibility)
    return { match: true };
  }
  
  const normalizedSMS = normalizeSender(smsSender);
  
  for (const allowed of allowedSenders) {
    const normalizedAllowed = normalizeSender(allowed);
    
    // Exact match
    if (normalizedSMS === normalizedAllowed) {
      return { match: true, matchedSender: allowed };
    }
    
    // Partial match for alphanumeric (e.g., "CBE" matches "CBE-123")
    if (normalizedAllowed.length >= 3 && 
        normalizedSMS.includes(normalizedAllowed)) {
      return { match: true, matchedSender: allowed };
    }
  }
  
  return { match: false };
}

/**
 * Check if timestamp is recent (within 5 minutes)
 */
export function verifyTimestamp(smsDate: number): boolean {
  const smsAge = Date.now() - smsDate;
  const MAX_AGE = 5 * 60 * 1000; // 5 minutes
  return smsAge >= 0 && smsAge < MAX_AGE;
}

/**
 * Check if amount is reasonable
 */
export function verifyAmountReasonableness(
  amount: number,
  maxThreshold?: number | null
): boolean {
  if (amount <= 0) return false;
  if (maxThreshold && amount > maxThreshold) {
    // Amount exceeds threshold - will require review
    return false;
  }
  // Reasonable upper limit (1 million)
  return amount < 1000000;
}

/**
 * Calculate confidence score from verification checks
 */
export function calculateConfidenceScore(
  checks: VerificationChecks
): number {
  let score = 0;
  let maxScore = 0;
  
  // Sender match (required - 30%)
  maxScore += 30;
  if (checks.senderMatch) score += 30;
  
  // Not from contact (required - 20%)
  maxScore += 20;
  if (checks.notFromContact) score += 20;
  
  // Timestamp valid (optional - 10%)
  maxScore += 10;
  if (checks.timestampValid) score += 10;
  
  // Amount reasonable (optional - 10%)
  maxScore += 10;
  if (checks.amountReasonable) score += 10;
  
  // Transaction ID unique (optional - 10%)
  maxScore += 10;
  if (checks.txnIdUnique) score += 10;
  
  // Pattern confidence (optional - 20%)
  maxScore += 20;
  score += checks.patternConfidence * 20;
  
  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Main verification function
 */
export async function verifySMSecurity(
  smsSender: string,
  smsDate: number,
  amount: number,
  txnId: string,
  pattern: any,
  txnExists: (txnId: string) => Promise<boolean>,
  isContact: (sender: string) => Promise<boolean>
): Promise<SenderVerificationResult> {
  const checks: VerificationChecks = {
    senderMatch: false,
    notFromContact: false,
    timestampValid: false,
    amountReasonable: false,
    txnIdUnique: false,
    patternConfidence: 0.7, // Default pattern confidence
  };
  
  const reasons: string[] = [];
  
  // Check 1: Sender verification
  if (pattern.requireSenderVerification !== false) {
    // Only verify sender if allowedSenders is configured
    // If no allowedSenders configured, skip sender verification (backward compatibility)
    const allowedSenders = pattern.allowedSenders as string[] | null;
    if (allowedSenders && allowedSenders.length > 0) {
      const senderMatch = verifySenderMatch(
        smsSender,
        allowedSenders
      );
      checks.senderMatch = senderMatch.match;
      
      if (!senderMatch.match) {
        reasons.push('Sender not in allowed list for this pattern');
      }
    } else {
      // No allowedSenders configured - skip sender verification (allow)
      checks.senderMatch = true;
    }
  } else {
    // Sender verification disabled - allow
    checks.senderMatch = true;
  }
  
  // Check 2: Contact check
  if (pattern.requireContactCheck !== false) {
    const isContactResult = await isContact(smsSender);
    checks.notFromContact = !isContactResult;
    
    if (isContactResult) {
      reasons.push('SMS from contact rejected for security');
    }
  } else {
    // Contact check disabled - allow
    checks.notFromContact = true;
  }
  
  // Check 3: Timestamp validation
  checks.timestampValid = verifyTimestamp(smsDate);
  if (!checks.timestampValid) {
    reasons.push('SMS timestamp is too old or invalid');
  }
  
  // Check 4: Amount reasonableness
  checks.amountReasonable = verifyAmountReasonableness(
    amount,
    pattern.maxAmountThreshold
  );
  if (!checks.amountReasonable) {
    if (pattern.maxAmountThreshold && amount > pattern.maxAmountThreshold) {
      reasons.push(`Amount exceeds threshold of ${pattern.maxAmountThreshold}`);
    } else {
      reasons.push('Amount is invalid or unreasonable');
    }
  }
  
  // Check 5: Transaction ID uniqueness
  const exists = await txnExists(txnId);
  checks.txnIdUnique = !exists;
  if (exists) {
    reasons.push('Transaction ID already exists');
  }
  
  // Calculate confidence
  const confidence = calculateConfidenceScore(checks);
  
  // Determine if valid based on verification mode
  let valid = false;
  let requiresReview = false;
  
  if (pattern.senderVerificationMode === 'STRICT') {
    // STRICT: All required checks must pass
    valid = checks.senderMatch && checks.notFromContact;
    requiresReview = confidence < 0.8 || !checks.timestampValid || !checks.amountReasonable;
  } else if (pattern.senderVerificationMode === 'WARN') {
    // WARN: Allow but flag for review if issues
    valid = checks.senderMatch && checks.notFromContact;
    requiresReview = confidence < 0.7;
  } else {
    // NONE: No verification (backward compatibility)
    valid = true;
    requiresReview = false;
  }
  
  return {
    valid,
    confidence,
    reasons,
    requiresReview,
  };
}



