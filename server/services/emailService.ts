import nodemailer, { Transporter } from 'nodemailer';
import { Booking } from '../../src/types';

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
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const password = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || (user ? `"SBM Hotel Salasar" <${user}>` : '"SBM Hotel Salasar" <noreply@sbmhotel.com>');
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

function getTransporter(): Transporter | null {
  const cfg = getEmailConfig();
  if (!cfg.isConfigured || !cfg.host || !cfg.user || !cfg.password) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.password
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  return transporter;
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
export async function sendBookingConfirmationEmail(booking: Booking): Promise<{ success: boolean; messageId?: string; simulated?: boolean; error?: string }> {
  try {
    const recipient = (booking.guest_email || '').trim();
    if (!recipient) {
      console.warn(`[Email Service] Cannot send confirmation: guest_email is missing for booking ${booking.booking_number}`);
      return { success: false, error: 'Recipient email missing' };
    }

    const cfg = getEmailConfig();
    const hotel = getPropertyContact(booking.property_code);
    const nights = booking.nights || 1;
    const roomsCount = booking.rooms_requested || 1;
    const guestsCount = (booking.adults || 1) + (booking.children || 0);

    const isPaid = booking.payment_status === 'Completed' || booking.payment_status === 'Paid';
    const amountPaid = isPaid ? (booking.total_amount || 0) : (booking.paid_amount || 0);
    const remainingAmount = Math.max(0, (booking.total_amount || 0) - amountPaid);

    const subject = `Booking Confirmed: ${booking.booking_number} — ${booking.property_name || hotel.name}`;

    const textContent = `
SBM HOTEL & GUEST HOUSE — SALASAR BALAJI
==========================================
BOOKING CONFIRMATION

Dear ${booking.guest_name},

Thank you for choosing ${booking.property_name || hotel.name}! Your reservation has been successfully confirmed. We look forward to welcoming you for a holy and peaceful stay in Salasar.

RESERVATION DETAILS:
------------------------------------------
Booking ID:        ${booking.booking_number}
Internal Ref:      ${booking.id}
Booking Status:    ${booking.booking_status}
Payment Status:    ${booking.payment_status}
Payment Method:    ${booking.payment_method || 'Online'}
${booking.payment_txn_id ? `Transaction ID:    ${booking.payment_txn_id}\n` : ''}

GUEST DETAILS:
------------------------------------------
Guest Name:        ${booking.guest_name}
Guest Email:       ${booking.guest_email}
Guest Phone:       ${booking.guest_phone}
Guests:            ${booking.adults || 1} Adult(s)${booking.children ? `, ${booking.children} Child(ren)` : ''} (Total: ${guestsCount})

STAY INFORMATION:
------------------------------------------
Property:          ${booking.property_name || hotel.name}
Property Address:  ${hotel.address}
Room Category:     ${booking.room_name}
${booking.room_number ? `Assigned Room:     Room ${booking.room_number}\n` : ''}Rooms Booked:      ${roomsCount} Room(s)
Check-in Date:     ${formatDate(booking.check_in)} (Standard Check-in: 12:00 PM)
Check-out Date:    ${formatDate(booking.check_out)} (Standard Check-out: 11:00 AM)
Duration:          ${nights} Night(s)

PRICE & PAYMENT BREAKDOWN:
------------------------------------------
Room Rate:         ${formatINR(booking.price_per_night)} / night
Room Subtotal:     ${formatINR(booking.room_subtotal)}
Taxes (GST 12%):   ${formatINR(booking.tax_amount)}
Total Amount:      ${formatINR(booking.total_amount)}
Amount Paid:       ${formatINR(amountPaid)}
Remaining Balance: ${formatINR(remainingAmount)}

${booking.special_request ? `Special Request:   ${booking.special_request}\n` : ''}
HOTEL CONTACT & LOCATION:
------------------------------------------
Phone:             ${hotel.phone}
Email:             ${hotel.email}
Google Maps:       ${hotel.mapUrl}

Cancellation Policy:
100% refund if cancelled 48 hours prior to check-in. 50% refund within 24-48 hours. No refund for same-day cancellation or no-show.

We wish you a blessed darshan at Salasar Balaji Temple!

Warm Regards,
Management & Front Desk
${hotel.name}
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - ${booking.booking_number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0b0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0b0f; padding: 24px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #121218; border-radius: 12px; border: 1px solid #27272a; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #18181b 0%, #2e1065 50%, #4c1d95 100%); padding: 32px 28px; text-align: center; border-bottom: 2px solid #8b5cf6;">
              <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #ddd6fe; font-weight: 700;">SALASAR BALAJI TEMPLE</p>
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">${booking.property_name || hotel.name}</h1>
              <div style="display: inline-block; margin-top: 14px; background-color: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; border-radius: 9999px; padding: 6px 18px;">
                <span style="color: #4ade80; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase;">✓ Booking Confirmed</span>
              </div>
            </td>
          </tr>

          <!-- Welcome Note -->
          <tr>
            <td style="padding: 28px 28px 16px 28px;">
              <p style="margin: 0 0 12px 0; font-size: 16px; color: #ffffff; font-weight: 600;">Dear ${booking.guest_name},</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                Jai Shree Balaji! Thank you for choosing <strong style="color: #ffffff;">${booking.property_name || hotel.name}</strong>. Your reservation has been successfully confirmed. Below is your official stay summary and receipt.
              </p>
            </td>
          </tr>

          <!-- Booking Reference Card -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 16px;">
                <tr>
                  <td width="50%" style="vertical-align: top; padding: 6px 10px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; font-weight: 600;">Booking ID</div>
                    <div style="font-size: 16px; font-weight: 800; color: #a78bfa; margin-top: 2px;">${booking.booking_number}</div>
                  </td>
                  <td width="50%" style="vertical-align: top; padding: 6px 10px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; font-weight: 600;">Payment Status</div>
                    <div style="font-size: 14px; font-weight: 700; color: ${isPaid ? '#4ade80' : '#facc15'}; margin-top: 2px;">
                      ${isPaid ? 'PAID & VERIFIED' : booking.payment_status}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="vertical-align: top; padding: 6px 10px; border-top: 1px solid #27272a;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; font-weight: 600;">Booking Status</div>
                    <div style="font-size: 14px; font-weight: 700; color: #38bdf8; margin-top: 2px;">${booking.booking_status}</div>
                  </td>
                  <td width="50%" style="vertical-align: top; padding: 6px 10px; border-top: 1px solid #27272a;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; font-weight: 600;">Payment Method</div>
                    <div style="font-size: 14px; font-weight: 600; color: #e4e4e7; margin-top: 2px;">${booking.payment_method || 'Online Razorpay'}</div>
                  </td>
                </tr>
                ${booking.payment_txn_id ? `
                <tr>
                  <td colspan="2" style="vertical-align: top; padding: 6px 10px; border-top: 1px solid #27272a;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; font-weight: 600;">Transaction Reference</div>
                    <div style="font-size: 12px; font-family: monospace; color: #d4d4d8; margin-top: 2px;">${booking.payment_txn_id}</div>
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- Stay Details -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #c4b5fd; font-weight: 700;">Stay Information</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #a1a1aa;">Property</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; font-weight: 600; color: #ffffff; text-align: right;">${booking.property_name || hotel.name}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #a1a1aa;">Room Category</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; font-weight: 600; color: #a78bfa; text-align: right;">${booking.room_name}</td>
                </tr>
                ${booking.room_number ? `
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #a1a1aa;">Assigned Room</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; font-weight: 700; color: #38bdf8; text-align: right;">Room ${booking.room_number}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #a1a1aa;">Check-In</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; font-weight: 600; color: #ffffff; text-align: right;">${formatDate(booking.check_in)} (12:00 PM)</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #a1a1aa;">Check-Out</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; font-weight: 600; color: #ffffff; text-align: right;">${formatDate(booking.check_out)} (11:00 AM)</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #a1a1aa;">Nights & Rooms</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; font-weight: 600; color: #ffffff; text-align: right;">${nights} Night(s) • ${roomsCount} Room(s)</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: #a1a1aa;">Guests</td>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #ffffff; text-align: right;">${booking.adults || 1} Adult(s)${booking.children ? `, ${booking.children} Child(ren)` : ''}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Price & Payment Summary -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #c4b5fd; font-weight: 700;">Financial Breakdown</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #a1a1aa;">Room Rate (${nights}N × ${roomsCount}R)</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #ffffff; text-align: right;">${formatINR(booking.room_subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #a1a1aa;">Taxes & Fees (GST 12%)</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #ffffff; text-align: right;">${formatINR(booking.tax_amount)}</td>
                </tr>
                <tr style="background-color: rgba(139, 92, 246, 0.1);">
                  <td style="padding: 14px 16px; border-bottom: 1px solid #3f3f46; font-size: 15px; font-weight: 700; color: #ffffff;">Total Amount</td>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #3f3f46; font-size: 16px; font-weight: 800; color: #a78bfa; text-align: right;">${formatINR(booking.total_amount)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; color: #4ade80; font-weight: 600;">Amount Paid</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #27272a; font-size: 13px; font-weight: 700; color: #4ade80; text-align: right;">${formatINR(amountPaid)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: ${remainingAmount > 0 ? '#facc15' : '#a1a1aa'}; font-weight: 600;">Balance Due at Check-in</td>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: ${remainingAmount > 0 ? '#facc15' : '#a1a1aa'}; text-align: right;">${formatINR(remainingAmount)}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${booking.special_request ? `
          <!-- Special Request -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="background-color: #18181b; border-left: 3px solid #8b5cf6; padding: 12px 16px; border-radius: 4px;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #c4b5fd; font-weight: 700;">Special Request</div>
                <div style="font-size: 13px; color: #e4e4e7; margin-top: 4px;">${booking.special_request}</div>
              </div>
            </td>
          </tr>` : ''}

          <!-- Contact & Navigation CTA -->
          <tr>
            <td style="padding: 0 28px 28px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 18px; text-align: center;">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: #ffffff;">Need Help or Arriving Early?</p>
                    <p style="margin: 0 0 14px 0; font-size: 12px; color: #a1a1aa;">Our front desk reception is available 24 hours a day to assist you.</p>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #d4d4d8;">
                      📞 <strong>${hotel.phone}</strong> &nbsp;|&nbsp; ✉️ <strong>${hotel.email}</strong>
                    </p>
                    <a href="${hotel.mapUrl}" target="_blank" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
                      📍 Open Location in Google Maps
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Policies -->
          <tr>
            <td style="background-color: #09090b; padding: 20px 28px; border-top: 1px solid #27272a; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #71717a; line-height: 1.5;">
                <strong>Address:</strong> ${hotel.address}<br>
                <strong>Cancellation Policy:</strong> 100% refund if cancelled 48h prior to check-in. 50% refund within 24-48h.
              </p>
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                © 2026 ${hotel.name}. All rights reserved. Salasar, Rajasthan.
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

    // Check transporter
    const mailer = getTransporter();
    if (!mailer) {
      console.log(`[Email Service Simulation] Confirmation email for booking ${booking.booking_number} generated successfully.`);
      console.log(`[Email Service Simulation] Sent to: ${recipient}`);
      console.log(`[Email Service Simulation] Subject: ${subject}`);
      console.log(`[Email Service Simulation] Note: To send real emails, set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD in .env`);
      return { success: true, simulated: true };
    }

    const info = await mailer.sendMail({
      from: cfg.from,
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ [Email Service] Confirmation email sent to ${recipient} (Message ID: ${info.messageId}) for booking ${booking.booking_number}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`❌ [Email Service Error] Failed to send booking confirmation email for ${booking.booking_number}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ==========================================
// 2. ADMIN NEW BOOKING NOTIFICATION EMAIL
// ==========================================
export async function sendAdminBookingNotification(booking: Booking): Promise<{ success: boolean; messageId?: string; simulated?: boolean; error?: string }> {
  try {
    const cfg = getEmailConfig();
    const adminRecipient = cfg.adminEmail;
    if (!adminRecipient) {
      console.warn(`[Email Service] Cannot send admin notification: ADMIN_EMAIL is not set.`);
      return { success: false, error: 'Admin email not configured' };
    }

    const hotel = getPropertyContact(booking.property_code);
    const nights = booking.nights || 1;
    const isPaid = booking.payment_status === 'Completed' || booking.payment_status === 'Paid';
    const amountPaid = isPaid ? (booking.total_amount || 0) : (booking.paid_amount || 0);

    const subject = `[New Booking Alert] ${booking.booking_number} — ${booking.guest_name} (₹${booking.total_amount?.toLocaleString('en-IN')})`;

    const textContent = `
NEW BOOKING ALERT - SBM PMS
==========================================
A new reservation has been placed!

Booking Number:    ${booking.booking_number}
Property:          ${booking.property_name || hotel.name} (${booking.property_code})
Source:            ${booking.source || 'WEBSITE'}
Booking Status:    ${booking.booking_status}
Payment Status:    ${booking.payment_status}
Payment Method:    ${booking.payment_method || 'N/A'}
${booking.payment_txn_id ? `Razorpay / Txn ID:  ${booking.payment_txn_id}\n` : ''}

GUEST DETAILS:
------------------------------------------
Name:              ${booking.guest_name}
Mobile:            ${booking.guest_phone}
Email:             ${booking.guest_email}
Total Guests:      ${booking.adults || 1} Adult(s), ${booking.children || 0} Child(ren)

STAY DETAILS:
------------------------------------------
Room Category:     ${booking.room_name}
${booking.room_number ? `Assigned Room:     Room ${booking.room_number}\n` : ''}Rooms Booked:      ${booking.rooms_requested || 1}
Check-in:          ${booking.check_in}
Check-out:         ${booking.check_out}
Nights:            ${nights}

FINANCIALS:
------------------------------------------
Room Rate:         ₹${booking.price_per_night?.toLocaleString('en-IN')}
Total Bill:        ₹${booking.total_amount?.toLocaleString('en-IN')}
Amount Paid:       ₹${amountPaid.toLocaleString('en-IN')}
Due at Hotel:      ₹${Math.max(0, (booking.total_amount || 0) - amountPaid).toLocaleString('en-IN')}

${booking.special_request ? `Special Request:   ${booking.special_request}\n` : ''}
Please log in to SBM PMS Admin to review or allocate rooms.
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New Booking Notification - ${booking.booking_number}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #1e293b; border-radius: 10px; border: 1px solid #334155; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #4338ca 100%); padding: 24px 28px; text-align: left;">
              <span style="background-color: rgba(255,255,255,0.2); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 4px;">PMS NEW BOOKING</span>
              <h2 style="margin: 8px 0 0 0; color: #ffffff; font-size: 22px; font-weight: 800;">${booking.booking_number}</h2>
              <p style="margin: 4px 0 0 0; color: #e0e7ff; font-size: 14px;">${booking.property_name || hotel.name} • ${booking.room_name}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td width="50%" style="vertical-align: top; padding: 8px; background-color: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Total Revenue</div>
                    <div style="font-size: 20px; font-weight: 800; color: #38bdf8; margin-top: 2px;">₹${booking.total_amount?.toLocaleString('en-IN')}</div>
                    <div style="font-size: 12px; color: ${isPaid ? '#4ade80' : '#fbbf24'}; font-weight: 600; margin-top: 2px;">
                      ${isPaid ? '✓ Paid Online via Razorpay' : 'Pending Payment'}
                    </div>
                  </td>
                  <td width="8"></td>
                  <td width="50%" style="vertical-align: top; padding: 8px; background-color: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Guest Contact</div>
                    <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-top: 2px;">${booking.guest_name}</div>
                    <div style="font-size: 13px; color: #cbd5e1; margin-top: 2px;">📞 ${booking.guest_phone}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 13px;">
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Guest Email</td>
                  <td style="padding: 10px 0; color: #ffffff; text-align: right; font-weight: 600;">${booking.guest_email}</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Check-in / Check-out</td>
                  <td style="padding: 10px 0; color: #ffffff; text-align: right; font-weight: 600;">${booking.check_in} ➔ ${booking.check_out} (${nights}N)</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Rooms & Guests</td>
                  <td style="padding: 10px 0; color: #ffffff; text-align: right; font-weight: 600;">${booking.rooms_requested || 1} Room(s) • ${booking.adults || 1} Adult(s), ${booking.children || 0} Child</td>
                </tr>
                ${booking.room_number ? `
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Assigned Room Number</td>
                  <td style="padding: 10px 0; color: #38bdf8; text-align: right; font-weight: 700;">Room ${booking.room_number}</td>
                </tr>` : ''}
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 10px 0; color: #94a3b8;">Booking Channel / Source</td>
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
            <td style="background-color: #0f172a; padding: 16px 28px; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                SBM Hotel PMS Automated Notification System • Salasar Balaji
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
      console.log(`[Email Service Simulation] Admin notification generated for booking ${booking.booking_number}`);
      console.log(`[Email Service Simulation] Sent to: ${adminRecipient}`);
      console.log(`[Email Service Simulation] Subject: ${subject}`);
      return { success: true, simulated: true };
    }

    const info = await mailer.sendMail({
      from: cfg.from,
      to: adminRecipient,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ [Email Service] Admin notification email sent to ${adminRecipient} (Message ID: ${info.messageId}) for booking ${booking.booking_number}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`❌ [Email Service Error] Failed to send admin booking notification for ${booking.booking_number}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ==========================================
// 3. BOOKING CANCELLATION EMAIL (Prepared)
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
    const subject = `Booking Cancelled: ${booking.booking_number} — ${booking.property_name || hotel.name}`;

    const textContent = `
SBM HOTEL & GUEST HOUSE — SALASAR BALAJI
==========================================
BOOKING CANCELLATION NOTICE

Dear ${booking.guest_name},

Your reservation ${booking.booking_number} for ${booking.room_name} (${formatDate(booking.check_in)} to ${formatDate(booking.check_out)}) has been cancelled.

Cancellation Reason: ${reason || 'Customer request or cancellation policy'}
Property:            ${booking.property_name || hotel.name}
Total Booking Value: ₹${booking.total_amount?.toLocaleString('en-IN')}

If eligible for a refund per our cancellation policy, our accounts desk will process the refund to your original payment method.

For any questions, please contact our 24/7 reception desk at ${hotel.phone} or ${hotel.email}.

Sincerely,
${hotel.name} Management
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Booking Cancellation</title></head>
<body style="margin: 0; padding: 24px; background-color: #0b0b0f; font-family: sans-serif; color: #e4e4e7;">
  <div style="max-width: 600px; margin: auto; background-color: #18181b; border: 1px solid #3f3f46; border-radius: 10px; padding: 28px;">
    <div style="color: #ef4444; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Booking Cancellation</div>
    <h2 style="color: #ffffff; margin: 8px 0 16px 0;">Reservation ${booking.booking_number}</h2>
    <p style="color: #a1a1aa; line-height: 1.6;">Dear ${booking.guest_name}, your booking for <strong style="color: #ffffff;">${booking.room_name}</strong> at <strong style="color: #ffffff;">${booking.property_name || hotel.name}</strong> has been cancelled.</p>
    <div style="background-color: #27272a; border-radius: 6px; padding: 14px; margin: 18px 0;">
      <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase;">Dates:</div>
      <div style="font-size: 14px; color: #ffffff; font-weight: 600;">${formatDate(booking.check_in)} to ${formatDate(booking.check_out)}</div>
      ${reason ? `<div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-top: 10px;">Reason:</div><div style="font-size: 13px; color: #fca5a5;">${reason}</div>` : ''}
    </div>
    <p style="font-size: 13px; color: #a1a1aa; line-height: 1.5;">If eligible for refund under hotel policies, it will be credited back to your original payment mode within 5-7 working days.</p>
    <hr style="border: none; border-top: 1px solid #27272a; margin: 20px 0;">
    <p style="font-size: 12px; color: #71717a; margin: 0;">Contact: ${hotel.phone} | ${hotel.email}</p>
  </div>
</body>
</html>
`.trim();

    const mailer = getTransporter();
    if (!mailer) {
      console.log(`[Email Service Simulation] Cancellation email for ${booking.booking_number} generated to ${recipient}`);
      return { success: true, simulated: true };
    }

    const info = await mailer.sendMail({
      from: cfg.from,
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ [Email Service] Cancellation email sent to ${recipient} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`❌ [Email Service Error] Cancellation email error:`, err.message);
    return { success: false, error: err.message };
  }
}

// ==========================================
// 4. BOOKING MODIFICATION EMAIL (Prepared)
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
    const subject = `Booking Update: ${booking.booking_number} — ${booking.property_name || hotel.name}`;

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
      console.log(`[Email Service Simulation] Modification email for ${booking.booking_number} generated to ${recipient}`);
      return { success: true, simulated: true };
    }

    const info = await mailer.sendMail({
      from: cfg.from,
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ [Email Service] Modification email sent to ${recipient} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`❌ [Email Service Error] Modification email error:`, err.message);
    return { success: false, error: err.message };
  }
}

// Export emailService object
export const emailService = {
  getConfig: getEmailConfig,
  logStartupDiagnostics: logEmailStartupDiagnostics,
  sendBookingConfirmationEmail,
  sendAdminBookingNotification,
  sendBookingCancellationEmail,
  sendBookingModificationEmail
};
