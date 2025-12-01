# CheckPay System Architecture & User Flow

## 📋 Project Overview

**CheckPay** is a Universal SMS Transaction Parser for Africa that automatically extracts transaction information from SMS messages sent by banks and mobile money services (M-Pesa, Airtel Money, Telebirr, etc.). The system enables:

1. **Mobile App Users**: Automatically track transactions from SMS messages
2. **Merchants/Developers**: Verify customer payments via API
3. **Pattern Management**: Create and share transaction parsing patterns

---

## 🏗️ System Architecture

### Components

1. **Backend API** (Node.js + Express + TypeScript + Prisma)
   - RESTful API server
   - PostgreSQL database
   - JWT authentication
   - API key authentication for external services

2. **Dashboard Frontend** (React + TypeScript + Vite)
   - Web interface for users
   - Pattern management
   - Transaction history
   - Analytics and settings

3. **Mobile App** (React Native + Expo)
   - SMS monitoring and parsing
   - Automatic transaction extraction
   - Local storage with cloud sync
   - Onboarding flow for new users

---

## 🔄 Complete User Flow (Step-by-Step)

### **Scenario 1: New Mobile App User (First Time)**

#### Step 1: App Installation
- User installs CheckPay mobile app
- App requests SMS permission (required for transaction detection)

#### Step 2: Onboarding
- **Country Detection**: App auto-detects country from device locale/SIM
- **SMS Scanning**: App scans last 200-500 SMS messages
- **Financial SMS Detection**: Filters SMS using keywords (payment, transaction, received, etc.)
- **Institution Discovery**: Extracts sender addresses (phone numbers) from financial SMS

#### Step 3: Institution Selection
- User sees list of financial institutions found in their SMS
- User selects ONE institution to set up (e.g., "M-Pesa", "Telebirr")
- App calls backend: `GET /api/patterns/institution/:institution?country=:countryCode`
- **If pattern exists**: Skip to registration
- **If pattern doesn't exist**: Continue to sample SMS collection

#### Step 4: Sample SMS Collection (Only if pattern doesn't exist)
- User provides:
  - SMS text (multiline input)
  - Transaction ID (separate field for validation)
- App calls backend: `POST /api/patterns/create-from-sample`
- Backend uses AI (Gemini/OpenAI) to:
  - Extract transaction ID from SMS
  - Validate against user-provided ID
  - Generate regex pattern
  - Create `InstitutionPattern` in database
- If validation fails: User can retry

#### Step 5: Registration
- User enters phone number
- Backend sends OTP: `POST /api/auth/register`
- User verifies OTP: `POST /api/auth/verify-otp`
- Backend creates user account and returns:
  - JWT token (for authenticated requests)
  - API key (for external verification)
  - User patterns (downloaded from backend)

#### Step 6: Main App (SMS Monitoring Active)
- App starts monitoring SMS in real-time (5-second intervals)
- When financial SMS detected:
  1. Matches against patterns (local + downloaded institution patterns)
  2. Extracts transaction data (txnId, amount, sender, bank)
  3. Saves locally
  4. Syncs to backend: `POST /api/ingest` (if authenticated)
- User can view transactions in app
- Transactions sync to backend automatically

---

### **Scenario 2: Existing User (Returning)**

#### Step 1: App Launch
- App checks for stored credentials (JWT token + API key)
- If found: Auto-authenticates and loads patterns
- If not found: Shows login screen

#### Step 2: Login (if needed)
- User enters username/phone + password
- Backend: `POST /api/auth/login`
- Returns JWT token + user data + patterns

#### Step 3: SMS Monitoring
- App automatically monitors SMS
- Extracts and syncs transactions
- User views dashboard with stats

---

### **Scenario 3: Merchant/Developer Verification**

#### Option A: API Integration (Developer has system)

1. **Customer makes payment**
   - Customer pays via mobile money
   - Receives SMS with transaction ID (e.g., "MP123456789")
   - Customer provides transaction ID to merchant

2. **Merchant's system verifies payment**
   ```
   GET /api/verify?key=DEV_API_KEY&txn=MP123456789
   ```
   - Uses developer API key (different from user API key)
   - Returns: `{ confirmed: true/false, amount, sender, bank, receivedAt }`

3. **Merchant processes result**
   - If `confirmed: true`: Release product, send receipt, update order
   - If `confirmed: false`: Ask customer to wait or retry (with exponential backoff)

#### Option B: Web Portal (Merchant doesn't have system)

1. Customer visits: `https://checkpay.com/verify/:merchantId`
2. Enters transaction ID
3. System verifies and displays result
4. Merchant can see verification status

---

### **Scenario 4: Dashboard User (Web Interface)**

#### Step 1: Login
- User visits dashboard: `http://localhost:5173`
- Logs in with username/phone + password
- Or uses Google OAuth

#### Step 2: Dashboard Features
- **Pattern Management**:
  - Create patterns from SMS: `POST /api/patterns`
  - View all patterns: `GET /api/patterns`
  - Edit/delete patterns: `PUT /api/patterns/:id`, `DELETE /api/patterns/:id`
  - Browse marketplace templates: `GET /api/templates/available`
  
- **Transaction History**:
  - View all transactions: `GET /api/dashboard/transactions`
  - Filter by date, bank, amount
  - Export data

- **Analytics**:
  - View stats: `GET /api/dashboard/stats`
  - Usage limits (Free: 100/month, Premium: unlimited)
  - Transaction trends

- **Settings**:
  - Manage API keys
  - Upgrade to Premium
  - SIM card management

---

## 🗄️ Database Schema Overview

### Core Models

#### **User**
- Authentication: username/email/phone, password (bcrypt), Google OAuth
- API Keys: `apiKey` (for mobile app), `devApiKey` (for developers)
- Plan: FREE (100 transactions/month) or PREMIUM (unlimited)
- Country: ISO country code (e.g., "ET", "KE", "NG")

#### **Pattern**
- User-created patterns for SMS parsing
- Contains: regex, extractFields (JSON), bank, currency
- Linked to user
- FREE users limited to 4 patterns

#### **InstitutionPattern**
- Shared patterns per institution + country
- Created from user samples (validated with AI)
- Used by all users in that country
- Fields: institution (phone/name), countryCode, regex, extractFields, isVerified, usageCount

#### **CountryPattern**
- Country-wide templates (admin-created)
- Can be subscribed to by users
- Fields: countryId, name, regex, extractFields, isTemplate, isApproved

#### **Transaction**
- Parsed transactions from mobile app
- Fields: userId, txnId, amount, sender, sendFrom, sendTo, bank, patternId, receivedAt
- Unique constraint: (userId, txnId)

#### **UserInstitution**
- Links users to their selected institutions
- References InstitutionPattern if exists

#### **UsageStats**
- Tracks API usage per user
- Separate counters for app requests (ingest) and dev requests (verify)
- Resets monthly

#### **SimCard**
- Tracks registered SIM cards per user
- FREE users: 1 SIM, PREMIUM: unlimited
- Used for SIM-based transaction validation

---

## 🔌 API Endpoints Reference

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Register new user (phone/email) |
| POST | `/api/auth/login` | None | Login (username/phone + password) |
| POST | `/api/auth/verify-otp` | None | Verify OTP code |
| POST | `/api/auth/resend-otp` | None | Resend OTP |
| GET | `/api/auth/me` | JWT | Get current user |
| POST | `/api/auth/regenerate-key` | JWT | Regenerate API key |
| GET | `/api/auth/sims` | JWT | Get user's SIM cards |
| POST | `/api/auth/sims` | JWT | Add SIM card |
| DELETE | `/api/auth/sims` | JWT | Remove SIM card |

### Patterns (`/api/patterns`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/patterns` | JWT | Create pattern from SMS |
| GET | `/api/patterns` | JWT | List user's patterns |
| GET | `/api/patterns/:id` | JWT | Get single pattern |
| PUT | `/api/patterns/:id` | JWT | Update pattern |
| DELETE | `/api/patterns/:id` | JWT | Delete pattern |
| POST | `/api/patterns/validate` | JWT | Validate pattern before saving |
| GET | `/api/patterns/institution/:institution` | None | Check if pattern exists for institution |
| GET | `/api/patterns/institutions` | None | List institutions with patterns for country |
| GET | `/api/patterns/country/:countryCode` | None | Get all patterns for country (for mobile app) |
| POST | `/api/patterns/check-and-extract` | None | Check pattern and extract data from SMS |
| POST | `/api/patterns/create-from-sample` | None | Create pattern from sample SMS (onboarding) |

### Transaction Ingestion (`/api/ingest`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/ingest` | JWT | Receive parsed transaction from mobile app |

**Request Body:**
```json
{
  "txnId": "MP123456789",
  "amount": 100.50,
  "sender": "2547******",
  "bank": "M-Pesa",
  "sendFrom": "John Doe",
  "sendTo": "Merchant Name",
  "iccid": "SIM_CARD_ID" // Optional
}
```

### Verification (`/api/verify`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/verify?key=xxx&txn=MP123456789` | API Key | Verify transaction by ID |

**Response:**
```json
{
  "success": true,
  "data": {
    "confirmed": true,
    "amount": 100.50,
    "sender": "2547******",
    "bank": "M-Pesa",
    "receivedAt": "2025-01-06T10:30:00Z",
    "txnId": "MP123456789"
  }
}
```

### Dashboard (`/api/dashboard`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard/stats` | JWT | Get usage statistics |
| GET | `/api/dashboard/transactions` | JWT | Get transaction history (paginated) |

### Templates (`/api/templates`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/templates/available` | JWT | Get available templates for user's country |
| POST | `/api/templates/:templateId/add` | JWT | Add template to user's patterns |
| DELETE | `/api/templates/:templateId/remove` | JWT | Remove template from user's patterns |

### Countries (`/api/countries`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/countries` | None | List all countries |
| GET | `/api/countries/:code` | None | Get country details |

### Admin (`/api/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/dashboard` | JWT (Admin) | Admin dashboard stats |
| GET | `/api/admin/users` | JWT (Admin) | User management |
| GET | `/api/admin/patterns` | JWT (Admin) | Pattern management |
| GET | `/api/admin/transactions` | JWT (Admin) | Transaction monitoring |
| GET | `/api/admin/missing-templates` | JWT (Admin) | Flagged patterns (missing templates) |

---

## 🔐 Authentication Methods

### 1. JWT Token (Dashboard & Mobile App)
- Obtained via: `POST /api/auth/login`
- Header: `Authorization: Bearer <token>`
- Used for: Dashboard, mobile app sync, pattern management

### 2. API Key (External Services)
- User API Key: For mobile app (legacy, now uses JWT)
- Developer API Key (`devApiKey`): For verification API
- Header: `X-API-Key: ckp_xxx`
- Query: `?key=ckp_xxx`
- Used for: `/api/verify` endpoint

---

## 📊 Data Flow Diagrams

### Transaction Detection Flow

```
SMS Received (Mobile Device)
    ↓
SMS Service (Mobile App)
    ↓
Pattern Matching (Local + Downloaded Patterns)
    ↓
Transaction Extraction (Regex + AI)
    ↓
Local Storage (Mobile App)
    ↓
Backend Sync (POST /api/ingest) [If authenticated]
    ↓
Database (Transaction Table)
    ↓
Available for Verification (GET /api/verify)
```

### Pattern Creation Flow

```
User Provides SMS + Transaction ID
    ↓
Backend: AI Extraction (Gemini/OpenAI)
    ↓
Validation (Compare extracted ID with user ID)
    ↓
Pattern Generation (Regex + Extract Fields)
    ↓
Create InstitutionPattern (if new institution)
    ↓
OR
    ↓
Create User Pattern (if user-specific)
    ↓
Store in Database
    ↓
Available for Matching
```

### Verification Flow

```
Customer Payment
    ↓
SMS Sent to Customer
    ↓
CheckPay Mobile App Detects SMS
    ↓
Transaction Extracted & Synced to Backend
    ↓
Merchant Calls: GET /api/verify?key=xxx&txn=MP123456789
    ↓
Backend Checks Transaction Table
    ↓
Returns: { confirmed: true/false, amount, sender, bank }
    ↓
Merchant Processes Payment
```

---

## 🎯 Key Features

### Mobile App
- ✅ Real-time SMS monitoring
- ✅ Automatic transaction extraction
- ✅ Local storage with cloud sync
- ✅ Onboarding flow for new institutions
- ✅ Offline support (local patterns)

### Backend
- ✅ AI-powered pattern generation (Gemini/OpenAI)
- ✅ Institution-based pattern sharing
- ✅ Transaction verification API
- ✅ Usage tracking and rate limiting
- ✅ Admin dashboard

### Dashboard
- ✅ Pattern management
- ✅ Transaction history
- ✅ Analytics and statistics
- ✅ API key management
- ✅ Premium upgrade

---

## 🔧 Technical Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: JWT, bcrypt
- **AI**: Google Gemini, OpenAI (optional)

### Frontend (Dashboard)
- **Framework**: React
- **Language**: TypeScript
- **Build Tool**: Vite
- **UI**: Tailwind CSS, shadcn/ui
- **Routing**: React Router

### Mobile App
- **Framework**: React Native
- **Platform**: Expo
- **Storage**: AsyncStorage
- **SMS**: expo-sms (Android), native modules

---

## 📝 Notes

- **Rate Limiting**: FREE plan = 100 transactions/month, PREMIUM = unlimited
- **Pattern Limits**: FREE users = 4 patterns max, PREMIUM = unlimited
- **SIM Cards**: FREE = 1 SIM, PREMIUM = unlimited
- **AI Providers**: Supports Gemini (recommended, free tier), OpenAI, Hugging Face, Ollama
- **Caching**: Institution patterns cached for 10 minutes
- **Audit Logging**: All API requests logged for security

---

## 🐛 Fixed Issues

### patternController.ts Errors (Fixed)
- ✅ Fixed `InstitutionPattern` type errors by using type assertions
- ✅ Fixed implicit `any` type errors in map functions
- ✅ Prisma client regenerated to include InstitutionPattern model

---

## 🚀 Next Steps

1. **Database Migration**: Ensure all tables exist (may need to create initial migration)
2. **Testing**: Test all endpoints with sample data
3. **Documentation**: API documentation with examples
4. **Monitoring**: Set up error tracking and logging
5. **Performance**: Optimize pattern matching and AI extraction


