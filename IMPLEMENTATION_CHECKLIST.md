# Transaction ID Extraction - Implementation Checklist

## Quick Reference

### Current Status
- ✅ Keyword-based extraction (transaction number, txn, ref, etc.)
- ✅ Country-specific templates
- ✅ Pattern learning system
- ❌ URL/link parsing
- ❌ Enhanced context-aware patterns
- ❌ Bank-specific extractors
- ❌ Multi-stage extraction pipeline

---

## Phase 0: High-Value Features (Week 1-2)

### 0. Sample SMS Collection During Setup
- [ ] Add new onboarding step: "Sample SMS Collection"
- [ ] Create UI for collecting:
  - [ ] Incoming SMS (sender - payment received)
  - [ ] Outgoing SMS (receiver - payment sent) - optional
- [ ] Add backend endpoint: `POST /api/onboarding/analyze-samples`
  - [ ] Analyze SMS structure using AI or rule-based
  - [ ] Generate patterns automatically
  - [ ] Return pattern preview
- [ ] Add backend endpoint: `POST /api/onboarding/confirm-patterns`
  - [ ] Save confirmed patterns to database
- [ ] Add pattern preview UI in mobile app
  - [ ] Show extracted fields (txnId, amount, bank, etc.)
  - [ ] Allow user to confirm or edit
- [ ] Integrate with existing `OnboardingScreen.tsx`
- [ ] Test with real SMS samples
- [ ] Handle edge cases (SMS without transaction IDs)

**Files to Create**:
- `backend/src/controllers/onboardingController.ts` (new)
- `backend/src/routes/onboarding.ts` (new)

**Files to Modify**:
- `mobile-app/src/screens/OnboardingScreen.tsx`
- `mobile-app/src/services/api.ts`
- `backend/src/server.ts` (add routes)

---

### 1. AI-Powered Structure Detection
- [ ] Choose AI provider (OpenAI, Anthropic, or local)
- [ ] Set up API keys and configuration
- [ ] Create `extractTxnIdWithLLM()` function
  - [ ] Use GPT-4o-mini for cost efficiency
  - [ ] Use structured output/function calling
  - [ ] Add error handling and fallbacks
- [ ] Integrate as fallback in extraction pipeline
  - [ ] Only use when rule-based confidence < 50%
  - [ ] Cache results for similar SMS
- [ ] Add cost tracking and monitoring
- [ ] Test with various SMS formats
- [ ] Add unit tests

**Files to Create**:
- `backend/src/utils/llmExtractor.ts` (new)

**Files to Modify**:
- `backend/src/utils/extractFromSMS.ts`
- `backend/src/utils/flexibleExtractor.ts`
- `backend/package.json` (add OpenAI/Anthropic SDK)

**Environment Variables**:
- `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`)

---

## Phase 1: Quick Wins (Week 3-4)

### 1. URL/Link Extraction
- [ ] Create `extractTxnIdFromURL()` function in `backend/src/utils/extractFromSMS.ts`
- [ ] Add URL parsing for query parameters (`?txn=`, `?transactionId=`, etc.)
- [ ] Add URL parsing for path segments (`/txn/ABC123`)
- [ ] Add URL parsing for hash fragments (`#txn=ABC123`)
- [ ] Integrate into existing `extractTxnId()` function
- [ ] Add unit tests for URL extraction
- [ ] Test with real SMS samples containing URLs
- [ ] Update mobile app `patternMatcher.ts` with same logic

**Files to Modify**:
- `backend/src/utils/extractFromSMS.ts`
- `backend/src/utils/flexibleExtractor.ts`
- `backend/src/utils/patternAI.ts`
- `mobile-app/src/utils/patternMatcher.ts`

---

### 2. Enhanced Pattern Matching
- [ ] Add support for transaction IDs with separators (hyphens, underscores)
  - Pattern: `ABC-123-XYZ`, `ABC_123_XYZ`
- [ ] Add context-aware extraction (look near financial keywords)
- [ ] Add support for shorter transaction IDs (4-5 chars) in specific contexts
- [ ] Add support for transaction IDs in parentheses/brackets
- [ ] Add multi-line transaction ID support
- [ ] Update minimum length validation (make it context-dependent)
- [ ] Add unit tests for new patterns

**Files to Modify**:
- `backend/src/utils/extractFromSMS.ts`
- `backend/src/utils/flexibleExtractor.ts`
- `mobile-app/src/utils/patternMatcher.ts`

---

## Phase 2: Architecture (Week 3-4)

### 3. Multi-Stage Extraction Pipeline
- [ ] Create `ExtractionResult` interface with confidence scoring
- [ ] Refactor extraction to use cascading approach:
  1. URL extraction
  2. Pattern-based extraction
  3. Context-aware extraction
  4. Bank-specific extractors
  5. Fuzzy/heuristic fallback
- [ ] Add confidence scoring for each method
- [ ] Add logging for extraction method used
- [ ] Add analytics tracking
- [ ] Update API responses to include confidence score
- [ ] Add unit tests for multi-stage pipeline

**Files to Create**:
- `backend/src/utils/multiStageExtractor.ts` (new)

**Files to Modify**:
- `backend/src/utils/extractFromSMS.ts`
- `backend/src/controllers/txnController.ts`
- `backend/src/utils/flexibleExtractor.ts`

---

### 4. Bank-Specific Extractors
- [ ] Create `bankExtractors` object/map
- [ ] Implement extractors for top 5 banks:
  - [ ] M-Pesa (Kenya)
  - [ ] Telebirr (Ethiopia)
  - [ ] MTN MoMo (Ghana, Uganda)
  - [ ] Commercial Bank of Ethiopia (CBE)
  - [ ] Add 1-2 more based on user data
- [ ] Add bank detection to route to specific extractors
- [ ] Add unit tests for each bank extractor
- [ ] Test with real SMS samples from each bank

**Files to Create**:
- `backend/src/utils/bankExtractors.ts` (new)

**Files to Modify**:
- `backend/src/utils/multiStageExtractor.ts`
- `backend/src/utils/flexibleExtractor.ts`

---

## Phase 3: Advanced (Month 2+)

### 5. User Feedback System
- [ ] Add UI for manual transaction ID correction
- [ ] Store corrections in database
- [ ] Implement pattern learning from corrections
- [ ] Add analytics dashboard for extraction success rates
- [ ] Add admin interface for reviewing failed extractions

**Files to Create**:
- `backend/src/models/ExtractionCorrection.ts` (if needed)
- `dashboard/src/pages/ExtractionFeedbackPage.tsx` (new)

**Files to Modify**:
- `backend/src/controllers/txnController.ts`
- `backend/src/routes/verify.ts`
- `mobile-app/src/screens/TransactionsScreen.tsx`

---

### 6. ML/NLP Integration (If Needed)
- [ ] Evaluate extraction success rate after Phase 1-2
- [ ] If < 85%, consider ML approach
- [ ] Research lightweight ML libraries (spaCy, transformers.js)
- [ ] Create labeled dataset from real SMS
- [ ] Train/test model
- [ ] Integrate as fallback in multi-stage pipeline
- [ ] Monitor performance and accuracy

**Files to Create**:
- `backend/src/utils/mlExtractor.ts` (new, if needed)

---

## Testing Checklist

### Unit Tests
- [ ] URL extraction with various URL formats
- [ ] Pattern matching with separators
- [ ] Context-aware extraction
- [ ] Bank-specific extractors
- [ ] Multi-stage pipeline
- [ ] Edge cases (no transaction ID, multiple IDs, etc.)

### Integration Tests
- [ ] End-to-end SMS ingestion with URL-based transaction IDs
- [ ] End-to-end SMS ingestion with enhanced patterns
- [ ] Verify API returns correct transaction IDs
- [ ] Test with real SMS samples from different banks

### Manual Testing
- [ ] Test with SMS containing URLs
- [ ] Test with SMS from different banks
- [ ] Test with SMS in different formats
- [ ] Test with edge cases (truncated SMS, encoding issues)

---

## Metrics to Track

### Before Implementation
- [ ] Baseline extraction success rate: _____%
- [ ] Current false positive rate: _____%
- [ ] Most common banks/institutions: _____
- [ ] SMS samples with URLs: _____ samples

### After Each Phase
- [ ] Extraction success rate: _____%
- [ ] False positive rate: _____%
- [ ] Method distribution (URL, pattern, context, bank-specific)
- [ ] Bank-specific success rates

---

## Documentation

- [ ] Update API documentation with confidence scores
- [ ] Document new extraction methods
- [ ] Add examples of SMS formats handled
- [ ] Update developer guide
- [ ] Create migration guide for existing patterns

---

## Notes

- Start with Phase 1 (URL extraction) - it's the quickest win
- Collect baseline metrics before starting
- Test with real SMS samples throughout
- Keep extraction methods modular for easy maintenance
- Log extraction method used for debugging and analytics

---

## Questions to Answer

1. What's the current extraction success rate? (Need baseline)
2. Which banks are most common in your user base?
3. Do you have SMS samples with URLs?
4. What's acceptable false positive rate?
5. Do you have resources for ML/NLP if needed?

