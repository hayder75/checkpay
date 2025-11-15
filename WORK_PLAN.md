# CheckPay Implementation Work Plan

## Overview

This work plan covers the complete implementation of CheckPay's transaction ID extraction system, including pattern storage, mobile app onboarding, and merchant verification flow.

## Complete User Flow Summary

### Mobile App Onboarding Flow

```
1. App Install
   ↓
2. Permission Request (SMS permission + description)
   ↓
3. Country Detection (Auto-detect or manual)
   ↓
4. SMS Scanning (Mobile app only, no backend)
   - Scan last 200-500 SMS
   - Filter financial SMS using keywords
   - Extract sender addresses
   ↓
5. Institution Selection
   - List financial SMS senders
   - User selects ONE institution
   ↓
6. Pattern Existence Check (Backend API)
   ├─ Pattern EXISTS?
   │  ├─ YES → Skip sample SMS, proceed to registration
   │  └─ NO → Continue to sample SMS collection
   ↓
7. Sample SMS Collection (Only if pattern doesn't exist)
   - User provides SMS text (multiline)
   - User provides Transaction ID (separate field, for cross-checking)
   ↓
8. Pattern Recognition & Validation
   - Backend tries pattern recognition first (rule-based)
   - If fails: Use OpenAI API
   - Extract transaction ID from SMS
   - Cross-check: Compare extracted ID with user-provided ID
   - If match: Create InstitutionPattern, proceed to registration
   - If no match: Show error, allow retry
   ↓
9. Registration
   - Email input
   - OTP verification
   - Complete registration
   - Link user pattern to account
   ↓
10. Main App (SMS monitoring active)
```

### Merchant Verification Flow

```
Customer Payment:
1. Customer pays via banking app
2. Customer receives SMS with transaction ID
3. Customer gives transaction ID to merchant

Merchant Verification (Two Options):

Option A: Merchant has system
- Merchant's system calls: GET /api/verify?key=API_KEY&txn=TRANSACTION_ID
- Returns: { confirmed: true/false, amount, sender, bank, etc. }

Option B: Merchant doesn't have system
- Customer visits: https://checkpay.com/verify/:merchantId
- Customer pastes transaction ID
- System verifies and shows result
```

### Key Design Decisions

1. **Pattern Storage**: Store patterns per institution (not per user)
   - If pattern exists for institution → Don't ask user for sample SMS
   - If pattern doesn't exist → Ask user for sample SMS + transaction ID

2. **Transaction ID Cross-Checking**: User provides transaction ID in separate field
   - Not extracted from SMS
   - Used to verify pattern recognition/LLM extraction accuracy
   - Ensures pattern works correctly before saving

3. **Pattern Recognition Priority**:
   - First: Try rule-based extraction (fast, free)
   - Fallback: Use OpenAI API (if rule-based fails or low confidence)

4. **SMS Scanning**: Mobile app only (no backend involvement)
   - Faster, works offline
   - Privacy-friendly (SMS stays on device)
   - Only sends selected institution to backend

---

## System Architecture

### Key Components

1. **Pattern Database**: Store identified patterns per institution
2. **Mobile App**: SMS scanning, pattern detection, onboarding
3. **Backend API**: Pattern lookup, pattern creation, payment verification
4. **Merchant Portal**: Web interface for merchants without systems

---

## Database Schema Updates

### Pattern Storage (Institution-Based)

**Key Design Decision**: Store patterns per institution (not per user) to avoid asking users for patterns if they already exist.

```prisma
model InstitutionPattern {
  id            String   @id @default(cuid())
  institution   String   // e.g., "M-Pesa", "Telebirr", "CBE" (sender phone number or name)
  countryCode   String   // ISO country code (e.g., "ET", "KE")
  regex         String   // Pattern regex
  extractFields Json     // { amount: 1, sender: 2, txnId: 3, bank: 4 }
  bank          String?  // Bank name
  currency      String?  // Currency code
  smsExample    String?  // Example SMS for reference
  txnIdExample  String?  // Example transaction ID used for validation
  isVerified    Boolean  @default(false) // Verified by admin
  usageCount    Int      @default(0) // How many users use this pattern
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([institution, countryCode])
  @@index([institution])
  @@index([countryCode])
  @@index([isVerified])
}

model UserInstitution {
  id            String   @id @default(cuid())
  userId        String
  institution   String   // User's selected institution (sender phone number)
  patternId     String?  // Reference to InstitutionPattern (if exists)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  pattern InstitutionPattern? @relation(fields: [patternId], references: [id], onDelete: SetNull)

  @@unique([userId, institution])
  @@index([userId])
  @@index([institution])
}
```

**Note**: The existing `Pattern` model can remain for user-created custom patterns, but `InstitutionPattern` is the primary source for institution-based patterns.

---

## Implementation Phases

## Phase 1: Database & Backend Foundation (Week 1)

### 1.1 Database Schema Updates

**Tasks**:
- [ ] Create `InstitutionPattern` model in Prisma schema
- [ ] Create `UserPattern` model in Prisma schema
- [ ] Run migration: `npx prisma migrate dev --name add_institution_patterns`
- [ ] Seed initial patterns for common institutions (M-Pesa, Telebirr, etc.)

**Files**:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/`
- `backend/src/utils/seedPatterns.ts` (new)

---

### 1.2 Backend APIs - Pattern Lookup

**Tasks**:
- [ ] Create `GET /api/patterns/institution/:institution?country=:countryCode`
  - Check if pattern exists for institution in country
  - Return pattern if exists, null if not
- [ ] Create `GET /api/patterns/institutions?country=:countryCode`
  - List all institutions with patterns for a country
- [ ] Add pattern caching (Redis or in-memory)

**Files**:
- `backend/src/controllers/patternController.ts` (update)
- `backend/src/routes/patterns.ts` (update)

**API Response Example**:
```typescript
// GET /api/patterns/institution/M-Pesa?country=KE
{
  "success": true,
  "data": {
    "exists": true,
    "pattern": {
      "id": "pattern_123",
      "institution": "M-Pesa",
      "regex": "...",
      "extractFields": {...}
    }
  }
}
```

---

### 1.3 Backend APIs - Pattern Creation

**Tasks**:
- [ ] Create `POST /api/patterns/create-from-sample`
  - Accept: `{ institution, countryCode, smsText, txnId }`
  - Try pattern recognition first
  - Fallback to OpenAI if needed
  - Create InstitutionPattern if verified
  - Return created pattern

**Files**:
- `backend/src/controllers/patternController.ts` (update)
- `backend/src/utils/patternRecognition.ts` (new)
- `backend/src/utils/llmExtractor.ts` (new)

**API Request Example**:
```typescript
POST /api/patterns/create-from-sample
{
  "institution": "M-Pesa",
  "countryCode": "KE",
  "smsText": "You have received KES 500.00 from John Doe. Ref: MP123456789",
  "txnId": "MP123456789" // For cross-checking
}
```

---

## Phase 2: Mobile App - Onboarding Flow (Week 2)

### 2.1 Permission & Country Detection

**Tasks**:
- [ ] SMS permission request screen
  - Explain why permission is needed
  - Show Google Play compliance message
- [ ] Country detection
  - Auto-detect from SIM/locale
  - Fallback: manual selection
- [ ] Store country in local storage

**Files**:
- `mobile-app/src/screens/OnboardingScreen.tsx` (update)
- `mobile-app/src/utils/simInfo.ts` (update)

**Flow**:
```
1. App Launch
2. Permission Screen → Request SMS Permission
3. Country Detection → Auto-detect or Manual
```

---

### 2.2 SMS Scanning & Financial Message Detection

**Tasks**:
- [ ] Scan SMS messages (last 200-500)
- [ ] Filter financial SMS using keywords
- [ ] Extract sender addresses (phone numbers)
- [ ] Group by sender
- [ ] Display list of financial SMS senders

**Files**:
- `mobile-app/src/utils/smsReader.ts` (update)
- `mobile-app/src/utils/smsUtils.ts` (update)
- `mobile-app/src/screens/OnboardingScreen.tsx` (update)

**Implementation**:
```typescript
const scanFinancialSMS = async () => {
  const smsMessages = await readSMSMessages(500);
  
  // Filter financial SMS
  const financialSMS = smsMessages.filter(sms => 
    detectFinancialSMS(sms.body)
  );
  
  // Group by sender
  const senders = new Map<string, {
    address: string;
    count: number;
    lastMessage: string;
    institution?: string;
  }>();
  
  financialSMS.forEach(sms => {
    const existing = senders.get(sms.address) || {
      address: sms.address,
      count: 0,
      lastMessage: sms.body,
    };
    existing.count++;
    senders.set(sms.address, existing);
  });
  
  return Array.from(senders.values());
};
```

---

### 2.3 Institution Selection

**Tasks**:
- [ ] Display list of financial SMS senders
- [ ] Allow user to select ONE institution (important: only one at a time)
- [ ] Show sender phone number and message count
- [ ] Try to detect institution name from SMS content
- [ ] Store selected institution (phone number or detected name)

**Files**:
- `mobile-app/src/screens/OnboardingScreen.tsx` (update)
- `mobile-app/src/utils/smsUtils.ts` (update)

**UI Flow**:
```
Financial SMS Senders:

Select ONE institution to set up:

┌─────────────────────────────┐
│ 📱 +254712345678            │
│ M-Pesa (detected)           │
│ 15 messages                 │
│ [Select]                    │
└─────────────────────────────┘
┌─────────────────────────────┐
│ 📱 +251911234567            │
│ Telebirr (detected)         │
│ 8 messages                  │
│ [Select]                    │
└─────────────────────────────┘

Note: You can add more institutions later in Settings
```

**Implementation**:
```typescript
const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);

const handleInstitutionSelect = async (institution: string) => {
  setSelectedInstitution(institution);
  
  // Check if pattern exists for this institution
  await checkPatternExists(institution, countryCode);
};
```

---

### 2.4 Pattern Existence Check

**Tasks**:
- [ ] Call backend API: `GET /api/patterns/institution/:institution?country=:countryCode`
  - Institution can be phone number (e.g., "+254712345678") or detected name (e.g., "M-Pesa")
- [ ] If pattern exists:
  - Store pattern locally
  - **Skip sample SMS collection** (don't bother user)
  - Proceed directly to registration
- [ ] If pattern doesn't exist:
  - Show sample SMS input screen
  - Ask for SMS text AND transaction ID (separate fields)

**Files**:
- `mobile-app/src/screens/OnboardingScreen.tsx` (update)
- `mobile-app/src/services/api.ts` (update)

**Flow**:
```typescript
const checkPatternExists = async (institution: string, countryCode: string) => {
  // Normalize institution (could be phone number or name)
  const normalizedInstitution = normalizeInstitution(institution);
  
  const response = await api.get(
    `/patterns/institution/${encodeURIComponent(normalizedInstitution)}?country=${countryCode}`
  );
  
  if (response.data.exists) {
    // ✅ Pattern exists - don't bother user, proceed to registration
    await storage.savePattern(response.data.pattern);
    await storage.saveSelectedInstitution(institution);
    navigateToRegistration(); // Skip sample SMS screen
  } else {
    // ❌ Pattern doesn't exist - ask for sample SMS + transaction ID
    await storage.saveSelectedInstitution(institution);
    navigateToSampleSMS(); // Show sample SMS collection screen
  }
};
```

---

### 2.5 Sample SMS Collection (If Pattern Doesn't Exist)

**Tasks**:
- [ ] Create sample SMS input screen
- [ ] **Two separate fields** (important for cross-checking):
  - SMS Text (multiline textarea)
  - Transaction ID (single line input - for verification)
- [ ] Submit to backend for pattern creation
- [ ] Backend tries pattern recognition first
- [ ] If pattern recognition fails, use OpenAI API
- [ ] Cross-check extracted transaction ID with user-provided ID
- [ ] Show validation results

**Files**:
- `mobile-app/src/screens/SampleSMSScreen.tsx` (new)
- `mobile-app/src/screens/OnboardingScreen.tsx` (update)

**UI**:
```
Sample SMS Collection

Institution: M-Pesa (+254712345678)
Country: Kenya

We need a sample SMS to create a pattern for this institution.

SMS Text:
┌─────────────────────────────┐
│ You have received KES       │
│ 500.00 from John Doe.       │
│ Ref: MP123456789            │
│                             │
└─────────────────────────────┘

Transaction ID (for verification):
┌─────────────────────────────┐
│ MP123456789                 │
└─────────────────────────────┘

💡 We'll use the transaction ID to verify our extraction works correctly.

[Analyze Pattern]
```

**Key Points**:
- Transaction ID is in a **separate field** (not extracted from SMS)
- User provides transaction ID manually for cross-checking
- This ensures pattern recognition/LLM extraction is accurate

---

### 2.6 Pattern Recognition & Validation

**Tasks**:
- [ ] Call backend: `POST /api/patterns/create-from-sample`
- [ ] Backend flow:
  1. **First**: Try pattern recognition (rule-based extraction)
  2. **If fails or low confidence**: Use OpenAI API
  3. Extract transaction ID from SMS
  4. **Cross-check**: Compare extracted ID with user-provided ID
  5. If match: Create InstitutionPattern and return success
  6. If no match: Return error, allow retry
- [ ] Show validation results to user
- [ ] If successful: Store pattern and proceed to registration

**Files**:
- `mobile-app/src/screens/SampleSMSScreen.tsx` (update)
- `backend/src/controllers/patternController.ts` (update)

**Backend Implementation**:
```typescript
// POST /api/patterns/create-from-sample
export async function createPatternFromSample(req: Request, res: Response) {
  const { institution, countryCode, smsText, txnId } = req.body;
  
  // Step 1: Try pattern recognition (rule-based)
  let extractedTxnId: string | null = null;
  let pattern: GeneratedPattern | null = null;
  
  // Try rule-based extraction first
  const ruleBased = await recognizePattern(smsText, txnId);
  
  if (ruleBased.success && ruleBased.extractedTxnId === txnId) {
    // ✅ Rule-based worked and matches user-provided ID
    pattern = ruleBased.pattern!;
    extractedTxnId = ruleBased.extractedTxnId;
  } else {
    // Step 2: Try OpenAI API
    const llmResult = await extractTxnIdWithLLM(smsText);
    
    if (llmResult.txnId === txnId) {
      // ✅ LLM worked and matches user-provided ID
      pattern = generatePatternFromLLM(smsText, llmResult);
      extractedTxnId = llmResult.txnId;
    } else {
      // ❌ Both failed or don't match
      return res.status(400).json({
        success: false,
        error: 'Could not extract transaction ID. Please check your SMS and transaction ID.',
        extractedTxnId: llmResult.txnId || ruleBased.extractedTxnId,
        expectedTxnId: txnId,
      });
    }
  }
  
  // Step 3: Create InstitutionPattern
  const institutionPattern = await prisma.institutionPattern.create({
    data: {
      institution,
      countryCode,
      regex: pattern.regex,
      extractFields: pattern.extractFields,
      bank: pattern.bank,
      currency: pattern.currency,
      smsExample: smsText,
      txnIdExample: txnId,
      isVerified: false, // Admin can verify later
    },
  });
  
  // Step 4: Return success
  res.json({
    success: true,
    data: {
      pattern: institutionPattern,
      extractedTxnId,
      validated: true,
    },
  });
}
```

**Mobile App Validation**:
```typescript
const validatePattern = async (smsText: string, userTxnId: string) => {
  setLoading(true);
  
  try {
    const response = await api.post('/patterns/create-from-sample', {
      institution: selectedInstitution,
      countryCode: userCountry,
      smsText,
      txnId: userTxnId,
    });
    
    if (response.data.success && response.data.data.validated) {
      // ✅ Validation successful - transaction IDs match
      await storage.savePattern(response.data.data.pattern);
      showSuccess("Pattern verified! Transaction ID matches.");
      proceedToRegistration();
    } else {
      // ❌ Validation failed
      showError(
        `Transaction ID doesn't match.\n` +
        `Expected: ${userTxnId}\n` +
        `Extracted: ${response.data.extractedTxnId || 'Not found'}`
      );
      // Allow user to retry or edit
    }
  } catch (error) {
    showError("Failed to create pattern. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

---

### 2.7 Registration Flow

**Tasks**:
- [ ] Email input
- [ ] OTP verification
- [ ] Complete registration
- [ ] Link user pattern to account
- [ ] Navigate to main app

**Files**:
- `mobile-app/src/screens/RegisterScreen.tsx` (update)
- `mobile-app/src/screens/VerifyOTPScreen.tsx` (update)

**Flow**:
```
Registration:
1. Email Input
2. Send OTP
3. Verify OTP
4. Create Account
5. Link Pattern to User
6. Navigate to Dashboard
```

---

## Phase 3: Backend - Pattern Recognition (Week 3)

### 3.1 Pattern Recognition Engine

**Tasks**:
- [ ] Create pattern recognition function
- [ ] Try multiple extraction methods:
  1. URL extraction
  2. Enhanced pattern matching
  3. Context-aware extraction
  4. Bank-specific extractors
- [ ] Return confidence score
- [ ] If confidence < 50%, use OpenAI

**Files**:
- `backend/src/utils/patternRecognition.ts` (new)
- `backend/src/utils/extractFromSMS.ts` (update)
- `backend/src/utils/flexibleExtractor.ts` (update)

**Implementation**:
```typescript
export async function recognizePattern(
  smsText: string,
  userTxnId: string
): Promise<{
  success: boolean;
  pattern?: GeneratedPattern;
  extractedTxnId?: string;
  confidence: number;
  method: 'rule-based' | 'llm';
}> {
  // Stage 1: Try rule-based extraction
  const ruleBased = extractTxnIdEnhanced(smsText);
  
  if (ruleBased && ruleBased.confidence > 0.8) {
    // Validate with user-provided transaction ID
    if (ruleBased.txnId === userTxnId) {
      return {
        success: true,
        pattern: generatePatternFromSMS(smsText, 'Pattern'),
        extractedTxnId: ruleBased.txnId,
        confidence: ruleBased.confidence,
        method: 'rule-based',
      };
    }
  }
  
  // Stage 2: Try URL extraction
  const urlBased = extractTxnIdFromURL(smsText);
  if (urlBased === userTxnId) {
    return {
      success: true,
      pattern: generatePatternFromSMS(smsText, 'Pattern'),
      extractedTxnId: urlBased,
      confidence: 0.9,
      method: 'rule-based',
    };
  }
  
  // Stage 3: Use LLM if rule-based failed or low confidence
  if (!ruleBased || ruleBased.confidence < 0.5) {
    const llmResult = await extractTxnIdWithLLM(smsText);
    
    if (llmResult.txnId === userTxnId) {
      return {
        success: true,
        pattern: generatePatternFromLLM(smsText, llmResult),
        extractedTxnId: llmResult.txnId,
        confidence: llmResult.confidence,
        method: 'llm',
      };
    }
  }
  
  return {
    success: false,
    confidence: 0,
    method: 'rule-based',
  };
}
```

---

### 3.2 OpenAI Integration

**Tasks**:
- [ ] Set up OpenAI API client
- [ ] Create LLM extraction function
- [ ] Use structured output/function calling
- [ ] Add error handling and retries
- [ ] Add cost tracking

**Files**:
- `backend/src/utils/llmExtractor.ts` (new)
- `backend/package.json` (add openai package)
- `backend/.env` (add OPENAI_API_KEY)

**Implementation**:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractTxnIdWithLLM(
  smsText: string
): Promise<{
  txnId: string | null;
  amount: number | null;
  bank: string | null;
  currency: string | null;
  confidence: number;
}> {
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
          },
          required: ['txnId']
        }
      }
    }],
    tool_choice: { type: 'function', function: { name: 'extract_transaction_details' } }
  });

  const result = JSON.parse(
    response.choices[0].message.tool_calls?.[0]?.function.arguments || '{}'
  );

  return {
    txnId: result.txnId || null,
    amount: result.amount || null,
    bank: result.bank || null,
    currency: result.currency || null,
    confidence: result.txnId ? 0.8 : 0,
  };
}
```

---

## Phase 4: Merchant Verification System (Week 4)

### 4.1 Payment Verification API

**Tasks**:
- [ ] Create `GET /api/verify?key=:apiKey&txn=:transactionId`
- [ ] Look up transaction in database
- [ ] Return payment status and details
- [ ] Add rate limiting
- [ ] Add usage tracking

**Files**:
- `backend/src/controllers/txnController.ts` (update)
- `backend/src/routes/verify.ts` (update)

**API Response**:
```typescript
// GET /api/verify?key=api_key_123&txn=MP123456789
{
  "success": true,
  "data": {
    "confirmed": true,
    "amount": 500.00,
    "currency": "KES",
    "sender": "+254712345678",
    "bank": "M-Pesa",
    "receivedAt": "2025-01-15T10:30:00Z",
    "txnId": "MP123456789"
  }
}

// If not found
{
  "success": true,
  "data": {
    "confirmed": false,
    "message": "Transaction not found"
  }
}
```

---

### 4.2 Merchant Portal (Web Interface)

**Tasks**:
- [ ] Create merchant verification page
- [ ] Unique URL per merchant: `/verify/:merchantId`
- [ ] Simple form: Transaction ID input
- [ ] Call verification API
- [ ] Display results

**Files**:
- `dashboard/src/pages/merchant/VerifyPage.tsx` (new)
- `dashboard/src/routes/merchant.ts` (new)

**UI**:
```
Merchant Payment Verification

Enter Transaction ID:
┌─────────────────────────────┐
│ MP123456789                 │
└─────────────────────────────┘

[Verify Payment]

Results:
✅ Payment Confirmed
Amount: KES 500.00
Received: 2025-01-15 10:30 AM
```

---

### 4.3 Merchant API Key Management

**Tasks**:
- [ ] Generate API keys for merchants
- [ ] Merchant dashboard to view API key
- [ ] Usage statistics
- [ ] Rate limit management

**Files**:
- `backend/src/controllers/merchantController.ts` (new)
- `dashboard/src/pages/merchant/DashboardPage.tsx` (new)

---

## Phase 5: Real-Time SMS Processing (Week 5)

### 5.1 SMS Monitoring

**Tasks**:
- [ ] Monitor incoming SMS in real-time
- [ ] Filter financial SMS
- [ ] Extract transaction details using user's pattern
- [ ] Store in local database
- [ ] Sync to backend (if authenticated)

**Files**:
- `mobile-app/src/utils/smsMonitor.ts` (new)
- `mobile-app/src/services/smsService.ts` (update)

**Implementation**:
```typescript
// Monitor SMS in background
const monitorSMS = async () => {
  // Listen for new SMS
  SmsListener.addListener((sms) => {
    if (detectFinancialSMS(sms.body)) {
      // Get user's pattern
      const pattern = await storage.getUserPattern();
      
      // Extract transaction
      const transaction = matchPattern(sms.body, pattern);
      
      if (transaction.matched) {
        // Store locally
        await storage.saveTransaction(transaction.data);
        
        // Sync to backend if authenticated
        if (apiKey) {
          await syncTransactionToBackend(transaction.data);
        }
      }
    }
  });
};
```

---

### 5.2 Transaction Storage

**Tasks**:
- [ ] Local database for transactions (SQLite/AsyncStorage)
- [ ] Store: txnId, amount, sender, bank, receivedAt
- [ ] Sync to backend when authenticated
- [ ] Handle conflicts

**Files**:
- `mobile-app/src/services/storage.ts` (update)
- `mobile-app/src/types.ts` (update)

---

## Phase 6: Testing & Optimization (Week 6)

### 6.1 Unit Tests

**Tasks**:
- [ ] Test pattern recognition
- [ ] Test transaction ID extraction
- [ ] Test LLM fallback
- [ ] Test verification API

**Files**:
- `backend/src/utils/__tests__/patternRecognition.test.ts` (new)
- `backend/src/utils/__tests__/llmExtractor.test.ts` (new)

---

### 6.2 Integration Tests

**Tasks**:
- [ ] Test complete onboarding flow
- [ ] Test pattern creation flow
- [ ] Test verification flow
- [ ] Test SMS monitoring

---

### 6.3 Performance Optimization

**Tasks**:
- [ ] Optimize SMS scanning (batch processing)
- [ ] Add caching for patterns
- [ ] Optimize LLM calls (cache similar SMS)
- [ ] Add rate limiting

---

## File Structure Summary

### New Files to Create

**Backend**:
- `backend/src/utils/patternRecognition.ts`
- `backend/src/utils/llmExtractor.ts`
- `backend/src/controllers/merchantController.ts`
- `backend/src/utils/seedPatterns.ts`

**Mobile App**:
- `mobile-app/src/screens/SampleSMSScreen.tsx`
- `mobile-app/src/utils/smsMonitor.ts`
- `mobile-app/src/services/smsService.ts`

**Dashboard**:
- `dashboard/src/pages/merchant/VerifyPage.tsx`
- `dashboard/src/pages/merchant/DashboardPage.tsx`

### Files to Update

**Backend**:
- `backend/prisma/schema.prisma`
- `backend/src/controllers/patternController.ts`
- `backend/src/controllers/txnController.ts`
- `backend/src/routes/patterns.ts`
- `backend/src/routes/verify.ts`
- `backend/src/utils/extractFromSMS.ts`
- `backend/src/utils/flexibleExtractor.ts`

**Mobile App**:
- `mobile-app/src/screens/OnboardingScreen.tsx`
- `mobile-app/src/screens/RegisterScreen.tsx`
- `mobile-app/src/utils/smsReader.ts`
- `mobile-app/src/utils/smsUtils.ts`
- `mobile-app/src/services/api.ts`
- `mobile-app/src/services/storage.ts`

---

## Environment Variables

### Backend (.env)
```
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
REDIS_URL=redis://... (optional, for caching)
```

### Mobile App (.env)
```
API_BASE_URL=https://api.checkpay.com
```

---

## Success Metrics

### Phase 1-2 (Onboarding)
- [ ] Pattern lookup API response time < 200ms
- [ ] SMS scanning completes in < 5 seconds
- [ ] Onboarding completion rate > 80%

### Phase 3 (Pattern Recognition)
- [ ] Pattern recognition accuracy > 90%
- [ ] LLM fallback used < 10% of time
- [ ] Pattern validation success rate > 95%

### Phase 4 (Verification)
- [ ] Verification API response time < 100ms
- [ ] API uptime > 99.9%
- [ ] False positive rate < 1%

---

## Timeline

- **Week 1**: Database & Backend Foundation
- **Week 2**: Mobile App Onboarding
- **Week 3**: Pattern Recognition Engine
- **Week 4**: Merchant Verification System
- **Week 5**: Real-Time SMS Processing
- **Week 6**: Testing & Optimization

**Total**: 6 weeks

---

## Next Steps

1. Review this work plan
2. Set up development environment
3. Start with Phase 1 (Database & Backend Foundation)
4. Iterate based on testing and feedback

