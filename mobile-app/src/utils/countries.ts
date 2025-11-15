/**
 * Local country data for offline country selection
 * This replaces the backend API call to avoid network dependency
 */

export interface Country {
  code: string; // ISO country code (e.g., "ET", "KE", "NG")
  name: string; // Full country name
  banks: string[]; // Array of bank/service names
  currencies: string[]; // Array of currency codes
}

export const supportedCountries: Country[] = [
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
  },
];

/**
 * Get all supported countries
 */
export function getAllCountries(): Country[] {
  return supportedCountries;
}

/**
 * Get country by code
 */
export function getCountryByCode(code: string): Country | undefined {
  return supportedCountries.find(c => c.code.toUpperCase() === code.toUpperCase());
}

/**
 * Get banks for a specific country
 */
export function getBanksForCountryCode(countryCode: string): string[] {
  const country = getCountryByCode(countryCode);
  return country?.banks || [];
}





