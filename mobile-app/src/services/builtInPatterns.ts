/**
 * Built-in Transaction Patterns
 * These patterns are automatically available for OCR and SMS detection
 * Based on common Ethiopian financial institution SMS formats
 */

import { Pattern } from '../types';

/**
 * Built-in patterns for automatic transaction detection
 * These patterns are used when OCR scans text or when processing SMS messages
 */
export const builtInPatterns: Pattern[] = [
  {
    id: 'builtin-telebirr-001',
    name: 'Telebirr Credit Transaction (SMS)',
    description: 'Telebirr money received SMS pattern',
    bank: 'Telebirr',
    currency: 'ETB',
    // Regex pattern to match Telebirr SMS format
    // Matches: "You have received ETB 1.00 from Gemechu Girma(2519****4345) on 14/11/2025 01:37:18. Your transaction number is CKE95P80LP."
    regex: '(?i)you\\s+have\\s+received\\s+(?:ETB|etb)\\s+(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?|\\d+(?:\\.\\d{2})?)\\s+from\\s+([^(\n]+?)\\s*\\(([^)]+)\\)\\s+on\\s+(\\d{1,2}/\\d{1,2}/\\d{4})\\s+(\\d{1,2}:\\d{2}:\\d{2})\\.?\\s+(?:your\\s+)?transaction\\s+number\\s+is\\s+([A-Z0-9]{6,})',
    extractFields: {
      amount: 1,      // Group 1: Amount (e.g., "1.00" or "1,000.00")
      sender: 2,      // Group 2: Sender name (e.g., "Gemechu Girma")
      sendFrom: 3,    // Group 3: Sender phone (e.g., "2519****4345")
      date: 4,        // Group 4: Date (e.g., "14/11/2025")
      time: 5,        // Group 5: Time (e.g., "01:37:18")
      txnId: 6,       // Group 6: Transaction ID (e.g., "CKE95P80LP")
    },
    extraction: {
      amount: 1,
      sender: 2,
      sendFrom: 3,
      date: 4,
      time: 5,
      txnId: 6,
    },
  },
  {
    id: 'builtin-telebirr-002',
    name: 'Telebirr Transfer Receipt',
    description: 'Telebirr transfer/debit transaction receipt pattern',
    bank: 'Telebirr',
    currency: 'ETB',
    // Regex pattern to match Telebirr transfer receipt format
    // Handles OCR text where labels and values may be on separate lines
    // Matches: "-36.00 (ETB) ... 2025/12/12 17:23:18 ... Transaction To: ... Transaction Number: ..."
    // Note: Receiver and TxnID are extracted via fallback in OCR screen for better accuracy
    regex: '(?i)(?:-|debit|transfer|sent)?\\s*(?:ETB|etb)?\\s*(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?|\\d+(?:\\.\\d{2})?)\\s*\\(?ETB\\)?.*?(\\d{4}\\/\\d{2}\\/\\d{2})\\s+(\\d{2}:\\d{2}:\\d{2})',
    extractFields: {
      amount: 1,      // Group 1: Amount (e.g., "36.00")
      date: 2,        // Group 2: Date (e.g., "2025/12/12")
      time: 3,        // Group 3: Time (e.g., "17:23:18")
      // sendTo and txnId extracted via fallback in OCR screen
    },
    extraction: {
      amount: 1,
      date: 2,
      time: 3,
    },
  },
  {
    id: 'builtin-cbe-001',
    name: 'CBE Credit Transaction',
    description: 'Commercial Bank of Ethiopia credit transaction pattern',
    bank: 'CBE',
    currency: 'ETB',
    // Regex pattern to match CBE SMS format
    // Matches: "Dear Gemechu your Account 1*********8423 has been Credited with ETB 200.00 from Abdulfeta Yenus, on 12/12/2025 at 21:07:32 with Ref No FT253476YT25"
    regex: '(?i)(?:dear\\s+[^,]+\\s+)?(?:your\\s+)?account\\s+([\\d*]+)\\s+has\\s+been\\s+credited\\s+with\\s+(?:ETB|etb)\\s+(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?|\\d+(?:\\.\\d{2})?)\\s+from\\s+([^,]+),?\\s+on\\s+(\\d{1,2}/\\d{1,2}/\\d{4})\\s+at\\s+(\\d{1,2}:\\d{2}:\\d{2})\\s+with\\s+(?:ref\\s+no|reference\\s+number)\\s+([A-Z0-9]{6,})',
    extractFields: {
      sendTo: 1,      // Group 1: Account number (e.g., "1*********8423")
      amount: 2,      // Group 2: Amount (e.g., "200.00" or "30,880.36")
      sender: 3,      // Group 3: Sender name (e.g., "Abdulfeta Yenus")
      date: 4,        // Group 4: Date (e.g., "12/12/2025")
      time: 5,        // Group 5: Time (e.g., "21:07:32")
      txnId: 6,       // Group 6: Reference/Transaction ID (e.g., "FT253476YT25")
    },
    extraction: {
      sendTo: 1,
      amount: 2,
      sender: 3,
      date: 4,
      time: 5,
      txnId: 6,
    },
  },
  {
    id: 'builtin-cbe-002',
    name: 'CBE Debit Transaction',
    description: 'Commercial Bank of Ethiopia debit transaction pattern (payment receipt)',
    bank: 'CBE',
    currency: 'ETB',
    // Regex pattern to match CBE debit/payment receipt format
    // Matches: "ETB 200.00 debited from GEMECHU GIRMA BEKELE for TESHALE ABAYNEH SAPE-ETB-5672 on 12-Dec-2025 with transaction ID: FT25346YCGM3"
    regex: '(?i)ETB\\s+(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?|\\d+(?:\\.\\d{2})?)\\s+debited\\s+from\\s+([^f]+?)\\s+for\\s+([^o]+?)\\s+([A-Z0-9-]+)\\s+on\\s+(\\d{1,2}-[A-Za-z]{3}-\\d{4})\\s+with\\s+transaction\\s+ID:\\s+([A-Z0-9]+)',
    extractFields: {
      amount: 1,      // Group 1: Amount debited (e.g., "200.00" or "45,950.00")
      sender: 2,      // Group 2: Sender name (e.g., "GEMECHU GIRMA BEKELE") - person whose account is debited
      sendTo: 4,      // Group 4: Receiver account/reference (e.g., "SAPE-ETB-5672")
      // Note: Group 3 is receiver name, but we'll combine it with sendTo in the OCR screen
      txnId: 6,       // Group 6: Transaction ID (e.g., "FT25346YCGM3")
    },
    extraction: {
      amount: 1,
      sender: 2,
      sendTo: 4,
      txnId: 6,
    },
  },
];

/**
 * Get all built-in patterns
 */
export function getBuiltInPatterns(): Pattern[] {
  return builtInPatterns;
}

/**
 * Find matching built-in pattern for text
 * Returns the first matching pattern or null
 */
export function findMatchingBuiltInPattern(text: string): Pattern | null {
  for (const pattern of builtInPatterns) {
    try {
      // Clean regex string (remove (?i) flag as JavaScript uses 'i' flag in constructor)
      let regexStr = pattern.regex;
      if (regexStr.startsWith('(?i)')) {
        regexStr = regexStr.substring(4);
      }
      regexStr = regexStr.replace(/\(\?i\)/g, '');
      
      const regex = new RegExp(regexStr, 'i');
      const match = text.match(regex);
      
      if (match) {
        console.log(`✅ [Built-in Pattern] Matched pattern: ${pattern.name}`);
        return pattern;
      }
    } catch (error) {
      console.error(`❌ [Built-in Pattern] Error matching pattern ${pattern.name}:`, error);
    }
  }
  
  return null;
}

