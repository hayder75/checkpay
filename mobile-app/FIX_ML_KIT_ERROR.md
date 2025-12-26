# Fix: ML Kit Text Recognition Error

## Problem
Getting error: `Cannot read property 'recognize' of undefined`

This means the ML Kit native module isn't properly linked. Native modules require the app to be rebuilt.

## Solution

ML Kit Text Recognition is a **native module** that requires:
1. Package to be in `package.json` ✅ (now added)
2. App to be rebuilt with native code

## Steps to Fix

### Option 1: Rebuild the App (Recommended)

```bash
# Stop the current dev server (Ctrl+C)

# Rebuild Android app (this will link native modules)
pnpm run android

# Or for iOS:
pnpm run ios
```

### Option 2: Prebuild and Rebuild

```bash
# Generate native code
npx expo prebuild

# Rebuild
pnpm run android
```

## Why This Happens

- `@react-native-ml-kit/text-recognition` contains native code (Java/Kotlin for Android, Swift/ObjC for iOS)
- Native modules must be compiled into the app binary
- Running `expo start` alone doesn't rebuild native code
- You need to run `expo run:android` or `expo run:ios` to rebuild

## Verification

After rebuilding, the OCR should work. You'll see:
- ✅ `🔍 Starting OCR on image: file://...`
- ✅ `✅ OCR Result: { textLength: ..., confidence: ... }`

Instead of:
- ❌ `Cannot read property 'recognize' of undefined`

## Note

The error handling has been improved to show a helpful message if the module isn't available, but you still need to rebuild the app for it to work.




