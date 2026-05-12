import * as crypto from 'crypto';

/**
 * Generates a new API key with prefix 'ckp_'
 */
export function generateApiKey(): string {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `ckp_${randomPart}`;
}

