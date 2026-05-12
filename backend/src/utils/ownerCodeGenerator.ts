/**
 * Owner Code Generator
 * Generates and validates 6-digit numeric owner IDs used for cluster linking.
 */

export function generateOwnerCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function validateOwnerCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}
