# CheckPay Mobile App - Setup & Testing Guide

## ✅ What's Built

1. **Mobile App Structure** ✅
   - React Native with Expo
   - API Key authentication screen
   - Main monitoring screen
   - Pattern matching logic
   - Transaction ingestion

2. **Features**
   - ✅ API Key input and validation
   - ✅ Pattern fetching from backend
   - ✅ SMS text parsing (test mode)
   - ✅ Transaction sending to backend
   - ✅ Phone number masking
   - ⏳ Real SMS monitoring (needs development build)

## 🚀 How to Test

### Step 1: Start Backend
```bash
cd backend
npm run dev
```

### Step 2: Start Mobile App
```bash
cd mobile-app
npm start
```

### Step 3: Test Flow

1. **Get API Key:**
   - Go to http://localhost:5173
   - Register/Login
   - Copy your API key from dashboard

2. **Open Mobile App:**
   - Scan QR code with Expo Go app (iOS/Android)
   - Or press `a` for Android emulator
   - Or press `i` for iOS simulator

3. **Enter API Key:**
   - Paste your API key
   - App will fetch your patterns

4. **Test SMS Parsing:**
   - Go to "Test SMS Parser" section
   - Paste an SMS text (e.g., "You received KES 500 from JOHN DOE. Ref: MP123456789")
   - Click "Parse & Send"
   - Check dashboard → Transactions should appear!

## 📱 For Physical Device Testing

If testing on a real phone:

1. **Find your computer's IP:**
   ```bash
   # Linux/Mac
   ip addr show | grep "inet " | grep -v 127.0.0.1
   
   # Or
   hostname -I
   ```

2. **Update API URL:**
   Edit `mobile-app/src/config.ts`:
   ```typescript
   export const API_BASE_URL = 'http://YOUR_IP:3000/api';
   // Example: 'http://192.168.1.100:3000/api'
   ```

3. **Make sure phone and computer are on same WiFi**

## 🔧 Next Steps (Real SMS Monitoring)

For real SMS reading, you need a development build:

```bash
cd mobile-app
npx expo prebuild
npx expo run:android
```

This creates a native build that can read SMS.

## ✅ Testing Checklist

- [ ] Backend running on port 3000
- [ ] Mobile app starts successfully
- [ ] Can enter API key
- [ ] Patterns load from backend
- [ ] Can test SMS parsing
- [ ] Transactions appear in dashboard
- [ ] Phone numbers are masked

## 🐛 Troubleshooting

**"Network request failed"**
- Check backend is running
- Check API URL in config.ts
- For physical device: use IP address, not localhost

**"Invalid API key"**
- Make sure API key starts with `ckp_`
- Check backend logs for errors

**"No patterns loaded"**
- Create patterns in dashboard first
- Check backend `/api/config` endpoint

## 📝 Notes

- Currently uses manual SMS input for testing
- Real SMS monitoring requires development build
- All transactions are sent to `/api/ingest`
- Phone numbers are masked before sending
