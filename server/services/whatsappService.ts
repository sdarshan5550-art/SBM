/**
 * SBM Hotel - BhashSMS WhatsApp Service
 * 
 * Official BhashSMS V2 WhatsApp Business API integration:
 * 1. App Authentication via POST /auth/v1/appAuthenticate with BHASHSMS_API_KEY
 * 2. WhatsApp OTP delivery via POST /customer/api/v1/campaign/sendMessage using approved template TEMPLATE15506
 * 3. Automated WhatsApp booking confirmations via POST /customer/api/v1/campaign/sendMessage using approved template TEMPLATE15549
 * 
 * Security & Reliability rules:
 * - Server-side only: never expose credentials, access tokens, or OTP codes to client
 * - Normalizes phone numbers with country code (defaults to +91 India if 10 digits)
 * - Checks provider HTTP status and response: never claims delivery if provider rejected the request
 * - No fake success responses or simulated delivery
 * - Safe error handling: provider timeouts or failures never crash the server or break reservations
 * - Prevents duplicate notifications for already notified bookings
 */

import { Booking } from '../../src/types';

export interface BhashSMSConfig {
  baseUrl: string;
  businessCode: string;
  apiKey: string;
  templateOtpCode: string;
  templateBookingCode: string;
  isConfigured: boolean;
}

export function getBhashSMSConfig(): BhashSMSConfig {
  let rawBaseUrl = process.env.BHASHSMS_API_URL || process.env.BHASHSMS_WHATSAPP_ENDPOINT || 'https://apiv2.bhashsms.com';
  rawBaseUrl = rawBaseUrl.trim().replace(/^['"]|['"]$/g, '').trim();
  if (rawBaseUrl && !/^https?:\/\//i.test(rawBaseUrl)) {
    rawBaseUrl = `https://${rawBaseUrl}`;
  }
  let baseUrl = 'https://apiv2.bhashsms.com';
  try {
    const parsed = new URL(rawBaseUrl);
    baseUrl = parsed.origin;
  } catch {
    baseUrl = 'https://apiv2.bhashsms.com';
  }

  const apiKey = (process.env.BHASHSMS_API_KEY || '').trim();
  const businessCode = (process.env.BHASHSMS_BUSINESS_CODE || 'BSLB00380').trim();
  const templateOtpCode = (process.env.BHASHSMS_OTP_TEMPLATE_ID || 'TEMPLATE15506').trim();
  const templateBookingCode = (process.env.BHASHSMS_BOOKING_TEMPLATE_ID || 'TEMPLATE15549').trim();

  return {
    baseUrl,
    businessCode,
    apiKey,
    templateOtpCode,
    templateBookingCode,
    isConfigured: Boolean(apiKey)
  };
}

/**
 * Normalizes phone number into international and national formats.
 * Defaults 10-digit Indian numbers to country code +91.
 */
export function normalizePhoneNumber(rawPhone: string): { normalized: string; nationalNumber: string; countryCode: string } {
  if (!rawPhone) return { normalized: '', nationalNumber: '', countryCode: '+91' };
  
  // Strip all non-numeric characters except leading plus
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If 10 digits, assume India (+91)
  if (cleaned.length === 10) {
    return {
      normalized: `91${cleaned}`,
      nationalNumber: cleaned,
      countryCode: '+91'
    };
  }

  // If 11 digits starting with 0 (e.g. 09876543210)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    const national = cleaned.substring(1);
    return {
      normalized: `91${national}`,
      nationalNumber: national,
      countryCode: '+91'
    };
  }

  // If 12 digits starting with 91 (e.g. 919876543210)
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return {
      normalized: cleaned,
      nationalNumber: cleaned.substring(2),
      countryCode: '+91'
    };
  }

  // Default fallback
  return {
    normalized: cleaned,
    nationalNumber: cleaned.length > 10 ? cleaned.slice(-10) : cleaned,
    countryCode: cleaned.length > 10 ? `+${cleaned.slice(0, cleaned.length - 10)}` : '+91'
  };
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  notConfigured?: boolean;
}

// In-memory token cache to prevent redundant authentication round-trips
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getValidAccessToken(apiKey: string, baseUrl: string): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const authUrl = `${baseUrl}/auth/v1/appAuthenticate`;
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ apiKey })
  });

  if (!res.ok) {
    throw new Error(`Authentication failed with BhashSMS API (HTTP ${res.status})`);
  }

  const authData: any = await res.json();
  if (!authData?.success || !authData?.content?.accessToken) {
    throw new Error('Failed to obtain access token from BhashSMS API');
  }

  cachedAccessToken = authData.content.accessToken;
  // BhashSMS tokens typically expire in 10 minutes. Refresh after 8 minutes.
  tokenExpiresAt = now + 8 * 60 * 1000;
  return cachedAccessToken!;
}

export const bhashSmsService = {
  /**
   * Send WhatsApp OTP for customer login / mobile verification
   */
  async sendOtp(phone: string, otpCode: string): Promise<WhatsAppSendResult> {
    const cfg = getBhashSMSConfig();
    const { normalized, nationalNumber } = normalizePhoneNumber(phone);

    if (!nationalNumber || nationalNumber.length < 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number' };
    }

    if (!cfg.isConfigured) {
      console.error('[BhashSMS WhatsApp] BHASHSMS_API_KEY not configured.');
      return {
        success: false,
        notConfigured: true,
        error: 'WhatsApp service is temporarily unconfigured on the server. Please contact hotel front desk.'
      };
    }

    try {
      const token = await getValidAccessToken(cfg.apiKey, cfg.baseUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const sendUrl = `${cfg.baseUrl}/customer/api/v1/campaign/sendMessage`;
      const payload = {
        businessCode: cfg.businessCode,
        templateCode: cfg.templateOtpCode,
        mobileNumbers: nationalNumber,
        values: [
          { variable: '1', value: otpCode }
        ]
      };

      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const respData: any = await response.json();

      if (!response.ok || !respData?.success) {
        const errorMsg = respData?.message || respData?.detail || `HTTP ${response.status}`;
        console.error('[BhashSMS WhatsApp] Provider send error response:', errorMsg);
        return {
          success: false,
          error: respData?.message || 'WhatsApp message request was not accepted by the provider.'
        };
      }

      const requestCode = respData?.content?.requestCode || `req-${Date.now()}`;
      console.log(`[BhashSMS WhatsApp] OTP send request accepted by provider (RequestCode: ${requestCode})`);
      return {
        success: true,
        messageId: requestCode
      };
    } catch (err: any) {
      const errMsg = err?.name === 'AbortError' ? 'Provider connection timed out' : (err?.message || 'Network error');
      console.error('[BhashSMS WhatsApp] Error communicating with provider:', errMsg);
      return {
        success: false,
        error: 'Unable to communicate with WhatsApp service provider. Please try again later.'
      };
    }
  },

  /**
   * Send WhatsApp Booking Confirmation for a verified booking
   */
  async sendBookingConfirmation(booking: Booking): Promise<WhatsAppSendResult> {
    const cfg = getBhashSMSConfig();
    const guestPhone = booking.guest_phone;
    const { nationalNumber } = normalizePhoneNumber(guestPhone);

    if (!nationalNumber || nationalNumber.length < 10) {
      return { success: false, error: 'Customer mobile number not valid' };
    }

    // Guard: only send if booking is Confirmed or Paid
    const isConfirmed = booking.booking_status === 'Confirmed' || booking.payment_status === 'Completed' || booking.payment_status === 'Paid';
    if (!isConfirmed) {
      return { success: false, error: 'Booking is not confirmed or paid' };
    }

    // Guard: Prevent duplicate sends
    if (booking.whatsapp_status === 'sent') {
      console.log(`[BhashSMS WhatsApp] Skipping duplicate confirmation for ${booking.booking_number}. Already sent at ${booking.whatsapp_sent_at}`);
      return { success: true, messageId: booking.whatsapp_message_id };
    }

    if (!cfg.isConfigured) {
      return { success: false, error: 'WhatsApp service not configured' };
    }

    const hotelName = booking.property_code === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel';
    const totalAmount = `₹${booking.total_amount?.toLocaleString('en-IN') || '0'}`;
    const paymentStatus = booking.payment_status === 'Completed' || booking.payment_status === 'Paid' ? 'Paid' : (booking.payment_status || 'Pending');
    const guestCount = `${booking.adults || 1} Adults${booking.children ? `, ${booking.children} Children` : ''}`;

    try {
      const token = await getValidAccessToken(cfg.apiKey, cfg.baseUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const sendUrl = `${cfg.baseUrl}/customer/api/v1/campaign/sendMessage`;
      const payload = {
        businessCode: cfg.businessCode,
        templateCode: cfg.templateBookingCode,
        mobileNumbers: nationalNumber,
        header: {
          type: 'TEXT',
          value: 'SBM Hotel - Booking Confirmation  Copy'
        },
        values: [
          { variable: 'booking_id', value: booking.booking_number },
          { variable: 'hotel_name', value: hotelName },
          { variable: 'room_name', value: `${booking.rooms_requested} × ${booking.room_name}` },
          { variable: 'check_in', value: booking.check_in },
          { variable: 'check_out', value: booking.check_out },
          { variable: 'guests', value: guestCount },
          { variable: 'amount', value: totalAmount },
          { variable: 'payment_status', value: paymentStatus }
        ]
      };

      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const respData: any = await response.json();

      if (!response.ok || !respData?.success) {
        const errorDetail = respData?.message || respData?.detail || `HTTP ${response.status}`;
        console.error('[BhashSMS WhatsApp] Booking confirmation send rejected:', errorDetail);
        return {
          success: false,
          error: errorDetail
        };
      }

      const requestCode = respData?.content?.requestCode || `bk-${Date.now()}`;
      console.log(`[BhashSMS WhatsApp] Booking confirmation dispatched successfully for ${booking.booking_number} (RequestCode: ${requestCode})`);
      return {
        success: true,
        messageId: requestCode
      };
    } catch (err: any) {
      console.error('[BhashSMS WhatsApp] Error sending booking confirmation:', err?.message || err);
      return { success: false, error: err?.message || 'Failed to dispatch booking confirmation' };
    }
  }
};
