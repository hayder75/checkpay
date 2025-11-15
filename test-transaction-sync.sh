#!/bin/bash

# Test script to verify transaction sync is working
# Usage: ./test-transaction-sync.sh [API_KEY] [BASE_URL]

API_KEY=${1:-""}
BASE_URL=${2:-"http://localhost:3000/api"}

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key is required"
  echo "Usage: ./test-transaction-sync.sh YOUR_API_KEY [BASE_URL]"
  exit 1
fi

echo "🧪 Testing Transaction Sync"
echo "=========================="
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:8}..."
echo ""

# Generate a unique transaction ID
TXN_ID="TEST$(date +%s)"
AMOUNT=100.50

echo "1. Testing Ingest Transaction..."
echo "   Transaction ID: $TXN_ID"
echo "   Amount: $AMOUNT"
echo ""

INGEST_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "ngrok-skip-browser-warning: true" \
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
  echo "2. Verifying transaction in database..."
  echo "   You can check Prisma Studio: npx prisma studio"
  echo "   Or check dashboard: http://localhost:5173/dashboard/transactions"
  echo ""
  echo "3. Testing Verify Endpoint..."
  VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/verify?txn=$TXN_ID" \
    -H "X-API-Key: $API_KEY" \
    -H "ngrok-skip-browser-warning: true")
  
  echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
else
  echo "❌ Transaction ingest failed!"
  echo ""
  echo "Troubleshooting:"
  echo "1. Check if backend is running: curl $BASE_URL/../health"
  echo "2. Verify API key is valid"
  echo "3. Check backend logs for errors"
  echo "4. Ensure user exists in database with this API key"
fi



