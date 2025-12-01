# Quick Start Guide - New Implementation

## What's Been Implemented

The work plan has been implemented with the following features:

### ✅ Phase 1: Database & Backend
- Institution-based pattern storage
- Pattern lookup API
- Pattern creation from sample SMS
- URL extraction support
- LLM integration (OpenAI)

### ✅ Phase 2: Mobile App Onboarding
- SMS scanning and grouping by sender
- Institution selection (one at a time)
- Pattern existence check
- Sample SMS collection screen
- Transaction ID cross-checking

### ✅ Phase 3: Pattern Recognition
- Multi-stage extraction engine
- Rule-based + LLM fallback

### ✅ Phase 4: Merchant Verification
- Verification API (already existed)
- Merchant portal web interface

---

## Setup Instructions

### 1. Database Migration

```bash
cd backend
npx prisma migrate dev --name add_institution_patterns
npx prisma generate
```

### 2. Install AI Provider (Optional - for LLM extraction)

**Option A: Hugging Face (FREE - Recommended for Development)**
1. Sign up at https://huggingface.co/
2. Get your API token (Settings → Access Tokens)
3. No npm install needed - uses native fetch

**Option B: OpenAI**
```bash
cd backend
npm install openai
```

**Option C: Ollama (Local - 100% Free)**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3
```

### 3. Environment Variables

Add to `backend/.env`:
```env
# Choose one or more AI providers (auto-detects if multiple are set)
AI_PROVIDER=auto  # or 'huggingface', 'openai', 'ollama'

# Hugging Face (FREE - Recommended)
HUGGINGFACE_API_KEY=hf_... (get from https://huggingface.co/settings/tokens)
HUGGINGFACE_MODEL=meta-llama/Llama-3-8B-Instruct (optional)

# OpenAI (has free credits for new accounts)
OPENAI_API_KEY=sk-... (optional)
OPENAI_MODEL=gpt-4o-mini (optional, defaults to gpt-4o-mini)

# Ollama (Local - 100% Free)
OLLAMA_URL=http://localhost:11434 (optional, defaults to localhost)
OLLAMA_MODEL=llama3 (optional, defaults to llama3)
```

**Note:** The system will automatically try providers in order: Hugging Face → OpenAI → Ollama. See `FREE_AI_API_OPTIONS.md` for details.

### 4. Start Servers

```bash
# Backend
cd backend
npm run dev

# Dashboard
cd dashboard
npm run dev

# Mobile App
cd mobile-app
npm start
```

---

## Testing the Flow

### 1. Mobile App Onboarding

1. Install and launch the app
2. Grant SMS permission
3. Select country
4. App scans SMS and shows senders
5. Select ONE institution
6. **If pattern exists**: Goes to registration
7. **If pattern doesn't exist**: Shows sample SMS screen
8. Enter SMS text and transaction ID
9. System validates and creates pattern
10. Proceeds to registration

### 2. Pattern Creation

Test the sample SMS collection:
- Enter SMS text
- Enter transaction ID (for cross-checking)
- System tries rule-based extraction first
- Falls back to OpenAI if needed
- Validates extracted ID matches user-provided ID

### 3. Merchant Verification

**Option A: API** (for merchants with systems):
```
GET /api/verify?key=API_KEY&txn=TRANSACTION_ID
```

**Option B: Web Portal** (for merchants without systems):
```
https://your-domain.com/verify/:merchantId
```

---

## API Endpoints

### Pattern Lookup (No Auth)
```
GET /api/patterns/institution/:institution?country=:countryCode
```

### Pattern Creation (No Auth)
```
POST /api/patterns/create-from-sample
Body: {
  institution: string,
  countryCode: string,
  smsText: string,
  txnId: string
}
```

### Verification (API Key Auth)
```
GET /api/verify?key=API_KEY&txn=TRANSACTION_ID
```

---

## Known Limitations

1. **Merchant Portal API Key**: Currently uses placeholder. Need to implement merchant model and API key mapping.

2. **Real-Time SMS Processing**: Not yet implemented (Phase 5). SMS monitoring can be added later.

3. **Multiple Institutions**: Currently supports one institution at a time during onboarding. Users can add more later.

---

## Next Steps

1. Run migration and test the flow
2. Add merchant model for API key management
3. Implement real-time SMS monitoring (Phase 5)
4. Add comprehensive testing
5. Deploy to production

