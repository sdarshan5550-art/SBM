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
    price NUMERIC(10, 2) DEFAULT 2500.00,
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
CREATE INDEX IF NOT EXISTS idx_reservations_source_id ON reservations(source_booking_id);
-- Unique constraint preventing duplicate OTA reservations
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_source_booking ON reservations(source, source_booking_id) WHERE source_booking_id IS NOT NULL;

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
    social_media JSONB DEFAULT '{"instagram":{"platform":"instagram","enabled":true,"url":"https://www.instagram.com/sbmhotel","show_in_header":true,"show_on_contact":true,"show_in_footer":true},"facebook":{"platform":"facebook","enabled":true,"url":"https://www.facebook.com/sbmhotel","show_in_header":true,"show_on_contact":true,"show_in_footer":true}}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15B. SOCIAL MEDIA SETTINGS TABLE (Normalized relational store)
CREATE TABLE IF NOT EXISTS social_media_settings (
    id VARCHAR(64) PRIMARY KEY,
    platform VARCHAR(32) UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    url TEXT NOT NULL,
    show_in_header BOOLEAN DEFAULT TRUE,
    show_on_contact BOOLEAN DEFAULT TRUE,
    show_in_footer BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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
-- 18. AUTHORITATIVE SBM CHANNEL MANAGER TABLES
-- ==========================================================

CREATE TABLE IF NOT EXISTS channel_configs (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(64) NOT NULL,
    type VARCHAR(32) DEFAULT 'OTA',
    enabled BOOLEAN DEFAULT FALSE,
    connection_status VARCHAR(32) DEFAULT 'NOT_CONFIGURED',
    property_code VARCHAR(32) DEFAULT 'both',
    credentials_configured BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}'::jsonb,
    inventory_status VARCHAR(32) DEFAULT 'PENDING',
    rates_status VARCHAR(32) DEFAULT 'PENDING',
    reservations_status VARCHAR(32) DEFAULT 'PENDING',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_successful_sync_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channel_room_mappings (
    id VARCHAR(64) PRIMARY KEY,
    channel_id VARCHAR(64) REFERENCES channel_configs(id) ON DELETE CASCADE,
    channel_code VARCHAR(32) NOT NULL,
    property_code VARCHAR(32) NOT NULL,
    pms_room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE RESTRICT,
    pms_room_type_name VARCHAR(128) NOT NULL,
    channel_room_id VARCHAR(128) NOT NULL,
    channel_room_name VARCHAR(128) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sync_inventory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_channel_room_mapping UNIQUE (channel_id, channel_room_id)
);

CREATE TABLE IF NOT EXISTS channel_rate_mappings (
    id VARCHAR(64) PRIMARY KEY,
    channel_id VARCHAR(64) REFERENCES channel_configs(id) ON DELETE CASCADE,
    channel_code VARCHAR(32) NOT NULL,
    property_code VARCHAR(32) NOT NULL,
    pms_room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE RESTRICT,
    pms_rate_plan_id VARCHAR(64) REFERENCES rate_plans(id) ON DELETE RESTRICT,
    pms_rate_plan_name VARCHAR(128) NOT NULL,
    channel_room_id VARCHAR(128) NOT NULL,
    channel_rate_plan_id VARCHAR(128) NOT NULL,
    channel_rate_plan_name VARCHAR(128) NOT NULL,
    price_multiplier NUMERIC(5, 2) DEFAULT 1.00,
    tax_mode VARCHAR(32) DEFAULT 'INCLUSIVE',
    meal_plan VARCHAR(32) DEFAULT 'EP',
    cancellation_policy VARCHAR(64) DEFAULT 'MODERATE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_channel_rate_mapping UNIQUE (channel_id, channel_rate_plan_id)
);

CREATE TABLE IF NOT EXISTS channel_restrictions (
    id VARCHAR(64) PRIMARY KEY,
    property_code VARCHAR(32) NOT NULL,
    channel_code VARCHAR(32) DEFAULT 'ALL', -- 'ALL', 'DIRECT', 'BOOKING_COM', 'MMT', etc.
    room_type_id VARCHAR(64) REFERENCES room_types(id) ON DELETE CASCADE,
    rate_plan_id VARCHAR(64),
    date DATE NOT NULL,
    stop_sell BOOLEAN DEFAULT FALSE,
    closed_to_arrival BOOLEAN DEFAULT FALSE,
    closed_to_departure BOOLEAN DEFAULT FALSE,
    min_stay INT DEFAULT 1,
    max_stay INT DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_channel_restriction UNIQUE (property_code, channel_code, room_type_id, date)
);

CREATE INDEX IF NOT EXISTS idx_restrictions_lookup ON channel_restrictions(property_code, channel_code, room_type_id, date);
CREATE INDEX IF NOT EXISTS idx_restrictions_date_range ON channel_restrictions(date, property_code);

CREATE TABLE IF NOT EXISTS channel_pending_events (
    id VARCHAR(64) PRIMARY KEY,
    channel VARCHAR(32) NOT NULL,
    external_booking_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL, -- 'CANCELLATION', 'MODIFICATION'
    payload JSONB NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSED', 'EXPIRED'
    retry_count INT DEFAULT 0,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_pending_event UNIQUE (channel, external_booking_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_pending_events_lookup ON channel_pending_events(channel, external_booking_id, status);

CREATE TABLE IF NOT EXISTS channel_sync_jobs (
    id VARCHAR(64) PRIMARY KEY,
    channel_id VARCHAR(64),
    channel_code VARCHAR(32) NOT NULL,
    channel_name VARCHAR(64) NOT NULL,
    property_code VARCHAR(32) NOT NULL,
    room_type_id VARCHAR(64),
    room_name VARCHAR(128),
    operation VARCHAR(64) NOT NULL,
    date_start DATE NOT NULL,
    date_end DATE NOT NULL,
    payload JSONB,
    status VARCHAR(32) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING'
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    worker_id VARCHAR(128),
    processing_started_at TIMESTAMP WITH TIME ZONE,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    duration_ms INT,
    external_reference VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON channel_sync_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_worker ON channel_sync_jobs(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_channel_op ON channel_sync_jobs(channel_code, operation, date_start, date_end);

-- ==========================================================
-- 19. ABOUT PAGE IMAGES TABLE (Admin Dedicated About Page Images)
-- ==========================================================
CREATE TABLE IF NOT EXISTS about_page_images (
    id VARCHAR(64) PRIMARY KEY,
    property_id VARCHAR(64) UNIQUE NOT NULL,
    image_url TEXT NOT NULL,
    title VARCHAR(255),
    caption VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
