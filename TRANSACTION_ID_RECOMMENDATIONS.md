# Transaction ID Extraction - Recommendations Summary

## Problem Statement

Different financial institutions send SMS in various formats:
- Some include transaction numbers explicitly: "Transaction number: ABC123"
- Some don't include transaction numbers at all
- Some send transaction numbers as URL parameters: `https://bank.com/verify?txn=ABC123`
- Some send transaction numbers in links as path segments: `https://bank.com/txn/ABC123`

**Current Challenge**: The system struggles to detect transaction numbers when they're:
1. Embedded in URLs/links
2. In non-standard formats
3. Without clear delimiters
4. In different languages or character sets

## Recommended Solutions (Priority Order)

### 🤖 Priority 0: AI-Powered Structure Detection (Strategic - High Value)

**Impact**: Very High | **Effort**: Medium | **Time**: 1-2 weeks

Use AI/LLM tools to automatically detect SMS structure and extract transaction IDs.

**Options**:

#### Option A: Cloud LLM (OpenAI GPT, Anthropic Claude)
- **GPT-4o-mini**: ~$0.00015 per SMS (very affordable)
- **GPT-4**: ~$0.003 per SMS (more accurate)
- **Best for**: Production use, edge cases, unknown formats
- **Use as**: Fallback for low-confidence rule-based extractions

**Implementation**:
- Use LLM only when rule-based extraction fails or has low confidence
- Cache results for similar SMS patterns
- Use structured output/function calling for consistent extraction
- Cost: ~$0.15-$3/day for 1000 SMS (if 10% need LLM)

#### Option B: Local AI Models (Ollama, Transformers.js)
- **Best for**: Privacy-focused, no API costs, offline use
- **Trade-off**: Lower accuracy, requires local infrastructure
- **Use as**: Alternative to cloud LLM for privacy-sensitive users

**When to Use AI**:
- New/unknown bank formats
- Low confidence from rule-based extraction (< 50%)
- Complex SMS structures
- Non-English SMS
- Edge cases that rules can't handle

**Hybrid Approach (Recommended)**:
1. Try rule-based extraction first (fast, free)
2. If confidence < 50%, use LLM as fallback
3. Learn from LLM results to improve rules

---

### 📱 Priority 0.5: Sample SMS Collection During Setup (High Value - User Experience)

**Impact**: Very High | **Effort**: Medium | **Time**: 1 week

Collect sample SMS messages (both sender and receiver) during onboarding to auto-generate patterns.

**Key Features**:
1. **Onboarding Step**: Add "Sample SMS Collection" step
2. **Both Directions**: Collect incoming (sender) and outgoing (receiver) SMS
3. **Auto-Analysis**: Use AI or rule-based analysis to generate patterns
4. **Pattern Preview**: Show user what was extracted before confirming
5. **Zero Manual Work**: Users don't need to create patterns manually

**Implementation Flow**:
```
User Onboarding:
1. Select Country
2. Provide Sample SMS (incoming + optional outgoing)
3. System analyzes and generates patterns
4. User reviews and confirms patterns
5. Patterns automatically created
```

**Benefits**:
- ✅ Eliminates manual pattern creation
- ✅ Higher accuracy (patterns from real SMS)
- ✅ Faster onboarding (minutes vs hours)
- ✅ Handles both payment directions
- ✅ Personalized to each user's banks

**Backend APIs Needed**:
- `POST /api/onboarding/analyze-samples` - Analyze SMS and generate patterns
- `POST /api/onboarding/confirm-patterns` - Save confirmed patterns

**Mobile App Changes**:
- Add sample SMS input step in `OnboardingScreen.tsx`
- Add pattern preview/confirmation UI
- Integrate with existing SMS scanning

**Pros**:
- Dramatically improves user experience
- Reduces support requests
- Higher pattern accuracy
- One-time setup per user

**Cons**:
- Requires SMS permission (already have)
- Users must provide samples (but it's one-time)
- Need fallback if samples don't have transaction IDs

---

### 🚀 Priority 1: URL/Link Extraction (Quick Win)

**Impact**: High | **Effort**: Low | **Time**: 1-2 days

Add URL parsing to extract transaction IDs from links in SMS.

**Key Features**:
- Parse query parameters: `?txn=`, `?transactionId=`, `?ref=`
- Parse path segments: `/txn/ABC123`, `/transaction/ABC123`
- Parse hash fragments: `#txn=ABC123`
- Support common parameter names across institutions

**Why First**: Many institutions use URLs, and this is a common pattern that's currently missed.

---

### 🎯 Priority 2: Enhanced Pattern Matching (Medium Effort)

**Impact**: High | **Effort**: Medium | **Time**: 3-5 days

Improve existing pattern matching with:
- Support for transaction IDs with separators (hyphens, underscores)
- Context-aware extraction (look for IDs near financial keywords)
- Support for shorter transaction IDs (4-5 chars) in specific contexts
- Transaction IDs in parentheses/brackets
- Multi-line transaction IDs

**Why Second**: Builds on existing system, handles more format variations.

---

### 🏗️ Priority 3: Multi-Stage Extraction Pipeline (Architecture)

**Impact**: High | **Effort**: Medium | **Time**: 1 week

Refactor extraction to use a cascading approach:
1. URL extraction (fastest, highest confidence)
2. Pattern-based extraction (current system)
3. Context-aware extraction (enhanced patterns)
4. Bank-specific extractors (for known institutions)
5. Fuzzy/heuristic fallback

**Benefits**:
- Confidence scoring for each extraction
- Better logging and analytics
- Easier to add new extraction methods
- Handles edge cases gracefully

---

### 🏦 Priority 4: Bank-Specific Extractors (Targeted)

**Impact**: Medium-High | **Effort**: Low-Medium | **Time**: 2-3 days per bank

Create specialized extractors for top banks:
- M-Pesa (Kenya)
- Telebirr (Ethiopia)
- MTN MoMo (Ghana, Uganda)
- Major banks in each country

**Why**: Each bank has specific formats. Specialized extractors = higher accuracy.

---

### 🤖 Priority 5: Machine Learning (Long-term)

**Impact**: High | **Effort**: High | **Time**: 2-4 weeks

**Only if needed** after implementing Priority 1-4.

Options:
- **Lightweight**: Use spaCy or transformers.js for NER
- **Custom Model**: Train on labeled SMS data
- **Hybrid**: ML for edge cases, rules for common cases

**When to Consider**:
- If extraction success rate < 85% after Priority 1-4
- If handling many unknown banks/institutions
- If need to support non-English SMS

---

## Implementation Plan

### Week 1: Sample SMS Collection (High Priority)
- [ ] Add sample SMS collection step to onboarding
- [ ] Create backend API for SMS analysis (`/api/onboarding/analyze-samples`)
- [ ] Create backend API for pattern confirmation (`/api/onboarding/confirm-patterns`)
- [ ] Add pattern preview UI in mobile app
- [ ] Test with real SMS samples
- [ ] **Impact**: Eliminates manual pattern creation, improves UX dramatically

### Week 2: AI Integration (Strategic)
- [ ] Set up OpenAI API (or alternative)
- [ ] Implement LLM extraction function
- [ ] Integrate as fallback in extraction pipeline
- [ ] Add caching for similar SMS patterns
- [ ] Test cost and performance
- [ ] **Impact**: Handles edge cases and unknown formats automatically

### Week 3-4: Quick Wins + Architecture
- [ ] Implement URL/link extraction
- [ ] Add enhanced pattern matching (separators, context-aware)
- [ ] Build multi-stage extraction pipeline
- [ ] Add confidence scoring
- [ ] Create bank-specific extractors for top 5 banks
- [ ] Add analytics/logging

### Month 2+: Advanced
- [ ] User feedback system for corrections
- [ ] Pattern learning from corrections
- [ ] Expand bank-specific extractors
- [ ] Evaluate local AI models if needed

---

## Success Metrics

Track these metrics to measure improvement:

1. **Extraction Success Rate**: Target > 90%
   - Currently: ? (need baseline)
   - After Priority 1-2: Target 85%+
   - After Priority 3-4: Target 90%+

2. **False Positive Rate**: Target < 5%
   - Transaction IDs extracted incorrectly

3. **Method Distribution**:
   - % of extractions by method (URL, pattern, context, bank-specific)

4. **Bank-Specific Success Rates**:
   - Track per bank/institution

---

## Technical Considerations

### Performance
- URL extraction: Very fast (< 1ms)
- Pattern matching: Fast (< 5ms)
- ML extraction: Slower (50-200ms) - use only for edge cases

### Maintainability
- Keep extraction methods modular
- Document each extraction method
- Add unit tests for each method
- Log extraction method used for debugging

### Scalability
- Bank-specific extractors: Easy to add new banks
- Pattern matching: Can add new patterns without code changes (via admin)
- ML: Can retrain models as data grows

---

## Next Steps

1. **Review this document** with the team
2. **Prioritize** based on your specific needs
3. **Start with Priority 1** (URL extraction) - quick win
4. **Collect baseline metrics** before implementing
5. **Test with real SMS samples** from your users

---

## Questions to Answer Before Implementation

1. **What's the current extraction success rate?**
   - Need baseline to measure improvement

2. **Which banks/institutions are most common?**
   - Prioritize bank-specific extractors for these

3. **Do you have SMS samples with URLs?**
   - Test URL extraction with real examples

4. **What's the acceptable false positive rate?**
   - Balance between finding transaction IDs vs. incorrect extractions

5. **Do you have resources for ML/NLP?**
   - If yes, can start earlier. If no, focus on rule-based first.

---

## Code Examples

See `TRANSACTION_ID_EXTRACTION_ANALYSIS.md` for detailed code examples and implementation details.

