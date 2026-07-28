/**
 * Hardcoded list of countries for registration and pattern creation
 * This replaces the unreliable API-based country fetching
 */

export interface Country {
  code: string; // ISO 3166-1 alpha-2 (e.g., "ET", "KE")
  name: string; // Country name
  callingCode: string; // Phone number prefix (e.g., "+251")
}

export const COUNTRIES_LIST: Country[] = [
  // Priority African countries
  { code: 'ET', name: 'Ethiopia', callingCode: '+251' },
  { code: 'KE', name: 'Kenya', callingCode: '+254' },
  { code: 'NG', name: 'Nigeria', callingCode: '+234' },
  { code: 'GH', name: 'Ghana', callingCode: '+233' },
  { code: 'ZA', name: 'South Africa', callingCode: '+27' },
  { code: 'EG', name: 'Egypt', callingCode: '+20' },
  { code: 'TZ', name: 'Tanzania', callingCode: '+255' },
  { code: 'UG', name: 'Uganda', callingCode: '+256' },
  { code: 'RW', name: 'Rwanda', callingCode: '+250' },
  { code: 'SD', name: 'Sudan', callingCode: '+249' },
  { code: 'SO', name: 'Somalia', callingCode: '+252' },
  { code: 'ER', name: 'Eritrea', callingCode: '+291' },
  { code: 'DJ', name: 'Djibouti', callingCode: '+253' },
  { code: 'CM', name: 'Cameroon', callingCode: '+237' },
  { code: 'CI', name: 'Ivory Coast', callingCode: '+225' },
  { code: 'SN', name: 'Senegal', callingCode: '+221' },
  { code: 'AO', name: 'Angola', callingCode: '+244' },
  { code: 'MW', name: 'Malawi', callingCode: '+265' },
  { code: 'ZM', name: 'Zambia', callingCode: '+260' },
  { code: 'ZW', name: 'Zimbabwe', callingCode: '+263' },
  { code: 'BW', name: 'Botswana', callingCode: '+267' },
  { code: 'NA', name: 'Namibia', callingCode: '+264' },
  { code: 'MZ', name: 'Mozambique', callingCode: '+258' },
  { code: 'MG', name: 'Madagascar', callingCode: '+261' },
  { code: 'MU', name: 'Mauritius', callingCode: '+230' },
  { code: 'SL', name: 'Sierra Leone', callingCode: '+232' },
  { code: 'LR', name: 'Liberia', callingCode: '+231' },
  { code: 'GM', name: 'Gambia', callingCode: '+220' },
  { code: 'TN', name: 'Tunisia', callingCode: '+216' },
  { code: 'MA', name: 'Morocco', callingCode: '+212' },
  { code: 'DZ', name: 'Algeria', callingCode: '+213' },
  { code: 'LY', name: 'Libya', callingCode: '+218' },
  { code: 'TD', name: 'Chad', callingCode: '+235' },
  { code: 'NE', name: 'Niger', callingCode: '+227' },
  { code: 'ML', name: 'Mali', callingCode: '+223' },
  { code: 'BF', name: 'Burkina Faso', callingCode: '+226' },
  { code: 'BJ', name: 'Benin', callingCode: '+229' },
  { code: 'TG', name: 'Togo', callingCode: '+228' },
  { code: 'GN', name: 'Guinea', callingCode: '+224' },
  { code: 'MR', name: 'Mauritania', callingCode: '+222' },
  { code: 'GA', name: 'Gabon', callingCode: '+241' },
  { code: 'CG', name: 'Republic of the Congo', callingCode: '+242' },
  { code: 'CD', name: 'Democratic Republic of the Congo', callingCode: '+243' },
  { code: 'CF', name: 'Central African Republic', callingCode: '+236' },
  { code: 'GQ', name: 'Equatorial Guinea', callingCode: '+240' },
  { code: 'ST', name: 'São Tomé and Príncipe', callingCode: '+239' },
  { code: 'GW', name: 'Guinea-Bissau', callingCode: '+245' },
  { code: 'CV', name: 'Cape Verde', callingCode: '+238' },
  { code: 'KM', name: 'Comoros', callingCode: '+269' },
  { code: 'SC', name: 'Seychelles', callingCode: '+248' },
  { code: 'LS', name: 'Lesotho', callingCode: '+266' },
  { code: 'SZ', name: 'Eswatini', callingCode: '+268' },
  
  // Other commonly used countries
  { code: 'US', name: 'United States', callingCode: '+1' },
  { code: 'GB', name: 'United Kingdom', callingCode: '+44' },
  { code: 'IN', name: 'India', callingCode: '+91' },
  { code: 'CN', name: 'China', callingCode: '+86' },
];

/**
 * Get country by code
 */
export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES_LIST.find(c => c.code === code);
}

/**
 * Get country by calling code
 */
export function getCountryByCallingCode(callingCode: string): Country | undefined {
  return COUNTRIES_LIST.find(c => c.callingCode === callingCode);
}

