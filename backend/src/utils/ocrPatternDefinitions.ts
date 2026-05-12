/**
 * OCR Pattern Definitions
 * Predefined patterns for common payment screens and receipts
 * These can be seeded into the database or used as templates
 */

import { OCRPatternDefinition } from './ocrPatternExtractor';

/**
 * CBE Payment Details Screen Pattern
 * Matches payment details screens like:
 * "ETB 45,950.00 debited from GEMECHU GIRMA BEKELE for MARUF MUSTEFA UMER-ETB-4242 on 25-Nov-2025 with transaction ID: FT253294GQBS. Total Amount Debited ETB 45953.45 with commission of ETB 3.00 and 15% VAT of ETB0.45."
 */
export const cbePaymentDetailsPattern: OCRPatternDefinition = {
  institution: 'CBE',
  countryCode: 'ET',
  name: 'CBE Payment Details Screen',
  description: 'Commercial Bank of Ethiopia payment details screen showing debit transaction with commission and VAT',
  // Simplified regex - focus on transaction ID and amount, be flexible about surrounding text
  regex: '(?i)(?:ETB\\s+)?(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?|\\d+(?:\\.\\d{2})?)\\s+debited[\\s\\S]*?transaction\\s+ID[:\\s]+([A-Z0-9]{8,})',
  extractFields: {
    amount: { group: 1, type: 'number' },           // ETB 45,950.00
    txnId: { group: 2, type: 'string' },           // FT253294GQBS (primary focus)
    // Other fields extracted via fallback if available
  },
  bank: 'CBE',
  currency: 'ETB',
  ocrExample: 'ETB 45,950.00 debited from GEMECHU GIRMA BEKELE for MARUF MUSTEFA UMER-ETB-4242 on 25-Nov-2025 with transaction ID: FT253294GQBS. Total Amount Debited ETB 45953.45 with commission of ETB 3.00 and 15% VAT of ETB0.45.',
  isVerified: true,
  isActive: true,
};

/**
 * Zemen GEBEYA Transaction Confirmation Pattern
 * Matches transaction confirmation screens like:
 * "-15,008.00 (ETB)"
 * "Transaction Time: 2025/11/10 02:49:56"
 * "Transaction Type: Transfer Money"
 * "Transaction To: Bereket"
 * "Transaction Number: CKA42N7W50"
 */
export const zemenGebeyaPattern: OCRPatternDefinition = {
  institution: 'Zemen GEBEYA',
  countryCode: 'ET',
  name: 'Zemen GEBEYA Transaction Confirmation',
  description: 'Zemen GEBEYA transaction confirmation screen showing transfer details',
  // Simplified regex - focus on transaction ID and amount, be flexible about surrounding text
  regex: '(?i)-(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?)[\\s\\S]*?transaction\\s+number[:\\s]*[\\s\\S]*?([A-Z0-9]{8,})(?![A-Za-z])',
  extractFields: {
    amount: { group: 1, type: 'number' },           // 15,008.00 (will be negative for debits)
    txnId: { group: 2, type: 'string' },            // CKA42N7W50 (primary focus)
    // Other fields extracted via fallback if available
  },
  bank: 'Zemen GEBEYA',
  currency: 'ETB',
  ocrExample: '-15,008.00 (ETB)\nTransaction Time: 2025/11/10 02:49:56\nTransaction Type: Transfer Money\nTransaction To: Bereket\nTransaction Number: CKA42N7W50',
  isVerified: true,
  isActive: true,
};

/**
 * All predefined OCR patterns
 */
export const predefinedOCRPatterns: OCRPatternDefinition[] = [
  cbePaymentDetailsPattern,
  zemenGebeyaPattern,
];

/**
 * Get pattern by name
 */
export function getPatternByName(name: string): OCRPatternDefinition | undefined {
  return predefinedOCRPatterns.find((p) => p.name === name);
}

/**
 * Get patterns by institution
 */
export function getPatternsByInstitution(institution: string): OCRPatternDefinition[] {
  return predefinedOCRPatterns.filter((p) => p.institution === institution);
}

/**
 * Get patterns by country
 */
export function getPatternsByCountry(countryCode: string): OCRPatternDefinition[] {
  return predefinedOCRPatterns.filter((p) => p.countryCode === countryCode);
}

