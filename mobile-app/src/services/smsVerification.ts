/**
 * SMS Verification Service
 * Provides multi-layer verification for SMS transactions on mobile app
 */

import { isContact } from '../utils/contactVerification';
import { InstitutionPattern } from '../utils/patternMatcher';

export interface SMSVerificationResult {
  valid: boolean;
  confidence: number;
  reasons: string[];
  requiresReview: boolean;
}

export interface VerificationChecks {
  senderMatch: boolean;
  notFromContact: boolean;
  timestampValid: boolean;
  amountReasonable: boolean;
  patternConfidence: number;
}

/**
 * Normalize sender address for comparison
 */
function normalizeSender(sender: string): string {
  if (!sender) return '';
  
  let normalized = sender.trim();
  normalized = normalized.replace(/[\s\-()]/g, '');
  
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }
  
  return normalized.toUpperCase();
}

/**
 * Verify sender matches allowed senders
 * Note: This function assumes allowedSenders is not empty (caller should check)
 */
function verifySenderMatch(
  smsSender: string,
  allowedSenders: string[] | null | undefined
): boolean {
  // This function should only be called when allowedSenders is configured
  // But we check for safety
  if (!allowedSenders || allowedSenders.length === 0) {
    return false; // No allowed senders means no match (shouldn't reach here if caller checks)
  }
  
  const normalizedSMS = normalizeSender(smsSender);
  
  return allowedSenders.some(allowed => {
    const normalizedAllowed = normalizeSender(allowed);
    
    // Exact match
    if (normalizedSMS === normalizedAllowed) {
      return true;
    }
    
    // Partial match for alphanumeric (e.g., "CBE" matches "CBE-123")
    if (normalizedAllowed.length >= 3 && normalizedSMS.includes(normalizedAllowed)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Verify timestamp is recent
 */
function verifyTimestamp(smsDate: number): boolean {
  const smsAge = Date.now() - smsDate;
  const MAX_AGE = 5 * 60 * 1000; // 5 minutes
  return smsAge >= 0 && smsAge < MAX_AGE;
}

/**
 * Verify amount is reasonable
 */
function verifyAmount(amount: number, maxThreshold?: number | null): boolean {
  if (amount <= 0) return false;
  if (maxThreshold && amount > maxThreshold) {
    return false; // Will require review
  }
  return amount < 1000000; // Reasonable upper limit
}

/**
 * Calculate confidence score
 */
function calculateConfidence(checks: VerificationChecks): number {
  let score = 0;
  let maxScore = 0;
  
  maxScore += 30;
  if (checks.senderMatch) score += 30;
  
  maxScore += 20;
  if (checks.notFromContact) score += 20;
  
  maxScore += 10;
  if (checks.timestampValid) score += 10;
  
  maxScore += 10;
  if (checks.amountReasonable) score += 10;
  
  maxScore += 20;
  score += checks.patternConfidence * 20;
  
  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Main verification function
 */
export async function verifySMS(
  sms: { address: string; date: number; body: string },
  pattern: InstitutionPattern,
  extractedData: { amount: number; txnId: string },
  patternConfidence: number = 0.7
): Promise<SMSVerificationResult> {
  const checks: VerificationChecks = {
    senderMatch: false,
    notFromContact: false,
    timestampValid: false,
    amountReasonable: false,
    patternConfidence,
  };
  
  const reasons: string[] = [];
  
  // Get pattern security settings (from backend pattern or defaults)
  const requireSenderVerification = (pattern as any).requireSenderVerification !== false;
  const requireContactCheck = (pattern as any).requireContactCheck !== false;
  const senderVerificationMode = (pattern as any).senderVerificationMode || 'STRICT';
  const maxAmountThreshold = (pattern as any).maxAmountThreshold;
  const allowedSenders = (pattern as any).allowedSenders;
  
  // Check 1: Sender verification
  if (requireSenderVerification) {
    // Only verify sender if allowedSenders is configured
    // If no allowedSenders configured, skip sender verification (backward compatibility)
    if (allowedSenders && allowedSenders.length > 0) {
      checks.senderMatch = verifySenderMatch(sms.address, allowedSenders);
      if (!checks.senderMatch) {
        reasons.push(`Sender "${sms.address}" not in allowed list for this pattern`);
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
  if (requireContactCheck) {
    const isContactResult = await isContact(sms.address);
    checks.notFromContact = !isContactResult;
    if (isContactResult) {
      reasons.push('SMS from contact rejected for security');
    }
  } else {
    checks.notFromContact = true;
  }
  
  // Check 3: Timestamp
  checks.timestampValid = verifyTimestamp(sms.date);
  if (!checks.timestampValid) {
    reasons.push('SMS timestamp is too old or invalid');
  }
  
  // Check 4: Amount
  checks.amountReasonable = verifyAmount(extractedData.amount, maxAmountThreshold);
  if (!checks.amountReasonable) {
    if (maxAmountThreshold && extractedData.amount > maxAmountThreshold) {
      reasons.push(`Amount exceeds threshold of ${maxAmountThreshold}`);
    } else {
      reasons.push('Amount is invalid or unreasonable');
    }
  }
  
  // Calculate confidence
  const confidence = calculateConfidence(checks);
  
  // Determine validity based on mode
  let valid = false;
  let requiresReview = false;
  
  if (senderVerificationMode === 'STRICT') {
    valid = checks.senderMatch && checks.notFromContact;
    requiresReview = confidence < 0.8 || !checks.timestampValid || !checks.amountReasonable;
  } else if (senderVerificationMode === 'WARN') {
    valid = checks.senderMatch && checks.notFromContact;
    requiresReview = confidence < 0.7;
  } else {
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

