# Build Development Client - Full Functionality Guide

## 🎯 Why You Need This

The app uses native modules (SMS reading) that **Expo Go doesn't support**. To get full functionality, you need to build a **development client**.

---

## 🚀 Option 1: EAS Build (Cloud Build) - EASIEST ⭐

**No Android Studio needed!** Expo builds it in the cloud.

### Step 1: Login to Expo
```bash
cd /home/hayder/checkpay/mobile-app
npx expo login
```
(If you don't have an account, create one at https://expo.dev)

### Step 2: Configure EAS
```bash
npx eas build:configure
```
This creates `eas.json` configuration file.

### Step 3: Build for Android (Development)
```bash
npx eas build --platform android --profile development
```

**What happens:**
- Expo builds your app in the cloud (takes 10-15 minutes)
- You'll get a download link for the APK
- Download and install on your phone

### Step 4: Install APK on Your Phone
1. Download the APK from the build link
2. Transfer to your phone
3. Enable "Install from Unknown Sources" in Android settings
4. Install the APK

### Step 5: Start Development Server
```bash
cd /home/hayder/checkpay/mobile-app
npm start
```

### Step 6: Open the App
- Open the installed dev client app on your phone
- It will automatically connect to your development server
- Full SMS functionality will work!

---

## 🛠️ Option 2: Local Build (Requires Android Studio)

If you have Android Studio installed, you can build locally.

### Prerequisites:
1. **Android Studio** installed
2. **Android SDK** configured
3. **Java JDK** (version 11 or higher)
4. **Device connected** via USB (or emulator running)

### Step 1: Connect Your Phone
```bash
# Enable USB debugging on your phone
# Settings > Developer Options > USB Debugging

# Check if device is connected
adb devices
```

### Step 2: Build and Install
```bash
cd /home/hayder/checkpay/mobile-app
npx expo run:android
```

**What happens:**
- Builds the native Android app
- Installs it on your connected device
- Starts the development server
- App opens automatically

### Step 3: Development
- Code changes hot reload automatically
- Full SMS functionality works
- Native modules are available

---

## 📱 Quick Start (Recommended: EAS Build)

**Fastest way to get full functionality:**

```bash
# 1. Login to Expo
cd /home/hayder/checkpay/mobile-app
npx expo login

# 2. Build in cloud
npx eas build --platform android --profile development

# 3. Wait for build (10-15 min), download APK

# 4. Install APK on phone

# 5. Start dev server
npm start

# 6. Open app on phone - it connects automatically!
```

---

## 🔧 Troubleshooting

### "EAS CLI not found"
```bash
npm install -g eas-cli
```

### "Build failed"
- Check your `app.json` is valid
- Make sure all dependencies are installed: `npm install`
- Check Expo account is logged in: `npx expo whoami`

### "Can't connect to dev server"
- Make sure phone and computer are on same WiFi
- Check firewall isn't blocking port 8081
- Try: `npx expo start --tunnel` (uses ngrok)

### "SMS features not working"
- Make sure you built dev client (not using Expo Go)
- Check app permissions in phone settings
- Rebuild if you added new native modules

---

## ✅ After Building

Once you have the dev client installed:

1. **Daily Development:**
   ```bash
   cd /home/hayder/checkpay/mobile-app
   npm start
   ```
   - Open the dev client app on your phone
   - It connects automatically
   - Code changes hot reload

2. **Full Features Available:**
   - ✅ SMS reading
   - ✅ SMS monitoring
   - ✅ All native modules
   - ✅ Hot reload
   - ✅ Full debugging

---

## 🎯 Summary

**For Full Functionality:**
1. Use **EAS Build** (easiest, no local setup)
2. Or **Local Build** (if you have Android Studio)
3. Install the APK on your phone
4. Start dev server: `npm start`
5. Open app - it connects automatically!

**Expo Go = Limited features (no SMS)**
**Dev Client = Full features (everything works)**

