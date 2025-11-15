#!/bin/bash

# Ngrok Startup Script
# This script starts ngrok tunnel to your local backend

echo "🚀 Starting Ngrok tunnel..."
echo ""
echo "Make sure your backend is running on port 3000 first!"
echo "If not, run: cd backend && npm run dev"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""

# Start ngrok
ngrok http 3000





