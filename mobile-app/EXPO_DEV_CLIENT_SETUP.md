# Expo Dev Client Setup Guide

This guide will help you set up and use Expo Dev Client for the CheckPay mobile app.

## Why Expo Dev Client?

Expo Dev Client is required because the app uses:
- Custom native modules (`react-native-get-sms-android`)
- SMS permissions that aren't available in Expo Go
- Native Android features

## Prerequisites

1. **Android Studio** installed (for Android builds)
2. **Xcode** installed (for iOS builds - macOS only)
3. **Expo CLI** installed globally: `npm install -g expo-cli`
4. **EAS CLI** (optional, for cloud builds): `npm install -g eas-cli`

## Setup Steps

### 1. Install Dependencies

```bash
cd mobile-app
npm install
```

### 2. Build Development Client

#### Option A: Local Build (Recommended for Development)

**For Android:**
```bash
# Make sure Android Studio and Android SDK are installed
npx expo run:android
```

This will:
- Build the native Android app
- Install it on your connected device/emulator
- Start the development server

**For iOS (macOS only):**
```bash
# Make sure Xcode is installed
npx expo run:ios
```

#### Option B: EAS Build (Cloud Build)

If you don't have Android Studio/Xcode installed, you can use EAS Build:

1. **Login to Expo:**
   ```bash
   npx expo login
   ```

2. **Configure EAS:**
   ```bash
   npx eas build:configure
   ```

3. **Build for Android:**
   ```bash
   npx eas build --platform android --profile development
   ```

4. **Download and install** the APK on your device

### 3. Start Development Server

After building the dev client, start the development server:

```bash
npm start
# or
npx expo start --dev-client
```

The app will automatically connect to the dev server when you open it.

## Development Workflow

1. **First time:** Build the dev client (takes 5-10 minutes)
2. **Daily use:** Just run `npm start` - the dev client app will connect automatically
3. **Code changes:** Hot reload works automatically
4. **Native changes:** Rebuild the dev client

## Troubleshooting

### "Unable to connect to development server"

1. Make sure your phone and computer are on the same WiFi network
2. Check that the dev server is running: `npm start`
3. Try shaking the device and selecting "Reload"

### "Module not found" errors

1. Make sure you've run `npm install`
2. Clear cache: `npx expo start -c`
3. Rebuild the dev client if you added new native modules

### Build fails

1. **Android:** Make sure Android Studio is installed and Android SDK is configured
2. **iOS:** Make sure Xcode is installed and Command Line Tools are set up
3. Check the error logs for specific issues

### SMS permissions not working

1. Make sure the dev client was built (not using Expo Go)
2. Check app permissions in device settings
3. Rebuild the dev client if permissions were added recently

## Differences from Expo Go

| Feature | Expo Go | Dev Client |
|---------|---------|------------|
| Setup | Instant | Requires build |
| Custom native modules | ❌ | ✅ |
| SMS reading | Limited | Full access |
| Development speed | Fast | Slower initial setup |
| Production-like | No | Yes |

## Next Steps

1. Build the dev client for your platform
2. Install it on your device
3. Start development: `npm start`
4. Open the app and it will connect automatically

## Additional Resources

- [Expo Dev Client Docs](https://docs.expo.dev/development/introduction/)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Troubleshooting Guide](https://docs.expo.dev/troubleshooting/clear-cache/)





