# Debugging Transaction Sync Issues

## Problem
Transactions are not appearing in:
- Prisma Studio (database)
- Dashboard (http://localhost:5173/dashboard/transactions)
- Mobile app transaction screen

## Debugging Steps

### 1. Check if API Key is Stored
In the mobile app, check the logs for:
```
🔑 [SMS Service] API Key check: { hasApiKey: true/false, ... }
```

If `hasApiKey: false`, the user needs to sign in.

### 2. Check if Transactions are Being Detected
Look for logs:
```
✅ [SMS Service] Pattern matched!
✅ [SMS Service] Transaction processed: <txnId>
```

### 3. Check if Sync is Attempted
Look for:
```
🔄 [SMS Service] Attempting to sync transaction to backend...
📤 [SMS Service] Sending payload: ...
```

### 4. Check API Request
Look for:
```
🔑 [API] Using API key for authentication: { apiKeyPreview: "...", headerSet: true }
📤 API Request: { method: "POST", url: "/ingest", hasAuth: true }
```

### 5. Check API Response
Look for:
```
✅ [API] Transaction sent successfully: { success: true, txnId: "...", transactionId: "..." }
```

OR error:
```
❌ [API] Failed to send transaction: { error: "...", status: 401/403/500, ... }
```

### 6. Test Endpoint Manually

Use the test script:
```bash
./test-transaction-sync.sh YOUR_API_KEY
```

Or manually:
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "txnId": "TEST123",
    "amount": 100.50,
    "sender": "+1234567890",
    "bank": "Test Bank",
    "pattern": "Test Pattern"
  }'
```

### 7. Common Issues

#### Issue: 401 Unauthorized
- **Cause**: Invalid or missing API key
- **Fix**: Ensure user is signed in, API key is stored correctly

#### Issue: 403 Forbidden - SIM Card
- **Cause**: SIM card not registered
- **Fix**: Register SIM card or remove ICCID from payload (currently disabled)

#### Issue: Network Error
- **Cause**: Backend not running or wrong URL
- **Fix**: 
  - Check backend is running: `cd backend && npm run dev`
  - Check ngrok URL in `mobile-app/src/config.ts`
  - Verify network connectivity

#### Issue: No Transactions Detected
- **Cause**: SMS not matching patterns
- **Fix**: 
  - Check patterns are downloaded
  - Verify SMS format matches pattern
  - Check pattern matching logs

### 8. Manual Sync

In the mobile app dashboard, if you have an API key, you can manually sync:
- Tap "Sync Transactions" button
- This will attempt to sync all unsynced transactions

### 9. Check Backend Logs

Look for:
```
[INGEST] Transaction created: id=..., userId=..., txnId=..., amount=...
```

OR errors:
```
[INGEST] Error creating transaction: ...
```

### 10. Verify Database

Check Prisma Studio:
```bash
cd backend
npx prisma studio
```

Look in the `Transaction` table for new entries.

## Quick Fix Checklist

- [ ] User is signed in (API key exists)
- [ ] Backend server is running
- [ ] Ngrok URL is correct (if using ngrok)
- [ ] SMS monitoring is active
- [ ] Patterns are downloaded
- [ ] SMS matches a pattern
- [ ] No errors in mobile app logs
- [ ] No errors in backend logs
- [ ] Transaction appears in database (Prisma Studio)



