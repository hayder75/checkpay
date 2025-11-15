# Testing Guide

This guide provides instructions for testing all phases of the CheckPay payment verification system.

## Prerequisites

1. **Database Migration**: Run Prisma migrations to set up the database schema
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma generate
   ```

2. **Environment Variables**: Ensure `.env` files are configured
   - Backend: `OPENAI_API_KEY` (optional, for LLM extraction)
   - Backend: Database connection string
   - Mobile App: `API_BASE_URL` pointing to backend

3. **Start Services**:
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev

   # Terminal 2: Dashboard (optional)
   cd dashboard
   npm run dev

   # Terminal 3: Mobile App
   cd mobile-app
   npm start
   ```

## Phase 1-4: Core Functionality Testing

### 1. Test Pattern Recognition API

#### Test Single Pattern Recognition
```bash
curl -X POST http://localhost:3000/api/test/pattern \
  -H "Content-Type: application/json" \
  -d '{
    "smsText": "RM123456.00 sent to John Doe 254712345678 on 15/01/24 at 10:30 AM. New M-PESA balance is KES 5,000.00. Transaction ID: MP123456789.",
    "expectedTxnId": "MP123456789"
  }'
```

#### Test Batch Pattern Recognition
```bash
curl -X GET http://localhost:3000/api/test/samples
```

#### Test Custom Batch
```bash
curl -X POST http://localhost:3000/api/test/batch \
  -H "Content-Type: application/json" \
  -d '{
    "samples": [
      {
        "text": "Your SMS text here",
        "expectedTxnId": "TXN123",
        "expectedAmount": 1000,
        "institution": "Test Bank",
        "country": "ET"
      }
    ]
  }'
```

### 2. Test Institution Pattern APIs

#### Check if Pattern Exists
```bash
curl "http://localhost:3000/api/patterns/institution/M-Pesa?country=KE"
```

#### Create Pattern from Sample
```bash
curl -X POST http://localhost:3000/api/patterns/create-from-sample \
  -H "Content-Type: application/json" \
  -d '{
    "institution": "M-Pesa",
    "countryCode": "KE",
    "smsText": "RM123456.00 sent to John Doe 254712345678 on 15/01/24 at 10:30 AM. New M-PESA balance is KES 5,000.00. Transaction ID: MP123456789.",
    "txnId": "MP123456789"
  }'
```

#### Get Institutions with Patterns
```bash
curl "http://localhost:3000/api/patterns/institutions?country=KE"
```

### 3. Test Verification API

#### Verify Transaction (with API Key)
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "txnId": "MP123456789"
  }'
```

## Phase 5: Mobile App Testing

### 1. Onboarding Flow

1. **Install and Launch App**
   - Open the mobile app
   - You should see the onboarding screen

2. **Country Selection**
   - App should auto-detect country or prompt for selection
   - Select a country (e.g., "ET" for Ethiopia, "KE" for Kenya)

3. **SMS Scanning**
   - Grant SMS permissions when prompted
   - App scans for financial SMS messages
   - Verify that financial SMS are detected

4. **Institution Selection**
   - App lists detected financial SMS senders
   - Select one institution

5. **Pattern Check**
   - If pattern exists: App proceeds to registration
   - If pattern doesn't exist: App shows sample SMS screen

6. **Sample SMS Collection** (if pattern doesn't exist)
   - Enter sample SMS text
   - Enter corresponding transaction ID
   - Submit and verify pattern creation

7. **Registration**
   - Complete email registration
   - Verify OTP
   - App should complete onboarding

### 2. SMS Monitoring

1. **Check Monitoring Status**
   - Open Dashboard screen
   - Verify SMS monitoring status indicator
   - Should show "Monitoring SMS for financial transactions..." if active

2. **Test Transaction Detection**
   - Send a test SMS to your device matching your selected institution
   - Wait 5-10 seconds
   - Check Dashboard for new transaction count
   - Verify transaction appears in local storage

3. **Test Backend Sync**
   - Ensure you're logged in with API key
   - Send a test SMS
   - Verify transaction syncs to backend
   - Check backend logs for sync confirmation

### 3. Manual Transaction Testing

1. **Test SMS Parser**
   - Navigate to "Test SMS Parser" from Dashboard
   - Paste a sample SMS
   - Verify extraction works correctly
   - Check that transaction ID, amount, and sender are extracted

2. **View Local Transactions**
   - Check transaction history
   - Verify transactions are stored locally
   - Check sync status (synced/unsynced)

## Phase 6: Merchant Verification Testing

### 1. Merchant Portal (Web)

1. **Access Verification Page**
   - Navigate to: `http://localhost:5173/verify/:merchantId`
   - Replace `:merchantId` with a test merchant ID

2. **Test Verification**
   - Enter a transaction ID
   - Click "Verify Payment"
   - Verify results are displayed correctly

### 2. API Verification

1. **Get API Key**
   - Register/login to dashboard
   - Generate or copy API key

2. **Test API Call**
   ```bash
   curl -X POST http://localhost:3000/api/verify \
     -H "Content-Type: application/json" \
     -H "X-API-Key: YOUR_API_KEY" \
     -d '{"txnId": "MP123456789"}'
   ```

3. **Verify Response**
   - Check for `confirmed: true/false`
   - Verify amount, sender, bank details
   - Check timestamp

## Performance Testing

### 1. Cache Testing

1. **Test Pattern Lookup Caching**
   - Make first request to `/api/patterns/institution/:institution`
   - Check response time
   - Make second request (should be faster due to cache)
   - Verify cache is working

2. **Test Cache Invalidation**
   - Create a new pattern
   - Check that cache is invalidated
   - Verify new pattern is returned

### 2. Load Testing

1. **Test Multiple Concurrent Requests**
   ```bash
   # Using Apache Bench
   ab -n 100 -c 10 -H "X-API-Key: YOUR_API_KEY" \
     -p verify.json -T application/json \
     http://localhost:3000/api/verify
   ```

2. **Monitor Performance**
   - Check response times
   - Monitor database queries
   - Check cache hit rates

## Integration Testing

### End-to-End Flow

1. **Complete User Journey**
   - User installs app
   - Completes onboarding
   - Receives payment SMS
   - Transaction is detected automatically
   - Merchant verifies payment via API

2. **Pattern Creation Flow**
   - User selects institution without pattern
   - Provides sample SMS and transaction ID
   - System creates pattern (rule-based or LLM)
   - Pattern is validated and saved
   - User can now use the pattern

3. **Merchant Verification Flow**
   - Customer makes payment
   - Customer provides transaction ID to merchant
   - Merchant verifies via API or web portal
   - Payment status is confirmed

## Troubleshooting

### Common Issues

1. **SMS Not Detected**
   - Check SMS permissions
   - Verify institution matches selected institution
   - Check if SMS matches financial keywords
   - Review app logs

2. **Pattern Recognition Fails**
   - Check OpenAI API key (if using LLM)
   - Verify SMS format matches expected pattern
   - Check transaction ID format
   - Review pattern recognition logs

3. **Transaction Not Syncing**
   - Verify API key is set
   - Check network connectivity
   - Review backend logs
   - Check transaction sync status

4. **Cache Issues**
   - Clear cache manually: `cache.clear()`
   - Check cache TTL settings
   - Verify cache invalidation on updates

## Test Data

### Sample SMS Messages

**M-Pesa Kenya:**
```
RM123456.00 sent to John Doe 254712345678 on 15/01/24 at 10:30 AM. New M-PESA balance is KES 5,000.00. Transaction cost, KES 0.00. Transaction ID: MP123456789.
```

**CBE Ethiopia:**
```
CBE: You received ETB 500.00 from 0912345678 on Jan 15, 2024. Txn ID: CBE123456789. Balance: ETB 2,500.00
```

**Telebirr Ethiopia:**
```
Telebirr: Payment of ETB 1,500.00 received from 0912345678. Transaction Number: TBR789012345. New balance: ETB 3,000.00
```

## Next Steps

After testing:
1. Review test results
2. Fix any issues found
3. Optimize performance bottlenecks
4. Add additional test cases
5. Prepare for production deployment





