import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';

let pool: Pool | null = null;
let isPostgresConnected = false;

export function isPostgresAvailable(): boolean {
  return isPostgresConnected && pool !== null;
}

export function getPostgresPool(): Pool | null {
  return pool;
}

export async function initializePostgres(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ℹ️ [SBM Hotel PMS] DATABASE_URL not set in environment.');
    console.log('ℹ️ Running in DEVELOPMENT FALLBACK mode with structured JSON DB.');
    console.log('ℹ️ All PMS Services (Locking, Calendar, Front Desk, Walk-In)');
    console.log('   are fully active with high-performance local transactions.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return false;
  }

  try {
    console.log('🔌 [SBM Hotel PMS] Connecting to PostgreSQL database...');
    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
      const res = await client.query('SELECT NOW() as current_time, current_database() as db_name');
      console.log(`✅ [SBM Hotel PMS] Connected to PostgreSQL [${res.rows[0].db_name}] at ${res.rows[0].current_time}`);
      isPostgresConnected = true;

      // Run Schema Migration
      await runSchemaMigration(client);

      // Run Initial JSON Seed / Data Migration if tables are empty
      await runDataMigrationFromJSON(client);
    } finally {
      client.release();
    }
    return true;
  } catch (err: any) {
    console.error('❌ [SBM Hotel PMS] PostgreSQL Connection Failed:', err.message);
    console.warn('⚠️ [SBM Hotel PMS] Falling back to structured JSON development storage.');
    isPostgresConnected = false;
    pool = null;
    return false;
  }
}

async function runSchemaMigration(client: PoolClient) {
  try {
    const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('✅ [SBM Hotel PMS] PostgreSQL schema verified & tables ensured.');
    }
  } catch (err: any) {
    console.error('❌ [SBM Hotel PMS] Error running schema migration:', err.message);
  }
}

async function runDataMigrationFromJSON(client: PoolClient) {
  try {
    const propCountRes = await client.query('SELECT COUNT(*) FROM properties');
    const propertyCount = parseInt(propCountRes.rows[0].count, 10);

   const DATA_DIR = process.env.SBM_DATA_DIR
  ? path.resolve(process.env.SBM_DATA_DIR)
  : path.resolve(process.cwd(), 'data');

const jsonPath = path.join(DATA_DIR, 'sbm_database.json');
if (!fs.existsSync(jsonPath)) return;

    if (propertyCount > 0) {
      console.log(`ℹ️ [SBM Hotel PMS Migration] PostgreSQL already contains ${propertyCount} properties. Checking sync...`);
      return;
    }

    console.log('🔄 [SBM Hotel PMS Migration] Importing existing JSON data into PostgreSQL...');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(rawData);

    await client.query('BEGIN');

    // 1. Properties
    let importedProps = 0;
    if (Array.isArray(data.properties)) {
      for (const p of data.properties) {
        await client.query(`
          INSERT INTO properties (id, code, name, tagline, description, address, phone, landline, email, images, amenities, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          p.id,
          p.code,
          p.name,
          p.tagline || '',
          p.description || '',
          p.address || '',
          p.phone || '',
          p.landline || '',
          p.email || '',
          JSON.stringify(p.images || []),
          JSON.stringify(p.amenities || []),
          p.status || 'active'
        ]);
        importedProps++;
      }
    }

    // 2. Room Types & Rate Plans
    let importedRoomTypes = 0;
    if (Array.isArray(data.room_types)) {
      for (const rt of data.room_types) {
        await client.query(`
          INSERT INTO room_types (id, property_id, property_code, room_code, name, description, capacity, bed_information, amenities, price_per_night, tax_percent, total_rooms, images, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING
        `, [
          rt.id,
          rt.property_id,
          rt.property_code,
          rt.room_code,
          rt.name,
          rt.description || '',
          rt.capacity || 2,
          rt.bed_information || '',
          JSON.stringify(rt.amenities || []),
          rt.price_per_night,
          rt.tax_percent || 12,
          rt.total_rooms || 10,
          JSON.stringify(rt.images || []),
          rt.status || 'active'
        ]);

        // Default Rate Plan
        await client.query(`
          INSERT INTO rate_plans (id, property_id, room_type_id, name, code, meal_plan, base_price, cancellation_policy, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          `rate-${rt.id}`,
          rt.property_id,
          rt.id,
          `${rt.name} - Room Only (EP)`,
          'EP-STD',
          'EP',
          rt.price_per_night,
          'Free cancellation up to 24 hours prior to standard check-in time.',
          true
        ]);
        importedRoomTypes++;
      }
    }

    // 3. Physical Rooms
    let importedRooms = 0;
    if (Array.isArray(data.physical_rooms)) {
      for (const r of data.physical_rooms) {
        const opStatus = r.status === 'Maintenance' ? 'OUT_OF_ORDER' : (r.status === 'Blocked' ? 'BLOCKED' : 'AVAILABLE');
        await client.query(`
          INSERT INTO rooms (id, property_id, property_code, room_type_id, room_code, room_name, room_number, floor, operational_status, housekeeping_status, maintenance_reason, active, facilities, images, max_guests, bed_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING
        `, [
          r.id,
          r.property_code === 'sbm-guest-house' ? 'prop-sbm-guesthouse' : 'prop-sbm-hotel',
          r.property_code,
          r.room_type_id,
          r.room_code,
          r.room_name,
          r.room_number,
          r.floor || 'Ground Floor',
          opStatus,
          'CLEAN',
          r.maintenance_reason || null,
          true,
          JSON.stringify(r.facilities || []),
          JSON.stringify(r.images || []),
          r.max_guests || 2,
          r.bed_type || ''
        ]);
        importedRooms++;
      }
    }

    // 4. Admins
    let importedAdmins = 0;
    if (Array.isArray(data.admins)) {
      for (const adm of data.admins) {
        const hash = data.admin_passwords?.[adm.id] || '$2a$10$w0u3rI4rN1Zc17qV3xR63eWv8rYQ2rJ7C/X/E5a3dG2yT1f0k.78y';
        await client.query(`
          INSERT INTO admins (id, name, email, password_hash, role)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [adm.id, adm.name, adm.email, hash, adm.role || 'frontdesk']);
        importedAdmins++;
      }
    }

    // 5. Bookings -> Reservations & Guests & Payments
    let importedBookings = 0;
    if (Array.isArray(data.bookings)) {
      for (const b of data.bookings) {
        // Guest record
        const guestId = `guest-${b.guest_phone.replace(/[^0-9]/g, '').slice(-10) || Math.random().toString(36).substring(7)}`;
        await client.query(`
          INSERT INTO guests (id, full_name, phone, email, country)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name
        `, [guestId, b.guest_name, b.guest_phone, b.guest_email || '', 'India']);

        // Reservation
        await client.query(`
          INSERT INTO reservations (id, booking_number, property_id, property_code, property_name, guest_id, guest_name, guest_phone, guest_email, source, room_type_id, room_name, room_number, check_in, check_out, adults, children, rooms_count, nights, status, price_per_night, subtotal, tax, total_amount, payment_status, payment_method, special_requests, internal_notes, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
          ON CONFLICT (id) DO NOTHING
        `, [
          b.id,
          b.booking_number,
          b.property_id || (b.property_code === 'sbm-guest-house' ? 'prop-sbm-guesthouse' : 'prop-sbm-hotel'),
          b.property_code,
          b.property_name,
          guestId,
          b.guest_name,
          b.guest_phone,
          b.guest_email || '',
          b.booking_source || 'WEBSITE',
          b.room_type_id,
          b.room_name,
          b.room_number || null,
          b.check_in,
          b.check_out,
          b.adults || 2,
          b.children || 0,
          b.rooms_requested || 1,
          b.nights || 1,
          b.booking_status || 'Confirmed',
          b.price_per_night || 2500,
          b.room_subtotal || b.total_amount,
          b.tax_amount || 0,
          b.total_amount,
          b.payment_status || 'Pending',
          b.payment_method || 'online_razorpay',
          b.special_request || '',
          b.internal_notes || '',
          b.created_at || new Date().toISOString(),
          b.updated_at || new Date().toISOString()
        ]);

        // Reservation Rooms
        await client.query(`
          INSERT INTO reservation_rooms (id, reservation_id, room_type_id, room_number, check_in, check_out, nightly_rate, number_of_nights, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          `resroom-${b.id}-1`,
          b.id,
          b.room_type_id,
          b.room_number || null,
          b.check_in,
          b.check_out,
          b.price_per_night || 2500,
          b.nights || 1,
          b.booking_status === 'Cancelled' ? 'CANCELLED' : (b.booking_status === 'Checked In' ? 'CHECKED_IN' : 'ACTIVE')
        ]);

        // Payments if completed
        if (b.payment_status === 'Completed' || b.payment_status === 'Paid') {
          await client.query(`
            INSERT INTO payments (id, reservation_id, provider, method, amount, status, transaction_id, payment_reference, paid_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
          `, [
            `pay-${b.id}`,
            b.id,
            'RAZORPAY',
            'RAZORPAY',
            b.total_amount,
            'PAID',
            b.razorpay_payment_id || b.payment_txn_id || `txn-${Date.now()}`,
            b.razorpay_order_id || null,
            b.payment_verified_at ? new Date(b.payment_verified_at) : new Date(b.created_at)
          ]);
        }

        importedBookings++;
      }
    }

    // 6. Blocked Rooms
    let importedBlocked = 0;
    if (Array.isArray(data.blocked_rooms)) {
      for (const br of data.blocked_rooms) {
        await client.query(`
          INSERT INTO blocked_rooms (id, property_id, property_code, room_type_id, room_code, start_date, end_date, quantity, reason, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [
          br.id,
          br.property_id,
          br.property_code,
          br.room_type_id,
          br.room_code,
          br.start_date,
          br.end_date,
          br.quantity || 1,
          br.reason,
          br.created_at || new Date().toISOString()
        ]);
        importedBlocked++;
      }
    }

    // 7. Settings
    if (data.settings) {
      const s = data.settings;
      await client.query(`
        INSERT INTO settings (id, hotel_name, gst_percent, hold_pending_inventory, cancellation_policy, payment_gateway_mode, razorpay_key_id, currency)
        VALUES ('default', $1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          hotel_name = EXCLUDED.hotel_name,
          gst_percent = EXCLUDED.gst_percent,
          hold_pending_inventory = EXCLUDED.hold_pending_inventory,
          cancellation_policy = EXCLUDED.cancellation_policy,
          payment_gateway_mode = EXCLUDED.payment_gateway_mode,
          razorpay_key_id = EXCLUDED.razorpay_key_id,
          currency = EXCLUDED.currency
      `, [
        s.hotel_name || 'SBM Hotel & SBM 2 Guest House',
        s.gst_percent || 12,
        s.hold_pending_inventory ?? true,
        s.cancellation_policy || '',
        s.payment_gateway_mode || 'test',
        s.razorpay_key_id || '',
        s.currency || 'INR'
      ]);
    }

    // 8. Activities
    let importedActivities = 0;
    if (Array.isArray(data.activities)) {
      for (const act of data.activities) {
        await client.query(`
          INSERT INTO activities (id, action, description, property_code, performed_by, date, timestamp, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [
          act.id,
          act.action,
          act.description,
          act.property_code || null,
          act.performed_by || 'Admin',
          act.date || new Date().toISOString().split('T')[0],
          act.timestamp || '',
          new Date().toISOString()
        ]);
        importedActivities++;
      }
    }

    // 9. Knowledge Base
    let importedKnowledge = 0;
    if (Array.isArray(data.knowledge_base)) {
      for (const k of data.knowledge_base) {
        await client.query(`
          INSERT INTO knowledge_base (id, category, title, content, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [k.id, k.category, k.title, k.content, k.updated_at || new Date().toISOString()]);
        importedKnowledge++;
      }
    }

    // 10. Managed Images
    let importedImages = 0;
    if (Array.isArray(data.managed_images)) {
      for (const img of data.managed_images) {
        await client.query(`
          INSERT INTO managed_images (id, image_url, title, description, category, room_id, property_id, display_order, is_primary_cover, is_main_for_room, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          img.id,
          img.imageUrl,
          img.title || '',
          img.description || '',
          img.category,
          img.roomId || null,
          img.propertyId || null,
          img.displayOrder || 0,
          img.isPrimaryCover || false,
          img.isMainForRoom || false,
          img.createdAt || new Date().toISOString(),
          img.updatedAt || new Date().toISOString()
        ]);
        importedImages++;
      }
    }

    // 11. Channel Configs
    let importedChannels = 0;
    if (Array.isArray(data.channels)) {
      for (const ch of data.channels) {
        await client.query(`
          INSERT INTO channel_configs (id, code, name, type, enabled, connection_status, property_code, credentials_configured, settings, inventory_status, rates_status, reservations_status, last_sync_at, last_successful_sync_at, last_error, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            connection_status = EXCLUDED.connection_status,
            credentials_configured = EXCLUDED.credentials_configured,
            settings = EXCLUDED.settings,
            inventory_status = EXCLUDED.inventory_status,
            rates_status = EXCLUDED.rates_status,
            reservations_status = EXCLUDED.reservations_status,
            last_sync_at = EXCLUDED.last_sync_at,
            last_successful_sync_at = EXCLUDED.last_successful_sync_at,
            last_error = EXCLUDED.last_error,
            updated_at = EXCLUDED.updated_at
        `, [
          ch.id,
          ch.code,
          ch.name,
          ch.type || 'OTA',
          ch.enabled || false,
          ch.connectionStatus || 'NOT_CONFIGURED',
          ch.property_code || 'both',
          ch.credentialsConfigured || false,
          JSON.stringify(ch.settings || {}),
          ch.inventoryStatus || 'PENDING',
          ch.ratesStatus || 'PENDING',
          ch.reservationsStatus || 'PENDING',
          ch.lastSyncAt ? new Date(ch.lastSyncAt) : null,
          ch.lastSuccessfulSyncAt ? new Date(ch.lastSuccessfulSyncAt) : null,
          ch.lastError || null,
          ch.createdAt ? new Date(ch.createdAt) : new Date(),
          ch.updatedAt ? new Date(ch.updatedAt) : new Date()
        ]);
        importedChannels++;
      }
    }

    // 12. Channel Room Mappings
    let importedRoomMappings = 0;
    if (Array.isArray(data.channel_room_mappings)) {
      for (const rm of data.channel_room_mappings) {
        await client.query(`
          INSERT INTO channel_room_mappings (id, channel_id, channel_code, property_code, pms_room_type_id, pms_room_type_name, channel_room_id, channel_room_name, is_active, sync_inventory, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          rm.id,
          rm.channel_id,
          rm.channel_code,
          rm.property_code,
          rm.pms_room_type_id,
          rm.pms_room_type_name,
          rm.channel_room_id,
          rm.channel_room_name,
          rm.is_active ?? true,
          rm.sync_inventory ?? true,
          rm.created_at ? new Date(rm.created_at) : new Date(),
          rm.updated_at ? new Date(rm.updated_at) : new Date()
        ]);
        importedRoomMappings++;
      }
    }

    // 13. Channel Rate Mappings
    let importedRateMappings = 0;
    if (Array.isArray(data.channel_rate_mappings)) {
      for (const rt of data.channel_rate_mappings) {
        await client.query(`
          INSERT INTO channel_rate_mappings (id, channel_id, channel_code, property_code, pms_room_type_id, pms_rate_plan_id, pms_rate_plan_name, channel_room_id, channel_rate_plan_id, channel_rate_plan_name, price_multiplier, tax_mode, meal_plan, cancellation_policy, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO NOTHING
        `, [
          rt.id,
          rt.channel_id,
          rt.channel_code,
          rt.property_code,
          rt.pms_room_type_id,
          rt.pms_rate_plan_id,
          rt.pms_rate_plan_name,
          rt.channel_room_id,
          rt.channel_rate_plan_id,
          rt.channel_rate_plan_name,
          rt.price_multiplier || 1.0,
          rt.tax_mode || 'INCLUSIVE',
          rt.meal_plan || 'EP',
          rt.cancellation_policy || 'MODERATE',
          rt.is_active ?? true,
          rt.created_at ? new Date(rt.created_at) : new Date(),
          rt.updated_at ? new Date(rt.updated_at) : new Date()
        ]);
        importedRateMappings++;
      }
    }

    // 14. Channel Restrictions
    let importedRestrictions = 0;
    if (Array.isArray(data.channel_restrictions)) {
      for (const cr of data.channel_restrictions) {
        await client.query(`
          INSERT INTO channel_restrictions (id, property_code, channel_code, room_type_id, rate_plan_id, date, stop_sell, closed_to_arrival, closed_to_departure, min_stay, max_stay, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (property_code, channel_code, room_type_id, date) DO UPDATE SET
            stop_sell = EXCLUDED.stop_sell,
            closed_to_arrival = EXCLUDED.closed_to_arrival,
            closed_to_departure = EXCLUDED.closed_to_departure,
            min_stay = EXCLUDED.min_stay,
            max_stay = EXCLUDED.max_stay,
            updated_at = EXCLUDED.updated_at
        `, [
          cr.id,
          cr.property_code,
          cr.channel_code || 'ALL',
          cr.room_type_id,
          cr.rate_plan_id || null,
          cr.date,
          cr.stop_sell || false,
          cr.closed_to_arrival || false,
          cr.closed_to_departure || false,
          cr.min_stay || 1,
          cr.max_stay || 30,
          cr.created_at ? new Date(cr.created_at) : new Date(),
          cr.updated_at ? new Date(cr.updated_at) : new Date()
        ]);
        importedRestrictions++;
      }
    }

    // 15. Channel Sync Jobs
    let importedSyncJobs = 0;
    if (Array.isArray(data.sync_jobs)) {
      for (const sj of data.sync_jobs) {
        await client.query(`
          INSERT INTO channel_sync_jobs (id, channel_id, channel_code, channel_name, property_code, room_type_id, room_name, operation, date_start, date_end, payload, status, retry_count, max_retries, worker_id, processing_started_at, last_attempt_at, completed_at, error_message, duration_ms, external_reference, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          ON CONFLICT (id) DO NOTHING
        `, [
          sj.id,
          sj.channel_id || null,
          sj.channel_code,
          sj.channel_name,
          sj.property_code,
          sj.room_type_id || null,
          sj.room_name || null,
          sj.operation,
          sj.date_range?.start || sj.date_start || new Date().toISOString().split('T')[0],
          sj.date_range?.end || sj.date_end || new Date().toISOString().split('T')[0],
          JSON.stringify(sj.payload || {}),
          sj.status || 'PENDING',
          sj.retry_count || 0,
          sj.max_retries || 3,
          sj.worker_id || null,
          sj.processing_started_at ? new Date(sj.processing_started_at) : null,
          sj.last_attempt_at ? new Date(sj.last_attempt_at) : null,
          sj.completed_at ? new Date(sj.completed_at) : null,
          sj.error_message || null,
          sj.duration_ms || null,
          sj.external_reference || null,
          sj.created_at ? new Date(sj.created_at) : new Date(),
          new Date()
        ]);
        importedSyncJobs++;
      }
    }

    // 16. Pending External Events
    let importedPending = 0;
    if (Array.isArray(data.pending_external_events)) {
      for (const pe of data.pending_external_events) {
        await client.query(`
          INSERT INTO channel_pending_events (id, channel, external_booking_id, event_type, payload, status, retry_count, received_at, processed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (channel, external_booking_id, event_type) DO NOTHING
        `, [
          pe.id,
          pe.channel,
          pe.external_booking_id,
          pe.event_type,
          JSON.stringify(pe.payload || {}),
          pe.status || 'PENDING',
          pe.retry_count || 0,
          pe.received_at ? new Date(pe.received_at) : new Date(),
          pe.processed_at ? new Date(pe.processed_at) : null
        ]);
        importedPending++;
      }
    }

    await client.query('COMMIT');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 [SBM Hotel PMS] PostgreSQL Database Migration Completed:');
    console.log(`   • Properties:       ${importedProps}`);
    console.log(`   • Room Types:       ${importedRoomTypes}`);
    console.log(`   • Physical Rooms:   ${importedRooms}`);
    console.log(`   • Admins:           ${importedAdmins}`);
    console.log(`   • Reservations:     ${importedBookings}`);
    console.log(`   • Blocked Rooms:    ${importedBlocked}`);
    console.log(`   • Activities:       ${importedActivities}`);
    console.log(`   • Knowledge Items:  ${importedKnowledge}`);
    console.log(`   • Managed Images:   ${importedImages}`);
    console.log(`   • Channel Configs:  ${importedChannels}`);
    console.log(`   • Room Mappings:    ${importedRoomMappings}`);
    console.log(`   • Rate Mappings:    ${importedRateMappings}`);
    console.log(`   • Restrictions:     ${importedRestrictions}`);
    console.log(`   • Sync Jobs:        ${importedSyncJobs}`);
    console.log(`   • Pending Events:   ${importedPending}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ [SBM Hotel PMS Migration Failed]:', err.message);
  }
}

export async function updateRoomTypePriceInPostgres(
  roomTypeId: string,
  newPrice: number
): Promise<boolean> {
  if (!pool || !isPostgresConnected) return false;
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        UPDATE room_types
        SET price_per_night = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newPrice, roomTypeId]);

      // Also update default rate plan base_price for this room type
      await client.query(`
        UPDATE rate_plans
        SET base_price = $1, updated_at = CURRENT_TIMESTAMP
        WHERE room_type_id = $2
      `, [newPrice, roomTypeId]);

      // Also update physical rooms matching this room_type_id
      await client.query(`
        UPDATE rooms
        SET price = $1, updated_at = CURRENT_TIMESTAMP
        WHERE room_type_id = $2
      `, [newPrice, roomTypeId]);

      console.log(`✅ [PostgreSQL] Synced price_per_night = ₹${newPrice} for room_type_id: ${roomTypeId}`);
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('❌ [PostgreSQL] Failed to update room type price:', err.message);
    return false;
  }
}

export async function updatePhysicalRoomPriceInPostgres(
  roomId: string,
  newPrice: number
): Promise<boolean> {
  if (!pool || !isPostgresConnected) return false;
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        UPDATE rooms
        SET price = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING room_type_id
      `, [newPrice, roomId]);

      if (res.rows.length > 0 && res.rows[0].room_type_id) {
        const rtId = res.rows[0].room_type_id;
        // Keep parent room_type in sync
        await client.query(`
          UPDATE room_types
          SET price_per_night = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newPrice, rtId]);

        await client.query(`
          UPDATE rate_plans
          SET base_price = $1, updated_at = CURRENT_TIMESTAMP
          WHERE room_type_id = $2
        `, [newPrice, rtId]);
      }

      console.log(`✅ [PostgreSQL] Synced price = ₹${newPrice} for physical room: ${roomId}`);
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('❌ [PostgreSQL] Failed to update physical room price:', err.message);
    return false;
  }
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ==========================================================
// AUTHORITATIVE POSTGRESQL CHANNEL MANAGER DAOS
// ==========================================================

// 1. CHANNELS
export async function postgresGetChannels(): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  const res = await pool.query('SELECT * FROM channel_configs ORDER BY id ASC');
  return res.rows.map(r => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    enabled: r.enabled,
    connectionStatus: r.connection_status,
    property_code: r.property_code,
    credentialsConfigured: r.credentials_configured,
    settings: typeof r.settings === 'string' ? JSON.parse(r.settings) : (r.settings || {}),
    inventoryStatus: r.inventory_status,
    ratesStatus: r.rates_status,
    reservationsStatus: r.reservations_status,
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : undefined,
    lastSuccessfulSyncAt: r.last_successful_sync_at ? new Date(r.last_successful_sync_at).toISOString() : undefined,
    lastError: r.last_error || undefined,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    mappedRoomsCount: 0,
    mappedRatePlansCount: 0
  }));
}

export async function postgresGetChannelById(id: string): Promise<any | undefined> {
  if (!pool) throw new Error('PostgreSQL not available');
  const res = await pool.query('SELECT * FROM channel_configs WHERE id = $1', [id]);
  if (res.rows.length === 0) return undefined;
  const r = res.rows[0];
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    enabled: r.enabled,
    connectionStatus: r.connection_status,
    property_code: r.property_code,
    credentialsConfigured: r.credentials_configured,
    settings: typeof r.settings === 'string' ? JSON.parse(r.settings) : (r.settings || {}),
    inventoryStatus: r.inventory_status,
    ratesStatus: r.rates_status,
    reservationsStatus: r.reservations_status,
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : undefined,
    lastSuccessfulSyncAt: r.last_successful_sync_at ? new Date(r.last_successful_sync_at).toISOString() : undefined,
    lastError: r.last_error || undefined,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    mappedRoomsCount: 0,
    mappedRatePlansCount: 0
  };
}

export async function postgresUpdateChannelConfig(id: string, updates: any): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const existing = await postgresGetChannelById(id);
  if (!existing) throw new Error(`Channel ${id} not found in PostgreSQL`);

  const mergedSettings = { ...existing.settings, ...(updates.settings || {}) };
  const enabled = updates.enabled !== undefined ? updates.enabled : existing.enabled;
  const connectionStatus = updates.connectionStatus !== undefined ? updates.connectionStatus : existing.connectionStatus;
  const credentialsConfigured = updates.credentialsConfigured !== undefined ? updates.credentialsConfigured : existing.credentialsConfigured;
  const inventoryStatus = updates.inventoryStatus !== undefined ? updates.inventoryStatus : existing.inventoryStatus;
  const ratesStatus = updates.ratesStatus !== undefined ? updates.ratesStatus : existing.ratesStatus;
  const reservationsStatus = updates.reservationsStatus !== undefined ? updates.reservationsStatus : existing.reservationsStatus;
  const lastSyncAt = updates.lastSyncAt ? new Date(updates.lastSyncAt) : (existing.lastSyncAt ? new Date(existing.lastSyncAt) : null);
  const lastSuccessfulSyncAt = updates.lastSuccessfulSyncAt ? new Date(updates.lastSuccessfulSyncAt) : (existing.lastSuccessfulSyncAt ? new Date(existing.lastSuccessfulSyncAt) : null);
  const lastError = updates.lastError !== undefined ? updates.lastError : existing.lastError;

  const res = await pool.query(`
    UPDATE channel_configs
    SET enabled = $1,
        connection_status = $2,
        credentials_configured = $3,
        settings = $4,
        inventory_status = $5,
        rates_status = $6,
        reservations_status = $7,
        last_sync_at = $8,
        last_successful_sync_at = $9,
        last_error = $10,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $11
    RETURNING *
  `, [
    enabled,
    connectionStatus,
    credentialsConfigured,
    JSON.stringify(mergedSettings),
    inventoryStatus,
    ratesStatus,
    reservationsStatus,
    lastSyncAt,
    lastSuccessfulSyncAt,
    lastError,
    id
  ]);

  const r = res.rows[0];
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    enabled: r.enabled,
    connectionStatus: r.connection_status,
    property_code: r.property_code,
    credentialsConfigured: r.credentials_configured,
    settings: typeof r.settings === 'string' ? JSON.parse(r.settings) : (r.settings || {}),
    inventoryStatus: r.inventory_status,
    ratesStatus: r.rates_status,
    reservationsStatus: r.reservations_status,
    lastSyncAt: r.last_sync_at ? new Date(r.last_sync_at).toISOString() : undefined,
    lastSuccessfulSyncAt: r.last_successful_sync_at ? new Date(r.last_successful_sync_at).toISOString() : undefined,
    lastError: r.last_error || undefined,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    mappedRoomsCount: 0,
    mappedRatePlansCount: 0
  };
}

// 2. ROOM MAPPINGS
export async function postgresGetChannelRoomMappings(channelId?: string, propertyCode?: string): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT * FROM channel_room_mappings WHERE 1=1';
  const params: any[] = [];
  if (channelId) {
    params.push(channelId);
    query += ` AND channel_id = $${params.length}`;
  }
  if (propertyCode && propertyCode !== 'all') {
    params.push(propertyCode);
    query += ` AND property_code = $${params.length}`;
  }
  query += ' ORDER BY created_at ASC';
  const res = await pool.query(query, params);
  return res.rows.map(r => ({
    id: r.id,
    channel_id: r.channel_id,
    channel_code: r.channel_code,
    property_code: r.property_code,
    pms_room_type_id: r.pms_room_type_id,
    pms_room_type_name: r.pms_room_type_name,
    channel_room_id: r.channel_room_id,
    channel_room_name: r.channel_room_name,
    is_active: r.is_active,
    sync_inventory: r.sync_inventory,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  }));
}

export async function postgresSaveChannelRoomMapping(mapping: any): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const id = mapping.id || `crm-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const channelId = mapping.channel_id;
  const channelRoomId = mapping.channel_room_id;

  // Duplicate Check
  const dupCheck = await pool.query(`
    SELECT id, pms_room_type_name FROM channel_room_mappings
    WHERE channel_id = $1 AND channel_room_id = $2 AND id != $3
  `, [channelId, channelRoomId, id]);

  if (dupCheck.rows.length > 0) {
    throw new Error(
      `Duplicate OTA Room ID '${channelRoomId}' is already mapped to PMS room '${dupCheck.rows[0].pms_room_type_name}' on this channel. Each OTA room may only be mapped once.`
    );
  }

  const res = await pool.query(`
    INSERT INTO channel_room_mappings (id, channel_id, channel_code, property_code, pms_room_type_id, pms_room_type_name, channel_room_id, channel_room_name, is_active, sync_inventory, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      channel_id = EXCLUDED.channel_id,
      channel_code = EXCLUDED.channel_code,
      property_code = EXCLUDED.property_code,
      pms_room_type_id = EXCLUDED.pms_room_type_id,
      pms_room_type_name = EXCLUDED.pms_room_type_name,
      channel_room_id = EXCLUDED.channel_room_id,
      channel_room_name = EXCLUDED.channel_room_name,
      is_active = EXCLUDED.is_active,
      sync_inventory = EXCLUDED.sync_inventory,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [
    id,
    channelId,
    mapping.channel_code,
    mapping.property_code,
    mapping.pms_room_type_id,
    mapping.pms_room_type_name,
    channelRoomId,
    mapping.channel_room_name,
    mapping.is_active !== undefined ? mapping.is_active : true,
    mapping.sync_inventory !== undefined ? mapping.sync_inventory : true
  ]);

  const r = res.rows[0];
  return {
    id: r.id,
    channel_id: r.channel_id,
    channel_code: r.channel_code,
    property_code: r.property_code,
    pms_room_type_id: r.pms_room_type_id,
    pms_room_type_name: r.pms_room_type_name,
    channel_room_id: r.channel_room_id,
    channel_room_name: r.channel_room_name,
    is_active: r.is_active,
    sync_inventory: r.sync_inventory,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function postgresDeleteChannelRoomMapping(id: string): Promise<boolean> {
  if (!pool) throw new Error('PostgreSQL not available');
  const res = await pool.query('DELETE FROM channel_room_mappings WHERE id = $1', [id]);
  return (res.rowCount || 0) > 0;
}

// 3. RATE PLANS & RATE MAPPINGS
export async function postgresGetPMSRatePlans(propertyCode?: string, roomTypeId?: string): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT rp.*, rt.property_code FROM rate_plans rp JOIN room_types rt ON rp.room_type_id = rt.id WHERE 1=1';
  const params: any[] = [];
  if (propertyCode && propertyCode !== 'all') {
    params.push(propertyCode);
    query += ` AND rt.property_code = $${params.length}`;
  }
  if (roomTypeId) {
    params.push(roomTypeId);
    query += ` AND rp.room_type_id = $${params.length}`;
  }
  query += ' ORDER BY rp.name ASC';
  const res = await pool.query(query, params);
  return res.rows.map(r => ({
    id: r.id,
    property_code: r.property_code,
    room_type_id: r.room_type_id,
    name: r.name,
    code: r.code,
    meal_plan: r.meal_plan || 'EP',
    cancellation_policy: r.cancellation_policy || 'MODERATE',
    base_price: Number(r.base_price),
    active: r.active,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  }));
}

export async function postgresSavePMSRatePlan(plan: any): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const id = plan.id || `rate-plan-${Date.now()}`;
  const res = await pool.query(`
    INSERT INTO rate_plans (id, property_id, room_type_id, name, code, meal_plan, base_price, cancellation_policy, active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      code = EXCLUDED.code,
      meal_plan = EXCLUDED.meal_plan,
      base_price = EXCLUDED.base_price,
      cancellation_policy = EXCLUDED.cancellation_policy,
      active = EXCLUDED.active,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [
    id,
    plan.property_code === 'sbm-guest-house' ? 'prop-sbm-guesthouse' : 'prop-sbm-hotel',
    plan.room_type_id,
    plan.name,
    plan.code,
    plan.meal_plan || 'EP',
    plan.base_price || 2500,
    plan.cancellation_policy || 'MODERATE',
    plan.active !== undefined ? plan.active : true
  ]);
  const r = res.rows[0];
  return {
    id: r.id,
    property_code: plan.property_code,
    room_type_id: r.room_type_id,
    name: r.name,
    code: r.code,
    meal_plan: r.meal_plan,
    cancellation_policy: r.cancellation_policy,
    base_price: Number(r.base_price),
    active: r.active,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function postgresDeletePMSRatePlan(id: string): Promise<boolean> {
  if (!pool) throw new Error('PostgreSQL not available');
  const res = await pool.query('DELETE FROM rate_plans WHERE id = $1', [id]);
  return (res.rowCount || 0) > 0;
}

export async function postgresGetChannelRateMappings(channelId?: string, propertyCode?: string): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT * FROM channel_rate_mappings WHERE 1=1';
  const params: any[] = [];
  if (channelId) {
    params.push(channelId);
    query += ` AND channel_id = $${params.length}`;
  }
  if (propertyCode && propertyCode !== 'all') {
    params.push(propertyCode);
    query += ` AND property_code = $${params.length}`;
  }
  query += ' ORDER BY created_at ASC';
  const res = await pool.query(query, params);
  return res.rows.map(r => ({
    id: r.id,
    channel_id: r.channel_id,
    channel_code: r.channel_code,
    property_code: r.property_code,
    pms_room_type_id: r.pms_room_type_id,
    pms_rate_plan_id: r.pms_rate_plan_id,
    pms_rate_plan_name: r.pms_rate_plan_name,
    channel_room_id: r.channel_room_id,
    channel_rate_plan_id: r.channel_rate_plan_id,
    channel_rate_plan_name: r.channel_rate_plan_name,
    price_multiplier: Number(r.price_multiplier),
    tax_mode: r.tax_mode,
    meal_plan: r.meal_plan,
    cancellation_policy: r.cancellation_policy,
    is_active: r.is_active,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  }));
}

export async function postgresSaveChannelRateMapping(mapping: any): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const id = mapping.id || `crmap-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const channelId = mapping.channel_id;
  const channelRatePlanId = mapping.channel_rate_plan_id;

  // Duplicate Check
  const dupCheck = await pool.query(`
    SELECT id, pms_rate_plan_name FROM channel_rate_mappings
    WHERE channel_id = $1 AND channel_rate_plan_id = $2 AND id != $3
  `, [channelId, channelRatePlanId, id]);

  if (dupCheck.rows.length > 0) {
    throw new Error(
      `Duplicate OTA Rate Plan ID '${channelRatePlanId}' is already mapped to PMS plan '${dupCheck.rows[0].pms_rate_plan_name}' on this channel.`
    );
  }

  const res = await pool.query(`
    INSERT INTO channel_rate_mappings (id, channel_id, channel_code, property_code, pms_room_type_id, pms_rate_plan_id, pms_rate_plan_name, channel_room_id, channel_rate_plan_id, channel_rate_plan_name, price_multiplier, tax_mode, meal_plan, cancellation_policy, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      channel_id = EXCLUDED.channel_id,
      channel_code = EXCLUDED.channel_code,
      property_code = EXCLUDED.property_code,
      pms_room_type_id = EXCLUDED.pms_room_type_id,
      pms_rate_plan_id = EXCLUDED.pms_rate_plan_id,
      pms_rate_plan_name = EXCLUDED.pms_rate_plan_name,
      channel_room_id = EXCLUDED.channel_room_id,
      channel_rate_plan_id = EXCLUDED.channel_rate_plan_id,
      channel_rate_plan_name = EXCLUDED.channel_rate_plan_name,
      price_multiplier = EXCLUDED.price_multiplier,
      tax_mode = EXCLUDED.tax_mode,
      meal_plan = EXCLUDED.meal_plan,
      cancellation_policy = EXCLUDED.cancellation_policy,
      is_active = EXCLUDED.is_active,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [
    id,
    channelId,
    mapping.channel_code,
    mapping.property_code,
    mapping.pms_room_type_id,
    mapping.pms_rate_plan_id,
    mapping.pms_rate_plan_name,
    mapping.channel_room_id || '',
    channelRatePlanId,
    mapping.channel_rate_plan_name,
    mapping.price_multiplier || 1.0,
    mapping.tax_mode || 'INCLUSIVE',
    mapping.meal_plan || 'EP',
    mapping.cancellation_policy || 'MODERATE',
    mapping.is_active !== undefined ? mapping.is_active : true
  ]);

  const r = res.rows[0];
  return {
    id: r.id,
    channel_id: r.channel_id,
    channel_code: r.channel_code,
    property_code: r.property_code,
    pms_room_type_id: r.pms_room_type_id,
    pms_rate_plan_id: r.pms_rate_plan_id,
    pms_rate_plan_name: r.pms_rate_plan_name,
    channel_room_id: r.channel_room_id,
    channel_rate_plan_id: r.channel_rate_plan_id,
    channel_rate_plan_name: r.channel_rate_plan_name,
    price_multiplier: Number(r.price_multiplier),
    tax_mode: r.tax_mode,
    meal_plan: r.meal_plan,
    cancellation_policy: r.cancellation_policy,
    is_active: r.is_active,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function postgresDeleteChannelRateMapping(id: string): Promise<boolean> {
  if (!pool) throw new Error('PostgreSQL not available');
  const res = await pool.query('DELETE FROM channel_rate_mappings WHERE id = $1', [id]);
  return (res.rowCount || 0) > 0;
}

// 4. RESTRICTIONS
export async function postgresGetChannelRestrictions(propertyCode?: string, startDate?: string, endDate?: string): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT * FROM channel_restrictions WHERE 1=1';
  const params: any[] = [];
  if (propertyCode && propertyCode !== 'all') {
    params.push(propertyCode);
    query += ` AND property_code = $${params.length}`;
  }
  if (startDate) {
    params.push(startDate);
    query += ` AND date >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    query += ` AND date <= $${params.length}`;
  }
  query += ' ORDER BY date ASC';
  const res = await pool.query(query, params);
  return res.rows.map(r => ({
    id: r.id,
    property_code: r.property_code,
    channel_code: r.channel_code,
    room_type_id: r.room_type_id,
    rate_plan_id: r.rate_plan_id || undefined,
    date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
    stop_sell: Boolean(r.stop_sell),
    closed_to_arrival: Boolean(r.closed_to_arrival),
    closed_to_departure: Boolean(r.closed_to_departure),
    min_stay: r.min_stay ? Number(r.min_stay) : undefined,
    max_stay: r.max_stay ? Number(r.max_stay) : undefined,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  }));
}

export async function postgresSaveChannelRestriction(restriction: any): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const id = restriction.id || `rest-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const channelCode = restriction.channel_code || 'ALL';

  const res = await pool.query(`
    INSERT INTO channel_restrictions (id, property_code, channel_code, room_type_id, rate_plan_id, date, stop_sell, closed_to_arrival, closed_to_departure, min_stay, max_stay, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (property_code, channel_code, room_type_id, date) DO UPDATE SET
      rate_plan_id = EXCLUDED.rate_plan_id,
      stop_sell = EXCLUDED.stop_sell,
      closed_to_arrival = EXCLUDED.closed_to_arrival,
      closed_to_departure = EXCLUDED.closed_to_departure,
      min_stay = EXCLUDED.min_stay,
      max_stay = EXCLUDED.max_stay,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [
    id,
    restriction.property_code,
    channelCode,
    restriction.room_type_id,
    restriction.rate_plan_id || null,
    restriction.date,
    restriction.stop_sell || false,
    restriction.closed_to_arrival || false,
    restriction.closed_to_departure || false,
    restriction.min_stay || 1,
    restriction.max_stay || 30
  ]);

  const r = res.rows[0];
  return {
    id: r.id,
    property_code: r.property_code,
    channel_code: r.channel_code,
    room_type_id: r.room_type_id,
    rate_plan_id: r.rate_plan_id || undefined,
    date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
    stop_sell: Boolean(r.stop_sell),
    closed_to_arrival: Boolean(r.closed_to_arrival),
    closed_to_departure: Boolean(r.closed_to_departure),
    min_stay: r.min_stay ? Number(r.min_stay) : undefined,
    max_stay: r.max_stay ? Number(r.max_stay) : undefined,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function postgresBulkSaveChannelRestrictions(restrictions: any[]): Promise<any[]> {
  const savedList: any[] = [];
  for (const r of restrictions) {
    const saved = await postgresSaveChannelRestriction(r);
    savedList.push(saved);
  }
  return savedList;
}

// 5. SYNC QUEUE WITH 'FOR UPDATE SKIP LOCKED'
export async function postgresCreateSyncJob(job: any): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const id = job.id || `sync-job-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const res = await pool.query(`
    INSERT INTO channel_sync_jobs (id, channel_id, channel_code, channel_name, property_code, room_type_id, room_name, operation, date_start, date_end, payload, status, retry_count, max_retries, worker_id, processing_started_at, last_attempt_at, completed_at, error_message, duration_ms, external_reference, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `, [
    id,
    job.channel_id || null,
    job.channel_code,
    job.channel_name,
    job.property_code,
    job.room_type_id || null,
    job.room_name || null,
    job.operation,
    job.date_range?.start || job.date_start || new Date().toISOString().split('T')[0],
    job.date_range?.end || job.date_end || new Date().toISOString().split('T')[0],
    JSON.stringify(job.payload || {}),
    job.status || 'PENDING',
    job.retry_count || 0,
    job.max_retries || 3,
    job.worker_id || null,
    job.processing_started_at ? new Date(job.processing_started_at) : null,
    job.last_attempt_at ? new Date(job.last_attempt_at) : null,
    job.completed_at ? new Date(job.completed_at) : null,
    job.error_message || null,
    job.duration_ms || null,
    job.external_reference || null
  ]);

  const r = res.rows[0];
  return {
    id: r.id,
    channel_id: r.channel_id,
    channel_code: r.channel_code,
    channel_name: r.channel_name,
    property_code: r.property_code,
    room_type_id: r.room_type_id,
    room_name: r.room_name,
    operation: r.operation,
    date_range: {
      start: r.date_start instanceof Date ? r.date_start.toISOString().split('T')[0] : String(r.date_start).split('T')[0],
      end: r.date_end instanceof Date ? r.date_end.toISOString().split('T')[0] : String(r.date_end).split('T')[0]
    },
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
    status: r.status,
    retry_count: r.retry_count,
    max_retries: r.max_retries,
    worker_id: r.worker_id,
    processing_started_at: r.processing_started_at ? new Date(r.processing_started_at).toISOString() : undefined,
    last_attempt_at: r.last_attempt_at ? new Date(r.last_attempt_at).toISOString() : undefined,
    completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
    error_message: r.error_message,
    duration_ms: r.duration_ms,
    external_reference: r.external_reference,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  };
}

export async function postgresClaimSyncJobs(workerId: string, limit: number = 10): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  return await withTransaction(async client => {
    // Select pending jobs atomically using FOR UPDATE SKIP LOCKED
    const selectRes = await client.query(`
      SELECT id FROM channel_sync_jobs
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `, [limit]);

    if (selectRes.rows.length === 0) return [];

    const ids = selectRes.rows.map(r => r.id);
    const updateRes = await client.query(`
      UPDATE channel_sync_jobs
      SET status = 'PROCESSING',
          worker_id = $1,
          processing_started_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2::text[])
      RETURNING *
    `, [workerId, ids]);

    return updateRes.rows.map(r => ({
      id: r.id,
      channel_id: r.channel_id,
      channel_code: r.channel_code,
      channel_name: r.channel_name,
      property_code: r.property_code,
      room_type_id: r.room_type_id,
      room_name: r.room_name,
      operation: r.operation,
      date_range: {
        start: r.date_start instanceof Date ? r.date_start.toISOString().split('T')[0] : String(r.date_start).split('T')[0],
        end: r.date_end instanceof Date ? r.date_end.toISOString().split('T')[0] : String(r.date_end).split('T')[0]
      },
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
      status: r.status,
      retry_count: r.retry_count,
      max_retries: r.max_retries,
      worker_id: r.worker_id,
      processing_started_at: r.processing_started_at ? new Date(r.processing_started_at).toISOString() : undefined,
      last_attempt_at: r.last_attempt_at ? new Date(r.last_attempt_at).toISOString() : undefined,
      completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
      error_message: r.error_message,
      duration_ms: r.duration_ms,
      external_reference: r.external_reference,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  });
}

export async function postgresUpdateSyncJob(id: string, updates: any): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const existingRes = await pool.query('SELECT * FROM channel_sync_jobs WHERE id = $1', [id]);
  if (existingRes.rows.length === 0) throw new Error(`Sync job ${id} not found in PostgreSQL`);
  const cur = existingRes.rows[0];

  const status = updates.status || cur.status;
  const retry_count = updates.retry_count !== undefined ? updates.retry_count : cur.retry_count;
  const worker_id = updates.worker_id !== undefined ? updates.worker_id : cur.worker_id;
  const error_message = updates.error_message !== undefined ? updates.error_message : cur.error_message;
  const completed_at = updates.completed_at ? new Date(updates.completed_at) : (status === 'COMPLETED' ? new Date() : cur.completed_at);
  const duration_ms = updates.duration_ms !== undefined ? updates.duration_ms : cur.duration_ms;
  const external_reference = updates.external_reference !== undefined ? updates.external_reference : cur.external_reference;

  const res = await pool.query(`
    UPDATE channel_sync_jobs
    SET status = $1,
        retry_count = $2,
        worker_id = $3,
        error_message = $4,
        completed_at = $5,
        duration_ms = $6,
        external_reference = $7,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING *
  `, [
    status,
    retry_count,
    worker_id,
    error_message,
    completed_at,
    duration_ms,
    external_reference,
    id
  ]);

  const r = res.rows[0];
  return {
    id: r.id,
    channel_id: r.channel_id,
    channel_code: r.channel_code,
    channel_name: r.channel_name,
    property_code: r.property_code,
    room_type_id: r.room_type_id,
    room_name: r.room_name,
    operation: r.operation,
    date_range: {
      start: r.date_start instanceof Date ? r.date_start.toISOString().split('T')[0] : String(r.date_start).split('T')[0],
      end: r.date_end instanceof Date ? r.date_end.toISOString().split('T')[0] : String(r.date_end).split('T')[0]
    },
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
    status: r.status,
    retry_count: r.retry_count,
    max_retries: r.max_retries,
    worker_id: r.worker_id,
    processing_started_at: r.processing_started_at ? new Date(r.processing_started_at).toISOString() : undefined,
    last_attempt_at: r.last_attempt_at ? new Date(r.last_attempt_at).toISOString() : undefined,
    completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
    error_message: r.error_message,
    duration_ms: r.duration_ms,
    external_reference: r.external_reference,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  };
}

export async function postgresGetSyncJobs(filters?: any): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT * FROM channel_sync_jobs WHERE 1=1';
  const params: any[] = [];
  if (filters?.channel_id) {
    params.push(filters.channel_id);
    query += ` AND channel_id = $${params.length}`;
  }
  if (filters?.channel_code && filters.channel_code !== 'all') {
    params.push(filters.channel_code);
    query += ` AND channel_code = $${params.length}`;
  }
  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status);
    query += ` AND status = $${params.length}`;
  }
  if (filters?.operation && filters.operation !== 'all') {
    params.push(filters.operation);
    query += ` AND operation = $${params.length}`;
  }
  if (filters?.startDate) {
    params.push(filters.startDate);
    query += ` AND date_start >= $${params.length}`;
  }
  if (filters?.endDate) {
    params.push(filters.endDate);
    query += ` AND date_end <= $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';
  if (filters?.limit) {
    params.push(filters.limit);
    query += ` LIMIT $${params.length}`;
  }
  const res = await pool.query(query, params);
  return res.rows.map(r => ({
    id: r.id,
    channel_id: r.channel_id,
    channel_code: r.channel_code,
    channel_name: r.channel_name,
    property_code: r.property_code,
    room_type_id: r.room_type_id,
    room_name: r.room_name,
    operation: r.operation,
    date_range: {
      start: r.date_start instanceof Date ? r.date_start.toISOString().split('T')[0] : String(r.date_start).split('T')[0],
      end: r.date_end instanceof Date ? r.date_end.toISOString().split('T')[0] : String(r.date_end).split('T')[0]
    },
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
    status: r.status,
    retry_count: r.retry_count,
    max_retries: r.max_retries,
    worker_id: r.worker_id,
    processing_started_at: r.processing_started_at ? new Date(r.processing_started_at).toISOString() : undefined,
    last_attempt_at: r.last_attempt_at ? new Date(r.last_attempt_at).toISOString() : undefined,
    completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
    error_message: r.error_message,
    duration_ms: r.duration_ms,
    external_reference: r.external_reference,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  }));
}

export async function postgresRetrySyncJob(id: string): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const res = await pool.query(`
    UPDATE channel_sync_jobs
    SET status = 'PENDING',
        retry_count = retry_count + 1,
        worker_id = NULL,
        processing_started_at = NULL,
        completed_at = NULL,
        error_message = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `, [id]);
  if (res.rows.length === 0) throw new Error(`Job ${id} not found`);
  const r = res.rows[0];
  return {
    id: r.id,
    channel_id: r.channel_id,
    channel_code: r.channel_code,
    channel_name: r.channel_name,
    property_code: r.property_code,
    room_type_id: r.room_type_id,
    room_name: r.room_name,
    operation: r.operation,
    date_range: {
      start: r.date_start instanceof Date ? r.date_start.toISOString().split('T')[0] : String(r.date_start).split('T')[0],
      end: r.date_end instanceof Date ? r.date_end.toISOString().split('T')[0] : String(r.date_end).split('T')[0]
    },
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
    status: r.status,
    retry_count: r.retry_count,
    max_retries: r.max_retries,
    worker_id: r.worker_id,
    processing_started_at: r.processing_started_at ? new Date(r.processing_started_at).toISOString() : undefined,
    last_attempt_at: r.last_attempt_at ? new Date(r.last_attempt_at).toISOString() : undefined,
    completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
    error_message: r.error_message,
    duration_ms: r.duration_ms,
    external_reference: r.external_reference,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  };
}

export async function postgresRecoverStrandedJobs(): Promise<number> {
  if (!pool) return 0;
  const res = await pool.query(`
    UPDATE channel_sync_jobs
    SET status = 'PENDING',
        worker_id = NULL,
        error_message = COALESCE(error_message, '') || ' [Auto-recovered from crash/server restart]'
    WHERE status = 'PROCESSING'
  `);
  return res.rowCount || 0;
}

// 6. PENDING EXTERNAL EVENTS
export async function postgresSavePendingEvent(event: any): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const id = event.id || `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const res = await pool.query(`
    INSERT INTO channel_pending_events (id, channel, external_booking_id, event_type, payload, status, retry_count, received_at, processed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT (channel, external_booking_id, event_type) DO UPDATE SET
      payload = EXCLUDED.payload,
      status = 'PENDING',
      retry_count = EXCLUDED.retry_count
    RETURNING *
  `, [
    id,
    event.channel,
    event.external_booking_id,
    event.event_type,
    JSON.stringify(event.payload || {}),
    event.status || 'PENDING',
    event.retry_count || 0
  ]);
  const r = res.rows[0];
  return {
    id: r.id,
    channel: r.channel,
    external_booking_id: r.external_booking_id,
    event_type: r.event_type,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
    status: r.status,
    retry_count: r.retry_count,
    received_at: r.received_at ? new Date(r.received_at).toISOString() : new Date().toISOString(),
    processed_at: r.processed_at ? new Date(r.processed_at).toISOString() : undefined
  };
}

export async function postgresGetPendingEvents(channel?: string, bookingId?: string): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT * FROM channel_pending_events WHERE status = \'PENDING\'';
  const params: any[] = [];
  if (channel) {
    params.push(channel);
    query += ` AND channel = $${params.length}`;
  }
  if (bookingId) {
    params.push(bookingId);
    query += ` AND external_booking_id = $${params.length}`;
  }
  const res = await pool.query(query, params);
  return res.rows.map(r => ({
    id: r.id,
    channel: r.channel,
    external_booking_id: r.external_booking_id,
    event_type: r.event_type,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
    status: r.status,
    retry_count: r.retry_count,
    received_at: r.received_at ? new Date(r.received_at).toISOString() : new Date().toISOString(),
    processed_at: r.processed_at ? new Date(r.processed_at).toISOString() : undefined
  }));
}

export async function postgresMarkPendingEventProcessed(id: string): Promise<boolean> {
  if (!pool) throw new Error('PostgreSQL not available');
  const res = await pool.query(`
    UPDATE channel_pending_events
    SET status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [id]);
  return (res.rowCount || 0) > 0;
}

// 7. TRANSACTIONAL RESERVATIONS & DOUBLE BOOKING PROTECTION
export async function postgresCreateReservation(input: any): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  return await withTransaction(async client => {
    const propertyId = input.property_id || (input.property_code === 'sbm-guest-house' ? 'prop-sbm-guesthouse' : 'prop-sbm-hotel');
    const propertyCode = input.property_code;
    const roomTypeId = input.room_type_id;
    const checkIn = input.check_in;
    const checkOut = input.check_out;
    const roomsRequested = input.rooms || 1;
    const source = input.source || 'WEBSITE';
    const sourceBookingId = input.source_booking_id || null;

    // 1. Check idempotency for external OTA reservations:
    if (sourceBookingId) {
      const existingRes = await client.query(`
        SELECT * FROM reservations
        WHERE source = $1 AND source_booking_id = $2
      `, [source, sourceBookingId]);

      if (existingRes.rows.length > 0) {
        const b = existingRes.rows[0];
        return {
          id: b.id,
          booking_number: b.booking_number,
          property_id: b.property_id,
          property_code: b.property_code,
          property_name: b.property_name,
          guest_name: b.guest_name,
          guest_phone: b.guest_phone,
          guest_email: b.guest_email,
          room_type_id: b.room_type_id,
          room_name: b.room_name,
          room_number: b.room_number,
          check_in: b.check_in instanceof Date ? b.check_in.toISOString().split('T')[0] : String(b.check_in).split('T')[0],
          check_out: b.check_out instanceof Date ? b.check_out.toISOString().split('T')[0] : String(b.check_out).split('T')[0],
          adults: b.adults,
          children: b.children,
          rooms_requested: b.rooms_count,
          nights: b.nights,
          booking_status: b.status,
          price_per_night: Number(b.price_per_night),
          room_subtotal: Number(b.subtotal),
          tax_amount: Number(b.tax),
          total_amount: Number(b.total_amount),
          payment_status: b.payment_status,
          payment_method: b.payment_method,
          special_request: b.special_requests,
          internal_notes: b.internal_notes,
          booking_source: b.source,
          source_booking_id: b.source_booking_id,
          created_at: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString(),
          updated_at: b.updated_at ? new Date(b.updated_at).toISOString() : new Date().toISOString(),
          is_existing_idempotent: true
        };
      }
    }

    // 2. Lock room_types row to ensure serialized inventory mutation for this room category
    const rtRes = await client.query(`
      SELECT * FROM room_types
      WHERE id = $1 FOR UPDATE
    `, [roomTypeId]);

    if (rtRes.rows.length === 0) {
      throw new Error(`Room type ${roomTypeId} not found in database.`);
    }
    const roomType = rtRes.rows[0];
    const totalRooms = roomType.total_rooms || 10;

    // 3. Count already confirmed overlapping reservations
    const bookedRes = await client.query(`
      SELECT COALESCE(SUM(rooms_count), 0) as booked
      FROM reservations
      WHERE property_code = $1
        AND room_type_id = $2
        AND status NOT IN ('Cancelled')
        AND check_in < $3
        AND check_out > $4
    `, [propertyCode, roomTypeId, checkOut, checkIn]);
    const bookedCount = parseInt(bookedRes.rows[0].booked, 10) || 0;

    // 4. Count blocked rooms
    const blockedRes = await client.query(`
      SELECT COALESCE(SUM(quantity), 0) as blocked
      FROM blocked_rooms
      WHERE property_code = $1
        AND room_type_id = $2
        AND start_date < $3
        AND end_date > $4
    `, [propertyCode, roomTypeId, checkOut, checkIn]);
    const blockedCount = parseInt(blockedRes.rows[0].blocked, 10) || 0;

    // 5. Count active holds (excluding current session)
    const holdRes = await client.query(`
      SELECT COALESCE(SUM(rooms_count), 0) as held
      FROM inventory_locks
      WHERE room_type_id = $1
        AND status = 'ACTIVE'
        AND expires_at > CURRENT_TIMESTAMP
        AND check_in < $2
        AND check_out > $3
        AND ($4::text IS NULL OR session_id != $4)
    `, [roomTypeId, checkOut, checkIn, input.session_id || null]);
    const heldCount = parseInt(holdRes.rows[0].held, 10) || 0;

    // 6. Check Stop Sell Restrictions
    const stopSellRes = await client.query(`
      SELECT 1 FROM channel_restrictions
      WHERE property_code = $1
        AND (channel_code = 'ALL' OR channel_code = $2)
        AND room_type_id = $3
        AND stop_sell = TRUE
        AND date >= $4
        AND date < $5
    `, [propertyCode, source === 'WEBSITE' ? 'DIRECT' : source, roomTypeId, checkIn, checkOut]);

    if (stopSellRes.rows.length > 0) {
      throw new Error(`Stop Sell is active for ${roomType.name} on the requested dates.`);
    }

    const availableRooms = Math.max(0, totalRooms - bookedCount - blockedCount - heldCount);
    if (availableRooms < roomsRequested) {
      throw new Error(`Insufficient inventory: Only ${availableRooms} room(s) available for selected dates.`);
    }

    // 7. Insert or update Guest
    const guestPhone = input.guest_phone.replace(/[^0-9]/g, '').slice(-10) || Math.random().toString(36).substring(7);
    const guestId = `guest-${guestPhone}`;
    await client.query(`
      INSERT INTO guests (id, full_name, phone, email, country)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = COALESCE(EXCLUDED.email, guests.email)
    `, [guestId, input.guest_name, input.guest_phone, input.guest_email || null, 'India']);

    // 8. Create Reservation
    const reservationId = input.id || `bkg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const bookingNumber = input.booking_number || `SBM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)));
    const pricePerNight = input.price_per_night || roomType.price_per_night || 2500;
    const subtotal = input.room_subtotal || (pricePerNight * nights * roomsRequested);
    const tax = input.tax_amount || (subtotal * 0.12);
    const totalAmount = input.total_amount || (subtotal + tax);

    await client.query(`
      INSERT INTO reservations (id, booking_number, property_id, property_code, property_name, guest_id, guest_name, guest_phone, guest_email, source, source_booking_id, room_type_id, room_name, room_number, check_in, check_out, adults, children, rooms_count, nights, status, price_per_night, subtotal, tax, total_amount, payment_status, payment_method, special_requests, internal_notes, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      reservationId,
      bookingNumber,
      propertyId,
      propertyCode,
      propertyCode === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel',
      guestId,
      input.guest_name,
      input.guest_phone,
      input.guest_email || null,
      source,
      sourceBookingId,
      roomTypeId,
      roomType.name,
      input.room_number || null,
      checkIn,
      checkOut,
      input.adults || 2,
      input.children || 0,
      roomsRequested,
      nights,
      input.booking_status || 'Confirmed',
      pricePerNight,
      subtotal,
      tax,
      totalAmount,
      input.payment_status || 'Pending',
      input.payment_method || 'online_razorpay',
      input.special_request || '',
      input.internal_notes || '',
      input.created_by || 'System'
    ]);

    // 9. Create Reservation Rooms
    for (let i = 0; i < roomsRequested; i++) {
      await client.query(`
        INSERT INTO reservation_rooms (id, reservation_id, room_type_id, room_number, check_in, check_out, nightly_rate, number_of_nights, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        `resroom-${reservationId}-${i + 1}`,
        reservationId,
        roomTypeId,
        i === 0 ? (input.room_number || null) : null,
        checkIn,
        checkOut,
        pricePerNight,
        nights,
        'ACTIVE'
      ]);
    }

    // 10. Audit Activity
    await client.query(`
      INSERT INTO activities (id, action, description, property_code, reservation_id, performed_by, date, timestamp, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, CURRENT_TIMESTAMP)
    `, [
      `act-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      'Booking',
      `New ${source} booking ${bookingNumber} for ${input.guest_name} (${roomType.name})`,
      propertyCode,
      reservationId,
      input.created_by || 'System',
      new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    ]);

    return {
      id: reservationId,
      booking_number: bookingNumber,
      property_id: propertyId,
      property_code: propertyCode,
      property_name: propertyCode === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel',
      guest_name: input.guest_name,
      guest_phone: input.guest_phone,
      guest_email: input.guest_email || null,
      room_type_id: roomTypeId,
      room_name: roomType.name,
      room_number: input.room_number || null,
      check_in: checkIn,
      check_out: checkOut,
      adults: input.adults || 2,
      children: input.children || 0,
      rooms_requested: roomsRequested,
      nights,
      booking_status: input.booking_status || 'Confirmed',
      price_per_night: pricePerNight,
      room_subtotal: subtotal,
      tax_amount: tax,
      total_amount: totalAmount,
      payment_status: input.payment_status || 'Pending',
      payment_method: input.payment_method || 'online_razorpay',
      special_request: input.special_request || '',
      internal_notes: input.internal_notes || '',
      booking_source: source,
      source_booking_id: sourceBookingId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });
}

// 8. DATA CONSISTENCY CHECKER (JSON vs PostgreSQL)
export async function postgresCompareDataConsistency(): Promise<{
  isConsistent: boolean;
  mismatches: string[];
  summary: Record<string, { jsonCount: number; pgCount: number }>;
}> {
  if (!pool) throw new Error('PostgreSQL not available');

  const DATA_DIR = process.env.SBM_DATA_DIR
    ? path.resolve(process.env.SBM_DATA_DIR)
    : path.resolve(process.cwd(), 'data');
  const jsonPath = path.join(DATA_DIR, 'sbm_database.json');

  if (!fs.existsSync(jsonPath)) {
    return { isConsistent: true, mismatches: [], summary: {} };
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(rawData);

  const tables = [
    { name: 'properties', jsonArr: data.properties || [] },
    { name: 'room_types', jsonArr: data.room_types || [] },
    { name: 'rooms', jsonArr: data.physical_rooms || [] },
    { name: 'reservations', jsonArr: data.bookings || [] },
    { name: 'channel_configs', jsonArr: data.channels || [] },
    { name: 'channel_room_mappings', jsonArr: data.channel_room_mappings || [] },
    { name: 'channel_rate_mappings', jsonArr: data.channel_rate_mappings || [] },
    { name: 'channel_restrictions', jsonArr: data.channel_restrictions || [] },
    { name: 'channel_sync_jobs', jsonArr: data.sync_jobs || [] }
  ];

  const summary: Record<string, { jsonCount: number; pgCount: number }> = {};
  const mismatches: string[] = [];

  for (const t of tables) {
    const res = await pool.query(`SELECT COUNT(*) FROM ${t.name}`);
    const pgCount = parseInt(res.rows[0].count, 10);
    const jsonCount = t.jsonArr.length;
    summary[t.name] = { jsonCount, pgCount };

    if (jsonCount > 0 && pgCount === 0) {
      mismatches.push(`Table ${t.name} has ${jsonCount} records in JSON but 0 in PostgreSQL`);
    }
  }

  return {
    isConsistent: mismatches.length === 0,
    mismatches,
    summary
  };
}

// 9. RESERVATION QUERIES & CANCELLATIONS
export async function postgresGetReservations(filters?: any): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT * FROM reservations WHERE 1=1';
  const params: any[] = [];

  if (filters?.property_code && filters.property_code !== 'all') {
    params.push(filters.property_code);
    query += ` AND property_code = $${params.length}`;
  }
  if (filters?.booking_status && filters.booking_status !== 'all') {
    params.push(filters.booking_status);
    query += ` AND status = $${params.length}`;
  }
  if (filters?.payment_status && filters.payment_status !== 'all') {
    params.push(filters.payment_status);
    query += ` AND payment_status = $${params.length}`;
  }
  if (filters?.source && filters.source !== 'all') {
    params.push(filters.source);
    query += ` AND source = $${params.length}`;
  }
  if (filters?.search) {
    params.push(`%${filters.search}%`);
    query += ` AND (booking_number ILIKE $${params.length} OR guest_name ILIKE $${params.length} OR guest_phone ILIKE $${params.length} OR source_booking_id ILIKE $${params.length})`;
  }
  if (filters?.startDate) {
    params.push(filters.startDate);
    query += ` AND check_in >= $${params.length}`;
  }
  if (filters?.endDate) {
    params.push(filters.endDate);
    query += ` AND check_out <= $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';

  const res = await pool.query(query, params);
  return res.rows.map(b => ({
    id: b.id,
    booking_number: b.booking_number,
    property_id: b.property_id,
    property_code: b.property_code,
    property_name: b.property_name,
    guest_name: b.guest_name,
    guest_phone: b.guest_phone,
    guest_email: b.guest_email,
    room_type_id: b.room_type_id,
    room_name: b.room_name,
    room_number: b.room_number,
    check_in: b.check_in instanceof Date ? b.check_in.toISOString().split('T')[0] : String(b.check_in).split('T')[0],
    check_out: b.check_out instanceof Date ? b.check_out.toISOString().split('T')[0] : String(b.check_out).split('T')[0],
    adults: b.adults,
    children: b.children,
    rooms_requested: b.rooms_count,
    nights: b.nights,
    booking_status: b.status,
    price_per_night: Number(b.price_per_night),
    room_subtotal: Number(b.subtotal),
    tax_amount: Number(b.tax),
    total_amount: Number(b.total_amount),
    payment_status: b.payment_status,
    payment_method: b.payment_method,
    special_request: b.special_requests,
    internal_notes: b.internal_notes,
    booking_source: b.source,
    source_booking_id: b.source_booking_id,
    created_at: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString(),
    updated_at: b.updated_at ? new Date(b.updated_at).toISOString() : new Date().toISOString()
  }));
}

export async function postgresGetReservationByIdOrNumber(idOrNumber: string, contact?: string): Promise<any | null> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT * FROM reservations WHERE (id = $1 OR booking_number = $1 OR source_booking_id = $1)';
  const params: any[] = [idOrNumber];
  if (contact) {
    params.push(contact);
    query += ` AND (guest_phone = $2 OR guest_email = $2)`;
  }
  const res = await pool.query(query, params);
  if (res.rows.length === 0) return null;
  const b = res.rows[0];
  return {
    id: b.id,
    booking_number: b.booking_number,
    property_id: b.property_id,
    property_code: b.property_code,
    property_name: b.property_name,
    guest_name: b.guest_name,
    guest_phone: b.guest_phone,
    guest_email: b.guest_email,
    room_type_id: b.room_type_id,
    room_name: b.room_name,
    room_number: b.room_number,
    check_in: b.check_in instanceof Date ? b.check_in.toISOString().split('T')[0] : String(b.check_in).split('T')[0],
    check_out: b.check_out instanceof Date ? b.check_out.toISOString().split('T')[0] : String(b.check_out).split('T')[0],
    adults: b.adults,
    children: b.children,
    rooms_requested: b.rooms_count,
    nights: b.nights,
    booking_status: b.status,
    price_per_night: Number(b.price_per_night),
    room_subtotal: Number(b.subtotal),
    tax_amount: Number(b.tax),
    total_amount: Number(b.total_amount),
    payment_status: b.payment_status,
    payment_method: b.payment_method,
    special_request: b.special_requests,
    internal_notes: b.internal_notes,
    booking_source: b.source,
    source_booking_id: b.source_booking_id,
    created_at: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString(),
    updated_at: b.updated_at ? new Date(b.updated_at).toISOString() : new Date().toISOString()
  };
}

export async function postgresCancelReservation(reservationId: string, reason?: string): Promise<any> {
  if (!pool) throw new Error('PostgreSQL not available');
  const res = await pool.query(`
    UPDATE reservations
    SET status = 'Cancelled',
        internal_notes = COALESCE(internal_notes, '') || ' [Cancelled: ' || $1 || ']',
        cancelled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 OR booking_number = $2
    RETURNING *
  `, [reason || 'Customer request', reservationId]);

  if (res.rows.length === 0) throw new Error(`Reservation ${reservationId} not found`);

  // Release reservation rooms
  await pool.query(`
    UPDATE reservation_rooms
    SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
    WHERE reservation_id = $1
  `, [res.rows[0].id]);

  const b = res.rows[0];
  return {
    id: b.id,
    booking_number: b.booking_number,
    property_id: b.property_id,
    property_code: b.property_code,
    property_name: b.property_name,
    guest_name: b.guest_name,
    guest_phone: b.guest_phone,
    guest_email: b.guest_email,
    room_type_id: b.room_type_id,
    room_name: b.room_name,
    room_number: b.room_number,
    check_in: b.check_in instanceof Date ? b.check_in.toISOString().split('T')[0] : String(b.check_in).split('T')[0],
    check_out: b.check_out instanceof Date ? b.check_out.toISOString().split('T')[0] : String(b.check_out).split('T')[0],
    adults: b.adults,
    children: b.children,
    rooms_requested: b.rooms_count,
    nights: b.nights,
    booking_status: b.status,
    price_per_night: Number(b.price_per_night),
    room_subtotal: Number(b.subtotal),
    tax_amount: Number(b.tax),
    total_amount: Number(b.total_amount),
    payment_status: b.payment_status,
    payment_method: b.payment_method,
    special_request: b.special_requests,
    internal_notes: b.internal_notes,
    booking_source: b.source,
    source_booking_id: b.source_booking_id,
    created_at: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString(),
    updated_at: b.updated_at ? new Date(b.updated_at).toISOString() : new Date().toISOString()
  };
}

// 10. INVENTORY AVAILABILITY & LOCKS
export async function postgresCheckAvailability(query: any): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  const propertyCode = query.property_code;
  const checkIn = query.check_in;
  const checkOut = query.check_out;

  let rtQuery = 'SELECT * FROM room_types WHERE status = \'active\'';
  const rtParams: any[] = [];
  if (propertyCode && propertyCode !== 'all') {
    rtParams.push(propertyCode);
    rtQuery += ` AND property_code = $${rtParams.length}`;
  }
  const rtRes = await pool.query(rtQuery, rtParams);

  const results: any[] = [];
  for (const rt of rtRes.rows) {
    const totalRooms = rt.total_rooms || 10;

    // Booked count
    const bookedRes = await pool.query(`
      SELECT COALESCE(SUM(rooms_count), 0) as booked
      FROM reservations
      WHERE property_code = $1
        AND room_type_id = $2
        AND status NOT IN ('Cancelled')
        AND check_in < $3
        AND check_out > $4
    `, [rt.property_code, rt.id, checkOut, checkIn]);
    const booked = parseInt(bookedRes.rows[0].booked, 10) || 0;

    // Blocked count
    const blockedRes = await pool.query(`
      SELECT COALESCE(SUM(quantity), 0) as blocked
      FROM blocked_rooms
      WHERE property_code = $1
        AND room_type_id = $2
        AND start_date < $3
        AND end_date > $4
    `, [rt.property_code, rt.id, checkOut, checkIn]);
    const blocked = parseInt(blockedRes.rows[0].blocked, 10) || 0;

    // Active holds
    const holdRes = await pool.query(`
      SELECT COALESCE(SUM(rooms_count), 0) as held
      FROM inventory_locks
      WHERE room_type_id = $1
        AND status = 'ACTIVE'
        AND expires_at > CURRENT_TIMESTAMP
        AND check_in < $2
        AND check_out > $3
    `, [rt.id, checkOut, checkIn]);
    const held = parseInt(holdRes.rows[0].held, 10) || 0;

    // Restrictions
    const restRes = await pool.query(`
      SELECT stop_sell, closed_to_arrival, closed_to_departure, min_stay, max_stay
      FROM channel_restrictions
      WHERE property_code = $1
        AND (channel_code = 'ALL' OR channel_code = 'DIRECT')
        AND room_type_id = $2
        AND date >= $3
        AND date < $4
    `, [rt.property_code, rt.id, checkIn, checkOut]);

    const stopSell = restRes.rows.some(r => r.stop_sell);
    const cta = restRes.rows.some(r => r.closed_to_arrival);
    const ctd = restRes.rows.some(r => r.closed_to_departure);
    const minStay = restRes.rows.reduce((max, r) => Math.max(max, r.min_stay || 1), 1);
    const maxStay = restRes.rows.reduce((min, r) => Math.min(min, r.max_stay || 30), 30);

    const availableRooms = stopSell ? 0 : Math.max(0, totalRooms - booked - blocked - held);

    results.push({
      roomType: {
        id: rt.id,
        property_id: rt.property_id,
        property_code: rt.property_code,
        room_code: rt.room_code,
        name: rt.name,
        description: rt.description,
        capacity: rt.capacity,
        bed_information: rt.bed_information,
        amenities: typeof rt.amenities === 'string' ? JSON.parse(rt.amenities) : (rt.amenities || []),
        price_per_night: Number(rt.price_per_night),
        tax_percent: Number(rt.tax_percent),
        total_rooms: rt.total_rooms,
        images: typeof rt.images === 'string' ? JSON.parse(rt.images) : (rt.images || []),
        status: rt.status
      },
      availableRooms,
      totalRooms,
      bookedRooms: booked,
      blockedRooms: blocked,
      heldRooms: held,
      isAvailable: availableRooms >= (query.rooms || 1),
      stopSell,
      closedToArrival: cta,
      closedToDeparture: ctd,
      minStay,
      maxStay
    });
  }

  return results;
}

export async function postgresAcquireInventoryLock(lock: any): Promise<void> {
  if (!pool) throw new Error('PostgreSQL not available');
  await pool.query(`
    INSERT INTO inventory_locks (id, property_id, room_type_id, check_in, check_out, rooms_count, session_id, reservation_id, expires_at, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
  `, [
    lock.id,
    lock.property_id,
    lock.room_type_id,
    lock.check_in,
    lock.check_out,
    lock.rooms_count || 1,
    lock.session_id,
    lock.reservation_id || null,
    new Date(lock.expires_at),
    lock.status || 'ACTIVE'
  ]);
}

export async function postgresReleaseInventoryLock(lockIdOrSessionId: string): Promise<void> {
  if (!pool) return;
  await pool.query(`
    UPDATE inventory_locks
    SET status = 'RELEASED'
    WHERE id = $1 OR session_id = $1
  `, [lockIdOrSessionId]);
}

export async function postgresConvertInventoryLock(lockIdOrSessionId: string, reservationId: string): Promise<void> {
  if (!pool) return;
  await pool.query(`
    UPDATE inventory_locks
    SET status = 'CONVERTED', reservation_id = $2
    WHERE id = $1 OR session_id = $1
  `, [lockIdOrSessionId, reservationId]);
}

export async function postgresCleanupExpiredLocks(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    UPDATE inventory_locks
    SET status = 'EXPIRED'
    WHERE status = 'ACTIVE' AND expires_at < CURRENT_TIMESTAMP
  `);
}

// 11. AUDIT LOGS
export async function postgresSaveAuditLog(log: any): Promise<void> {
  if (!pool) return;
  const id = log.id || `act-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  await pool.query(`
    INSERT INTO activities (id, action, description, property_code, reservation_id, performed_by, date, timestamp, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, CURRENT_TIMESTAMP)
  `, [
    id,
    log.action,
    log.description,
    log.propertyCode || log.property_code || null,
    log.reservationId || log.reservation_id || null,
    log.performedBy || log.performed_by || 'Admin',
    log.timestamp || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  ]);
}

export async function postgresGetAuditLogs(filters?: any): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT * FROM activities WHERE 1=1';
  const params: any[] = [];
  if (filters?.channelCode && filters.channelCode !== 'all') {
    params.push(`%${filters.channelCode}%`);
    query += ` AND description ILIKE $${params.length}`;
  }
  if (filters?.action && filters.action !== 'all') {
    params.push(filters.action);
    query += ` AND action = $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';
  if (filters?.limit) {
    params.push(filters.limit);
    query += ` LIMIT $${params.length}`;
  }
  const res = await pool.query(query, params);
  return res.rows.map(r => ({
    id: r.id,
    action: r.action,
    description: r.description,
    property_code: r.property_code,
    reservation_id: r.reservation_id,
    performed_by: r.performed_by,
    date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
    timestamp: r.timestamp,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  }));
}

// 12. PROPERTIES & ROOM TYPES QUERIES
export async function postgresGetProperties(): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  const res = await pool.query('SELECT * FROM properties ORDER BY id ASC');
  return res.rows.map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    address: p.address,
    phone: p.phone,
    landline: p.landline,
    email: p.email,
    images: typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []),
    amenities: typeof p.amenities === 'string' ? JSON.parse(p.amenities) : (p.amenities || []),
    status: p.status
  }));
}

export async function postgresGetRoomTypes(propertyCode?: string): Promise<any[]> {
  if (!pool) throw new Error('PostgreSQL not available');
  let query = 'SELECT * FROM room_types WHERE 1=1';
  const params: any[] = [];
  if (propertyCode && propertyCode !== 'all') {
    params.push(propertyCode);
    query += ` AND property_code = $${params.length}`;
  }
  query += ' ORDER BY id ASC';
  const res = await pool.query(query, params);
  return res.rows.map(rt => ({
    id: rt.id,
    property_id: rt.property_id,
    property_code: rt.property_code,
    room_code: rt.room_code,
    name: rt.name,
    description: rt.description,
    capacity: rt.capacity,
    bed_information: rt.bed_information,
    amenities: typeof rt.amenities === 'string' ? JSON.parse(rt.amenities) : (rt.amenities || []),
    price_per_night: Number(rt.price_per_night),
    tax_percent: Number(rt.tax_percent),
    total_rooms: Number(rt.total_rooms),
    images: typeof rt.images === 'string' ? JSON.parse(rt.images) : (rt.images || []),
    status: rt.status
  }));
}


