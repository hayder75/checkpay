# Future Features - Mobile App

## 📱 SMS Permission Popup (Required for Production)

### What's Needed:
When we finalize the app and implement real SMS reading, we need to:

1. **Request SMS Permissions**
   - Android: `READ_SMS` and `RECEIVE_SMS` permissions
   - iOS: SMS reading is not available (need alternative approach)
   - Show permission popup when user first opens app or enables SMS monitoring

2. **Permission Flow:**
   ```
   User opens app → Enters API key → App requests SMS permission → 
   User grants/denies → If granted, start SMS listener
   ```

3. **Implementation Notes:**
   - Use `expo-permissions` or `react-native-permissions`
   - Check permission status before reading SMS
   - Handle permission denial gracefully
   - Show explanation why permission is needed
   - Allow user to enable/disable SMS monitoring in settings

4. **Android Specific:**
   - Need to request at runtime (Android 6.0+)
   - May need to add to `AndroidManifest.xml`:
     ```xml
     <uses-permission android:name="android.permission.READ_SMS" />
     <uses-permission android:name="android.permission.RECEIVE_SMS" />
     ```

5. **iOS Limitation:**
   - iOS doesn't allow reading SMS messages
   - Alternative: Use notification extensions or manual input
   - Or focus on Android-only for SMS reading

### Current Status:
- ✅ App structure ready
- ✅ API key authentication working
- ✅ Pattern matching implemented
- ✅ Transaction ingestion working
- ⏳ SMS permission popup (TODO for production)
- ⏳ Real SMS listener (TODO for production)

### When to Implement:
- Before creating production build
- After testing with manual SMS input
- When ready to deploy to users

---

## Other Future Enhancements:

- [ ] Background SMS monitoring service
- [ ] SMS filtering (only financial messages)
- [ ] Notification when transaction detected
- [ ] Offline queue for transactions
- [ ] Auto-refresh patterns from backend
- [ ] Settings screen (enable/disable monitoring)
