# Implementation Audit - Package Billing Mode Migration (2026-05-12)

## Scope
- Remote backend and dashboard inspected via SSH at `/var/www/checkpay-v2`.
- Local mobile app inspected from this workspace.

## Remote Backend Evidence
- Prisma schema still includes `enum UserPlan { FREE PREMIUM }` and `User.plan UserPlan @default(FREE)`.
- `PackagePurchase` includes only basic fields (`transactionNumber`, `status`, `verifiedAt`, `verifiedBy`, `adminNotes`) and does not include purchase proof metadata (`channel`, `screenshotUrl`, OCR output, confidence).
- No route/controller evidence found for a global billing mode endpoint (for example `system-config/billing-mode`).
- `tokenUsage`/`txnController` logic is still token-counter based and decrements counters through `checkAndConsumeToken`.
- Seed prices are not locked to the requested fixed prices; seed contains values like `9.99`, `49.99`, `89.99`, etc.

## Remote Dashboard Evidence
- Package management pages expose token quota fields (`maxPhoneTxns`, `maxVerifiedTxns`) and purchase-by-transaction-number flow.
- No explicit global billing mode toggle UI found.
- No mode-specific editor enforcement found for fixed-only (monthly/6-month/yearly) vs count-only fields.
- Admin purchase verification page appears to support manual verify/reject flow, but no OCR-confidence auto-approval flow.

## Local Mobile Evidence
- Mobile API expects billing mode endpoint: `/system-config/billing-mode` with fallback to `COUNT_BASED`.
- `PremiumScreen` supports UI branching for `FIXED_PRICE` vs `COUNT_BASED` package display.
- `ProfileScreen` supports UI branching for `FIXED_PRICE` vs `COUNT_BASED` package display and caches package usage.
- `PaymentModal` only captures transaction number; it does not capture payment channel + screenshot upload.
- `SMSHeadlessTask` processes only matched financial SMS patterns and skips unmatched/background noise.

## Test Coverage Evidence
- No project-level backend API/entitlement tests found under source test folders; only dependency tests under `node_modules` were found by filename scan.
