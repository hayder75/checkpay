# Installation Instructions for CheckPay Mobile App

## Issue: Google Play Protect Blocking Installation

Google Play Protect is blocking the app because it requests SMS permissions. This is expected behavior for apps that access SMS data. Here's how to install it for testing:

## Method 1: Bypass Google Play Protect (Recommended for Testing)

### Step 1: Disable Play Protect Temporarily
1. Open **Google Play Store** on your Android device
2. Tap your **profile icon** (top right)
3. Go to **Play Protect** → **Settings** (gear icon)
4. Turn OFF **"Scan apps with Play Protect"**
5. Also turn OFF **"Improve harmful app detection"** (if available)

### Step 2: Allow Installation from Unknown Sources
1. Go to **Settings** → **Apps** → **Special access** (or **Install unknown apps**)
2. Find your file manager app (e.g., **Files**, **Telegram**, etc.)
3. Enable **"Allow from this source"**

### Step 3: Install the APK
1. Open the APK file from your file manager
2. Tap **Install**
3. If you see a warning, tap **Install anyway** or **More details** → **Install anyway**

## Method 2: Use Debug APK (Easier for Testing)

The debug APK is already built and signed. It's located at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

This APK is easier to install but still requires bypassing Play Protect.

## Method 3: Install via ADB (For Developers)

If you have ADB set up:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or for release:
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

## For Google Play Store Submission

When submitting to Google Play Store:
1. **Create a proper release keystore** (not using debug keystore)
2. **Sign the APK** with your release keystore
3. **Submit through Google Play Console** - Play Protect won't block apps from the Play Store
4. **Provide a Privacy Policy** explaining SMS access
5. **Complete the SMS permissions declaration** in Play Console

## Important Notes

- **Play Protect blocking is normal** for apps with SMS permissions installed outside Play Store
- **This is expected behavior** - Google is protecting users from potentially harmful apps
- **Once published on Play Store**, users won't see this warning
- **For production**, you MUST create a proper release keystore (not use debug keystore)

## Creating a Release Keystore (For Production)

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore checkpay-release.keystore -alias checkpay-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Then update `android/app/build.gradle` to use this keystore for release builds.








