# Testing Setup Guide

## 🚀 Quick Start

### 1. Database Setup

**Check your PostgreSQL credentials** and update `backend/.env`:
```env
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/checkpay?schema=public"
```

**Default (if using default postgres user):**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/checkpay?schema=public"
```

**Or if you have a different setup:**
```env
DATABASE_URL="postgresql://your_username:your_password@localhost:5432/checkpay?schema=public"
```

### 2. Get User Credentials

Run this script to see all users:
```bash
cd backend
npx tsx scripts/getUsers.ts
```

### 3. Create Admin User (if needed)

```bash
cd backend
npx tsx src/utils/createAdmin.ts
```

**Admin credentials:**
- Email: `admin@checkpay.com`
- Phone: `+1234567890` (placeholder)
- To login: Use email/phone and request OTP (check backend console)

### 4. Start Servers

**Backend (Terminal 1):**
```bash
cd backend
npm run dev
```
- Runs on: http://localhost:3000
- Health check: http://localhost:3000/health

**Dashboard (Terminal 2):**
```bash
cd dashboard
npm run dev
```
- Runs on: http://localhost:5173

### 5. Login Instructions

**For users WITH password:**
1. Go to http://localhost:5173/auth/login
2. Enter username/phone/email
3. Enter password
4. Click Login

**For users WITHOUT password:**
1. Go to http://localhost:5173/auth/register
2. Enter phone/username
3. Request OTP
4. Check backend console for OTP code
5. Enter OTP + set password
6. Complete registration

## 📋 User Credentials Script

The `scripts/getUsers.ts` script will show:
- All users in database
- Username/Email/Phone
- Role (USER/ADMIN/SUPER_ADMIN)
- Plan (FREE/PREMIUM)
- Whether password is set
- API keys (truncated)
- Login instructions

## 🔧 Troubleshooting

### Database Connection Error
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `backend/.env`
- Test connection: `psql -U postgres -d checkpay`

### No Users Found
- Run: `npx tsx src/utils/createAdmin.ts`
- Or register a new user via dashboard

### Port Already in Use
- Backend: Change `PORT` in `backend/.env`
- Dashboard: Change port in `dashboard/vite.config.ts`


