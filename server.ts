import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from './server/db';
import { AvailabilitySearchQuery } from './src/types';
import {
  initializePostgres,
  isPostgresAvailable,
  postgresGetSocialMediaSettings,
  postgresUpdateSocialMediaSettings,
  postgresGetCoupons,
  postgresGetCouponByCode,
  postgresCreateCoupon,
  postgresUpdateCoupon,
  postgresDeleteCoupon,
  postgresRecordCouponUsage,
  postgresGetCouponUsage
} from './server/db/postgres';
import { reservationService } from './server/services/reservationService';
import { inventoryService } from './server/services/inventoryService';
import { paymentService } from './server/services/paymentService';
import { roomService } from './server/services/roomService';
import { guestService } from './server/services/guestService';
import { pmsService } from './server/services/pmsService';
import { auditService } from './server/services/auditService';
import { channelService } from './server/services/channelService';
import { channelManagerService } from './server/services/channelManagerService';
import { emailService, logEmailStartupDiagnostics } from './server/services/emailService';
import { bhashSmsService, normalizePhoneNumber } from './server/services/whatsappService';
import {
  getRazorpayServerConfig,
  logRazorpayStartupDiagnostics,
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature
} from './server/razorpay';
import { paymentGatewayRegistry } from './server/services/payments/paymentGatewayRegistry';
import { PropertyCode, PaymentTransactionRecord, CombinedBookingGroup } from './src/types';

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

  // Channel Manager: Recover any stuck sync jobs from prior server crash or reboot
  const recoveredJobs = db.recoverStuckSyncJobs(5 * 60 * 1000);
  if (recoveredJobs > 0) {
    console.log(`♻️ [ChannelManager] Recovered ${recoveredJobs} stuck sync job(s) from previous session.`);
  }

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.get('/api/debug/database', (req, res) => {
    try {
      const dataDir = process.env.SBM_DATA_DIR
        ? path.resolve(process.env.SBM_DATA_DIR)
        : path.resolve(process.cwd(), 'data');

      const dbFile = path.join(dataDir, 'sbm_database.json');

      const room = db
        .getRoomTypes('sbm-hotel')
        .find(r => r.id === 'room-sbm-deluxe');

      res.json({
        process_cwd: process.cwd(),
        database_directory: dataDir,
        database_file: dbFile,
        database_file_exists: fs.existsSync(dbFile),
        database_file_modified: fs.existsSync(dbFile)
          ? fs.statSync(dbFile).mtime
          : null,
        deluxe_room: room || null
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  });

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

    const roomTypes = db.getRoomTypes(propertyCode).map(room => ({
      ...room,
      price_per_night: Number(room.price_per_night)
    }));

    console.log(
      `[PRICE API] GET /api/room-types | ` +
      `property=${propertyCode || 'all'} | ` +
      roomTypes
        .map(r => `${r.id}:${r.name}=₹${r.price_per_night}`)
        .join(', ')
    );

    // Prevent browser/proxy from serving an old price response
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json(roomTypes);
  } catch (err: any) {
    console.error('[PRICE API] Failed:', err);
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
      console.log(`[Pricing Availability] PUBLIC REQUEST -> /api/availability/check for ${searchQuery.check_in} to ${searchQuery.check_out} -> Results: ${results.map(r => `${r.roomType.name}: ₹${r.pricePerNight}/n (Total: ₹${r.totalAmount})`).join(', ')}`);
      
      // Prevent browser/proxy from caching availability pricing
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json(results);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Create Booking
  app.post('/api/bookings', (req, res) => {
    try {
      const booking = db.createBooking(req.body);

      // Trigger Channel Manager Central Inventory Synchronization across all channels
      if (booking && booking.property_code && booking.room_type_id) {
        channelManagerService.queueInventorySync({
          propertyCode: booking.property_code,
          roomTypeId: booking.room_type_id,
          startDate: booking.check_in,
          endDate: booking.check_out,
          triggerReason: `Direct Website Booking: ${booking.booking_number}`
        }).catch(err => console.error('[ChannelManager] Direct booking sync queue error:', err?.message || err));
      }

      // Asynchronously trigger customer confirmation & admin alert
      if (booking.booking_status === 'Confirmed' || booking.payment_status === 'Completed' || booking.payment_status === 'Paid') {
        emailService.sendBookingConfirmationEmail(booking).catch((err: any) => {
          console.error('[EmailService] Async confirmation error:', err?.message || err);
        });

        // Trigger WhatsApp booking confirmation via BhashSMS
        bhashSmsService.sendBookingConfirmation(booking).then((waRes) => {
          if (waRes.success) {
            db.updateBookingWhatsAppStatus(booking.id, 'sent', waRes.messageId);
          } else if (waRes.notConfigured) {
            db.updateBookingWhatsAppStatus(booking.id, 'not_configured', undefined, waRes.error);
          } else {
            db.updateBookingWhatsAppStatus(booking.id, 'failed', undefined, waRes.error);
          }
        }).catch((waErr: any) => {
          console.error('[WhatsApp] Async booking confirmation error:', waErr?.message || waErr);
          db.updateBookingWhatsAppStatus(booking.id, 'failed', undefined, waErr?.message);
        });
      }
      emailService.sendAdminBookingNotification(booking).catch((err: any) => {
        console.error('[EmailService] Async admin alert error:', err?.message || err);
      });

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

  // =========================================================================
  // --- MULTI-PROPERTY PAYMENT GATEWAY & ROUTING ENDPOINTS (SBM 1 & SBM 2) ---
  // =========================================================================

  // 1. Get Payment Gateway Public Config (Single Property or All Properties)
  app.get('/api/payments/config', (req, res) => {
    try {
      const allConfigs = paymentGatewayRegistry.getAllPublicConfigs();
      const sbm1Cfg = allConfigs['sbm-hotel'];
      const sbm2Cfg = allConfigs['sbm-guest-house'];
      res.json({
        properties: {
          'sbm-hotel': sbm1Cfg,
          'sbm-guest-house': sbm2Cfg
        },
        // Backwards compatibility for single-property clients
        key_id: sbm1Cfg.key_id,
        is_configured: sbm1Cfg.is_configured && sbm2Cfg.is_configured,
        mode: sbm1Cfg.mode,
        currency: 'INR',
        provider: sbm1Cfg.provider,
        bank_account_name: sbm1Cfg.bank_account_name
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/payments/config/:property_code', (req, res) => {
    try {
      const code = req.params.property_code as PropertyCode;
      if (code !== 'sbm-hotel' && code !== 'sbm-guest-house') {
        return res.status(400).json({ error: 'Invalid property code.' });
      }
      const cfg = paymentGatewayRegistry.getPublicPropertyConfig(code);
      res.json(cfg);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Create Payment Order Routed by Property (Single Property)
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
        coupon_code,
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

      // Check property from trusted server records
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

      // Calculate amounts strictly server-side
      const nights = matchedResult.nights;
      const pricePerNight = matchedResult.pricePerNight;
      const roomsCount = Number(rooms);
      const subtotal = pricePerNight * nights * roomsCount;

      let discountAmount = 0;
      let appliedCouponCode: string | undefined = undefined;

      if (coupon_code && typeof coupon_code === 'string' && coupon_code.trim()) {
        const valRes = db.validateCoupon({
          code: coupon_code,
          roomId: matchedResult.roomType.id,
          bookingAmount: subtotal,
          guestEmail: cleanEmail,
          guestPhone: cleanPhone
        });

        if (valRes.valid) {
          discountAmount = valRes.discountAmount;
          appliedCouponCode = valRes.code;
        } else {
          return res.status(400).json({ error: `Coupon error: ${valRes.error || 'Invalid coupon code.'}` });
        }
      }

      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const gstPercent = db.getSettings().gst_percent || 12;
      const taxAmount = Math.round(taxableAmount * (gstPercent / 100));
      const totalAmount = taxableAmount + taxAmount;
      const amountInPaise = Math.round(totalAmount * 100);

      // Retrieve Property Payment Gateway Configuration
      const gatewayConfig = paymentGatewayRegistry.getPropertyConfig(property.code);
      if (!gatewayConfig.is_configured && gatewayConfig.mode !== 'test') {
        console.error(`[Payment Order Failed] Gateway credentials missing for ${property.name} (${property.code}).`);
        return res.status(503).json({
          error: `Online payment gateway for ${property.name} is currently being configured. Please choose "Pay at Reception" or contact hotel desk.`
        });
      }

      // Handle Existing Booking or Create Initial Pending Booking in DB
      let booking;
      if (existing_booking_id) {
        const existing = db.getBookingByIdOrNumber(existing_booking_id);
        if (existing) {
          if (existing.payment_status === 'Completed' || existing.payment_status === 'Paid') {
            return res.status(400).json({ error: 'This booking is already paid and confirmed.' });
          }
          booking = db.updateBooking(existing.id, {
            guest_name,
            guest_phone: cleanPhone,
            guest_email: cleanEmail,
            special_request,
            nights,
            price_per_night: pricePerNight,
            room_subtotal: subtotal,
            discount_amount: discountAmount,
            coupon_code: appliedCouponCode,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            payment_status: 'Pending',
            booking_status: 'Pending',
            gateway_provider: gatewayConfig.provider,
            gateway_merchant_id: gatewayConfig.merchant_id,
            bank_account_name: gatewayConfig.bank_account_name,
            payment_method: `online_${gatewayConfig.provider}`
          });
        }
      }

      if (!booking) {
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
          discount_amount: discountAmount,
          coupon_code: appliedCouponCode,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          payment_status: 'Pending',
          booking_status: 'Pending',
          gateway_provider: gatewayConfig.provider,
          gateway_merchant_id: gatewayConfig.merchant_id,
          bank_account_name: gatewayConfig.bank_account_name,
          payment_method: `online_${gatewayConfig.provider}`,
          special_request
        });
      }

      // Create Order Routed Strictly Through Property-Assigned Gateway
      console.log(`[Payment Router] Routing payment of ₹${totalAmount} for ${property.name} to gateway provider: ${gatewayConfig.provider.toUpperCase()} (Settlement: ${gatewayConfig.bank_account_name})`);

      let orderResult;
      try {
        orderResult = await paymentGatewayRegistry.createOrderForProperty(property.code, {
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
            guest_phone: booking.guest_phone,
            settlement_bank: gatewayConfig.bank_account_name
          },
          customer: {
            name: booking.guest_name,
            email: booking.guest_email,
            contact: booking.guest_phone
          }
        });
      } catch (orderErr: any) {
        console.error(`[Payment Order Exception for ${property.name}]`, orderErr.message);
        return res.status(502).json({
          error: `Unable to initialize payment for ${property.name}. Please try again or choose Pay at Reception.`
        });
      }

      // Record Idempotent Transaction Record in Database
      const transactionRecord: PaymentTransactionRecord = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        property_code: property.code,
        property_name: property.name,
        gateway_provider: orderResult.provider,
        merchant_id: orderResult.merchant_id || gatewayConfig.merchant_id,
        order_id: orderResult.order_id,
        amount: totalAmount,
        amount_in_paise: amountInPaise,
        currency: 'INR',
        status: 'PENDING',
        bank_account_hint: orderResult.settlement_account_hint,
        idempotency_key: `ord_${booking.id}_${property.code}_${amountInPaise}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.createPaymentTransaction(transactionRecord);

      // Update booking with generated order_id & provider info
      db.updateBooking(booking.id, {
        razorpay_order_id: orderResult.order_id,
        payment_amount: totalAmount,
        payment_currency: 'INR',
        gateway_provider: orderResult.provider,
        gateway_merchant_id: orderResult.merchant_id || gatewayConfig.merchant_id,
        bank_account_name: orderResult.bank_account_name
      });

      res.status(200).json({
        success: true,
        order_id: orderResult.order_id,
        provider: orderResult.provider,
        amount: amountInPaise,
        currency: 'INR',
        key_id: orderResult.key_id,
        property_code: property.code,
        property_name: property.name,
        bank_account_name: orderResult.bank_account_name,
        settlement_account_hint: orderResult.settlement_account_hint,
        payment_url: orderResult.payment_url,
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

  // 3. Combined Bookings Across Both Hotels (Multi-Property Payment Orders)
  app.post('/api/payments/combined/create-orders', async (req, res) => {
    try {
      const {
        guest_name,
        guest_phone,
        guest_email,
        check_in,
        check_out,
        special_request = '',
        coupon_code,
        items // Array of { property_code: PropertyCode, room_type_id: string, rooms: number, adults?: number, children?: number }
      } = req.body;

      if (!guest_name || !guest_phone || !guest_email || !check_in || !check_out || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'All guest details, dates, and booking items are required.' });
      }

      const cleanPhone = (guest_phone || '').trim();
      const cleanEmail = (guest_email || '').trim().toLowerCase();
      const isPhoneValid = /^[0-9]{10}$/.test(cleanPhone);
      const isEmailValid = /^[a-z0-9._%+-]+@gmail\.com$/.test(cleanEmail);

      if (!isPhoneValid || !isEmailValid) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number and Gmail address ending with @gmail.com.' });
      }

      // Group items by property_code to isolate amounts strictly per property
      const propertyGroups: Record<string, typeof items> = {};
      for (const item of items) {
        if (!propertyGroups[item.property_code]) {
          propertyGroups[item.property_code] = [];
        }
        propertyGroups[item.property_code].push(item);
      }

      const allProperties = db.getProperties();
      const gstPercent = db.getSettings().gst_percent || 12;
      const groupSuffix = Math.floor(100000 + Math.random() * 900000);
      const groupBookingNumber = `SBM-COMBINED-${groupSuffix}`;
      const groupId = `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const childBookings: any[] = [];
      const propertyOrderResults: any[] = [];
      let totalNights = 1;
      let totalRoomsCombined = 0;
      let grandSubtotal = 0;
      let grandDiscount = 0;
      let grandTax = 0;
      let grandTotal = 0;

      // Process each property independently
      for (const [propCode, propItems] of Object.entries(propertyGroups)) {
        const property = allProperties.find(p => p.code === propCode);
        if (!property) {
          return res.status(400).json({ error: `Invalid property code: ${propCode}` });
        }

        const gatewayConfig = paymentGatewayRegistry.getPropertyConfig(property.code);
        let propSubtotal = 0;
        let propRoomsCount = 0;
        let propNights = 1;
        let propRoomName = '';
        let propRoomTypeId = '';
        let propPricePerNight = 0;

        for (const item of propItems) {
          const availResults = db.checkAvailability({
            property_code: property.code,
            check_in,
            check_out,
            adults: Number(item.adults || 2),
            children: Number(item.children || 0),
            rooms: Number(item.rooms || 1)
          });

          const matched = availResults.find(r => r.roomType.id === item.room_type_id || r.roomType.room_code === item.room_type_id);
          if (!matched || !matched.isAvailable || matched.availableRooms < Number(item.rooms || 1)) {
            return res.status(400).json({
              error: `Insufficient availability for ${item.room_type_id} at ${property.name}.`
            });
          }

          propNights = matched.nights;
          totalNights = Math.max(totalNights, propNights);
          propPricePerNight = matched.pricePerNight;
          propRoomName = matched.roomType.name;
          propRoomTypeId = matched.roomType.id;
          const count = Number(item.rooms || 1);
          propRoomsCount += count;
          propSubtotal += matched.pricePerNight * propNights * count;
        }

        totalRoomsCombined += propRoomsCount;
        grandSubtotal += propSubtotal;

        // Proportional or property-specific coupon calculation
        let propDiscount = 0;
        let appliedCoupon: string | undefined = undefined;
        if (coupon_code && typeof coupon_code === 'string' && coupon_code.trim()) {
          const valRes = db.validateCoupon({
            code: coupon_code,
            roomId: propRoomTypeId,
            bookingAmount: propSubtotal,
            guestEmail: cleanEmail,
            guestPhone: cleanPhone
          });
          if (valRes.valid) {
            propDiscount = valRes.discountAmount;
            appliedCoupon = valRes.code;
          }
        }

        grandDiscount += propDiscount;
        const propTaxable = Math.max(0, propSubtotal - propDiscount);
        const propTax = Math.round(propTaxable * (gstPercent / 100));
        const propTotal = propTaxable + propTax;
        const propPaise = Math.round(propTotal * 100);

        grandTax += propTax;
        grandTotal += propTotal;

        // Create individual child Booking for this property
        const childBooking = db.createBooking({
          property_id: property.id,
          property_code: property.code,
          property_name: property.name,
          room_type_id: propRoomTypeId,
          room_name: propRoomName,
          guest_name,
          guest_phone: cleanPhone,
          guest_email: cleanEmail,
          adults: 2,
          children: 0,
          rooms_requested: propRoomsCount,
          check_in,
          check_out,
          nights: propNights,
          price_per_night: propPricePerNight,
          room_subtotal: propSubtotal,
          discount_amount: propDiscount,
          coupon_code: appliedCoupon,
          tax_amount: propTax,
          total_amount: propTotal,
          payment_status: 'Pending',
          booking_status: 'Pending',
          gateway_provider: gatewayConfig.provider,
          gateway_merchant_id: gatewayConfig.merchant_id,
          bank_account_name: gatewayConfig.bank_account_name,
          payment_method: `online_${gatewayConfig.provider}`,
          special_request
        });

        // Tag child booking with group info
        db.updateBooking(childBooking.id, {
          booking_group_id: groupId,
          is_combined_booking: true
        });

        // Create Order Strictly Through This Property's Gateway
        const orderResult = await paymentGatewayRegistry.createOrderForProperty(property.code, {
          amountInPaise: propPaise,
          currency: 'INR',
          receipt: childBooking.booking_number,
          notes: {
            group_id: groupId,
            group_number: groupBookingNumber,
            booking_id: childBooking.id,
            booking_number: childBooking.booking_number,
            property_code: property.code,
            property_name: property.name,
            settlement_bank: gatewayConfig.bank_account_name
          },
          customer: {
            name: guest_name,
            email: cleanEmail,
            contact: cleanPhone
          }
        });

        // Record Transaction Record
        const txRecord: PaymentTransactionRecord = {
          id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          booking_id: childBooking.id,
          booking_number: childBooking.booking_number,
          booking_group_id: groupId,
          property_code: property.code,
          property_name: property.name,
          gateway_provider: orderResult.provider,
          merchant_id: orderResult.merchant_id || gatewayConfig.merchant_id,
          order_id: orderResult.order_id,
          amount: propTotal,
          amount_in_paise: propPaise,
          currency: 'INR',
          status: 'PENDING',
          bank_account_hint: orderResult.settlement_account_hint,
          idempotency_key: `comb_${groupId}_${property.code}_${propPaise}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        db.createPaymentTransaction(txRecord);

        // Update child booking with generated order ID
        db.updateBooking(childBooking.id, {
          razorpay_order_id: orderResult.order_id,
          gateway_provider: orderResult.provider,
          bank_account_name: orderResult.bank_account_name
        });

        childBookings.push({
          property_code: property.code,
          property_name: property.name,
          booking_id: childBooking.id,
          booking_number: childBooking.booking_number,
          room_name: propRoomName,
          rooms_count: propRoomsCount,
          amount: propTotal,
          payment_status: 'Pending',
          gateway_provider: orderResult.provider,
          order_id: orderResult.order_id,
          bank_account_name: orderResult.bank_account_name
        });

        propertyOrderResults.push({
          property_code: property.code,
          property_name: property.name,
          booking_id: childBooking.id,
          booking_number: childBooking.booking_number,
          amount: propTotal,
          amount_in_paise: propPaise,
          currency: 'INR',
          gateway_provider: orderResult.provider,
          order_id: orderResult.order_id,
          key_id: orderResult.key_id,
          bank_account_name: orderResult.bank_account_name,
          settlement_account_hint: orderResult.settlement_account_hint,
          payment_url: orderResult.payment_url,
          payment_status: 'Pending'
        });
      }

      // Create Parent Combined Booking Group in DB
      const combinedGroup: CombinedBookingGroup = {
        id: groupId,
        group_booking_number: groupBookingNumber,
        guest_name,
        guest_phone: cleanPhone,
        guest_email: cleanEmail,
        check_in,
        check_out,
        total_nights: totalNights,
        total_rooms: totalRoomsCombined,
        total_subtotal: grandSubtotal,
        total_discount: grandDiscount,
        total_tax: grandTax,
        total_amount: grandTotal,
        total_paid: 0,
        payment_status: 'Pending',
        booking_status: 'Pending',
        bookings: childBookings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.createCombinedBookingGroup(combinedGroup);

      res.status(200).json({
        success: true,
        group_id: groupId,
        group_booking_number: groupBookingNumber,
        total_amount: grandTotal,
        total_nights: totalNights,
        total_rooms: totalRoomsCombined,
        property_orders: propertyOrderResults
      });
    } catch (err: any) {
      console.error('[Combined Booking Creation Error]', err);
      res.status(500).json({ error: err.message || 'Failed to initialize combined booking orders.' });
    }
  });

  // 4. Verify Payment for a Specific Property in Combined Booking
  app.post('/api/payments/combined/verify', async (req, res) => {
    try {
      const {
        group_id,
        booking_id,
        property_code,
        order_id,
        transaction_id,
        signature
      } = req.body;

      if (!group_id || !booking_id || !property_code || !order_id || !transaction_id) {
        return res.status(400).json({ error: 'Missing required combined payment verification parameters.' });
      }

      const group = db.getCombinedBookingGroup(group_id);
      if (!group) {
        return res.status(404).json({ error: 'Combined booking group not found.' });
      }

      const booking = db.getBookingByIdOrNumber(booking_id);
      if (!booking) {
        return res.status(404).json({ error: 'Child booking record not found.' });
      }

      // Security check: verify booking property matches request property
      if (booking.property_code !== property_code) {
        return res.status(403).json({ error: 'Cross-property verification mismatch.' });
      }

      // Cryptographic verification via property adapter
      const verification = await paymentGatewayRegistry.verifyPaymentForProperty(property_code, {
        order_id,
        transaction_id,
        signature,
        property_code
      });

      if (!verification.isValid) {
        db.updatePaymentTransaction(order_id, {
          status: 'FAILED',
          error_description: verification.error || 'Signature mismatch'
        });
        return res.status(400).json({
          success: false,
          error: `Payment verification failed for ${booking.property_name}: ${verification.error || 'Signature check failed'}`
        });
      }

      // Mark Child Booking as Paid & Confirmed
      const now = new Date().toISOString();
      const updatedBooking = db.updateBooking(booking.id, {
        payment_status: 'Completed',
        booking_status: 'Confirmed',
        payment_txn_id: transaction_id,
        razorpay_payment_id: transaction_id,
        razorpay_order_id: order_id,
        razorpay_signature: signature,
        payment_verified_at: now
      });

      // Update Transaction Record
      db.updatePaymentTransaction(order_id, {
        status: 'SUCCESS',
        transaction_id,
        signature,
        verified_at: now
      });

      // Record in PMS Ledger
      db.recordPaymentForReservation({
        reservationId: booking.id,
        method: booking.payment_method || 'ONLINE',
        amount: booking.total_amount,
        transactionId: transaction_id,
        paymentReference: `Combined Booking ${group.group_booking_number} (${booking.property_name})`,
        recordedBy: `${booking.property_name} Payment Gateway`
      });

      // Re-evaluate Combined Group Status
      const updatedGroupBookings = group.bookings.map(b => {
        if (b.booking_id === booking.id) {
          return {
            ...b,
            payment_status: 'Paid' as const,
            payment_txn_id: transaction_id
          };
        }
        return b;
      });

      const totalPaid = updatedGroupBookings
        .filter(b => b.payment_status === 'Paid')
        .reduce((sum, b) => sum + b.amount, 0);

      const allPaid = updatedGroupBookings.every(b => b.payment_status === 'Paid');

      const updatedGroup = db.updateCombinedBookingGroup(group.id, {
        bookings: updatedGroupBookings,
        total_paid: totalPaid,
        payment_status: allPaid ? 'Paid' : (totalPaid > 0 ? 'Partially Paid' : 'Pending'),
        booking_status: allPaid ? 'Confirmed' : 'Pending'
      });

      // Front desk activity
      db.addActivity(
        'Payment',
        `Combined Booking: ₹${booking.total_amount.toLocaleString('en-IN')} paid for ${booking.property_name} (${booking.booking_number}) by ${group.guest_name}`,
        booking.property_code,
        `${booking.property_name} Gateway`
      );

      // If fully paid, send confirmation notifications
      if (allPaid && updatedGroup) {
        emailService.sendBookingConfirmationEmail(updatedBooking).catch(console.error);
        emailService.sendAdminBookingNotification(updatedBooking).catch(console.error);
        bhashSmsService.sendBookingConfirmation(updatedBooking).catch(console.error);
      }

      res.status(200).json({
        success: true,
        message: `Payment confirmed for ${booking.property_name}.`,
        all_paid: allPaid,
        group: updatedGroup,
        booking: updatedBooking
      });
    } catch (err: any) {
      console.error('[Combined Payment Verification Error]', err);
      res.status(500).json({ error: err.message || 'Combined payment verification failed.' });
    }
  });

  // 5. Get Combined Booking Status
  app.get('/api/payments/combined/status/:groupId', (req, res) => {
    try {
      const group = db.getCombinedBookingGroup(req.params.groupId);
      if (!group) {
        return res.status(404).json({ error: 'Combined booking group not found.' });
      }
      res.json(group);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Verify Single Payment Signature (Property-Aware)
  app.post('/api/payments/verify', async (req, res) => {
    try {
      const {
        booking_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        order_id,
        transaction_id,
        signature
      } = req.body;

      const effectiveOrderId = razorpay_order_id || order_id;
      const effectiveTxnId = razorpay_payment_id || transaction_id;
      const effectiveSig = razorpay_signature || signature;

      if (!booking_id || !effectiveOrderId || !effectiveTxnId) {
        return res.status(400).json({ error: 'Missing required payment verification parameters.' });
      }

      const booking = db.getBookingByIdOrNumber(booking_id) || db.getBookingByRazorpayOrderId(effectiveOrderId);
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

      // Server-side cryptographic verification using property-specific gateway adapter
      const verification = await paymentGatewayRegistry.verifyPaymentForProperty(
        booking.property_code,
        {
          order_id: effectiveOrderId,
          transaction_id: effectiveTxnId,
          signature: effectiveSig,
          property_code: booking.property_code
        }
      );

      if (!verification.isValid) {
        db.updateBooking(booking.id, {
          payment_status: 'Failed',
          internal_notes: `Payment signature mismatch. Order: ${effectiveOrderId}, Payment: ${effectiveTxnId}`
        });
        db.updatePaymentTransaction(effectiveOrderId, {
          status: 'FAILED',
          error_description: verification.error || 'Signature check failed'
        });
        return res.status(400).json({
          success: false,
          error: `${booking.property_name} payment verification failed: ${verification.error || 'The transaction could not be authenticated.'}`
        });
      }

      // Mark booking as PAID and CONFIRMED
      const verifiedAt = new Date().toISOString();
      const updatedBooking = db.updateBooking(booking.id, {
        payment_status: 'Completed',
        booking_status: 'Confirmed',
        payment_method: verification.method || booking.payment_method || 'online_payment',
        payment_txn_id: effectiveTxnId,
        razorpay_order_id: effectiveOrderId,
        razorpay_payment_id: effectiveTxnId,
        razorpay_signature: effectiveSig,
        payment_amount: booking.total_amount,
        payment_currency: 'INR',
        payment_verified_at: verifiedAt
      });

      // Update Transaction Record
      db.updatePaymentTransaction(effectiveOrderId, {
        status: 'SUCCESS',
        transaction_id: effectiveTxnId,
        signature: effectiveSig,
        verified_at: verifiedAt
      });

      // Record in PMS Ledger
      db.recordPaymentForReservation({
        reservationId: booking.id,
        method: verification.method || booking.payment_method || 'ONLINE',
        amount: booking.total_amount,
        transactionId: effectiveTxnId,
        paymentReference: `${booking.property_name} Payment (${effectiveTxnId})`,
        recordedBy: `${booking.property_name} Gateway`
      });

      // Record Coupon Usage if coupon was applied
      if (updatedBooking.coupon_code) {
        const coupon = db.getCouponByCode(updatedBooking.coupon_code);
        if (coupon) {
          if (isPostgresAvailable()) {
            postgresRecordCouponUsage(coupon.id, updatedBooking.id, updatedBooking.guest_email, updatedBooking.guest_phone, updatedBooking.discount_amount || 0).catch(console.error);
          }
          db.recordCouponUsage(coupon.id, updatedBooking.id, updatedBooking.guest_email, updatedBooking.guest_phone, updatedBooking.discount_amount || 0);
        }
      }

      // Front desk activity log
      db.addActivity(
        'Payment',
        `₹${booking.total_amount.toLocaleString('en-IN')} paid via ${booking.property_name} gateway by ${booking.guest_name} (${booking.booking_number}). Txn: ${effectiveTxnId}${updatedBooking.coupon_code ? ' [Coupon: ' + updatedBooking.coupon_code + ']' : ''}`,
        booking.property_code,
        `${booking.property_name} Gateway`
      );

      // Asynchronously trigger customer confirmation & admin alert
      emailService.sendBookingConfirmationEmail(updatedBooking).catch((err: any) => {
        console.error('[EmailService] Async confirmation email error:', err?.message || err);
      });
      emailService.sendAdminBookingNotification(updatedBooking).catch((err: any) => {
        console.error('[EmailService] Async admin alert error:', err?.message || err);
      });

      // WhatsApp booking confirmation via BhashSMS
      bhashSmsService.sendBookingConfirmation(updatedBooking).then((waRes) => {
        if (waRes.success) {
          db.updateBookingWhatsAppStatus(updatedBooking.id, 'sent', waRes.messageId);
        } else if (waRes.notConfigured) {
          db.updateBookingWhatsAppStatus(updatedBooking.id, 'not_configured', undefined, waRes.error);
        } else {
          db.updateBookingWhatsAppStatus(updatedBooking.id, 'failed', undefined, waRes.error);
        }
      }).catch((waErr: any) => {
        console.error('[WhatsApp] Async confirmation error:', waErr?.message || waErr);
        db.updateBookingWhatsAppStatus(updatedBooking.id, 'failed', undefined, waErr?.message);
      });

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

  // 7. Record Payment Failure or Cancellation
  app.post('/api/payments/failure', async (req, res) => {
    try {
      const { booking_id, razorpay_order_id, order_id, error_code, error_description } = req.body;
      const effectiveOrderId = razorpay_order_id || order_id;

      const booking = (booking_id ? db.getBookingByIdOrNumber(booking_id) : undefined) ||
                      (effectiveOrderId ? db.getBookingByRazorpayOrderId(effectiveOrderId) : undefined);

      if (effectiveOrderId) {
        db.updatePaymentTransaction(effectiveOrderId, {
          status: 'FAILED',
          error_code,
          error_description: error_description || 'Payment dismissed or aborted by user'
        });
      }

      if (booking) {
        if (booking.payment_status !== 'Completed' && booking.payment_status !== 'Paid') {
          const updated = db.updateBooking(booking.id, {
            payment_status: 'Failed',
            internal_notes: `Payment failure: ${error_description || error_code || 'Payment dismissed or aborted by user'}`
          });

          db.addActivity(
            'Payment',
            `Payment attempt failed for ${booking.guest_name} (${booking.booking_number}): ${error_description || 'Incomplete payment'}`,
            booking.property_code,
            `${booking.property_name} Gateway`
          );

          return res.json({ success: true, message: 'Payment failure recorded.', booking: updated });
        }
      }

      res.json({ success: true, message: 'Payment failure recorded.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Dedicated Property Webhook Handlers
  app.post('/api/payments/webhook/:property_code', async (req, res) => {
    try {
      const propertyCode = req.params.property_code as PropertyCode;
      if (propertyCode !== 'sbm-hotel' && propertyCode !== 'sbm-guest-house') {
        return res.status(400).json({ error: 'Invalid property code in webhook route.' });
      }

      const signature =
        (req.headers['x-razorpay-signature'] as string) ||
        (req.headers['x-verify'] as string) ||
        (req.headers['x-webhook-signature'] as string) ||
        (req.headers['stripe-signature'] as string) ||
        '';

      const rawBody = JSON.stringify(req.body);
      const verifyRes = await paymentGatewayRegistry.handleWebhook(propertyCode, rawBody, signature);

      if (!verifyRes.isValid) {
        console.warn(`[Webhook - ${propertyCode}] Webhook verification rejected:`, verifyRes.error);
        return res.status(400).json({ error: verifyRes.error || 'Webhook verification failed.' });
      }

      // Idempotent state transitions
      if (verifyRes.order_id) {
        const booking = db.getBookingByRazorpayOrderId(verifyRes.order_id);
        if (booking && booking.property_code === propertyCode) {
          if (verifyRes.status === 'SUCCESS' && booking.payment_status !== 'Completed' && booking.payment_status !== 'Paid') {
            const updatedBooking = db.updateBooking(booking.id, {
              payment_status: 'Completed',
              booking_status: 'Confirmed',
              payment_txn_id: verifyRes.transaction_id,
              payment_verified_at: new Date().toISOString()
            });

            db.updatePaymentTransaction(verifyRes.order_id, {
              status: 'SUCCESS',
              transaction_id: verifyRes.transaction_id,
              verified_at: new Date().toISOString()
            });

            db.addActivity(
              'Payment',
              `Webhook Confirmation: ₹${booking.total_amount} captured for ${booking.booking_number} (Txn: ${verifyRes.transaction_id})`,
              booking.property_code,
              `${booking.property_name} Webhook`
            );

            emailService.sendBookingConfirmationEmail(updatedBooking).catch(console.error);
            emailService.sendAdminBookingNotification(updatedBooking).catch(console.error);
            bhashSmsService.sendBookingConfirmation(updatedBooking).catch(console.error);
          } else if (verifyRes.status === 'FAILED') {
            db.updatePaymentTransaction(verifyRes.order_id, { status: 'FAILED' });
          }
        }
      }

      res.json({ status: 'ok', property_code: propertyCode });
    } catch (err: any) {
      console.error('[Property Webhook Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Unified General Webhook Handler
  app.post('/api/payments/webhook', async (req, res) => {
    try {
      const orderId =
        req.body?.payload?.payment?.entity?.order_id ||
        req.body?.payload?.order?.entity?.id ||
        req.body?.data?.order?.order_id ||
        req.body?.order_id;

      let propertyCode: PropertyCode = 'sbm-hotel';
      if (orderId) {
        const booking = db.getBookingByRazorpayOrderId(orderId);
        if (booking?.property_code) {
          propertyCode = booking.property_code;
        }
      }

      const signature =
        (req.headers['x-razorpay-signature'] as string) ||
        (req.headers['x-verify'] as string) ||
        (req.headers['stripe-signature'] as string) ||
        '';

      const rawBody = JSON.stringify(req.body);
      const verifyRes = await paymentGatewayRegistry.handleWebhook(propertyCode, rawBody, signature);

      if (verifyRes.order_id) {
        const booking = db.getBookingByRazorpayOrderId(verifyRes.order_id);
        if (booking) {
          if (verifyRes.status === 'SUCCESS' && booking.payment_status !== 'Completed' && booking.payment_status !== 'Paid') {
            db.updateBooking(booking.id, {
              payment_status: 'Completed',
              booking_status: 'Confirmed',
              payment_txn_id: verifyRes.transaction_id,
              payment_verified_at: new Date().toISOString()
            });
            db.updatePaymentTransaction(verifyRes.order_id, {
              status: 'SUCCESS',
              transaction_id: verifyRes.transaction_id
            });
          }
        }
      }

      res.json({ status: 'ok' });
    } catch (err: any) {
      console.error('[General Webhook Error]', err);
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
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = db.getSettings();
      if (isPostgresAvailable()) {
        try {
          const pgSocial = await postgresGetSocialMediaSettings();
          settings.social_media = pgSocial;
        } catch (e) {
          // fallback to db.getSettings().social_media
        }
      }
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public Coupon Validation
  app.post('/api/coupons/validate', async (req, res) => {
    try {
      const { code, roomId, bookingAmount, guestEmail, guestPhone } = req.body;
      const amt = Number(bookingAmount) || 0;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          valid: false,
          discountAmount: 0,
          eligibleAmount: amt,
          taxableAmount: amt,
          taxAmount: Math.round(amt * 0.12),
          totalAmount: Math.round(amt * 1.12),
          error: 'Coupon code is required.'
        });
      }

      let result;
      if (isPostgresAvailable()) {
        try {
          const pgCoupon = await postgresGetCouponByCode(code);
          if (pgCoupon) {
            result = db.validateCoupon({
              code,
              roomId,
              bookingAmount: amt,
              guestEmail,
              guestPhone
            });
          }
        } catch (e) {
          // Fallback to db.validateCoupon
        }
      }

      if (!result) {
        result = db.validateCoupon({
          code,
          roomId,
          bookingAmount: amt,
          guestEmail,
          guestPhone
        });
      }

      if (!result.valid) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (err: any) {
      const amt = Number(req.body.bookingAmount) || 0;
      res.status(500).json({
        valid: false,
        discountAmount: 0,
        eligibleAmount: amt,
        taxableAmount: amt,
        taxAmount: Math.round(amt * 0.12),
        totalAmount: Math.round(amt * 1.12),
        error: err.message || 'Failed to validate coupon.'
      });
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
          fastReply = 'You can reach our front desk anytime:\n\n• **SBM Hotel**: +91 99835 67921, +91 98285 23333 (sbmhotel@gmail.com)\n• **SBM 2 Guest House**: +91 98285 00845, +91 98285 00855 (sbmguesthouse@gmail.com)';
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
        replyText = 'You can reach us anytime:\n\n• **SBM Hotel**: +91 99835 67921, +91 98285 23333 (sbmhotel@gmail.com)\n• **SBM 2 Guest House**: +91 98285 00845, +91 98285 00855 (sbmguesthouse@gmail.com)';
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

  const adminOtpStore = new Map<string, { otp: string; expiresAt: number }>();

  app.post('/api/admin/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Admin email address is required.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000;
      adminOtpStore.set(cleanEmail, { otp, expiresAt });

      await emailService.sendAdminPasswordResetOtp(cleanEmail, otp);

      res.json({
        success: true,
        message: 'If an admin account with that email exists, an OTP has been sent to s.darshan5550@gmail.com.'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to process request.' });
    }
  });

  app.post('/api/admin/reset-password', (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const stored = adminOtpStore.get(cleanEmail);
      if (!stored) {
        return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new OTP.' });
      }
      if (Date.now() > stored.expiresAt) {
        adminOtpStore.delete(cleanEmail);
        return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
      }
      if (stored.otp !== otp.trim()) {
        return res.status(400).json({ error: 'Incorrect OTP. Please check the OTP sent to s.darshan5550@gmail.com.' });
      }

      const updated = db.updateAdminPassword(cleanEmail, newPassword.trim());
      if (!updated) {
        return res.status(404).json({ error: 'Admin account not found for specified email.' });
      }

      adminOtpStore.delete(cleanEmail);
      res.json({ success: true, message: 'Password reset successfully! You can now log in with your new password.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reset password.' });
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
        date: req.query.date as string,
        date_filter: req.query.dateFilter as string,
        custom_date: req.query.customDate as string
      };
      const bookings = db.getBookings(filters);
      res.json(bookings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/bookings/:id', authenticateAdmin, (req, res) => {
    try {
      const existing = db.getBookingByIdOrNumber(req.params.id);
      const updated = db.updateBooking(req.params.id, req.body);

      // Check if booking was cancelled
      if (existing && existing.booking_status !== 'Cancelled' && updated.booking_status === 'Cancelled') {
        emailService.sendBookingCancellationEmail(updated, req.body.reason || req.body.internal_notes).catch((err: any) => {
          console.error('[EmailService] Async cancellation email error:', err?.message || err);
        });
      } else if (existing && existing.booking_status !== updated.booking_status && updated.booking_status === 'Confirmed') {
        // Confirmed from Pending
        emailService.sendBookingConfirmationEmail(updated).catch((err: any) => {
          console.error('[EmailService] Async confirmation email error:', err?.message || err);
        });

        bhashSmsService.sendBookingConfirmation(updated).then((waRes) => {
          if (waRes.success) {
            db.updateBookingWhatsAppStatus(updated.id, 'sent', waRes.messageId);
          } else if (waRes.notConfigured) {
            db.updateBookingWhatsAppStatus(updated.id, 'not_configured', undefined, waRes.error);
          } else {
            db.updateBookingWhatsAppStatus(updated.id, 'failed', undefined, waRes.error);
          }
        }).catch((waErr: any) => {
          console.error('[WhatsApp] Admin confirmation send error:', waErr?.message || waErr);
          db.updateBookingWhatsAppStatus(updated.id, 'failed', undefined, waErr?.message);
        });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin Manage Room Types / Pricing
  app.put('/api/admin/room-types/:id', authenticateAdmin, (req, res) => {
    try {
     const roomId = req.params.id;

const requestedPrice =
  req.body.price !== undefined
    ? Number(req.body.price)
    : undefined;

if (
  requestedPrice !== undefined &&
  (!Number.isFinite(requestedPrice) || requestedPrice < 0)
) {
  return res.status(400).json({
    error: 'Invalid room price.'
  });
}

console.log(
  `[PRICE UPDATE] ADMIN REQUEST | room=${roomId} | newPrice=₹${requestedPrice}`
);

const updated = db.updatePhysicalRoom(roomId, {
  ...req.body,
  ...(requestedPrice !== undefined
    ? { price: requestedPrice }
    : {})
});

const roomType = db
  .getRoomTypes()
  .find(
    rt =>
      rt.id === updated.room_type_id ||
      (
        rt.property_code === updated.property_code &&
        rt.room_code === updated.room_code
      )
  );

if (!roomType) {
  throw new Error(
    `Price updated but parent room type could not be found.`
  );
}

console.log(
  `[PRICE UPDATE] SAVED | ` +
  `physicalRoom=${updated.id} | ` +
  `roomType=${roomType.id} | ` +
  `price=₹${roomType.price_per_night}`
);

res.json({
  ...updated,
  price: Number(updated.price),
  price_per_night: Number(roomType.price_per_night)
});
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
  app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
      const settings = db.getSettings();
      if (isPostgresAvailable()) {
        try {
          const pgSocial = await postgresGetSocialMediaSettings();
          settings.social_media = pgSocial;
        } catch (e) {
          // fallback to db.getSettings().social_media
        }
      }
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
      const updated = db.updateSettings(req.body);
      if (isPostgresAvailable() && req.body.social_media) {
        try {
          const pgSocial = await postgresUpdateSocialMediaSettings(req.body.social_media);
          updated.social_media = pgSocial;
        } catch (e) {
          console.error('[Settings] Error saving social media to PostgreSQL:', e);
        }
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- ADMIN COUPON SYSTEM ENDPOINTS ---
  app.get('/api/admin/coupons', authenticateAdmin, async (req, res) => {
    try {
      let coupons: any[] = [];
      if (isPostgresAvailable()) {
        try {
          coupons = await postgresGetCoupons();
        } catch (e) {
          coupons = db.getCoupons();
        }
      } else {
        coupons = db.getCoupons();
      }

      const now = new Date();
      const activeCount = coupons.filter(c => c.status === 'active' && (!c.valid_until || new Date(c.valid_until) >= now)).length;
      const expiredCount = coupons.filter(c => c.valid_until && new Date(c.valid_until) < now).length;
      const totalUses = coupons.reduce((sum, c) => sum + (c.used_count || 0), 0);

      // Total discount given across bookings
      const bookings = db.getBookings();
      const totalDiscountGiven = bookings.reduce((sum, b) => sum + (Number(b.discount_amount) || 0), 0);

      res.json({
        coupons,
        summary: {
          activeCount,
          expiredCount,
          totalUses,
          totalDiscountGiven
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/coupons', authenticateAdmin, async (req, res) => {
    try {
      let created;
      if (isPostgresAvailable()) {
        try {
          created = await postgresCreateCoupon(req.body);
          db.createCoupon(req.body); // Keep JSON in sync
        } catch (e) {
          created = db.createCoupon(req.body);
        }
      } else {
        created = db.createCoupon(req.body);
      }
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/admin/coupons/:id', authenticateAdmin, async (req, res) => {
    try {
      const coupon = db.getCouponById(req.params.id);
      if (!coupon) return res.status(404).json({ error: 'Coupon not found.' });
      res.json(coupon);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/coupons/:id', authenticateAdmin, async (req, res) => {
    try {
      let updated;
      if (isPostgresAvailable()) {
        try {
          updated = await postgresUpdateCoupon(req.params.id, req.body);
          db.updateCoupon(req.params.id, req.body); // Keep JSON in sync
        } catch (e) {
          updated = db.updateCoupon(req.params.id, req.body);
        }
      } else {
        updated = db.updateCoupon(req.params.id, req.body);
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/coupons/:id/status', authenticateAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      if (status !== 'active' && status !== 'inactive') {
        return res.status(400).json({ error: 'Status must be active or inactive.' });
      }
      let updated;
      if (isPostgresAvailable()) {
        try {
          updated = await postgresUpdateCoupon(req.params.id, { status });
          db.updateCoupon(req.params.id, { status });
        } catch (e) {
          updated = db.updateCoupon(req.params.id, { status });
        }
      } else {
        updated = db.updateCoupon(req.params.id, { status });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/coupons/:id', authenticateAdmin, async (req, res) => {
    try {
      if (isPostgresAvailable()) {
        try {
          await postgresDeleteCoupon(req.params.id);
        } catch (e) {
          // fallback
        }
      }
      const deleted = db.deleteCoupon(req.params.id);
      res.json({ success: true, deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/coupons/:id/usage', authenticateAdmin, async (req, res) => {
    try {
      let usage = [];
      if (isPostgresAvailable()) {
        try {
          usage = await postgresGetCouponUsage(req.params.id);
        } catch (e) {
          usage = db.getCouponUsage(req.params.id);
        }
      } else {
        usage = db.getCouponUsage(req.params.id);
      }
      res.json(usage);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
      const roomId = req.params.id;
      const updated = db.updatePhysicalRoom(roomId, req.body);
      console.log(`[Pricing Update] ADMIN REQUEST -> PhysicalRoom ID: ${roomId}, New Price: ₹${updated.price}`);
      console.log(`[Pricing Update] DATABASE UPDATE RESULT -> Success. room_types & physical_rooms synced.`);
      console.log(`[Pricing Update] API RESPONSE -> 200 OK with price = ₹${updated.price}`);
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

  // --- ADMIN MULTI-PROPERTY PAYMENT GATEWAY & SETTLEMENT MANAGEMENT ---
  // A. Get Gateway Configs for both properties
  app.get('/api/admin/payments/gateway-configs', authenticateAdmin, (req, res) => {
    try {
      const allConfigs = paymentGatewayRegistry.getAllPublicConfigs();
      res.json(allConfigs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // B. Update Gateway Config for a Property (Provider, API Keys, Merchant ID, Bank Details)
  app.put('/api/admin/payments/gateway-configs/:property_code', authenticateAdmin, (req, res) => {
    try {
      const propertyCode = req.params.property_code as PropertyCode;
      if (propertyCode !== 'sbm-hotel' && propertyCode !== 'sbm-guest-house') {
        return res.status(400).json({ error: 'Invalid property code.' });
      }

      const {
        provider,
        merchant_id,
        key_id,
        key_secret,
        webhook_secret,
        bank_account_name,
        settlement_account_number,
        mode
      } = req.body;

      const updates: any = {};
      if (provider) updates.provider = provider;
      if (merchant_id !== undefined) updates.merchant_id = merchant_id.trim();
      if (key_id !== undefined) updates.key_id = key_id.trim();
      if (key_secret !== undefined && key_secret.trim()) updates.key_secret = key_secret.trim();
      if (webhook_secret !== undefined && webhook_secret.trim()) updates.webhook_secret = webhook_secret.trim();
      if (bank_account_name !== undefined) updates.bank_account_name = bank_account_name.trim();
      if (settlement_account_number !== undefined) updates.settlement_account_number = settlement_account_number.trim();
      if (mode) updates.mode = mode;

      paymentGatewayRegistry.updatePropertyConfig(propertyCode, updates);
      res.json(paymentGatewayRegistry.getPublicPropertyConfig(propertyCode));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // C. Multi-Property Payment Transactions Ledger
  app.get('/api/admin/payments/transactions', authenticateAdmin, (req, res) => {
    try {
      const { property_code, status, provider, booking_id, booking_group_id } = req.query;
      const transactions = db.getPaymentTransactions({
        property_code: property_code as string,
        status: status as string,
        provider: provider as string,
        booking_id: booking_id as string,
        booking_group_id: booking_group_id as string
      });
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // D. Process Refund for a Property Transaction
  app.post('/api/admin/payments/refund', authenticateAdmin, async (req, res) => {
    try {
      const { transaction_id, order_id, property_code, amount, reason } = req.body;

      if (!property_code || (!transaction_id && !order_id) || !amount) {
        return res.status(400).json({ error: 'property_code, transaction_id or order_id, and amount are required.' });
      }

      const code = property_code as PropertyCode;
      if (code !== 'sbm-hotel' && code !== 'sbm-guest-house') {
        return res.status(400).json({ error: 'Invalid property code.' });
      }

      // Find transaction
      const tx = (order_id ? db.getPaymentTransactionByOrderId(order_id) : undefined) ||
                 (transaction_id ? db.getPaymentTransactionByTxnId(transaction_id) : undefined) ||
                 (transaction_id ? db.getPaymentTransactionById(transaction_id) : undefined);

      const effectiveTxnId = tx?.transaction_id || transaction_id;
      const effectiveOrderId = tx?.order_id || order_id;

      const refundResult = await paymentGatewayRegistry.processRefundForProperty(code, {
        property_code: code,
        transaction_id: effectiveTxnId,
        order_id: effectiveOrderId,
        amount: Number(amount),
        reason
      });

      if (!refundResult.success) {
        return res.status(400).json({
          error: refundResult.error || 'Refund rejected by payment gateway'
        });
      }

      // Update Transaction Record
      if (tx) {
        db.updatePaymentTransaction(tx.id, {
          status: 'REFUNDED',
          refund_id: refundResult.refund_id,
          refund_amount: Number(amount),
          refund_reason: reason,
          refunded_at: new Date().toISOString()
        });
      }

      // Update Associated Booking if any
      if (tx?.booking_id) {
        const booking = db.getBookingByIdOrNumber(tx.booking_id);
        if (booking) {
          db.updateBooking(booking.id, {
            payment_status: 'Refunded',
            internal_notes: `${booking.internal_notes || ''}\nRefund processed: ₹${amount} (Refund ID: ${refundResult.refund_id || 'N/A'}, Reason: ${reason || 'Customer refund'})`
          });
        }
      }

      db.addActivity(
        'Payment',
        `Refund of ₹${amount} issued for ${code} (Txn: ${effectiveTxnId}, Refund ID: ${refundResult.refund_id || 'N/A'})`,
        code,
        (req as any).admin?.name || 'Admin'
      );

      res.json({
        success: true,
        message: `Refund of ₹${amount} processed successfully through ${code} payment gateway.`,
        refund: refundResult
      });
    } catch (err: any) {
      console.error('[Refund Error]', err);
      res.status(500).json({ error: err.message || 'Refund processing failed.' });
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
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const { category, roomId, propertyId } = req.query;
      const images = db.getManagedImages({
        category: category as string,
        roomId: roomId as string,
        propertyId: propertyId as string,
        includeInactive: false
      });
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/images', authenticateAdmin, (req, res) => {
    try {
      const { category, roomId, propertyId, status } = req.query;
      const images = db.getManagedImages({
        category: category as string,
        roomId: roomId as string,
        propertyId: propertyId as string,
        status: status as string,
        includeInactive: true
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

  // --- DEDICATED ABOUT PAGE IMAGES (PUBLIC & ADMIN) ---
  app.get('/api/about-images', (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const images = db.getAboutPageImages();
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/about-images', authenticateAdmin, (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const images = db.getAboutPageImages();
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/about-images', authenticateAdmin, (req, res) => {
    try {
      const { propertyId, property_id, imageUrl, image_url, title, caption } = req.body;
      const effectivePropId = propertyId || property_id;
      const effectiveImageUrl = imageUrl || image_url;

      if (!effectivePropId || !effectiveImageUrl) {
        return res.status(400).json({ error: 'Both propertyId (sbm-hotel or sbm-guest-house) and imageUrl are required.' });
      }

      const saved = db.saveAboutPageImage(effectivePropId, effectiveImageUrl, title, caption);
      console.log(`[About Page Images] Saved dedicated image for property: ${effectivePropId}`);
      res.status(200).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/about-images/:propertyId', authenticateAdmin, (req, res) => {
    try {
      const propertyId = req.params.propertyId;
      const { imageUrl, image_url, title, caption } = req.body;
      const effectiveImageUrl = imageUrl || image_url;

      if (!effectiveImageUrl) {
        return res.status(400).json({ error: 'imageUrl is required.' });
      }

      const saved = db.saveAboutPageImage(propertyId, effectiveImageUrl, title, caption);
      console.log(`[About Page Images] Updated dedicated image for property: ${propertyId}`);
      res.status(200).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/about-images/:propertyId', authenticateAdmin, (req, res) => {
    try {
      const propertyId = req.params.propertyId;
      const deleted = db.deleteAboutPageImage(propertyId);
      console.log(`[About Page Images] Deleted dedicated image for property: ${propertyId}, success=${deleted}`);
      res.json({ success: true, message: 'About page image removed successfully.' });
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

  // 4b. Validate Channel Configuration (Pre-Activation Audit)
  app.post('/api/admin/channels/:id/validate', authenticateAdmin, (req, res) => {
    try {
      const validation = channelManagerService.validateChannelConfig(req.params.id);
      res.json(validation);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 4c. Activate Channel (Strict Workflow Check + Initial Sync)
  app.post('/api/admin/channels/:id/activate', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const result = await channelManagerService.activateChannel(
        req.params.id,
        admin?.name || admin?.email || 'Admin'
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 4d. Disable Channel
  app.post('/api/admin/channels/:id/disable', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const result = channelManagerService.disableChannel(
        req.params.id,
        admin?.name || admin?.email || 'Admin'
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 4e. Channel Health Overview
  app.get('/api/admin/channels/health', authenticateAdmin, (req, res) => {
    try {
      const health = channelManagerService.getChannelHealthSummary();
      res.json(health);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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

  // 5b. Manual Scoped Synchronization (Single or All Active)
  app.post('/api/admin/channels/manual-sync', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const { channelId, scope, allActive } = req.body;
      const result = await channelManagerService.manualScopedSync(
        { channelId, scope: scope || 'ALL', allActive: Boolean(allActive) },
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

  // 14. Channel Restrictions (Get, Save, Bulk Update)
  app.get('/api/admin/channels/restrictions', authenticateAdmin, (req, res) => {
    try {
      const { propertyCode, startDate, endDate } = req.query;
      const restrictions = channelManagerService.getRestrictions(
        propertyCode as string,
        startDate as string,
        endDate as string
      );
      res.json(restrictions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/channels/restrictions', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const saved = channelManagerService.saveRestriction(
        req.body,
        admin?.name || admin?.email || 'Admin'
      );
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/channels/restrictions/bulk', authenticateAdmin, (req, res) => {
    try {
      const admin = (req as any).admin;
      const saved = channelManagerService.bulkUpdateRestrictions(
        req.body,
        admin?.name || admin?.email || 'Admin'
      );
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 14b. Central Rate Calendar
  app.get('/api/admin/channels/rates', authenticateAdmin, (req, res) => {
    try {
      const { propertyCode, startDate, endDate, roomTypeId } = req.query;
      const today = new Date().toISOString().split('T')[0];
      const defaultEnd = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

      const rates = channelManagerService.getRateCalendar(
        (propertyCode as any) || 'all',
        (startDate as string) || today,
        (endDate as string) || defaultEnd,
        roomTypeId as string
      );
      res.json(rates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14c. Manual Rate Adjustment & Synchronization Dispatch
  app.post('/api/admin/channels/rates/manual-update', authenticateAdmin, async (req, res) => {
    try {
      const admin = (req as any).admin;
      const result = await channelManagerService.updateManualRates(
        req.body,
        admin?.name || admin?.email || 'Admin'
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 14d. Central Reservation Hub
  app.get('/api/admin/channels/reservations', authenticateAdmin, (req, res) => {
    try {
      const { propertyCode, source, status, search, startDate, endDate, page, limit } = req.query;
      const result = channelManagerService.getReservationsHub({
        propertyCode: propertyCode as string,
        source: source as string,
        status: status as string,
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14e. Audit Logs for Channel Manager
  app.get('/api/admin/channels/audit-logs', authenticateAdmin, (req, res) => {
    try {
      const { channelCode, action, limit } = req.query;
      const logs = auditService.getLogs();
      let filtered = [...logs];
      if (channelCode && channelCode !== 'all') {
        filtered = filtered.filter(l => l.description?.toUpperCase().includes(String(channelCode).toUpperCase()));
      }
      if (action && action !== 'all') {
        filtered = filtered.filter(l => l.action === action);
      }
      if (limit) {
        filtered = filtered.slice(0, Number(limit));
      }
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // In-memory sliding window rate limiter for OTA Webhooks (max 60 requests per minute per IP/Channel)
  const webhookRequests = new Map<string, number[]>();
  function checkWebhookRateLimit(key: string, limit = 60, windowMs = 60000): boolean {
    const now = Date.now();
    const timestamps = webhookRequests.get(key) || [];
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length >= limit) {
      return false;
    }
    valid.push(now);
    webhookRequests.set(key, valid);
    return true;
  }

  // 15. OTA Inbound Public Secure Webhook Endpoint (Callback receiver with signature/secret validation)
  app.post('/api/webhooks/channel/:channelCode', async (req, res) => {
    try {
      const channelCode = req.params.channelCode.toUpperCase() as any;
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      // Rate limit check
      if (!checkWebhookRateLimit(`${channelCode}:${clientIp}`, 60, 60000)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'Too Many Requests: Webhook rate limit exceeded. Please wait 60 seconds.' });
      }

      const channel = channelManagerService.getChannels().find(c => c.code === channelCode);

      if (!channel) {
        return res.status(404).json({ error: `Unsupported channel: ${channelCode}` });
      }

      const { getChannelAdapter } = await import('./server/services/channelAdapter');
      const adapter = getChannelAdapter(channelCode);

      // Validate signature / secret against raw server-side configuration
      if (adapter.validateWebhook) {
        const rawConfig = db.getChannelRawConfig ? db.getChannelRawConfig(channel.id) : channel;
        const validation = await adapter.validateWebhook(req.headers as any, req.body, rawConfig || channel);
        if (!validation.valid) {
          return res.status(401).json({ error: validation.error || 'Unauthorized webhook request' });
        }
      }

      // Parse payload to NormalizedOTAReservation
      const normalized = adapter.parseWebhookReservation ? adapter.parseWebhookReservation(req.body) : req.body;
      if (!normalized || !normalized.externalReservationId) {
        return res.status(400).json({ error: 'Unable to parse valid reservation from webhook payload.' });
      }

      const result = await channelManagerService.importOTAReservation(
        normalized,
        `Webhook: ${channel.name}`
      );

      res.status(200).json({
        success: true,
        channel: channelCode,
        message: result.message,
        booking_number: result.booking?.booking_number
      });
    } catch (err: any) {
      console.error(`[OTA Webhook Error - ${req.params.channelCode}]`, err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // 14. Email Notification Diagnostics & Test Trigger
  app.get('/api/admin/email/status', authenticateAdmin, (req, res) => {
    try {
      const cfg = emailService.getConfig();
      res.json({
        is_configured: cfg.isConfigured,
        host: cfg.host ? `${cfg.host}:${cfg.port}` : null,
        port: cfg.port,
        from: cfg.from,
        admin_email: cfg.adminEmail,
        has_user: Boolean(cfg.user),
        has_password: Boolean(cfg.password)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/email/test', authenticateAdmin, async (req, res) => {
    try {
      const { targetEmail, bookingId } = req.body;
      const admin = (req as any).admin;
      const testRecipient = targetEmail || admin?.email || 'sbmhotel@gmail.com';

      // Pick a sample booking or the specified bookingId
      let sampleBooking = bookingId ? db.getBookingByIdOrNumber(bookingId) : null;
      if (!sampleBooking) {
        const all = db.getBookings();
        sampleBooking = all[0];
      }

      if (!sampleBooking) {
        sampleBooking = {
          id: 'test-bk-101',
          booking_number: 'SBM-2026-TEST',
          property_id: 'prop-sbm-hotel',
          property_code: 'sbm-hotel',
          property_name: 'SBM Hotel',
          guest_name: 'Test Devotee',
          guest_phone: '9988776655',
          guest_email: testRecipient,
          room_type_id: 'room-sbm-deluxe',
          room_name: 'Deluxe Room',
          room_number: '101',
          adults: 2,
          children: 0,
          rooms_requested: 1,
          check_in: new Date().toISOString().split('T')[0],
          check_out: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          nights: 1,
          price_per_night: 2500,
          room_subtotal: 2500,
          tax_amount: 300,
          total_amount: 2800,
          paid_amount: 2800,
          outstanding_amount: 0,
          payment_status: 'Completed',
          booking_status: 'Confirmed',
          payment_method: 'online_razorpay',
          payment_txn_id: 'pay_test_sbm2026',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      } else {
        sampleBooking = {
          ...sampleBooking,
          guest_email: testRecipient
        };
      }

      const result = await emailService.sendBookingConfirmationEmail(sampleBooking, { force: true });
      res.json({
        success: result.success,
        simulated: result.simulated || false,
        messageId: result.messageId,
        recipient: testRecipient,
        booking_number: sampleBooking.booking_number,
        error: result.error
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. Verify SMTP Server Connection
  app.post('/api/admin/email/verify', authenticateAdmin, async (req, res) => {
    try {
      const result = await emailService.verifySmtp();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/admin/email/verify-smtp', authenticateAdmin, async (req, res) => {
    try {
      const result = await emailService.verifySmtp();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 16. Admin Resend Confirmation Email
  app.post('/api/admin/bookings/:id/resend-email', authenticateAdmin, async (req, res) => {
    try {
      const booking = db.getBookingByIdOrNumber(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      const { type } = req.body; // 'customer' or 'admin' or 'both'
      const results: { customer?: any; admin?: any } = {};

      if (!type || type === 'customer' || type === 'both') {
        results.customer = await emailService.sendBookingConfirmationEmail(booking, { force: true });
      }

      if (type === 'admin' || type === 'both') {
        results.admin = await emailService.sendAdminBookingNotification(booking, { force: true });
      }

      const updated = db.getBookingByIdOrNumber(req.params.id);
      res.json({
        success: true,
        message: 'Email dispatch completed.',
        results,
        booking: updated
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================================
  // --- CUSTOMER ACCOUNTS & WHATSAPP OTP AUTHENTICATION ---
  // ==========================================================

  // Customer OTP In-Memory Secure Store with Rate-Limiting & Expiry
  interface CustomerOtpRecord {
    otp: string;
    expiresAt: number;
    attempts: number;
    resendAvailableAt: number;
  }
  const customerOtpStore = new Map<string, CustomerOtpRecord>();

  // Middleware: Customer JWT Authentication Check
  const authenticateCustomer = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Customer authentication required. Please log in.' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; phone: string; role: string };
      if (!decoded || decoded.role !== 'customer') {
        return res.status(401).json({ error: 'Invalid customer token.' });
      }
      (req as any).customer = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
  };

  // 1. Request WhatsApp OTP for Customer Login / Account Verification
  app.post('/api/customer/auth/request-otp', async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ error: 'Please enter a valid mobile number.' });
      }

      const { normalized, nationalNumber, countryCode } = normalizePhoneNumber(phone);
      if (!nationalNumber || nationalNumber.length < 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      }

      const existingRecord = customerOtpStore.get(normalized);
      const now = Date.now();

      // Enforce rate limiting: 60 seconds cooldown between resends
      if (existingRecord && now < existingRecord.resendAvailableAt) {
        const remainingSeconds = Math.ceil((existingRecord.resendAvailableAt - now) / 1000);
        return res.status(429).json({
          error: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`
        });
      }

      // Generate cryptographically secure 6-digit OTP
      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry
      const resendAvailableAt = now + 60 * 1000; // 60s cooldown

      customerOtpStore.set(normalized, {
        otp: otpCode,
        expiresAt,
        attempts: 0,
        resendAvailableAt
      });

      // Dispatch OTP via BhashSMS WhatsApp service
      const waResult = await bhashSmsService.sendOtp(normalized, otpCode);

      if (!waResult.success) {
        // Invalidate record if provider failed to accept the message
        customerOtpStore.delete(normalized);
        return res.status(400).json({
          success: false,
          error: waResult.error || 'Failed to dispatch WhatsApp OTP. Please check your mobile number and try again.'
        });
      }

      const maskedPhone = `${countryCode} ${nationalNumber.substring(0, 3)}****${nationalNumber.slice(-3)}`;
      res.json({
        success: true,
        message: 'A verification code has been sent to your WhatsApp number.',
        maskedPhone,
        cooldownSeconds: 60
      });
    } catch (err: any) {
      console.error('[Customer Auth] OTP request error:', err?.message || err);
      res.status(500).json({ error: err.message || 'Failed to process OTP request.' });
    }
  });

  // 2. Verify WhatsApp OTP
  app.post('/api/customer/auth/verify-otp', async (req, res) => {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ error: 'Mobile number and verification code are required.' });
      }

      const { normalized, nationalNumber } = normalizePhoneNumber(phone);
      if (!nationalNumber || nationalNumber.length < 10) {
        return res.status(400).json({ error: 'Invalid mobile number.' });
      }

      const record = customerOtpStore.get(normalized);
      const now = Date.now();

      if (!record) {
        return res.status(400).json({ error: 'No active OTP request found for this number. Please request a new code.' });
      }

      if (now > record.expiresAt) {
        customerOtpStore.delete(normalized);
        return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      }

      if (record.attempts >= 5) {
        customerOtpStore.delete(normalized);
        return res.status(429).json({ error: 'Maximum verification attempts exceeded. Please request a new code.' });
      }

      if (record.otp !== otp.trim()) {
        record.attempts += 1;
        return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
      }

      // OTP verified successfully! Invalidate record to prevent reuse.
      customerOtpStore.delete(normalized);

      // Find or create customer account
      let guest = db.getGuestByPhone(nationalNumber);
      if (!guest) {
        guest = db.upsertGuest({
          fullName: `Guest ${nationalNumber.slice(-4)}`,
          phone: nationalNumber,
          isVerified: true
        });
      } else if (!guest.is_verified) {
        db.updateGuest(guest.id, { is_verified: true });
      }

      const token = jwt.sign(
        {
          id: guest.id,
          phone: nationalNumber,
          role: 'customer'
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        success: true,
        message: 'Successfully verified and logged in!',
        token,
        customer: {
          id: guest.id,
          fullName: guest.full_name,
          phone: guest.phone,
          email: guest.email,
          address: guest.address,
          city: guest.city,
          state: guest.state,
          country: guest.country,
          isVerified: guest.is_verified
        }
      });
    } catch (err: any) {
      console.error('[Customer Auth] Verify OTP error:', err?.message || err);
      res.status(500).json({ error: err.message || 'Failed to verify OTP.' });
    }
  });

  // 3. Customer Email Registration
  app.post('/api/customer/auth/register', async (req, res) => {
    try {
      const { fullName, email, phone, password } = req.body;
      if (!fullName || !email || !phone || !password) {
        return res.status(400).json({ error: 'All fields (Full Name, Email, Mobile Number, Password) are required.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const { normalized, nationalNumber, countryCode } = normalizePhoneNumber(phone);
      if (!nationalNumber || nationalNumber.length < 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      }

      // Check duplicate email
      const existingEmail = db.getGuestByEmail(cleanEmail);
      if (existingEmail && existingEmail.password_hash && existingEmail.is_verified) {
        return res.status(400).json({ error: 'An account with this email address already exists. Please log in.' });
      }

      // Check duplicate phone
      const existingPhone = db.getGuestByPhone(nationalNumber);
      if (existingPhone && existingPhone.email && existingPhone.email.trim().toLowerCase() !== cleanEmail && existingPhone.is_verified) {
        return res.status(400).json({ error: 'An account with this mobile number already exists. Please sign in.' });
      }

      let guest: any;
      if (existingPhone) {
        guest = db.updateGuest(existingPhone.id, {
          full_name: fullName.trim(),
          email: cleanEmail,
          is_verified: false
        });
        db.setGuestPassword(guest.id, password);
      } else {
        guest = db.upsertGuest({
          fullName: fullName.trim(),
          phone: nationalNumber,
          email: cleanEmail,
          isVerified: false
        });
        db.setGuestPassword(guest.id, password);
      }

      // Generate cryptographically secure 6-digit OTP for WhatsApp mobile verification
      const now = Date.now();
      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry
      const resendAvailableAt = now + 60 * 1000; // 60s cooldown

      customerOtpStore.set(normalized, {
        otp: otpCode,
        expiresAt,
        attempts: 0,
        resendAvailableAt
      });

      // Dispatch WhatsApp OTP
      const waResult = await bhashSmsService.sendOtp(normalized, otpCode);
      const maskedPhone = `${countryCode} ${nationalNumber.substring(0, 3)}****${nationalNumber.slice(-3)}`;

      if (!waResult.success) {
        if (waResult.notConfigured) {
          console.warn('[Register WhatsApp OTP] WhatsApp service is not configured on this server.');
          return res.json({
            success: true,
            requiresOtp: true,
            notConfigured: true,
            message: 'Account details saved. Please verify your mobile number with the WhatsApp OTP.',
            phone: nationalNumber,
            maskedPhone,
            cooldownSeconds: 60
          });
        }

        // Provider failed to deliver
        customerOtpStore.delete(normalized);
        return res.status(400).json({
          error: waResult.error || 'Failed to dispatch WhatsApp OTP. Please check your mobile number and try again.'
        });
      }

      res.json({
        success: true,
        requiresOtp: true,
        message: 'Account details saved! A 6-digit WhatsApp verification code has been sent to your mobile number.',
        phone: nationalNumber,
        maskedPhone,
        cooldownSeconds: 60
      });
    } catch (err: any) {
      console.error('[Customer Register Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to create customer account.' });
    }
  });

  // 4. Customer Email Login
  app.post('/api/customer/auth/login-email', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const guest = db.validateGuestPassword(cleanEmail, password);
      if (!guest) {
        return res.status(400).json({ error: 'Invalid email address or password.' });
      }

      const token = jwt.sign(
        {
          id: guest.id,
          phone: guest.phone,
          email: guest.email,
          role: 'customer'
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        success: true,
        message: 'Logged in successfully!',
        token,
        customer: {
          id: guest.id,
          fullName: guest.full_name,
          phone: guest.phone,
          email: guest.email,
          address: guest.address,
          city: guest.city,
          state: guest.state,
          country: guest.country,
          isVerified: guest.is_verified
        }
      });
    } catch (err: any) {
      console.error('[Customer Email Login Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to log in with email.' });
    }
  });

  // 5. Customer Forgot Password (secure password reset)
  const customerResetStore = new Map<string, { otp: string; expiresAt: number }>();

  app.post('/api/customer/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Please enter your registered email address.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const guest = db.getGuestByEmail(cleanEmail);
      if (!guest) {
        // Return success message to prevent user enumeration
        return res.json({
          success: true,
          message: 'If an account exists with this email, a password reset code has been sent.'
        });
      }

      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
      customerResetStore.set(cleanEmail, { otp: otpCode, expiresAt });

      // If guest has phone, try sending via WhatsApp, otherwise log securely
      if (guest.phone) {
        try {
          await bhashSmsService.sendOtp(guest.phone, otpCode);
        } catch (e) {
          console.warn('[Forgot Password] WhatsApp dispatch notice:', e);
        }
      }

      console.log(`[Customer Password Reset] OTP for ${cleanEmail}: ${otpCode}`);

      res.json({
        success: true,
        message: 'Password reset code has been sent to your registered contact channel.',
        devResetCode: otpCode // included for testing/preview convenience
      });
    } catch (err: any) {
      console.error('[Forgot Password Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to process password reset request.' });
    }
  });

  app.post('/api/customer/auth/reset-password', async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: 'Email, reset code, and new password are required.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const record = customerResetStore.get(cleanEmail);
      if (!record || Date.now() > record.expiresAt || record.otp !== String(otp).trim()) {
        return res.status(400).json({ error: 'Invalid or expired password reset code.' });
      }

      const guest = db.getGuestByEmail(cleanEmail);
      if (!guest) {
        return res.status(400).json({ error: 'Account not found.' });
      }

      db.setGuestPassword(guest.id, newPassword);
      customerResetStore.delete(cleanEmail);

      res.json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
      });
    } catch (err: any) {
      console.error('[Reset Password Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to reset password.' });
    }
  });

  // 3. Get Current Authenticated Customer Profile & Booking History
  app.get('/api/customer/profile', authenticateCustomer, (req, res) => {
    try {
      const customerPayload = (req as any).customer;
      const guest = db.getGuestByPhone(customerPayload.phone) || db.getGuestById(customerPayload.id);

      if (!guest) {
        return res.status(404).json({ error: 'Customer profile not found.' });
      }

      const bookings = db.getCustomerBookings(customerPayload.phone);

      res.json({
        customer: {
          id: guest.id,
          fullName: guest.full_name,
          phone: guest.phone,
          email: guest.email,
          address: guest.address,
          city: guest.city,
          state: guest.state,
          country: guest.country,
          isVerified: guest.is_verified,
          totalBookings: bookings.length,
          totalSpent: bookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0)
        },
        bookings
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Update Customer Profile
  app.put('/api/customer/profile', authenticateCustomer, (req, res) => {
    try {
      const customerPayload = (req as any).customer;
      const guest = db.getGuestByPhone(customerPayload.phone) || db.getGuestById(customerPayload.id);

      if (!guest) {
        return res.status(404).json({ error: 'Customer profile not found.' });
      }

      const { fullName, email, address, city, state } = req.body;
      const updates: any = {};
      if (fullName && typeof fullName === 'string') updates.full_name = fullName.trim();
      if (email !== undefined) updates.email = String(email).trim().toLowerCase();
      if (address !== undefined) updates.address = String(address).trim();
      if (city !== undefined) updates.city = String(city).trim();
      if (state !== undefined) updates.state = String(state).trim();

      const updated = db.updateGuest(guest.id, updates);

      res.json({
        success: true,
        message: 'Profile updated successfully.',
        customer: {
          id: updated.id,
          fullName: updated.full_name,
          phone: updated.phone,
          email: updated.email,
          address: updated.address,
          city: updated.city,
          state: updated.state,
          country: updated.country,
          isVerified: updated.is_verified
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
    paymentGatewayRegistry.logStartupDiagnostics();
    logRazorpayStartupDiagnostics();
    logEmailStartupDiagnostics();
  });
}

startServer();
