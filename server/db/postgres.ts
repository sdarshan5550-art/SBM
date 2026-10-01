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

    await client.query('COMMIT');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 [SBM Hotel PMS] PostgreSQL Database Migration Completed:');
    console.log(`   • Properties:      ${importedProps}`);
    console.log(`   • Room Types:      ${importedRoomTypes}`);
    console.log(`   • Physical Rooms:  ${importedRooms}`);
    console.log(`   • Admins:          ${importedAdmins}`);
    console.log(`   • Reservations:    ${importedBookings}`);
    console.log(`   • Blocked Rooms:   ${importedBlocked}`);
    console.log(`   • Activities:      ${importedActivities}`);
    console.log(`   • Knowledge Items: ${importedKnowledge}`);
    console.log(`   • Managed Images:  ${importedImages}`);
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
