# AI Tools & Sample SMS Collection - Detailed Guide

## Overview

This document details two high-value approaches for improving transaction ID extraction:
1. **AI-Powered Structure Detection** - Use LLMs to automatically understand SMS structure
2. **Sample SMS Collection During Setup** - Collect user samples to auto-generate patterns

---

## 1. AI-Powered Structure Detection

### Why Use AI?

**Problem**: Rule-based extraction requires manual pattern creation and can't adapt to new formats automatically.

**Solution**: Use AI/LLM to understand SMS context and extract transaction IDs intelligently.

### Available AI Tools

#### Option A: Cloud LLM Services (Recommended for Production)

**OpenAI GPT**:
- **GPT-4o-mini**: ~$0.00015 per SMS (very affordable)
- **GPT-4**: ~$0.003 per SMS (more accurate)
- **Best for**: Production use, edge cases, unknown formats
- **API**: Well-documented, reliable, fast

**Anthropic Claude**:
- Similar pricing to GPT-4
- Good alternative to OpenAI
- Strong reasoning capabilities

**Implementation Example**:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractTxnIdWithLLM(smsText: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Extract transaction ID from this SMS: "${smsText}"`
    }],
    tools: [{
      type: 'function',
      function: {
        name: 'extract_transaction_details',
        description: 'Extract transaction details from SMS',
        parameters: {
          type: 'object',
          properties: {
            txnId: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            bank: { type: 'string' },
          },
          required: ['txnId']
        }
      }
    }],
    tool_choice: { type: 'function', function: { name: 'extract_transaction_details' } }
  });

  const result = JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
  return result.txnId;
}
```

#### Option B: Local AI Models (Privacy-Focused)

**Ollama** (Local LLM):
- Run models like Llama 3, Mistral locally
- No API costs, better privacy
- Requires local infrastructure

**Transformers.js**:
- Run smaller models in browser/Node.js
- Good for client-side processing

**spaCy** (NLP Library):
- Rule-based + ML hybrid
- Good for structure detection

### Hybrid Approach (Recommended)

**Strategy**: Use AI as fallback, not primary method.

```
1. Try rule-based extraction (fast, free)
   ↓ (if confidence < 50%)
2. Try URL extraction (fast, free)
   ↓ (if still not found)
3. Use LLM extraction (slower, costs money)
   ↓
4. Learn from LLM results to improve rules
```

**Cost Optimization**:
- Use LLM only for < 10% of SMS (edge cases)
- Cache LLM results for similar SMS patterns
- Use cheaper models (GPT-4o-mini) for most cases
- Batch similar SMS for processing

**Cost Estimate**:
- If 10% of SMS need LLM: ~$0.15-$3/day for 1000 SMS
- Very affordable for the value provided

### When to Use AI

✅ **Use AI when**:
- Rule-based extraction has low confidence (< 50%)
- New/unknown bank formats
- Complex SMS structures
- Non-English SMS
- Edge cases that rules can't handle

❌ **Don't use AI when**:
- Rule-based extraction works well (confidence > 80%)
- Simple, standard SMS formats
- High-volume, cost-sensitive scenarios (use caching)

---

## 2. Sample SMS Collection During Setup

### Why Collect Samples?

**Problem**: Users have to manually create patterns, which is time-consuming and error-prone.

**Solution**: Collect sample SMS during onboarding to automatically generate patterns.

### Implementation Flow

#### Step 1: Enhanced Onboarding

Add a new step after country selection:

```
Onboarding Flow:
1. Select Country ✓
2. Provide Sample SMS (NEW)
   - Incoming SMS (payment received)
   - Outgoing SMS (payment sent) - optional
3. Review Generated Patterns (NEW)
4. Select Banks ✓
```

#### Step 2: Backend APIs

**API 1: Analyze SMS Samples**
```typescript
POST /api/onboarding/analyze-samples

Request:
{
  "senderSMS": "You have received ETB 200.00 by transaction number CK53WMPIOR...",
  "receiverSMS": "You sent ETB 100.00. Ref: MP123456" // optional
}

Response:
{
  "success": true,
  "data": {
    "patterns": [
      {
        "name": "Incoming Payment Pattern",
        "regex": "...",
        "extractFields": {...},
        "bank": "Telebirr",
        "currency": "ETB"
      }
    ],
    "preview": {
      "sender": {
        "txnId": "CK53WMPIOR",
        "amount": 200.00,
        "bank": "Telebirr",
        "currency": "ETB"
      },
      "receiver": {...} // if provided
    }
  }
}
```

**API 2: Confirm Patterns**
```typescript
POST /api/onboarding/confirm-patterns

Request:
{
  "patterns": [
    {
      "name": "Incoming Payment Pattern",
      "regex": "...",
      "extractFields": {...}
    }
  ]
}

Response:
{
  "success": true,
  "data": {
    "patterns": [...] // Created patterns
  }
}
```

#### Step 3: Mobile App UI

**Sample SMS Input Screen**:
```typescript
// In OnboardingScreen.tsx
const renderSampleSMSStep = () => (
  <View>
    <Text>Help us understand your SMS format</Text>
    
    {/* Option 1: Scan existing SMS */}
    <Button onPress={scanExistingSMS}>
      📱 Scan My SMS Messages
    </Button>
    
    {/* Option 2: Manual input */}
    <Text>Or paste a sample SMS:</Text>
    
    <TextInput
      placeholder="Paste SMS you received (incoming payment)"
      value={senderSMS}
      onChangeText={setSenderSMS}
      multiline
    />
    
    <TextInput
      placeholder="Paste SMS you sent (outgoing payment) - Optional"
      value={receiverSMS}
      onChangeText={setReceiverSMS}
      multiline
    />
    
    <Button onPress={handleAnalyzeSamples}>
      Analyze & Create Patterns
    </Button>
  </View>
);
```

**Pattern Preview Screen**:
```typescript
const renderPatternPreview = () => (
  <View>
    <Text>We detected this pattern:</Text>
    
    <Card>
      <Text>Transaction ID: {preview.txnId}</Text>
      <Text>Amount: {preview.amount} {preview.currency}</Text>
      <Text>Bank: {preview.bank}</Text>
    </Card>
    
    <Text>Test with your SMS:</Text>
    <Text>{sampleSMS.sender}</Text>
    
    <Button onPress={handleConfirmPatterns}>
      Looks Good ✓
    </Button>
    <Button onPress={handleEditPattern}>
      Edit Pattern
    </Button>
  </View>
);
```

### Analysis Methods

#### Method 1: AI-Powered Analysis (Recommended)
Use LLM to analyze SMS structure and generate patterns.

```typescript
async function analyzeSMSStructure(smsText: string) {
  // Use LLM to understand structure
  const llmAnalysis = await extractTxnIdWithLLM(smsText);
  
  // Generate pattern from analysis
  const pattern = generatePatternFromAnalysis(smsText, llmAnalysis);
  
  return pattern;
}
```

#### Method 2: Rule-Based Analysis (Fallback)
Use existing pattern generation logic.

```typescript
async function analyzeSMSStructure(smsText: string) {
  // Use existing generatePatternFromSMS function
  const pattern = generatePatternFromSMS(smsText, 'Auto-generated Pattern');
  
  return pattern;
}
```

#### Method 3: Hybrid (Best)
Combine both methods for best results.

```typescript
async function analyzeSMSStructure(smsText: string) {
  // Try rule-based first
  const rulePattern = generatePatternFromSMS(smsText, 'Pattern');
  
  // If rule-based fails or low confidence, use LLM
  if (!rulePattern.extractFields.txnId) {
    const llmAnalysis = await extractTxnIdWithLLM(smsText);
    if (llmAnalysis.txnId) {
      // Generate pattern from LLM analysis
      return generatePatternFromLLMAnalysis(smsText, llmAnalysis);
    }
  }
  
  return rulePattern;
}
```

### Benefits

✅ **For Users**:
- Zero manual pattern creation
- Faster onboarding (minutes vs hours)
- Higher accuracy (patterns from real SMS)
- Personalized to their banks

✅ **For You**:
- Reduces support requests
- Higher pattern accuracy
- Better user retention
- Less manual pattern management

### Edge Cases to Handle

1. **SMS without transaction IDs**:
   - Show message: "This SMS doesn't contain a transaction ID. Please provide another sample."
   - Allow user to skip or provide another sample

2. **Multiple transaction IDs in one SMS**:
   - Extract all and let user choose which one to use

3. **Unclear SMS format**:
   - Show low confidence warning
   - Allow user to manually edit pattern

4. **User wants to add more samples**:
   - Allow adding 2-3 samples for better accuracy
   - Combine patterns from multiple samples

### UX Considerations: Asking for Both Sender and Receiver SMS

**Question**: Is it bad UX to ask for both?

**Answer**: It depends on implementation. See `SAMPLE_SMS_UX_ANALYSIS.md` for detailed analysis.

**Quick Recommendation**:
- ✅ **Make outgoing SMS optional** (only incoming required)
- ✅ **Auto-scan first** - reduce manual work
- ✅ **Explain why** - show value of providing both
- ✅ **Allow skip** - don't block onboarding
- ✅ **Show validation** - if both provided, cross-check transaction IDs

**Best Practice**:
1. Auto-scan SMS inbox (if permission granted)
2. Pre-fill what we find
3. Require only incoming SMS (most important)
4. Make outgoing SMS optional (nice-to-have)
5. Show validation if both provided
6. Allow skip - don't block onboarding

---

## Implementation Priority

### Week 1: Sample SMS Collection
**Why First**: 
- Highest user experience impact
- Eliminates manual pattern creation
- Can use existing pattern generation logic
- No external dependencies

**Tasks**:
1. Add sample SMS collection step to onboarding
2. Create backend APIs for analysis and confirmation
3. Add pattern preview UI
4. Test with real SMS samples

### Week 2: AI Integration
**Why Second**:
- Enhances sample SMS analysis
- Provides fallback for edge cases
- Can be added incrementally

**Tasks**:
1. Set up OpenAI API
2. Implement LLM extraction function
3. Integrate as fallback in pipeline
4. Add caching and cost monitoring

---

## Cost Analysis

### Sample SMS Collection
- **Cost**: $0 (uses existing infrastructure)
- **Benefit**: Eliminates manual work, improves UX

### AI Integration
- **Cost**: ~$0.15-$3/day for 1000 SMS (if 10% need LLM)
- **Benefit**: Handles edge cases automatically
- **ROI**: Very high - reduces support costs, improves accuracy

---

## Next Steps

1. **Review this document** with your team
2. **Prioritize** based on your needs:
   - If user onboarding is pain point → Start with Sample SMS Collection
   - If edge cases are problem → Start with AI Integration
3. **Start implementation** with Sample SMS Collection (Week 1)
4. **Add AI integration** as enhancement (Week 2)

---

## Questions?

- **Which AI provider?** → Start with OpenAI GPT-4o-mini (cheapest, reliable)
- **When to use AI?** → As fallback when rule-based confidence < 50%
- **How many samples?** → 1-2 samples per user (incoming + optional outgoing)
- **What if analysis fails?** → Allow manual pattern creation as fallback

