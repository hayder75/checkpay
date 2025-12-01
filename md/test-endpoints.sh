#!/bin/bash

# Test script for CheckPay API endpoints
# Usage: ./test-endpoints.sh [API_KEY]

API_KEY=${1:-"your-api-key-here"}
BASE_URL=${2:-"http://localhost:3000/api"}

echo "🧪 Testing CheckPay API Endpoints"
echo "=================================="
echo "Base URL: $BASE_URL"
echo "API Key: $API_KEY"
echo ""

# Test 1: Health Check
echo "1. Testing Health Check..."
curl -s "$BASE_URL/../health" | jq '.' || echo "❌ Health check failed"
echo ""

# Test 2: Ingest Transaction
echo "2. Testing Ingest Transaction..."
INGEST_RESPONSE=$(curl -s -X POST "$BASE_URL/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "txnId": "TEST'$(date +%s)'",
    "amount": 100.50,
    "sender": "+1234567890",
    "bank": "Test Bank",
    "pattern": "Test Pattern",
    "smsText": "Test SMS message"
  }')

echo "$INGEST_RESPONSE" | jq '.' || echo "$INGEST_RESPONSE"
TXN_ID=$(echo "$INGEST_RESPONSE" | jq -r '.data.txnId // empty')
echo ""

if [ -z "$TXN_ID" ]; then
  echo "⚠️  Could not extract transaction ID from ingest response"
  echo "   Using test transaction ID for verification..."
  TXN_ID="TEST$(date +%s)"
else
  echo "✅ Transaction ingested successfully: $TXN_ID"
fi
echo ""

# Test 3: Verify Transaction
echo "3. Testing Verify Transaction..."
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/verify?txn=$TXN_ID" \
  -H "X-API-Key: $API_KEY")

echo "$VERIFY_RESPONSE" | jq '.' || echo "$VERIFY_RESPONSE"
echo ""

# Test 4: Get Dashboard Stats
echo "4. Testing Dashboard Stats..."
STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/dashboard/stats" \
  -H "X-API-Key: $API_KEY" \
  -H "Authorization: Bearer $(echo '{}' | jq -r '.token // empty')" 2>/dev/null)

echo "$STATS_RESPONSE" | jq '.' || echo "$STATS_RESPONSE"
echo ""

# Test 5: Get Transactions
echo "5. Testing Get Transactions..."
TXNS_RESPONSE=$(curl -s -X GET "$BASE_URL/dashboard/transactions?page=1&limit=10" \
  -H "X-API-Key: $API_KEY" \
  -H "Authorization: Bearer $(echo '{}' | jq -r '.token // empty')" 2>/dev/null)

echo "$TXNS_RESPONSE" | jq '.' || echo "$TXNS_RESPONSE"
echo ""

echo "✅ Testing complete!"
echo ""
echo "Note: Some endpoints require JWT authentication instead of API key."
echo "      Make sure you're logged in to the dashboard for full access."



