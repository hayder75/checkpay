# Pattern Matching Improvements

## Problem
The original pattern matching was too rigid and only looked for specific keywords like "Ref:", "TXN:", "ID:" for transaction IDs. This failed for SMS formats like:

```
"Dear HAYDER,
You have received  ETB 200.00 by transaction number CK53WMPIOR on 2025-11-05 20:14:28 from Commercial Bank of Ethiopia to your telebirr Account..."
```

## Solution: Keyword-Based Flexible Extraction

### 1. Multiple Transaction ID Keywords
Now detects transaction IDs using:
- `transaction number` (e.g., "by transaction number CK53WMPIOR")
- `transaction id`
- `txn`
- `ref`
- `reference`
- `id`
- `transaction no`
- `txn no`

### 2. Multiple Amount Keywords
Detects amounts near:
- `received` (e.g., "received ETB 200.00")
- `credited`
- `transferred`
- `deposited`
- `amount`

### 3. Multiple Sender Keywords
Detects sender using:
- `from` (e.g., "from Commercial Bank of Ethiopia")
- `by`
- `sent by`
- `sender`

### 4. Fallback Extraction
If regex doesn't match perfectly, the system:
1. Tries keyword-based extraction directly from text
2. Looks for patterns that look like transaction IDs (alphanumeric, 6+ chars)
3. Finds amounts that look like money (decimal numbers)
4. Extracts sender from context

### 5. Bank & Currency Detection
- Detects "Telebirr", "Commercial Bank of Ethiopia", "CBE"
- Detects "ETB", "KES", "NGN", etc.
- Works even if wording varies

## How It Works Now

### Example SMS:
```
Dear HAYDER,
You have received  ETB 200.00 by transaction number CK53WMPIOR on 2025-11-05 20:14:28 from Commercial Bank of Ethiopia to your telebirr Account...
```

### Extracted:
- **Amount**: `200.00` (detected from "received ETB 200.00")
- **Transaction ID**: `CK53WMPIOR` (detected from "by transaction number CK53WMPIOR")
- **Sender**: `Commercial Bank of Ethiopia` (detected from "from Commercial Bank of Ethiopia")
- **Bank**: `Telebirr` (detected from "telebirr Account")
- **Currency**: `ETB` (detected from "ETB 200.00")

## Benefits

1. **Works across different SMS formats** - Not limited to specific wording
2. **Handles variations** - "transaction number" vs "Ref:" vs "TXN ID"
3. **Fallback extraction** - Even if regex fails, keyword extraction works
4. **Multi-language ready** - Can be extended for different languages
5. **More accurate** - Detects fields even when wording is different

## Testing

Try analyzing your SMS again in the Pattern Builder. It should now correctly extract:
- ✅ Amount: 200.00
- ✅ Transaction ID: CK53WMPIOR
- ✅ Sender: Commercial Bank of Ethiopia
- ✅ Bank: Telebirr
- ✅ Currency: ETB

