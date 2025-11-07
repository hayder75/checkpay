#!/bin/bash

# CheckPay Database Setup Script

echo "🔧 Setting up CheckPay database..."

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Create database if it doesn't exist
echo "📦 Creating database..."
createdb checkpay 2>/dev/null && echo "✅ Database 'checkpay' created" || echo "ℹ️  Database 'checkpay' already exists"

# Create .env file for backend if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env file..."
    cat > backend/.env << 'EOF'
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/checkpay?schema=public"

# JWT
JWT_SECRET="checkpay-super-secret-jwt-key-change-in-production-min-32-chars-required"
JWT_EXPIRES_IN="7d"

# Google OAuth (Optional - configure later)
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
EOF
    echo "✅ Backend .env file created"
else
    echo "ℹ️  Backend .env file already exists"
fi

# Create .env file for frontend if it doesn't exist
if [ ! -f dashboard/.env ]; then
    echo "📝 Creating dashboard/.env file..."
    echo 'VITE_API_URL=http://localhost:3000/api' > dashboard/.env
    echo "✅ Frontend .env file created"
else
    echo "ℹ️  Frontend .env file already exists"
fi

# Run Prisma migrations
echo "🔄 Running Prisma migrations..."
cd backend
npm run prisma:generate
npm run prisma:migrate dev --name init

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update backend/.env with your PostgreSQL credentials if needed"
echo "2. Start backend: cd backend && npm run dev"
echo "3. Start frontend: cd dashboard && npm run dev"
