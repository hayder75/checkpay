# Mobile App Transaction Sync Guide

## Overview
The mobile app now uses **JWT token authentication** to send transactions to the backend. Transactions are automatically synced when:
1. User is signed in (has JWT token)
2. SMS is detected and matched to a pattern
3. Transaction is extracted successfully

## Authentication Flow

### Before (API Key)
- Used API key for `/api/ingest` endpoint
- Required API key to be stored

### Now (JWT Token)
- Uses JWT token for `/api/ingest` endpoint
- Token obtained via login: `POST /api/auth/login`
- API key only used for `/api/verify` endpoint (for external payment verification)

## How It Works

### 1. User Signs In
```typescript
// User logs in with username/phone and password
POST /api/auth/login
{
  "username": "abebeb",
  "password": "123456"
}

// Response includes JWT token
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "apiKey": "ckp_...",  // Still available for verify endpoint
      ...
    }
  }
}
```

### 2. SMS Detection
- App monitors SMS messages
- Matches against patterns
- Extracts transaction data

### 3. Automatic Sync
When a transaction is detected:
```typescript
// SMS Service checks for JWT token
const token = await storage.getToken();

if (token) {
  // Sync transaction to backend using JWT token
  await syncTransactionToBackend(transaction);
}
```

### 4. Manual Sync
User can manually sync unsynced transactions:
- Tap "Sync Transactions" button in dashboard
- Syncs all transactions with `synced: false`

## Code Flow

### SMS Service (`smsService.ts`)
1. `processSMS()` - Detects and extracts transaction
2. Checks for JWT token
3. Calls `syncTransactionToBackend()` if token exists
4. Marks transaction as `synced: true` on success

### API Service (`api.ts`)
1. Request interceptor adds JWT token to `/ingest` requests
2. `Authorization: Bearer <token>` header
3. API key only added for `/verify` endpoint

### Backend (`/api/ingest`)
1. Uses `authenticate` middleware (JWT token)
2. Creates transaction in database
3. Returns transaction data

## Testing

### 1. Sign In
- Username: `abebeb`
- Password: `123456`
- Or use phone: `0908070504`

### 2. Check Logs
Look for these log messages:
```
🔑 [SMS Service] Authentication check: { hasToken: true, ... }
🔄 [SMS Service] Attempting to sync transaction to backend...
📤 [API] Sending transaction to backend: { endpoint: '/ingest', ... }
✅ [API] Transaction sent successfully: { success: true, ... }
✅ [SMS Service] Transaction synced to backend successfully
```

### 3. Verify in Dashboard
- Check `http://localhost:5173/dashboard/transactions`
- Transactions should appear after sync

### 4. Check Database
```bash
cd backend
npx prisma studio
```
- Open Transaction table
- Verify transactions are created

## Troubleshooting

### Issue: Transactions not syncing

**Check 1: Is user signed in?**
```typescript
const token = await storage.getToken();
console.log('Has token:', !!token);
```

**Check 2: Are transactions being detected?**
Look for logs:
```
✅ [SMS Service] Pattern matched!
✅ [SMS Service] Transaction processed: <txnId>
```

**Check 3: Is backend running?**
```bash
curl http://localhost:3000/health
```

**Check 4: Check API logs**
Look for:
```
🔑 [API] Using JWT token for authentication
📤 API Request: { url: '/ingest', hasAuth: true, authType: 'JWT' }
✅ API Response: { status: 201, ... }
```

**Check 5: Network connectivity**
- Verify ngrok URL in `mobile-app/src/config.ts`
- Check if backend is accessible from mobile device

### Issue: 401 Unauthorized

**Cause**: JWT token expired or invalid
**Solution**: User needs to sign in again

### Issue: Network Error

**Causes**:
- Backend not running
- Wrong API URL
- Network connectivity issue

**Solution**:
1. Check backend is running: `cd backend && npm run dev`
2. Verify API URL in `mobile-app/src/config.ts`
3. Check ngrok tunnel if using ngrok

## Manual Testing

### Test Transaction Sync
1. Sign in to mobile app
2. Go to dashboard
3. Tap "Sync Transactions" button
4. Check logs for sync progress
5. Verify transactions appear in dashboard

### Test with Test SMS
1. Use "Test SMS" feature in app
2. Enter a sample SMS that matches a pattern
3. Transaction should be created and synced automatically
4. Check dashboard to verify

## Summary

✅ **JWT Token Authentication**: Ingest endpoint uses JWT tokens
✅ **Automatic Sync**: Transactions sync automatically when detected
✅ **Manual Sync**: "Sync Transactions" button available
✅ **Error Handling**: Detailed logging for debugging
✅ **Retry Logic**: Failed transactions remain unsynced for retry

The mobile app is now configured to send transactions to the backend using JWT token authentication!



