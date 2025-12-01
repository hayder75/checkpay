# AI Pattern Creation - How It Works & How to Customize

## 🤖 What the AI Currently Does

The AI performs a **2-step process** to create patterns:

### **Step 1: Extract Transaction Data** (`extractTxnIdWithLLM()`)
**File:** `backend/src/utils/llmExtractor.ts`

**What it does:**
- Takes SMS text as input
- Uses Gemini AI to extract:
  - Transaction ID
  - Amount
  - Currency
  - Bank/Institution
  - Sender
  - Send From (institution)
  - Send To (institution)

**Current Prompt:**
```
Extract transaction details from this SMS message. Return only the transaction ID, amount, currency, bank name, sender, send from (institution), and send to (institution) if found.

SMS: "{smsText}"

Return a JSON object with:
- txnId: The transaction ID/number if found, or null
- amount: The transaction amount as a number if found, or null
- currency: The currency code (e.g., "KES", "ETB") if found, or null
- bank: The bank/institution name if found, or null
- sender: The sender phone number or name if found, or null
- sendFrom: The institution/account sending money (e.g., "M-Pesa", "Telebirr", account number) if found, or null
- sendTo: The institution/account receiving money (e.g., "M-Pesa", "Telebirr", account number) if found, or null

Only return valid JSON, no other text.
```

**AI Configuration:**
- Model: `gemini-2.5-flash-lite-preview-06-17`
- Temperature: `0.1` (low = more deterministic)
- Max Output Tokens: `200`
- Response Format: `application/json`

---

### **Step 2: Generate Regex Pattern** (`generatePatternFromLLM()`)
**File:** `backend/src/utils/llmExtractor.ts`

**What it does:**
- Takes SMS text + extracted data from Step 1
- Uses Gemini AI to create a regex pattern
- Generates capture groups for transaction ID, amount, sender, etc.

**Current Prompt:**
```
Create a regex pattern to extract transaction data from SMS messages like this one.

SMS Example: "{smsText}"

Extracted Data:
- Transaction ID: {txnId}
- Amount: {amount}
- Currency: {currency}
- Bank: {bank}
- Sender: {sender}

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

Only return valid JSON, no other text.
```

**AI Configuration:**
- Model: `gemini-2.5-flash-lite-preview-06-17`
- Temperature: `0.1`
- Max Output Tokens: `500`
- Response Format: `application/json`

---

## 🔄 Current Flow (Onboarding)

```
User provides SMS + Transaction ID
    ↓
Step 1: extractTxnIdWithLLM(smsText)
    → AI extracts transaction data
    ↓
Validate: extracted txnId === user-provided txnId
    ↓
Step 2: generatePatternFromLLM(smsText, extractedData)
    → AI generates regex pattern
    ↓
Save pattern to database
```

---

## ✨ Proposed Flow (Regular Pattern Creation)

```
User provides SMS only (NO transaction ID)
    ↓
Step 1: extractTxnIdWithLLM(smsText)
    → AI extracts transaction data automatically
    ↓
Step 2: generatePatternFromLLM(smsText, extractedData)
    → AI generates regex pattern
    ↓
Save pattern to database
```

**Key Difference:** No validation step - AI figures everything out automatically!

---

## 🛠️ How to Customize the AI

### **1. Customize Extraction Prompt**

**File:** `backend/src/utils/llmExtractor.ts`

**Current Prompt (Line 17):**
```typescript
const EXTRACTION_PROMPT = `Extract transaction details from this SMS message...
```

**You can modify it to:**
- Add specific instructions for certain countries
- Focus on specific fields
- Add examples
- Change the format

**Example Customization:**
```typescript
const EXTRACTION_PROMPT = `You are an expert at extracting financial transaction data from SMS messages in Africa.

SMS: "{smsText}"

Extract the following fields with high accuracy:
- Transaction ID: Look for patterns like "MP123456789", "CK660DRZ8I", "TXN123456"
- Amount: Find monetary amounts (e.g., 1,000.00, 500.50)
- Currency: Detect currency codes (KES, ETB, NGN, GHS, etc.)
- Bank: Identify financial institutions (M-Pesa, Telebirr, CBE, etc.)
- Sender: Extract sender name or phone number

Return a JSON object with:
- txnId: string or null
- amount: number or null
- currency: string or null
- bank: string or null
- sender: string or null
- sendFrom: string or null
- sendTo: string or null

Only return valid JSON, no other text.`;
```

---

### **2. Customize Pattern Generation Prompt**

**File:** `backend/src/utils/llmExtractor.ts`

**Current Prompt (Line 146):**
```typescript
const prompt = `Create a regex pattern to extract transaction data...
```

**You can modify it to:**
- Add specific regex requirements
- Request more flexible patterns
- Add examples of good patterns
- Specify capture group order

**Example Customization:**
```typescript
const prompt = `You are an expert at creating regex patterns for SMS transaction extraction.

SMS Example: "${smsText}"

Extracted Data:
- Transaction ID: ${llmResult.txnId || 'N/A'}
- Amount: ${llmResult.amount || 'N/A'}
- Currency: ${llmResult.currency || 'N/A'}
- Bank: ${llmResult.bank || 'N/A'}
- Sender: ${llmResult.sender || 'N/A'}

Create a JavaScript-compatible regex pattern that:
1. Uses capture groups for each field
2. Is flexible enough to handle variations in wording
3. Handles optional fields gracefully
4. Works with case-insensitive matching

Important:
- Use non-greedy matching (.*?) between fields
- Escape special regex characters properly
- Make patterns order-independent when possible
- Use appropriate character classes ([A-Z0-9], \\d+, etc.)

Return a JSON object with:
- regex: The regex pattern string (no (?i) prefix - we'll add 'i' flag)
- extractFields: Object mapping field names to capture group numbers
  Example: {"txnId": 1, "amount": 2, "sender": 3, "currency": 4}
- bank: Bank name or null
- currency: Currency code or null

Only return valid JSON, no other text.`;
```

---

### **3. Adjust AI Parameters**

**File:** `backend/src/utils/llmExtractor.ts`

**Current Settings:**
```typescript
generationConfig: {
  temperature: 0.1,        // Lower = more deterministic
  maxOutputTokens: 200,    // For extraction
  responseMimeType: 'application/json',
}
```

**You can adjust:**
- **Temperature** (0.0 - 2.0):
  - `0.1` = Very deterministic, consistent results
  - `0.5` = Balanced creativity
  - `1.0` = More creative, varied results
  
- **Max Output Tokens**:
  - `200` = For extraction (short JSON)
  - `500` = For pattern generation (longer regex)
  - Increase if you need more detailed responses

**Example:**
```typescript
generationConfig: {
  temperature: 0.2,        // Slightly more creative
  maxOutputTokens: 300,    // More room for extraction
  responseMimeType: 'application/json',
}
```

---

### **4. Change AI Model**

**File:** `backend/.env`

**Current:**
```env
GEMINI_MODEL=gemini-2.5-flash-lite-preview-06-17
```

**Options:**
- `gemini-2.5-flash-lite-preview-06-17` - Fast, lightweight (current)
- `gemini-2.5-flash` - Standard, balanced
- `gemini-2.5-pro` - More accurate, slower

**Example:**
```env
GEMINI_MODEL=gemini-2.5-pro  # More accurate but slower
```

---

## 📝 Implementation for Regular Pattern Creation

### **Backend Changes Needed:**

**File:** `backend/src/controllers/patternController.ts`

**Current `createPattern()` function:**
```typescript
export async function createPattern(req: AuthRequest, res: Response) {
  const { smsText, name, description } = createPatternSchema.parse(req.body);
  
  // Uses rule-based extraction
  const generatedPattern = generatePatternFromSMS(smsText, name, user?.country || null);
  
  // ... rest of function
}
```

**Updated to use AI:**
```typescript
export async function createPattern(req: AuthRequest, res: Response) {
  const { smsText, name, description } = createPatternSchema.parse(req.body);
  
  let generatedPattern;
  
  // Try AI first (if API key configured)
  if (process.env.GEMINI_API_KEY) {
    try {
      // Step 1: Extract with AI
      const llmResult = await extractTxnIdWithLLM(smsText);
      
      // Step 2: Generate pattern with AI
      generatedPattern = await generatePatternFromLLM(smsText, llmResult, user?.country || null);
      
      console.log('✅ Pattern created using AI:', {
        txnId: llmResult.txnId,
        amount: llmResult.amount,
        bank: llmResult.bank,
      });
    } catch (error) {
      // Fallback to rule-based if AI fails
      console.warn('⚠️ AI pattern generation failed, using rule-based fallback:', error);
      generatedPattern = generatePatternFromSMS(smsText, name, user?.country || null);
    }
  } else {
    // No API key - use rule-based
    generatedPattern = generatePatternFromSMS(smsText, name, user?.country || null);
  }
  
  // ... rest of function (validation, save, etc.)
}
```

---

## 🎯 Benefits of AI-Only Approach

1. **No User Input Required** - AI figures out everything automatically
2. **Better Accuracy** - AI understands context better than regex
3. **Handles Variations** - AI can adapt to different SMS formats
4. **Automatic Detection** - Finds transaction ID, amount, etc. without user help
5. **Consistent Experience** - Same AI-powered creation everywhere

---

## 🔧 Customization Examples

### **Example 1: Focus on Specific Countries**

```typescript
const EXTRACTION_PROMPT = `Extract transaction details from this SMS message. This SMS is from ${countryCode || 'an African'} country.

SMS: "{smsText}"

Common patterns in this region:
- Transaction IDs: Usually 6-12 alphanumeric characters
- Amounts: May include commas (1,000.00) or not (1000.00)
- Currencies: KES, ETB, NGN, GHS, UGX, TZS, RWF, ZAR

Extract:
- txnId: Transaction ID/number
- amount: Transaction amount (number)
- currency: Currency code
- bank: Bank/institution name
- sender: Sender name or phone
- sendFrom: Sending institution
- sendTo: Receiving institution

Return JSON only.`;
```

### **Example 2: More Flexible Pattern Generation**

```typescript
const prompt = `Create a flexible regex pattern that can handle variations in SMS formatting.

SMS: "${smsText}"

Requirements:
- Pattern should work even if field order changes
- Handle optional spaces and punctuation
- Support both comma-separated and plain numbers
- Case-insensitive matching

Create a regex that extracts:
1. Transaction ID (if present)
2. Amount (if present)
3. Sender (if present)
4. Currency (if present)

Make the pattern robust and flexible.`;
```

---

## ✅ Summary

**What AI Does:**
1. **Extracts** transaction data from SMS (txnId, amount, currency, bank, sender)
2. **Generates** regex pattern from extracted data

**How to Use for Regular Pattern Creation:**
- Remove transaction ID validation step
- Use AI extraction + generation automatically
- Fall back to rule-based if AI fails or not configured

**How to Customize:**
- Modify prompts in `llmExtractor.ts`
- Adjust AI parameters (temperature, tokens)
- Change model in `.env`
- Add country-specific instructions

**Files to Modify:**
- `backend/src/utils/llmExtractor.ts` - AI prompts and logic
- `backend/src/controllers/patternController.ts` - Use AI in `createPattern()`
- `backend/.env` - AI configuration

