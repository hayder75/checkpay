#!/bin/bash

# Quick test of the country patterns endpoint

echo "🧪 Testing Country Patterns Endpoint"
echo "====================================="
echo ""

BASE_URL="http://localhost:3000"

# Test 1: Health check
echo "1. Health Check:"
HEALTH=$(curl -s --max-time 5 "$BASE_URL/health")
echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
echo ""

# Test 2: Get patterns for Ethiopia
echo "2. GET /api/patterns/country/ET:"
RESPONSE=$(curl -s --max-time 10 "$BASE_URL/api/patterns/country/ET")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Test 3: Get patterns for Kenya  
echo "3. GET /api/patterns/country/KE:"
RESPONSE=$(curl -s --max-time 10 "$BASE_URL/api/patterns/country/KE")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "✅ Testing complete!"





