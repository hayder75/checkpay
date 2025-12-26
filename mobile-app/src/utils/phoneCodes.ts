/**
 * Country calling codes for phone number input
 * Industry standard format with country flags and codes
 */

export interface CountryCode {
  code: string; // ISO country code (e.g., "KE", "ET", "NG")
  name: string; // Country name
  callingCode: string; // Phone calling code (e.g., "+254", "+251")
  flag: string; // Country flag emoji
}

export const countryCallingCodes: CountryCode[] = [
  { code: 'KE', name: 'Kenya', callingCode: '+254', flag: '🇰🇪' },
  { code: 'ET', name: 'Ethiopia', callingCode: '+251', flag: '🇪🇹' },
  { code: 'NG', name: 'Nigeria', callingCode: '+234', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', callingCode: '+233', flag: '🇬🇭' },
  { code: 'UG', name: 'Uganda', callingCode: '+256', flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania', callingCode: '+255', flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda', callingCode: '+250', flag: '🇷🇼' },
  { code: 'ZA', name: 'South Africa', callingCode: '+27', flag: '🇿🇦' },
  { code: 'SN', name: 'Senegal', callingCode: '+221', flag: '🇸🇳' },
  { code: 'CI', name: 'Ivory Coast', callingCode: '+225', flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroon', callingCode: '+237', flag: '🇨🇲' },
  { code: 'AO', name: 'Angola', callingCode: '+244', flag: '🇦🇴' },
  { code: 'MW', name: 'Malawi', callingCode: '+265', flag: '🇲🇼' },
  { code: 'ZM', name: 'Zambia', callingCode: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', callingCode: '+263', flag: '🇿🇼' },
  { code: 'BW', name: 'Botswana', callingCode: '+267', flag: '🇧🇼' },
  { code: 'NA', name: 'Namibia', callingCode: '+264', flag: '🇳🇦' },
  { code: 'MZ', name: 'Mozambique', callingCode: '+258', flag: '🇲🇿' },
  { code: 'MG', name: 'Madagascar', callingCode: '+261', flag: '🇲🇬' },
  { code: 'MU', name: 'Mauritius', callingCode: '+230', flag: '🇲🇺' },
  { code: 'US', name: 'United States', callingCode: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', callingCode: '+44', flag: '🇬🇧' },
  { code: 'IN', name: 'India', callingCode: '+91', flag: '🇮🇳' },
  { code: 'CN', name: 'China', callingCode: '+86', flag: '🇨🇳' },
];

/**
 * Get country code by calling code
 */
export function getCountryByCallingCode(callingCode: string): CountryCode | undefined {
  return countryCallingCodes.find(c => c.callingCode === callingCode);
}

/**
 * Get country code by ISO code
 */
export function getCountryByCode(code: string): CountryCode | undefined {
  return countryCallingCodes.find(c => c.code.toUpperCase() === code.toUpperCase());
}

/**
 * Format phone number with country code
 */
export function formatPhoneNumber(callingCode: string, phoneNumber: string): string {
  // Remove all non-digits from phone number
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Combine calling code with cleaned number
  return `${callingCode}${cleaned}`;
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  // Remove spaces and dashes
  const cleaned = phoneNumber.replace(/[\s-]/g, '');
  
  // Should start with + and have 7-15 digits after country code
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Parse phone number to extract calling code and number
 */
export function parsePhoneNumber(fullNumber: string): { callingCode: string; number: string } | null {
  // Try to match against known calling codes (longest first to avoid partial matches)
  const sortedCodes = [...countryCallingCodes].sort((a, b) => b.callingCode.length - a.callingCode.length);
  
  for (const country of sortedCodes) {
    if (fullNumber.startsWith(country.callingCode)) {
      return {
        callingCode: country.callingCode,
        number: fullNumber.substring(country.callingCode.length),
      };
    }
  }
  
  // If no match, try to extract + followed by digits
  const match = fullNumber.match(/^(\+\d{1,4})(.+)$/);
  if (match) {
    return {
      callingCode: match[1],
      number: match[2].replace(/\D/g, ''),
    };
  }
  
  return null;
}

