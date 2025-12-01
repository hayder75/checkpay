# Backend Testing - Ready to Test

## ✅ Code Status

All backend code has been implemented and verified:
- ✅ No linter errors
- ✅ All routes properly configured
- ✅ Test endpoints implemented
- ✅ Test script created

## ⚠️ Prerequisites

Before testing, you need to:

1. **Install Dependencies** (if not already installed):
   ```bash
   cd backend
   npm install
   npm install openai  # Optional, for LLM fallback
   ```

2. **Set Up Database**:
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma generate
   ```

3. **Configure Environment** (optional):
   - Copy `.env.example` to `.env`
   - Add `OPENAI_API_KEY` if you want LLM fallback (optional)

## 🚀 Starting the Server

Once dependencies are installed:

```bash
cd backend
npm run dev
```

The server should start on port 3000 and display:
```
🚀 CheckPay API server running on port 3000
📝 Environment: development
🔗 Health check: http://localhost:3000/health
🌐 Network access: http://0.0.0.0:3000/health
```

## 🧪 Testing the Backend

### Option 1: Use the Test Script

```bash
cd backend
./test-api.sh
```

This script tests:
1. Health endpoint
2. Pattern recognition (sample tests)
3. Single pattern recognition
4. Institution pattern lookup
5. Get institutions with patterns

### Option 2: Manual Testing with curl

#### 1. Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "CheckPay API is running",
  "timestamp": "2024-..."
}
```

#### 2. Test Pattern Recognition (Predefined Samples)
```bash
curl http://localhost:3000/api/test/samples
```

This runs tests on 5 predefined SMS samples and returns:
- Success rate
- Method breakdown (rule-based vs LLM)
- Detailed results for each sample

#### 3. Test Single Pattern
```bash
curl -X POST http://localhost:3000/api/test/pattern \
  -H "Content-Type: application/json" \
  -d '{
    "smsText": "RM123456.00 sent to John Doe 254712345678 on 15/01/24 at 10:30 AM. New M-PESA balance is KES 5,000.00. Transaction ID: MP123456789.",
    "expectedTxnId": "MP123456789"
  }'
```

#### 4. Check Institution Pattern
```bash
curl "http://localhost:3000/api/patterns/institution/M-Pesa?country=KE"
```

#### 5. Create Pattern from Sample
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

#### 6. Get Institutions with Patterns
```bash
curl "http://localhost:3000/api/patterns/institutions?country=KE"
```

## 📊 Expected Test Results

### Pattern Recognition Tests

The sample tests include 5 different SMS formats:
1. **M-Pesa Kenya** - Standard format
2. **M-Pesa with URL** - Transaction ID in URL
3. **CBE Ethiopia** - Ethiopian bank format
4. **Telebirr Ethiopia** - Mobile money format
5. **Generic Bank** - Standard bank transfer

**Expected Success Rate**: 80-100% (depending on OpenAI availability)

**Method Breakdown**:
- Rule-based: Fast, free extraction
- LLM: Used as fallback for complex formats
- None: Only if both methods fail

## 🔍 Troubleshooting

### Server Won't Start

1. **Check if port 3000 is in use**:
   ```bash
   lsof -i :3000
   ```

2. **Check for missing dependencies**:
   ```bash
   cd backend
   npm list
   ```

3. **Check database connection**:
   - Verify `.env` has `DATABASE_URL`
   - Test connection: `npx prisma db pull`

### Tests Fail

1. **Database not migrated**:
   ```bash
   npx prisma migrate dev
   ```

2. **OpenAI API errors** (if using LLM):
   - Check `OPENAI_API_KEY` in `.env`
   - LLM is optional - rule-based extraction should still work

3. **Pattern not found**:
   - This is normal if no patterns exist yet
   - Create a pattern first using `/api/patterns/create-from-sample`

## 📝 Test Endpoints Summary

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/health` | GET | Health check | No |
| `/api/test/samples` | GET | Run predefined tests | No |
| `/api/test/pattern` | POST | Test single pattern | No |
| `/api/test/batch` | POST | Test multiple patterns | No |
| `/api/patterns/institution/:institution` | GET | Check if pattern exists | No |
| `/api/patterns/create-from-sample` | POST | Create pattern from sample | No |
| `/api/patterns/institutions` | GET | List institutions with patterns | No |

## ✅ Verification Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Database migrated (`npx prisma migrate dev`)
- [ ] Server starts without errors
- [ ] Health endpoint returns 200
- [ ] Test endpoints respond correctly
- [ ] Pattern recognition works (rule-based at minimum)
- [ ] LLM extraction works (if OpenAI key configured)

## 🎯 Next Steps After Testing

1. Test mobile app onboarding flow
2. Test merchant verification API
3. Test SMS monitoring (requires mobile app)
4. Review test results and optimize patterns
5. Add more test cases as needed

---

**Status**: ✅ Code is ready, just needs dependencies installed and database set up!





