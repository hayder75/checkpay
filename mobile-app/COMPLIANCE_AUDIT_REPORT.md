# CheckPay Mobile App Compliance Audit Report

Date: 2026-05-01
Scope: Mobile app codebase, Android manifest/build config, mobile-to-backend integration paths, Play Console preparation docs.

Note: Backend server source code is not present in this workspace. Backend findings are based on mobile integration behavior and published submission artifacts.

## Detailed Findings

### 1) <span style="color:red">Restricted SMS permissions are declared in release config</span>
- Status: <span style="color:red">Needs fix</span>
- Evidence:
  - app.json:53-55
  - android/app/src/main/AndroidManifest.xml:8-11
- Risk level: <span style="color:red">High</span>
- Fix recommendation: <span style="color:red">If not shipping a true default SMS app experience, remove READ_SMS/RECEIVE_SMS/SEND_SMS from production. If shipping as default SMS app, complete all required default-SMS functionality and reviewer evidence.</span>

### 2) <span style="color:red">Default SMS handler intent requirements are not implemented in manifest</span>
- Status: <span style="color:red">Non-compliant</span>
- Evidence:
  - Receiver exists for SMS_RECEIVED only: android/app/src/main/AndroidManifest.xml:39-41
  - No SENDTO / RESPOND_VIA_MESSAGE / SMS_DELIVER default-SMS intent coverage found
- Risk level: <span style="color:red">High</span>
- Fix recommendation: <span style="color:red">Either implement complete default SMS app manifest/components or remove restricted SMS permissions and use non-restricted alternatives.</span>

### 3) <span style="color:red">Background SMS interception and headless processing is active</span>
- Status: <span style="color:red">Needs fix</span>
- Evidence:
  - Manifest service/receiver: android/app/src/main/AndroidManifest.xml:25, 39
  - Headless task registration: index.ts:4, 7
  - Background task implementation: src/services/SMSHeadlessTask.ts:45
- Risk level: <span style="color:red">High</span>
- Fix recommendation: <span style="color:red">Gate behind explicit consent and role confirmation; disable in production until policy readiness is complete.</span>

### 4) <span style="color:red">Runtime role gate exists before SMS read</span>
- Status: <span style="color:red">Compliant (partial)</span>
- Evidence:
  - Role check and role prompt path: src/utils/smsReader.ts:34-44
  - SMS permission request path: src/utils/smsReader.ts:68-69
  - Headless role check: src/services/SMSHeadlessTask.ts:53
- Risk level: <span style="color:red">Medium</span>
- Fix recommendation: <span style="color:red">Keep this safeguard, but do not rely on it alone for restricted SMS approval.</span>

### 5) <span style="color:red">Policy docs and runtime onboarding behavior are inconsistent</span>
- Status: <span style="color:red">Non-compliant</span>
- Evidence:
  - Documentation claims SMS/default role flow in onboarding: GOOGLE_PLAY_COMPLIANCE.md:14
  - Onboarding implementation has no SMS permission/role flow: src/screens/OnboardingScreen.tsx
  - App startup permission request currently camera-only: App.tsx:368-372
- Risk level: <span style="color:red">High</span>
- Fix recommendation: <span style="color:red">Align reviewer-facing docs and in-app behavior immediately.</span>

### 6) <span style="color:red">Raw SMS content is sent to backend ingestion</span>
- Status: <span style="color:red">Needs fix</span>
- Evidence:
  - Headless payload includes smsText: src/services/SMSHeadlessTask.ts:241
  - Foreground sync payload includes smsText: src/services/smsService.ts:892
- Risk level: <span style="color:red">High</span>
- Fix recommendation: <span style="color:red">Apply data minimization. Prefer extracted structured fields only, avoid raw SMS body where not required.</span>

### 7) <span style="color:red">Sensitive SMS previews appear in logs</span>
- Status: <span style="color:red">Needs fix</span>
- Evidence:
  - Background preview logging: src/services/SMSHeadlessTask.ts:46-48
  - Foreground queue/payload preview logging: src/services/smsService.ts:279, 898
- Risk level: <span style="color:red">Medium</span>
- Fix recommendation: <span style="color:red">Remove SMS content logs in release builds; keep only non-PII operational telemetry.</span>

### 8) Over-declared/non-core Android permissions
- Status: Needs fix
- Evidence:
  - app.json includes RECORD_AUDIO and storage permissions: app.json:57-59
  - AndroidManifest includes WRITE_EXTERNAL_STORAGE: android/app/src/main/AndroidManifest.xml:13
- Risk level: Medium
- Fix recommendation: Remove permissions not required by demonstrable production features.

### 9) Contacts access path exists and must be declared accurately
- Status: Needs fix
- Evidence:
  - Contacts module usage: src/utils/contactVerification.ts:6, 32, 48
  - Verification service imports contact check: src/services/smsVerification.ts:6
- Risk level: Medium
- Fix recommendation: Ensure Data Safety/Privacy declarations include contacts access, or disable this path in production.

### 10) Production API base URL is HTTPS
- Status: Compliant
- Evidence:
  - HTTPS base URL default: src/config.ts:12
- Risk level: Low
- Fix recommendation: Keep HTTPS-only production routing and enforce TLS on backend endpoints.

### 11) Cleartext network behavior is guarded by production profile
- Status: Compliant
- Evidence:
  - Production branch forces cleartext off: plugins/withNetworkSecurityConfig.js:27
  - Current manifest has usesCleartextTraffic=false: android/app/src/main/AndroidManifest.xml:21
- Risk level: Low
- Fix recommendation: Verify final release artifact manifest before uploading to Play.

### 12) Sensitive credentials use secure storage
- Status: Compliant
- Evidence:
  - SecureStore used for token/API key: src/services/storage.ts:12, 82
- Risk level: Low
- Fix recommendation: Continue secure storage; keep production logging free of token contents.

### 13) Release profile and AAB configuration are present
- Status: Compliant
- Evidence:
  - eas production profile uses app-bundle: eas.json:21-27
- Risk level: Low
- Fix recommendation: Keep production profile for all Play uploads.

### 14) Play Console submission checklist is incomplete
- Status: Needs fix
- Evidence:
  - Unchecked Data Safety and SMS declaration items: GOOGLE_PLAY_RELEASE_CHECKLIST.md:19, 21, 38
- Risk level: High
- Fix recommendation: Complete all declarations and run a final production validation pass before submission.

### 15) Privacy/declaration docs are present but still draft-style
- Status: Needs fix
- Evidence:
  - Submission pack and policy URL: PLAY_CONSOLE_SUBMISSION_PACK.md:5-7
  - SMS declaration template: PLAY_SMS_PERMISSION_DECLARATION.md:1
- Risk level: Medium
- Fix recommendation: Replace draft wording with final, behavior-accurate language matching the shipped build.

### 16) Release signing safeguards exist but require environment readiness
- Status: Needs fix
- Evidence:
  - Signing properties guard in Gradle: android/app/build.gradle:107-131
- Risk level: Medium
- Fix recommendation: Validate signing variables in CI and run at least one clean production AAB build/install smoke test.

### 17) Not applicable items
- iOS SMS reading policy: Not applicable (iOS does not allow app-level SMS inbox reading)

## Overall Compliance Score

**4.5 / 10**

## Top 5 Rejection Blockers

1. <span style="color:red">Restricted SMS permissions combined with background SMS processing without a complete default SMS app implementation.</span>
2. <span style="color:red">Mismatch between policy/onboarding claims and actual app behavior seen by reviewers.</span>
3. <span style="color:red">Raw SMS body handling/transmission and SMS preview logging (privacy/data minimization risk).</span>
4. Incomplete Play Console declarations (Data Safety + restricted SMS form + final release checks).
5. Over-broad permission surface (audio/storage/contacts) versus clearly demonstrated core functionality.

## Quick Remediation Priority

1. <span style="color:red">Resolve SMS policy path first: either fully become compliant default SMS app or remove restricted SMS permissions from production.</span>
2. Remove sensitive SMS content from logs and minimize backend payload fields.
3. Trim unused permissions from production manifest/config.
4. Align Play docs and in-app disclosures with real behavior.
5. Finalize Play Console forms and validate with a production artifact dry run.
