import * as Device from 'expo-device';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';

// FinancialSMS interface (should match OnboardingScreen)
interface FinancialSMS {
  id: string;
  body: string;
  address: string;
  date: number;
  banks: string[];
}

/**
 * Detect country from device locale/SIM without location permission
 * This is Google Play Store compliant - no location permission needed
 */
export async function detectCountryFromLocale(): Promise<string | null> {
  try {
    console.log('Starting country detection...');
    
    // IMPORTANT: Timezone is checked FIRST because it's more reliable for actual location
    // Device locale often reflects language preference (e.g., "en-US") not actual location
    
    // Method 1: Try to get from timezone FIRST (most reliable for actual location)
    const timezone = Localization.timezone;
    console.log('Localization.timezone:', timezone);
    if (timezone) {
      const timezoneToCountry: Record<string, string> = {
        // East Africa
        'Africa/Addis_Ababa': 'ET', // Ethiopia
        'Africa/Nairobi': 'KE', // Kenya
        'Africa/Dar_es_Salaam': 'TZ', // Tanzania
        'Africa/Kampala': 'UG', // Uganda
        'Africa/Kigali': 'RW', // Rwanda
        'Africa/Djibouti': 'DJ', // Djibouti
        'Africa/Asmara': 'ER', // Eritrea
        'Africa/Mogadishu': 'SO', // Somalia
        
        // West Africa
        'Africa/Lagos': 'NG', // Nigeria
        'Africa/Accra': 'GH', // Ghana
        'Africa/Abidjan': 'CI', // Ivory Coast
        'Africa/Dakar': 'SN', // Senegal
        'Africa/Conakry': 'GN', // Guinea
        'Africa/Freetown': 'SL', // Sierra Leone
        'Africa/Monrovia': 'LR', // Liberia
        
        // Central/Southern Africa
        'Africa/Johannesburg': 'ZA', // South Africa
        'Africa/Harare': 'ZW', // Zimbabwe
        'Africa/Lusaka': 'ZM', // Zambia
        'Africa/Maputo': 'MZ', // Mozambique
        
        // North Africa
        'Africa/Cairo': 'EG', // Egypt
        'Africa/Casablanca': 'MA', // Morocco
        'Africa/Tunis': 'TN', // Tunisia
        'Africa/Algiers': 'DZ', // Algeria
        'Africa/Tripoli': 'LY', // Libya
        
        // Middle East
        'Asia/Dubai': 'AE', // UAE
        'Asia/Riyadh': 'SA', // Saudi Arabia
        'Asia/Kuwait': 'KW', // Kuwait
        'Asia/Qatar': 'QA', // Qatar
        'Asia/Bahrain': 'BH', // Bahrain
        'Asia/Muscat': 'OM', // Oman
        'Asia/Amman': 'JO', // Jordan
        'Asia/Beirut': 'LB', // Lebanon
      };
      if (timezoneToCountry[timezone]) {
        console.log('✅ Detected country from timezone (most reliable):', timezoneToCountry[timezone]);
        return timezoneToCountry[timezone];
      }
    }

    // Method 2: Use getLocales() for detailed locale info (less reliable - reflects language, not location)
    let fallbackRegionCode: string | null = null;
    try {
      const locales = Localization.getLocales();
      console.log('Localization.getLocales():', JSON.stringify(locales, null, 2));
      if (locales && locales.length > 0) {
        // Try to find locale with regionCode
        for (const locale of locales) {
          if (locale.regionCode) {
            console.log('⚠️ Found region code from getLocales() (may not reflect actual location):', locale.regionCode);
            // Store as fallback - only use if timezone didn't work
            if (!fallbackRegionCode) {
              fallbackRegionCode = locale.regionCode;
            }
          }
        }
      }
    } catch (error) {
      console.warn('getLocales() not available:', error);
    }
    
    // If timezone didn't work, use region code from getLocales() as fallback
    if (fallbackRegionCode && fallbackRegionCode.length === 2) {
      console.log('⚠️ Using region code from getLocales() as fallback:', fallbackRegionCode);
      return fallbackRegionCode.toUpperCase();
    }

    // Method 3: Use region from locale (fallback - often wrong)
    const region = Localization.region;
    console.log('Localization.region:', region);
    if (region && region.length === 2) {
      console.log('⚠️ Using region from locale (may not reflect actual location):', region);
      return region.toUpperCase();
    }

    // Method 4: Use device locale and extract country code (fallback - often wrong)
    const locale = Localization.locale;
    console.log('Localization.locale:', locale);
    if (locale) {
      const countryMatch = locale.match(/-([A-Z]{2})$/i) || locale.match(/_([A-Z]{2})$/i);
      if (countryMatch && countryMatch[1] && countryMatch[1].length === 2) {
        const countryCode = countryMatch[1].toUpperCase();
        console.log('⚠️ Extracted country from locale (may not reflect actual location):', countryCode);
        return countryCode;
      }
    }

    console.warn('Could not detect country from locale');
    return null;
  } catch (error) {
    console.error('Error detecting country from locale:', error);
    return null;
  }
}

/**
 * Detect if an SMS is a financial message
 * Uses keyword matching with improved accuracy - requires stronger signals
 * to reduce false positives while maintaining good detection rate
 */
export function detectFinancialSMS(smsText: string): boolean {
  if (!smsText || smsText.length < 10) {
    console.log('🔍 [Financial Detection] SMS too short or empty:', {
      length: smsText?.length || 0,
      preview: smsText?.substring(0, 50),
    });
    return false;
  }

  const upperText = smsText.toUpperCase();
  console.log('🔍 [Financial Detection] Analyzing SMS:', {
    length: smsText.length,
    preview: smsText.substring(0, 100) + (smsText.length > 100 ? '...' : ''),
  });

  // Filter out common non-financial SMS patterns first
  const nonFinancialPatterns = [
    // OTP/Verification
    /VERIFICATION CODE/i,
    /OTP/i,
    /ONE TIME PASSWORD/i,
    /YOUR CODE IS/i,
    /CONFIRMATION CODE/i,
    /ACTIVATION CODE/i,
    
    // Promotional/Spam
    /PROMO/i,
    /DISCOUNT/i,
    /OFFER/i,
    /WINNER/i,
    /CONGRATULATIONS.*WIN/i,
    /CLICK HERE/i,
    /FREE.*CLAIM/i,
    /BONUS.*DEPOSIT/i,
    /CASHBACK/i,
    /LOYALTY/i,
    /REFERRAL/i,
    /BETTING/i,
    /SPORT/i,
    /LOGIN.*PASSWORD/i,
    /USERNAME.*PASSWORD/i,
    
    // Data/Airtime packages (not financial transactions)
    /(?:INTERNET|DATA|AIRTIME|PACKAGE).*(?:MB|GB|MIN)/i,
    /(?:RECEIVED|ACTIVATED).*(?:INTERNET|DATA|AIRTIME|PACKAGE)/i,
    /(?:DAILY|WEEKLY|MONTHLY).*(?:INTERNET|DATA|PACKAGE)/i,
    /(?:EXPIRED|EXPIRES).*(?:INTERNET|DATA|PACKAGE)/i,
    /(?:MB|GB).*(?:BONUS|PACKAGE)/i,
    
    // Service notifications (not transactions)
    /(?:SERVICE|SUPPORT|INFORMATION|HELP).*(?:SMS|WEB|EMAIL|WHATSAPP|TELEGRAM)/i,
    /(?:DELIGHTED|SERVE|SUPPORT).*(?:PRODUCTS|SERVICES)/i,
  ];

  for (const pattern of nonFinancialPatterns) {
    if (pattern.test(smsText)) {
      console.log('❌ [Financial Detection] Filtered out as non-financial:', pattern);
      return false;
    }
  }

  // Strong financial indicators (high confidence) - must be money-related
  const strongKeywords = [
    // Transaction action keywords (money-specific)
    'CREDITED', 'DEBITED', 'TRANSFER', 'TRANSFERRED', 'PAYMENT', 'PAID',
    
    // Bank/service names (very specific - only when used in financial context)
    // Note: TELEBIRR removed - it appears in data package notifications too
    'MPESA', 'M-PESA', 'CBE', 'COMMERCIAL BANK OF ETHIOPIA',
    'SAFARICOM', 'EQUITY BANK', 'KCB', 'ACCESS BANK', 'GTBANK', 'ZENITH BANK',
    'MTN MOMO', 'MTN MOBILE MONEY', 'AIRTEL MONEY', 'VODAFONE CASH',
    
    // Transaction ID patterns (strong indicator)
    'TRANSACTION NUMBER', 'TRANSACTION NO', 'TRANSACTION ID',
    'TXN ID', 'TXN NO', 'REF NO', 'REFERENCE NUMBER',
    
    // Balance/account specific (money)
    'NEW BALANCE', 'YOUR CURRENT BALANCE', 'ACCOUNT BALANCE',
    'NEW M-PESA BALANCE',
    
    // Alert types (money)
    'CREDIT ALERT', 'DEBIT ALERT',
    
    // Money-specific phrases (only when combined with currency)
    'YOU HAVE RECEIVED.*(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR|XOF|USD|EUR|GBP|BIRR|SHILLING|NAIRA|CEDI|FRANC|RAND)',
    'YOU RECEIVED.*(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR|XOF|USD|EUR|GBP|BIRR|SHILLING|NAIRA|CEDI|FRANC|RAND)',
  ];
  
  // Note: "YOU HAVE RECEIVED" and "YOU RECEIVED" are now only strong when combined with currency
  // "TELEBIRR" removed from strong keywords - it appears in data package notifications
  // This prevents data package notifications from being detected as financial

  // Medium financial indicators (money received context)
  const mediumKeywords = [
    'BALANCE', 'ACCOUNT', 'DEPOSIT',
    'TRANSACTION', 'CHARGE', 'FEE',
    'MOBILE MONEY', 'CASH', 'WALLET',
    // Note: Removed 'WITHDRAWAL', 'SENT' - we only care about money received
  ];

  // Currency codes (strong when combined with amounts)
  const currencyCodes = ['ETB', 'KES', 'NGN', 'GHS', 'UGX', 'TZS', 'RWF', 'ZAR', 'XOF', 'USD', 'EUR', 'GBP'];
  const currencyNames = ['BIRR', 'SHILLING', 'NAIRA', 'CEDI', 'FRANC', 'RAND', 'CFA'];

  // Check for strong keywords (including regex patterns)
  const matchedStrongKeywords: string[] = [];
  strongKeywords.forEach(keyword => {
    if (keyword.includes('.*')) {
      // This is a regex pattern
      const regex = new RegExp(keyword, 'i');
      if (regex.test(smsText)) {
        matchedStrongKeywords.push(keyword);
      }
    } else {
      // Simple string match
      if (upperText.includes(keyword)) {
        matchedStrongKeywords.push(keyword);
      }
    }
  });

  // Check for medium keywords
  const matchedMediumKeywords: string[] = [];
  mediumKeywords.forEach(keyword => {
    if (upperText.includes(keyword)) {
      matchedMediumKeywords.push(keyword);
    }
  });

  // Check for currency codes
  const matchedCurrencies: string[] = [];
  [...currencyCodes, ...currencyNames].forEach(currency => {
    if (upperText.includes(currency)) {
      matchedCurrencies.push(currency);
    }
  });

  // Amount patterns - more specific
  const amountPatterns = [
    // Currency code followed by amount: ETB 200.00, KES 1,000.00
    /(?:ETB|KES|NGN|GHS|UGX|TZS|RWF|ZAR|XOF|USD|EUR|GBP)\s*[\d,]+(?:\.\d{1,2})?/i,
    // Amount with currency symbol: $100, €50, ₦1,000
    /[₦$€£₹]\s*[\d,]+(?:\.\d{1,2})?/,
    // Decimal amounts that look like money: 100.00, 1,000.50 (but not phone numbers or dates)
    /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b/,
  ];
  
  let hasAmountPattern = false;
  let matchedAmountPattern: string | null = null;
  
  for (const pattern of amountPatterns) {
    const match = smsText.match(pattern);
    if (match) {
      // Verify it's not a phone number or date
      const matchedValue = match[0];
      if (!/^\d{10,}$/.test(matchedValue.replace(/[^\d]/g, ''))) { // Not a long number (phone)
        hasAmountPattern = true;
        matchedAmountPattern = matchedValue;
        break;
      }
    }
  }

  // Transaction ID pattern - more specific
  const txnIdPatterns = [
    /(?:TRANSACTION\s+(?:NUMBER|NO|ID)|TXN\s*(?:ID|NO)|REF(?:ERENCE)?\s*(?:NO|NUMBER)?)[\s:]*[A-Z0-9]{4,}/i,
    /(?:BY\s+)?TRANSACTION\s+NUMBER[\s:]*[A-Z0-9]{4,}/i,
  ];
  
  let hasTxnIdPattern = false;
  let matchedTxnId: string | null = null;
  
  for (const pattern of txnIdPatterns) {
    const match = smsText.match(pattern);
    if (match) {
      hasTxnIdPattern = true;
      matchedTxnId = match[0];
      break;
    }
  }

  // Additional checks for false positives
  // Check if it's a data package notification (even if it has "received" and "telebirr")
  const isDataPackage = /(?:INTERNET|DATA|AIRTIME|PACKAGE).*(?:MB|GB|MIN|EXPIRED|EXPIRES)/i.test(smsText) ||
                       /(?:RECEIVED|ACTIVATED).*(?:INTERNET|DATA|AIRTIME|PACKAGE)/i.test(smsText);
  
  // Check if it's promotional/betting (even if it has numbers)
  const isPromotional = /(?:BONUS|CASHBACK|LOYALTY|REFERRAL|BETTING|SPORT|LOGIN|USERNAME|PASSWORD)/i.test(smsText);
  
  // Special handling: "YOU HAVE RECEIVED" or "YOU RECEIVED" alone is not strong
  // It needs to be combined with currency or amount to be considered financial
  const hasReceivedPhrase = upperText.includes('YOU HAVE RECEIVED') || upperText.includes('YOU RECEIVED');
  
  if (isDataPackage) {
    console.log('❌ [Financial Detection] Filtered out - appears to be data/airtime package notification');
    return false;
  }
  
  if (isPromotional && !hasAmountPattern) {
    console.log('❌ [Financial Detection] Filtered out - appears to be promotional message without amount');
    return false;
  }

  // Scoring system for better accuracy
  let score = 0;
  
  // Strong indicators (high weight)
  if (matchedStrongKeywords.length > 0) score += 3;
  if (hasTxnIdPattern) score += 3;
  if (hasAmountPattern && matchedCurrencies.length > 0) score += 3; // Amount + currency = strong
  
  // Medium indicators (medium weight)
  if (hasAmountPattern) score += 2;
  if (matchedCurrencies.length > 0) score += 1;
  if (matchedMediumKeywords.length > 0) score += 1;
  
  // Penalty: "Received" without currency/amount is weak
  if (hasReceivedPhrase && !matchedCurrencies.length && !hasAmountPattern) {
    score -= 2; // Penalize generic "received" without financial context
    console.log('⚠️ [Financial Detection] "Received" phrase found but no currency/amount - applying penalty');
  }
  
  // Bonus for multiple indicators
  if (matchedStrongKeywords.length > 1) score += 1;
  if (hasAmountPattern && hasTxnIdPattern) score += 2; // Amount + Txn ID = very strong
  if (matchedStrongKeywords.length > 0 && hasAmountPattern) score += 1; // Strong keyword + amount

  // Require minimum score of 3 for financial SMS
  // This ensures we need at least one strong indicator or multiple medium indicators
  const isFinancial = score >= 3;
  
  console.log('🔍 [Financial Detection] Analysis:', {
    strongKeywords: matchedStrongKeywords.slice(0, 3),
    mediumKeywords: matchedMediumKeywords.slice(0, 3),
    currencies: matchedCurrencies.slice(0, 3),
    hasAmount: hasAmountPattern,
    matchedAmount: matchedAmountPattern,
    hasTxnId: hasTxnIdPattern,
    matchedTxnId: matchedTxnId,
    score: score,
    isFinancial: isFinancial,
  });
  
  return isFinancial;
}

/**
 * Extract banks/financial services from SMS messages
 * Scans SMS content for known bank/service names
 */
export function extractBanksFromSMS(smsMessages: string[]): string[] {
  const banks: Set<string> = new Set();

  // Known bank/service names (can be expanded)
  const knownBanks = [
    // Ethiopia
    'Telebirr', 'Telebir', 'Ethio telecom', 'CBE Birr', 'CBE', 'Commercial Bank of Ethiopia',
    'Dashen Bank', 'Awash Bank', 'Bank of Abyssinia',
    
    // Kenya
    'M-Pesa', 'Mpesa', 'MPesa', 'Safaricom', 'Equity Bank', 'KCB', 'Cooperative Bank',
    'Standard Chartered',
    
    // Nigeria
    'Access Bank', 'GTBank', 'Zenith Bank', 'UBA', 'First Bank', 'Fidelity Bank', 'Union Bank',
    
    // Ghana
    'MTN MoMo', 'MTN Mobile Money', 'MTN', 'Airtel Money', 'Airtel', 'Vodafone Cash', 'Tigo Cash',
    
    // Uganda
    'Vodafone Cash',
    
    // Tanzania
    'Vodacom M-Pesa', 'Tigo Pesa', 'Halopesa',
    
    // Rwanda
    'MTN MoMo', 'MTN Mobile Money',
    
    // South Africa
    'Standard Bank', 'FNB', 'Nedbank', 'Absa', 'Capitec',
    
    // Senegal
    'Orange Money', 'Free Money', 'Tigo Cash',
    
    // Ivory Coast
    'Moov Money',
  ];

  // Scan each SMS for bank names
  smsMessages.forEach(sms => {
    const upperSms = sms.toUpperCase();
    knownBanks.forEach(bank => {
      if (upperSms.includes(bank.toUpperCase())) {
        banks.add(bank);
      }
    });
  });

  return Array.from(banks);
}

/**
 * Get country-specific banks from country code
 * This can be used as fallback if SMS scanning doesn't find banks
 */
export function getBanksForCountry(countryCode: string): string[] {
  const countryBanks: Record<string, string[]> = {
    ET: ['Telebirr', 'CBE', 'Dashen Bank', 'Awash Bank', 'Bank of Abyssinia'],
    KE: ['M-Pesa', 'Equity Bank', 'KCB', 'Cooperative Bank'],
    NG: ['Access Bank', 'GTBank', 'Zenith Bank', 'UBA', 'First Bank'],
    GH: ['MTN MoMo', 'Airtel Money', 'Vodafone Cash'],
    UG: ['MTN MoMo', 'Airtel Money', 'Vodafone Cash'],
    TZ: ['Vodacom M-Pesa', 'Tigo Pesa', 'Airtel Money'],
    RW: ['MTN MoMo', 'Airtel Money'],
    ZA: ['Standard Bank', 'FNB', 'Nedbank', 'Absa', 'Capitec'],
    SN: ['Orange Money', 'Free Money', 'Tigo Cash'],
    CI: ['MTN MoMo', 'Orange Money', 'Moov Money'],
  };

  return countryBanks[countryCode.toUpperCase()] || [];
}

/**
 * Group financial SMS by sender (institution)
 * Returns map of sender address -> SMS info
 */
export interface SenderInfo {
  address: string; // Phone number or sender ID
  count: number;
  lastMessage: string;
  detectedInstitution?: string; // Detected institution name (e.g., "M-Pesa")
  sampleSMS: string; // First SMS from this sender
}

export function groupSMSBySender(smsMessages: FinancialSMS[]): Map<string, SenderInfo> {
  const senders = new Map<string, SenderInfo>();

  smsMessages.forEach(sms => {
    const existing = senders.get(sms.address);
    
    if (existing) {
      existing.count++;
      // Keep the most recent message
      if (sms.date > (smsMessages.find(s => s.address === sms.address && s.body === existing.sampleSMS)?.date || 0)) {
        existing.sampleSMS = sms.body;
        existing.lastMessage = sms.body;
      }
    } else {
      // Try to detect institution name from SMS content
      const detectedInstitution = detectInstitutionFromSMS(sms.body);
      
      senders.set(sms.address, {
        address: sms.address,
        count: 1,
        lastMessage: sms.body,
        detectedInstitution,
        sampleSMS: sms.body,
      });
    }
  });

  return senders;
}

/**
 * Detect institution name from SMS content
 */
function detectInstitutionFromSMS(smsText: string): string | undefined {
  const upperText = smsText.toUpperCase();
  
  // Known institutions with their keywords
  const institutions: Array<{ name: string; keywords: string[] }> = [
    { name: 'M-Pesa', keywords: ['M-PESA', 'MPESA', 'SAFARICOM'] },
    { name: 'Telebirr', keywords: ['TELEBIRR', 'TELEBIR', 'ETHIO TELECOM'] },
    { name: 'MTN MoMo', keywords: ['MTN MOMO', 'MTN MOBILE MONEY', 'MTN'] },
    { name: 'Airtel Money', keywords: ['AIRTEL MONEY', 'AIRTEL'] },
    { name: 'CBE', keywords: ['CBE', 'COMMERCIAL BANK OF ETHIOPIA'] },
    { name: 'Equity Bank', keywords: ['EQUITY BANK', 'EQUITY'] },
    { name: 'KCB', keywords: ['KCB'] },
    { name: 'Access Bank', keywords: ['ACCESS BANK', 'ACCESS'] },
    { name: 'GTBank', keywords: ['GTBANK', 'GT BANK'] },
    { name: 'Zenith Bank', keywords: ['ZENITH BANK', 'ZENITH'] },
  ];

  for (const institution of institutions) {
    if (institution.keywords.some(keyword => upperText.includes(keyword))) {
      return institution.name;
    }
  }

  return undefined;
}


