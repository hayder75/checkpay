/**
 * Same-Bank Transaction Validator
 * Validates that transactions involve the business's primary bank
 */

interface BankValidationResult {
  isValid: boolean;
  reason?: string;
  senderBank?: string | null;
  receiverBank?: string | null;
  businessPrimaryBank?: string;
}

/**
 * Normalize bank name for comparison
 * Handles aliases, case-insensitive matching, common variations
 */
function normalizeBankName(bankName: string | null | undefined): string {
  if (!bankName) return '';
  
  const normalized = bankName.trim().toUpperCase();
  
  // Bank aliases mapping
  const aliases: Record<string, string> = {
    'CBE': 'COMMERCIAL BANK OF ETHIOPIA',
    'COMMERCIAL BANK': 'COMMERCIAL BANK OF ETHIOPIA',
    'COMMERCIAL BANK ETHIOPIA': 'COMMERCIAL BANK OF ETHIOPIA',
    'MPESA': 'M-PESA',
    'MPESA KENYA': 'M-PESA',
    'SAFARICOM': 'M-PESA',
    'TELEBIRR': 'TELEBIRR',
    'ETHIOTELEBIRR': 'TELEBIRR',
    'AWASH': 'AWASH BANK',
    'AWASH BANK': 'AWASH BANK',
    'DASHE': 'DASHE BANK',
    'DASHE BANK': 'DASHE BANK',
  };
  
  // Check aliases
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (normalized.includes(alias) || normalized === alias) {
      return canonical;
    }
  }
  
  return normalized;
}

/**
 * Extract bank names from SMS text
 */
export function extractBanksFromText(text: string): {
  senderBank: string | null;
  receiverBank: string | null;
} {
  const upperText = text.toUpperCase();
  
  // Common bank patterns
  const bankPatterns = [
    'COMMERCIAL BANK OF ETHIOPIA',
    'CBE',
    'M-PESA',
    'MPESA',
    'TELEBIRR',
    'AWASH BANK',
    'AWASH',
    'DASHE BANK',
    'DASHE',
    'SAFARICOM',
    'EQUITY BANK',
    'KCB',
    'KENYA COMMERCIAL BANK',
  ];
  
  let senderBank: string | null = null;
  let receiverBank: string | null = null;
  
  // Try to detect sender bank (usually mentioned first or with "from")
  const senderPatterns = [
    /FROM\s+([A-Z\s]+?)(?:\s+TO|\s+ON|\.|$)/i,
    /BY\s+([A-Z\s]+?)(?:\s+TO|\s+ON|\.|$)/i,
    /VIA\s+([A-Z\s]+?)(?:\s+TO|\s+ON|\.|$)/i,
  ];
  
  for (const pattern of senderPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const potentialBank = match[1].trim();
      for (const bank of bankPatterns) {
        if (potentialBank.includes(bank) || bank.includes(potentialBank)) {
          senderBank = bank;
          break;
        }
      }
      if (senderBank) break;
    }
  }
  
  // Try to detect receiver bank (usually mentioned with "to" or "received")
  const receiverPatterns = [
    /TO\s+([A-Z\s]+?)(?:\s+ON|\.|$)/i,
    /RECEIVED\s+FROM\s+([A-Z\s]+?)(?:\s+ON|\.|$)/i,
    /CREDITED\s+TO\s+([A-Z\s]+?)(?:\s+ON|\.|$)/i,
  ];
  
  for (const pattern of receiverPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const potentialBank = match[1].trim();
      for (const bank of bankPatterns) {
        if (potentialBank.includes(bank) || bank.includes(potentialBank)) {
          receiverBank = bank;
          break;
        }
      }
      if (receiverBank) break;
    }
  }
  
  // Fallback: search for bank names in text
  if (!senderBank && !receiverBank) {
    for (const bank of bankPatterns) {
      if (upperText.includes(bank)) {
        // If we find a bank but don't know if it's sender/receiver, assume it's involved
        senderBank = bank;
        break;
      }
    }
  }
  
  return { senderBank, receiverBank };
}

/**
 * Validate same-bank transaction
 * Checks if either sender or receiver matches business primary bank
 */
export async function validateSameBank(
  smsText: string,
  businessPrimaryBank: string,
  extractedSenderBank?: string | null,
  extractedReceiverBank?: string | null
): Promise<BankValidationResult> {
  // Extract banks from SMS if not provided
  let senderBank = extractedSenderBank;
  let receiverBank = extractedReceiverBank;
  
  if (!senderBank && !receiverBank) {
    const extracted = extractBanksFromText(smsText);
    senderBank = extracted.senderBank;
    receiverBank = extracted.receiverBank;
  }
  
  // Normalize bank names
  const normalizedSender = normalizeBankName(senderBank);
  const normalizedReceiver = normalizeBankName(receiverBank);
  const normalizedBusinessBank = normalizeBankName(businessPrimaryBank);
  
  // Validation: Either sender OR receiver must match business bank
  const senderMatches = normalizedSender && normalizedSender === normalizedBusinessBank;
  const receiverMatches = normalizedReceiver && normalizedReceiver === normalizedBusinessBank;
  
  if (senderMatches || receiverMatches) {
    return {
      isValid: true,
      senderBank: senderBank || null,
      receiverBank: receiverBank || null,
      businessPrimaryBank,
    };
  }
  
  // Validation failed
  return {
    isValid: false,
    reason: `Transaction involves ${senderBank || 'unknown'} → ${receiverBank || 'unknown'}, but business bank is ${businessPrimaryBank}`,
    senderBank: senderBank || null,
    receiverBank: receiverBank || null,
    businessPrimaryBank,
  };
}

/**
 * Get business primary bank from business ID
 */
export async function getBusinessPrimaryBank(businessId: string): Promise<string | null> {
  const prisma = await import('./prisma').then(m => m.default);
  
  const primaryInstitution = await prisma.businessInstitution.findFirst({
    where: {
      businessId,
      isPrimary: true,
    },
  });
  
  return primaryInstitution?.institution || null;
}

