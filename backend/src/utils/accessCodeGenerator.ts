/**
 * Access Code Generator
 * Generates 6-digit codes and QR codes for employee registration
 */

import * as QRCode from 'qrcode';

interface AccessCodeData {
  businessId: string;
  code: string;
  expiresAt?: Date;
  employeeId?: string;
}

/**
 * Generate a unique 6-digit code
 */
export function generateAccessCode(): string {
  // Generate random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

/**
 * Generate QR code data URL from access code data
 */
export async function generateQRCode(data: AccessCodeData): Promise<string> {
  const qrData = JSON.stringify({
    businessId: data.businessId,
    code: data.code,
    expiresAt: data.expiresAt?.toISOString(),
    employeeId: data.employeeId,
    type: 'employee_registration',
  });
  
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1,
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Validate access code format
 */
export function validateAccessCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Parse QR code data
 */
export function parseQRCodeData(qrData: string): AccessCodeData | null {
  try {
    const data = JSON.parse(qrData);
    const isEmployeeInvite = (data.type === 'employee_registration' || data.type === 'EMPLOYEE_INVITE') && 
                            data.businessId && 
                            (data.code || data.otp);
    
    if (isEmployeeInvite) {
      return {
        businessId: data.businessId,
        code: data.code || data.otp,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

