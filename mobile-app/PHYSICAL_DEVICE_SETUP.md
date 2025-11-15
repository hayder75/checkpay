# Building to Physical Android Device

## Quick Setup

### 1. Enable USB Debugging on Your Phone

1. **Enable Developer Options:**
   - Go to `Settings > About Phone`
   - Tap `Build Number` 7 times
   - You'll see "You are now a developer!"

2. **Enable USB Debugging:**
   - Go to `Settings > Developer Options`
   - Enable `USB Debugging`
   - Enable `Install via USB` (optional but helpful)

3. **Connect Your Phone:**
   - Connect via USB cable
   - On your phone, accept the "Allow USB Debugging" prompt
   - Check "Always allow from this computer" if you want

### 2. Verify Device Connection

```bash
# Restart ADB server
adb kill-server
adb start-server

# Check if device is detected
adb devices
```

You should see something like:
```
List of devices attached
ABC123XYZ    device
```

If you see `offline` or `unauthorized`, see troubleshooting below.

### 3. Build to Device

```bash
cd mobile-app
npm run android
```

This will:
- Build the native Android app
- Install it on your connected device
- Start the development server

## Troubleshooting

### Device Shows as "offline"

1. **Unplug and replug** the USB cable
2. **Revoke USB debugging authorizations:**
   - On phone: `Settings > Developer Options > Revoke USB debugging authorizations`
   - Reconnect and accept the prompt again
3. **Try a different USB cable** (some cables are charge-only)
4. **Try a different USB port** on your computer
5. **Restart ADB:**
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```

### Device Shows as "unauthorized"

1. **Check your phone** - you should see a prompt asking to allow USB debugging
2. **Accept the prompt** and check "Always allow from this computer"
3. **If no prompt appears:**
   - Revoke authorizations (see above)
   - Unplug and replug
   - Check USB debugging is enabled

### "No devices found"

1. **Check USB connection:**
   ```bash
   lsusb  # Linux - should show your device
   ```

2. **Install USB drivers** (if on Windows):
   - Install Google USB Driver from Android Studio SDK Manager
   - Or install manufacturer-specific drivers (Samsung, OnePlus, etc.)

3. **Try USB debugging over network** (alternative):
   ```bash
   # On phone: Enable "Wireless debugging" in Developer Options
   # Then connect via IP address
   adb connect <phone-ip-address>:5555
   ```

### Build Fails

1. **Check Android SDK is installed:**
   ```bash
   echo $ANDROID_HOME
   # Should show path like: /home/user/Android/Sdk
   ```

2. **Install Android SDK if missing:**
   - Install Android Studio
   - Open SDK Manager
   - Install Android SDK Platform 33 or higher

3. **Check Java/JDK:**
   ```bash
   java -version
   # Should be Java 17 or higher
   ```

## Alternative: Build APK and Install Manually

If USB connection is problematic, you can build an APK and install it manually:

### Option 1: Local Build (Generate APK)

```bash
cd mobile-app
npx expo prebuild
cd android
./gradlew assembleDebug
# APK will be in: android/app/build/outputs/apk/debug/app-debug.apk
```

Then transfer and install the APK on your phone.

### Option 2: EAS Build (Cloud Build)

```bash
cd mobile-app
npx expo login
npx eas build:configure
npx eas build --platform android --profile development
```

Download the APK from the EAS dashboard and install it.

## After Successful Build

Once the app is installed on your device:

1. **Start the dev server:**
   ```bash
   npm start
   ```

2. **Open the app** on your phone - it will automatically connect

3. **Development:**
   - Code changes hot reload automatically
   - Shake device to open dev menu
   - Press `r` in terminal to reload

## Tips

- **Keep USB debugging enabled** - you'll need it for development
- **Use a good USB cable** - some cables don't support data transfer
- **First build takes 5-10 minutes** - be patient
- **Subsequent builds are faster** - only rebuilds changed native code





