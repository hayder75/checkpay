/**
 * Shared pattern normalization utility
 * Used to detect duplicate patterns by comparing their structure
 */

export function normalizeRegexForComparison(regex: string): string {
  return regex
    .replace(/\([^)]+\)/g, '()') // Replace all capture groups with empty ()
    .replace(/\\n/g, '\n') // Normalize escaped newlines
    .replace(/\\s\+/g, ' ') // Normalize whitespace patterns
    .replace(/\\s\*/g, ' ') // Normalize optional whitespace
    .replace(/\\s\?/g, ' ') // Normalize optional whitespace
    .replace(/\[A-Za-z0-9\]\+/g, '[VAR]') // Normalize character classes
    .replace(/\[A-Z0-9\]\+/g, '[VAR]') // Normalize alphanumeric patterns
    .replace(/\[A-Za-z\]\+/g, '[VAR]') // Normalize letter patterns
    .replace(/\[\\d,\]\+/g, '[VAR]') // Normalize number patterns
    .replace(/\[\\d\.\]\+/g, '[VAR]') // Normalize decimal patterns
    .replace(/\{[0-9,]+\}/g, '[VAR]') // Normalize quantifiers like {6,} or {10,}
    .replace(/\d+/g, '[NUM]') // Normalize specific numbers
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

