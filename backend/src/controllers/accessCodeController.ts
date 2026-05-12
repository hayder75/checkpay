import { Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { requireBusinessOwnership } from '../utils/businessValidator';
import { generateAccessCode, generateQRCode, validateAccessCodeFormat, parseQRCodeData } from '../utils/accessCodeGenerator';

const generateAccessCodeSchema = z.object({
  expiresInHours: z.number().optional().default(24),
});

/**
 * Generate access code for business
 */
export async function generateAccessCodeForBusiness(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: businessId } = req.params;
  const data = generateAccessCodeSchema.parse(req.body);

  // Require business ownership
  await requireBusinessOwnership(req.user.id, businessId);

  // Generate code
  let code = generateAccessCode();
  let codeExists = await prisma.accessCode.findUnique({ where: { code } });
  while (codeExists) {
    code = generateAccessCode();
    codeExists = await prisma.accessCode.findUnique({ where: { code } });
  }

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

  // Generate QR code
  const qrCodeDataUrl = await generateQRCode({
    businessId,
    code,
    expiresAt,
  });

  // Save access code
  const accessCode = await prisma.accessCode.create({
    data: {
      businessId,
      code,
      qrCode: qrCodeDataUrl,
      expiresAt,
    },
  });

  res.status(201).json({
    success: true,
    data: accessCode,
  });
}

/**
 * Get all access codes for business
 */
export async function getAccessCodes(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: businessId } = req.params;

  // Require business ownership
  await requireBusinessOwnership(req.user.id, businessId);

  const accessCodes = await prisma.accessCode.findMany({
    where: { businessId },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    success: true,
    data: accessCodes,
  });
}

/**
 * Validate access code
 */
export async function validateAccessCode(req: AuthRequest, res: Response) {
  const { code } = z.object({
    code: z.string(),
  }).parse(req.body);

  if (!validateAccessCodeFormat(code)) {
    throw new AppError(400, 'Invalid access code format');
  }

  const accessCode = await prisma.accessCode.findUnique({
    where: { code },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!accessCode) {
    return res.json({
      success: true,
      data: {
        valid: false,
        reason: 'Access code not found',
      },
    });
  }

  if (accessCode.isUsed) {
    return res.json({
      success: true,
      data: {
        valid: false,
        reason: 'Access code already used',
      },
    });
  }

  if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
    return res.json({
      success: true,
      data: {
        valid: false,
        reason: 'Access code expired',
      },
    });
  }

  res.json({
    success: true,
    data: {
      valid: true,
      business: accessCode.business,
      expiresAt: accessCode.expiresAt,
    },
  });
}

/**
 * Get QR code image
 */
export async function getQRCode(req: AuthRequest, res: Response) {
  const { code } = req.params;

  const accessCode = await prisma.accessCode.findUnique({
    where: { code },
  });

  if (!accessCode || !accessCode.qrCode) {
    throw new AppError(404, 'QR code not found');
  }

  // Return QR code as image
  const base64Data = accessCode.qrCode.replace(/^data:image\/png;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  res.setHeader('Content-Type', 'image/png');
  res.send(imageBuffer);
}

