# Rebuild Instructions for ML Kit OCR

## Current Issue
ML Kit Text Recognition native module is not linked. The error shows:
```
ML Kit Text Recognition is not available. Please rebuild the app with native modules
```

## Solution: Rebuild the App

Since you're using Expo with `expo-dev-client`, you need to rebuild the app to link native modules.

### Step 1: Stop Current Dev Server
Press `Ctrl+C` in the terminal where `expo start` is running.

### Step 2: Clean Build (Optional but Recommended)
```bash
# Clean Android build
cd android
./gradlew clean
cd ..
```

### Step 3: Rebuild the App
```bash
# This will rebuild with native modules linked
pnpm run android
```

**OR** if you need to regenerate native code first:
```bash
# Generate/update native code
npx expo prebuild --clean

# Then rebuild
pnpm run android
```

### Step 4: Wait for Build
The first rebuild can take 5-10 minutes. Subsequent rebuilds are faster.

### Step 5: Test OCR
After the app launches:
1. Navigate to "Scan" tab
2. Select an image or take a photo
3. OCR should now work!

## Why This Is Needed

- `@react-native-ml-kit/text-recognition` contains native Java/Kotlin code
- Native modules must be compiled into the app binary
- `expo start` alone doesn't rebuild native code
- `expo run:android` compiles and links all native modules

## Verification

After rebuilding, you should see in logs:
- ✅ `🔍 Starting OCR on image: file://...`
- ✅ `✅ OCR Result: { textLength: ..., confidence: ... }`

Instead of the "not available" error.

## Troubleshooting

If rebuild fails:
1. Make sure you have Android SDK installed
2. Check `android/local.properties` has `sdk.dir` set
3. Try: `npx expo prebuild --clean` then rebuild
4. Check for any Gradle errors in the build output


