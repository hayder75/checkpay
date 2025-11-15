#!/bin/bash

# Test script for the new country patterns endpoint

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing Country Patterns Endpoint"
echo "====================================="
echo ""

# Test 1: Health Check
echo "1. Testing Health Endpoint..."
HEALTH=$(curl -s -w "\n%{http_code}" "$BASE_URL/health" --max-time 5)
HTTP_CODE=$(echo "$HEALTH" | tail -n1)
BODY=$(echo "$HEALTH" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
    exit 1
fi
echo ""

# Test 2: Get patterns for Ethiopia (ET)
echo "2. Testing GET /api/patterns/country/ET..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/patterns/country/ET" --max-time 10)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Request successful (HTTP $HTTP_CODE)${NC}"
    echo "Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Request failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 3: Get patterns for Kenya (KE)
echo "3. Testing GET /api/patterns/country/KE..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/patterns/country/KE" --max-time 10)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Request successful (HTTP $HTTP_CODE)${NC}"
    echo "Response preview:"
    echo "$BODY" | head -20
else
    echo -e "${RED}✗ Request failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 4: Invalid country code
echo "4. Testing GET /api/patterns/country/XX (invalid)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/patterns/country/XX" --max-time 10)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Request successful (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠ Expected error (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Unexpected response (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

echo "✅ Testing complete!"





