# SBM Hotel & Guest House — Multi-Property Payment Gateway Architecture & Configuration Guide

This document defines the multi-property payment gateway architecture, environment configuration requirements, security controls, and webhook integration guidelines for **SBM 1 (SBM Hotel)** and **SBM 2 (SBM 2 Guest House)**.

---

## 1. Environment Variables Required

Each property operates an independent merchant account, gateway provider, and settlement bank account. Credentials must never be shared between SBM 1 and SBM 2.

### Global Settings
* `NODE_ENV`: Set to `"production"` in production environments to enforce strict validation.
* `ALLOW_PAYMENT_SIMULATION`: Must be set to `"false"` in production. Set to `"true"` **only** during local development or sandbox testing.
* `APP_URL`: The production public base URL (e.g., `https://sbmhotel.com`).

### SBM 1: SBM Hotel (Primary Property)
* `SBM1_PAYMENT_GATEWAY_PROVIDER`: Gateway provider type (`razorpay` | `phonepe` | `cashfree` | `stripe`).
* `SBM1_MERCHANT_ID`: Merchant identifier for SBM Hotel.
* `SBM1_BANK_ACCOUNT_NAME`: Bank account name for settlements (e.g., `"SBM Hotel Salasar Current A/C (HDFC Bank)"`).
* `SBM1_SETTLEMENT_ACCOUNT_NUMBER`: Bank account number for settlement verification.
* `SBM1_GATEWAY_KEY_ID`: API Key ID / App ID / Publishable Key from the provider dashboard.
* `SBM1_GATEWAY_KEY_SECRET`: API Key Secret / Salt Key from the provider dashboard.
* `SBM1_GATEWAY_WEBHOOK_SECRET`: Webhook signing secret for cryptographically verifying incoming callbacks.

### SBM 2: SBM 2 Guest House (Secondary Property)
* `SBM2_PAYMENT_GATEWAY_PROVIDER`: Gateway provider type (`razorpay` | `phonepe` | `cashfree` | `stripe`).
* `SBM2_MERCHANT_ID`: Merchant identifier for SBM 2 Guest House.
* `SBM2_BANK_ACCOUNT_NAME`: Bank account name for settlements (e.g., `"SBM 2 Guest House Current A/C (ICICI Bank)"`).
* `SBM2_SETTLEMENT_ACCOUNT_NUMBER`: Bank account number for settlement verification.
* `SBM2_GATEWAY_KEY_ID`: API Key ID / App ID / Publishable Key from the provider dashboard.
* `SBM2_GATEWAY_KEY_SECRET`: API Key Secret / Salt Key from the provider dashboard.
* `SBM2_GATEWAY_WEBHOOK_SECRET`: Webhook signing secret for cryptographically verifying incoming callbacks.

---

## 2. Provider Dashboard Settings & Webhook URLs

### Required Webhook Endpoints
Configure the following webhook URLs in each provider's dashboard:
* **SBM Hotel (SBM 1)**: `https://sbmhotel.com/api/payments/webhook/sbm-hotel`
* **SBM 2 Guest House (SBM 2)**: `https://sbmhotel.com/api/payments/webhook/sbm-guest-house`

### Recommended Dashboard Events to Subscribe:
* `order.paid` / `payment.captured`
* `payment.failed`
* `refund.processed`

---

## 3. Deployment Environment Configuration Instructions

Where to configure actual environment variables depending on your infrastructure:
1. **Cloud Run / Google Cloud**: Configure environment variables in the Cloud Run service revision settings or via Secret Manager mounted as environment variables.
2. **Coolify / Docker / VPS (Node.js)**: Define variables in your `.env` file located in the application root directory (`.env`), or in the Coolify project environment variable manager.
3. **Vercel / PaaS**: Set production environment variables in project settings under **Environment Variables**. Ensure server-side variables are not exposed to the client bundle (Vite injects only `VITE_*` prefixed variables to the browser).

---

## 4. Security & Production Guardrails
* **No Secret Exposure**: Secret keys (`key_secret`, `webhook_secret`) are never exposed to the frontend, browser responses, client logs, or source control.
* **Strict Production Validation**: In `NODE_ENV=production`, if credentials are missing or default test keys are detected without explicit sandbox allowance (`ALLOW_PAYMENT_SIMULATION=true`), the backend throws a fatal configuration error rather than falling back to simulated payments.
* **Property Routing**: Payment orders and webhooks are strictly validated against the trusted property ID (`sbm-hotel` vs `sbm-guest-house`) to ensure settlements flow to the correct bank account.

---

## 5. Operational Status Notice
**Do not claim real payments are operational until live production credentials have been configured in the deployment environment and sandbox/live transaction tests have successfully passed.**
