/**
 * OCR Controller
 * Handles OCR pattern management and OCR transaction verification
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import prisma from '../utils/prisma';
import { z } from 'zod';
import { trackUsage } from '../utils/usageTracker';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { findMatchingOCRPattern, createOCRPattern, getAllOCRPatterns } from '../utils/ocrPatternExtractor';
import { extractTxnIdHybrid } from '../utils/hybridTxnIdExtractor';
import { OCRBlock } from '../utils/spatialTxnIdExtractor';

// Schema for getting OCR patterns
const getOCRPatternsSchema = z.object({
  countryCode: z.string().optional(),
  institution: z.string().optional(),
});

// Schema for verifying OCR transaction
const verifyOCRTransactionSchema = z.object({
  txnId: z.string().min(1, 'Transaction ID is required'),
  amount: z.number().nonnegative('Amount must be 0 or positive'),
  sender: z.string().optional(),
  receiver: z.string().optional(),
  bank: z.string().optional(),
  institution: z.string().optional(),
  currency: z.string().optional().default('ETB'),
  ocrText: z.string().optional(), // Full OCR text for verification
  patternId: z.string().optional(), // Pattern used for extraction
  businessId: z.string().optional(),
  employeeId: z.string().optional(),
  sendFrom: z.string().nullable().optional(),
  sendTo: z.string().nullable().optional(),
});

// Schema for creating OCR pattern request
const createOCRPatternRequestSchema = z.object({
  institution: z.string().min(1),
  countryCode: z.string().min(2).max(2),
  name: z.string().optional(),
  description: z.string().optional(),
  ocrText: z.string().optional(), // OCR text extracted from the image
});

/**
 * Get universal OCR patterns
 * Returns all active, verified OCR patterns, optionally filtered by country/institution
 */
export async function getOCRPatterns(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const query = getOCRPatternsSchema.parse(req.query);

  const where: any = {
    isActive: true,
    isVerified: true,
  };

  if (query.countryCode) {
    where.countryCode = query.countryCode.toUpperCase();
  }

  if (query.institution) {
    where.institution = {
      contains: query.institution,
      mode: 'insensitive',
    };
  }

  const patterns = await prisma.oCRPattern.findMany({
    where,
    orderBy: [
      { usageCount: 'desc' },
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      institution: true,
      countryCode: true,
      name: true,
      description: true,
      regex: true,
      extractFields: true,
      bank: true,
      currency: true,
      sampleImageUrl: true,
      ocrExample: true,
      usageCount: true,
      createdAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      patterns,
      count: patterns.length,
    },
  });
}

/**
 * Verify OCR-extracted transaction
 * Similar to SMS transaction verification, but for OCR source
 */
export async function verifyOCRTransaction(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  // CHECK TOKENS FIRST (before processing) - prevents creating transactions when tokens exhausted
  const { checkTokenAvailability } = await import('../utils/tokenUsage');
  const tokenCheck = await checkTokenAvailability(req.user.id, 'phone', req.user.role);
  
  if (!tokenCheck.available && tokenCheck.error) {
    // Update error message to be more user-friendly
    if (tokenCheck.error instanceof Error) {
      const errorMessage = tokenCheck.error.message;
      if (errorMessage.includes('exhausted') || errorMessage.includes('No active package')) {
        throw new AppError(403, 'You are out of credit. Please upgrade your package to continue processing transactions.');
      }
    }
    throw tokenCheck.error;
  }

  // Get employee info if user is an employee
  let employeeId: string | undefined = undefined;
  let businessId: string | undefined = undefined;
  
  if (req.user.role === 'EMPLOYEE') {
    const employee = await prisma.employee.findFirst({
      where: {
        userId: req.user.id,
        isActive: true,
      },
      select: {
        id: true,
        businessId: true,
      },
    });
    
    if (employee) {
      employeeId = employee.id;
      businessId = employee.businessId;
    } else {
      throw new AppError(403, 'Employee not found or inactive');
    }
  }

  // Parse and merge employee info
  const parsedData = verifyOCRTransactionSchema.parse(req.body);
  const data = {
    ...parsedData,
    // Override with employee info if user is employee
    employeeId: employeeId || parsedData.employeeId,
    businessId: businessId || parsedData.businessId,
  };

  // Check if transaction already exists
  const existingTxn = await prisma.transaction.findFirst({
    where: {
      userId: req.user.id,
      businessId: data.businessId || null,
      txnId: data.txnId,
    },
  });

  if (existingTxn) {
    return res.json({
      success: true,
      data: existingTxn,
      message: 'Transaction already exists',
    });
  }

  // Find matching OCR pattern if patternId provided
  let pattern = null;
  if (data.patternId) {
    pattern = await prisma.oCRPattern.findFirst({
      where: {
        id: data.patternId,
        isActive: true,
      },
    });
  }

  // Check for matching SMS transaction first (cross-source verification)
  // Look for SMS transactions with matching transaction ID that are not yet validated
  const matchingSMSTxn = await prisma.transaction.findFirst({
    where: {
      userId: req.user.id,
      businessId: data.businessId || null,
      source: 'SMS',
      OR: [
        { txnId: data.txnId },
        { referenceTxnId: data.txnId },
      ],
      isValidated: false, // Only match unverified SMS transactions
    },
  });

  // If we found a matching SMS transaction, mark both as verified
  if (matchingSMSTxn) {
    // Update SMS transaction to verified
    await prisma.transaction.update({
      where: { id: matchingSMSTxn.id },
      data: {
        isValidated: true,
        verifiedAt: new Date(),
      },
    });

    // Create OCR transaction as verified (since it matches SMS)
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        businessId: data.businessId || null,
        employeeId: data.employeeId || null,
        txnId: data.txnId,
        amount: data.amount,
        sender: data.sender || matchingSMSTxn.sender || 'Unknown',
        bank: data.bank || data.institution || matchingSMSTxn.bank || 'Unknown',
        sendFrom: data.sendFrom || matchingSMSTxn.sendFrom || null,
        sendTo: data.sendTo || data.receiver || matchingSMSTxn.sendTo || null,
        source: 'OCR',
        isValidated: true, // Verified because it matches SMS
        verifiedAt: new Date(),
        receivedAt: new Date(),
      },
    });

    // Increment pattern usage count if pattern found
    if (pattern) {
      await prisma.oCRPattern.update({
        where: { id: pattern.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    // Consume phone token after creating transaction
    try {
      const { consumeToken } = await import('../utils/tokenUsage');
      await consumeToken(req.user.id, 'phone', req.user.role);
    } catch (error: any) {
      // If token consumption fails, delete the transaction
      await prisma.transaction.delete({ where: { id: transaction.id } });
      
      // Throw user-friendly error
      if (error.message?.includes('exhausted') || error.message?.includes('No active package')) {
        throw new AppError(403, 'You are out of credit. Please upgrade your package to continue processing transactions.');
      }
      throw error;
    }

    // Track usage
    await trackUsage(req.user.id, 'app', req.user.role);

    return res.status(201).json({
      success: true,
      data: transaction,
      message: 'Transaction verified (matched with SMS)',
      matched: true,
    });
  }

  // No matching SMS found - store OCR transaction as unverified (awaiting SMS match)
  // Create transaction
  try {
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        businessId: data.businessId || null,
        employeeId: data.employeeId || null,
        txnId: data.txnId,
        amount: data.amount,
        sender: data.sender || 'Unknown',
        bank: data.bank || data.institution || 'Unknown',
        sendFrom: data.sendFrom || null,
        sendTo: data.sendTo || data.receiver || null,
        source: 'OCR',
        isValidated: false, // Not validated yet - waiting for SMS match
        receivedAt: new Date(),
      },
    });

    // Increment pattern usage count if pattern found
    if (pattern) {
      await prisma.oCRPattern.update({
        where: { id: pattern.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    // Increment pattern usage count if pattern found
    if (pattern) {
      await prisma.oCRPattern.update({
        where: { id: pattern.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    // Consume phone token after creating transaction
    try {
      const { consumeToken } = await import('../utils/tokenUsage');
      await consumeToken(req.user.id, 'phone', req.user.role);
    } catch (error: any) {
      // If token consumption fails, delete the transaction
      await prisma.transaction.delete({ where: { id: transaction.id } });
      
      // Throw user-friendly error
      if (error.message?.includes('exhausted') || error.message?.includes('No active package')) {
        throw new AppError(403, 'You are out of credit. Please upgrade your package to continue processing transactions.');
      }
      throw error;
    }

    // Track usage
    await trackUsage(req.user.id, 'app', req.user.role);

    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Transaction saved. Waiting for SMS verification.',
      awaitingVerification: true,
    });
  } catch (error: any) {
    console.error('[OCR] Error creating transaction:', error);
    if (error.code === 'P2002') {
      const existingTxn = await prisma.transaction.findFirst({
        where: {
          userId: req.user.id,
          businessId: data.businessId || null,
          txnId: data.txnId,
        },
      });
      if (existingTxn) {
        return res.json({
          success: true,
          data: existingTxn,
          message: 'Transaction already exists',
        });
      }
    }
    throw new AppError(500, 'Failed to create transaction');
  }
}

/**
 * Create OCR pattern request
 * User uploads a sample screenshot to request a new OCR pattern
 */
export async function createOCRPatternRequest(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const data = createOCRPatternRequestSchema.parse(req.body);

  // Handle file upload (if multer middleware is used)
  let sampleImageUrl: string | null = null;
  
  // Check if file was uploaded via multer
  if ((req as any).file) {
    const file = (req as any).file;
    // Save uploaded file
    const uploadsDir = path.join(process.cwd(), 'uploads', 'ocr-samples');
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileExtension = path.extname(file.originalname) || '.jpg';
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeFile(filePath, file.buffer);

    // Store relative path or full URL
    sampleImageUrl = `/uploads/ocr-samples/${fileName}`;
  } else if (req.body.imageBase64) {
    // Handle base64 image (from mobile app)
    const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const uploadsDir = path.join(process.cwd(), 'uploads', 'ocr-samples');
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileExtension = req.body.imageType === 'png' ? '.png' : '.jpg';
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeFile(filePath, buffer);
    sampleImageUrl = `/uploads/ocr-samples/${fileName}`;
  } else if (req.body.imageUrl) {
    // If image URL is provided directly
    sampleImageUrl = req.body.imageUrl;
  } else {
    throw new AppError(400, 'Sample image is required. Provide either a file upload, base64 image, or image URL.');
  }

  // Ensure sampleImageUrl is set
  if (!sampleImageUrl) {
    throw new AppError(400, 'Sample image is required. Provide either a file upload, base64 image, or image URL.');
  }

  const patternRequest = await prisma.oCRPatternRequest.create({
    data: {
      userId: req.user.id,
      institution: data.institution,
      countryCode: data.countryCode.toUpperCase(),
      sampleImageUrl,
      ocrText: data.ocrText || null,
      status: 'PENDING',
    },
  });

  res.status(201).json({
    success: true,
    data: patternRequest,
    message: 'OCR pattern request submitted. It will be reviewed by an admin.',
  });
}

/**
 * Get user's OCR pattern requests
 */
export async function getMyOCRPatternRequests(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const requests = await prisma.oCRPatternRequest.findMany({
    where: {
      userId: req.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      ocrPattern: {
        select: {
          id: true,
          name: true,
          institution: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: {
      requests,
      count: requests.length,
    },
  });
}

/**
 * Extract transaction data from OCR text
 * Uses dynamic pattern matching to find and extract values
 */
export async function extractOCRData(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  // CHECK TOKENS FIRST (before processing) - prevents extracting when tokens exhausted
  const { checkTokenAvailability } = await import('../utils/tokenUsage');
  const tokenCheck = await checkTokenAvailability(req.user.id, 'phone', req.user.role);
  
  if (!tokenCheck.available && tokenCheck.error) {
    throw tokenCheck.error;
  }

  const { ocrText, countryCode, institution, blocks } = z.object({
    ocrText: z.string().min(1),
    countryCode: z.string().optional(),
    institution: z.string().optional(),
    blocks: z.array(z.object({
      text: z.string(),
      boundingBox: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
      confidence: z.number().optional(),
    })).optional(),
  }).parse(req.body);

  try {
    // Convert blocks to OCRBlock format if provided
    const ocrBlocks: OCRBlock[] | undefined = blocks?.map(b => ({
      text: b.text,
      boundingBox: b.boundingBox,
      confidence: b.confidence,
    }));

    // Try hybrid extraction first (if blocks available)
    let txnId: string | null = null;
    let extractionMethod = 'pattern';
    
    if (ocrBlocks && ocrBlocks.length > 0) {
      const hybridResult = extractTxnIdHybrid(ocrText, ocrBlocks);
      txnId = hybridResult.txnId;
      extractionMethod = hybridResult.method;
    }

    // Find matching pattern (for other fields like amount, date, etc.)
    const matchResult = await findMatchingOCRPattern(ocrText, countryCode, institution);

    // If hybrid extraction found txnId, use it
    if (txnId && matchResult.matched && matchResult.data) {
      matchResult.data.txnId = txnId;
      matchResult.confidence = Math.max(matchResult.confidence, 0.8); // Boost confidence
    } else if (txnId && !matchResult.matched) {
      // Hybrid found txnId but pattern didn't match - create partial result
      return res.json({
        success: true,
        matched: true,
        data: {
          extracted: {
            txnId,
            amount: null,
            sender: null,
            sendFrom: null,
            sendTo: null,
            date: null,
            time: null,
            commission: null,
            vat: null,
            totalAmount: null,
            bank: institution || null,
            currency: 'ETB',
          },
          pattern: null,
          confidence: 0.7,
          isFallback: true,
          extractionMethod,
        },
      });
    }

    if (!matchResult.matched && !txnId) {
      return res.json({
        success: false,
        message: 'No matching pattern found for OCR text',
        data: null,
      });
    }

    // Increment pattern usage count if pattern was used
    if (matchResult.pattern?.id) {
      await prisma.oCRPattern.update({
        where: { id: matchResult.pattern.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    res.json({
      success: true,
      matched: matchResult.matched,
      data: {
        extracted: matchResult.data,
        pattern: matchResult.pattern ? {
          id: matchResult.pattern.id,
          name: matchResult.pattern.name,
          institution: matchResult.pattern.institution,
        } : null,
        confidence: matchResult.confidence,
        isFallback: !matchResult.pattern,
        extractionMethod: txnId ? extractionMethod : 'pattern',
      },
    });
  } catch (error: any) {
    console.error('[OCR] Error extracting data:', error);
    throw new AppError(500, `Failed to extract OCR data: ${error.message}`);
  }
}

/**
 * Create OCR pattern (Admin only)
 * Allows admins to add new OCR patterns dynamically
 */
export async function createOCRPatternAdmin(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  // Check admin permissions
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only admins can create OCR patterns');
  }

  const schema = z.object({
    institution: z.string().min(1),
    countryCode: z.string().length(2),
    name: z.string().min(1),
    description: z.string().optional(),
    regex: z.string().min(1),
    extractFields: z.object({
      txnId: z.object({ group: z.number(), type: z.string() }).optional(),
      amount: z.object({ group: z.number(), type: z.string() }).optional(),
      sender: z.object({ group: z.number(), type: z.string() }).optional(),
      sendFrom: z.object({ group: z.number(), type: z.string() }).optional(),
      sendTo: z.object({ group: z.number(), type: z.string() }).optional(),
      date: z.object({ group: z.number(), type: z.string() }).optional(),
      time: z.object({ group: z.number(), type: z.string() }).optional(),
      commission: z.object({ group: z.number(), type: z.string() }).optional(),
      vat: z.object({ group: z.number(), type: z.string() }).optional(),
      totalAmount: z.object({ group: z.number(), type: z.string() }).optional(),
    }),
    bank: z.string().optional(),
    currency: z.string().optional(),
    sampleImageUrl: z.string().optional(),
    ocrExample: z.string().optional(),
    isVerified: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
  });

  const data = schema.parse(req.body);

  try {
    const pattern = await createOCRPattern(data, req.user.id);

    res.status(201).json({
      success: true,
      data: pattern,
      message: 'OCR pattern created successfully',
    });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      throw new AppError(409, error.message);
    }
    console.error('[OCR] Error creating pattern:', error);
    throw new AppError(500, `Failed to create OCR pattern: ${error.message}`);
  }
}

/**
 * Update OCR pattern (Admin only)
 */
export async function updateOCRPatternAdmin(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  // Check admin permissions
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only admins can update OCR patterns');
  }

  const { id } = req.params;
  const schema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    regex: z.string().min(1).optional(),
    extractFields: z.object({
      txnId: z.object({ group: z.number(), type: z.string() }).optional(),
      amount: z.object({ group: z.number(), type: z.string() }).optional(),
      sender: z.object({ group: z.number(), type: z.string() }).optional(),
      sendFrom: z.object({ group: z.number(), type: z.string() }).optional(),
      sendTo: z.object({ group: z.number(), type: z.string() }).optional(),
      date: z.object({ group: z.number(), type: z.string() }).optional(),
      time: z.object({ group: z.number(), type: z.string() }).optional(),
      commission: z.object({ group: z.number(), type: z.string() }).optional(),
      vat: z.object({ group: z.number(), type: z.string() }).optional(),
      totalAmount: z.object({ group: z.number(), type: z.string() }).optional(),
    }).optional(),
    bank: z.string().optional(),
    currency: z.string().optional(),
    sampleImageUrl: z.string().optional(),
    ocrExample: z.string().optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
    adminNotes: z.string().optional(),
  });

  const data = schema.parse(req.body);

  try {
    const pattern = await prisma.oCRPattern.update({
      where: { id },
      data: {
        ...data,
        extractFields: data.extractFields ? (data.extractFields as any) : undefined,
      },
    });

    res.json({
      success: true,
      data: pattern,
      message: 'OCR pattern updated successfully',
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new AppError(404, 'OCR pattern not found');
    }
    console.error('[OCR] Error updating pattern:', error);
    throw new AppError(500, `Failed to update OCR pattern: ${error.message}`);
  }
}

