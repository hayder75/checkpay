# CheckPay API Endpoints Documentation

## Base URL
- Development: `http://localhost:3000/api`
- Production: (configure in environment)

## Authentication Methods

1. **JWT Token** - Used for most endpoints (normal authentication)
   - Header: `Authorization: Bearer <token>`
   - Get token via: `POST /api/auth/login`

2. **API Key** - Used only for verify and config endpoints
   - Header: `X-API-Key: <api_key>`
   - Get API key from user object after login

3. **None** - Public endpoints (no authentication required)

---

## Endpoints

### Health Check
- **GET** `/health`
- **Auth**: None
- **Description**: Check if API is running

---

### Authentication (`/api/auth`)

#### Register
- **POST** `/api/auth/register`
- **Auth**: None
- **Body**: `{ username?, phone?, country? }`
- **Description**: Register a new user

#### Login
- **POST** `/api/auth/login`
- **Auth**: None
- **Body**: `{ username?, phone?, password }`
- **Response**: `{ token, user: { apiKey, devApiKey, ... } }`
- **Description**: Login and get JWT token

#### Verify OTP
- **POST** `/api/auth/verify-otp`
- **Auth**: None
- **Body**: `{ phone?, email?, code, password?, country? }`
- **Description**: Verify OTP code

#### Resend OTP
- **POST** `/api/auth/resend-otp`
- **Auth**: None
- **Body**: `{ phone?, email? }`
- **Description**: Resend OTP code

#### Get Me
- **GET** `/api/auth/me`
- **Auth**: JWT Token
- **Description**: Get current user info

#### Regenerate API Key
- **POST** `/api/auth/regenerate-key`
- **Auth**: JWT Token
- **Description**: Regenerate user's API key

#### SIM Card Management
- **GET** `/api/auth/sims` - Get user's SIM cards (JWT)
- **POST** `/api/auth/sims` - Add SIM card (JWT)
- **DELETE** `/api/auth/sims` - Remove SIM card (JWT)
- **GET** `/api/auth/sims/check?iccid=...` - Check SIM registration (JWT)

---

### Countries (`/api/countries`)

#### Get All Countries
- **GET** `/api/countries`
- **Auth**: None (Public)
- **Description**: Get list of all active countries

#### Detect Country from SMS
- **POST** `/api/countries/detect`
- **Auth**: None (Public)
- **Body**: `{ smsMessages: string[] }`
- **Description**: Detect country from SMS content

#### Get Banks for Country
- **GET** `/api/countries/:code/banks`
- **Auth**: None (Public)
- **Description**: Get banks for a specific country

---

### Patterns (`/api/patterns`)

#### Public Endpoints (No Auth)
- **GET** `/api/patterns/institutions?country=ET` - Get institutions with patterns
- **GET** `/api/patterns/institution/:institution` - Get pattern for institution
- **GET** `/api/patterns/country/:countryCode` - Get all patterns for country
- **POST** `/api/patterns/check-and-extract` - Check pattern and extract data
- **POST** `/api/patterns/create-from-sample` - Create pattern from sample SMS

#### Protected Endpoints (JWT Required)
- **GET** `/api/patterns` - Get user's patterns
- **GET** `/api/patterns/:id` - Get specific pattern
- **POST** `/api/patterns` - Create new pattern
- **PUT** `/api/patterns/:id` - Update pattern
- **DELETE** `/api/patterns/:id` - Delete pattern
- **POST** `/api/patterns/validate` - Validate pattern

---

### Dashboard (`/api/dashboard`)

#### Get Stats
- **GET** `/api/dashboard/stats`
- **Auth**: JWT Token
- **Description**: Get dashboard statistics (transactions, patterns, usage)

#### Get Transactions
- **GET** `/api/dashboard/transactions?page=1&limit=20`
- **Auth**: JWT Token
- **Description**: Get user's transaction history

---

### Ingest (`/api/ingest`)

#### Ingest Transaction
- **POST** `/api/ingest`
- **Auth**: JWT Token ⚠️ **Changed from API Key to JWT**
- **Body**: 
  ```json
  {
    "txnId": "string",
    "amount": number,
    "sender": "string",
    "bank": "string",
    "pattern": "string",
    "smsText": "string?",
    "sendFrom": "string?",
    "sendTo": "string?"
  }
  ```
- **Description**: Send transaction from mobile app to backend

---

### Verify (`/api/verify`)

#### Verify Transaction
- **GET** `/api/verify?txn=<transaction_id>`
- **Auth**: API Key ⚠️ **Still uses API Key (for external API calls)**
- **Description**: Verify if a transaction exists (for payment verification)

---

### Premium (`/api/premium`)

#### Get Premium Status
- **GET** `/api/premium/status`
- **Auth**: JWT Token
- **Description**: Get premium plan status and usage

#### Upgrade to Premium
- **POST** `/api/premium/upgrade`
- **Auth**: JWT Token
- **Body**: `{ txnId: string }`
- **Description**: Upgrade to premium using transaction ID

---

### Config (`/api/config`)

#### Get Config
- **GET** `/api/config`
- **Auth**: API Key ⚠️ **Still uses API Key**
- **Description**: Get user's patterns and API key (for mobile app)

---

### Templates (`/api/templates`)

#### Get Available Templates
- **GET** `/api/templates/available?countryCode=ET`
- **Auth**: JWT Token
- **Description**: Get available pattern templates for country

#### Add Template
- **POST** `/api/templates/:templateId/add`
- **Auth**: JWT Token
- **Description**: Add template to user's patterns

#### Remove Template
- **DELETE** `/api/templates/:templateId/remove`
- **Auth**: JWT Token
- **Description**: Remove template from user's patterns

---

### Admin (`/api/admin`)

All admin endpoints require admin authentication (JWT with admin role).

- **GET** `/api/admin/users` - Get all users
- **GET** `/api/admin/users/:id` - Get specific user
- **PATCH** `/api/admin/users/:id` - Update user
- **GET** `/api/admin/analytics` - Get analytics
- **GET** `/api/admin/patterns` - Get all patterns
- **GET** `/api/admin/transactions` - Get all transactions
- **GET** `/api/admin/countries` - Get all countries
- **GET** `/api/admin/countries/:code` - Get specific country
- **PATCH** `/api/admin/countries/:code` - Update country
- **POST** `/api/admin/countries/:countryCode/templates` - Create template
- **GET** `/api/admin/countries/:countryCode/templates` - Get templates
- **PUT** `/api/admin/templates/:templateId` - Update template
- **DELETE** `/api/admin/templates/:templateId` - Delete template
- **GET** `/api/admin/missing-templates` - Get missing templates
- **POST** `/api/admin/missing-templates/:patternId/add` - Add missing template
- **POST** `/api/admin/missing-templates/:patternId/dismiss` - Dismiss missing template
- **GET** `/api/admin/audit-logs` - Get audit logs
- **GET** `/api/admin/system-health` - Get system health

---

### Test (`/api/test`)

- **POST** `/api/test/pattern` - Test pattern matching
- **POST** `/api/test/batch` - Test batch pattern matching
- **GET** `/api/test/samples` - Get sample SMS messages

---

## Authentication Changes Summary

### ✅ Changed to JWT Token:
- `/api/ingest` - Now uses JWT token (was API key)

### ⚠️ Still Uses API Key:
- `/api/verify` - For external payment verification
- `/api/config` - For mobile app configuration

### ✅ Uses JWT Token:
- All `/api/auth/*` endpoints (except register/login/verify-otp)
- All `/api/dashboard/*` endpoints
- All `/api/patterns/*` endpoints (except public ones)
- All `/api/premium/*` endpoints
- All `/api/templates/*` endpoints
- All `/api/admin/*` endpoints

### ✅ Public (No Auth):
- `/health`
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/verify-otp`
- `/api/auth/resend-otp`
- `/api/countries/*` (most endpoints)
- `/api/patterns/institutions`
- `/api/patterns/country/:code`
- `/api/patterns/check-and-extract`
- `/api/patterns/create-from-sample`

---

## Testing

Run the comprehensive test script:
```bash
./test-all-endpoints.sh [BASE_URL] [USERNAME] [PASSWORD]
```

Example:
```bash
./test-all-endpoints.sh http://localhost:3000/api abebeb 123456
```



