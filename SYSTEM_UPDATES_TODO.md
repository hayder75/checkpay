# System Updates - TODO List

## 📋 Analysis: What Exists vs What's Needed

---

## ✅ **1. Global Pattern Storage (Shared Across All Users)**

### **What EXISTS:**
- ✅ `InstitutionPattern` model - Shared patterns per institution+country
- ✅ `CountryPattern` model - Country-wide templates
- ✅ Patterns are shared and can be used by multiple users

### **What's MISSING:**
- ❌ **No duplicate checking** before saving user patterns to global library
- ❌ **No automatic promotion** of user patterns to global library
- ❌ **No global pattern library endpoint** for browsing all patterns
- ❌ **No pattern similarity detection** to prevent near-duplicates

### **TODO:**
1. **Add duplicate detection logic** when user creates pattern
   - Check if similar pattern exists in `InstitutionPattern` or `CountryPattern`
   - Compare regex patterns (normalize and compare)
   - Check bank + currency + country combination
   - If duplicate found, link user to existing pattern instead of creating new

2. **Add pattern promotion system**
   - When user creates unique pattern, check if it should be promoted to global
   - Criteria: Pattern is unique, verified, and useful
   - Auto-promote to `InstitutionPattern` or `CountryPattern` based on usage

3. **Create global pattern library endpoint**
   - `GET /api/patterns/global` - List all global patterns
   - Filter by country, bank, currency
   - Show usage count, verification status
   - Allow users to "subscribe" to global patterns

4. **Add pattern similarity matching**
   - Function to compare two regex patterns
   - Detect if patterns are functionally equivalent (even if regex differs)
   - Prevent near-duplicates in global library

---

## ✅ **2. User-Specific Pattern Storage**

### **What EXISTS:**
- ✅ `Pattern` model - User-specific patterns
- ✅ Patterns linked to user via `userId`
- ✅ API endpoints for CRUD operations on user patterns

### **What's MISSING:**
- ❌ **No explicit "selected from global" tracking**
- ❌ **Pattern sync to mobile app** - Need to verify this works properly
- ❌ **No distinction** between user-created vs user-selected patterns

### **TODO:**
1. **Enhance pattern sync to mobile app**
   - Verify `/api/config` endpoint returns user patterns correctly
   - Ensure mobile app receives both:
     - User-created patterns
     - User-selected global patterns
   - Add endpoint to sync patterns when API key is used

2. **Add pattern source tracking**
   - Track if pattern was:
     - Created by user
     - Selected from global library
     - Added from template
   - Store source in `Pattern` model or separate tracking

3. **Create user pattern selection endpoint**
   - `POST /api/patterns/global/:patternId/select` - Add global pattern to user's list
   - Creates `UserPatternSubscription` or user `Pattern` entry
   - Syncs to mobile app automatically

---

## ⚠️ **3. AI Pattern Creation in Two Places**

### **What EXISTS:**
- ✅ AI pattern creation in onboarding (`createPatternFromSample`)
- ✅ Rule-based pattern creation in regular flow (`createPattern`)

### **What's MISSING:**
- ❌ **No AI in regular pattern creation** (`createPattern` endpoint)
- ❌ **No AI in dashboard pattern builder**
- ❌ **No AI in mobile app pattern builder**

### **TODO:**
1. **Update `createPattern` endpoint to use AI**
   - Modify `POST /api/patterns` to:
     - Try rule-based extraction first
     - If fails or low confidence, use AI (Gemini)
     - Generate pattern with AI
     - Save pattern
   - Remove transaction ID requirement (AI figures it out)

2. **Update dashboard pattern builder**
   - Add AI-powered pattern creation option
   - Show "AI Analysis" button
   - Display extracted values before saving

3. **Update mobile app pattern builder**
   - Same as dashboard - use AI when rule-based fails
   - Show extraction results

4. **Update pattern validation endpoint**
   - `POST /api/patterns/validate` should also use AI
   - Show AI-extracted values in preview

---

## ✅ **4. Backend Rule-Based Extraction (Free, Fast, No AI)**

### **What EXISTS:**
- ✅ `extractTxnIdEnhanced` - URL + rule-based extraction
- ✅ `extractTxnIdFromURL` - Extracts from URLs
- ✅ `extractTxnId` - Rule-based patterns
- ✅ `extractAmount`, `extractSender` - Rule-based extraction
- ✅ `patternRecognition.ts` - 3-stage process (URL → Rule-based → LLM)

### **What's MISSING:**
- ❌ **Not used in regular pattern creation** - Only in onboarding
- ❌ **No comprehensive extraction** - Only extracts txnId, not full pattern
- ❌ **No pattern generation from rule-based extraction**

### **TODO:**
1. **Create comprehensive rule-based pattern generator**
   - Function that extracts ALL fields (txnId, amount, sender, bank, currency)
   - Generates regex pattern from extracted data
   - Returns complete pattern object (like AI does)

2. **Integrate into pattern creation flow**
   - Update `createPattern` to:
     1. Try rule-based extraction first
     2. Generate pattern from rule-based extraction
     3. If successful, save pattern (no AI needed)
     4. If fails, fall back to AI

3. **Enhance URL extraction**
   - Handle more URL patterns
   - Extract from path segments: `/slip/?trx=FT251819GZ6C10104`
   - Handle different parameter names
   - Support partial URLs (just the link part)

---

## ⚠️ **5. AI Only as Last Option**

### **What EXISTS:**
- ✅ 3-stage process in `patternRecognition.ts` (URL → Rule-based → LLM)
- ✅ Used in onboarding flow

### **What's MISSING:**
- ❌ **Not implemented in regular pattern creation**
- ❌ **No global pattern check** before extraction
- ❌ **No user pattern check** before extraction

### **TODO:**
1. **Create smart pattern creation flow**
   ```
   User provides SMS
       ↓
   Check global patterns (InstitutionPattern, CountryPattern)
       ↓
   If match found → Use existing pattern (no extraction needed)
       ↓
   Check user's patterns
       ↓
   If match found → Use user's pattern
       ↓
   Try rule-based extraction
       ↓
   If successful → Generate pattern, save (no AI)
       ↓
   If fails → Use AI extraction
       ↓
   Generate pattern with AI, save
   ```

2. **Add pattern matching before extraction**
   - Function to match SMS against existing patterns
   - Check if SMS matches any global/user pattern
   - If match found, return existing pattern (no creation needed)

3. **Update `createPattern` endpoint**
   - Implement the smart flow above
   - Only call AI if all previous steps fail
   - Log which method was used (global/user/rule-based/AI)

---

## ⚠️ **6. URL/Link Pattern Extraction & Matching**

### **What EXISTS:**
- ✅ `extractTxnIdFromURL` - Extracts transaction ID from URLs
- ✅ Handles query params: `?txn=`, `?id=`, `?ref=`
- ✅ Handles path segments: `/txn/ABC123`

### **What's MISSING:**
- ❌ **No pattern generation from URL-only input**
   - User might send just the link: `https://cs.bankofabyssinia.com/slip/?trx=FT251819GZ6C10104`
   - Need to create pattern that extracts from URL
   - Need to match transactions when user sends just the link

- ❌ **No link-to-transaction matching**
   - When developer sends link, need to find matching transaction
   - Extract txnId from link, search transactions

### **TODO:**
1. **Create URL pattern generator**
   - Function that takes URL and creates regex pattern
   - Pattern should match SMS with that URL format
   - Extract txnId from URL parameter/path
   - Generate pattern that captures URL + txnId

2. **Add URL pattern support to pattern creation**
   - Allow user to provide just URL (not full SMS)
   - Extract txnId from URL
   - Generate pattern that matches SMS containing that URL format
   - Save pattern with URL extraction capability

3. **Create link-to-transaction matcher**
   - `POST /api/verify/link` - Accept URL, extract txnId, find transaction
   - Extract txnId from URL
   - Search transactions by txnId
   - Return transaction if found

4. **Enhance URL extraction**
   - Handle more URL formats:
     - `https://apps.cbe.com.et:100/?id=FT25315HZNYL59221741`
     - `https://cs.bankofabyssinia.com/slip/?trx=FT251819GZ6C10104`
   - Support different parameter names
   - Extract from path: `/slip/?trx=...`

---

## ❌ **7. Partial Transaction ID Matching**

### **What EXISTS:**
- ❌ **Nothing** - This is completely new

### **What's NEEDED:**
- Transaction IDs that share a common prefix should match
- Example:
  - Sender: `FT25315HZNYL59221741`
  - Receiver: `FT25315HZNYL50058423`
  - Common prefix: `FT25315HZNYL`
  - Should verify as same transaction

### **TODO:**
1. **Create partial transaction ID matcher**
   - Function to extract common prefix from two transaction IDs
   - Example: `FT25315HZNYL59221741` and `FT25315HZNYL50058423`
   - Common prefix: `FT25315HZNYL` (first 12 chars)
   - Match if common prefix length >= threshold (e.g., 8+ chars)

2. **Add partial matching to verification endpoint**
   - Update `GET /api/verify` to support partial matching
   - If exact match not found, try partial match
   - Check if any transaction has matching prefix
   - Return match if confidence is high enough

3. **Store transaction ID prefix**
   - Add `txnIdPrefix` field to `Transaction` model (optional)
   - Extract and store prefix when transaction is created
   - Index prefix for fast lookup

4. **Create prefix extraction logic**
   - Function to extract meaningful prefix from transaction ID
   - Handle different formats:
     - Fixed length prefix (e.g., first 12 chars)
     - Pattern-based (e.g., before first digit sequence)
   - Store prefix in database

5. **Add prefix matching to transaction search**
   - When searching transactions, also search by prefix
   - Support both exact and prefix matching
   - Return best match with confidence score

---

## 📊 Summary: Implementation Priority

### **High Priority (Core Features):**
1. ✅ AI in regular pattern creation (not just onboarding)
2. ✅ Rule-based extraction before AI in pattern creation
3. ✅ Global pattern duplicate checking
4. ✅ Partial transaction ID matching

### **Medium Priority (Enhancements):**
5. ✅ URL pattern generation from links
6. ✅ Pattern matching before extraction
7. ✅ User pattern selection from global library

### **Low Priority (Nice to Have):**
8. ✅ Pattern similarity detection
9. ✅ Auto-promotion to global library
10. ✅ Enhanced URL extraction patterns

---

## 🔧 Files to Modify

### **Backend:**
- `backend/src/controllers/patternController.ts` - Update `createPattern`
- `backend/src/utils/patternAI.ts` - Enhance rule-based extraction
- `backend/src/utils/llmExtractor.ts` - Already has AI extraction
- `backend/src/utils/extractFromSMS.ts` - Enhance URL extraction
- `backend/src/utils/patternRecognition.ts` - Add pattern matching
- `backend/prisma/schema.prisma` - Add `txnIdPrefix` field (optional)

### **New Files to Create:**
- `backend/src/utils/patternMatcher.ts` - Match SMS against existing patterns
- `backend/src/utils/partialTxnIdMatcher.ts` - Partial transaction ID matching
- `backend/src/utils/urlPatternGenerator.ts` - Generate patterns from URLs
- `backend/src/utils/patternDeduplication.ts` - Duplicate detection

### **Frontend (Dashboard):**
- `dashboard/src/pages/patterns/PatternBuilderPage.tsx` - Add AI option
- `dashboard/src/lib/api.ts` - Update API calls

### **Mobile App:**
- `mobile-app/src/screens/PatternBuilderScreen.tsx` - Add AI option
- `mobile-app/src/services/api.ts` - Update API calls

---

## 🎯 Implementation Order

1. **Phase 1: Pattern Matching & Deduplication**
   - Check global/user patterns before extraction
   - Prevent duplicates

2. **Phase 2: Rule-Based First, AI Last**
   - Update `createPattern` to use rule-based first
   - Fall back to AI only if needed

3. **Phase 3: AI in Regular Pattern Creation**
   - Add AI to `createPattern` endpoint
   - Update frontend/mobile app

4. **Phase 4: URL Pattern Support**
   - URL pattern generation
   - Link-to-transaction matching

5. **Phase 5: Partial Transaction ID Matching**
   - Prefix extraction
   - Partial matching in verification

---

## 📝 Notes

- All changes should be **backward compatible**
- Existing patterns should continue to work
- Migration needed for `txnIdPrefix` field (optional, can be added later)
- Test thoroughly with real SMS examples
- Consider performance for pattern matching (add indexes)

