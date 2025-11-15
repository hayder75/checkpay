import { Router } from 'express';
import prisma from '../utils/prisma';
import { getCountryTemplate } from '../utils/countryTemplates';

const router = Router();

/**
 * Get all countries (public endpoint for frontend country selector)
 */
router.get('/', async (req, res) => {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        code: true,
        name: true,
        banks: true,
        currencies: true,
      },
    });

    res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch countries',
    });
  }
});

/**
 * Detect country from SMS messages
 * POST /api/countries/detect
 * Body: { smsMessages: string[] }
 */
router.post('/detect', async (req, res) => {
  try {
    const { smsMessages } = req.body;

    if (!smsMessages || !Array.isArray(smsMessages) || smsMessages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'SMS messages array is required',
      });
    }

    // Combine all SMS messages
    const combinedSMS = smsMessages.join(' ').toUpperCase();

    // Try to detect country from SMS content
    // Check for country-specific banks/currencies
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      select: {
        code: true,
        name: true,
        banks: true,
        currencies: true,
      },
    });

    let detectedCountry = null;
    let maxMatches = 0;

    for (const country of countries) {
      let matches = 0;

      // Check for bank matches
      for (const bank of country.banks) {
        if (combinedSMS.includes(bank.toUpperCase())) {
          matches += 2; // Banks are strong indicators
        }
      }

      // Check for currency matches
      for (const currency of country.currencies) {
        if (combinedSMS.includes(currency.toUpperCase())) {
          matches += 1;
        }
      }

      if (matches > maxMatches) {
        maxMatches = matches;
        detectedCountry = country;
      }
    }

    if (detectedCountry) {
      res.json({
        success: true,
        data: {
          country: detectedCountry,
          confidence: maxMatches > 0 ? 'high' : 'low',
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          country: null,
          confidence: 'none',
          message: 'Could not detect country from SMS. Please select manually.',
        },
      });
    }
  } catch (error: any) {
    console.error('Error detecting country from SMS:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect country from SMS',
    });
  }
});

/**
 * Get banks for a specific country
 * GET /api/countries/:code/banks
 */
router.get('/:code/banks', async (req, res) => {
  try {
    const { code } = req.params;

    // First try database
    const country = await prisma.country.findUnique({
      where: { code: code.toUpperCase() },
      select: {
        code: true,
        name: true,
        banks: true,
      },
    });

    if (country) {
      return res.json({
        success: true,
        data: {
          country: country.name,
          banks: country.banks,
        },
      });
    }

    // Fallback to template
    const template = getCountryTemplate(code);
    if (template) {
      return res.json({
        success: true,
        data: {
          country: template.name,
          banks: template.banks,
        },
      });
    }

    res.status(404).json({
      success: false,
      error: 'Country not found',
    });
  } catch (error: any) {
    console.error('Error getting banks for country:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get banks for country',
    });
  }
});

export default router;



