# CheckPay Setup Guide

## Database Setup (REQUIRED BEFORE USE)

### 1. Install PostgreSQL
Make sure PostgreSQL is installed and running on your system.

### 2. Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE checkpay;

# Exit
\q
```

### 3. Configure Backend Environment
Create `/backend/.env` file:
```env
# Database (UPDATE WITH YOUR CREDENTIALS)
DATABASE_URL="postgresql://postgres:password@localhost:5432/checkpay?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production-min-32-chars"
JWT_EXPIRES_IN="7d"

# Google OAuth (Optional for now)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"

# Server
PORT=3000
NODE_ENV="development"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=86400000
RATE_LIMIT_FREE_MAX=100
RATE_LIMIT_PREMIUM_MAX=1000000

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:5173"
```

### 4. Run Database Migrations
```bash
cd backend

# Generate Prisma Client
npm run prisma:generate

# Create and run migrations
npm run prisma:migrate

# (Optional) View database in browser
npm run prisma:studio
```

### 5. Start Backend
```bash
cd backend
npm run dev
```

### 6. Configure Frontend Environment
Create `/dashboard/.env` file:
```env
VITE_API_URL=http://localhost:3000/api
```

### 7. Start Frontend
```bash
cd dashboard
npm run dev
```

## What's Working ✅

- ✅ Backend API endpoints (all routes implemented)
- ✅ Frontend pages (all pages built)
- ✅ Authentication flow (JWT + OTP)
- ✅ Pattern creation and management
- ✅ Transaction ingestion endpoint
- ✅ Verification endpoint
- ✅ Premium upgrade flow
- ✅ Dashboard with stats
- ✅ API key management
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Mobile app config endpoint

## What's Missing / Needs Setup ⚠️

### Critical (Must Setup):
1. **Database** - PostgreSQL not configured yet
2. **Environment Variables** - `.env` files not created
3. **OTP SMS Service** - Currently just logs to console (needs SMS provider integration)

### Optional / Future Enhancements:
1. **Google OAuth** - Needs Google Cloud Console setup
2. **Onboarding Flow** - Mentioned but not implemented (can skip for now)
3. **Pattern Edit Page** - Edit route exists but page not built (can use create for now)
4. **Email Registration** - Works but no email verification
5. **SMS Provider Integration** - For sending OTP codes
6. **Mobile App** - Not built (separate project)

## Testing Checklist

Once database is set up:

1. ✅ Register with phone → Should create OTP in database
2. ✅ Verify OTP → Should create user and return JWT
3. ✅ Login → Should authenticate and show dashboard
4. ✅ Create pattern → Should save to database
5. ✅ View patterns → Should list all user patterns
6. ✅ View transactions → Should show empty (until mobile app sends data)
7. ✅ Premium upgrade → Should work with transaction ID
8. ✅ API key regeneration → Should update in database

## Quick Test Commands

```bash
# Test database connection
cd backend
npm run prisma:studio  # Opens browser to view database

# Test backend API
curl http://localhost:3000/health

# Test registration (after DB setup)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "+254712345678"}'
```
