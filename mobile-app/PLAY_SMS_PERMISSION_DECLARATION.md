# Google Play SMS Permission Declaration (Template)

Use this text when completing Google Play's restricted SMS permission form.

## Core functionality

CheckPay is a finance app that automatically detects and structures transaction receipts from user SMS messages. The SMS import flow is a core product feature used to capture transaction events in near real-time and present them in analytics and reconciliation views.

## Why SMS permission is required

Some financial institutions send transaction receipts only by SMS. Without SMS access, these events cannot be detected automatically and users must enter them manually.

## User control and consent

- SMS auto import is optional.
- Users can continue in manual mode without enabling SMS auto import.
- The app asks users to make CheckPay the default SMS app before SMS auto import is enabled.
- If default SMS role is not granted, automatic SMS processing is disabled.

## Data minimization and handling

- The app processes SMS only for transaction extraction.
- Transaction fields are structured (amount, sender, bank, transaction ID) and stored as transaction records.
- Data is encrypted in transit when synced.
- Users can request data deletion.

## In-app disclosure summary

CheckPay asks for SMS-related access only to import transaction receipts automatically. If users do not grant the default SMS role, CheckPay remains usable in manual mode.

## Reviewer testing notes

1. Sign in.
2. Observe SMS import reminder asking to enable default SMS role.
3. Choose manual mode: app remains fully usable.
4. Enable default SMS role: SMS auto import becomes available.
