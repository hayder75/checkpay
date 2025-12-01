# Quick Setup Guide

## Step 1: Create Database

```bash
# Option 1: Using postgres user
sudo -u postgres createdb checkpay

# Option 2: If you have a different PostgreSQL user
createdb -U your_username checkpay
```

## Step 2: Create Backend .env File

Create `/home/hayder/checkpay/backend/.env` with:

```env
# Database - UPDATE WITH YOUR POSTGRES CREDENTIALS
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/checkpay?schema=public"

# JWT
JWT_SECRET="checkpay-super-secret-jwt-key-change-in-production-min-32-chars-required"
JWT_EXPIRES_IN="7d"

# Google OAuth (Optional)
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

# Frontend URL
FRONTEND_URL="http://localhost:5173"
```

**Important:** Update `DATABASE_URL` with your actual PostgreSQL username and password!

## Step 3: Create Frontend .env File

Create `/home/hayder/checkpay/dashboard/.env` with:

```env
VITE_API_URL=http://localhost:3000/api
```

## Step 4: Run Database Migrations

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate dev --name init
```

## Step 5: Start Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd dashboard
npm run dev
```

## Step 6: Access Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Prisma Studio (view DB): `cd backend && npm run prisma:studio`

## Troubleshooting

### Database Connection Error
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in backend/.env matches your PostgreSQL credentials
- Try: `psql -U postgres -d checkpay` to test connection

### Migration Errors
- Make sure database exists: `createdb checkpay`
- Check DATABASE_URL is correct
- Try: `cd backend && npx prisma migrate reset` (WARNING: deletes all data)

## What's Ready ✅

- ✅ Pattern Edit Page (just built!)
- ✅ All backend endpoints
- ✅ All frontend pages
- ✅ Database schema
- ✅ Authentication flow
- ✅ Pattern management
- ✅ Transaction handling
- ✅ Premium upgrade

## What's Missing (Optional)

- ⚠️ OTP SMS sending (currently logs to console - needs SMS provider)
- ⚠️ Google OAuth (needs Google Cloud setup)
- ⚠️ Mobile app (separate project)
