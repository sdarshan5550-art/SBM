export type PropertyCode = 'sbm-hotel' | 'sbm-guest-house';

export type RoomCategoryCode = 'deluxe' | 'family';

export type RoomStatus = 'Available' | 'Reserved' | 'Occupied' | 'Maintenance' | 'Blocked';

export interface PhysicalRoom {
  id: string;
  property_code: PropertyCode;
  property_name: string;
  room_type_id: string;
  room_code: RoomCategoryCode;
  room_name: string; // 'Deluxe Room' | 'Family Suite'
  room_number: string; // e.g., '101', '102', '201'
  floor?: string;
  status: RoomStatus;
  housekeeping_status?: PMSHousekeepingStatus;
  maintenance_reason?: string;
  block_start_date?: string;
  block_end_date?: string;
  block_reason?: string;
  assigned_booking_id?: string;
  current_guest_name?: string;
  check_in_date?: string;
  check_out_date?: string;
  updated_at: string;  
  price?: number;
  facilities?: string[];
  images?: string[];
  description?: string;
  max_guests?: number;
  bed_type?: string;
  room_size?: string;
}

export interface FrontDeskActivity {
  id: string;
  timestamp: string; // e.g. "10:42 AM"
  date: string; // YYYY-MM-DD
  action: 'Check-in' | 'Check-out' | 'Booking' | 'Maintenance' | 'Status Update' | 'Payment';
  description: string;
  property_code?: PropertyCode;
  performed_by?: string;
}

export type KnowledgeCategory =
  | 'Hotel information'
  | 'Property information'
  | 'Room information'
  | 'Amenities'
  | 'Policies'
  | 'FAQs'
  | 'Contact information'
  | 'Local information';

export interface KnowledgeItem {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  updated_at: string;
}

export interface Property {
  id: string;
  code: PropertyCode;
  name: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  landline: string;
  email: string;
  images: string[];
  amenities: string[];
  status: 'active' | 'maintenance';
}

export interface RoomType {
  id: string;
  property_id: string;
  property_code: PropertyCode;
  room_code: RoomCategoryCode;
  name: string; // 'Deluxe Room' | 'Family Suite'
  description: string;
  capacity: number;
  bed_information: string;
  amenities: string[];
  price_per_night: number;
  tax_percent: number;
  total_rooms: number;
  images: string[];
  status: 'active' | 'inactive';
}

export type BookingStatus = 'Pending' | 'Confirmed' | 'Checked In' | 'Checked Out' | 'Cancelled' | 'No Show';
export type PaymentStatus = 'Pending' | 'Completed' | 'Paid' | 'Partial' | 'Failed' | 'Refunded';

export type BookingSource =
  | 'WEBSITE'
  | 'WALK_IN'
  | 'PHONE'
  | 'WHATSAPP'
  | 'ADMIN'
  | 'MMT'
  | 'GOIBIBO'
  | 'BOOKING_COM'
  | 'AGODA'
  | 'OTHER';

export type PMSOperationalStatus = 'AVAILABLE' | 'OUT_OF_ORDER' | 'BLOCKED';
export type PMSHousekeepingStatus = 'CLEAN' | 'DIRTY' | 'CLEANING' | 'INSPECTED';

export interface Guest {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  id_type?: string;
  id_number?: string;
  total_bookings?: number;
  total_spent?: number;
  last_stay?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentRecord {
  id: string;
  reservation_id: string;
  provider: string;
  method: 'RAZORPAY' | 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTA' | 'OTHER' | string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED' | 'REFUNDED' | string;
  transaction_id?: string;
  payment_reference?: string;
  notes?: string;
  recorded_by?: string;
  paid_at: string;
}

export interface Booking {
  id: string;
  booking_number: string; // e.g. SBM-2026-849201
  property_id: string;
  property_code: PropertyCode;
  property_name: string;
  guest_id?: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  guest_address?: string;
  guest_id_type?: string;
  guest_id_number?: string;
  source?: BookingSource;
  room_type_id: string;
  room_name: string; // Deluxe Room or Family Suite
  room_number?: string; // Assigned physical room number e.g. '104'
  adults: number;
  children: number;
  rooms_requested: number;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  nights: number;
  price_per_night: number;
  room_subtotal: number;
  tax_amount: number;
  discount_amount?: number;
  total_amount: number;
  paid_amount?: number;
  outstanding_amount?: number;
  payment_status: PaymentStatus;
  booking_status: BookingStatus;
  payment_method?: 'pay_at_hotel' | 'online_razorpay' | 'upi' | 'CASH' | 'CARD' | 'BANK_TRANSFER' | string;
  payment_txn_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  payment_amount?: number;
  payment_currency?: string;
  payment_verified_at?: string;
  special_request?: string;
  internal_notes?: string;
  created_by?: string;
  source_booking_id?: string;
  created_at: string;
  updated_at: string;
  payments?: PaymentRecord[];
  customer_email_status?: 'pending' | 'sent' | 'failed' | 'simulated';
  admin_email_status?: 'pending' | 'sent' | 'failed' | 'simulated';
  customer_email_sent_at?: string;
  admin_email_sent_at?: string;
  customer_email_error?: string;
  admin_email_error?: string;
}

export interface PMSCalendarData {
  dates: string[];
  startDate: string;
  endDate: string;
  rooms: {
    id: string;
    property_id?: string;
    property_code: PropertyCode;
    property_name: string;
    room_type_id: string;
    room_code: RoomCategoryCode;
    room_name: string;
    room_number: string;
    floor: string;
    operational_status: PMSOperationalStatus;
    housekeeping_status: PMSHousekeepingStatus;
    maintenance_reason?: string;
    active: boolean;
  }[];
  reservations: (Booking & {
    source: BookingSource;
    paid_amount: number;
    outstanding_amount: number;
  })[];
  unassignedReservations: Booking[];
}

export interface PMSDashboardStats {
  today_date: string;
  today_arrivals_count: number;
  today_departures_count: number;
  in_house_guests_count: number;
  in_house_rooms_count: number;
  available_rooms_count: number;
  occupied_rooms_count: number;
  blocked_rooms_count: number;
  occupancy_percentage: number;
  today_revenue: number;
  total_revenue: number;
  pending_payments_amount: number;
  source_breakdown: {
    source: BookingSource;
    count: number;
    revenue: number;
  }[];
  recent_activities: FrontDeskActivity[];
}

export interface PMSReportData {
  period: string;
  startDate: string;
  endDate: string;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  blockedRooms: number;
  occupancyRate: number;
  totalRevenue: number;
  paidRevenue: number;
  outstandingRevenue: number;
  refundedRevenue: number;
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  checkedInBookings: number;
  checkedOutBookings: number;
  totalRoomsSold: number;
  averageDailyRate: number;
  revPAR: number;
  todayArrivalsCount: number;
  todayDeparturesCount: number;
  upcomingArrivalsCount: number;
  upcomingDeparturesCount: number;
  bookingsBySource: {
    source: string;
    count: number;
    revenue: number;
    percentage: number;
  }[];
  roomTypePerformance: {
    roomTypeId: string;
    roomTypeName: string;
    propertyCode: PropertyCode;
    roomsSold: number;
    revenue: number;
    occupancyRate: number;
  }[];
  paymentBreakdown: {
    method: string;
    count: number;
    amount: number;
  }[];
  propertyBreakdown: {
    property_code: PropertyCode;
    property_name: string;
    total_bookings: number;
    revenue: number;
    occupancy_rate: number;
  }[];
  // Backward compatibility snake_case properties
  total_rooms: number;
  occupied_rooms: number;
  available_rooms: number;
  blocked_rooms: number;
  occupancy_rate: number;
  total_revenue: number;
  paid_revenue: number;
  outstanding_revenue: number;
  source_breakdown: {
    source: any;
    count: number;
    revenue: number;
    percentage: number;
  }[];
  property_breakdown: {
    property_code: PropertyCode;
    property_name: string;
    total_bookings: number;
    revenue: number;
    occupancy_rate: number;
  }[];
}

export type PMSReportsData = PMSReportData;

export interface ChannelConnection {
  channel: string;
  name: string;
  enabled: boolean;
  status: 'connected' | 'syncing' | 'disconnected' | 'error';
  last_sync?: string;
  credentials?: Record<string, string>;
}

export interface PaymentConfigResponse {
  key_id: string;
  is_configured: boolean;
  mode: 'test' | 'live';
  currency: string;
}

export interface CreateOrderRequest {
  property_code: PropertyCode;
  room_type_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms: number;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  special_request?: string;
  existing_booking_id?: string;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  booking_id: string;
  booking_number: string;
  total_amount: number;
  customer: {
    name: string;
    email: string;
    contact: string;
  };
}

export interface VerifyPaymentRequest {
  booking_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  booking: Booking;
}

export interface BlockedRoom {
  id: string;
  property_id: string;
  property_code: PropertyCode;
  room_type_id: string;
  room_code: RoomCategoryCode;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD (exclusive)
  quantity: number;
  reason: string;
  created_at: string;
}

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'resolved';
  created_at: string;
}

export interface HotelSettings {
  hotel_name: string;
  gst_percent: number;
  hold_pending_inventory: boolean;
  cancellation_policy: string;
  payment_gateway_mode: 'test' | 'live';
  razorpay_key_id: string;
  currency: string;
}

export interface AvailabilitySearchQuery {
  property_code: PropertyCode | 'both';
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms: number;
}

export interface RoomAvailabilityResult {
  property: Property;
  roomType: RoomType;
  availableRooms: number;
  totalRooms: number;
  isAvailable: boolean;
  nights: number;
  pricePerNight: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export type AdminRole = 'superadmin' | 'frontdesk';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

export type GalleryCategory =
  | 'Property Cover'
  | 'Hotel Exterior'
  | 'Hotel Entrance'
  | 'Lobby'
  | 'Reception'
  | 'Restaurant'
  | 'Common Areas'
  | 'Facilities'
  | 'Food'
  | 'Temple Surroundings'
  | 'Location';

export interface ManagedImage {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
  category: GalleryCategory | 'Deluxe Room' | 'Family Suite' | string;
  roomId?: 'deluxe' | 'family' | string;
  propertyId?: string;
  displayOrder: number;
  isPrimaryCover?: boolean;
  isMainForRoom?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AboutPageImage {
  id: string;
  property_id: 'sbm-hotel' | 'sbm-guest-house' | string;
  image_url: string;
  title?: string;
  caption?: string;
  created_at: string;
  updated_at: string;
}

export interface ConciergeChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  availabilityDetails?: {
    propertyCode: PropertyCode;
    propertyName: string;
    roomCode: RoomCategoryCode;
    roomName: string;
    pricePerNight: number;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    isAvailable: boolean;
    availableRooms: number;
  }[];
  recommendation?: {
    propertyCode: PropertyCode;
    propertyName: string;
    roomCode: RoomCategoryCode;
    roomName: string;
    pricePerNight: number;
    reason: string;
  };
}

// ==========================================
// CHANNEL MANAGER DATA MODELS & TYPES
// ==========================================

export type ChannelCode =
  | 'DIRECT'
  | 'BOOKING_COM'
  | 'MMT'
  | 'GOIBIBO'
  | 'AGODA'
  | 'EXPEDIA'
  | 'OTHER';

export type ChannelType = 'DIRECT' | 'OTA' | 'GDS' | 'METASEARCH';

export type ChannelConnectionStatus =
  | 'CONNECTED'
  | 'NOT_CONFIGURED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'SYNCING';

export type SyncJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type SyncOperation =
  | 'AVAILABILITY_UPDATE'
  | 'RATE_UPDATE'
  | 'RESTRICTION_UPDATE'
  | 'FULL_SYNC'
  | 'RESERVATION_IMPORT';

export interface ChannelConfig {
  id: string;
  code: ChannelCode;
  name: string;
  type: ChannelType;
  enabled: boolean;
  connectionStatus: ChannelConnectionStatus;
  property_code: PropertyCode | 'both';
  credentialsConfigured: boolean;
  settings: {
    autoSyncInventory: boolean;
    autoImportReservations: boolean;
    priceMultiplier?: number;
    webhookEnabled?: boolean;
    accountReference?: string;
  };
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  mappedRoomsCount: number;
  mappedRatePlansCount: number;
}

export interface ChannelRoomMapping {
  id: string;
  channel_id: string;
  channel_code: ChannelCode;
  property_code: PropertyCode;
  pms_room_type_id: string;
  pms_room_type_name: string;
  channel_room_id: string;
  channel_room_name: string;
  is_active: boolean;
  sync_inventory: boolean;
  created_at: string;
  updated_at: string;
}

export interface PMSRatePlan {
  id: string;
  property_code: PropertyCode;
  room_type_id: string;
  name: string;
  code: string;
  meal_plan: 'EP' | 'CP' | 'MAP' | 'AP';
  cancellation_policy: 'FLEXIBLE' | 'MODERATE' | 'NON_REFUNDABLE';
  price_modifier_type: 'PERCENTAGE' | 'FIXED';
  price_modifier_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChannelRateMapping {
  id: string;
  channel_id: string;
  channel_code: ChannelCode;
  property_code: PropertyCode;
  pms_room_type_id: string;
  pms_rate_plan_id: string;
  pms_rate_plan_name: string;
  channel_room_id: string;
  channel_rate_plan_id: string;
  channel_rate_plan_name: string;
  price_multiplier: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncJob {
  id: string;
  channel_id: string;
  channel_code: ChannelCode;
  channel_name: string;
  property_code: PropertyCode;
  room_type_id?: string;
  room_name?: string;
  operation: SyncOperation;
  date_range: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  payload?: any;
  status: SyncJobStatus;
  retry_count: number;
  max_retries: number;
  last_attempt_at?: string;
  error_message?: string;
  duration_ms?: number;
  external_reference?: string;
  created_at: string;
  completed_at?: string;
}

export interface NormalizedOTAReservation {
  externalReservationId: string;
  channel: BookingSource;
  channelCode: ChannelCode;
  propertyCode: PropertyCode;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestAddress?: string;
  roomTypeId: string;
  ratePlanCode?: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults: number;
  children: number;
  rooms: number;
  totalAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  reservationStatus: BookingStatus;
  isCancelled: boolean;
  specialRequests?: string;
  rawPayload?: any;
}

export interface ChannelInventorySummary {
  property_code: PropertyCode;
  date: string;
  room_type_id: string;
  room_name: string;
  total_physical_rooms: number;
  reserved_count: number;
  blocked_count: number;
  out_of_order_count: number;
  available_count: number;
}

