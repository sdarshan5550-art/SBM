-- ==========================================================
-- SBM HOTEL & GUEST HOUSE - RELATIONAL PMS DATABASE SCHEMA
-- Target Database: PostgreSQL 14+
-- Properties: SBM Hotel (sbm-hotel), SBM 2 Guest House (sbm-guest-house)
-- Room Categories: Deluxe Room, Family Suite
-- ==========================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROPERTIES TABLE
CREATE TABLE IF NOT EXISTS properties (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    tagline VARCHAR(255),
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(64) DEFAULT 'Salasar',
    state VARCHAR(64) DEFAULT 'Rajasthan',
    country VARCHAR(64) DEFAULT 'India',
    phone VARCHAR(64) NOT NULL,
    landline VARCHAR(64),
    email VARCHAR(128) NOT NULL,
    timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
    currency VARCHAR(8) DEFAULT 'INR',
    check_in_time VARCHAR(16) DEFAULT '12:00 PM',
    check_out_time VARCHAR(16) DEFAULT '11:00 AM',
    images JSONB DEFAULT '[]'::jsonb,
    amenities JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(32) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ROOM TYPES TABLE (Official Categories: Deluxe Room, Family Suite)
CREATE TABLE IF NOT EXISTS room_types (
    id VARCHAR(64) PRIMARY KEY,
    property_id VARCHAR(64) REFERENCES properties(id) ON DELETE CASCADE,
    property_code VARCHAR(32) NOT NULL,
    room_code VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    capacity INT DEFAULT 2,
    bed_information VARCHAR(128),
    amenities JSONB DEFAULT '[]'::jsonb,
    price_per_night NUMERIC(10, 2) NOT NULL,
    tax_percent NUMERIC(5, 2) DEFAULT 12.00,
    total_rooms INT DEFAULT 10,
    images JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(32) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_property_room_code UNIQUE (property_id, room_code)
);

-- 3. PHYSICAL ROOMS TABLE
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(64) PRIMARY KEY,
    property_id VARCHAR(64) REFERENCES properties(id) ON DELETE CASCADE,
    property_code VARCHAR(32) NOT NULL,
    room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE CASCADE,
    room_code VARCHAR(32) NOT NULL,
    room_name VARCHAR(128) NOT NULL,
    room_number VARCHAR(32) NOT NULL,
    floor VARCHAR(32) DEFAULT 'Ground Floor',
    operational_status VARCHAR(32) DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OUT_OF_ORDER', 'BLOCKED'
    housekeeping_status VARCHAR(32) DEFAULT 'CLEAN',    -- 'CLEAN', 'DIRTY', 'CLEANING', 'INSPECTED'
    maintenance_reason TEXT,
    active BOOLEAN DEFAULT TRUE,
    facilities JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    max_guests INT DEFAULT 2,
    bed_type VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_property_room_number UNIQUE (property_id, room_number)
);

-- 4. GUESTS DIRECTORY TABLE
CREATE TABLE IF NOT EXISTS guests (
    id VARCHAR(64) PRIMARY KEY,
    first_name VARCHAR(64),
    last_name VARCHAR(64),
    full_name VARCHAR(128) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(128),
    address TEXT,
    city VARCHAR(64),
    state VARCHAR(64),
    country VARCHAR(64) DEFAULT 'India',
    id_type VARCHAR(32),     -- 'Aadhaar', 'Passport', 'Driving License', 'Voter ID'
    id_number VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);

-- 5. RATE PLANS TABLE (Room-Only Base Plans)
CREATE TABLE IF NOT EXISTS rate_plans (
    id VARCHAR(64) PRIMARY KEY,
    property_id VARCHAR(64) REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(32) NOT NULL,
    meal_plan VARCHAR(32) DEFAULT 'EP', -- EP = European Plan (Room Only)
    base_price NUMERIC(10, 2) NOT NULL,
    cancellation_policy TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. RESERVATIONS TABLE
CREATE TABLE IF NOT EXISTS reservations (
    id VARCHAR(64) PRIMARY KEY,
    booking_number VARCHAR(64) UNIQUE NOT NULL,
    property_id VARCHAR(64) REFERENCES properties(id) ON DELETE RESTRICT,
    property_code VARCHAR(32) NOT NULL,
    property_name VARCHAR(128) NOT NULL,
    guest_id VARCHAR(64) REFERENCES guests(id) ON DELETE SET NULL,
    guest_name VARCHAR(128) NOT NULL,
    guest_phone VARCHAR(32) NOT NULL,
    guest_email VARCHAR(128),
    source VARCHAR(32) DEFAULT 'WEBSITE', -- 'WEBSITE', 'WALK_IN', 'PHONE', 'WHATSAPP', 'ADMIN', 'MMT', 'GOIBIBO', 'BOOKING_COM', 'AGODA', 'OTHER'
    source_booking_id VARCHAR(128),
    room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE RESTRICT,
    room_name VARCHAR(128) NOT NULL,
    room_number VARCHAR(32),              -- Assigned primary physical room number
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    adults INT DEFAULT 2,
    children INT DEFAULT 0,
    rooms_count INT DEFAULT 1,
    nights INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'Confirmed', -- 'Pending', 'Confirmed', 'Checked In', 'Checked Out', 'Cancelled', 'No Show'
    price_per_night NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    tax NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(32) DEFAULT 'Pending', -- 'Pending', 'Paid', 'Partial', 'Failed', 'Refunded'
    payment_method VARCHAR(32),
    special_requests TEXT,
    internal_notes TEXT,
    created_by VARCHAR(64) DEFAULT 'System',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_booking_number ON reservations(booking_number);
CREATE INDEX IF NOT EXISTS idx_reservations_phone ON reservations(guest_phone);

-- 7. RESERVATION ROOMS TABLE (Supports multi-room bookings and distinct room assignments)
CREATE TABLE IF NOT EXISTS reservation_rooms (
    id VARCHAR(64) PRIMARY KEY,
    reservation_id VARCHAR(64) REFERENCES reservations(id) ON DELETE CASCADE,
    room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE RESTRICT,
    room_id VARCHAR(64) REFERENCES rooms(id) ON DELETE SET NULL,
    room_number VARCHAR(32),
    rate_plan_id VARCHAR(64) REFERENCES rate_plans(id) ON DELETE SET NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nightly_rate NUMERIC(10, 2) NOT NULL,
    number_of_nights INT NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE', -- 'ACTIVE', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_res_rooms_dates ON reservation_rooms(room_id, check_in, check_out);

-- 8. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    reservation_id VARCHAR(64) REFERENCES reservations(id) ON DELETE CASCADE,
    provider VARCHAR(32) DEFAULT 'RAZORPAY', -- 'RAZORPAY', 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTA', 'OTHER'
    method VARCHAR(32) NOT NULL,             -- 'RAZORPAY', 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTA', 'OTHER'
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    status VARCHAR(32) DEFAULT 'PAID',       -- 'PENDING', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED'
    transaction_id VARCHAR(128),
    payment_reference VARCHAR(128),
    notes TEXT,
    recorded_by VARCHAR(64) DEFAULT 'System',
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_res_id ON payments(reservation_id);

-- 9. PAYMENT TRANSACTIONS TABLE (Gateway audit & raw webhook payload link)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(64) PRIMARY KEY,
    reservation_id VARCHAR(64) REFERENCES reservations(id) ON DELETE CASCADE,
    provider VARCHAR(32) DEFAULT 'RAZORPAY',
    order_id VARCHAR(128),
    payment_id VARCHAR(128),
    signature VARCHAR(255),
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,             -- 'CREATED', 'SUCCESS', 'FAILED', 'REFUNDED'
    failure_reason TEXT,
    raw_reference JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pay_tx_order ON payment_transactions(order_id);

-- 10. INVENTORY LOCKS / HOLDS TABLE (Prevents double booking during Razorpay checkout)
CREATE TABLE IF NOT EXISTS inventory_locks (
    id VARCHAR(64) PRIMARY KEY,
    property_id VARCHAR(64) REFERENCES properties(id) ON DELETE CASCADE,
    room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE CASCADE,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    rooms_count INT DEFAULT 1,
    session_id VARCHAR(128) NOT NULL,
    reservation_id VARCHAR(64),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE',     -- 'ACTIVE', 'RELEASED', 'EXPIRED', 'CONVERTED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locks_active ON inventory_locks(room_type_id, check_in, check_out, status, expires_at);

-- 11. BLOCKED ROOMS TABLE
CREATE TABLE IF NOT EXISTS blocked_rooms (
    id VARCHAR(64) PRIMARY KEY,
    property_id VARCHAR(64) REFERENCES properties(id) ON DELETE CASCADE,
    property_code VARCHAR(32) NOT NULL,
    room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE CASCADE,
    room_code VARCHAR(32) NOT NULL,
    room_id VARCHAR(64) REFERENCES rooms(id) ON DELETE SET NULL,
    room_number VARCHAR(32),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    quantity INT DEFAULT 1,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS admins (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) DEFAULT 'frontdesk', -- 'superadmin', 'frontdesk'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. AUDIT & FRONT DESK ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activities (
    id VARCHAR(64) PRIMARY KEY,
    action VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    property_code VARCHAR(32),
    reservation_id VARCHAR(64),
    performed_by VARCHAR(64) DEFAULT 'Admin',
    date DATE DEFAULT CURRENT_DATE,
    timestamp VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. INQUIRIES TABLE
CREATE TABLE IF NOT EXISTS inquiries (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(128),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'unread', -- 'unread', 'read', 'resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. HOTEL SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
    hotel_name VARCHAR(128) DEFAULT 'SBM Hotel & SBM 2 Guest House',
    gst_percent NUMERIC(5, 2) DEFAULT 12.00,
    hold_pending_inventory BOOLEAN DEFAULT TRUE,
    cancellation_policy TEXT,
    payment_gateway_mode VARCHAR(16) DEFAULT 'test',
    razorpay_key_id VARCHAR(128),
    currency VARCHAR(8) DEFAULT 'INR',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. KNOWLEDGE BASE TABLE
CREATE TABLE IF NOT EXISTS knowledge_base (
    id VARCHAR(64) PRIMARY KEY,
    category VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. MANAGED IMAGES TABLE
CREATE TABLE IF NOT EXISTS managed_images (
    id VARCHAR(64) PRIMARY KEY,
    image_url TEXT NOT NULL,
    title VARCHAR(255),
    description TEXT,
    category VARCHAR(64) NOT NULL,
    room_id VARCHAR(64),
    property_id VARCHAR(64),
    display_order INT DEFAULT 0,
    is_primary_cover BOOLEAN DEFAULT FALSE,
    is_main_for_room BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 18. FUTURE-READY CHANNEL MANAGER ARCHITECTURE (Disabled in Phase 1)
-- ==========================================================

CREATE TABLE IF NOT EXISTS channel_connections (
    id VARCHAR(64) PRIMARY KEY,
    property_id VARCHAR(64) REFERENCES properties(id) ON DELETE CASCADE,
    channel VARCHAR(32) NOT NULL, -- 'MMT', 'GOIBIBO', 'BOOKING_COM', 'AGODA'
    provider VARCHAR(64) DEFAULT 'Direct / NextGen CM',
    external_property_id VARCHAR(128),
    status VARCHAR(32) DEFAULT 'DISABLED', -- 'DISABLED', 'ACTIVE', 'SYNC_ERROR'
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channel_room_mappings (
    id VARCHAR(64) PRIMARY KEY,
    channel_connection_id VARCHAR(64) REFERENCES channel_connections(id) ON DELETE CASCADE,
    local_room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE CASCADE,
    external_room_type_id VARCHAR(128) NOT NULL,
    external_room_name VARCHAR(128),
    status VARCHAR(32) DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS channel_rate_mappings (
    id VARCHAR(64) PRIMARY KEY,
    channel_connection_id VARCHAR(64) REFERENCES channel_connections(id) ON DELETE CASCADE,
    local_rate_plan_id VARCHAR(64) REFERENCES rate_plans(id) ON DELETE CASCADE,
    external_rate_plan_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS channel_sync_events (
    id VARCHAR(64) PRIMARY KEY,
    channel VARCHAR(32) NOT NULL,
    event_type VARCHAR(64) NOT NULL, -- 'INVENTORY_UPDATE', 'RATE_UPDATE', 'BOOKING_PULL', 'BOOKING_ACK'
    direction VARCHAR(16) NOT NULL,   -- 'INBOUND', 'OUTBOUND'
    reservation_id VARCHAR(64),
    room_type_id VARCHAR(64),
    status VARCHAR(32) DEFAULT 'PENDING',
    attempts INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);
