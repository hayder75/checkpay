# Transaction ID Extraction - Analysis & Recommendations

## Current Implementation Analysis

### What's Working Well

1. **Multi-pattern Keyword Detection**
   - Supports multiple transaction ID keywords: "transaction number", "txn", "ref", "reference", "id", etc.
   - Handles variations like "transaction number is X" vs "transaction number X"
   - Minimum length validation (6+ characters) to avoid false positives

2. **Country-Specific Templates**
   - Country templates provide localized patterns for banks, currencies, and common phrases
   - Helps with regional variations in SMS formatting

3. **Flexible Extraction with Fallback**
   - Primary regex matching with keyword-based fallback
   - Handles cases where regex doesn't match perfectly

4. **Pattern Learning System**
   - Users can create patterns from SMS examples
   - Pattern marketplace for sharing templates

### Current Limitations

1. **No URL/Link Parsing**
   - Transaction IDs embedded in URLs are not extracted
   - Example: `https://bank.com/verify?txn=ABC123XYZ` or `https://bank.com/txn/ABC123XYZ`

2. **Limited Format Variations**
   - Assumes transaction IDs are alphanumeric, 6+ characters
   - Doesn't handle:
     - Transaction IDs with special characters (hyphens, underscores)
     - Short transaction IDs (< 6 chars)
     - Transaction IDs split across lines
     - Transaction IDs in different character sets (non-Latin)

3. **No Context-Aware Extraction**
   - Doesn't use surrounding context to identify transaction IDs
   - May miss transaction IDs that don't follow standard patterns

4. **No Machine Learning/NLP**
   - Relies entirely on rule-based extraction
   - Cannot learn from patterns in the data

5. **No Fuzzy Matching**
   - If a transaction ID format changes slightly, extraction fails
   - No handling of OCR errors or SMS truncation

## Recommended Solutions

### Option 0: AI-Powered Structure Detection (High Value - Strategic)

**Problem**: Rule-based extraction requires manual pattern creation and doesn't adapt to new formats automatically.

**Solution**: Use AI/LLM tools to automatically detect SMS structure and extract transaction IDs.

**Approaches**:

#### 0A. LLM-Based Extraction (GPT, Claude, etc.)
Use Large Language Models to understand SMS structure and extract transaction IDs.

**Implementation**:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractTxnIdWithLLM(smsText: string): Promise<{
  txnId: string | null;
  confidence: number;
  structure: any;
}> {
  const prompt = `Analyze this financial SMS and extract the transaction ID/number.
  
SMS: "${smsText}"

Return a JSON object with:
- txnId: The transaction ID/number if found, or null
- confidence: 0-1 confidence score
- structure: Description of the SMS structure (where txnId appears, format, etc.)
- amount: The transaction amount if found
- bank: The bank/institution name if found

Only return valid JSON, no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-4' for better accuracy
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistent extraction
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      txnId: result.txnId || null,
      confidence: result.confidence || 0,
      structure: result.structure || null,
    };
  } catch (error) {
    console.error('LLM extraction failed:', error);
    return { txnId: null, confidence: 0, structure: null };
  }
}
```

**Pros**:
- Understands context and structure automatically
- Handles any SMS format (even unknown ones)
- Can extract multiple fields (amount, bank, sender) simultaneously
- Works with non-English SMS
- No manual pattern creation needed

**Cons**:
- API costs (per SMS)
- Latency (100-500ms per extraction)
- Requires API key management
- May have rate limits
- Less predictable than rules

**Cost Estimate**:
- GPT-4o-mini: ~$0.00015 per SMS (very affordable)
- GPT-4: ~$0.003 per SMS (more accurate but expensive)
- For 1000 SMS/day: $0.15-$3/day

#### 0B. Structured Output with Function Calling
Use LLM function calling for structured extraction.

**Implementation**:
```typescript
async function extractTxnIdStructured(smsText: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Extract transaction details from this SMS: "${smsText}"`
    }],
    tools: [{
      type: 'function',
      function: {
        name: 'extract_transaction_details',
        description: 'Extract transaction details from SMS',
        parameters: {
          type: 'object',
          properties: {
            txnId: { type: 'string', description: 'Transaction ID/number' },
            amount: { type: 'number', description: 'Transaction amount' },
            currency: { type: 'string', description: 'Currency code' },
            bank: { type: 'string', description: 'Bank/institution name' },
            sender: { type: 'string', description: 'Sender phone number' },
          },
          required: ['txnId']
        }
      }
    }],
    tool_choice: { type: 'function', function: { name: 'extract_transaction_details' } }
  });

  const toolCall = response.choices[0].message.tool_calls?.[0];
  if (toolCall) {
    return JSON.parse(toolCall.function.arguments);
  }
  return null;
}
```

#### 0C. Hybrid Approach (Recommended)
Use LLM as fallback for edge cases, rules for common cases.

**Implementation**:
```typescript
async function extractTxnIdHybrid(smsText: string): Promise<string | null> {
  // Stage 1: Try rule-based extraction (fast, free)
  const ruleBased = extractTxnIdEnhanced(smsText);
  if (ruleBased && ruleBased.confidence > 0.8) {
    return ruleBased.txnId;
  }

  // Stage 2: Try URL extraction (fast, free)
  const urlBased = extractTxnIdFromURL(smsText);
  if (urlBased) {
    return urlBased;
  }

  // Stage 3: Use LLM for edge cases (slower, costs money)
  // Only use if rule-based failed or low confidence
  if (ruleBased && ruleBased.confidence < 0.5) {
    const llmResult = await extractTxnIdWithLLM(smsText);
    if (llmResult.txnId && llmResult.confidence > 0.7) {
      // Learn from LLM result - could update patterns
      return llmResult.txnId;
    }
  }

  return ruleBased?.txnId || null;
}
```

**When to Use LLM**:
- New/unknown bank formats
- Low confidence from rule-based extraction
- Complex SMS structures
- Non-English SMS
- Edge cases that rules can't handle

**Cost Optimization**:
- Cache LLM results for similar SMS patterns
- Use LLM only for < 10% of SMS (edge cases)
- Batch similar SMS for processing
- Use cheaper models (GPT-4o-mini) for most cases

#### 0D. Local AI Models (Privacy-Focused)
Use local models for on-device extraction (no API costs, better privacy).

**Options**:
- **Ollama** (local LLM): Run models like Llama 3, Mistral locally
- **Transformers.js**: Run smaller models in browser/Node.js
- **spaCy**: NLP library for structure detection

**Implementation** (Ollama example):
```typescript
async function extractTxnIdLocal(smsText: string) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama3.2', // or 'mistral', 'phi3', etc.
      prompt: `Extract transaction ID from: "${smsText}". Return only the transaction ID or "null".`,
      stream: false,
    }),
  });

  const result = await response.json();
  const txnId = result.response.trim();
  return txnId !== 'null' ? txnId : null;
}
```

**Pros**:
- No API costs
- Better privacy (data stays local)
- No rate limits
- Works offline

**Cons**:
- Requires local infrastructure
- Slower than cloud APIs
- Lower accuracy than GPT-4
- More complex setup

---

### Option 0.5: Sample SMS Collection During Setup (High Value - User Onboarding)

**Problem**: Users have to manually create patterns, and we don't know their specific SMS formats upfront.

**Solution**: Collect sample SMS messages (both sender and receiver) during app setup/onboarding to automatically generate patterns.

**Implementation**:

#### Enhanced Onboarding Flow

**Step 1: Collect Sample SMS**
```typescript
// In OnboardingScreen.tsx
interface OnboardingData {
  countryCode: string;
  sampleSMS: {
    sender: string; // SMS user receives (incoming payment)
    receiver: string; // SMS user sends (outgoing payment) - optional
  }[];
  banks: string[];
}

const [onboardingData, setOnboardingData] = useState<OnboardingData>({
  countryCode: '',
  sampleSMS: [],
  banks: [],
});

// New step in onboarding: "Sample SMS Collection"
const renderSampleSMSStep = () => (
  <View>
    <Text>Help us understand your SMS format</Text>
    
    {/* Option 1: Scan existing SMS */}
    <Button onPress={scanExistingSMS}>
      Scan My SMS Messages
    </Button>
    
    {/* Option 2: Manual input */}
    <TextInput
      placeholder="Paste a sample SMS you received (incoming payment)"
      value={sampleSMS.sender}
      onChangeText={setSampleSMS}
      multiline
    />
    
    <TextInput
      placeholder="Paste a sample SMS you sent (outgoing payment) - Optional"
      value={sampleSMS.receiver}
      onChangeText={setSampleSMS}
      multiline
    />
    
    <Button onPress={analyzeSamples}>
      Analyze & Create Patterns
    </Button>
  </View>
);
```

**Step 2: Auto-Generate Patterns from Samples**
```typescript
async function analyzeSamplesAndCreatePatterns(
  sampleSMS: { sender: string; receiver?: string },
  userId: string
) {
  // Use AI to analyze structure
  const senderAnalysis = await analyzeSMSStructure(sampleSMS.sender);
  const receiverAnalysis = sampleSMS.receiver 
    ? await analyzeSMSStructure(sampleSMS.receiver)
    : null;

  // Auto-generate patterns
  const patterns = [];
  
  // Pattern for incoming payments
  if (senderAnalysis.txnId) {
    const senderPattern = await generatePatternFromAnalysis(
      sampleSMS.sender,
      senderAnalysis,
      'Incoming Payment Pattern'
    );
    patterns.push(senderPattern);
  }

  // Pattern for outgoing payments (if provided)
  if (receiverAnalysis?.txnId) {
    const receiverPattern = await generatePatternFromAnalysis(
      sampleSMS.receiver!,
      receiverAnalysis,
      'Outgoing Payment Pattern'
    );
    patterns.push(receiverPattern);
  }

  // Create patterns in database
  for (const pattern of patterns) {
    await prisma.pattern.create({
      data: {
        userId,
        ...pattern,
      },
    });
  }

  return patterns;
}

async function analyzeSMSStructure(smsText: string) {
  // Option 1: Use LLM for structure analysis
  const llmAnalysis = await extractTxnIdWithLLM(smsText);
  
  // Option 2: Use rule-based analysis
  const ruleAnalysis = {
    txnId: extractTxnIdEnhanced(smsText),
    amount: extractAmount(smsText),
    bank: detectBank(smsText),
    currency: detectCurrency(smsText),
  };

  // Combine both for best results
  return {
    txnId: llmAnalysis.txnId || ruleAnalysis.txnId,
    amount: ruleAnalysis.amount,
    bank: ruleAnalysis.bank,
    currency: ruleAnalysis.currency,
    structure: llmAnalysis.structure,
  };
}
```

**Step 3: Pattern Validation & User Confirmation**
```typescript
const renderPatternPreview = (pattern: GeneratedPattern) => (
  <View>
    <Text>We detected this pattern:</Text>
    <Text>Transaction ID: {pattern.extractFields.txnId}</Text>
    <Text>Amount: {pattern.extractFields.amount}</Text>
    <Text>Bank: {pattern.bank}</Text>
    
    <Text>Test with your SMS:</Text>
    <Text>{sampleSMS.sender}</Text>
    
    <Text>Extracted:</Text>
    <Text>Transaction ID: {extractedTxnId}</Text>
    <Text>Amount: {extractedAmount}</Text>
    
    <Button onPress={confirmPattern}>Looks Good ✓</Button>
    <Button onPress={editPattern}>Edit Pattern</Button>
  </View>
);
```

**Benefits**:
1. **Zero Manual Pattern Creation**: Users don't need to create patterns manually
2. **Higher Accuracy**: Patterns generated from their actual SMS
3. **Faster Onboarding**: Setup complete in minutes, not hours
4. **Both Directions**: Handles both incoming and outgoing payments
5. **Personalized**: Each user gets patterns tailored to their banks

**Implementation Details**:

**Backend API**:
```typescript
// POST /api/onboarding/analyze-samples
export async function analyzeSamples(req: AuthRequest, res: Response) {
  const { senderSMS, receiverSMS } = req.body;
  
  // Analyze both SMS
  const senderAnalysis = await analyzeSMSStructure(senderSMS);
  const receiverAnalysis = receiverSMS 
    ? await analyzeSMSStructure(receiverSMS)
    : null;

  // Generate patterns
  const patterns = [];
  
  if (senderAnalysis.txnId) {
    patterns.push(generatePatternFromSMS(senderSMS, 'Incoming Payment'));
  }
  
  if (receiverAnalysis?.txnId) {
    patterns.push(generatePatternFromSMS(receiverSMS, 'Outgoing Payment'));
  }

  // Return patterns for preview (don't save yet)
  res.json({
    success: true,
    data: {
      patterns,
      preview: {
        sender: extractActualValues(senderSMS),
        receiver: receiverSMS ? extractActualValues(receiverSMS) : null,
      },
    },
  });
}

// POST /api/onboarding/confirm-patterns
export async function confirmPatterns(req: AuthRequest, res: Response) {
  const { patterns } = req.body; // User-confirmed patterns
  
  // Create patterns in database
  const created = await Promise.all(
    patterns.map(p => prisma.pattern.create({
      data: {
        userId: req.user!.id,
        ...p,
      },
    }))
  );

  res.json({ success: true, data: created });
}
```

**Mobile App Integration**:
```typescript
// In OnboardingScreen.tsx
const handleAnalyzeSamples = async () => {
  setLoading(true);
  try {
    // Send samples to backend for analysis
    const response = await api.post('/onboarding/analyze-samples', {
      senderSMS: sampleSMS.sender,
      receiverSMS: sampleSMS.receiver,
    });

    // Show preview
    setPatternPreview(response.data.data);
    setStep('preview');
  } catch (error) {
    Alert.alert('Error', 'Failed to analyze SMS samples');
  } finally {
    setLoading(false);
  }
};

const handleConfirmPatterns = async () => {
  setLoading(true);
  try {
    // Confirm and save patterns
    await api.post('/onboarding/confirm-patterns', {
      patterns: patternPreview.patterns,
    });

    // Complete onboarding
    onComplete(countryCode, selectedBanks);
  } catch (error) {
    Alert.alert('Error', 'Failed to save patterns');
  } finally {
    setLoading(false);
  }
};
```

**Enhanced Features**:
1. **SMS Scanning**: Automatically scan user's SMS inbox for financial messages
2. **Multiple Samples**: Allow users to provide 2-3 samples for better accuracy
3. **Pattern Testing**: Let users test patterns before confirming
4. **Pattern Updates**: Re-analyze if SMS format changes

**Pros**:
- Eliminates manual pattern creation
- Higher accuracy (patterns from real SMS)
- Faster user onboarding
- Handles both sender and receiver SMS
- Personalized to each user's banks

**Cons**:
- Requires SMS permission (already have this)
- Users need to provide samples (but it's one-time)
- Need to handle cases where samples don't have transaction IDs

---

### Option 1: Enhanced URL/Link Extraction (High Priority - Quick Win)

**Problem**: Some institutions send transaction IDs as URL parameters or path segments.

**Solution**: Add URL parsing to extract transaction IDs from links.

**Implementation**:
```typescript
function extractTxnIdFromURL(text: string): string | null {
  // Extract all URLs from text
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlPattern) || [];
  
  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      
      // Check query parameters: ?txn=, ?transactionId=, ?ref=, etc.
      const txnParams = ['txn', 'transactionId', 'transaction_id', 'ref', 'reference', 'id', 'txnid'];
      for (const param of txnParams) {
        const value = urlObj.searchParams.get(param);
        if (value && value.length >= 4) {
          return value.trim();
        }
      }
      
      // Check path segments: /txn/ABC123, /transaction/ABC123
      const pathMatch = urlObj.pathname.match(/\/(?:txn|transaction|ref|reference)\/([A-Z0-9_-]+)/i);
      if (pathMatch && pathMatch[1] && pathMatch[1].length >= 4) {
        return pathMatch[1].trim();
      }
      
      // Check hash fragments: #txn=ABC123
      if (urlObj.hash) {
        const hashMatch = urlObj.hash.match(/[#&](?:txn|transactionId|ref)=([A-Z0-9_-]+)/i);
        if (hashMatch && hashMatch[1] && hashMatch[1].length >= 4) {
          return hashMatch[1].trim();
        }
      }
    } catch (e) {
      // Invalid URL, skip
      continue;
    }
  }
  
  return null;
}
```

**Pros**:
- Quick to implement
- Handles a common use case
- Low risk

**Cons**:
- Only solves URL-based transaction IDs
- Doesn't address other format variations

---

### Option 2: Enhanced Pattern Matching with Context (Medium Priority)

**Problem**: Transaction IDs may not follow standard patterns or may be embedded in unusual contexts.

**Solution**: Improve extraction with context-aware patterns and expanded format support.

**Implementation**:
```typescript
function extractTxnIdEnhanced(text: string): string | null {
  // 1. Try existing patterns first
  const existing = extractTxnId(text);
  if (existing) return existing;
  
  // 2. Try URL extraction
  const fromURL = extractTxnIdFromURL(text);
  if (fromURL) return fromURL;
  
  // 3. Enhanced patterns with context
  const enhancedPatterns = [
    // Transaction IDs with separators: ABC-123-XYZ, ABC_123_XYZ
    /\b([A-Z0-9]{3,}[-_][A-Z0-9]{3,}[-_]?[A-Z0-9]{0,})\b/i,
    
    // Transaction IDs near keywords (context-aware)
    /(?:confirmation|receipt|reference|tracking)\s+(?:number|code|id)[\s:]+([A-Z0-9]{4,})/i,
    
    // Transaction IDs in parentheses or brackets
    /[\(\[][\s]*([A-Z0-9]{6,})[\s]*[\)\]]/,
    
    // Transaction IDs after "code:" or "number:"
    /(?:code|number|id)[\s:]+([A-Z0-9]{4,})/i,
    
    // Short transaction IDs (4-5 chars) if near amount
    /(?:received|credited|paid)\s+[A-Z]{3}\s+[\d,]+\.?\d*\s+(?:with|using|via|txn|ref)[\s:]+([A-Z0-9]{4,})/i,
  ];
  
  for (const pattern of enhancedPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const txnId = match[1].trim();
      // Validate it's not a date, phone number, or amount
      if (!txnId.match(/^\d{4}-\d{2}-\d{2}/) && 
          !txnId.match(/^\d{10,}$/) && 
          !txnId.match(/^\d+\.\d+$/)) {
        return txnId;
      }
    }
  }
  
  // 4. Look for alphanumeric codes near financial keywords
  const financialKeywords = ['payment', 'transaction', 'transfer', 'deposit', 'credit'];
  const words = text.split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^\w]/g, '');
    if (financialKeywords.some(kw => word.toLowerCase().includes(kw.toLowerCase()))) {
      // Check next few words for potential transaction ID
      for (let j = i + 1; j < Math.min(i + 5, words.length); j++) {
        const candidate = words[j].replace(/[^\w]/g, '');
        if (candidate.length >= 4 && candidate.match(/^[A-Z0-9]+$/i) &&
            !candidate.match(/^\d+$/) && // Not pure numbers
            !candidate.match(/^\d{4}-\d{2}-\d{2}/)) { // Not a date
          return candidate;
        }
      }
    }
  }
  
  return null;
}
```

**Pros**:
- Handles more format variations
- Context-aware extraction
- Still rule-based (predictable)

**Cons**:
- More complex patterns to maintain
- May have false positives
- Still limited by rule-based approach

---

### Option 3: Machine Learning / NLP Approach (High Value - Long Term)

**Problem**: Rule-based extraction cannot handle all variations and doesn't learn from data.

**Solution**: Use NLP/ML to learn patterns from actual SMS data.

**Approaches**:

#### 3A. Named Entity Recognition (NER) with Pre-trained Models
- Use spaCy, Transformers, or similar libraries
- Fine-tune on financial SMS dataset
- Can identify transaction IDs as entities

**Implementation**:
```typescript
// Using a lightweight approach with regex + ML hybrid
import { pipeline } from '@xenova/transformers';

async function extractTxnIdML(text: string): Promise<string | null> {
  // 1. Use rule-based first (fast)
  const ruleBased = extractTxnIdEnhanced(text);
  if (ruleBased) return ruleBased;
  
  // 2. Use ML for edge cases
  const classifier = await pipeline('token-classification', 'dbmdz/bert-large-cased-finetuned-conll03-english');
  const entities = await classifier(text);
  
  // Look for entities labeled as transaction IDs or similar
  const txnEntity = entities.find(e => 
    e.label === 'MISC' || e.label === 'ORG' && 
    e.word.match(/^[A-Z0-9]{4,}$/i)
  );
  
  return txnEntity ? txnEntity.word : null;
}
```

#### 3B. Custom ML Model Training
- Collect labeled SMS data (transaction ID annotated)
- Train a custom model (BERT, RoBERTa, or smaller model)
- Deploy as a service

**Pros**:
- Can learn from data
- Handles variations automatically
- Improves over time
- Can handle non-English SMS

**Cons**:
- Requires training data
- More complex to implement
- Higher computational cost
- May need GPU for real-time inference
- Less predictable than rules

#### 3C. Hybrid Approach (Recommended)
- Use rule-based extraction for 90% of cases (fast, predictable)
- Use ML for edge cases and validation
- Learn from failures to improve rules

---

### Option 4: Multi-Stage Extraction Pipeline (Recommended Architecture)

**Solution**: Combine multiple extraction methods in a priority order.

**Implementation Flow**:
```
1. URL/Link Extraction (fast, specific)
   ↓ (if not found)
2. Pattern-Based Extraction (current system)
   ↓ (if not found)
3. Context-Aware Extraction (enhanced patterns)
   ↓ (if not found)
4. ML/NLP Extraction (for edge cases)
   ↓ (if not found)
5. Fuzzy Matching / Heuristics
```

**Code Structure**:
```typescript
interface ExtractionResult {
  txnId: string | null;
  confidence: number; // 0-1
  method: string; // 'url', 'pattern', 'context', 'ml', 'fuzzy'
}

async function extractTransactionIdMultiStage(
  text: string,
  options: { useML?: boolean } = {}
): Promise<ExtractionResult> {
  // Stage 1: URL extraction (highest confidence if found)
  const urlResult = extractTxnIdFromURL(text);
  if (urlResult) {
    return { txnId: urlResult, confidence: 0.95, method: 'url' };
  }
  
  // Stage 2: Pattern-based (current system)
  const patternResult = extractTxnId(text);
  if (patternResult) {
    return { txnId: patternResult, confidence: 0.85, method: 'pattern' };
  }
  
  // Stage 3: Enhanced context-aware
  const contextResult = extractTxnIdEnhanced(text);
  if (contextResult) {
    return { txnId: contextResult, confidence: 0.70, method: 'context' };
  }
  
  // Stage 4: ML (if enabled)
  if (options.useML) {
    const mlResult = await extractTxnIdML(text);
    if (mlResult) {
      return { txnId: mlResult, confidence: 0.60, method: 'ml' };
    }
  }
  
  // Stage 5: Fuzzy/heuristic fallback
  const fuzzyResult = extractTxnIdFuzzy(text);
  if (fuzzyResult) {
    return { txnId: fuzzyResult, confidence: 0.40, method: 'fuzzy' };
  }
  
  return { txnId: null, confidence: 0, method: 'none' };
}
```

**Pros**:
- Best of all worlds
- Fast for common cases
- Handles edge cases
- Confidence scoring helps with validation

**Cons**:
- More complex to maintain
- Requires testing all stages

---

### Option 5: User Feedback Loop & Pattern Learning

**Solution**: Learn from user corrections and failed extractions.

**Implementation**:
1. When extraction fails, flag SMS for review
2. Allow users to manually correct transaction IDs
3. Use corrections to:
   - Improve existing patterns
   - Create new patterns
   - Train ML models
   - Update country templates

**Features**:
- Admin dashboard for reviewing failed extractions
- Pattern suggestion system
- Automatic pattern updates from corrections
- A/B testing of extraction methods

---

### Option 6: Bank-Specific Extractors

**Solution**: Create specialized extractors for known banks/institutions.

**Implementation**:
```typescript
const bankExtractors: Record<string, (text: string) => string | null> = {
  'M-Pesa': (text) => {
    // M-Pesa specific: "Ref: ABC123" or "TXN: ABC123"
    const match = text.match(/(?:Ref|TXN)[\s:]+([A-Z0-9]{8,})/i);
    return match ? match[1] : null;
  },
  'Telebirr': (text) => {
    // Telebirr specific: "by transaction number ABC123"
    const match = text.match(/by\s+transaction\s+number\s+([A-Z0-9]{8,})/i);
    return match ? match[1] : null;
  },
  // Add more bank-specific extractors
};

function extractTxnIdByBank(text: string, bank: string | null): string | null {
  if (bank && bankExtractors[bank]) {
    return bankExtractors[bank](text);
  }
  return null;
}
```

**Pros**:
- High accuracy for known banks
- Can handle bank-specific quirks
- Easy to test and maintain per bank

**Cons**:
- Requires maintenance for each bank
- Doesn't help with unknown banks
- May become outdated if banks change formats

---

## Recommended Implementation Plan

### Phase 1: Quick Wins (Week 1-2)
1. ✅ **Implement URL/Link Extraction** (Option 1)
   - Add `extractTxnIdFromURL()` function
   - Integrate into existing extraction pipeline
   - Test with sample SMS containing URLs

2. ✅ **Enhanced Pattern Matching** (Option 2 - partial)
   - Add support for transaction IDs with separators (hyphens, underscores)
   - Add context-aware patterns
   - Support shorter transaction IDs (4-5 chars) in specific contexts

### Phase 2: Architecture Improvement (Week 3-4)
3. ✅ **Multi-Stage Extraction Pipeline** (Option 4)
   - Refactor extraction to use multi-stage approach
   - Add confidence scoring
   - Log extraction method for analytics

4. ✅ **Bank-Specific Extractors** (Option 6)
   - Create extractors for top 5-10 banks
   - Add bank detection to route to specific extractors
   - Test with real SMS samples

### Phase 3: Advanced Features (Month 2+)
5. ⏳ **User Feedback Loop** (Option 5)
   - Add UI for manual correction
   - Implement pattern learning from corrections
   - Analytics dashboard for extraction success rates

6. ⏳ **ML/NLP Integration** (Option 3 - if needed)
   - Evaluate if ML is needed based on Phase 1-2 results
   - If needed, implement hybrid ML approach
   - Start with lightweight models (spaCy, transformers.js)

---

## Testing Strategy

### Test Cases to Cover

1. **URL-based Transaction IDs**:
   - `https://bank.com/verify?txn=ABC123`
   - `https://bank.com/txn/ABC123`
   - `https://bank.com/#ref=ABC123`

2. **Format Variations**:
   - Standard: `Transaction number: ABC123XYZ`
   - With separators: `TXN: ABC-123-XYZ`
   - Short IDs: `Ref: AB12` (in specific contexts)
   - In parentheses: `(Ref: ABC123)`

3. **Edge Cases**:
   - Transaction ID split across lines
   - Multiple potential IDs (should pick the right one)
   - Transaction ID in non-English text
   - SMS truncation/encoding issues

4. **Bank-Specific**:
   - M-Pesa format
   - Telebirr format
   - Other major banks in supported countries

---

## Metrics to Track

1. **Extraction Success Rate**: % of SMS where transaction ID is found
2. **Confidence Distribution**: How often each extraction method is used
3. **False Positive Rate**: Transaction IDs extracted incorrectly
4. **Method Performance**: Success rate by extraction method
5. **Bank-Specific Metrics**: Success rate per bank/institution

---

## Conclusion

**Immediate Action Items**:
1. Implement URL extraction (high impact, low effort)
2. Enhance pattern matching with context-aware patterns
3. Create multi-stage extraction pipeline
4. Add bank-specific extractors for top banks

**Long-term Considerations**:
- Monitor extraction success rates
- Collect user feedback on failed extractions
- Consider ML/NLP if rule-based approach plateaus
- Build pattern learning system from corrections

The recommended approach is a **hybrid multi-stage pipeline** that combines:
- Fast rule-based extraction for common cases
- URL parsing for link-based transaction IDs
- Bank-specific extractors for known institutions
- Context-aware patterns for edge cases
- Optional ML for difficult cases

This provides the best balance of accuracy, performance, and maintainability.

