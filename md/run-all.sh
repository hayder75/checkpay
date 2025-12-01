#!/bin/bash

# Script to run all CheckPay services
# Usage: ./run-all.sh

echo "🚀 Starting CheckPay Services"
echo "============================"
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "dashboard" ] || [ ! -d "mobile-app" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

# Function to check if a port is in use
check_port() {
  if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    return 0
  else
    return 1
  fi
}

# Check if ports are already in use
if check_port 3000; then
  echo "⚠️  Port 3000 is already in use (backend)"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

if check_port 5173; then
  echo "⚠️  Port 5173 is already in use (dashboard)"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Start backend
echo "📦 Starting Backend Server..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo "   Backend PID: $BACKEND_PID"
echo "   Logs: backend.log"
echo ""

# Wait a bit for backend to start
sleep 3

# Start dashboard
echo "🌐 Starting Dashboard..."
cd dashboard
npm run dev > ../dashboard.log 2>&1 &
DASHBOARD_PID=$!
cd ..
echo "   Dashboard PID: $DASHBOARD_PID"
echo "   Logs: dashboard.log"
echo ""

# Wait a bit for dashboard to start
sleep 3

echo "✅ Services Started!"
echo ""
echo "📊 Backend: http://localhost:3000"
echo "   Health: http://localhost:3000/health"
echo ""
echo "🌐 Dashboard: http://localhost:5173"
echo ""
echo "📱 Mobile App: Run 'cd mobile-app && npm start' in another terminal"
echo ""
echo "📝 Logs:"
echo "   - Backend: tail -f backend.log"
echo "   - Dashboard: tail -f dashboard.log"
echo ""
echo "🛑 To stop all services:"
echo "   kill $BACKEND_PID $DASHBOARD_PID"
echo ""
echo "Or press Ctrl+C to stop this script (services will continue running)"
echo ""

# Wait for user interrupt
trap "echo ''; echo 'Stopping services...'; kill $BACKEND_PID $DASHBOARD_PID 2>/dev/null; exit" INT

# Keep script running
wait



