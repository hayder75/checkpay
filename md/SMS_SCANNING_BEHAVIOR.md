# SMS Scanning Behavior - Current Implementation

## 📱 Current Behavior

### **NO - The app does NOT fetch all historical SMS from before installation**

### What the App Currently Does:

1. **Onboarding (First Launch)**
   - ❌ **Historical SMS scanning is DISABLED** (commented out in code)
   - The code that would scan the last 200 SMS messages during onboarding is currently commented out
   - Location: `mobile-app/src/screens/OnboardingScreen.tsx` (lines 77-258)
   - Users must manually provide sample SMS instead

2. **Ongoing SMS Monitoring (After Onboarding)**
   - ✅ Only monitors the **last 20 SMS messages** periodically
   - Checks every **5 seconds** when app is active
   - Tracks processed SMS IDs to avoid duplicates
   - Only processes **new SMS** that arrive after monitoring starts
   - Location: `mobile-app/src/services/smsService.ts` (line 177)

### Code Evidence:

```typescript
// OnboardingScreen.tsx - COMMENTED OUT
// const scanForFinancialSMS = async () => {
//   const smsMessages = await readSMSMessages(200); // Read last 200 SMS
//   ...
// };

// smsService.ts - ACTIVE
const smsMessages = await readSMSMessages(20); // Only last 20 SMS
```

## 🔍 How SMS Reading Works

The `readSMSMessages()` function:
- Reads from Android's SMS inbox
- Returns the **most recent** messages (sorted by date, newest first)
- Limited by the `limit` parameter (20 for monitoring, 200 for onboarding if enabled)
- Does NOT scan all historical messages from before app installation

## ⚠️ Implications

**Current Limitations:**
1. Transactions from SMS received before app installation are **NOT automatically detected**
2. Users must manually enter sample SMS during onboarding
3. Only new transactions (after app starts monitoring) are automatically extracted

## 💡 Potential Solutions

If you want to enable historical SMS scanning:

### Option 1: Enable Onboarding SMS Scan
Uncomment the code in `OnboardingScreen.tsx` to scan last 200 SMS during onboarding.

### Option 2: Add Initial Historical Scan
Add a one-time scan when monitoring starts to process recent historical SMS:

```typescript
// In smsService.ts startMonitoring()
async startMonitoring(): Promise<void> {
  // ... existing code ...
  
  // Initial historical scan (one-time)
  const historicalSMS = await readSMSMessages(500); // Scan last 500 SMS
  await this.processHistoricalSMS(historicalSMS);
  
  // Then start periodic monitoring
  this.startPeriodicCheck();
}
```

### Option 3: User-Triggered Historical Scan
Add a button in settings to manually trigger a historical scan.

## 📊 Recommended Approach

**For Better User Experience:**
1. Enable onboarding SMS scan (uncomment code) - scans last 200 SMS
2. Add initial historical scan when monitoring starts - scans last 500 SMS
3. Track which SMS have been processed to avoid duplicates
4. Show progress indicator during historical scan

This would ensure:
- ✅ Historical transactions are detected on first launch
- ✅ New transactions continue to be monitored
- ✅ No duplicate processing


