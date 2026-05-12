import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../utils/prisma';
import axios from 'axios';

const router = Router();

// Cache for countries (refresh every 24 hours)
let countriesCache: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch countries from REST Countries API
 * Returns prioritized list: Common African countries first, then all others
 */
async function fetchCountriesFromAPI(): Promise<any[]> {
  try {
    const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,cca2,cca3,idd,currencies,flags', {
      timeout: 10000,
    });

    // Common African countries to prioritize
    const priorityCodes = ['ET', 'KE', 'NG', 'GH', 'ZA', 'EG', 'TZ', 'UG', 'RW', 'SD', 'SO', 'ER', 'DJ'];

    const countries = response.data.map((country: any) => {
      // Extract calling code (phone prefix)
      const callingCode = country.idd?.root && country.idd?.suffixes?.[0]
        ? `${country.idd.root}${country.idd.suffixes[0]}`
        : null;

      // Extract currency codes
      const currencyCodes = country.currencies ? Object.keys(country.currencies) : [];

      return {
        code: country.cca2, // ISO 3166-1 alpha-2 (e.g., "ET", "KE")
        code3: country.cca3, // ISO 3166-1 alpha-3 (e.g., "ETH", "KEN")
        name: country.name?.common || country.name?.official || 'Unknown',
        callingCode: callingCode, // Phone number prefix (e.g., "+251")
        currencies: currencyCodes, // Currency codes (e.g., ["ETB"])
        flag: country.flags?.svg || country.flags?.png || null,
        isPriority: priorityCodes.includes(country.cca2),
      };
    });

    // Sort: priority countries first, then alphabetically
    countries.sort((a: any, b: any) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      return a.name.localeCompare(b.name);
    });

    return countries;
  } catch (error: any) {
    console.error('[Countries] Failed to fetch from API:', error.message);
    throw error;
  }
}

/**
 * Get countries from database (if any exist)
 */
async function getCountriesFromDB(): Promise<any[]> {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        code: true,
        name: true,
        banks: true,
        currencies: true,
        commonPhrases: true,
      },
    });
    return countries;
  } catch (error) {
    return [];
  }
}

/**
 * Public: get countries list from REST Countries API
 * Falls back to database, then to hardcoded list
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = Date.now();

    // Use cache if still valid
    if (countriesCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json({
        success: true,
        data: countriesCache,
        source: 'cache',
      });
    }

    try {
      // Try to fetch from REST Countries API (with timeout)
      const apiCountries = await Promise.race([
        fetchCountriesFromAPI(),
        new Promise<any[]>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]) as any[];

      // Update cache
      countriesCache = apiCountries;
      cacheTimestamp = now;

      // Also try to sync with database (optional - for banks/phrases)
      const dbCountries = await getCountriesFromDB();
      if (dbCountries.length > 0) {
        // Merge API data with DB data (banks, commonPhrases from DB)
        const merged = apiCountries.map((apiCountry: any) => {
          const dbCountry = dbCountries.find((db: any) => db.code === apiCountry.code);
          if (dbCountry) {
            return {
              ...apiCountry,
              banks: dbCountry.banks || [],
              commonPhrases: dbCountry.commonPhrases || [],
            };
          }
          return apiCountry;
        });

        return res.json({
          success: true,
          data: merged,
          source: 'api+db',
        });
      }

      return res.json({
        success: true,
        data: apiCountries,
        source: 'api',
      });
    } catch (apiError: any) {
      console.warn('[Countries] API fetch failed, trying database...');

      // Fallback to database
      try {
        const dbCountries = await getCountriesFromDB();
        if (dbCountries.length > 0) {
          return res.json({
            success: true,
            data: dbCountries,
            source: 'database',
          });
        }
      } catch (dbError) {
        console.warn('[Countries] Database fetch failed');
      }

      // No fallback - return empty array when no data is available
      return res.json({
        success: true,
        data: [],
        source: 'fallback',
        message: 'No countries available. Please ensure REST Countries API is accessible or countries are seeded in database.',
      });
    }
  })
);

/**
 * Public: Get coverage map data
 * Returns a list of countries and the unique institutions (patterns) we support in each
 * Shows ALL countries with templates (isTemplate: true), regardless of users
 */
router.get(
  '/coverage',
  asyncHandler(async (_req, res) => {
    // Fetch ALL templates (isTemplate: true) - includes admin-created and user-created templates
    const patterns = await prisma.pattern.findMany({
      where: {
        isTemplate: true, // Only templates
        countryCode: { not: null }, // Must have country code
      },
      select: {
        countryCode: true,
        bank: true,
      }
    });

    // Group by country code
    const coverage: Record<string, Set<string>> = {};
    const templateCounts: Record<string, number> = {};

    patterns.forEach(p => {
      if (!p.countryCode) return;
      const code = p.countryCode.toUpperCase();
      
      // Count templates
      templateCounts[code] = (templateCounts[code] || 0) + 1;
      
      // Track unique institutions (banks)
      if (p.bank) {
      if (!coverage[code]) coverage[code] = new Set();
      coverage[code].add(p.bank);
      }
    });

    // Country code to name mapping
    const COUNTRY_CODE_TO_NAME: Record<string, string> = {
      'ET': 'Ethiopia',
      'KE': 'Kenya',
      'NG': 'Nigeria',
      'GH': 'Ghana',
      'ZA': 'South Africa',
      'TZ': 'Tanzania',
      'UG': 'Uganda',
      'RW': 'Rwanda',
      'EG': 'Egypt',
      'MA': 'Morocco',
      'LY': 'Libya',
      'SD': 'Sudan',
      'SS': 'South Sudan',
      'SO': 'Somalia',
      'DJ': 'Djibouti',
      'ER': 'Eritrea',
      'CY': 'Cyprus',
      'BA': 'Bosnia and Herzegovina',
      'MK': 'Macedonia',
      'RS': 'Serbia',
      'ME': 'Montenegro',
      'XK': 'Kosovo',
      'TT': 'Trinidad and Tobago',
      'US': 'United States',
      'GB': 'United Kingdom',
      'FR': 'France',
      'DE': 'Germany',
      'IN': 'India',
      'CN': 'China',
      'AU': 'Australia',
      'BR': 'Brazil',
      'CA': 'Canada',
      'AE': 'United Arab Emirates',
      'SG': 'Singapore',
    };

    // Convert to array - include countries with 0 templates too (for map display)
    // But we'll only return countries that have at least one template
    const result = Object.keys(templateCounts).map(code => ({
      code,
      name: COUNTRY_CODE_TO_NAME[code] || code, // Return proper country name
      institutions: coverage[code] ? Array.from(coverage[code]) : [],
      institutionCount: coverage[code] ? coverage[code].size : 0,
      templateCount: templateCounts[code], // Total number of templates
    }));

    // Sort by template count (descending)
    result.sort((a, b) => b.templateCount - a.templateCount);

    return res.json({
      success: true,
      data: result
    });
  })
);

export default router;

