# Google Play Store Compliance & Onboarding Implementation

## Overview

This document explains how the CheckPay mobile app complies with Google Play Store policies and implements the required onboarding flow.

## Google Play Store Compliance

### SMS Permission Requirements

**Critical Policy**: Google Play Store requires that apps requesting SMS permissions MUST be set as the default SMS handler. This is a strict requirement enforced by Google.

**Our Implementation**:
1. The app requests SMS permission only after explaining that it must be the default SMS handler
2. Users are directed to Android Settings to set CheckPay as the default SMS app
3. The app gracefully handles cases where users skip SMS permission (manual mode)
4. All SMS-related functionality is clearly explained to users

### Permissions Declared

In `app.json`, we declare:
- `android.permission.READ_SMS` - To read incoming SMS messages
- `android.permission.RECEIVE_SMS` - To receive SMS broadcasts
- `android.permission.SEND_SMS` - Required for default SMS handler functionality

### Intent Filters

The app includes intent filters to act as a default SMS handler:
- `android.intent.action.SENDTO` - For sending SMS
- `android.intent.action.RECEIVE` - For receiving SMS

## Onboarding Flow

### Step 1: SMS Permission Request

**What happens**:
- On first launch, the app shows an onboarding screen
- Explains why SMS permission is needed
- Clearly states Google Play Store requirement (must be default SMS handler)
- Provides option to skip (manual mode) or proceed to settings

**User Options**:
1. **Grant Permission**: Opens Android Settings to set CheckPay as default SMS app
2. **Skip**: Continues in manual mode (user can paste SMS manually)

**Google Play Compliance**:
- ✅ No location permission requested
- ✅ Clear explanation of why permission is needed
- ✅ User can skip if they don't want to grant permission
- ✅ App functions without SMS permission (manual mode)

### Step 2: Country Detection

**What happens**:
- App automatically detects country from device locale/SIM
- Uses `expo-localization` to get locale information
- Falls back to timezone-based detection if locale unavailable

**Methods Used** (No location permission required):
1. **Device Locale**: Extracts country code from locale (e.g., "en-ET" → "ET")
2. **Region**: Uses device region setting
3. **Timezone**: Maps common timezones to countries (fallback)

**Google Play Compliance**:
- ✅ No location permission requested
- ✅ Uses only device settings (locale, region, timezone)
- ✅ Privacy-friendly (no GPS tracking)

### Step 3: Financial SMS Detection & Bank Selection

**What happens**:
- App identifies financial SMS messages by default
- Scans SMS content for financial keywords (amounts, transaction IDs, bank names)
- Extracts banks/financial services from SMS messages
- Shows user a list of detected banks to select from

**Detection Methods**:
1. **Financial Keywords**: Transaction, received, credited, balance, etc.
2. **Amount Patterns**: Detects currency amounts (e.g., "ETB 200.00")
3. **Transaction ID Patterns**: Detects transaction references
4. **Bank Names**: Matches known bank/service names in SMS

**Bank Selection**:
- User sees list of banks found in their SMS messages
- Can select/deselect banks they use
- Selected banks are saved for future pattern matching

**Google Play Compliance**:
- ✅ Only processes SMS after user grants permission
- ✅ Only identifies financial messages (not all SMS)
- ✅ User has full control over which banks to monitor
- ✅ Clear purpose: financial transaction tracking

## Implementation Details

### Files Created/Modified

1. **`src/screens/OnboardingScreen.tsx`**
   - Main onboarding screen with 3 steps
   - Handles permission requests
   - Country and bank selection

2. **`src/utils/smsUtils.ts`**
   - Country detection from locale (no location permission)
   - Financial SMS detection
   - Bank extraction from SMS

3. **`src/services/storage.ts`**
   - Added onboarding completion tracking
   - User country storage
   - Selected banks storage

4. **`src/services/api.ts`**
   - Added countries API endpoints
   - Country detection from SMS
   - Get banks for country

5. **`app.json`**
   - Added SMS permissions
   - Added intent filters for default SMS handler
   - Google Play compliant configuration

6. **`backend/src/routes/countries.ts`**
   - Added `/api/countries/detect` endpoint
   - Added `/api/countries/:code/banks` endpoint

### Dependencies Added

- `expo-localization`: For country detection from locale (no location permission)

## User Flow

```
1. User installs app
   ↓
2. First launch → Onboarding screen
   ↓
3. SMS Permission Request
   - Explains Google Play requirement
   - Option to skip (manual mode)
   - Option to grant (opens settings)
   ↓
4. Country Detection (automatic)
   - Detects from locale/SIM
   - No location permission needed
   ↓
5. Bank Selection
   - Shows banks found in SMS
   - User selects which banks to monitor
   ↓
6. Setup Complete
   - App ready to use
   - Can process financial SMS automatically
```

## Privacy & Security

### Data Handling
- ✅ Country detection uses only device settings (no location tracking)
- ✅ SMS content processed locally for bank detection
- ✅ User explicitly selects which banks to monitor
- ✅ No SMS content sent to backend without user action

### Permissions
- ✅ Only requests SMS permission (required for core functionality)
- ✅ No location permission (uses locale instead)
- ✅ No unnecessary permissions

## Testing Checklist

- [ ] Onboarding appears on first launch
- [ ] SMS permission request explains Google Play requirement
- [ ] Country detection works from locale
- [ ] Bank selection shows detected banks
- [ ] App works in manual mode (without SMS permission)
- [ ] Onboarding doesn't show again after completion
- [ ] Settings can be changed later

## Google Play Store Submission

### Required Information

1. **Privacy Policy**: Must explain SMS access and data usage
2. **App Description**: Must clearly state app is a default SMS handler
3. **Screenshots**: Show SMS permission request and explanation
4. **Permissions Declaration**: Explain why SMS permissions are needed

### Key Points to Highlight

- App is a financial transaction tracker
- Requires default SMS handler role (Google Play requirement)
- Only processes financial SMS messages
- User has full control over bank selection
- No location tracking (uses locale only)

## Future Enhancements

1. **Real SMS Reading**: Implement actual SMS reading when permission granted
2. **Background Processing**: Process SMS in background service
3. **Notification**: Notify user when transaction detected
4. **Offline Queue**: Queue transactions when offline

## Notes

- iOS doesn't support SMS reading, so app focuses on Android
- Manual mode allows iOS users to paste SMS manually
- All SMS processing respects installation date (only processes SMS after app install)









