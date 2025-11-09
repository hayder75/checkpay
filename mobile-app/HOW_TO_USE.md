# How to Use CheckPay Mobile App

## ✅ Current Status

The app is **connected and working**! You can see:
- ✅ API key accepted
- ✅ 0 patterns loaded (this is normal - you need to create them first)

## 📱 How SMS Reading Works

### Current (Testing Mode):
- **Manual Input**: Use "Test SMS Parser" to paste SMS text
- **Pattern Matching**: App tries to match against your patterns
- **Sends to Backend**: If matched, sends transaction to backend

### Future (Production):
- **Automatic**: App will read SMS automatically in background
- **Permission**: Will ask for SMS permission when you enable it
- **Filtering**: Only processes SMS from after app installation

## 🚀 Step-by-Step Guide

### Step 1: Create Patterns on Web Dashboard

**You MUST do this first!**

1. Open web dashboard: http://localhost:5173
2. Login with your account
3. Go to **"Pattern Builder"** or **"Pattern Library"**
4. Click **"Create Pattern"** or **"New Pattern"**
5. Paste an SMS example (like: "You have received ETB 200.00 by transaction number...")
6. The AI will detect fields automatically
7. Save the pattern

### Step 2: Refresh Patterns in Mobile App

1. Open mobile app
2. Go to **"Pattern Library"** screen
3. **Pull down to refresh** (swipe down)
4. Your patterns will load from backend

### Step 3: Test SMS Parsing

1. Go to **"Test SMS Parser"** from dashboard
2. Paste the same SMS you used to create the pattern
3. Click **"Parse & Send"**
4. It should match and send to backend!

### Step 4: Check Transactions

1. Go to **"Transaction History"** in mobile app
2. Or check web dashboard → Transactions
3. Your test transaction should appear!

## ❓ Why "No Match" Error?

You got this error because:
- ✅ App is working correctly
- ❌ But you have **0 patterns** loaded
- ✅ Solution: Create patterns on web dashboard first!

## 📋 App Features

The mobile app now has all pages from the website:

1. **Dashboard** - Overview and quick actions
2. **Test SMS Parser** - Test pattern matching manually
3. **Pattern Library** - View all your patterns (pull to refresh)
4. **Transaction History** - View all transactions
5. **Analytics** - View statistics
6. **Settings** - App configuration, API key, logout

## 🔄 How to Know App is Reading Messages

### Currently (Testing):
- Use "Test SMS Parser" to manually test
- App shows "No Match" if no patterns exist
- App shows "Success" if pattern matches

### Future (Production):
- App will show notification when SMS is processed
- Transaction count will increase
- You'll see transactions in history

## 💡 Quick Tips

1. **Always create patterns on web first** - Mobile app reads them
2. **Refresh patterns** - Pull down in Pattern Library to get latest
3. **Test with same SMS** - Use the exact SMS you used to create pattern
4. **Check backend** - Transactions appear in web dashboard too

The app is ready! Just create patterns on the web dashboard first! 🎉
