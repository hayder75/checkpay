/**
 * Transfer Code Generator
 * Generates 6-digit codes for project transfer from developer to client
 */

/**
 * Generate a unique 6-digit transfer code
 */
export function generateTransferCode(): string {
  // Generate random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

/**
 * Validate transfer code format
 */
export function validateTransferCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Check if transfer code is expired
 */
export function isTransferCodeExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date() > expiresAt;
}

