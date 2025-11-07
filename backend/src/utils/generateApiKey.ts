/**
 * Generates a new API key with prefix 'ckp_'
 */
export function generateApiKey(): string {
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `ckp_${randomPart}`;
}


