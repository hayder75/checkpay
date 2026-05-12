/**
 * Gemini AI Pattern Generator
 * Uses Google's Gemini AI to generate regex patterns for SMS transaction detection
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite-preview-06-17';

if (!apiKey) console.warn('GEMINI_API_KEY not set');

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

interface ExtractedSample {
  txnId: string | null;
  amount: number | null;
  sender: string | null;
  sendFrom: string | null;
  sendTo: string | null;
}

interface PatternResponse {
  regex: string;
  bank: string | null;
  currency: string | null;
  extractFields: {
    txnId?: { group: number; type: string };
    amount?: { group: number; type: string };
    sender?: { group: number; type: string };
    sendFrom?: { group: number; type: string };
    sendTo?: { group: number; type: string };
  };
  extractedValues: ExtractedSample;
  confidence: number;
}

/**
 * Advanced prompt for generating SMS transaction regex patterns
 */
function generatePrompt(smsText: string): string {
  return `You are an expert regex engineer specializing in financial SMS pattern matching.

TASK: Create a JavaScript-compatible regex pattern to match transaction SMS messages with the EXACT structure as the sample below.

SAMPLE SMS:
"""
${smsText}
"""

CRITICAL REQUIREMENTS:
1. The regex must be a valid JavaScript regular expression (use RegExp syntax, NOT PCRE)
2. The regex must match SMS messages with the SAME STRUCTURE but DIFFERENT VALUES
3. Use CAPTURING GROUPS to extract: transaction ID (txnId), amount, and sender name
4. The regex should be SPECIFIC to this bank/institution format - do NOT make it too generic

REGEX CONSTRUCTION RULES:
1. Replace specific values with appropriate patterns:
   - Transaction IDs: Use [A-Z0-9]{LENGTH} where LENGTH matches the ID format (e.g., [A-Z0-9]{10,15})
   - Amounts: Use ([\\d,]+(?:\\.\\d{1,2})?) for currency amounts
   - Names: Use ([A-Za-z]+(?:\\s+[A-Za-z]+)*) for person names
   - Phone numbers: Use \\d+\\*+\\d+ for masked numbers like 1***8423
   - Dates: Use \\d{1,2}/\\d{1,2}/\\d{4} for DD/MM/YYYY format
   - Times: Use \\d{1,2}:\\d{2}:\\d{2} for HH:MM:SS format
   - Account numbers: Use [\\d*]+ for masked account numbers

2. Keep structural text LITERALLY (with proper escaping):
   - Keep words like "Dear", "Account", "Credited", "from", "Ref No" etc. literally
   - Escape special regex chars in literal text: . \\ + * ? ^ $ { } [ ] | ( ) 
   - Use \\s+ for flexible whitespace between words

3. CAPTURING GROUPS ORDER (this is critical):
   - Group 1: transaction ID (the Ref No or transaction number)
   - Group 2: amount (numeric value)
   - Group 3: sender name (person who sent the money)
   - Use (?:...) for non-capturing groups where needed

4. Make the pattern specific to this institution:
   - Include bank-specific keywords (CBE, Telebirr, M-PESA, etc.)
   - Match the exact message structure

EXAMPLE - For CBE SMS like:
"Dear John your Account 1***8423 has been Credited with ETB 100.00 from Jane Doe, on 25/12/2025 at 20:01:10 with Ref No FT12345ABC"

Good regex:
Dear\\s+[A-Za-z]+\\s+your\\s+Account\\s+[\\d*]+\\s+has\\s+been\\s+Credited\\s+with\\s+ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*),\\s+on\\s+\\d{1,2}/\\d{1,2}/\\d{4}\\s+at\\s+\\d{1,2}:\\d{2}:\\d{2}\\s+with\\s+Ref\\s+No\\s+([A-Z0-9]{8,})

Where:
- Group 1 = amount (100.00)
- Group 2 = sender (Jane Doe)
- Group 3 = txnId (FT12345ABC)

RESPOND WITH ONLY VALID JSON (no markdown, no explanation):
{
  "regex": "your_regex_here",
  "bank": "bank name or null",
  "currency": "currency code (ETB, KES, USD, etc.) or null",
  "extractFields": {
    "amount": { "group": 1, "type": "number" },
    "sender": { "group": 2, "type": "string" },
    "txnId": { "group": 3, "type": "string" }
  },
  "sample": {
    "txnId": "extracted txn id from sample",
    "amount": extracted_amount_as_number,
    "sender": "extracted sender name from sample"
  },
  "confidence": 0.95
}`;
}

/**
 * Validate regex pattern by testing it against the original SMS
 */
function validatePattern(regex: string, smsText: string, extractFields: any): { valid: boolean; error?: string; matches?: string[] } {
  try {
    // Test regex compilation
    const re = new RegExp(regex, 'is');
    
    // Test matching
    const match = smsText.match(re);
    
    if (!match) {
      return { valid: false, error: 'Regex does not match the sample SMS' };
    }
    
    // Verify capture groups exist
    const groups = match.slice(1);
    if (groups.length === 0) {
      return { valid: false, error: 'Regex has no capture groups' };
    }
    
    // Verify extractFields reference valid groups
    for (const [fieldName, fieldConfig] of Object.entries(extractFields || {})) {
      const groupNum = (fieldConfig as any).group;
      if (groupNum > groups.length) {
        return { valid: false, error: `Field ${fieldName} references group ${groupNum} but only ${groups.length} groups exist` };
      }
    }
    
    return { valid: true, matches: groups };
  } catch (error: any) {
    return { valid: false, error: `Invalid regex: ${error.message}` };
  }
}

/**
 * Fix common regex issues from AI output
 */
function fixRegex(regex: string): string {
  let fixed = regex;
  
  // Remove PCRE flags like (?i)
  fixed = fixed.replace(/^\(\?[imsx]+\)/g, '');
  fixed = fixed.replace(/\(\?[imsx]+\)/g, '');
  
  // Fix common escaping issues
  // Over-escaped brackets: \[ should be [ for character classes
  // But we need to be careful not to break intentional escapes
  
  // Fix double-escaped backslashes: \\\\ -> \\
  fixed = fixed.replace(/\\\\\\\\/g, '\\\\');
  
  // Fix common issues with non-capturing groups
  // The AI sometimes outputs \\(?:... instead of (?:...
  fixed = fixed.replace(/\\+\(\?:/g, '(?:');
  
  return fixed;
}

/**
 * Generate a fallback regex pattern when AI fails
 */
function generateFallbackPattern(smsText: string): PatternResponse {
  // Detect bank
  let bank: string | null = null;
  let currency: string | null = null;
  
  const upperText = smsText.toUpperCase();
  
  if (upperText.includes('CBE') || upperText.includes('COMMERCIAL BANK OF ETHIOPIA')) {
    bank = 'CBE';
  } else if (upperText.includes('TELEBIRR')) {
    bank = 'Telebirr';
  } else if (upperText.includes('M-PESA') || upperText.includes('MPESA')) {
    bank = 'M-PESA';
  } else if (upperText.includes('AWASH')) {
    bank = 'Awash Bank';
  } else if (upperText.includes('DASHEN')) {
    bank = 'Dashen Bank';
  }
  
  if (upperText.includes('ETB') || upperText.includes('BIRR')) {
    currency = 'ETB';
  } else if (upperText.includes('KES')) {
    currency = 'KES';
  } else if (upperText.includes('USD')) {
    currency = 'USD';
  }
  
  // Extract values manually
  const txnIdMatch = smsText.match(/(?:Ref\s+No|transaction\s+number\s+is|Transaction\s+ID[:\s])\s*([A-Z0-9]{6,})/i);
  const amountMatch = smsText.match(/(?:ETB|KES|USD|GHS|NGN)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const senderMatch = smsText.match(/from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*[,(]|\s+on\s+|\s+at\s+|\.)/i);
  
  const txnId = txnIdMatch ? txnIdMatch[1] : null;
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
  const sender = senderMatch ? senderMatch[1].trim() : null;
  
  // Build a simple but effective regex based on detected bank
  let regex = '';
  const extractFields: any = {};
  
  if (bank === 'CBE') {
    // CBE pattern
    regex = 'Dear\\s+[A-Za-z]+\\s+your\\s+Account\\s+[\\d*]+\\s+has\\s+been\\s+Credited\\s+with\\s+ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*),\\s+on\\s+\\d{1,2}/\\d{1,2}/\\d{4}\\s+at\\s+\\d{1,2}:\\d{2}:\\d{2}\\s+with\\s+Ref\\s+No\\s+([A-Z0-9]{8,})';
    extractFields.amount = { group: 1, type: 'number' };
    extractFields.sender = { group: 2, type: 'string' };
    extractFields.txnId = { group: 3, type: 'string' };
  } else if (bank === 'Telebirr') {
    // Telebirr pattern
    regex = '[Yy]ou\\s+have\\s+received\\s+ETB\\s+([\\d,]+(?:\\.\\d{1,2})?)\\s+from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*)\\s*\\([\\d*]+\\)\\s+on\\s+\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2}:\\d{2}\\.?\\s*[Yy]our\\s+transaction\\s+number\\s+is\\s+([A-Z0-9]{8,})';
    extractFields.amount = { group: 1, type: 'number' };
    extractFields.sender = { group: 2, type: 'string' };
    extractFields.txnId = { group: 3, type: 'string' };
  } else {
    // Generic pattern - try to match common transaction SMS structure
    regex = '(?:received|Credited\\s+with)\\s+(?:ETB|KES|USD)?\\s*([\\d,]+(?:\\.\\d{1,2})?)\\s+.*?from\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)*).*?(?:Ref\\s+No|transaction\\s+number\\s+is)\\s*([A-Z0-9]{6,})';
    extractFields.amount = { group: 1, type: 'number' };
    extractFields.sender = { group: 2, type: 'string' };
    extractFields.txnId = { group: 3, type: 'string' };
  }
  
  return {
    regex,
    bank,
    currency,
    extractFields,
    extractedValues: { txnId, amount, sender, sendFrom: null, sendTo: null },
    confidence: 0.7,
  };
}

/**
 * Extract patterns using AI for multiple SMS texts
 */
export async function extractPatternsMultiLanguage(
  smsTexts: string[]
): Promise<PatternResponse[]> {
  if (!genAI) throw new Error('Gemini AI not configured. Set GEMINI_API_KEY in environment');

  const model = genAI.getGenerativeModel({ model: modelName });
  const results: PatternResponse[] = [];

  for (const smsText of smsTexts) {
    try {
      const prompt = generatePrompt(smsText);
      
      console.log('🤖 [Gemini AI] Generating pattern for SMS...');
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      // Strip markdown/code fences if present
      text = text.replace(/```(json)?\n?/g, '').replace(/```/g, '').trim();

      // Extract JSON from anywhere in the text
      if (!text.startsWith('{')) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) text = match[0];
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        console.error('❌ [Gemini AI] Failed to parse JSON, using fallback:', text.substring(0, 500));
        results.push(generateFallbackPattern(smsText));
        continue;
      }

      // Fix common regex issues
      let regex = fixRegex(parsed.regex || '');
      
      // Validate the pattern
      const validation = validatePattern(regex, smsText, parsed.extractFields);
      
      if (!validation.valid) {
        console.warn(`⚠️ [Gemini AI] Pattern validation failed: ${validation.error}`);
        console.warn('   Trying fallback pattern...');
        
        // Try fallback
        const fallback = generateFallbackPattern(smsText);
        const fallbackValidation = validatePattern(fallback.regex, smsText, fallback.extractFields);
        
        if (fallbackValidation.valid) {
          console.log('✅ [Gemini AI] Fallback pattern works!');
          results.push(fallback);
          continue;
        }
        
        // Still return AI result but with warning
        console.warn('⚠️ [Gemini AI] Both AI and fallback patterns failed validation');
      } else {
        console.log('✅ [Gemini AI] Pattern validated successfully');
        console.log(`   Matched groups: ${validation.matches?.join(', ')}`);
      }

      // Parse extracted values
      const txnId = parsed.sample?.txnId?.trim() || null;
      let amount = parsed.sample?.amount ?? null;
      const sender = parsed.sample?.sender?.trim() || null;

      // Parse amount if string
      if (typeof amount === 'string') {
        const num = parseFloat(amount.replace(/[^\d.]/g, ''));
        amount = isNaN(num) ? null : num;
      }

      results.push({
        regex,
        bank: parsed.bank || null,
        currency: parsed.currency || null,
        extractFields: parsed.extractFields || {},
        extractedValues: { 
          txnId, 
          amount, 
          sender,
          sendFrom: null,
          sendTo: null,
        },
        confidence: validation.valid ? (parsed.confidence || 0.85) : 0.5,
      });
    } catch (err: any) {
      console.error('❌ [Gemini AI] Error processing SMS:', smsText.substring(0, 100), err.message);
      
      // Use fallback pattern instead of blank result
      results.push(generateFallbackPattern(smsText));
    }
  }

  return results;
}

/**
 * Test a regex pattern against an SMS to verify it works
 */
export function testPatternAgainstSMS(
  regex: string,
  smsText: string,
  extractFields: any
): { matched: boolean; data?: ExtractedSample; error?: string } {
  try {
    const re = new RegExp(regex, 'is');
    const match = smsText.match(re);
    
    if (!match) {
      return { matched: false, error: 'Pattern did not match SMS' };
    }
    
    // Extract values based on extractFields
    const data: ExtractedSample = {
      txnId: null,
      amount: null,
      sender: null,
      sendFrom: null,
      sendTo: null,
    };
    
    if (extractFields) {
      for (const [field, config] of Object.entries(extractFields)) {
        const groupNum = (config as any).group;
        const value = match[groupNum];
        
        if (value) {
          if (field === 'txnId') data.txnId = value;
          else if (field === 'amount') data.amount = parseFloat(value.replace(/,/g, ''));
          else if (field === 'sender') data.sender = value;
          else if (field === 'sendFrom') data.sendFrom = value;
          else if (field === 'sendTo') data.sendTo = value;
        }
      }
    }
    
    return { matched: true, data };
  } catch (error: any) {
    return { matched: false, error: error.message };
  }
}
