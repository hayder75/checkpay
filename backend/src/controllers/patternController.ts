import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { generatePatternFromSMS, validatePattern } from '../utils/patternAI';
import { extractActualValues } from '../utils/extractFromSMS';
import { flexibleExtract } from '../utils/flexibleExtractor';
import { extractTxnIdWithLLM, generatePatternFromLLM } from '../utils/llmExtractor';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { cache } from '../utils/cache';

// Validation schemas
const createPatternSchema = z.object({
  smsText: z.string().min(10),
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  useAI: z.boolean().optional().default(false), // User can force AI usage
});

const updatePatternSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  regex: z.string().optional(),
  extractFields: z.record(z.any()).optional(),
  bank: z.string().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Create a new pattern from SMS text
 * Uses rule-based extraction first, falls back to AI if needed
 */
export async function createPattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { smsText, name, description, useAI = false } = createPatternSchema.parse(req.body);

  // Get user's country and plan
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { country: true, plan: true },
  });

  // Check pattern limit for FREE users (4 total patterns max)
  if (user?.plan === 'FREE') {
    const patternCount = await prisma.pattern.count({
      where: { userId: req.user.id },
    });

    if (patternCount >= 4) {
      throw new AppError(403, 'You have reached the free plan limit (4 patterns). Upgrade to Premium for unlimited patterns!');
    }
  }

  let generatedPattern;
  let extractionMethod: 'rule-based' | 'ai' | 'existing' = 'rule-based';
  let aiSuggested = false;
  let existingPattern = null;

  // Step 0: Check if pattern already exists (user/institution/country patterns)
  const { findMatchingPattern } = await import('../utils/patternMatcher');
  const patternMatch = await findMatchingPattern(smsText, req.user.id, user?.country || null);
  
  if (patternMatch && patternMatch.matched && patternMatch.confidence > 0.8) {
    // Pattern already exists - return it instead of creating new
    existingPattern = patternMatch.pattern;
    extractionMethod = 'existing';
    
    // Check if user already has this pattern
    if (patternMatch.source === 'user') {
      throw new AppError(400, 'You already have a pattern that matches this SMS. Please use the existing pattern.');
    }
    
    // If it's an institution/country pattern, we can still create user's own version
    // but inform them about the existing pattern
    console.log(`[PATTERN] Found existing ${patternMatch.source} pattern with confidence ${patternMatch.confidence}`);
  }

  // Step 1: Try rule-based extraction first (free, fast)
  // UNLESS user explicitly requested AI
  let ruleBasedPattern;
  let ruleBasedValidation;
  let ruleBasedSuccess = false;
  
  if (!useAI) {
    // User didn't force AI - try rule-based first
    ruleBasedPattern = generatePatternFromSMS(smsText, name, user?.country || null);
    ruleBasedValidation = validatePattern(ruleBasedPattern);
    
    // Check if rule-based extraction was successful
    // Success criteria: pattern is valid AND extracted at least amount or txnId
    ruleBasedSuccess = ruleBasedValidation.valid && 
      (ruleBasedPattern.extractFields.amount !== null || ruleBasedPattern.extractFields.txnId !== null);
  }
  
  if (useAI || !ruleBasedSuccess) {
    // User forced AI OR rule-based failed - use AI
    if (useAI) {
      console.log(`[PATTERN] User requested AI extraction for user ${req.user.id}`);
    } else {
      console.log(`[PATTERN] Rule-based extraction failed, trying AI for user ${req.user.id}`);
    }
    
    if (process.env.GEMINI_API_KEY) {
      try {
        // Use AI to extract and generate pattern
        const { extractTxnIdWithLLM, generatePatternFromLLM } = await import('../utils/llmExtractor');
        const llmResult = await extractTxnIdWithLLM(smsText);
        generatedPattern = await generatePatternFromLLM(smsText, llmResult, user?.country || null);
        extractionMethod = 'ai';
        aiSuggested = false; // AI was used, not just suggested
        console.log(`[PATTERN] Created pattern using AI extraction for user ${req.user.id}`);
      } catch (error: any) {
        console.warn(`[PATTERN] AI extraction failed, falling back to rule-based:`, error.message);
        // AI failed - use rule-based anyway (even if not perfect)
        if (!ruleBasedPattern) {
          ruleBasedPattern = generatePatternFromSMS(smsText, name, user?.country || null);
        }
        generatedPattern = ruleBasedPattern;
        extractionMethod = 'rule-based';
        aiSuggested = true; // Suggest AI for better results
      }
    } else {
      // No AI key - use rule-based (even if not perfect)
      if (!ruleBasedPattern) {
        ruleBasedPattern = generatePatternFromSMS(smsText, name, user?.country || null);
      }
      generatedPattern = ruleBasedPattern;
      extractionMethod = 'rule-based';
      aiSuggested = true; // Suggest AI for better results
    }
  } else if (ruleBasedSuccess) {
    // Rule-based worked! Use it (no AI needed)
    generatedPattern = ruleBasedPattern;
    extractionMethod = 'rule-based';
    console.log(`[PATTERN] Created pattern using rule-based extraction for user ${req.user.id}`);
  } else {
    // Rule-based failed or low confidence - try AI (if API key configured)
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log(`[PATTERN] Rule-based extraction failed, trying AI for user ${req.user.id}`);
        
        // Use AI to extract and generate pattern
        const { extractTxnIdWithLLM, generatePatternFromLLM } = await import('../utils/llmExtractor');
        const llmResult = await extractTxnIdWithLLM(smsText);
        generatedPattern = await generatePatternFromLLM(smsText, llmResult, user?.country || null);
        extractionMethod = 'ai';
        aiSuggested = false; // AI was used, not just suggested
        console.log(`[PATTERN] Created pattern using AI extraction for user ${req.user.id}`);
      } catch (error: any) {
        console.warn(`[PATTERN] AI extraction failed, falling back to rule-based:`, error.message);
        // AI failed - use rule-based anyway (even if not perfect)
        generatedPattern = ruleBasedPattern;
        extractionMethod = 'rule-based';
        aiSuggested = true; // Suggest AI for better results
      }
    } else {
      // No AI key - use rule-based (even if not perfect)
      generatedPattern = ruleBasedPattern;
      extractionMethod = 'rule-based';
      aiSuggested = true; // Suggest AI for better results
    }
  }

  // Validate pattern
  const validation = validatePattern(generatedPattern);
  if (!validation.valid) {
    // If validation fails and we haven't tried AI yet, suggest it
    if (extractionMethod === 'rule-based' && process.env.GEMINI_API_KEY && !aiSuggested) {
      return res.status(400).json({
        success: false,
        error: `Pattern validation failed: ${validation.errors.join(', ')}`,
        suggestion: 'Try using AI pattern creation for better accuracy',
        canUseAI: true,
        method: 'rule-based',
      });
    }
    throw new AppError(400, `Invalid pattern: ${validation.errors.join(', ')}`);
  }

  // Check if pattern name already exists for this user
  const existing = await prisma.pattern.findFirst({
    where: {
      userId: req.user.id,
      name,
    },
  });

  if (existing) {
    throw new AppError(400, 'Pattern name already exists');
  }

  // Create pattern
  const pattern = await prisma.pattern.create({
    data: {
      userId: req.user.id,
      name: generatedPattern.name,
      regex: generatedPattern.regex,
      extractFields: generatedPattern.extractFields,
      bank: generatedPattern.bank,
      currency: generatedPattern.currency,
      description,
    },
  });

  // Trigger missing template analysis in background (non-blocking)
  // This will check if similar patterns exist and flag if missing from templates
  setImmediate(async () => {
    try {
      // Check if similar patterns exist (same bank + currency)
      const similarPatterns = await prisma.pattern.findMany({
        where: {
          bank: generatedPattern.bank,
          currency: generatedPattern.currency,
          ...({ isFlagged: false } as any), // Type assertion for Prisma client
        },
        select: { userId: true },
      });

      // If 3+ unique users have similar pattern, check if template exists
      const uniqueUsers = new Set(similarPatterns.map(p => p.userId));
      if (uniqueUsers.size >= 3) {
        const existingTemplate = await prisma.countryPattern.findFirst({
          where: {
            ...({ isTemplate: true } as any), // Type assertion for Prisma client
            bank: generatedPattern.bank,
            currency: generatedPattern.currency,
          },
        });

        // If no template exists, flag this pattern
        if (!existingTemplate) {
          await prisma.pattern.update({
            where: { id: pattern.id },
            data: {
              isFlagged: true,
              flaggedAt: new Date(),
              usageCount: uniqueUsers.size,
            } as any, // Type assertion for Prisma client
          });
        }
      }
    } catch (error) {
      console.error('Error in pattern analysis:', error);
      // Don't fail the request if analysis fails
    }
  });

  res.status(201).json({
    success: true,
    data: pattern,
    method: extractionMethod, // 'rule-based', 'ai', or 'existing'
    aiSuggested: aiSuggested, // true if AI was suggested but not used
    existingPattern: existingPattern ? {
      id: existingPattern.id,
      name: existingPattern.name,
      source: patternMatch?.source,
    } : null,
  });
}

/**
 * Get all patterns for the user
 */
export async function getPatterns(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const patterns = await prisma.pattern.findMany({
    where: {
      userId: req.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    success: true,
    data: patterns,
  });
}

/**
 * Get a single pattern
 */
export async function getPattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;

  const pattern = await prisma.pattern.findFirst({
    where: {
      id,
      userId: req.user.id,
    },
  });

  if (!pattern) {
    throw new AppError(404, 'Pattern not found');
  }

  res.json({
    success: true,
    data: pattern,
  });
}

/**
 * Update a pattern
 */
export async function updatePattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const data = updatePatternSchema.parse(req.body);

  // Check if pattern exists and belongs to user
  const existing = await prisma.pattern.findFirst({
    where: {
      id,
      userId: req.user.id,
    },
  });

  if (!existing) {
    throw new AppError(404, 'Pattern not found');
  }

  // Update pattern
  const pattern = await prisma.pattern.update({
    where: { id },
    data,
  });

  res.json({
    success: true,
    data: pattern,
  });
}

/**
 * Delete a pattern
 */
export async function deletePattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;

  // Check if pattern exists and belongs to user
  const existing = await prisma.pattern.findFirst({
    where: {
      id,
      userId: req.user.id,
    },
  });

  if (!existing) {
    throw new AppError(404, 'Pattern not found');
  }

  await prisma.pattern.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Pattern deleted successfully',
  });
}

/**
 * Create pattern using AI explicitly
 * POST /api/patterns/create-with-ai
 */
export async function createPatternWithAI(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { smsText, name, description } = createPatternSchema.parse(req.body);

  // Check if AI is available
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError(400, 'AI pattern creation is not available. GEMINI_API_KEY is not configured.');
  }

  // Get user's country and plan
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { country: true, plan: true },
  });

  // Check pattern limit for FREE users
  if (user?.plan === 'FREE') {
    const patternCount = await prisma.pattern.count({
      where: { userId: req.user.id },
    });

    if (patternCount >= 4) {
      throw new AppError(403, 'You have reached the free plan limit (4 patterns). Upgrade to Premium for unlimited patterns!');
    }
  }

  try {
    // Use AI to extract and generate pattern
    const { extractTxnIdWithLLM, generatePatternFromLLM } = await import('../utils/llmExtractor');
    const llmResult = await extractTxnIdWithLLM(smsText);
    const generatedPattern = await generatePatternFromLLM(smsText, llmResult, user?.country || null);

    // Validate pattern
    const validation = validatePattern(generatedPattern);
    if (!validation.valid) {
      throw new AppError(400, `Invalid pattern: ${validation.errors.join(', ')}`);
    }

    // Check if pattern name already exists for this user
    const existing = await prisma.pattern.findFirst({
      where: {
        userId: req.user.id,
        name,
      },
    });

    if (existing) {
      throw new AppError(400, 'Pattern name already exists');
    }

    // Create pattern
    const pattern = await prisma.pattern.create({
      data: {
        userId: req.user.id,
        name: generatedPattern.name,
        regex: generatedPattern.regex,
        extractFields: generatedPattern.extractFields,
        bank: generatedPattern.bank,
        currency: generatedPattern.currency,
        description,
      },
    });

    res.status(201).json({
      success: true,
      data: pattern,
      method: 'ai',
      extracted: {
        txnId: llmResult.txnId,
        amount: llmResult.amount,
        sender: llmResult.sender,
        bank: llmResult.bank,
        currency: llmResult.currency,
      },
    });
  } catch (error: any) {
    console.error('Error creating pattern with AI:', error);
    throw new AppError(500, error.message || 'Failed to create pattern with AI');
  }
}

/**
 * Validate a pattern before saving
 * Implements smart flow: existing patterns → URL → rule-based → AI
 * Also uses AI if available to show better extraction preview
 */
export async function validatePatternEndpoint(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { smsText, name, useAI = false } = z.object({
    smsText: z.string().min(10),
    name: z.string().min(3).max(100),
    useAI: z.boolean().optional().default(false),
  }).parse(req.body);

  // Get user's country for country-specific templates
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { country: true },
  });

  let generatedPattern;
  let extractionMethod: 'existing' | 'url' | 'rule-based' | 'ai' = 'rule-based';
  let aiSuggested = false;
  let extractedValues: any = null;

  // Step 0: Check existing patterns
  const { findMatchingPattern } = await import('../utils/patternMatcher');
  const patternMatch = await findMatchingPattern(smsText, req.user.id, user?.country || null);
  
  if (patternMatch.matched && patternMatch.confidence > 0.8) {
    generatedPattern = patternMatch.pattern;
    extractionMethod = 'existing';
    extractedValues = patternMatch.extractedData;
  } else {
    // Step 1: Try rule-based extraction first
    const ruleBasedPattern = generatePatternFromSMS(smsText, name, user?.country || null);
    const ruleBasedValidation = validatePattern(ruleBasedPattern);
    
    // Check if rule-based extraction was successful
    const ruleBasedSuccess = ruleBasedValidation.valid && 
      (ruleBasedPattern.extractFields.amount !== null || ruleBasedPattern.extractFields.txnId !== null);
    
    if (useAI || !ruleBasedSuccess) {
      // Try AI if user requested or rule-based failed
      if (process.env.GEMINI_API_KEY) {
        try {
          const { extractTxnIdWithLLM, generatePatternFromLLM } = await import('../utils/llmExtractor');
          const llmResult = await extractTxnIdWithLLM(smsText);
          generatedPattern = await generatePatternFromLLM(smsText, llmResult, user?.country || null);
          extractionMethod = 'ai';
          extractedValues = {
            txnId: llmResult.txnId,
            amount: llmResult.amount,
            sender: llmResult.sender,
            bank: llmResult.bank,
            currency: llmResult.currency,
          };
        } catch (error: any) {
          console.warn('AI extraction failed in validation:', error.message);
          generatedPattern = ruleBasedPattern;
          extractionMethod = 'rule-based';
          aiSuggested = true;
          extractedValues = extractActualValues(smsText);
        }
      } else {
        generatedPattern = ruleBasedPattern;
        extractionMethod = 'rule-based';
        aiSuggested = true;
        extractedValues = extractActualValues(smsText);
      }
    } else {
      generatedPattern = ruleBasedPattern;
      extractionMethod = 'rule-based';
      extractedValues = extractActualValues(smsText);
    }
  }

  res.json({
    success: true,
    data: {
      pattern: generatedPattern,
      validation: validatePattern(generatedPattern),
      extractedValues: extractedValues || extractActualValues(smsText),
      method: extractionMethod,
      aiSuggested: aiSuggested,
      canUseAI: !!process.env.GEMINI_API_KEY,
      existingPattern: patternMatch.matched ? {
        id: patternMatch.pattern?.id,
        source: patternMatch.source,
        confidence: patternMatch.confidence,
      } : null,
    },
  });
}

/**
 * Check if pattern exists for an institution
 * GET /api/patterns/institution/:institution?country=:countryCode
 * No authentication required (for onboarding)
 */
export async function getInstitutionPattern(req: Request, res: Response) {
  const { institution } = req.params;
  const { country } = req.query;

  if (!institution) {
    throw new AppError(400, 'Institution is required');
  }

  if (!country || typeof country !== 'string') {
    throw new AppError(400, 'Country code is required');
  }

  // Normalize institution (could be phone number or name)
  const normalizedInstitution = institution.trim();
  
  // Cache key
  const cacheKey = `institution_pattern:${normalizedInstitution}:${country}`;
  
  // Check cache first
  const cached = cache.get<any>(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      data: cached,
    });
  }

  // Check if pattern exists
  const pattern = await (prisma as any).institutionPattern.findUnique({
    where: {
      institution_countryCode: {
        institution: normalizedInstitution,
        countryCode: country,
      },
    },
  });

  const result = {
    exists: !!pattern,
    pattern: pattern || null,
  };
  
  // Cache for 10 minutes
  cache.set(cacheKey, result, 10 * 60 * 1000);

  res.json({
    success: true,
    data: result,
  });
}

/**
 * Check if pattern exists for SMS and extract data
 * POST /api/patterns/check-and-extract
 * No authentication required (for onboarding)
 * 
 * This is the first step: user provides SMS, we check if pattern exists
 */
export async function checkPatternAndExtract(req: Request, res: Response) {
  const schema = z.object({
    smsText: z.string().min(10),
    countryCode: z.string().length(2).optional(),
  });

  const { smsText, countryCode } = schema.parse(req.body);

  try {
    // Try to find matching InstitutionPattern
    // We'll try to match against all patterns for the country (if provided)
    let matchedPattern = null;
    let extractedData = null;

    if (countryCode) {
      const patterns = await (prisma as any).institutionPattern.findMany({
        where: {
          countryCode: countryCode.toUpperCase(),
          isVerified: true,
        },
      });

      // Try to match SMS against each pattern
      for (const pattern of patterns) {
        try {
          const extracted = flexibleExtract(smsText, pattern);
          if (extracted.txnId && extracted.amount) {
            matchedPattern = pattern;
            extractedData = extracted;
            break;
          }
        } catch (error) {
          // Pattern didn't match, try next
          continue;
        }
      }
    }

    // If pattern found, return extracted data
    if (matchedPattern && extractedData) {
      return res.json({
        success: true,
        patternExists: true,
        data: {
          txnId: extractedData.txnId,
          amount: extractedData.amount,
          sender: extractedData.sender,
          sendFrom: extractedData.sendFrom,
          sendTo: extractedData.sendTo,
          bank: extractedData.bank || matchedPattern.bank,
          currency: extractedData.currency || matchedPattern.currency,
          patternId: matchedPattern.id,
          institution: matchedPattern.institution,
        },
      });
    }

    // Pattern doesn't exist - will need to create one
    return res.json({
      success: true,
      patternExists: false,
      message: 'Pattern not found. Please provide transaction ID to create pattern.',
    });
  } catch (error: any) {
    console.error('Error checking pattern:', error);
    throw new AppError(500, error.message || 'Failed to check pattern');
  }
}

/**
 * Create pattern from sample SMS using Gemini
 * POST /api/patterns/create-from-sample
 * No authentication required (for onboarding)
 * 
 * This is called when pattern doesn't exist - uses Gemini to create pattern
 */
export async function createPatternFromSample(req: Request, res: Response) {
  const schema = z.object({
    institution: z.string().min(1),
    countryCode: z.string().length(2),
    smsText: z.string().min(10),
    txnId: z.string().min(1), // User-provided transaction ID for validation
  });

  const { institution, countryCode, smsText, txnId } = schema.parse(req.body);

  try {
    // Step 1: Use Gemini to extract data from SMS
    const llmResult = await extractTxnIdWithLLM(smsText);
    
    // Validate that extracted transaction ID matches user-provided one
    if (llmResult.txnId !== txnId) {
      return res.status(400).json({
        success: false,
        error: 'Extracted transaction ID does not match provided ID',
        extractedTxnId: llmResult.txnId,
        providedTxnId: txnId,
      });
    }

    // Step 2: Use Gemini to generate pattern from extracted data
    const generatedPattern = await generatePatternFromLLM(smsText, llmResult, countryCode);

    // Step 3: Validate pattern
    const validation = validatePattern(generatedPattern);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: `Invalid pattern: ${validation.errors.join(', ')}`,
      });
    }

    // Step 4: Create or update InstitutionPattern in database
    const institutionPattern = await (prisma as any).institutionPattern.upsert({
      where: {
        institution_countryCode: {
          institution: institution.trim(),
          countryCode: countryCode.toUpperCase(),
        },
      },
      update: {
        regex: generatedPattern.regex,
        extractFields: generatedPattern.extractFields,
        bank: generatedPattern.bank,
        currency: generatedPattern.currency,
        smsExample: smsText,
        txnIdExample: txnId,
        updatedAt: new Date(),
        // Increment usage count when pattern is used
        usageCount: { increment: 1 },
      },
      create: {
        institution: institution.trim(),
        countryCode: countryCode.toUpperCase(),
        regex: generatedPattern.regex,
        extractFields: generatedPattern.extractFields,
        bank: generatedPattern.bank,
        currency: generatedPattern.currency,
        smsExample: smsText,
        txnIdExample: txnId,
        isVerified: true, // Auto-verify patterns created from user samples
        usageCount: 1, // First usage
      },
    });
    
    console.log('✅ Pattern saved to database:', {
      id: institutionPattern.id,
      institution: institutionPattern.institution,
      countryCode: institutionPattern.countryCode,
      usageCount: institutionPattern.usageCount,
    });
    
    // Invalidate cache for this institution
    const cacheKey = `institution_pattern:${institution.trim()}:${countryCode.toUpperCase()}`;
    cache.delete(cacheKey);

    // Step 5: Return success with extracted data
    res.json({
      success: true,
      data: {
        pattern: institutionPattern,
        extracted: {
          txnId: llmResult.txnId,
          amount: llmResult.amount,
          sender: llmResult.sender,
          sendFrom: llmResult.sendFrom,
          sendTo: llmResult.sendTo,
          bank: llmResult.bank,
          currency: llmResult.currency,
        },
        validated: llmResult.txnId === txnId,
      },
    });
  } catch (error: any) {
    console.error('Error creating pattern from sample:', error);
    throw new AppError(500, error.message || 'Failed to create pattern from sample');
  }
}

/**
 * Get list of institutions with patterns for a country
 * GET /api/patterns/institutions?country=:countryCode
 * No authentication required (for onboarding)
 */
export async function getInstitutionsWithPatterns(req: Request, res: Response) {
  const { country } = req.query;

  if (!country || typeof country !== 'string') {
    throw new AppError(400, 'Country code is required');
  }

  const patterns = await (prisma as any).institutionPattern.findMany({
    where: {
      countryCode: country,
      isVerified: true, // Only return verified patterns
    },
    select: {
      institution: true,
      bank: true,
      currency: true,
      usageCount: true,
    },
    orderBy: {
      usageCount: 'desc',
    },
  });

  res.json({
    success: true,
    data: patterns.map((p: any) => ({
      institution: p.institution,
      bank: p.bank,
      currency: p.currency,
      usageCount: p.usageCount,
    })),
  });
}

/**
 * Get all patterns for a country (for local matching on device)
 * GET /api/patterns/country/:countryCode
 * Returns full pattern data including regex for local matching
 * No authentication required (for onboarding)
 */
export async function getCountryPatterns(req: Request, res: Response) {
  const { countryCode } = req.params;

  if (!countryCode || countryCode.length !== 2) {
    throw new AppError(400, 'Valid country code is required');
  }

  try {
    // Get all verified InstitutionPatterns for this country
    const institutionPatterns = await (prisma as any).institutionPattern.findMany({
      where: {
        countryCode: countryCode.toUpperCase(),
        isVerified: true, // Only verified patterns
      },
      select: {
        id: true,
        institution: true,
        regex: true,
        extractFields: true,
        bank: true,
        currency: true,
        usageCount: true,
        smsExample: true,
      },
      orderBy: {
        usageCount: 'desc', // Most used patterns first
      },
    });

    // Also get CountryPatterns (country-wide templates)
    // First find the country by code
    const country = await prisma.country.findUnique({
      where: { code: countryCode.toUpperCase() },
      select: { id: true },
    });

    const countryPatterns = country ? await prisma.countryPattern.findMany({
      where: {
        countryId: country.id,
        isApproved: true,
        isTemplate: true, // Only templates
      },
      select: {
        id: true,
        name: true,
        regex: true,
        extractFields: true,
        bank: true,
        currency: true,
        usageCount: true,
        smsExample: true,
      },
      orderBy: {
        usageCount: 'desc',
      },
    }) : [];

    // Format patterns for mobile app
    const formattedPatterns = [
      ...institutionPatterns.map((p: any) => ({
        id: p.id,
        name: `${p.institution} Pattern`,
        institution: p.institution,
        regex: p.regex,
        extractFields: p.extractFields,
        bank: p.bank,
        currency: p.currency,
        usageCount: p.usageCount,
        smsExample: p.smsExample,
        type: 'institution' as const,
      })),
      ...countryPatterns.map(p => ({
        id: p.id,
        name: p.name,
        institution: null,
        regex: p.regex,
        extractFields: p.extractFields,
        bank: p.bank,
        currency: p.currency,
        usageCount: p.usageCount,
        smsExample: p.smsExample,
        type: 'country' as const,
      })),
    ];

    res.json({
      success: true,
      data: {
        countryCode: countryCode.toUpperCase(),
        patterns: formattedPatterns,
        count: formattedPatterns.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching country patterns:', error);
    throw new AppError(500, 'Failed to fetch country patterns');
  }
}

/**
 * Get global pattern library
 * GET /api/patterns/global
 * Lists all global patterns (InstitutionPattern and CountryPattern)
 * Filter by country, bank, currency
 */
export async function getGlobalPatterns(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { country, bank, currency } = req.query;

  try {
    // Get user's country if not specified
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { country: true },
    });

    const countryCode = (country as string) || user?.country || null;

    const patterns: any[] = [];

    // Get InstitutionPatterns
    if (countryCode) {
      const institutionPatterns = await (prisma as any).institutionPattern.findMany({
        where: {
          countryCode: countryCode.toUpperCase(),
          isVerified: true,
          ...(bank ? { bank: bank as string } : {}),
          ...(currency ? { currency: currency as string } : {}),
        },
        select: {
          id: true,
          institution: true,
          regex: true,
          extractFields: true,
          bank: true,
          currency: true,
          usageCount: true,
          isVerified: true,
          smsExample: true,
          createdAt: true,
        },
        orderBy: {
          usageCount: 'desc',
        },
      });

      patterns.push(...institutionPatterns.map((p: any) => ({
        ...p,
        type: 'institution',
        name: `${p.institution} Pattern`,
      })));
    }

    // Get CountryPatterns
    if (countryCode) {
      const country = await prisma.country.findUnique({
        where: { code: countryCode.toUpperCase() },
        select: { id: true },
      });

      if (country) {
        const countryPatterns = await prisma.countryPattern.findMany({
          where: {
            countryId: country.id,
            isApproved: true,
            isTemplate: true,
            ...(bank ? { bank: bank as string } : {}),
            ...(currency ? { currency: currency as string } : {}),
          },
          select: {
            id: true,
            name: true,
            regex: true,
            extractFields: true,
            bank: true,
            currency: true,
            usageCount: true,
            isApproved: true,
            smsExample: true,
            createdAt: true,
          },
          orderBy: {
            usageCount: 'desc',
          },
        });

        patterns.push(...countryPatterns.map((p: any) => ({
          ...p,
          type: 'country',
          institution: null,
        })));
      }
    }

    res.json({
      success: true,
      data: {
        patterns,
        count: patterns.length,
        filters: {
          country: countryCode,
          bank: bank || null,
          currency: currency || null,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching global patterns:', error);
    throw new AppError(500, 'Failed to fetch global patterns');
  }
}

/**
 * Select a global pattern and add it to user's patterns
 * POST /api/patterns/global/:patternId/select
 * Creates a user Pattern from a global pattern (InstitutionPattern or CountryPattern)
 */
export async function selectGlobalPattern(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { patternId } = req.params;
  const { type } = req.query; // 'institution' or 'country'

  try {
    let globalPattern: any = null;

    // Get the global pattern based on type
    if (type === 'institution') {
      globalPattern = await (prisma as any).institutionPattern.findUnique({
        where: { id: patternId },
      });
    } else if (type === 'country') {
      globalPattern = await prisma.countryPattern.findUnique({
        where: { id: patternId },
      });
    } else {
      // Try both
      globalPattern = await (prisma as any).institutionPattern.findUnique({
        where: { id: patternId },
      }).catch(() => null);

      if (!globalPattern) {
        globalPattern = await prisma.countryPattern.findUnique({
          where: { id: patternId },
        });
      }
    }

    if (!globalPattern) {
      throw new AppError(404, 'Global pattern not found');
    }

    // Check if user already has this pattern
    const existing = await prisma.pattern.findFirst({
      where: {
        userId: req.user.id,
        regex: globalPattern.regex,
      },
    });

    if (existing) {
      return res.json({
        success: true,
        data: existing,
        message: 'Pattern already in your collection',
      });
    }

    // Check pattern limit for FREE users
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true },
    });

    if (user?.plan === 'FREE') {
      const patternCount = await prisma.pattern.count({
        where: { userId: req.user.id },
      });

      if (patternCount >= 4) {
        throw new AppError(403, 'You have reached the free plan limit (4 patterns). Upgrade to Premium for unlimited patterns!');
      }
    }

    // Create user pattern from global pattern
    const userPattern = await prisma.pattern.create({
      data: {
        userId: req.user.id,
        name: globalPattern.name || `${globalPattern.institution || 'Global'} Pattern`,
        regex: globalPattern.regex,
        extractFields: globalPattern.extractFields,
        bank: globalPattern.bank,
        currency: globalPattern.currency,
        description: `Selected from ${type === 'institution' ? 'institution' : 'country'} pattern library`,
      },
    });

    // If it's a CountryPattern, create subscription
    if (type === 'country' || globalPattern.isTemplate) {
      try {
        await prisma.userPatternSubscription.create({
          data: {
            userId: req.user.id,
            countryPatternId: patternId,
            patternId: userPattern.id,
          },
        });
      } catch (error) {
        // Subscription might already exist, continue
        console.warn('Error creating pattern subscription:', error);
      }
    }

    res.status(201).json({
      success: true,
      data: userPattern,
      message: 'Pattern added to your collection',
    });
  } catch (error: any) {
    console.error('Error selecting global pattern:', error);
    throw new AppError(500, error.message || 'Failed to select global pattern');
  }
}

