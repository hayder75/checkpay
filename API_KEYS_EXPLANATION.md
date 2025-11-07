# Two API Keys System

## Overview

CheckPay now uses **two separate API keys** for different purposes:

1. **App API Key** (`apiKey`) - For mobile app
2. **Developer API Key** (`devApiKey`) - For verification endpoint

## How It Works

### 1. App API Key (Mobile App)
- **Used by**: Mobile app (CheckPay.apk)
- **Endpoints**:
  - `/api/config` - Fetch patterns
  - `/api/ingest` - Send scraped transactions
- **Usage Tracking**: Counted as "app requests"
- **Rate Limit**: Combined with dev requests (total monthly limit)

### 2. Developer API Key (Verification)
- **Used by**: Developer's backend/server
- **Endpoints**:
  - `/api/verify?key=DEV_API_KEY&txn=TRANSACTION_ID` - Verify if transaction exists
- **Usage Tracking**: Counted as "dev requests"
- **Rate Limit**: Combined with app requests (total monthly limit)

## Usage Tracking

Both request types are tracked separately but count towards the same monthly limit:

```json
{
  "usage": {
    "app": {
      "today": 5,
      "month": 45
    },
    "dev": {
      "today": 12,
      "month": 78
    },
    "total": 123  // app + dev = total monthly usage
  },
  "rateLimit": {
    "max": 100,      // FREE plan limit
    "used": 123,
    "remaining": 0
  }
}
```

## Rate Limiting

- **FREE Plan**: 100 requests/month (app + dev combined)
- **PREMIUM Plan**: 1,000,000 requests/month (app + dev combined)
- Both types count towards the same limit
- Headers show breakdown:
  - `X-RateLimit-Usage-App`: App requests this month
  - `X-RateLimit-Usage-Dev`: Dev requests this month

## API Key Detection

The backend automatically detects which key was used:
- If key matches `apiKey` → `apiKeyType = 'app'`
- If key matches `devApiKey` → `apiKeyType = 'dev'`

## Example Usage

### Mobile App (App API Key)
```bash
# Fetch patterns
curl -H "X-API-Key: ckp_abc123" \
  http://localhost:3000/api/config

# Send transaction
curl -X POST -H "X-API-Key: ckp_abc123" \
  -H "Content-Type: application/json" \
  -d '{"txnId":"MP123","amount":500,"sender":"+2547****89"}' \
  http://localhost:3000/api/ingest
```

### Developer Backend (Dev API Key)
```bash
# Verify transaction
curl "http://localhost:3000/api/verify?key=ckp_xyz789&txn=MP123"

# Response
{
  "success": true,
  "data": {
    "confirmed": true,
    "amount": 500,
    "sender": "+2547****89",
    "bank": "M-Pesa",
    "receivedAt": "2025-01-06T10:30:00Z",
    "txnId": "MP123"
  }
}
```

## Database Schema

```prisma
model User {
  apiKey    String   @unique  // App API Key
  devApiKey String   @unique  // Developer API Key
  usageStats UsageStats?
}

model UsageStats {
  appRequestsToday  Int  // App requests today
  appRequestsMonth  Int  // App requests this month
  devRequestsToday  Int  // Dev requests today
  devRequestsMonth  Int  // Dev requests this month
}
```

## Migration

Run the migration to add `devApiKey` and `UsageStats`:
```bash
cd backend
npx prisma migrate deploy
```

Existing users will automatically get:
- A new `devApiKey` generated
- A `UsageStats` record created with zeros

## Frontend Display

The dashboard should show both keys:
- **App API Key**: For mobile app configuration
- **Developer API Key**: For integration documentation

Both keys can be regenerated separately via `/api/auth/regenerate-key` with `{ type: 'app' }` or `{ type: 'dev' }`.

