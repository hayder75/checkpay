# Testing Guide for CheckPay System

This guide helps you test the complete CheckPay system workflow.

## Prerequisites

1. ✅ Backend running on `http://localhost:3000`
2. ✅ Dashboard running on `http://localhost:5173`
3. ✅ Admin user created (username: `admin`, password: `admin123`)
4. ✅ Database connected and migrations applied

## Test Plan

### 1. Test Pattern Creation from SMS

**Goal**: Verify that the system can create patterns from SMS text.

**Steps**:
1. Run the pattern creation test script:
   ```bash
   cd backend
   npx tsx scripts/testPatternCreation.ts
   ```

2. This will test pattern generation from sample SMS texts and show:
   - Bank detection
   - Currency detection
   - Transaction ID extraction
   - Amount extraction
   - Sender extraction
   - Regex pattern generation

**Expected Result**: Patterns should be generated successfully with all fields extracted.

---

### 2. Insert Test Transactions

**Goal**: Insert sample transactions into the database for testing.

**Steps**:
1. Run the transaction insertion script:
   ```bash
   cd backend
   npx tsx scripts/insertTestTransactions.ts
   ```

2. This will:
   - Insert 5 sample transactions for the admin user
   - Display the developer API key
   - Show test commands for verification

**Expected Result**: 
- 5 transactions inserted successfully
- Developer API key displayed
- Test commands provided

---

### 3. Test Developer Verification Endpoint

**Goal**: Verify that developers can check if a transaction exists using the API.

**Endpoint**: `GET /api/verify?key=DEV_API_KEY&txn=TRANSACTION_ID`

**Steps**:

1. **Get the Developer API Key**:
   - After running `insertTestTransactions.ts`, the script will display the API key
   - Or get it from the database:
     ```bash
     cd backend
     npx tsx scripts/getUsers.ts | grep -A 5 "admin"
     ```

2. **Test Exact Match**:
   ```bash
   curl "http://localhost:3000/api/verify?key=YOUR_DEV_API_KEY&txn=TXN123456789"
   ```

   **Expected Response**:
   ```json
   {
     "success": true,
     "confirmed": true,
     "data": {
       "txnId": "TXN123456789",
       "amount": 5000.00,
       "sender": "****1234",
       "bank": "Telebirr",
       "receivedAt": "2025-12-01T..."
     }
   }
   ```

3. **Test Partial Match** (using prefix):
   ```bash
   curl "http://localhost:3000/api/verify?key=YOUR_DEV_API_KEY&txn=TXN12345"
   ```

   **Expected Response**: Should still find the transaction with partial match.

4. **Test Non-Existent Transaction**:
   ```bash
   curl "http://localhost:3000/api/verify?key=YOUR_DEV_API_KEY&txn=INVALID123"
   ```

   **Expected Response**:
   ```json
   {
     "success": true,
     "confirmed": false,
     "message": "Transaction not found"
   }
   ```

5. **Test Invalid API Key**:
   ```bash
   curl "http://localhost:3000/api/verify?key=INVALID_KEY&txn=TXN123456789"
   ```

   **Expected Response**: 401 Unauthorized

---

### 4. Test Pattern Creation via API

**Goal**: Create a pattern from SMS text using the API.

**Endpoint**: `POST /api/patterns`

**Steps**:

1. **Login to get JWT token**:
   ```bash
   TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}' \
     | jq -r '.data.token')
   ```

2. **Create a pattern**:
   ```bash
   curl -X POST http://localhost:3000/api/patterns \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{
       "smsText": "You have received ETB 5,000.00 from 0912345678. Transaction ID: TXN123456789. Balance: ETB 15,000.00.",
       "name": "Test Pattern",
       "description": "Test pattern creation"
     }'
   ```

   **Expected Response**: Pattern created with extracted fields.

---

### 5. Test Transaction Ingestion (Mobile App Flow)

**Goal**: Simulate mobile app uploading a transaction.

**Endpoint**: `POST /api/ingest`

**Steps**:

1. **Get JWT token** (same as above)

2. **Ingest a transaction**:
   ```bash
   curl -X POST http://localhost:3000/api/ingest \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{
       "txnId": "MOBILE123456",
       "amount": 3000.00,
       "sender": "****9999",
       "bank": "Telebirr",
       "pattern": "Test Pattern"
     }'
   ```

   **Expected Response**: Transaction created successfully.

---

## Complete Test Workflow

1. **Run all test scripts**:
   ```bash
   cd backend
   
   # Test pattern creation
   npx tsx scripts/testPatternCreation.ts
   
   # Insert test transactions
   npx tsx scripts/insertTestTransactions.ts
   ```

2. **Test developer verification** (use the API key from step 1):
   ```bash
   # Replace YOUR_DEV_API_KEY with the key from insertTestTransactions.ts
   curl "http://localhost:3000/api/verify?key=YOUR_DEV_API_KEY&txn=TXN123456789"
   ```

3. **Verify in dashboard**:
   - Login to `http://localhost:5173` with admin/admin123
   - Go to Transactions page
   - You should see the test transactions

---

## Sample Test Data

### Sample Transactions (inserted by script):
- `TXN123456789` - ETB 5,000.00 - Telebirr
- `MOMO987654321` - KES 2,500.50 - M-Pesa
- `CBETX20241201001` - ETB 10,000.00 - Commercial Bank
- `AB123XYZ45` - ETB 750.25 - Awash Bank
- `PAY20241201ABC` - ETB 15,000.00 - Dashen Bank

### Sample SMS Texts (for pattern creation):
- Telebirr receive notification
- M-Pesa payment notification
- Bank transfer notification
- Awash Bank transaction notification

---

## Troubleshooting

### Pattern creation fails:
- Check if AI provider is configured (Gemini API key)
- Check database connection
- Verify user has pattern creation permissions

### Transactions not found:
- Verify transaction was inserted correctly
- Check transaction ID matches exactly
- Verify API key is correct (devApiKey, not apiKey)

### CORS errors:
- Ensure backend CORS is configured for `http://localhost:5173`
- Check browser console for exact error
- Try hard refresh (Ctrl+Shift+R)

---

## Next Steps

After testing:
1. Create real patterns from actual SMS texts
2. Test with mobile app (if available)
3. Test with multiple users
4. Test rate limiting
5. Test usage tracking
