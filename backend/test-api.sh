#!/bin/bash

# Test script for CheckPay API endpoints
# Make sure the backend server is running on port 3000

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing CheckPay API Endpoints"
echo "=================================="
echo ""

# Test 1: Health Check
echo "1. Testing Health Endpoint..."
HEALTH=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HTTP_CODE=$(echo "$HEALTH" | tail -n1)
BODY=$(echo "$HEALTH" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 2: Test Pattern Recognition (Sample Tests)
echo "2. Testing Pattern Recognition (Sample Tests)..."
TEST_RESULT=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/test/samples")
HTTP_CODE=$(echo "$TEST_RESULT" | tail -n1)
BODY=$(echo "$TEST_RESULT" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Pattern recognition test passed${NC}"
    echo "Summary:"
    echo "$BODY" | grep -o '"successRate":[0-9.]*' | head -1 || echo "  (Check full response for details)"
else
    echo -e "${RED}✗ Pattern recognition test failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 3: Test Single Pattern Recognition
echo "3. Testing Single Pattern Recognition..."
SINGLE_TEST=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/test/pattern" \
  -H "Content-Type: application/json" \
  -d '{
    "smsText": "RM123456.00 sent to John Doe 254712345678 on 15/01/24 at 10:30 AM. New M-PESA balance is KES 5,000.00. Transaction ID: MP123456789.",
    "expectedTxnId": "MP123456789"
  }')
HTTP_CODE=$(echo "$SINGLE_TEST" | tail -n1)
BODY=$(echo "$SINGLE_TEST" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Single pattern test passed${NC}"
    SUCCESS=$(echo "$BODY" | grep -o '"success":[^,]*' | head -1)
    METHOD=$(echo "$BODY" | grep -o '"method":"[^"]*"' | head -1)
    echo "  $SUCCESS"
    echo "  $METHOD"
else
    echo -e "${RED}✗ Single pattern test failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 4: Check Institution Pattern (M-Pesa Kenya)
echo "4. Testing Institution Pattern Lookup..."
INST_PATTERN=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/patterns/institution/M-Pesa?country=KE")
HTTP_CODE=$(echo "$INST_PATTERN" | tail -n1)
BODY=$(echo "$INST_PATTERN" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Institution pattern lookup passed${NC}"
    EXISTS=$(echo "$BODY" | grep -o '"exists":[^,]*' | head -1)
    echo "  $EXISTS"
else
    echo -e "${RED}✗ Institution pattern lookup failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 5: Get Institutions with Patterns
echo "5. Testing Get Institutions with Patterns..."
INST_LIST=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/patterns/institutions?country=KE")
HTTP_CODE=$(echo "$INST_LIST" | tail -n1)
BODY=$(echo "$INST_LIST" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Get institutions passed${NC}"
    echo "Response preview:"
    echo "$BODY" | head -c 200
    echo "..."
else
    echo -e "${RED}✗ Get institutions failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

echo "=================================="
echo -e "${YELLOW}Note: Some tests may fail if database is not set up or patterns don't exist yet.${NC}"
echo "This is normal for initial setup."
echo ""





