#!/bin/bash

# Comprehensive endpoint testing script
# Usage: ./test-all-endpoints.sh [BASE_URL] [USERNAME] [PASSWORD]

BASE_URL=${1:-"http://localhost:3000/api"}
USERNAME=${2:-"abebeb"}
PASSWORD=${3:-"123456"}

echo "🧪 Testing All CheckPay API Endpoints"
echo "======================================"
echo "Base URL: $BASE_URL"
echo "Username: $USERNAME"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Helper function to test endpoint
test_endpoint() {
  local name=$1
  local method=$2
  local url=$3
  local auth_type=$4  # "jwt", "apikey", or "none"
  local data=$5
  local token=$6
  local api_key=$7
  
  echo -n "Testing $name... "
  
  local headers=()
  headers+=("Content-Type: application/json")
  
  if [ "$auth_type" = "jwt" ] && [ -n "$token" ]; then
    headers+=("Authorization: Bearer $token")
  elif [ "$auth_type" = "apikey" ] && [ -n "$api_key" ]; then
    headers+=("X-API-Key: $api_key")
  fi
  
  local curl_cmd="curl -s -w '\nHTTP_STATUS:%{http_code}' -X $method"
  for header in "${headers[@]}"; do
    curl_cmd="$curl_cmd -H '$header'"
  done
  
  if [ -n "$data" ]; then
    curl_cmd="$curl_cmd -d '$data'"
  fi
  
  curl_cmd="$curl_cmd '$BASE_URL$url'"
  
  local response=$(eval $curl_cmd)
  local http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
  local body=$(echo "$response" | sed '/HTTP_STATUS:/d')
  
  if [ "$http_status" = "200" ] || [ "$http_status" = "201" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_status)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_status)"
    echo "   Response: $(echo "$body" | head -3)"
    ((FAILED++))
    return 1
  fi
}

# Step 1: Health Check
echo ""
echo "1. Health Check"
echo "---------------"
test_endpoint "Health Check" "GET" "/../health" "none" "" "" ""

# Step 2: Login to get JWT token
echo ""
echo "2. Authentication"
echo "-----------------"
echo -n "Logging in... "
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  # Try with phone
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"0908070504\",\"password\":\"$PASSWORD\"}")
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty' 2>/dev/null)
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}✗ FAIL${NC} - Could not get token"
  echo "   Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ PASS${NC}"
echo "   Token: ${TOKEN:0:50}..."

# Get API key from user data
API_KEY=$(echo "$LOGIN_RESPONSE" | jq -r '.data.user.apiKey // empty' 2>/dev/null)
echo "   API Key: ${API_KEY:0:20}..."

# Step 3: Auth Endpoints
echo ""
echo "3. Auth Endpoints"
echo "-----------------"
test_endpoint "GET /auth/me" "GET" "/auth/me" "jwt" "" "$TOKEN" ""
test_endpoint "GET /auth/sims" "GET" "/auth/sims" "jwt" "" "$TOKEN" ""
test_endpoint "GET /auth/sims/check" "GET" "/auth/sims/check?iccid=TEST123" "jwt" "" "$TOKEN" ""
test_endpoint "POST /auth/regenerate-key" "POST" "/auth/regenerate-key" "jwt" "{}" "$TOKEN" ""

# Step 4: Countries Endpoints (Public)
echo ""
echo "4. Countries Endpoints (Public)"
echo "--------------------------------"
test_endpoint "GET /countries" "GET" "/countries" "none" "" "" ""
test_endpoint "GET /countries/:code/banks" "GET" "/countries/ET/banks" "none" "" "" ""
test_endpoint "POST /countries/detect" "POST" "/countries/detect" "none" '{"smsMessages":["M-Pesa transaction"]}' "" ""

# Step 5: Patterns Endpoints
echo ""
echo "5. Patterns Endpoints"
echo "---------------------"
test_endpoint "GET /patterns/institutions" "GET" "/patterns/institutions?country=ET" "none" "" "" ""
test_endpoint "GET /patterns/country/:code" "GET" "/patterns/country/ET" "none" "" "" ""
test_endpoint "GET /patterns" "GET" "/patterns" "jwt" "" "$TOKEN" ""
test_endpoint "POST /patterns/check-and-extract" "POST" "/patterns/check-and-extract" "none" '{"smsText":"Test SMS"}' "" ""

# Step 6: Dashboard Endpoints
echo ""
echo "6. Dashboard Endpoints"
echo "---------------------"
test_endpoint "GET /dashboard/stats" "GET" "/dashboard/stats" "jwt" "" "$TOKEN" ""
test_endpoint "GET /dashboard/transactions" "GET" "/dashboard/transactions?page=1&limit=10" "jwt" "" "$TOKEN" ""

# Step 7: Ingest Endpoint (JWT)
echo ""
echo "7. Ingest Endpoint (JWT Auth)"
echo "------------------------------"
TXN_ID="TEST$(date +%s)"
test_endpoint "POST /ingest" "POST" "/ingest" "jwt" \
  "{\"txnId\":\"$TXN_ID\",\"amount\":100.50,\"sender\":\"+1234567890\",\"bank\":\"Test Bank\",\"pattern\":\"Test Pattern\"}" \
  "$TOKEN" ""

# Step 8: Verify Endpoint (API Key)
echo ""
echo "8. Verify Endpoint (API Key Auth)"
echo "----------------------------------"
if [ -n "$API_KEY" ]; then
  test_endpoint "GET /verify" "GET" "/verify?txn=$TXN_ID" "apikey" "" "" "$API_KEY"
else
  echo -e "${YELLOW}⚠ SKIP${NC} - No API key available"
fi

# Step 9: Premium Endpoints
echo ""
echo "9. Premium Endpoints"
echo "--------------------"
test_endpoint "GET /premium/status" "GET" "/premium/status" "jwt" "" "$TOKEN" ""

# Step 10: Config Endpoint (API Key)
echo ""
echo "10. Config Endpoint (API Key Auth)"
echo "-----------------------------------"
if [ -n "$API_KEY" ]; then
  test_endpoint "GET /config" "GET" "/config" "apikey" "" "" "$API_KEY"
else
  echo -e "${YELLOW}⚠ SKIP${NC} - No API key available"
fi

# Step 11: Templates Endpoints
echo ""
echo "11. Templates Endpoints"
echo "-----------------------"
test_endpoint "GET /templates/available" "GET" "/templates/available?countryCode=ET" "jwt" "" "$TOKEN" ""

# Summary
echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi



