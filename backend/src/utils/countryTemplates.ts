/**
 * Country-specific templates for pattern generation
 * Contains banks, currencies, and common phrases per country
 */

export interface CountryTemplate {
  code: string; // ISO country code
  name: string;
  banks: string[];
  currencies: string[];
  commonPhrases: string[];
  txnIdPatterns: string[]; // Common transaction ID keyword patterns
  amountPatterns: string[]; // Common amount keyword patterns
  senderPatterns: string[]; // Common sender keyword patterns
}

export const countryTemplates: CountryTemplate[] = [
  {
    code: 'ET',
    name: 'Ethiopia',
    banks: [
      'Telebirr',
      'Telebir',
      'Ethio telecom',
      'CBE Birr',
      'CBE',
      'Commercial Bank of Ethiopia',
      'Dashen Bank',
      'Awash Bank',
      'Bank of Abyssinia',
    ],
    currencies: ['ETB', 'Birr', 'Ethiopian Birr'],
    commonPhrases: [
      'Dear',
      'You have received',
      'You received',
      'by transaction number',
      'transaction number is',
      'Your current balance',
      'Thank you for using',
    ],
    txnIdPatterns: [
      'transaction\\s+number',
      'by\\s+transaction\\s+number',
      'transaction\\s+number\\s+is',
    ],
    amountPatterns: [
      'received',
      'credited',
      'You have received',
      'You received',
    ],
    senderPatterns: ['from', 'by', 'sent\\s+by'],
  },
  {
    code: 'KE',
    name: 'Kenya',
    banks: [
      'M-Pesa',
      'Mpesa',
      'MPesa',
      'Safaricom',
      'Equity Bank',
      'KCB',
      'Cooperative Bank',
      'Standard Chartered',
    ],
    currencies: ['KES', 'Ksh', 'Kenya Shilling', 'Kenyan Shilling'],
    commonPhrases: [
      'You have received',
      'You received',
      'from',
      'Ref:',
      'TXN:',
      'New M-PESA balance',
    ],
    txnIdPatterns: ['ref', 'txn', 'reference', 'transaction\\s+id'],
    amountPatterns: ['received', 'credited', 'You have received'],
    senderPatterns: ['from', 'sent\\s+by'],
  },
  {
    code: 'NG',
    name: 'Nigeria',
    banks: [
      'Access Bank',
      'GTBank',
      'Zenith Bank',
      'UBA',
      'First Bank',
      'Fidelity Bank',
      'Union Bank',
    ],
    currencies: ['NGN', 'Naira', '₦', 'Nigerian Naira'],
    commonPhrases: [
      'Credit Alert',
      'You received',
      'Debit Alert',
      'TXN ID',
      'Transaction ID',
    ],
    txnIdPatterns: ['txn\\s+id', 'transaction\\s+id', 'ref'],
    amountPatterns: ['received', 'credited', 'Credit Alert'],
    senderPatterns: ['from', 'sent\\s+by'],
  },
  {
    code: 'GH',
    name: 'Ghana',
    banks: [
      'MTN MoMo',
      'MTN Mobile Money',
      'MTN',
      'Airtel Money',
      'Airtel',
      'Vodafone Cash',
      'Tigo Cash',
    ],
    currencies: ['GHS', 'Cedi', 'Ghana Cedi'],
    commonPhrases: [
      'You have received',
      'You received',
      'from',
      'TXN:',
      'Ref:',
    ],
    txnIdPatterns: ['txn', 'ref', 'reference', 'transaction\\s+id'],
    amountPatterns: ['received', 'credited', 'You have received'],
    senderPatterns: ['from', 'sent\\s+by'],
  },
  {
    code: 'UG',
    name: 'Uganda',
    banks: [
      'MTN MoMo',
      'MTN Mobile Money',
      'MTN',
      'Airtel Money',
      'Airtel',
      'Vodafone Cash',
    ],
    currencies: ['UGX', 'Uganda Shilling'],
    commonPhrases: [
      'You have received',
      'You received',
      'from',
      'TXN:',
      'Ref:',
    ],
    txnIdPatterns: ['txn', 'ref', 'reference'],
    amountPatterns: ['received', 'credited'],
    senderPatterns: ['from'],
  },
  {
    code: 'TZ',
    name: 'Tanzania',
    banks: [
      'Vodacom M-Pesa',
      'Tigo Pesa',
      'Airtel Money',
      'Halopesa',
    ],
    currencies: ['TZS', 'Tanzania Shilling'],
    commonPhrases: [
      'You have received',
      'You received',
      'from',
      'TXN:',
      'Ref:',
    ],
    txnIdPatterns: ['txn', 'ref', 'reference'],
    amountPatterns: ['received', 'credited'],
    senderPatterns: ['from'],
  },
  {
    code: 'RW',
    name: 'Rwanda',
    banks: [
      'MTN MoMo',
      'MTN Mobile Money',
      'Airtel Money',
    ],
    currencies: ['RWF', 'Rwanda Franc'],
    commonPhrases: [
      'You have received',
      'You received',
      'from',
      'TXN:',
    ],
    txnIdPatterns: ['txn', 'ref'],
    amountPatterns: ['received', 'credited'],
    senderPatterns: ['from'],
  },
  {
    code: 'ZA',
    name: 'South Africa',
    banks: [
      'Standard Bank',
      'FNB',
      'Nedbank',
      'Absa',
      'Capitec',
    ],
    currencies: ['ZAR', 'Rand', 'R', 'South African Rand'],
    commonPhrases: [
      'You have received',
      'Credit',
      'Debit',
      'Ref:',
    ],
    txnIdPatterns: ['ref', 'reference', 'transaction\\s+id'],
    amountPatterns: ['received', 'credited', 'Credit'],
    senderPatterns: ['from'],
  },
  {
    code: 'SN',
    name: 'Senegal',
    banks: [
      'Orange Money',
      'Free Money',
      'Tigo Cash',
    ],
    currencies: ['XOF', 'CFA Franc'],
    commonPhrases: [
      'You have received',
      'from',
      'Ref:',
    ],
    txnIdPatterns: ['ref', 'reference'],
    amountPatterns: ['received', 'credited'],
    senderPatterns: ['from'],
  },
  {
    code: 'CI',
    name: 'Ivory Coast',
    banks: [
      'MTN MoMo',
      'Orange Money',
      'Moov Money',
    ],
    currencies: ['XOF', 'CFA Franc'],
    commonPhrases: [
      'You have received',
      'from',
      'Ref:',
    ],
    txnIdPatterns: ['ref', 'reference'],
    amountPatterns: ['received', 'credited'],
    senderPatterns: ['from'],
  },
];

/**
 * Get country template by code
 */
export function getCountryTemplate(countryCode: string | null): CountryTemplate | null {
  if (!countryCode) return null;
  return countryTemplates.find(t => t.code.toUpperCase() === countryCode.toUpperCase()) || null;
}

/**
 * Get all active countries
 */
export function getAllCountries(): CountryTemplate[] {
  return countryTemplates;
}



