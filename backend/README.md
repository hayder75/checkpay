# CheckPay Backend API

Universal SMS Transaction Parser for Africa - Backend API

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/checkpay?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"

# Server
PORT=3000
NODE_ENV="development"

# OTP
OTP_SECRET="otp-secret-key"
OTP_EXPIRES_IN_MINUTES=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=86400000
RATE_LIMIT_FREE_MAX=100
RATE_LIMIT_PREMIUM_MAX=1000000

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:5173"

# AI Provider Configuration (Optional - for LLM extraction)
# Set AI_PROVIDER to 'gemini', 'huggingface', 'openai', 'ollama', or 'auto' (tries all)
AI_PROVIDER=auto

# Google Gemini (FREE tier available - Recommended)
# Get your API key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite-preview-06-17

# Hugging Face (FREE - Currently migrating endpoints)
# Get your API token from: https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=meta-llama/Llama-3-8B-Instruct

# OpenAI (Optional - has free credits for new accounts)
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini

# Ollama (Optional - Local AI, 100% free)
# OLLAMA_URL=http://localhost:11434
# OLLAMA_MODEL=llama3
```

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

### 4. Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication (`/api/auth`)

- `POST /api/auth/register` - Register new user (email or phone)
- `POST /api/auth/verify-otp` - Verify OTP code
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current user (requires JWT)
- `POST /api/auth/regenerate-key` - Regenerate API key (requires JWT)

### Patterns (`/api/patterns`)

- `POST /api/patterns` - Create pattern from SMS text
- `GET /api/patterns` - List all user's patterns
- `GET /api/patterns/:id` - Get single pattern
- `PUT /api/patterns/:id` - Update pattern
- `DELETE /api/patterns/:id` - Delete pattern
- `POST /api/patterns/validate` - Validate pattern before saving

### Transaction Ingestion (`/api/ingest`)

- `POST /api/ingest` - Receive parsed transaction from mobile app (requires API key)

### Verification (`/api/verify`)

- `GET /api/verify?key=xxx&txn=MP123456789` - Verify transaction by ID (requires API key)

### Premium (`/api/premium`)

- `POST /api/premium/upgrade` - Upgrade to premium via TXN ID (requires JWT)
- `GET /api/premium/status` - Get premium status and usage (requires JWT)

### Dashboard (`/api/dashboard`)

- `GET /api/dashboard/stats` - Get usage statistics (requires JWT)
- `GET /api/dashboard/transactions` - Get transaction history (requires JWT)

### Mobile Config (`/api/config`)

- `GET /api/config` - Get all patterns + API key for mobile app (requires API key)

## Authentication

### JWT Authentication (Dashboard)
Include JWT token in Authorization header:
```
Authorization: Bearer <token>
```

### API Key Authentication (Mobile App)
Include API key in header or query:
```
X-API-Key: ckp_xxx
```
or
```
?key=ckp_xxx
```

## Rate Limiting

- **Free Plan**: 100 transactions per 24 hours
- **Premium Plan**: Unlimited transactions

Rate limits are enforced on the `/api/ingest` endpoint.

## Database Models

- **User**: User accounts with API keys and plans
- **Pattern**: SMS parsing patterns (regex + extraction rules)
- **Transaction**: Parsed transactions from mobile app
- **OTP**: One-time passwords for phone verification
- **AuditLog**: API request audit trail

## Development

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Database migrations
npm run prisma:migrate

# View database
npm run prisma:studio
```

## Testing

```bash
npm test
```

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma       # Database schema
├── src/
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Auth, rate limiting, etc.
│   ├── routes/             # Route definitions
│   ├── utils/              # Helper functions
│   └── server.ts           # Express app entry point
├── package.json
└── tsconfig.json
```

