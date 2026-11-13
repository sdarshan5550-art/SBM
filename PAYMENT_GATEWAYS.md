# SBM Hotel & Guest House — Multi-Property Payment Gateway Architecture & Configuration Guide

This document defines the production multi-property payment gateway architecture, environment configuration requirements, security controls, and webhook integration guidelines for **SBM 1 (SBM Hotel)** and **SBM 2 (SBM 2 Guest House)**.

---

## 1. Property and Gateway Isolation

Each property operates an independent merchant account, gateway provider, and settlement bank account. Credentials, settlement accounts, and callbacks are completely isolated and never mixed.

* **SBM 1: SBM Hotel (`sbm-hotel`)**: Easebuzz Hosted Checkout (LIVE Environment: `https://pay.easebuzz.in`)
* **SBM 2: SBM 2 Guest House (`sbm-guest-house`)**: PhonePe Standard Checkout SDK (PRODUCTION Environment)

---

## 2. Environment Variables Required

### Global Settings
* `NODE_ENV`: Set to `"production"` in production environments to enforce strict validation.
* `ALLOW_PAYMENT_SIMULATION`: Must be set to `"false"` in production. Set to `"true"` only during offline local testing.
* `APP_URL`: The production public base URL (e.g., `https://sbmhotel.com`).

### SBM 1: SBM Hotel (`sbm-hotel`) — Easebuzz Hosted Checkout
* `SBM1_PAYMENT_GATEWAY_PROVIDER`: Fixed to `easebuzz`.
* `SBM1_GATEWAY_KEY_ID`: Easebuzz Merchant Key.
* `SBM1_GATEWAY_KEY_SECRET`: Easebuzz Merchant Salt (Private - never exposed in client).
* `SBM1_EASEBUZZ_ENV`: `live` (Production endpoint `https://pay.easebuzz.in`) or `test`.
* `SBM1_BANK_ACCOUNT_NAME`: Bank account name for settlements (e.g., `"SBM Hotel Salasar Current A/C"`).
* `SBM1_SETTLEMENT_ACCOUNT_NUMBER`: Settlement bank account number.
* Callback / SURL / FURL URL: `https://sbmhotel.com/api/payments/easebuzz/callback`

### SBM 2: SBM 2 Guest House (`sbm-guest-house`) — PhonePe Standard Checkout SDK
* `SBM2_PAYMENT_GATEWAY_PROVIDER`: Fixed to `phonepe`.
* `SBM2_GATEWAY_KEY_ID` / `SBM2_PHONEPE_CLIENT_ID`: PhonePe Client ID assigned by PhonePe.
* `SBM2_GATEWAY_KEY_SECRET` / `SBM2_PHONEPE_CLIENT_SECRET`: PhonePe Client Secret (Private - never exposed in client).
* `SBM2_PHONEPE_CLIENT_VERSION`: PhonePe Client Version (e.g., `1`).
* `SBM2_PHONEPE_ENV`: `PRODUCTION` (or `SANDBOX` for testing).
* `SBM2_PHONEPE_WEBHOOK_USERNAME`: PhonePe Webhook authentication username configured on the PhonePe merchant dashboard.
* `SBM2_PHONEPE_WEBHOOK_PASSWORD`: PhonePe Webhook authentication password configured on the PhonePe merchant dashboard.
* `SBM2_BANK_ACCOUNT_NAME`: Bank account name for settlements (e.g., `"SBM 2 Guest House Current A/C"`).
* `SBM2_SETTLEMENT_ACCOUNT_NUMBER`: Settlement bank account number.
* Webhook URL: `https://sbmhotel.com/api/payments/webhook/sbm-guest-house`

---

## 3. Webhook & Callback Authentication

### PhonePe Standard Checkout Callback Validation
PhonePe callbacks are validated strictly through the official SDK method:
```javascript
const callbackResponse = client.validateCallback(
  username,
  password,
  authorizationHeader,
  responseBodyString
);
```
* **Raw Request Body**: The exact original HTTP request body is preserved via Express middleware (`req.rawBody`) and passed unmodified to `validateCallback`.
* **Authorization Header**: Passed directly from incoming HTTP `Authorization` (or `x-verify`) header.
* **SDK Context**: Operates safely without mutating global token contexts or leaking across concurrent sessions.

### Easebuzz Hosted Checkout Callback Validation
Easebuzz callbacks are verified using reverse SHA-512 checksum:
`sha512(salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)`

---

## 4. Unified Payment Verification & Idempotency

All payment completions (via client verify, callbacks, and webhooks) are routed through a single unified finalization function enforcing:
1. **Booking Existence**: Booking must exist in the database.
2. **Order Match**: Order ID and transaction ID must match the booking record.
3. **Property Ownership**: Booking `property_code` must match the transaction (`sbm-hotel` vs `sbm-guest-house`).
4. **Gateway Match**: Gateway provider must match the property (`sbm-hotel` = `easebuzz`, `sbm-guest-house` = `phonepe`).
5. **Status Verification**: Status must be `COMPLETED` / `SUCCESS`.
6. **Paise Normalization & Exact Amount Match**: Both PhonePe integer paise and Easebuzz rupee amounts are normalized to integer paise before comparing with `Math.round(booking.total_amount * 100)`.
7. **Currency Verification**: Must be `INR`.
8. **Idempotency Protection**: Duplicate callbacks return confirmed status without double-crediting or duplicate customer notifications.

---

## 5. Security & Production Guardrails
* **Zero Secret Exposure**: Merchant Salt, Client Secret, and Webhook Passwords are never sent to the frontend or printed in application logs.
* **No Mock Fallback**: In production (`ALLOW_PAYMENT_SIMULATION=false`), all payments require genuine gateway confirmation; no simulated success is generated.
