# No-Authentication Flow

## Overview

The CheckPay mobile app now works **without authentication** initially. Users can:
- Check country automatically
- Scan and identify financial SMS messages
- Parse transactions locally
- Select banks to monitor

Authentication is **optional** and only needed to sync data to the cloud.

## Flow

### 1. First Launch (Onboarding)

**No authentication required**

1. **SMS Permission Request**
   - Explains Google Play Store requirement (must be default SMS handler)
   - User can skip (manual mode) or grant permission
   - No login needed

2. **Country Detection**
   - Automatically detects country from device locale/SIM
   - No location permission required
   - No authentication required

3. **Bank Selection**
   - Shows banks found in SMS messages (or country defaults)
   - User selects which banks to monitor
   - No authentication required

### 2. Main App (No Auth)

After onboarding, the app works fully without authentication:

- ✅ **Dashboard**: Shows stats and quick actions
- ✅ **SMS Parser**: Can parse SMS and extract transactions locally
- ✅ **Pattern Matching**: Works with local patterns
- ✅ **Transaction History**: Shows locally parsed transactions
- ✅ **All Features**: Available without login

### 3. Optional Authentication

Users can login later to:
- Sync patterns to cloud
- Sync transactions to backend
- Access premium features
- Backup data

**Login is accessible from:**
- Drawer menu → "Login / Sign Up" button
- Settings screen

## Implementation Details

### App.tsx Changes

- Removed requirement for `apiKey` to show main app
- App shows onboarding first, then main app (no auth required)
- Auth screen only shown when user explicitly clicks "Login"

### Screen Updates

**DashboardScreen:**
- `apiKey` is now optional (`apiKey?: string | null`)
- Shows info message when not authenticated
- All features work without auth

**MainScreen (SMS Parser):**
- `apiKey` is now optional
- Parses SMS locally without backend
- Shows parsed transaction even without API key
- Only sends to backend if `apiKey` exists

**Drawer:**
- Shows "Login / Sign Up" when not authenticated
- Shows "Logout" when authenticated

### Storage

Onboarding data stored locally:
- `onboarding_completed`: Boolean
- `user_country`: String (country code)
- `selected_banks`: String[] (array of bank names)

No authentication required to store this data.

## User Experience

### Without Authentication

1. User installs app
2. Onboarding: Country detected, banks selected
3. App ready to use immediately
4. Can parse SMS, view transactions locally
5. Can login anytime to sync to cloud

### With Authentication

1. User completes onboarding (or skips)
2. Uses app without login
3. Clicks "Login / Sign Up" from drawer
4. Logs in or registers
5. Data syncs to cloud
6. Can access premium features

## Benefits

1. **Lower Barrier to Entry**: Users can try the app immediately
2. **Privacy First**: No account required to use core features
3. **Offline Capable**: Works without internet connection
4. **Flexible**: Users choose when to sync to cloud
5. **Google Play Compliant**: Still follows all policies

## Technical Notes

- All screens handle `apiKey` being `null` or `undefined`
- API calls only made when `apiKey` exists
- Local parsing works independently of backend
- Patterns can be stored locally without sync
- Transactions parsed locally, synced later if user logs in

## Future Enhancements

- Background SMS scanning without auth
- Local pattern creation without auth
- Offline transaction queue (sync when logged in)
- Export transactions without auth





