# Google Play Release Checklist

## Build and Signing

- [ ] Build Android App Bundle (AAB) with `eas build --platform android --profile production`
- [ ] Ensure release signing keystore is configured
- [ ] Confirm `versionCode` is greater than previous release
- [ ] Verify package name is final (`com.checkpay.mobile`)

## App Security

- [ ] No production cleartext traffic unless absolutely required
- [ ] No debug-only permissions in production manifest
- [ ] Verify release artifact is generated from production profile only

## Play Console Setup

- [ ] App content questionnaire completed
- [ ] Data safety form completed with actual data collection/use
- [x] Privacy policy URL is published and accessible publicly (`https://checkpay.live/privacy-policy`)
- [ ] Permissions declaration form for SMS permissions is completed
- [ ] Ads declaration completed (Yes/No)

## Store Listing

- [ ] Final app title and short description
- [ ] Full description updated
- [ ] Feature graphic uploaded
- [ ] Phone screenshots uploaded
- [ ] High-resolution app icon uploaded

## Final Validation

- [ ] Install release build on a physical Android device
- [ ] Verify login, onboarding, and payments flow
- [ ] Verify SMS-related behavior and fallback/manual mode
- [ ] Confirm no crashes in first-run path

## Current Progress Snapshot

- [x] Production build profile uses AAB (`eas.json`)
- [x] SMS import role-gated with manual fallback
- [x] Public privacy policy page is live
- [ ] Release signing credentials configured
- [ ] Play Console declarations submitted
