/**
 * LLM-based transaction ID extraction using Google Gemini
 * Focused on pattern creation - patterns are saved and reused
 */

interface LLMExtractionResult {
  txnId: string | null;
  amount: number | null;
  bank: string | null;
  currency: string | null;
  confidence: number;
  sender?: string | null;
  sendFrom?: string | null; // Institution/account sending money
  sendTo?: string | null;   // Institution/account receiving money
}

const EXTRACTION_PROMPT = `Extract transaction details from this SMS message. Return only the transaction ID, amount, currency, bank name, sender, send from (institution), and send to (institution) if found.

SMS: "{smsText}"

Return a JSON object with:
- txnId: The transaction ID/number if found, or null
- amount: The transaction amount as a number if found, or null
- currency: The currency code (e.g., "KES", "ETB") if found, or null
- bank: The bank/institution name if found, or null
- sender: The sender phone number or name if found, or null
- sendFrom: The institution/account sending money (e.g., "M-Pesa", "Telebirr", account number) if found, or null
- sendTo: The institution/account receiving money (e.g., "M-Pesa", "Telebirr", account number) if found, or null

Only return valid JSON, no other text.`;

/**
 * Extract using Google Gemini API
 */
async function extractWithGemini(smsText: string): Promise<LLMExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite-preview-06-17';
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const prompt = EXTRACTION_PROMPT.replace('{smsText}', smsText);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 200,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          errorMessage += ` - ${errorData.error.message || errorData.error}`;
        }
      } catch {
        errorMessage += ` - ${responseText.substring(0, 200)}`;
      }
      throw new Error(errorMessage);
    }

    const data = JSON.parse(responseText);
    
    // Extract text from Gemini response
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!generatedText) {
      throw new Error('No generated text in Gemini response');
    }
    
    // Try to parse JSON from response
    let result;
    try {
      result = JSON.parse(generatedText);
    } catch {
      // Try to extract JSON if wrapped in markdown
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`No JSON found in Gemini response. Got: ${generatedText.substring(0, 200)}`);
      }
    }

          return {
            txnId: result.txnId || null,
            amount: result.amount ? parseFloat(result.amount) : null,
            bank: result.bank || null,
            currency: result.currency || null,
            sender: result.sender || null,
            sendFrom: result.sendFrom || null,
            sendTo: result.sendTo || null,
            confidence: result.txnId ? 0.8 : 0,
          };
  } catch (error: any) {
    console.error('Gemini extraction failed:', error.message);
    throw error;
  }
}

/**
 * Extract transaction details from SMS using Gemini
 * This is used for pattern creation - patterns are then saved and reused
 */
export async function extractTxnIdWithLLM(smsText: string): Promise<LLMExtractionResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in environment variables.');
  }

  return await extractWithGemini(smsText);
}

/**
 * Generate pattern from LLM extraction result
 * Uses Gemini to create a regex pattern that can extract data from similar SMS messages
 */
export async function generatePatternFromLLM(smsText: string, llmResult: LLMExtractionResult, countryCode?: string | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite-preview-06-17';
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const prompt = `Create a regex pattern to extract transaction data from SMS messages like this one.

SMS Example: "${smsText}"

Extracted Data:
- Transaction ID: ${llmResult.txnId || 'N/A'}
- Amount: ${llmResult.amount || 'N/A'}
- Currency: ${llmResult.currency || 'N/A'}
- Bank: ${llmResult.bank || 'N/A'}
- Sender: ${llmResult.sender || 'N/A'}

Create a JavaScript-compatible regex pattern that can extract these fields from similar SMS messages.
The regex should use capture groups for:
1. Transaction ID (if present)
2. Amount (if present)
3. Sender (if present)

Return a JSON object with:
- regex: The regex pattern string (JavaScript compatible, no (?i) prefix)
- extractFields: Object mapping field names to capture group numbers (e.g., {"txnId": 1, "amount": 2, "sender": 3})
- bank: Bank name or null
- currency: Currency code or null

Only return valid JSON, no other text.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          errorMessage += ` - ${errorData.error.message || errorData.error}`;
        }
      } catch {
        errorMessage += ` - ${responseText.substring(0, 200)}`;
      }
      throw new Error(errorMessage);
    }

    const data = JSON.parse(responseText);
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!generatedText) {
      throw new Error('No generated text in Gemini response');
    }
    
    let result;
    try {
      result = JSON.parse(generatedText);
    } catch {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`No JSON found in Gemini response. Got: ${generatedText.substring(0, 200)}`);
      }
    }

    return {
      name: 'Gemini Generated Pattern',
      regex: result.regex || '',
      extractFields: result.extractFields || {},
      bank: result.bank || llmResult.bank || null,
      currency: result.currency || llmResult.currency || null,
    };
  } catch (error: any) {
    console.error('Gemini pattern generation failed:', error.message);
    // Fallback to rule-based pattern generation
    const { generatePatternFromSMS } = require('./patternAI');
    return generatePatternFromSMS(smsText, 'Gemini Generated Pattern (Fallback)', countryCode);
  }
}

