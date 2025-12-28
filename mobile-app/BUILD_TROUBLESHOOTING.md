# Build Troubleshooting Guide

If the build gets stuck again, try these steps in order:

## Quick Fixes

1. **Stop all processes:**
   ```bash
   pkill -f "expo run:android"
   cd android && ./gradlew --stop
   ```

2. **Clean build cache:**
   ```bash
   rm -rf android/.gradle android/app/build android/build
   rm -rf node_modules/.cache
   ```

3. **Restart with clean cache:**
   ```bash
   npm run android -- --clear
   ```

## If Still Stuck

4. **Kill Gradle daemons:**
   ```bash
   ./android/gradlew --stop
   # Or kill all Java processes (be careful!)
   pkill -f gradle
   ```

5. **Clean everything and rebuild:**
   ```bash
   rm -rf android/.gradle
   rm -rf android/app/build
   rm -rf android/build
   npm run android
   ```

6. **Check for device connection:**
   ```bash
   adb devices
   # Make sure your device is listed
   ```

7. **Try with emulator instead:**
   ```bash
   npm run android:emulator
   ```

## Common Issues

- **Gradle daemon stuck**: Run `./android/gradlew --stop`
- **Metro bundler issues**: Kill node processes and restart
- **Device not found**: Check `adb devices` and USB debugging
- **Memory issues**: Increase Gradle memory in `android/gradle.properties`





