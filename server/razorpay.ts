import crypto from 'crypto';

/**
 * Razorpay Payment Gateway Server-Side Module for SBM Hotel
 * Handles:
 * 1. Environment variable sanitization (trimming quotes/spaces)
 * 2. Secure HTTP Basic Authentication for Orders API (POST https://api.razorpay.com/v1/orders)
 * 3. HMAC-SHA256 Payment Signature Verification
 * 4. Webhook Signature Verification
 * 5. Safe Startup and Runtime Diagnostics without exposing secrets
 */

// Default active Razorpay Test Credentials provided for SBM Hotel
export const DEFAULT_TEST_KEY_ID = 'rzp_test_TRDGuSUIMqEArq';
export const DEFAULT_TEST_KEY_SECRET = 'pTQbfu4fvI9VVAUPPx16ROLE';

// Helper to sanitize environment variables (removes quotes, trailing/leading spaces, newlines)
export function sanitizeEnv(val: string | undefined | null): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

export interface RazorpayGatewayConfig {
  key_id: string;
  key_secret: string;
  webhook_secret: string;
  is_configured: boolean;
  mode: 'test' | 'live' | 'unconfigured';
  masked_key_id: string;
}

export function getRazorpayServerConfig(): RazorpayGatewayConfig {
  let envKeyId = sanitizeEnv(process.env.RAZORPAY_KEY_ID);
  let envKeySecret = sanitizeEnv(process.env.RAZORPAY_KEY_SECRET);
  const webhook_secret = sanitizeEnv(process.env.RAZORPAY_WEBHOOK_SECRET);

  // If environment contains the old deactivated key or is empty, use the new active credentials
  const DEACTIVATED_OLD_KEYS = ['rzp_test_TOXqdFl9d0XqVd', 'rzp_test_sbmhotel2026'];
  if (!envKeyId || DEACTIVATED_OLD_KEYS.includes(envKeyId)) {
    envKeyId = DEFAULT_TEST_KEY_ID;
    envKeySecret = DEFAULT_TEST_KEY_SECRET;
  } else if (!envKeySecret && envKeyId === DEFAULT_TEST_KEY_ID) {
    envKeySecret = DEFAULT_TEST_KEY_SECRET;
  }

  const key_id = envKeyId;
  const key_secret = envKeySecret;

  const is_configured = Boolean(key_id && key_secret);
  let mode: 'test' | 'live' | 'unconfigured' = 'unconfigured';
  if (key_id.startsWith('rzp_test_')) {
    mode = 'test';
  } else if (key_id.startsWith('rzp_live_')) {
    mode = 'live';
  }

  const masked_key_id = key_id
    ? `${key_id.substring(0, 12)}...${key_id.substring(key_id.length - 4)}`
    : 'NOT SET';

  return {
    key_id,
    key_secret,
    webhook_secret,
    is_configured,
    mode,
    masked_key_id
  };
}

/**
 * Print safe startup diagnostics to server console without exposing sensitive secrets
 */
export function logRazorpayStartupDiagnostics(): void {
  const cfg = getRazorpayServerConfig();
  console.log('================================================================');
  console.log(' [SBM HOTEL] Razorpay Payment Gateway Server Configuration');
  console.log(` Status:           ${cfg.is_configured ? 'CONFIGURED & READY' : 'NOT FULLY CONFIGURED (Missing Key ID or Secret)'}`);
  console.log(` Operating Mode:   ${cfg.mode.toUpperCase()}`);
  console.log(` Key ID:           ${cfg.masked_key_id} (Length: ${cfg.key_id.length})`);
  console.log(` Key Secret:       ${cfg.key_secret ? `PRESENT (Length: ${cfg.key_secret.length} chars)` : 'MISSING'}`);
  console.log(` Webhook Secret:   ${cfg.webhook_secret ? `PRESENT (Length: ${cfg.webhook_secret.length} chars)` : 'NOT SET'}`);

  if (cfg.key_id && !cfg.key_secret) {
    console.warn(' [WARNING] RAZORPAY_KEY_ID is set but RAZORPAY_KEY_SECRET is missing. Online payments will fail.');
  }
  if (cfg.mode === 'test' && cfg.key_secret && cfg.key_secret.length < 10) {
    console.warn(' [WARNING] RAZORPAY_KEY_SECRET looks too short. Check your Razorpay Dashboard.');
  }
  console.log('================================================================');
}

export interface CreateOrderParams {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

/**
 * Creates a Razorpay Order directly using standard HTTP Basic Authentication with https://api.razorpay.com/v1/orders
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResponse> {
  const cfg = getRazorpayServerConfig();

  if (!cfg.is_configured) {
    console.error('[Razorpay Error] Online payment cannot be initialized: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from environment variables.');
    throw new Error('Payment gateway is not configured on the server. Please check server environment variables.');
  }

  const { amountInPaise, currency = 'INR', receipt, notes = {} } = params;

  // Basic Auth Credentials
  const authHeader = `Basic ${Buffer.from(`${cfg.key_id}:${cfg.key_secret}`).toString('base64')}`;

  console.log(`[Razorpay] Creating Order: receipt=${receipt}, amount=${amountInPaise} paise (₹${amountInPaise / 100}), key_id=${cfg.masked_key_id}, mode=${cfg.mode}`);

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'User-Agent': 'SBM-Hotel-Salasar/1.0'
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      receipt,
      notes
    })
  });

  const responseData: any = await response.json();

  if (!response.ok) {
    const statusCode = response.status;
    const errorDescription = responseData?.error?.description || responseData?.message || 'Unknown Razorpay Error';
    const errorCode = responseData?.error?.code || 'BAD_REQUEST_ERROR';

    console.error(`[Razorpay Order API Error] HTTP ${statusCode} (${errorCode}): ${errorDescription}`);
    console.error(`[Razorpay Order Diagnostics] Key ID: ${cfg.masked_key_id}, Secret length: ${cfg.key_secret.length}, Mode: ${cfg.mode}`);

    if (statusCode === 401 || errorDescription.toLowerCase().includes('authentication failed')) {
      console.error('[Razorpay Diagnostic Note] 401 Authentication Failed means the Key Secret does not match the Key ID in the Razorpay Dashboard (Settings -> API Keys), or the key has been regenerated/deactivated.');
      throw new Error('Payment gateway authentication failed with Razorpay API. Please check server payment credentials.');
    }

    throw new Error(`Razorpay Error: ${errorDescription}`);
  }

  console.log(`[Razorpay] Order Created Successfully: order_id=${responseData.id}, status=${responseData.status}`);
  return responseData as RazorpayOrderResponse;
}

export interface VerifySignatureParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Cryptographically verifies the Razorpay payment signature on the server using HMAC-SHA256
 */
export function verifyRazorpaySignature(params: VerifySignatureParams): { isValid: boolean; error?: string } {
  const cfg = getRazorpayServerConfig();

  if (!cfg.key_secret) {
    console.error('[Razorpay Verify Error] Server RAZORPAY_KEY_SECRET is missing.');
    return { isValid: false, error: 'Payment gateway secret not configured on server.' };
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return { isValid: false, error: 'Missing required signature parameters.' };
  }

  try {
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', cfg.key_secret)
      .update(text)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      console.warn(`[Razorpay Signature Verification FAILED] Order: ${razorpay_order_id}, Payment: ${razorpay_payment_id}`);
    } else {
      console.log(`[Razorpay Signature Verification PASSED] Order: ${razorpay_order_id}, Payment: ${razorpay_payment_id}`);
    }

    return { isValid };
  } catch (err: any) {
    console.error('[Razorpay Signature Verification Exception]', err);
    return { isValid: false, error: err.message };
  }
}

/**
 * Validates Razorpay Webhook signature using RAZORPAY_WEBHOOK_SECRET
 */
export function verifyRazorpayWebhookSignature(rawBody: string, webhookSignature: string): boolean {
  const cfg = getRazorpayServerConfig();
  const secret = cfg.webhook_secret || cfg.key_secret;

  if (!secret || !webhookSignature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return expectedSignature === webhookSignature;
  } catch (err) {
    console.error('[Razorpay Webhook Signature Verification Error]', err);
    return false;
  }
}
