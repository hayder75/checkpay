#!/bin/bash

# Test JWT authentication and transaction ingestion
# Usage: ./test-jwt-auth.sh

BASE_URL=${1:-"http://localhost:3000/api"}
USERNAME="abebeb"
PHONE="0908070504"
PASSWORD="123456"

echo "🧪 Testing JWT Authentication"
echo "=============================="
echo "Base URL: $BASE_URL"
echo "Username: $USERNAME"
echo "Phone: $PHONE"
echo ""

# Step 1: Login
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed! Could not extract token."
  echo ""
  echo "Trying with phone instead..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"phone\": \"$PHONE\",
      \"password\": \"$PASSWORD\"
    }")
  
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty' 2>/dev/null)
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed! Please check credentials."
  exit 1
fi

echo "✅ Login successful!"
echo "   Token: ${TOKEN:0:50}..."
echo ""

# Step 2: Test transaction ingestion with JWT token
echo "2. Testing transaction ingestion with JWT token..."
TXN_ID="TEST$(date +%s)"
AMOUNT=100.50

INGEST_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"txnId\": \"$TXN_ID\",
    \"amount\": $AMOUNT,
    \"sender\": \"+1234567890\",
    \"bank\": \"Test Bank\",
    \"pattern\": \"Test Pattern\",
    \"smsText\": \"Test SMS message for transaction $TXN_ID\"
  }")

HTTP_STATUS=$(echo "$INGEST_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$INGEST_RESPONSE" | sed '/HTTP_STATUS:/d')

echo "   HTTP Status: $HTTP_STATUS"
echo "   Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Transaction ingested successfully!"
  echo ""
  echo "3. Verifying transaction..."
  echo "   Transaction ID: $TXN_ID"
  echo "   You can check:"
  echo "   - Prisma Studio: npx prisma studio (in backend folder)"
  echo "   - Dashboard: http://localhost:5173/dashboard/transactions"
else
  echo "❌ Transaction ingest failed!"
  echo ""
  echo "Troubleshooting:"
  echo "1. Check if backend is running"
  echo "2. Verify token is valid"
  echo "3. Check backend logs for errors"
fi



