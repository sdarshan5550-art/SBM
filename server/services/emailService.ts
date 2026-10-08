import nodemailer, { Transporter } from 'nodemailer';
import { Booking } from '../../src/types';
import { db } from '../db';

// Email Configuration from server-side environment variables
export interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from?: string;
  adminEmail?: string;
  isConfigured: boolean;
}

export function getEmailConfig(): EmailConfig {
  let host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'mail.cyberpersons.com';
  if (host === 'sbmhotel.com') {
    host = 'mail.cyberpersons.com';
  }
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
  const user = process.env.EMAIL_USER || process.env.SMTP_USER || 'bookings@sbmhotel.com';
  const password = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || (user ? user : 'bookings@sbmhotel.com');
  const adminEmail = process.env.ADMIN_EMAIL || process.env.HOTEL_ADMIN_EMAIL || 'sbmhotel@gmail.com';

  const isConfigured = Boolean(host && user && password);

  return {
    host,
    port,
    secure: port === 465,
    user,
    password,
    from,
    adminEmail,
    isConfigured
  };
}

let transporter: Transporter | null = null;
let lastSmtpFailureTime = 0;
const SMTP_FAILURE_COOLDOWN_MS = 60000; // Retry live SMTP only after 1 minute of failure

function isSmtpInCooldown(): boolean {
  if (lastSmtpFailureTime === 0) return false;
  return Date.now() - lastSmtpFailureTime < SMTP_FAILURE_COOLDOWN_MS;
}

function recordSmtpFailure(err: any): void {
  lastSmtpFailureTime = Date.now();
  transporter = null;
  console.warn(`[EMAIL ERROR] Live SMTP connection failed: ${err?.message || err}. Fallback mode active.`);
}

export function getTransporter(): Transporter | null {
  const cfg = getEmailConfig();
  if (!cfg.isConfigured || !cfg.host || !cfg.user || !cfg.password || isSmtpInCooldown()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      requireTLS: cfg.port === 587,
      auth: {
        user: cfg.user,
        pass: cfg.password
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  return transporter;
}

// SMTP Connection Verification with transporter.verify()
export async function verifySmtpConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  const cfg = getEmailConfig();
  if (!cfg.isConfigured || !cfg.host || !cfg.user || !cfg.password) {
    return {
      success: false,
      message: 'SMTP credentials are not fully configured in environment variables (EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD).'
    };
  }

  try {
    const testMailer = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      requireTLS: cfg.port === 587,
      auth: {
        user: cfg.user,
        pass: cfg.password
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 7000
    });

    await testMailer.verify();
    console.log(`[EMAIL] SMTP connection verified successfully on ${cfg.host}:${cfg.port}`);
    return {
      success: true,
      message: `SMTP connection verified successfully on ${cfg.host}:${cfg.port}`,
      details: {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        user: cfg.user,
        from: cfg.from,
        adminEmail: cfg.adminEmail
      }
    };
  } catch (err: any) {
    console.error(`[EMAIL ERROR] SMTP verification failed:`, err?.message || err);
    return {
      success: false,
      message: `SMTP verification failed: ${err.message}`,
      details: {
        code: err.code,
        command: err.command,
        response: err.response
      }
    };
  }
}

// Log startup diagnostics safely without revealing credentials
export function logEmailStartupDiagnostics(): void {
  const cfg = getEmailConfig();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (cfg.isConfigured) {
    console.log(`✉️  [SBM Email Service] Configured via SMTP (${cfg.host}:${cfg.port})`);
    console.log(`✉️  [SBM Email Service] From: ${cfg.from}`);
    console.log(`✉️  [SBM Email Service] Admin Alerts To: ${cfg.adminEmail}`);
  } else {
    console.log('ℹ️  [SBM Email Service] SMTP environment variables not configured.');
    console.log('ℹ️  [SBM Email Service] Notifications will be logged in console without failing bookings.');
    console.log('ℹ️  [SBM Email Service] To enable live emails, define in .env:');
    console.log('    EMAIL_HOST=smtp.gmail.com');
    console.log('    EMAIL_PORT=587');
    console.log('    EMAIL_USER=your_email@gmail.com');
    console.log('    EMAIL_PASSWORD=your_app_password');
    console.log('    EMAIL_FROM="SBM Hotel Salasar" <your_email@gmail.com>');
    console.log('    ADMIN_EMAIL=sbmhotel@gmail.com');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Helper: Format Currency in INR
function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

// Helper: Format Date
function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// Hotel Property Contacts
function getPropertyContact(propertyCode: string) {
  if (propertyCode === 'sbm-guest-house') {
    return {
      name: 'SBM 2 Guest House',
      address: 'Near Temple Approach Road, Salasar, Rajasthan 331506',
      phone: '+91 98285 00845, +91 98286 36000',
      email: 'sbmguesthouse@gmail.com',
      mapUrl: 'https://maps.app.goo.gl/19CoN9AhnbGm9oRWA'
    };
  }
  return {
    name: 'SBM Hotel',
    address: 'Main Temple Road, Opposite Salasar Balaji Temple, Salasar, Rajasthan 331506',
    phone: '+91 99835 67921 / 01568 252186',
    email: 'sbmhotel@gmail.com',
    mapUrl: 'https://maps.app.goo.gl/WTJqJpA7fL6B3fBx9'
  };
}

// ==========================================
// 1. CUSTOMER BOOKING CONFIRMATION EMAIL
// ==========================================
export async function sendBookingConfirmationEmail(
  booking: Booking,
  options?: { force?: boolean }
): Promise<{ success: boolean; messageId?: string; simulated?: boolean; alreadySent?: boolean; error?: string }> {
  try {
    const recipient = (booking.guest_email || '').trim();
    if (!recipient) {
      console.warn(`[EMAIL ERROR] Cannot send confirmation: guest_email is missing for booking ${booking.booking_number}`);
      db.updateBookingEmailStatus(booking.id, 'customer', 'failed', undefined, 'Recipient email missing');
      return { success: false, error: 'Recipient email missing' };
    }

    // Duplicate Protection: Skip if already successfully sent unless forced
    if (booking.customer_email_status === 'sent' && !options?.force) {
      console.log(`[EMAIL] Skipping duplicate customer email for ${booking.booking_number}. Already sent at ${booking.customer_email_sent_at}`);
      return { success: true, alreadySent: true };
    }

    console.log(`[EMAIL] Preparing customer confirmation for ${booking.booking_number} -> ${recipient}`);

    const cfg = getEmailConfig();
    const hotel = getPropertyContact(booking.property_code);
    const nights = booking.nights || 1;
    const roomsCount = booking.rooms_requested || 1;
    const guestsCount = (booking.adults || 1) + (booking.children || 0);

    const isPaid = booking.payment_status === 'Completed' || booking.payment_status === 'Paid';
    const amountPaid = isPaid ? (booking.total_amount || 0) : (booking.paid_amount || 0);
    const remainingAmount = Math.max(0, (booking.total_amount || 0) - amountPaid);

    const subject = `Booking Confirmed — SBM Hotel | ${booking.booking_number}`;

    const textContent = `
SBM HOTEL & GUEST HOUSE — SALASAR BALAJI
==========================================
BOOKING CONFIRMATION

Confirmation ID: ${booking.booking_number}

Dear ${booking.guest_name},

Thank you for choosing ${booking.property_name || hotel.name}! Your reservation has been successfully confirmed. We look forward to welcoming you for a peaceful and blessed stay in Salasar.

GUEST INFORMATION
-----------------
Guest Name:   ${booking.guest_name}
Mobile:       ${booking.guest_phone}
Email:        ${booking.guest_email}

STAY DETAILS
-----------------
Property:     ${booking.property_name || hotel.name}
Room:         ${booking.room_name} ${booking.room_number ? `(Room #${booking.room_number})` : ''}
Check-in:     ${formatDate(booking.check_in)} (12:00 PM)
Check-out:    ${formatDate(booking.check_out)} (11:00 AM)
Duration:     ${nights} Night(s) • ${roomsCount} Room(s)
Adults:       ${booking.adults || 1}
Children:     ${booking.children || 0}

PAYMENT & PRICE
-----------------
Room Amount:  ${formatINR(booking.room_subtotal)}
${booking.discount_amount && booking.discount_amount > 0 ? `Coupon (${booking.coupon_code || 'Discount'}): -${formatINR(booking.discount_amount)}\nTaxable Amount: ${formatINR(Math.max(0, (booking.room_subtotal || 0) - (booking.discount_amount || 0)))}\n` : ''}GST/Taxes:    ${formatINR(booking.tax_amount)}
Total Amount: ${formatINR(booking.total_amount)}
Amount Paid:  ${formatINR(amountPaid)}
Balance Due:  ${formatINR(remainingAmount)}

Payment Method: ${booking.payment_method === 'online_razorpay' ? 'Razorpay Online' : (booking.payment_method || 'Pay at Hotel')}
Payment Status: ${booking.payment_status}
${booking.payment_txn_id ? `Payment Ref:    ${booking.payment_txn_id}\n` : ''}
${booking.special_request ? `Special Request: ${booking.special_request}\n` : ''}

HOTEL INFORMATION
-----------------
${hotel.name}
${hotel.address}
Phone: ${hotel.phone}
Email: ${hotel.email}
Location: ${hotel.mapUrl}

IMPORTANT GUIDELINES:
- Check-in time is 12:00 PM and Check-out time is 11:00 AM.
- 100% Pure Vegetarian premises. Alcohol and non-vegetarian food are strictly prohibited.
- Valid Government ID (Aadhaar / Passport / Driving License / Voter ID) is mandatory for all adult guests at check-in.
- Cancellation Policy: 100% refund if cancelled 48h prior to check-in. 50% refund within 24-48h.

We wish you a blessed darshan at Sri Salasar Balaji Temple!
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed — ${booking.booking_number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 24px 0;">
    <tr>
      <td align="center">
        <!-- Main Voucher Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);">
          
          <!-- Black Luxury Header with Gold Accents -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 28px 28px 24px 28px; text-align: center; border-bottom: 3px solid #C5A059;">
              <p style="margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; color: #C5A059; font-weight: 700;">SALASAR BALAJI • RAJASTHAN</p>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">${booking.property_name || hotel.name}</h1>
              <div style="display: inline-block; margin-top: 12px; background-color: rgba(197, 160, 89, 0.15); border: 1px solid #C5A059; border-radius: 4px; padding: 4px 14px;">
                <span style="color: #C5A059; font-weight: 700; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">✓ Booking Confirmed</span>
              </div>
            </td>
          </tr>

          <!-- Confirmation Banner -->
          <tr>
            <td style="background-color: #fafaf9; padding: 18px 28px; border-bottom: 1px solid #f0f0f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; text-transform: uppercase; color: #71717a; font-weight: 700; letter-spacing: 0.5px;">Confirmation ID</div>
                    <div style="font-size: 18px; font-weight: 800; color: #1a1a1a; font-family: monospace; margin-top: 2px;">${booking.booking_number}</div>
                  </td>
                  <td align="right">
                    <div style="font-size: 11px; text-transform: uppercase; color: #71717a; font-weight: 700; letter-spacing: 0.5px;">Payment Status</div>
                    <div style="font-size: 13px; font-weight: 700; color: ${isPaid ? '#16a34a' : '#d97706'}; margin-top: 2px;">
                      ${isPaid ? 'PAID ONLINE' : 'PAY AT RECEPTION'}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Welcome Message -->
          <tr>
            <td style="padding: 24px 28px 16px 28px;">
              <p style="margin: 0 0 10px 0; font-size: 15px; color: #18181b; font-weight: 600;">Dear ${booking.guest_name},</p>
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #52525b;">
                Jai Shree Balaji! Your reservation at <strong style="color: #18181b;">${booking.property_name || hotel.name}</strong> is confirmed. We look forward to providing you and your family a peaceful and comfortable stay.
              </p>
            </td>
          </tr>

          <!-- Guest Information Section -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #C5A059; margin-bottom: 8px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">
                Guest Information
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #27272a;">
                <tr>
                  <td style="padding: 6px 0; color: #71717a; width: 35%;">Guest Name:</td>
                  <td style="padding: 6px 0; font-weight: 600; color: #18181b;">${booking.guest_name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Mobile Number:</td>
                  <td style="padding: 6px 0; font-weight: 600; color: #18181b;">${booking.guest_phone}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Email Address:</td>
                  <td style="padding: 6px 0; font-weight: 600; color: #18181b;">${booking.guest_email}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Stay Details Section -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #C5A059; margin-bottom: 8px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">
                Stay Details
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fafaf9; border: 1px solid #e4e4e7; border-radius: 6px; font-size: 13px;">
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #71717a;">Room Category</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; font-weight: 700; color: #18181b; text-align: right;">${booking.room_name}</td>
                </tr>
                ${booking.room_number ? `
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #71717a;">Assigned Room</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; font-weight: 700; color: #0284c7; text-align: right;">Room ${booking.room_number}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #71717a;">Check-in Date</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #18181b; text-align: right;">${formatDate(booking.check_in)} (12:00 PM)</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #71717a;">Check-out Date</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #18181b; text-align: right;">${formatDate(booking.check_out)} (11:00 AM)</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #71717a;">Duration & Rooms</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #18181b; text-align: right;">${nights} Night(s) • ${roomsCount} Room(s)</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; color: #71717a;">Guests</td>
                  <td style="padding: 10px 14px; font-weight: 600; color: #18181b; text-align: right;">${booking.adults || 1} Adult(s)${booking.children ? `, ${booking.children} Child(ren)` : ''}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Payment & Price Breakdown -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #C5A059; margin-bottom: 8px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">
                Payment & Price
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fafaf9; border: 1px solid #e4e4e7; border-radius: 6px; font-size: 13px;">
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #71717a;">Room Subtotal</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #18181b; text-align: right;">${formatINR(booking.room_subtotal)}</td>
                </tr>
                ${booking.discount_amount && booking.discount_amount > 0 ? `
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #15803d; font-weight: 600;">Coupon Discount (${booking.coupon_code || 'Applied'})</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #15803d; font-weight: 700; text-align: right;">-${formatINR(booking.discount_amount)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #71717a;">Taxable Amount</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #18181b; text-align: right;">${formatINR(Math.max(0, (booking.room_subtotal || 0) - (booking.discount_amount || 0)))}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #71717a;">GST / Taxes (12%)</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #18181b; text-align: right;">${formatINR(booking.tax_amount)}</td>
                </tr>
                <tr style="background-color: #f5f3ef;">
                  <td style="padding: 12px 14px; border-bottom: 1px solid #e4e4e7; font-size: 14px; font-weight: 700; color: #18181b;">Total Amount</td>
                  <td style="padding: 12px 14px; border-bottom: 1px solid #e4e4e7; font-size: 16px; font-weight: 800; color: #C5A059; text-align: right;">${formatINR(booking.total_amount)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; color: #71717a;">Payment Method</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #18181b; text-align: right;">${booking.payment_method === 'online_razorpay' ? 'Online Razorpay' : (booking.payment_method || 'Pay at Reception')}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; color: ${isPaid ? '#16a34a' : '#d97706'}; font-weight: 600;">Payment Status</td>
                  <td style="padding: 10px 14px; font-weight: 700; color: ${isPaid ? '#16a34a' : '#d97706'}; text-align: right;">${booking.payment_status}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${booking.special_request ? `
          <!-- Special Request -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="background-color: #f4f4f5; border-left: 3px solid #C5A059; padding: 10px 14px; border-radius: 4px; font-size: 13px;">
                <strong style="color: #18181b;">Special Request:</strong> ${booking.special_request}
              </div>
            </td>
          </tr>` : ''}

          <!-- Hotel Information Card -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #1a1a1a; color: #ffffff; border-radius: 6px; padding: 18px; text-align: center;">
                <tr>
                  <td>
                    <div style="font-size: 14px; font-weight: 700; color: #C5A059; text-transform: uppercase; letter-spacing: 1px;">${hotel.name}</div>
                    <div style="font-size: 12px; color: #d4d4d8; margin-top: 4px;">${hotel.address}</div>
                    <div style="font-size: 13px; color: #ffffff; margin-top: 8px; font-weight: 600;">
                      📞 ${hotel.phone} &nbsp;|&nbsp; ✉️ ${hotel.email}
                    </div>
                    <div style="margin-top: 12px;">
                      <a href="${hotel.mapUrl}" target="_blank" style="display: inline-block; background-color: #C5A059; color: #1a1a1a; text-decoration: none; padding: 8px 18px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">
                        📍 Open Location in Google Maps
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Guidelines & Policies Footer -->
          <tr>
            <td style="background-color: #fafaf9; padding: 20px 28px; border-top: 1px solid #e4e4e7; font-size: 11px; color: #71717a; line-height: 1.6;">
              <p style="margin: 0 0 6px 0; font-weight: 700; color: #18181b; text-transform: uppercase; letter-spacing: 0.5px;">Important Hotel Guidelines:</p>
              <ul style="margin: 0 0 10px 0; padding-left: 18px;">
                <li>Check-in time is 12:00 PM and Check-out time is 11:00 AM.</li>
                <li>Pure Vegetarian premises. Alcohol and non-vegetarian food are strictly prohibited.</li>
                <li>Valid Government photo ID is required for all adult guests at check-in.</li>
                <li>Cancellation Policy: 100% refund if cancelled 48h prior to check-in. 50% refund within 24-48h.</li>
              </ul>
              <p style="margin: 0; text-align: center; color: #a1a1aa; font-size: 10px;">
                © 2026 ${hotel.name}. All rights reserved. Salasar Balaji, Rajasthan.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

    const mailer = getTransporter();
    if (!mailer) {
      if (options?.force) {
        return { success: false, simulated: false, error: isSmtpInCooldown() ? 'SMTP is in cooldown after previous failure' : 'SMTP is not configured or unreachable' };
      }
      console.log(`[EMAIL] Simulated confirmation for booking ${booking.booking_number} generated to ${recipient}`);
      db.updateBookingEmailStatus(booking.id, 'customer', 'simulated', new Date().toISOString());
      return { success: true, simulated: true };
    }

    try {
      const info = await mailer.sendMail({
        from: cfg.from,
        to: recipient,
        subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`[EMAIL] Customer email sent to ${recipient} (Message ID: ${info.messageId}) for booking ${booking.booking_number}`);
      db.updateBookingEmailStatus(booking.id, 'customer', 'sent', new Date().toISOString());
      return { success: true, messageId: info.messageId, simulated: false };
    } catch (sendErr: any) {
      recordSmtpFailure(sendErr);
      if (options?.force) {
        return { success: false, simulated: false, error: sendErr.message };
      }
      console.log(`[EMAIL] Customer confirmation simulated for ${booking.booking_number} (Recipient: ${recipient})`);
      db.updateBookingEmailStatus(booking.id, 'customer', 'simulated', new Date().toISOString());
      return { success: true, simulated: true };
    }
  } catch (err: any) {
    console.error(`[EMAIL ERROR] Customer confirmation failed for ${booking.booking_number}:`, err?.message || err);
    db.updateBookingEmailStatus(booking.id, 'customer', 'failed', undefined, err.message);
    return { success: true, simulated: true, error: err.message };
  }
}

// ==========================================
// 2. HOTEL ADMIN NOTIFICATION EMAIL
// ==========================================
export async function sendAdminBookingNotification(
  booking: Booking,
  options?: { force?: boolean }
): Promise<{ success: boolean; messageId?: string; simulated?: boolean; alreadySent?: boolean; error?: string }> {
  try {
    const cfg = getEmailConfig();
    const adminRecipient = cfg.adminEmail;
    if (!adminRecipient) {
      console.warn(`[EMAIL ERROR] Cannot send admin notification: ADMIN_EMAIL is not configured in .env`);
      db.updateBookingEmailStatus(booking.id, 'admin', 'failed', undefined, 'ADMIN_EMAIL not configured');
      return { success: false, error: 'Admin email not configured' };
    }

    // Duplicate Protection: Skip if already successfully sent unless forced
    if (booking.admin_email_status === 'sent' && !options?.force) {
      console.log(`[EMAIL] Skipping duplicate admin notification for ${booking.booking_number}. Already sent at ${booking.admin_email_sent_at}`);
      return { success: true, alreadySent: true };
    }

    console.log(`[EMAIL] Preparing admin notification for ${booking.booking_number} -> ${adminRecipient}`);

    const hotel = getPropertyContact(booking.property_code);
    const nights = booking.nights || 1;
    const isPaid = booking.payment_status === 'Completed' || booking.payment_status === 'Paid';

    const subject = `New Booking Received — SBM Hotel | ${booking.booking_number}`;

    const textContent = `
NEW BOOKING
==========================================
Booking ID:     ${booking.booking_number}
Property:       ${booking.property_name || hotel.name}

Guest:          ${booking.guest_name}
Mobile:         ${booking.guest_phone}
Email:          ${booking.guest_email}

Room:           ${booking.room_name} ${booking.room_number ? `(Room #${booking.room_number})` : ''}
Check-in:       ${booking.check_in}
Check-out:      ${booking.check_out}
Nights:         ${nights}
Adults:         ${booking.adults || 1}
Children:       ${booking.children || 0}
Rooms:          ${booking.rooms_requested || 1}

Total:          ${formatINR(booking.total_amount)}
Payment Method: ${booking.payment_method === 'online_razorpay' ? 'Razorpay Online' : (booking.payment_method || 'Pay at Reception')}
Payment Status: ${booking.payment_status}
${booking.payment_txn_id ? `Txn Reference:  ${booking.payment_txn_id}\n` : ''}
${booking.special_request ? `Special Request: ${booking.special_request}\n` : ''}
Source:         ${booking.source || 'WEBSITE DIRECT'}
Placed At:      ${new Date(booking.created_at || Date.now()).toLocaleString('en-IN')}
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New Booking Received — ${booking.booking_number}</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden;">
          
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px 28px; text-align: left; border-bottom: 2px solid #C5A059;">
              <span style="background-color: rgba(197, 160, 89, 0.2); color: #C5A059; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 10px; border-radius: 3px;">NEW BOOKING RECEIVED</span>
              <h2 style="margin: 8px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 800;">${booking.booking_number}</h2>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">${booking.property_name || hotel.name} • ${booking.room_name}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td width="50%" style="vertical-align: top; padding: 10px; background-color: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Total Revenue</div>
                    <div style="font-size: 20px; font-weight: 800; color: #38bdf8; margin-top: 2px;">${formatINR(booking.total_amount)}</div>
                    <div style="font-size: 12px; color: ${isPaid ? '#4ade80' : '#fbbf24'}; font-weight: 600; margin-top: 2px;">
                      ${isPaid ? '✓ Paid Online (Razorpay)' : 'Pending Pay at Reception'}
                    </div>
                  </td>
                  <td width="8"></td>
                  <td width="50%" style="vertical-align: top; padding: 10px; background-color: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Guest Details</div>
                    <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 2px;">${booking.guest_name}</div>
                    <div style="font-size: 12px; color: #cbd5e1; margin-top: 2px;">📞 ${booking.guest_phone}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">✉️ ${booking.guest_email}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 13px;">
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Stay Dates</td>
                  <td style="padding: 10px 0; color: #ffffff; text-align: right; font-weight: 600;">${booking.check_in} ➔ ${booking.check_out} (${nights}N)</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Rooms & Guests</td>
                  <td style="padding: 10px 0; color: #ffffff; text-align: right; font-weight: 600;">${booking.rooms_requested || 1} Room(s) • ${booking.adults || 1} Adult(s), ${booking.children || 0} Child</td>
                </tr>
                ${booking.room_number ? `
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Assigned Room</td>
                  <td style="padding: 10px 0; color: #38bdf8; text-align: right; font-weight: 700;">Room ${booking.room_number}</td>
                </tr>` : ''}
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Payment Method</td>
                  <td style="padding: 10px 0; color: #ffffff; text-align: right; font-weight: 600;">${booking.payment_method === 'online_razorpay' ? 'Razorpay Online' : (booking.payment_method || 'Pay at Hotel')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Booking Channel</td>
                  <td style="padding: 10px 0; color: #a78bfa; text-align: right; font-weight: 700;">${booking.source || 'WEBSITE DIRECT'}</td>
                </tr>
                ${booking.payment_txn_id ? `
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Payment Txn ID</td>
                  <td style="padding: 10px 0; color: #e2e8f0; font-family: monospace; text-align: right;">${booking.payment_txn_id}</td>
                </tr>` : ''}
                ${booking.special_request ? `
                <tr>
                  <td colspan="2" style="padding: 12px 0 4px 0;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Special Request:</div>
                    <div style="font-size: 13px; color: #f1f5f9; margin-top: 4px; background: #0f172a; padding: 10px; border-radius: 6px;">${booking.special_request}</div>
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: #0f172a; padding: 14px 28px; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                SBM Hotel Automated Booking Notification System • Salasar Balaji
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

    const mailer = getTransporter();
    if (!mailer) {
      if (options?.force) {
        return { success: false, simulated: false, error: isSmtpInCooldown() ? 'SMTP is in cooldown after previous failure' : 'SMTP is not configured or unreachable' };
      }
      console.log(`[EMAIL] Simulated admin notification for booking ${booking.booking_number} generated to ${adminRecipient}`);
      db.updateBookingEmailStatus(booking.id, 'admin', 'simulated', new Date().toISOString());
      return { success: true, simulated: true };
    }

    try {
      const info = await mailer.sendMail({
        from: cfg.from,
        to: adminRecipient,
        subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`[EMAIL] Admin notification sent to ${adminRecipient} (Message ID: ${info.messageId}) for booking ${booking.booking_number}`);
      db.updateBookingEmailStatus(booking.id, 'admin', 'sent', new Date().toISOString());
      return { success: true, messageId: info.messageId, simulated: false };
    } catch (sendErr: any) {
      recordSmtpFailure(sendErr);
      if (options?.force) {
        return { success: false, simulated: false, error: sendErr.message };
      }
      console.log(`[EMAIL] Admin notification simulated for ${booking.booking_number} (Recipient: ${adminRecipient})`);
      db.updateBookingEmailStatus(booking.id, 'admin', 'simulated', new Date().toISOString());
      return { success: true, simulated: true };
    }
  } catch (err: any) {
    console.error(`[EMAIL ERROR] Admin booking notification failed for ${booking.booking_number}:`, err?.message || err);
    db.updateBookingEmailStatus(booking.id, 'admin', 'failed', undefined, err.message);
    return { success: true, simulated: true, error: err.message };
  }
}

// ==========================================
// 3. BOOKING CANCELLATION EMAIL
// ==========================================
export async function sendBookingCancellationEmail(
  booking: Booking,
  reason?: string
): Promise<{ success: boolean; messageId?: string; simulated?: boolean; error?: string }> {
  try {
    const recipient = (booking.guest_email || '').trim();
    if (!recipient) {
      return { success: false, error: 'Recipient email missing' };
    }

    const cfg = getEmailConfig();
    const hotel = getPropertyContact(booking.property_code);
    const subject = `Booking Cancelled — SBM Hotel | ${booking.booking_number}`;

    const textContent = `
SBM HOTEL & GUEST HOUSE — SALASAR BALAJI
==========================================
BOOKING CANCELLATION NOTICE

Dear ${booking.guest_name},

Your reservation ${booking.booking_number} at ${booking.property_name || hotel.name} has been cancelled.

${reason ? `Cancellation Reason: ${reason}\n` : ''}
Stay Dates: ${formatDate(booking.check_in)} to ${formatDate(booking.check_out)}
Room: ${booking.room_name}

If you have any questions or require assistance with refunds, please contact us at ${hotel.phone} or ${hotel.email}.

Sincerely,
${hotel.name} Front Desk
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Booking Cancelled</title></head>
<body style="margin: 0; padding: 24px; background-color: #0b0b0f; font-family: sans-serif; color: #e4e4e7;">
  <div style="max-width: 600px; margin: auto; background-color: #18181b; border: 1px solid #3f3f46; border-radius: 10px; padding: 28px;">
    <div style="color: #ef4444; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Booking Cancelled</div>
    <h2 style="color: #ffffff; margin: 8px 0 16px 0;">Reservation ${booking.booking_number}</h2>
    <p style="color: #a1a1aa; line-height: 1.6;">Dear ${booking.guest_name}, your reservation at <strong style="color: #ffffff;">${booking.property_name || hotel.name}</strong> has been cancelled.</p>
    ${reason ? `<div style="background-color: #27272a; border-left: 3px solid #ef4444; padding: 10px 14px; border-radius: 4px; margin: 16px 0; font-size: 13px; color: #fca5a5;">Reason: ${reason}</div>` : ''}
    <div style="background-color: #27272a; border-radius: 6px; padding: 14px; margin: 18px 0; font-size: 13px;">
      <div><strong>Stay Dates:</strong> ${formatDate(booking.check_in)} to ${formatDate(booking.check_out)}</div>
      <div style="margin-top: 6px;"><strong>Room:</strong> ${booking.room_name} ${booking.room_number ? `(Room ${booking.room_number})` : ''}</div>
    </div>
    <hr style="border: none; border-top: 1px solid #27272a; margin: 20px 0;">
    <p style="font-size: 12px; color: #71717a; margin: 0;">Contact: ${hotel.phone} | ${hotel.email}</p>
  </div>
</body>
</html>
`.trim();

    const mailer = getTransporter();
    if (!mailer) {
      console.log(`[EMAIL] Cancellation email for ${booking.booking_number} simulated for ${recipient}`);
      return { success: true, simulated: true };
    }

    try {
      const info = await mailer.sendMail({
        from: cfg.from,
        to: recipient,
        subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`[EMAIL] Cancellation email sent to ${recipient} (Message ID: ${info.messageId}) for ${booking.booking_number}`);
      return { success: true, messageId: info.messageId };
    } catch (sendErr: any) {
      recordSmtpFailure(sendErr);
      console.log(`[EMAIL] Cancellation email simulated for ${booking.booking_number}`);
      return { success: true, simulated: true };
    }
  } catch (err: any) {
    console.warn(`[EMAIL ERROR] Cancellation email notice for ${booking.booking_number}:`, err.message);
    return { success: true, simulated: true, error: err.message };
  }
}

// ==========================================
// 4. BOOKING MODIFICATION EMAIL
// ==========================================
export async function sendBookingModificationEmail(
  booking: Booking,
  changeSummary?: string
): Promise<{ success: boolean; messageId?: string; simulated?: boolean; error?: string }> {
  try {
    const recipient = (booking.guest_email || '').trim();
    if (!recipient) {
      return { success: false, error: 'Recipient email missing' };
    }

    const cfg = getEmailConfig();
    const hotel = getPropertyContact(booking.property_code);
    const subject = `Booking Update — SBM Hotel | ${booking.booking_number}`;

    const textContent = `
SBM HOTEL & GUEST HOUSE — SALASAR BALAJI
==========================================
BOOKING MODIFICATION NOTICE

Dear ${booking.guest_name},

Your reservation ${booking.booking_number} has been updated.

${changeSummary ? `Updates: ${changeSummary}\n` : ''}
Property:       ${booking.property_name || hotel.name}
Room:           ${booking.room_name} ${booking.room_number ? `(Room ${booking.room_number})` : ''}
Check-in:       ${formatDate(booking.check_in)}
Check-out:      ${formatDate(booking.check_out)}
Status:         ${booking.booking_status}

Please contact us at ${hotel.phone} if you have any questions.

Sincerely,
${hotel.name} Front Desk
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Booking Updated</title></head>
<body style="margin: 0; padding: 24px; background-color: #0b0b0f; font-family: sans-serif; color: #e4e4e7;">
  <div style="max-width: 600px; margin: auto; background-color: #18181b; border: 1px solid #3f3f46; border-radius: 10px; padding: 28px;">
    <div style="color: #38bdf8; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Booking Updated</div>
    <h2 style="color: #ffffff; margin: 8px 0 16px 0;">Reservation ${booking.booking_number}</h2>
    <p style="color: #a1a1aa; line-height: 1.6;">Dear ${booking.guest_name}, details for your reservation at <strong style="color: #ffffff;">${booking.property_name || hotel.name}</strong> have been updated.</p>
    ${changeSummary ? `<div style="background-color: #1e293b; border-left: 3px solid #38bdf8; padding: 10px 14px; border-radius: 4px; margin: 16px 0; font-size: 13px; color: #e2e8f0;">${changeSummary}</div>` : ''}
    <div style="background-color: #27272a; border-radius: 6px; padding: 14px; margin: 18px 0; font-size: 13px;">
      <div><strong>Stay Dates:</strong> ${formatDate(booking.check_in)} to ${formatDate(booking.check_out)}</div>
      <div style="margin-top: 6px;"><strong>Room:</strong> ${booking.room_name} ${booking.room_number ? `(Room ${booking.room_number})` : ''}</div>
      <div style="margin-top: 6px;"><strong>Booking Status:</strong> ${booking.booking_status}</div>
    </div>
    <hr style="border: none; border-top: 1px solid #27272a; margin: 20px 0;">
    <p style="font-size: 12px; color: #71717a; margin: 0;">Contact: ${hotel.phone} | ${hotel.email}</p>
  </div>
</body>
</html>
`.trim();

    const mailer = getTransporter();
    if (!mailer) {
      console.log(`[EMAIL] Modification email for ${booking.booking_number} simulated for ${recipient}`);
      return { success: true, simulated: true };
    }

    try {
      const info = await mailer.sendMail({
        from: cfg.from,
        to: recipient,
        subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`[EMAIL] Modification email sent to ${recipient} (Message ID: ${info.messageId}) for ${booking.booking_number}`);
      return { success: true, messageId: info.messageId };
    } catch (sendErr: any) {
      recordSmtpFailure(sendErr);
      console.log(`[EMAIL] Modification email simulated for ${booking.booking_number}`);
      return { success: true, simulated: true };
    }
  } catch (err: any) {
    console.warn(`[EMAIL ERROR] Modification email notice:`, err.message);
    return { success: true, simulated: true, error: err.message };
  }
}

// 5. ADMIN PASSWORD RESET OTP EMAIL
export async function sendAdminPasswordResetOtp(
  adminEmail: string,
  otpCode: string
): Promise<{ success: boolean; simulated?: boolean; messageId?: string }> {
  const recipient = 'manager@sbmhotel.com';
  const cfg = getEmailConfig();
  const subject = `SBM Hotel Admin - Password Reset OTP`;
  const textContent = `A password reset request was initiated for SBM Hotel admin account: ${adminEmail}.\n\nYour One-Time Password (OTP) is: ${otpCode}\n\nThis OTP is valid for 15 minutes.\nIf you did not request a password reset, please secure your account immediately.`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #C5A059; padding: 20px; background-color: #FAF9F6;">
      <h2 style="color: #1A1A1A; border-bottom: 2px solid #C5A059; padding-bottom: 10px;">SBM Hotel Admin - Password Reset</h2>
      <p style="font-size: 14px; color: #333;">A password reset request was requested for admin account: <strong>${adminEmail}</strong>.</p>
      <div style="background-color: #1A1A1A; color: #C5A059; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 20px 0;">
        ${otpCode}
      </div>
      <p style="font-size: 13px; color: #666;">This One-Time Password (OTP) is valid for <strong>15 minutes</strong>.</p>
      <p style="font-size: 12px; color: #888; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px;">If you did not request this password reset, please ignore this email.</p>
    </div>
  `;

  const mailer = getTransporter();
  if (!mailer) {
    console.log(`[EMAIL] Simulated admin password reset OTP for ${adminEmail} sent to ${recipient}: OTP ${otpCode}`);
    return { success: true, simulated: true };
  }

  try {
    const info = await mailer.sendMail({
      from: cfg.from,
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent
    });
    console.log(`[EMAIL] Admin password reset OTP sent to ${recipient} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (sendErr: any) {
    recordSmtpFailure(sendErr);
    console.log(`[EMAIL] Simulated admin password reset OTP for ${adminEmail} sent to ${recipient}: OTP ${otpCode}`);
    return { success: true, simulated: true };
  }
}

export const emailService = {
  getConfig: getEmailConfig,
  verifySmtp: verifySmtpConnection,
  sendBookingConfirmationEmail,
  sendAdminBookingNotification,
  sendBookingCancellationEmail,
  sendBookingModificationEmail,
  sendAdminPasswordResetOtp
};
