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

const EXTRACTION_PROMPT = `You are an expert at extracting financial transaction data from SMS messages. Analyze the SMS text carefully and extract all relevant transaction information.

SMS Text: "{smsText}"

Extract the following fields from the SMS:
1. Transaction ID: Look for reference numbers, transaction IDs, confirmation codes, receipt numbers. These are usually alphanumeric codes (6+ characters). Check for keywords like "transaction number", "txn", "ref", "reference", "id", "receipt", "confirmation code", or similar terms. Also check URLs for transaction IDs in query parameters (e.g., ?txn=, ?trx=, ?id=, ?ref=).

2. Amount: Find the transaction amount. Look for numbers near currency keywords (ETB, KES, NGN, GHS, USD, etc.) or keywords like "received", "credited", "transferred", "deposited", "amount". Handle comma-separated numbers (e.g., 1,000.00). Ignore balance amounts.

3. Currency: Extract the currency code (ETB, KES, NGN, GHS, USD, etc.) or currency name (Birr, Shilling, Naira, Cedi, Dollar).

4. Bank/Institution: Identify the bank or financial institution name (e.g., "Commercial Bank of Ethiopia", "CBE", "M-Pesa", "Telebirr", "MTN MoMo", "Airtel Money").

5. Sender: Extract the sender's name or phone number. Look for keywords like "from", "by", "sent by", "sender".

6. Send From: The institution/account/service sending money (e.g., "M-Pesa", "Telebirr", account number, wallet name).

7. Send To: The institution/account/service receiving money (e.g., "M-Pesa", "Telebirr", account number, wallet name).

IMPORTANT:
- Be flexible with formats and variations in wording
- Transaction IDs can be in URLs, text, or both
- Amounts may have commas (1,000.00) or not (1000.00)
- Currency might be before or after the amount
- Handle abbreviations (CBE = Commercial Bank of Ethiopia)
- If a field is not found, return null (not empty string or 0)

Return ONLY a valid JSON object with this exact structure:
{
  "txnId": "string or null",
  "amount": number or null,
  "currency": "string or null",
  "bank": "string or null",
  "sender": "string or null",
  "sendFrom": "string or null",
  "sendTo": "string or null"
}

Do not include any explanation, markdown formatting, or additional text. Only return the JSON object.`;

/**
 * Extract using Google Gemini API
 */
async function extractWithGemini(smsText: string): Promise<LLMExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  
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
            maxOutputTokens: 4000,
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
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const prompt = `Create a JavaScript regex pattern to extract transaction data from SMS messages.

SMS: "${smsText}"

Extracted: txnId="${llmResult.txnId || ''}", amount=${llmResult.amount || 0}, currency="${llmResult.currency || ''}", bank="${llmResult.bank || ''}", sender="${llmResult.sender || ''}"

Create a flexible regex with capture groups for: txnId, amount, sender. Handle URLs with ?trx= or ?txn=, comma-separated numbers (1,000.00), case variations, optional words.

Return JSON only:
{
  "regex": "pattern string (JavaScript compatible, no (?i) prefix)",
  "extractFields": {"txnId": 1, "amount": 2, "sender": 3},
  "bank": "${llmResult.bank || null}",
  "currency": "${llmResult.currency || null}"
}`;

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
            maxOutputTokens: 10000, // Increased to account for thinking tokens in gemini-2.5-flash
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
    
    // Check for thinking tokens consuming output
    if (data.usageMetadata?.thoughtsTokenCount && data.usageMetadata.thoughtsTokenCount > 0) {
      console.log(`[Gemini] Thinking tokens used: ${data.usageMetadata.thoughtsTokenCount}`);
    }
    
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!generatedText) {
      // Check if it's a MAX_TOKENS issue
      if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini response exceeded token limit. Try increasing maxOutputTokens or simplifying the prompt.');
      }
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

