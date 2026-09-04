import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from './server/db';
import { AvailabilitySearchQuery } from './src/types';
import { initializePostgres } from './server/db/postgres';
import { reservationService } from './server/services/reservationService';
import { inventoryService } from './server/services/inventoryService';
import { paymentService } from './server/services/paymentService';
import { roomService } from './server/services/roomService';
import { guestService } from './server/services/guestService';
import { pmsService } from './server/services/pmsService';
import { auditService } from './server/services/auditService';
import { channelService } from './server/services/channelService';
import { channelManagerService } from './server/services/channelManagerService';
import {
  getRazorpayServerConfig,
  logRazorpayStartupDiagnostics,
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature
} from './server/razorpay';

const JWT_SECRET = process.env.JWT_SECRET || 'sbm_hotel_salasar_secret_key_2026';
const PORT = 3000;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

async function startServer() {
  // Initialize Database (PostgreSQL if DATABASE_URL is set, otherwise JSON fallback)
  await initializePostgres();

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Middleware: Admin JWT Authentication Check
  const authenticateAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required.' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
      (req as any).admin = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
    }
  };

  // --- PUBLIC API ROUTES ---

  // Get Properties
  app.get('/api/properties', (req, res) => {
    try {
      const properties = db.getProperties();
      res.json(properties);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/properties/:code', (req, res) => {
    try {
      const property = db.getPropertyByCode(req.params.code);
      if (!property) return res.status(404).json({ error: 'Property not found' });
      res.json(property);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Room Categories
  app.get('/api/room-types', (req, res) => {
    try {
      const propertyCode = req.query.propertyCode as string;
      const roomTypes = db.getRoomTypes(propertyCode);
      res.json(roomTypes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Check Availability
  app.post('/api/availability/check', (req, res) => {
    try {
      const searchQuery: AvailabilitySearchQuery = req.body;
      if (!searchQuery.check_in || !searchQuery.check_out) {
        return res.status(400).json({ error: 'Check-in and Check-out dates are required.' });
      }
      const results = db.checkAvailability(searchQuery);
      res.json(results);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Create Booking
  app.post('/api/bookings', (req, res) => {
    try {
      const booking = db.createBooking(req.body);
      res.status(201).json(booking);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message,
        error: err.message
      });
    }
  });

  // Lookup Booking
  app.get('/api/bookings/lookup', (req, res) => {
    try {
      const bookingNumber = req.query.bookingNumber as string;
      const contact = req.query.contact as string;
      if (!bookingNumber) {
        return res.status(400).json({ error: 'Booking number is required.' });
      }
      const booking = db.getBookingByIdOrNumber(bookingNumber, contact);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found with the provided details.' });
      }
      res.json(booking);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // --- RAZORPAY PAYMENT GATEWAY ENDPOINTS ---
  // ==========================================

  // 1. Get Payment Gateway Public Config
  app.get('/api/payments/config', (req, res) => {
    try {
      const cfg = getRazorpayServerConfig();
      res.json({
        key_id: cfg.key_id,
        is_configured: cfg.is_configured,
        mode: cfg.mode,
        currency: 'INR'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Create Razorpay Order & Initialize Pending Booking
  app.post('/api/payments/create-order', async (req, res) => {
    try {
      const {
        property_code,
        room_type_id,
        check_in,
        check_out,
        adults = 1,
        children = 0,
        rooms = 1,
        guest_name,
        guest_phone,
        guest_email,
        special_request = '',
        existing_booking_id
      } = req.body;

      // Validate inputs
      if (!property_code || !check_in || !check_out || !guest_name || !guest_phone || !guest_email) {
        return res.status(400).json({ error: 'All guest details and dates are required for booking.' });
      }

      const cleanPhone = (guest_phone || '').trim();
      const cleanEmail = (guest_email || '').trim().toLowerCase();
      const isPhoneValid = /^[0-9]{10}$/.test(cleanPhone);
      const isEmailValid = /^[a-z0-9._%+-]+@gmail\.com$/.test(cleanEmail);

      if (!isPhoneValid || !isEmailValid) {
        if (!isPhoneValid && !isEmailValid) {
          return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number and Gmail address ending with @gmail.com.' });
        } else if (!isPhoneValid) {
          return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
        } else {
          return res.status(400).json({ error: 'Please enter a valid Gmail address ending with @gmail.com.' });
        }
      }

      // Check property
      const properties = db.getProperties();
      const property = properties.find(p => p.code === property_code);
      if (!property) {
        return res.status(400).json({ error: 'Invalid hotel property selected.' });
      }

      // Check room availability server-side
      const availResults = db.checkAvailability({
        property_code,
        check_in,
        check_out,
        adults: Number(adults),
        children: Number(children),
        rooms: Number(rooms)
      });

      const matchedResult = availResults.find(r => r.roomType.id === room_type_id || r.roomType.room_code === room_type_id);
      if (!matchedResult) {
        return res.status(400).json({ error: 'Requested room category is not available at this property.' });
      }

      if (!matchedResult.isAvailable || matchedResult.availableRooms < Number(rooms)) {
        return res.status(400).json({
          error: `Sorry, only ${matchedResult.availableRooms} room(s) available for the selected stay dates.`
        });
      }

      // Calculate amounts strictly server-side (Deluxe: ₹2500, Family Suite: ₹3500, GST: 12%)
      const nights = matchedResult.nights;
      const pricePerNight = matchedResult.pricePerNight;
      const roomsCount = Number(rooms);
      const subtotal = pricePerNight * nights * roomsCount;
      const taxAmount = Math.round(subtotal * 0.12);
      const totalAmount = subtotal + taxAmount;
      const amountInPaise = Math.round(totalAmount * 100);

      // Handle Existing Booking (e.g., customer retrying failed/dismissed payment)
      let booking;
      if (existing_booking_id) {
        const existing = db.getBookingByIdOrNumber(existing_booking_id);
        if (existing) {
          if (existing.payment_status === 'Completed' || existing.payment_status === 'Paid') {
            return res.status(400).json({ error: 'This booking is already paid and confirmed.' });
          }
          // Update existing pending booking
          booking = db.updateBooking(existing.id, {
            guest_name,
            guest_phone: cleanPhone,
            guest_email: cleanEmail,
            special_request,
            nights,
            price_per_night: pricePerNight,
            room_subtotal: subtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            payment_status: 'Pending',
            booking_status: 'Pending',
            payment_method: 'online_razorpay'
          });
        }
      }

      if (!booking) {
        // Create initial pending booking in DB
        booking = db.createBooking({
          property_id: property.id,
          property_code: property.code,
          property_name: property.name,
          room_type_id: matchedResult.roomType.id,
          room_name: matchedResult.roomType.name,
          guest_name,
          guest_phone: cleanPhone,
          guest_email: cleanEmail,
          adults: Number(adults),
          children: Number(children),
          rooms_requested: roomsCount,
          check_in,
          check_out,
          nights,
          price_per_night: pricePerNight,
          room_subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          payment_status: 'Pending',
          booking_status: 'Pending',
          payment_method: 'online_razorpay',
          special_request
        });
      }

      // Check payment gateway configuration
      const cfg = getRazorpayServerConfig();
      if (!cfg.is_configured) {
        console.error('[Payment Order Failed] Razorpay credentials are not configured on server (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing).');
        return res.status(503).json({
          error: 'Online payment gateway is currently not configured on this server. Please choose "Pay at Reception" or contact hotel management.'
        });
      }

      // Create Razorpay Order using HTTP Basic Auth
      let razorpayOrder;
      try {
        razorpayOrder = await createRazorpayOrder({
          amountInPaise,
          currency: 'INR',
          receipt: booking.booking_number,
          notes: {
            booking_id: booking.id,
            booking_number: booking.booking_number,
            property_code: booking.property_code,
            property_name: booking.property_name,
            room_name: booking.room_name,
            guest_name: booking.guest_name,
            guest_phone: booking.guest_phone
          }
        });
      } catch (rzpErr: any) {
        console.error('[Razorpay Order Creation Exception]', rzpErr.message);
        return res.status(502).json({
          error: 'Unable to initialize online payment. Please try again or choose Pay at Reception.'
        });
      }

      // Update booking with generated order_id
      db.updateBooking(booking.id, {
        razorpay_order_id: razorpayOrder.id,
        payment_amount: totalAmount,
        payment_currency: 'INR'
      });

      res.status(200).json({
        success: true,
        order_id: razorpayOrder.id,
        amount: amountInPaise,
        currency: 'INR',
        key_id: cfg.key_id,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        total_amount: totalAmount,
        customer: {
          name: booking.guest_name,
          email: booking.guest_email,
          contact: booking.guest_phone
        }
      });
    } catch (err: any) {
      console.error('Create Payment Order Server Error:', err);
      res.status(400).json({ error: err.message || 'Failed to create payment order' });
    }
  });

  // 3. Verify Razorpay Payment Signature
  app.post('/api/payments/verify', async (req, res) => {
    try {
      const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing required payment verification parameters.' });
      }

      const booking = db.getBookingByIdOrNumber(booking_id) || db.getBookingByRazorpayOrderId(razorpay_order_id);
      if (!booking) {
        return res.status(404).json({ error: 'Associated booking record was not found.' });
      }

      // Duplicate payment protection / Idempotency
      if ((booking.payment_status === 'Completed' || booking.payment_status === 'Paid') && booking.booking_status === 'Confirmed') {
        return res.json({
          success: true,
          message: 'Booking is already confirmed and paid.',
          booking
        });
      }

      // Server-side HMAC Signature Verification using RAZORPAY_KEY_SECRET
      const verification = verifyRazorpaySignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });

      if (!verification.isValid) {
        db.updateBooking(booking.id, {
          payment_status: 'Failed',
          internal_notes: `Payment signature mismatch. Order: ${razorpay_order_id}, Payment: ${razorpay_payment_id}`
        });
        return res.status(400).json({
          success: false,
          error: 'Razorpay payment signature verification failed. The transaction could not be authenticated.'
        });
      }

      // Mark booking as PAID and CONFIRMED
      const verifiedAt = new Date().toISOString();
      const updatedBooking = db.updateBooking(booking.id, {
        payment_status: 'Completed',
        booking_status: 'Confirmed',
        payment_method: 'online_razorpay',
        payment_txn_id: razorpay_payment_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_amount: booking.total_amount,
        payment_currency: 'INR',
        payment_verified_at: verifiedAt
      });

      // Front desk activity log
      db.addActivity(
        'Payment',
        `₹${booking.total_amount.toLocaleString('en-IN')} paid via Razorpay by ${booking.guest_name} (${booking.booking_number}). Txn: ${razorpay_payment_id}`,
        booking.property_code,
        'Razorpay Gateway'
      );

      res.json({
        success: true,
        message: 'Payment successfully verified and booking confirmed.',
        booking: updatedBooking
      });
    } catch (err: any) {
      console.error('Payment Verification Error:', err);
      res.status(500).json({ error: err.message || 'Payment verification failed.' });
    }
  });

  // 4. Record Payment Failure or Cancellation
  app.post('/api/payments/failure', async (req, res) => {
    try {
      const { booking_id, razorpay_order_id, error_code, error_description } = req.body;

      const booking = (booking_id ? db.getBookingByIdOrNumber(booking_id) : undefined) ||
                      (razorpay_order_id ? db.getBookingByRazorpayOrderId(razorpay_order_id) : undefined);

      if (booking) {
        // Do not alter if already successfully paid
        if (booking.payment_status !== 'Completed' && booking.payment_status !== 'Paid') {
          const updated = db.updateBooking(booking.id, {
            payment_status: 'Failed',
            internal_notes: `Payment failure: ${error_description || error_code || 'Payment dismissed or aborted by user'}`
          });

          db.addActivity(
            'Payment',
            `Payment attempt failed for ${booking.guest_name} (${booking.booking_number}): ${error_description || 'Incomplete payment'}`,
            booking.property_code,
            'Razorpay Gateway'
          );

          return res.json({ success: true, message: 'Payment failure recorded.', booking: updated });
        }
      }

      res.json({ success: true, message: 'Payment failure recorded.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Razorpay Webhook Handler
  app.post('/api/payments/webhook', async (req, res) => {
    try {
      const webhookSignature = req.headers['x-razorpay-signature'] as string;

      if (webhookSignature) {
        const rawBody = JSON.stringify(req.body);
        const isValid = verifyRazorpayWebhookSignature(rawBody, webhookSignature);
        if (!isValid) {
          console.warn('[Razorpay Webhook] Invalid webhook signature received.');
          return res.status(400).json({ error: 'Invalid webhook signature.' });
        }
      }

      const event = req.body?.event;
      const paymentEntity = req.body?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || req.body?.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const booking = db.getBookingByRazorpayOrderId(orderId);
        if (booking) {
          if (event === 'payment.captured' || event === 'order.paid') {
            if (booking.payment_status !== 'Completed' && booking.payment_status !== 'Paid') {
              db.updateBooking(booking.id, {
                payment_status: 'Completed',
                booking_status: 'Confirmed',
                payment_txn_id: paymentId,
                razorpay_payment_id: paymentId,
                payment_verified_at: new Date().toISOString()
              });

              db.addActivity(
                'Payment',
                `Razorpay Webhook: ₹${booking.total_amount} captured for ${booking.booking_number} (Txn: ${paymentId})`,
                booking.property_code,
                'Razorpay Webhook'
              );
            }
          } else if (event === 'payment.failed') {
            if (booking.payment_status !== 'Completed' && booking.payment_status !== 'Paid') {
              db.updateBooking(booking.id, {
                payment_status: 'Failed',
                internal_notes: `Webhook payment failure: ${paymentEntity?.error_description || 'Payment failure'}`
              });
            }
          }
        }
      }

      res.json({ status: 'ok' });
    } catch (err: any) {
      console.error('Webhook processing error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create Inquiry
  app.post('/api/inquiries', (req, res) => {
    try {
      const inquiry = db.createInquiry(req.body);
      res.status(201).json(inquiry);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Public Settings
  app.get('/api/settings', (req, res) => {
    try {
      const settings = db.getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- SBM AI HOTEL CONCIERGE CHAT ENDPOINT ---
  app.post('/api/concierge/chat', async (req, res) => {
    try {
      const { message, checkIn, checkOut, adults, children, propertyCode } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      // INSTANT LIGHTNING-FAST LOCAL FAQ CACHE & LOOKUP (<10ms response)
      const msgLower = message.toLowerCase();
      if (!msgLower.includes('available') && !msgLower.includes('check room') && !msgLower.includes('vacancy') && !msgLower.includes('book') && !msgLower.includes('recommend') && !checkIn) {
        let fastReply = '';
        if (msgLower.includes('temple') || msgLower.includes('distance') || msgLower.includes('far') || msgLower.includes('location')) {
          fastReply = 'SBM Hotel is situated on Main Temple Road, directly opposite Salasar Balaji Temple — just a 2-minute walk! SBM 2 Guest House is located nearby on Temple Approach Road, offering a peaceful environment.';
        } else if (msgLower.includes('price') || msgLower.includes('cost') || msgLower.includes('rate') || msgLower.includes('deluxe') || msgLower.includes('family')) {
          fastReply = 'We offer strictly two luxury room categories across our properties:\n\n• **Deluxe Room**: ₹2,500/night (+12% GST) — Max 2 adults\n• **Family Suite**: ₹3,500/night (+12% GST) — Max 4-5 adults\n\nAll rooms feature air conditioning, free Wi-Fi, 24/7 hot water, attached private bathroom, and Smart TV.';
        } else if (msgLower.includes('contact') || msgLower.includes('phone') || msgLower.includes('number') || msgLower.includes('email')) {
          fastReply = 'You can reach our front desk anytime:\n\n• **SBM Hotel**: +91 99835 67921 (sbmhotel@gmail.com)\n• **SBM 2 Guest House**: +91 98285 00845, +91 98286 36000 (sbmguesthouse@gmail.com)';
        } else if (msgLower.includes('check-in') || msgLower.includes('check in') || msgLower.includes('check out') || msgLower.includes('time') || msgLower.includes('timing')) {
          fastReply = 'Standard Check-in time is **12:00 PM** and Check-out time is **11:00 AM**. 24-hour reception is available for late arrivals and early morning darshan pilgrims.';
        } else if (msgLower.includes('breakfast') || msgLower.includes('food') || msgLower.includes('dine') || msgLower.includes('restaurant') || msgLower.includes('prasad')) {
          fastReply = 'We offer pure vegetarian dining, fresh breakfast options, and traditional Rajasthani thalis for devotees and families at our on-site dining hall.';
        } else if (msgLower.includes('parking') || msgLower.includes('car') || msgLower.includes('vehicle')) {
          fastReply = 'Free secure on-site vehicle parking is available for all guests at both SBM Hotel and SBM 2 Guest House with 24/7 security.';
        } else if (msgLower.includes('wifi') || msgLower.includes('internet')) {
          fastReply = 'High-speed Wi-Fi internet access is provided free of charge across all rooms and lobby areas at both properties.';
        }

        if (fastReply) {
          return res.json({ replyText: fastReply });
        }
      }

      // Gather current DB context
      const properties = db.getProperties();
      const roomTypes = db.getRoomTypes();
      const knowledgeItems = db.getKnowledgeBase();
      const settings = db.getSettings();

      // Check if dates are provided or detected in check availability queries
      let liveAvail: any[] = [];
      let isAvailabilityQuery = false;

      // Extract potential dates or explicit params
      let searchCheckIn = checkIn;
      let searchCheckOut = checkOut;
      let searchAdults = adults || 2;
      let searchChildren = children || 0;

      // Default date detection if user mentions dates like 'tomorrow' or 'august 20'
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(today.getDate() + 2);

      const msgLowerCheck = message.toLowerCase();

      if (msgLowerCheck.includes('available') || msgLowerCheck.includes('check room') || msgLowerCheck.includes('vacancy') || msgLowerCheck.includes('book for') || checkIn) {
        isAvailabilityQuery = true;
        if (!searchCheckIn) searchCheckIn = tomorrow.toISOString().split('T')[0];
        if (!searchCheckOut) searchCheckOut = dayAfter.toISOString().split('T')[0];

        try {
          const rawResults = db.checkAvailability({
            property_code: propertyCode || 'both',
            check_in: searchCheckIn,
            check_out: searchCheckOut,
            adults: searchAdults,
            children: searchChildren,
            rooms: 1
          });

          liveAvail = rawResults.map(r => ({
            propertyCode: r.property.code,
            propertyName: r.property.name,
            roomCode: r.roomType.room_code,
            roomName: r.roomType.name,
            pricePerNight: r.pricePerNight,
            checkIn: searchCheckIn,
            checkOut: searchCheckOut,
            adults: searchAdults,
            children: searchChildren,
            isAvailable: r.isAvailable,
            availableRooms: r.availableRooms
          }));
        } catch (e) {
          console.error('Availability check failed inside concierge', e);
        }
      }

      // Knowledge context compilation
      const knowledgeText = knowledgeItems.map(k => `[${k.category} - ${k.title}]: ${k.content}`).join('\n');
      const propertiesText = properties.map(p => `${p.name} (${p.code}): ${p.address}. Phone: ${p.phone}. Email: ${p.email}. Amenities: ${p.amenities.join(', ')}`).join('\n');
      const roomTypesText = roomTypes.map(r => `${r.name} at ${r.property_code}: ₹${r.price_per_night}/night + 12% GST. Capacity: ${r.capacity} guests. Bedding: ${r.bed_information}. Amenities: ${r.amenities.join(', ')}`).join('\n');

      const systemInstruction = `You are "SBM Concierge", the official AI Hotel Concierge for SBM Hotel and SBM 2 Guest House in Salasar, Rajasthan.
Your tagline is: "Your personal guide to a comfortable stay in Salasar."

PURPOSE:
Help visitors quickly get accurate answers about the hotel, amenities, room options, check-in/out, temple distance, and assist them with choosing and booking a room.

CRITICAL MANDATES (DO NOT HALLUCINATE):
1. Use ONLY the official hotel database knowledge provided below as your source of truth.
2. NEVER invent or hallucinate room amenities, prices, discounts, fake availability, hotel facilities, policies, distances, reviews, ratings, offers, or services.
3. The ONLY two official room categories that exist are "Deluxe Room" (₹2,500/night) and "Family Suite" (₹3,500/night).
4. If information is unavailable or not in your context, respond politely:
"I don't have that information available right now. Please contact SBM Hotel for assistance."
5. Never reveal admin credentials, system database structures, API keys, or private customer bookings.
6. ROOM RECOMMENDATION RULES:
   - For 1-2 guests: Recommend Deluxe Room (₹2,500/night).
   - For 3-5 guests or families: Recommend Family Suite (₹3,500/night).
7. Always maintain a warm, luxury, polite hospitality tone.

OFFICIAL HOTEL KNOWLEDGE BASE:
${knowledgeText}

PROPERTIES:
${propertiesText}

ROOM TYPES & PRICING:
${roomTypesText}

CURRENT LIVE DATABASE AVAILABILITY RESULTS FOR REQUESTED DATES (${searchCheckIn} to ${searchCheckOut}):
${JSON.stringify(liveAvail, null, 2)}
`;

      // Call Gemini API if API key exists
      if (process.env.GEMINI_API_KEY) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: message,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  replyText: { type: Type.STRING, description: 'Natural, polite Markdown response answering the customer query.' },
                  hasRecommendation: { type: Type.BOOLEAN },
                  recommendedRoomCode: { type: Type.STRING, description: 'deluxe or family' },
                  recommendedPropertyCode: { type: Type.STRING, description: 'sbm-hotel or sbm-guest-house' },
                  recommendationReason: { type: Type.STRING },
                  includeAvailabilityCards: { type: Type.BOOLEAN }
                },
                required: ['replyText']
              }
            }
          });

          const jsonText = response.text || '{}';
          const parsed = JSON.parse(jsonText);

          let recommendationObj: any = undefined;
          if (parsed.hasRecommendation && parsed.recommendedRoomCode) {
            const matchedRoom = roomTypes.find(r => r.room_code === parsed.recommendedRoomCode);
            recommendationObj = {
              propertyCode: parsed.recommendedPropertyCode || 'sbm-hotel',
              propertyName: parsed.recommendedPropertyCode === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel',
              roomCode: parsed.recommendedRoomCode,
              roomName: matchedRoom ? matchedRoom.name : (parsed.recommendedRoomCode === 'family' ? 'Family Suite' : 'Deluxe Room'),
              pricePerNight: matchedRoom ? matchedRoom.price_per_night : (parsed.recommendedRoomCode === 'family' ? 3500 : 2500),
              reason: parsed.recommendationReason || 'Ideal choice for your group size.'
            };
          }

          return res.json({
            replyText: parsed.replyText,
            availabilityDetails: (isAvailabilityQuery || parsed.includeAvailabilityCards) ? liveAvail : undefined,
            recommendation: recommendationObj
          });
        } catch (geminiError) {
          console.error('Gemini API call error in concierge, using structured smart fallback:', geminiError);
        }
      }

      // Rule-based Fallback if API key is not present or API call fails
      let replyText = '';
      let recObj: any = undefined;

      if (msgLower.includes('temple') || msgLower.includes('distance') || msgLower.includes('far')) {
        replyText = 'SBM Hotel is situated on Main Temple Road, directly opposite Salasar Balaji Temple — just a 2-minute walk! SBM 2 Guest House is located nearby on Temple Approach Road, offering a peaceful environment.';
      } else if (msgLower.includes('price') || msgLower.includes('cost') || msgLower.includes('rate') || msgLower.includes('deluxe') || msgLower.includes('family')) {
        replyText = 'We offer strictly two room categories across our properties:\n\n• **Deluxe Room**: ₹2,500/night (+12% GST) — Max 2 adults\n• **Family Suite**: ₹3,500/night (+12% GST) — Max 4-5 adults\n\nAll rooms feature air conditioning, free Wi-Fi, 24/7 hot water, attached private bathroom, and TV.';
      } else if (msgLower.includes('contact') || msgLower.includes('phone') || msgLower.includes('number') || msgLower.includes('email')) {
        replyText = 'You can reach us anytime:\n\n• **SBM Hotel**: +91 99835 67921 (sbmhotel@gmail.com)\n• **SBM 2 Guest House**: +91 98285 00845, +91 98286 36000 (sbmguesthouse@gmail.com)';
      } else if (msgLower.includes('check-in') || msgLower.includes('check in') || msgLower.includes('check out') || msgLower.includes('time')) {
        replyText = 'Standard Check-in time is **12:00 PM** and Check-out time is **11:00 AM**. 24-hour reception is available for late arrivals.';
      } else if (msgLower.includes('4') || msgLower.includes('family') || msgLower.includes('group')) {
        replyText = 'For 4 or more guests, I highly recommend our spacious **Family Suite** (₹3,500/night), which comes with dual double beds and generous living space for families.';
        recObj = {
          propertyCode: 'sbm-hotel',
          propertyName: 'SBM Hotel',
          roomCode: 'family',
          roomName: 'Family Suite',
          pricePerNight: 3500,
          reason: 'Suitable for families and group travelers.'
        };
      } else if (isAvailabilityQuery) {
        if (liveAvail.length > 0 && liveAvail.some(a => a.isAvailable)) {
          replyText = `Certainly. I checked live availability for ${searchCheckIn} to ${searchCheckOut}. Here are the available rooms for your stay:`;
        } else {
          replyText = `I'm sorry, there are no rooms available for those selected dates (${searchCheckIn} to ${searchCheckOut}). Please try different dates or check our other property!`;
        }
      } else {
        replyText = `Welcome to SBM Hotel & SBM 2 Guest House! I am SBM Concierge. How may I assist you with your stay in Salasar today? You can ask about our Deluxe Room (₹2,500/night), Family Suite (₹3,500/night), temple distance, or check room availability for your dates.`;
      }

      res.json({
        replyText,
        availabilityDetails: isAvailabilityQuery ? liveAvail : undefined,
        recommendation: recObj
      });
    } catch (err: any) {
      res.status(500).json({
        replyText: "I don't have that information available right now. Please contact SBM Hotel for assistance."
      });
    }
  });

  // --- ADMIN AUTH & DASHBOARD ROUTES ---

  // Admin Login
  app.post('/api/admin/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      const admin = db.validateAdminPassword(email, password);
      if (!admin) {
        return res.status(401).json({ error: 'Invalid admin credentials.' });
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email, role: admin.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ token, admin });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/verify', authenticateAdmin, (req, res) => {
    res.json({ valid: true, admin: (req as any).admin });
  });

  // Admin Overview Stats
  app.get('/api/admin/overview', authenticateAdmin, (req, res) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const allBookings = db.getBookings();

      const todayCheckIns = allBookings.filter(b => b.check_in === todayStr && b.booking_status !== 'Cancelled');
      const todayCheckOuts = allBookings.filter(b => b.check_out === todayStr && b.booking_status !== 'Cancelled');
      const activeGuestsCount = allBookings
        .filter(b => b.check_in <= todayStr && todayStr < b.check_out && (b.booking_status === 'Confirmed' || b.booking_status === 'Checked In'))
        .reduce((sum, b) => sum + (b.adults + b.children), 0);

      const confirmedBookings = allBookings.filter(b => b.booking_status === 'Confirmed' || b.booking_status === 'Checked In' || b.booking_status === 'Checked Out');
      const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const pendingBookingsCount = allBookings.filter(b => b.booking_status === 'Pending').length;

      res.json({
        today_date: todayStr,
        today_check_ins_count: todayCheckIns.length,
        today_check_outs_count: todayCheckOuts.length,
        active_guests_count: activeGuestsCount,
        total_bookings_count: allBookings.length,
        pending_bookings_count: pendingBookingsCount,
        total_revenue: totalRevenue,
        recent_bookings: allBookings.slice(0, 5)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Manage Bookings
  app.get('/api/admin/bookings', authenticateAdmin, (req, res) => {
    try {
      const filters = {
        property_code: req.query.propertyCode as string,
        booking_status: req.query.bookingStatus as string,
        payment_status: req.query.paymentStatus as string,
        search: req.query.search as string,
        date: req.query.date as string
      };
      const bookings = db.getBookings(filters);
      res.json(bookings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/bookings/:id', authenticateAdmin, (req, res) => {
    try {
      const updated = db.updateBooking(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin Manage Room Types / Pricing
  app.put('/api/admin/room-types/:id', authenticateAdmin, (req, res) => {
    try {
      const updated = db.updateRoomType(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin Manage Properties
  app.put('/api/admin/properties/:id', authenticateAdmin, (req, res) => {
    try {
      const updated = db.updateProperty(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin Blocked Rooms
  app.get('/api/admin/blocked-rooms', authenticateAdmin, (req, res) => {
    try {
      const blocked = db.getBlockedRooms();
      res.json(blocked);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/blocked-rooms', authenticateAdmin, (req, res) => {
    try {
      const created = db.createBlockedRoom(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/blocked-rooms/:id', authenticateAdmin, (req, res) => {
    try {
      const deleted = db.deleteBlockedRoom(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Blocked room record not found.' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Inquiries
  app.get('/api/admin/inquiries', authenticateAdmin, (req, res) => {
    try {
      const inquiries = db.getInquiries();
      res.json(inquiries);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/inquiries/:id', authenticateAdmin, (req, res) => {
    try {
      const { status } = req.body;
      const updated = db.updateInquiryStatus(req.params.id, status);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/inquiries/:id', authenticateAdmin, (req, res) => {
    try {
      const deleted = db.deleteInquiry(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Inquiry not found.' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Settings
  app.get('/api/admin/settings', authenticateAdmin, (req, res) => {
    try {
      const settings = db.getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/settings', authenticateAdmin, (req, res) => {
    try {
      const updated = db.updateSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- PHYSICAL ROOMS & VISUAL INVENTORY ---
  app.get('/api/admin/physical-rooms', authenticateAdmin, (req, res) => {
    try {
      const propertyCode = req.query.propertyCode as string;
      const date = req.query.date as string;
      const rooms = db.getPhysicalRooms(propertyCode, date);
      res.json(rooms);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/physical-rooms/:id', authenticateAdmin, (req, res) => {
    try {
      const updated = db.updatePhysicalRoom(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/physical-rooms', authenticateAdmin, (req, res) => {
    try {
      const created = db.addPhysicalRoom(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/physical-rooms/:id', authenticateAdmin, (req, res) => {
    try {
      const deleted = db.deletePhysicalRoom(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Room not found.' });
      res.json({ success: true, message: 'Room deleted successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset PMS Test Data Endpoint (Clean production testing state)
  app.post('/api/admin/reset-test-data', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const result = db.resetTestData(admin?.name || admin?.email || 'SuperAdmin');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- FRONT DESK CHECK-IN & CHECK-OUT ---
  app.post('/api/admin/check-in/:id', authenticateAdmin, (req, res) => {
    try {
      const { roomNumber } = req.body;
      const updatedBooking = db.checkInBooking(req.params.id, roomNumber);
      res.json(updatedBooking);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/check-out/:id', authenticateAdmin, (req, res) => {
    try {
      const updatedBooking = db.checkOutBooking(req.params.id);
      res.json(updatedBooking);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- FRONT DESK ACTIVITIES ---
  app.get('/api/admin/activities', authenticateAdmin, (req, res) => {
    try {
      const propertyCode = req.query.propertyCode as string;
      const activities = db.getActivities(propertyCode);
      res.json(activities);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/activities', authenticateAdmin, (req, res) => {
    try {
      const { action, description, property_code } = req.body;
      const admin = (req as any).admin;
      const act = db.addActivity(action, description, property_code, admin?.name || 'Admin');
      res.status(201).json(act);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- KNOWLEDGE BASE MANAGEMENT ---
  app.get('/api/admin/knowledge-base', authenticateAdmin, (req, res) => {
    try {
      const category = req.query.category as string;
      const items = db.getKnowledgeBase(category);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/knowledge-base', authenticateAdmin, (req, res) => {
    try {
      const item = db.addKnowledgeItem(req.body);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/knowledge-base/:id', authenticateAdmin, (req, res) => {
    try {
      const updated = db.updateKnowledgeItem(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/knowledge-base/:id', authenticateAdmin, (req, res) => {
    try {
      const deleted = db.deleteKnowledgeItem(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Item not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // --- HOTEL PMS PHASE 1 ENTERPRISE API ENDPOINTS ---
  // ============================================================

  // 1. PMS Live Multi-Property Tape Chart / Calendar
  app.get('/api/pms/calendar', authenticateAdmin, async (req, res) => {
    try {
      const propertyCode = (req.query.propertyCode as string) || 'sbm-hotel';
      const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
      const days = parseInt(req.query.days as string, 10) || 7;

      const calendarData = await pmsService.getCalendarData(propertyCode, startDate, days);
      res.json(calendarData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. PMS Operations Dashboard Stats
  app.get('/api/pms/dashboard', authenticateAdmin, async (req, res) => {
    try {
      const propertyCode = (req.query.propertyCode as string) || 'all';
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

      const stats = await pmsService.getDashboardStats(propertyCode, date);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. PMS Financial, Occupancy & Source Reports
  app.get('/api/pms/reports', authenticateAdmin, async (req, res) => {
    try {
      const propertyCode = (req.query.propertyCode as string) || 'all';
      const period = (req.query.period as 'today' | 'this_week' | 'this_month' | 'custom') || 'this_month';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const report = await pmsService.getReports(propertyCode, period, startDate, endDate);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. PMS Create Reservation (Direct, Walk-in, Phone, WhatsApp, Website)
  app.post('/api/pms/reservations', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const booking = await reservationService.createReservation({
        ...req.body,
        created_by: admin?.name || admin?.email || 'Front Desk'
      });
      res.status(201).json(booking);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 5. PMS List Reservations
  app.get('/api/pms/reservations', authenticateAdmin, async (req, res) => {
    try {
      const { propertyCode, status, paymentStatus, source, search, date } = req.query;
      const reservations = await reservationService.getReservations({
        property_code: propertyCode as string,
        booking_status: status as string,
        payment_status: paymentStatus as string,
        source: source as string,
        search: search as string,
        date: date as string
      });
      res.json(reservations);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. PMS Get Single Reservation Detail
  app.get('/api/pms/reservations/:id', authenticateAdmin, async (req, res) => {
    try {
      const reservation = await reservationService.getReservationById(req.params.id);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found.' });
      res.json(reservation);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. PMS Check-in
  app.post('/api/pms/reservations/:id/check-in', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const { roomNumber } = req.body;
      const updated = await reservationService.checkIn(
        req.params.id,
        roomNumber,
        admin?.name || admin?.email || 'Front Desk'
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 8. PMS Check-out
  app.post('/api/pms/reservations/:id/check-out', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const updated = await reservationService.checkOut(
        req.params.id,
        admin?.name || admin?.email || 'Front Desk'
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 9. PMS Assign / Change Physical Room
  app.put('/api/pms/reservations/:id/change-room', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const { newRoomNumber } = req.body;
      if (!newRoomNumber) return res.status(400).json({ error: 'newRoomNumber is required.' });

      const updated = await reservationService.changeRoom(
        req.params.id,
        newRoomNumber,
        admin?.name || admin?.email || 'Front Desk'
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 10. PMS Cancel Reservation
  app.post('/api/pms/reservations/:id/cancel', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const { reason } = req.body;
      const updated = await reservationService.cancelReservation(
        req.params.id,
        reason,
        admin?.name || admin?.email || 'Front Desk'
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 11. PMS Record Payment for Reservation
  app.post('/api/pms/reservations/:id/payments', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const { method, amount, transactionId, paymentReference, notes } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid payment amount is required.' });
      }

      const result = await paymentService.recordPayment({
        reservationId: req.params.id,
        method: method || 'CASH',
        amount: Number(amount),
        transactionId,
        paymentReference,
        notes,
        recordedBy: admin?.name || admin?.email || 'Front Desk'
      });
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 12. PMS Get Payments for Reservation
  app.get('/api/pms/reservations/:id/payments', authenticateAdmin, async (req, res) => {
    try {
      const payments = await paymentService.getPaymentsForReservation(req.params.id);
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. PMS Guests Directory
  app.get('/api/pms/guests', authenticateAdmin, async (req, res) => {
    try {
      const search = req.query.search as string;
      const guests = await guestService.getGuests(search);
      res.json(guests);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. PMS Guest Detail
  app.get('/api/pms/guests/:id', authenticateAdmin, async (req, res) => {
    try {
      const guest = await guestService.getGuestById(req.params.id);
      if (!guest) return res.status(404).json({ error: 'Guest not found.' });
      res.json(guest);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. PMS Update Guest Profile
  app.put('/api/pms/guests/:id', authenticateAdmin, async (req, res) => {
    try {
      const updated = await guestService.updateGuest(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 16. PMS All Payments Ledger
  app.get('/api/pms/payments', authenticateAdmin, async (req, res) => {
    try {
      const { propertyCode, method, startDate, endDate } = req.query;
      const payments = await paymentService.getAllPayments({
        propertyCode: propertyCode as string,
        method: method as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 17. PMS Housekeeping Status Update
  app.put('/api/pms/rooms/:id/housekeeping', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const { housekeeping_status } = req.body;
      if (!housekeeping_status) {
        return res.status(400).json({ error: 'housekeeping_status is required.' });
      }
      const updated = await roomService.updateHousekeepingStatus(
        req.params.id,
        housekeeping_status,
        admin?.name || 'Staff'
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 18. PMS Operational Status Update
  app.put('/api/pms/rooms/:id/operational', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const { operational_status, reason } = req.body;
      if (!operational_status) {
        return res.status(400).json({ error: 'operational_status is required.' });
      }
      const updated = await roomService.updateOperationalStatus(
        req.params.id,
        operational_status,
        reason,
        admin?.name || 'Admin'
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 19. PMS Channel Connections Status
  app.get('/api/pms/channels', authenticateAdmin, async (req, res) => {
    try {
      const connections = await channelService.getConnections();
      res.json(connections);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 20. Public Temporary Inventory Hold (Anti Double-Booking during checkout)
  app.post('/api/inventory/lock', async (req, res) => {
    try {
      const { propertyCode, roomTypeId, checkIn, checkOut, count, sessionId } = req.body;
      if (!propertyCode || !roomTypeId || !checkIn || !checkOut || !sessionId) {
        return res.status(400).json({ error: 'Missing required lock parameters.' });
      }

      const lock = await inventoryService.acquireHold(
        propertyCode,
        roomTypeId,
        checkIn,
        checkOut,
        count || 1,
        sessionId
      );

      if (!lock) {
        return res.status(409).json({
          success: false,
          error: 'Room is currently held by another guest or no longer available.'
        });
      }

      res.json({ success: true, lock });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 21. Release Inventory Hold
  app.post('/api/inventory/release-lock', async (req, res) => {
    try {
      const { lockId } = req.body;
      if (lockId) {
        await inventoryService.releaseHold(lockId);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- IMAGE MANAGEMENT (PUBLIC & ADMIN) ---
  app.get('/api/images', (req, res) => {
    try {
      const { category, roomId, propertyId } = req.query;
      const images = db.getManagedImages({
        category: category as string,
        roomId: roomId as string,
        propertyId: propertyId as string
      });
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/images', authenticateAdmin, (req, res) => {
    try {
      const { category, roomId, propertyId } = req.query;
      const images = db.getManagedImages({
        category: category as string,
        roomId: roomId as string,
        propertyId: propertyId as string
      });
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/images', authenticateAdmin, (req, res) => {
    try {
      const body = req.body;
      if (Array.isArray(body.images)) {
        // Multi-image upload batch
        const createdList = body.images.map((img: any) => {
          if (!img.imageUrl) throw new Error('Each image requires an imageUrl.');
          return db.addManagedImage(img);
        });
        return res.status(201).json(createdList);
      }

      if (!body.imageUrl) {
        return res.status(400).json({ error: 'Image URL or base64 data is required.' });
      }

      const created = db.addManagedImage(body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/images/reorder', authenticateAdmin, (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: 'orderedIds must be an array of image IDs.' });
      }
      const updatedList = db.reorderManagedImages(orderedIds);
      res.json(updatedList);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/images/:id/set-primary', authenticateAdmin, (req, res) => {
    try {
      const { roomId, propertyId } = req.body;
      const updated = db.setPrimaryManagedImage(req.params.id, roomId, propertyId);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/images/:id', authenticateAdmin, (req, res) => {
    try {
      const updated = db.updateManagedImage(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/images/:id', authenticateAdmin, (req, res) => {
    try {
      const deleted = db.deleteManagedImage(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Image not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- CHANNEL MANAGER CORE API ENDPOINTS ---

  // 1. Get All Channels
  app.get('/api/admin/channels', authenticateAdmin, (req, res) => {
    try {
      const channels = channelManagerService.getChannels();
      res.json(channels);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Get Single Channel
  app.get('/api/admin/channels/:id', authenticateAdmin, (req, res) => {
    try {
      const channel = channelManagerService.getChannelById(req.params.id);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      res.json(channel);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Update Channel Configuration (Enable/Disable, Multipliers, Settings)
  app.put('/api/admin/channels/:id', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const updated = channelManagerService.updateChannelConfig(
        req.params.id,
        req.body,
        admin?.name || admin?.email || 'Admin'
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 4. Test Channel Connection
  app.post('/api/admin/channels/:id/test', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const result = await channelManagerService.testChannelConnection(
        req.params.id,
        admin?.name || admin?.email || 'Admin'
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 5. Manual Sync for Single Channel
  app.post('/api/admin/channels/:id/sync', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const result = await channelManagerService.syncChannel(
        req.params.id,
        admin?.name || admin?.email || 'Admin'
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6. Global Sync for All Channels
  app.post('/api/admin/channels/sync-all', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const result = await channelManagerService.syncAllChannels(
        admin?.name || admin?.email || 'Admin'
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Central Derived Channel Inventory (Reading Single Source of Truth from PMS)
  app.get('/api/admin/channels/inventory', authenticateAdmin, (req, res) => {
    try {
      const propertyCode = (req.query.propertyCode as any) || 'all';
      const today = new Date().toISOString().split('T')[0];
      const defaultEnd = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const startDate = (req.query.startDate as string) || today;
      const endDate = (req.query.endDate as string) || defaultEnd;

      const inventory = channelManagerService.getChannelInventory(propertyCode, startDate, endDate);
      res.json(inventory);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Room Mappings (Get, Save, Delete)
  app.get('/api/admin/channels/mappings/rooms', authenticateAdmin, (req, res) => {
    try {
      const { channelId, propertyCode } = req.query;
      const mappings = channelManagerService.getRoomMappings(
        channelId as string,
        propertyCode as string
      );
      res.json(mappings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/channels/mappings/rooms', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const saved = channelManagerService.saveRoomMapping(
        req.body,
        admin?.name || admin?.email || 'Admin'
      );
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/channels/mappings/rooms/:id', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const deleted = channelManagerService.deleteRoomMapping(
        req.params.id,
        admin?.name || admin?.email || 'Admin'
      );
      if (!deleted) return res.status(404).json({ error: 'Room mapping not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. PMS Rate Plans (Get, Save, Delete)
  app.get('/api/admin/channels/rate-plans', authenticateAdmin, (req, res) => {
    try {
      const { propertyCode, roomTypeId } = req.query;
      const plans = channelManagerService.getPMSRatePlans(
        propertyCode as string,
        roomTypeId as string
      );
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/channels/rate-plans', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const saved = channelManagerService.savePMSRatePlan(
        req.body,
        admin?.name || admin?.email || 'Admin'
      );
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/channels/rate-plans/:id', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const deleted = channelManagerService.deletePMSRatePlan(
        req.params.id,
        admin?.name || admin?.email || 'Admin'
      );
      if (!deleted) return res.status(404).json({ error: 'Rate plan not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Rate Mappings (Get, Save, Delete)
  app.get('/api/admin/channels/mappings/rates', authenticateAdmin, (req, res) => {
    try {
      const { channelId, propertyCode } = req.query;
      const mappings = channelManagerService.getRateMappings(
        channelId as string,
        propertyCode as string
      );
      res.json(mappings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/channels/mappings/rates', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const saved = channelManagerService.saveRateMapping(
        req.body,
        admin?.name || admin?.email || 'Admin'
      );
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/channels/mappings/rates/:id', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const deleted = channelManagerService.deleteRateMapping(
        req.params.id,
        admin?.name || admin?.email || 'Admin'
      );
      if (!deleted) return res.status(404).json({ error: 'Rate mapping not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Channel Sync Jobs & Logs (Filterable)
  app.get('/api/admin/channels/jobs', authenticateAdmin, (req, res) => {
    try {
      const { channel_id, channel_code, status, operation, startDate, endDate, limit } = req.query;
      const jobs = channelManagerService.getSyncJobs({
        channel_id: channel_id as string,
        channel_code: channel_code as string,
        status: status as string,
        operation: operation as string,
        startDate: startDate as string,
        endDate: endDate as string,
        limit: limit ? Number(limit) : 100
      });
      res.json(jobs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Retry Sync Job
  app.post('/api/admin/channels/jobs/:id/retry', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const retried = await channelManagerService.retrySyncJob(
        req.params.id,
        admin?.name || admin?.email || 'Admin'
      );
      res.json(retried);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 13. OTA Reservation Import / Ingest Endpoint (with Idempotency)
  app.post('/api/admin/channels/ota/import', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const result = await channelManagerService.importOTAReservation(
        req.body,
        admin?.name || admin?.email || 'OTA Webhook Bridge'
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Catch-all for undefined API routes (MUST return JSON, not Vite/HTML SPA fallback)
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.originalUrl}`
    });
  });

  // Explicitly serve static assets from public/ directory
  app.use('/assets', express.static(path.join(process.cwd(), 'public/assets')));
  app.use(express.static(path.join(process.cwd(), 'public')));

  // VITE OR STATIC SERVING
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    logRazorpayStartupDiagnostics();
  });
}

startServer();
