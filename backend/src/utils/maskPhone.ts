/**
 * Masks a phone number: +254712345678 -> +2547****89
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  
  // Remove any non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  if (cleaned.length <= 4) return cleaned;
  
  // Keep first 4 chars and last 2 chars, mask the rest
  const prefix = cleaned.slice(0, 4);
  const suffix = cleaned.slice(-2);
  const maskedLength = cleaned.length - 6;
  
  return `${prefix}${'*'.repeat(maskedLength)}${suffix}`;
}

