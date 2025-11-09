# CheckPay Mobile App

Mobile app for CheckPay that monitors SMS and sends transactions to the backend.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update API URL in `src/config.ts` if needed

3. Start the app:
```bash
npm start
```

## Testing

1. Open the app (Expo Go or development build)
2. Enter your API key from the dashboard
3. The app will fetch your patterns
4. Use "Test SMS Parser" to paste SMS text and test pattern matching
5. Transactions will be sent to the backend

## Features

- ✅ API Key authentication
- ✅ Pattern fetching from backend
- ✅ SMS pattern matching
- ✅ Transaction ingestion
- ✅ Phone number masking
- ⏳ Real SMS monitoring (requires development build)

## Development Build

For real SMS reading, you need a development build:

```bash
npx expo prebuild
npx expo run:android
```

## Testing Flow

1. Register on web dashboard → Get API key
2. Create patterns in dashboard
3. Open mobile app → Enter API key
4. Test with SMS text in the app
5. Check dashboard → Transactions should appear
