/**
 * Mask phone number for privacy
 * Example: +254712345678 -> +2547****89
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone;
  
  // Keep country code and first 4 digits, mask the rest
  const countryCode = phone.substring(0, 5); // +2547
  const lastTwo = phone.substring(phone.length - 2);
  const masked = '*'.repeat(Math.max(0, phone.length - 7));
  
  return `${countryCode}${masked}${lastTwo}`;
}
