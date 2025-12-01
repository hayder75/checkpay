# Pattern Extraction Logic - How It Works

## 🎯 How the System Determines Success

### Rule-Based Extraction Success Criteria

The system considers rule-based extraction **successful** if:

1. **Pattern is valid** - Passes validation checks
2. **At least one field extracted** - Either `amount` OR `txnId` was found

```typescript
const ruleBasedSuccess = ruleBasedValidation.valid && 
  (ruleBasedPattern.extractFields.amount !== null || 
   ruleBasedPattern.extractFields.txnId !== null);
```

### What Gets Extracted

Rule-based extraction looks for:
- **Transaction ID**: Keywords like "transaction number", "txn", "ref", "reference", "id"
- **Amount**: Keywords like "received", "credited", "transferred", "deposited" + currency
- **Sender**: Keywords like "from", "by", "sent by"
- **Bank**: Detects bank names (Telebirr, CBE, M-Pesa, etc.)
- **Currency**: Detects currency codes (ETB, KES, NGN, etc.)

### When Rule-Based Fails

Rule-based extraction fails if:
- Pattern validation fails (invalid regex, missing fields)
- No amount AND no transaction ID extracted
- SMS format doesn't match known patterns

---

## 🔄 Extraction Flow

### Default Flow (No Toggle):
```
User creates pattern
    ↓
Try rule-based extraction
    ↓
Check success criteria:
  - Valid pattern? ✅
  - Extracted amount OR txnId? ✅
    ↓
If YES → Use rule-based (no AI)
If NO → Use AI automatically
```

### With AI Toggle Enabled:
```
User creates pattern (with AI toggle ON)
    ↓
Skip rule-based extraction
    ↓
Use AI directly
```

---

## 🎛️ User Controls

### Toggle Option (NEW!)

Users can now **force AI usage** with a toggle:

**Location:** Pattern Builder page
**UI:** Checkbox labeled "Use AI for Pattern Creation"

**Behavior:**
- **Toggle OFF (default)**: Try rule-based first, use AI if needed
- **Toggle ON**: Skip rule-based, use AI directly

### When to Use AI Toggle

**Use AI toggle when:**
- SMS format is complex or unusual
- Rule-based extraction keeps failing
- You want maximum accuracy
- SMS has non-standard formatting

**Don't use AI toggle when:**
- SMS follows standard format
- Rule-based works fine (saves time & cost)
- SMS is simple and straightforward

---

## 📊 Success Detection Details

### Pattern Validation

Pattern is considered **valid** if:
- Regex pattern is well-formed
- Extract fields are properly mapped
- At least one capture group is defined

### Field Extraction

**Amount extracted** if:
- Found number near currency keywords
- Matches pattern like "ETB 1,000.00" or "received 500"
- Not a balance amount

**Transaction ID extracted** if:
- Found alphanumeric code (6+ characters)
- Near keywords like "transaction number", "ref", "txn"
- Not a phone number or date

---

## 💡 Examples

### Example 1: Rule-Based Success ✅

**SMS:**
```
You received ETB 500.00 from JOHN DOE. 
Transaction number: CK660DRZ8I
```

**Extraction:**
- Amount: ✅ 500.00
- Transaction ID: ✅ CK660DRZ8I
- Currency: ✅ ETB
- **Result:** Rule-based succeeds, no AI needed

---

### Example 2: Rule-Based Failure → AI Used

**SMS:**
```
Your account was credited. 
Reference: ABC123XYZ789
Amount: 1,500.00 Birr
```

**Rule-Based:**
- Amount: ❌ (format not recognized)
- Transaction ID: ✅ ABC123XYZ789
- **Result:** Partial success, but validation may fail → AI used

---

### Example 3: User Forces AI

**User Action:** Toggle "Use AI" ON

**SMS:**
```
Payment received. Details: [complex format]
```

**Flow:**
- Rule-based: Skipped
- AI: Used directly
- **Result:** AI extracts all fields

---

## 🔧 Technical Details

### Success Criteria Code

```typescript
// Pattern must be valid
const isValid = validatePattern(pattern).valid;

// Must extract at least one key field
const hasKeyField = 
  pattern.extractFields.amount !== null || 
  pattern.extractFields.txnId !== null;

// Success = both conditions true
const success = isValid && hasKeyField;
```

### Toggle Implementation

**Frontend:**
```typescript
const [forceAI, setForceAI] = useState(false);

// When creating pattern
await patternsAPI.create({
  smsText,
  name: patternName,
  description,
  useAI: forceAI, // Pass toggle value
});
```

**Backend:**
```typescript
const { useAI } = req.body; // Default: false

if (useAI) {
  // Skip rule-based, use AI directly
} else {
  // Try rule-based first
}
```

---

## 📈 Performance Impact

### Rule-Based (Default)
- ⚡ **Fast**: < 100ms
- 💰 **Free**: No API costs
- ✅ **Good for**: Standard SMS formats

### AI (When Needed)
- 🐌 **Slower**: 1-3 seconds
- 💰 **Cost**: API call per pattern
- ✅ **Good for**: Complex/unusual formats

### AI (Forced)
- 🐌 **Slower**: 1-3 seconds
- 💰 **Cost**: API call per pattern
- ✅ **Good for**: Maximum accuracy

---

## 🎯 Best Practices

1. **Start with default** (rule-based first)
2. **Use AI toggle** if rule-based keeps failing
3. **Check preview** before saving pattern
4. **Review extraction method** shown in UI badge

---

## 🔍 Debugging

### Check Extraction Method

The response includes:
```json
{
  "method": "rule-based" | "ai" | "existing",
  "aiSuggested": true/false
}
```

### Check Pattern Validation

Validation errors show:
- Missing required fields
- Invalid regex pattern
- Extraction issues

---

## 📝 Summary

**How system knows rule-based succeeded:**
1. Pattern validation passes
2. At least amount OR txnId extracted

**User toggle:**
- Checkbox in Pattern Builder
- Forces AI usage when enabled
- Default: OFF (try rule-based first)

**Flow:**
- Default: Rule-based → AI (if needed)
- With toggle: AI directly

