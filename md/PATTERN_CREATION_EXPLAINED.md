# Pattern Creation - How It Works

## 📝 User Input for Pattern Creation

### **Regular Pattern Creation** (Dashboard/API)
**Endpoint:** `POST /api/patterns`

**User Provides:**
1. **`smsText`** (required) - The SMS message text to analyze
2. **`name`** (required) - A name for the pattern (e.g., "M-Pesa Receive")
3. **`description`** (optional) - Description of the pattern

**Example Request:**
```json
{
  "smsText": "You have received ETB 1,000.00 from John Doe. Transaction number is CK660DRZ8I. Thank you for using Telebirr.",
  "name": "Telebirr Receive",
  "description": "Pattern for receiving money via Telebirr"
}
```

### **Onboarding Pattern Creation** (Mobile App)
**Endpoint:** `POST /api/patterns/create-from-sample`

**User Provides:**
1. **`institution`** (required) - Institution name/phone number
2. **`countryCode`** (required) - ISO country code (e.g., "ET", "KE")
3. **`smsText`** (required) - The SMS message text
4. **`txnId`** (required) - User-provided transaction ID for validation

**Example Request:**
```json
{
  "institution": "Telebirr",
  "countryCode": "ET",
  "smsText": "You have received ETB 1,000.00 from John Doe. Transaction number is CK660DRZ8I.",
  "txnId": "CK660DRZ8I"
}
```

---

## 🤖 Does AI Create the Pattern?

### **Two Different Methods:**

#### **1. Regular Pattern Creation (Dashboard) - NO AI, Rule-Based**
- **Method:** `generatePatternFromSMS()` in `patternAI.ts`
- **Type:** Keyword-based, rule-based extraction
- **How it works:**
  - Uses regex patterns to find transaction ID, amount, sender
  - Detects currency and bank from keywords
  - Builds a flexible regex pattern
  - **Does NOT use AI/LLM**
  - **Does NOT require API keys**

**Code Location:** `backend/src/utils/patternAI.ts`

#### **2. Onboarding Pattern Creation (Mobile App) - YES, Uses AI**
- **Method:** `createPatternFromSample()` in `patternController.ts`
- **Type:** AI-powered (Google Gemini)
- **How it works:**
  1. Uses Gemini AI to extract transaction data from SMS
  2. Validates extracted transaction ID against user-provided ID
  3. Uses Gemini AI to generate regex pattern
  4. Creates `InstitutionPattern` in database
  - **REQUIRES `GEMINI_API_KEY` in .env**

**Code Location:** `backend/src/controllers/patternController.ts` (lines 429-530)
**AI Functions:** `backend/src/utils/llmExtractor.ts`

---

## 🔑 AI Configuration

### **Required for Onboarding Pattern Creation:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite-preview-06-17
```

### **Optional AI Providers:**
```env
# AI Provider Selection
AI_PROVIDER=auto  # or 'gemini', 'openai', 'huggingface', 'ollama'

# Google Gemini (Recommended - Free tier available)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite-preview-06-17

# OpenAI (Optional)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Hugging Face (Optional)
HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=meta-llama/Llama-3-8B-Instruct

# Ollama (Optional - Local, 100% free)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

---

## 🔄 Pattern Creation Flow

### **Flow 1: Dashboard Pattern Creation (No AI)**
```
User provides SMS text + name
    ↓
generatePatternFromSMS() - Rule-based extraction
    ↓
Extracts: txnId, amount, sender, bank, currency
    ↓
Builds regex pattern
    ↓
Validates pattern
    ↓
Saves to database (User Pattern)
```

### **Flow 2: Onboarding Pattern Creation (With AI)**
```
User provides SMS + transaction ID
    ↓
extractTxnIdWithLLM() - Gemini AI extracts data
    ↓
Validates: extracted txnId === user-provided txnId
    ↓
generatePatternFromLLM() - Gemini AI generates regex
    ↓
Validates pattern
    ↓
Saves to database (InstitutionPattern - shared)
```

---

## 📊 Pattern Types

### **1. User Pattern** (`Pattern` model)
- Created by users via dashboard
- Rule-based (no AI)
- User-specific
- FREE users: max 4 patterns
- PREMIUM users: unlimited

### **2. Institution Pattern** (`InstitutionPattern` model)
- Created during onboarding
- AI-powered (Gemini)
- Shared across all users in country
- Auto-verified after creation
- Used by mobile app for matching

---

## ✅ Current Status

### **Your Environment:**
- ✅ Regular pattern creation works **WITHOUT** AI keys (rule-based)
- ❌ Onboarding pattern creation **REQUIRES** `GEMINI_API_KEY` in .env
- Your other dev has the key, so onboarding works on their setup

### **What Works Without AI Keys:**
- ✅ Dashboard pattern creation (`POST /api/patterns`)
- ✅ Pattern validation (`POST /api/patterns/validate`)
- ✅ Pattern management (CRUD operations)

### **What Requires AI Keys:**
- ❌ Onboarding pattern creation (`POST /api/patterns/create-from-sample`)
- ❌ LLM-based transaction extraction (`extractTxnIdWithLLM()`)

---

## 🛠️ How to Check Your Setup

### **Check if AI keys are configured:**
```bash
cd backend
grep -E "GEMINI|OPENAI|HUGGINGFACE|OLLAMA" .env
```

### **Test Gemini (if key exists):**
```bash
cd backend
npx tsx test-gemini.ts
```

### **Test Pattern Creation (No AI needed):**
```bash
# This works without AI keys
curl -X POST http://localhost:3000/api/patterns \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "smsText": "You received ETB 1,000.00. Transaction number is CK660DRZ8I.",
    "name": "Test Pattern"
  }'
```

---

## 💡 Summary

1. **Regular pattern creation** = Rule-based, NO AI needed ✅
2. **Onboarding pattern creation** = AI-powered (Gemini), REQUIRES API key ❌
3. Your other dev has the key, so onboarding works for them
4. You can still create patterns via dashboard without AI keys
5. To enable onboarding, add `GEMINI_API_KEY` to your `.env` file


