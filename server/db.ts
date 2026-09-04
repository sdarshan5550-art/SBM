import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  Property,
  RoomType,
  Booking,
  BlockedRoom,
  Inquiry,
  HotelSettings,
  AvailabilitySearchQuery,
  RoomAvailabilityResult,
  AdminUser,
  PropertyCode,
  RoomCategoryCode,
  PhysicalRoom,
  FrontDeskActivity,
  KnowledgeItem,
  RoomStatus,
  ManagedImage,
  Guest,
  PaymentRecord,
  BookingSource,
  PMSOperationalStatus,
  PMSHousekeepingStatus,
  ChannelCode,
  ChannelConfig,
  ChannelRoomMapping,
  PMSRatePlan,
  ChannelRateMapping,
  SyncJob,
  SyncJobStatus,
  SyncOperation,
  ChannelInventorySummary
} from '../src/types';
import { DEFAULT_PHOTOS, ROOM_PHOTOS, PROPERTY_PHOTOS } from '../src/data/mockPhotos';

interface DatabaseData {
  properties: Property[];
  room_types: RoomType[];
  bookings: Booking[];
  blocked_rooms: BlockedRoom[];
  inquiries: Inquiry[];
  settings: HotelSettings;
  admin_passwords: { [adminId: string]: string }; // hashed passwords
  admins: AdminUser[];
  physical_rooms: PhysicalRoom[];
  activities: FrontDeskActivity[];
  knowledge_base: KnowledgeItem[];
  managed_images?: ManagedImage[];
  guests?: Guest[];
  payments?: PaymentRecord[];
  inventory_holds?: any[];
  channels?: ChannelConfig[];
  channel_room_mappings?: ChannelRoomMapping[];
  pms_rate_plans?: PMSRatePlan[];
  channel_rate_mappings?: ChannelRateMapping[];
  sync_jobs?: SyncJob[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'sbm_database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_ADMIN_ID = 'admin-1';
const DEFAULT_ADMIN_EMAIL = 'admin@sbmhotel.com';
const FRONTDESK_ADMIN_ID = 'frontdesk-1';
const FRONTDESK_ADMIN_EMAIL = 'frontdesk@sbmhotel.com';

function getInitialData(): DatabaseData {
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('sbmadmin2026!', salt);
  const hashedFrontdeskPassword = bcrypt.hashSync('sbmdesk2026!', salt);

  const properties: Property[] = [
    {
      id: 'prop-sbm-hotel',
      code: 'sbm-hotel',
      name: 'SBM Hotel',
      tagline: 'Adjacent to Salasar Balaji Temple',
      description: 'Experience unmatched spiritual serenity and hospitality in the heart of Salasar, right next to the holy temple.',
      address: 'Main Temple Road, Opposite Salasar Balaji Temple, Salasar, Rajasthan 331506',
      phone: '+91 99835 67921',
      landline: '01568 252186',
      email: 'sbmhotel@gmail.com',
      images: PROPERTY_PHOTOS.sbmHotel,
      amenities: [
        'Temple View / 2 Min Walk',
        'Pure Veg Restaurant',
        '24/7 Hot & Cold Water',
        'Air Conditioned Rooms',
        'High Speed Wi-Fi',
        'Elevator Access',
        'Secure Parking',
        'Power Backup'
      ],
      status: 'active'
    },
    {
      id: 'prop-sbm-guesthouse',
      code: 'sbm-guest-house',
      name: 'SBM 2 Guest House',
      tagline: 'Quiet Comfort near Temple Approach',
      description: 'Peaceful accommodation with modern amenities designed for families and group pilgrims visiting Salasar.',
      address: 'Near Temple Approach Road, Salasar, Rajasthan 331506',
      phone: '+91 98285 00845, +91 98286 36000',
      landline: '01568 294286',
      email: 'sbmguesthouse@gmail.com',
      images: PROPERTY_PHOTOS.sbmGuestHouse,
      amenities: [
        'Quiet Atmosphere',
        'Air Conditioned Rooms',
        'Spacious Family Rooms',
        '24/7 Water Supply',
        'Free Wi-Fi',
        'Private Parking',
        'Travel Assistance'
      ],
      status: 'active'
    }
  ];

  // ONLY TWO ROOM CATEGORIES AS STRICTLY INSTRUCTED
  const roomTypes: RoomType[] = [
    {
      id: 'room-sbm-deluxe',
      property_id: 'prop-sbm-hotel',
      property_code: 'sbm-hotel',
      room_code: 'deluxe',
      name: 'Deluxe Room',
      description: 'Comfortable premium room with modern furnishings, King size bed, and attached pristine bathroom.',
      capacity: 2,
      bed_information: '1 Double / King Bed',
      amenities: [
        'Air Conditioning',
        'Flat Screen TV',
        'Attached Private Bathroom',
        'Geyser for Hot Water',
        'Free Wi-Fi',
        'Daily Housekeeping',
        'Tea/Coffee Maker'
      ],
      price_per_night: 2500,
      tax_percent: 12,
      total_rooms: 10,
      images: ROOM_PHOTOS.sbmDeluxe,
      status: 'active'
    },
    {
      id: 'room-sbm-family',
      property_id: 'prop-sbm-hotel',
      property_code: 'sbm-hotel',
      room_code: 'family',
      name: 'Family Suite',
      description: 'Spacious suite ideal for families and group travelers, featuring dual beds, leather daybed lounge, and extra seating space.',
      capacity: 4,
      bed_information: '2 Double Beds / Family Beds',
      amenities: [
        'Air Conditioning',
        'Smart TV',
        'Large Attached Bathroom',
        'Free High Speed Wi-Fi',
        'Seating Area',
        'Daily Housekeeping',
        '24/7 Room Service'
      ],
      price_per_night: 3500,
      tax_percent: 12,
      total_rooms: 5,
      images: ROOM_PHOTOS.sbmFamily,
      status: 'active'
    },
    {
      id: 'room-gh-deluxe',
      property_id: 'prop-sbm-guesthouse',
      property_code: 'sbm-guest-house',
      room_code: 'deluxe',
      name: 'Deluxe Room',
      description: 'Charming, clean deluxe room offering a restful sleep near Salasar Balaji temple.',
      capacity: 2,
      bed_information: '1 Double Bed',
      amenities: [
        'Air Conditioning',
        'TV',
        'Attached Bathroom',
        'Hot Water Geyser',
        'Wi-Fi',
        'Room Service'
      ],
      price_per_night: 2500,
      tax_percent: 12,
      total_rooms: 8,
      images: ROOM_PHOTOS.ghDeluxe,
      status: 'active'
    },
    {
      id: 'room-gh-family',
      property_id: 'prop-sbm-guesthouse',
      property_code: 'sbm-guest-house',
      room_code: 'family',
      name: 'Family Suite',
      description: 'Generous suite with multiple beds, perfectly suited for family pilgrimage trips.',
      capacity: 5,
      bed_information: '2 Large King Beds',
      amenities: [
        'Air Conditioning',
        'TV',
        'Spacious Bathroom',
        'Geyser',
        'Wi-Fi',
        'Power Backup'
      ],
      price_per_night: 3500,
      tax_percent: 12,
      total_rooms: 4,
      images: ROOM_PHOTOS.ghFamily,
      status: 'active'
    }
  ];

  const now = new Date().toISOString();

  const sampleKnowledge: KnowledgeItem[] = [
    {
      id: 'kb-1',
      category: 'Hotel information',
      title: 'About SBM Hotel & SBM 2 Guest House',
      content: 'SBM Hotel and SBM 2 Guest House are premier family lodgings in Salasar, Rajasthan, located directly adjacent to the holy Salasar Balaji Temple. We offer a 100% pure vegetarian environment, modern air-conditioned rooms, 24/7 hot/cold water, and dedicated pilgrim hospitality.',
      updated_at: now
    },
    {
      id: 'kb-2',
      category: 'Property information',
      title: 'Location & Temple Proximity',
      content: 'SBM Hotel is situated on Main Temple Road, directly opposite Salasar Balaji Temple (a 2-minute walk). SBM 2 Guest House is situated nearby on Temple Approach Road, offering a quiet and peaceful atmosphere for families.',
      updated_at: now
    },
    {
      id: 'kb-3',
      category: 'Room information',
      title: 'Room Types & Pricing',
      content: 'We offer strictly two official room categories: Deluxe Room at ₹2,500/night (suitable for up to 2 guests with 1 King/Double bed) and Family Suite at ₹3,500/night (suitable for 4-5 guests with 2 Double beds). All prices exclude applicable GST (12%).',
      updated_at: now
    },
    {
      id: 'kb-4',
      category: 'Amenities',
      title: 'Room and Hotel Facilities',
      content: 'All rooms include air conditioning, flat-screen TV with satellite channels, attached private bathroom with geyser, free high-speed Wi-Fi, daily housekeeping, 24/7 power backup, pure vegetarian dining, elevator access, and secure parking.',
      updated_at: now
    },
    {
      id: 'kb-5',
      category: 'Policies',
      title: 'Check-in, Check-out & Cancellation',
      content: 'Standard Check-in time is 12:00 PM. Standard Check-out time is 11:00 AM. Cancellation Policy: 100% refund if cancelled 48 hours before check-in. 50% refund within 24-48 hours. No refund for same-day cancellation or no-show.',
      updated_at: now
    },
    {
      id: 'kb-6',
      category: 'Contact information',
      title: 'Official Contact Numbers & Email',
      content: 'SBM Hotel Phone: +91 99835 67921. SBM 2 Guest House Phone: +91 98285 00845, +91 98286 36000. Email: sbmhotel@gmail.com / sbmguesthouse@gmail.com. Reception operates 24/7.',
      updated_at: now
    },
    {
      id: 'kb-7',
      category: 'Local information',
      title: 'Salasar Balaji Temple Darshan Details',
      content: 'Salasar Balaji Temple is open daily for mangla aarti and general darshan. Walking distance from SBM Hotel is under 2 minutes. Auto-rickshaws, taxi assistance, and luggage storage are available at reception.',
      updated_at: now
    }
  ];

  return {
    properties,
    room_types: roomTypes.map(rt => ({ ...rt, total_rooms: 0 })),
    bookings: [],
    blocked_rooms: [],
    inquiries: [],
    settings: {
      hotel_name: 'SBM Hotel',
      gst_percent: 12,
      hold_pending_inventory: true,
      cancellation_policy: 'Full refund if cancelled 48 hours before check-in. 50% refund within 24-48 hours. No refund for same-day cancellation or no-show.',
      payment_gateway_mode: 'test',
      razorpay_key_id: 'rzp_test_sbmhotel2026',
      currency: 'INR'
    },
    admin_passwords: {
      [DEFAULT_ADMIN_ID]: hashedPassword,
      [FRONTDESK_ADMIN_ID]: hashedFrontdeskPassword
    },
    admins: [
      {
        id: DEFAULT_ADMIN_ID,
        name: 'SBM Hotel Admin',
        email: DEFAULT_ADMIN_EMAIL,
        role: 'superadmin'
      },
      {
        id: FRONTDESK_ADMIN_ID,
        name: 'Front Desk Receptionist',
        email: FRONTDESK_ADMIN_EMAIL,
        role: 'frontdesk'
      }
    ],
    physical_rooms: [],
    activities: [],
    knowledge_base: sampleKnowledge,
    managed_images: getInitialManagedImages(now),
    channels: getInitialChannels(now),
    channel_room_mappings: [],
    pms_rate_plans: getInitialPMSRatePlans(now),
    channel_rate_mappings: [],
    sync_jobs: []
  };
}

function getInitialChannels(now: string): ChannelConfig[] {
  return [
    {
      id: 'chan-direct',
      code: 'DIRECT',
      name: 'Direct Website',
      type: 'DIRECT',
      enabled: true,
      connectionStatus: 'CONNECTED',
      property_code: 'both',
      credentialsConfigured: true,
      settings: {
        autoSyncInventory: true,
        autoImportReservations: true,
        priceMultiplier: 1.0,
        accountReference: 'SBM_DIRECT_ENGINE'
      },
      lastSyncAt: now,
      lastSuccessfulSyncAt: now,
      createdAt: now,
      updatedAt: now,
      mappedRoomsCount: 4,
      mappedRatePlansCount: 6
    },
    {
      id: 'chan-booking-com',
      code: 'BOOKING_COM',
      name: 'Booking.com',
      type: 'OTA',
      enabled: false,
      connectionStatus: 'NOT_CONFIGURED',
      property_code: 'both',
      credentialsConfigured: false,
      settings: {
        autoSyncInventory: true,
        autoImportReservations: true,
        priceMultiplier: 1.18,
        webhookEnabled: true
      },
      createdAt: now,
      updatedAt: now,
      mappedRoomsCount: 0,
      mappedRatePlansCount: 0
    },
    {
      id: 'chan-mmt',
      code: 'MMT',
      name: 'MakeMyTrip',
      type: 'OTA',
      enabled: false,
      connectionStatus: 'NOT_CONFIGURED',
      property_code: 'both',
      credentialsConfigured: false,
      settings: {
        autoSyncInventory: true,
        autoImportReservations: true,
        priceMultiplier: 1.15,
        webhookEnabled: true
      },
      createdAt: now,
      updatedAt: now,
      mappedRoomsCount: 0,
      mappedRatePlansCount: 0
    },
    {
      id: 'chan-goibibo',
      code: 'GOIBIBO',
      name: 'Goibibo',
      type: 'OTA',
      enabled: false,
      connectionStatus: 'NOT_CONFIGURED',
      property_code: 'both',
      credentialsConfigured: false,
      settings: {
        autoSyncInventory: true,
        autoImportReservations: true,
        priceMultiplier: 1.15,
        webhookEnabled: true
      },
      createdAt: now,
      updatedAt: now,
      mappedRoomsCount: 0,
      mappedRatePlansCount: 0
    },
    {
      id: 'chan-agoda',
      code: 'AGODA',
      name: 'Agoda',
      type: 'OTA',
      enabled: false,
      connectionStatus: 'NOT_CONFIGURED',
      property_code: 'both',
      credentialsConfigured: false,
      settings: {
        autoSyncInventory: true,
        autoImportReservations: true,
        priceMultiplier: 1.18,
        webhookEnabled: true
      },
      createdAt: now,
      updatedAt: now,
      mappedRoomsCount: 0,
      mappedRatePlansCount: 0
    },
    {
      id: 'chan-expedia',
      code: 'EXPEDIA',
      name: 'Expedia',
      type: 'OTA',
      enabled: false,
      connectionStatus: 'NOT_CONFIGURED',
      property_code: 'both',
      credentialsConfigured: false,
      settings: {
        autoSyncInventory: true,
        autoImportReservations: true,
        priceMultiplier: 1.20,
        webhookEnabled: true
      },
      createdAt: now,
      updatedAt: now,
      mappedRoomsCount: 0,
      mappedRatePlansCount: 0
    },
    {
      id: 'chan-other',
      code: 'OTHER',
      name: 'Other Channels (GDS / Metasearch)',
      type: 'OTA',
      enabled: false,
      connectionStatus: 'NOT_CONFIGURED',
      property_code: 'both',
      credentialsConfigured: false,
      settings: {
        autoSyncInventory: false,
        autoImportReservations: false,
        priceMultiplier: 1.0
      },
      createdAt: now,
      updatedAt: now,
      mappedRoomsCount: 0,
      mappedRatePlansCount: 0
    }
  ];
}

function getInitialPMSRatePlans(now: string): PMSRatePlan[] {
  return [
    {
      id: 'rate-sbm-deluxe-ep',
      property_code: 'sbm-hotel',
      room_type_id: 'room-sbm-deluxe',
      name: 'Standard Room Only (EP)',
      code: 'EP-STD',
      meal_plan: 'EP',
      cancellation_policy: 'FLEXIBLE',
      price_modifier_type: 'PERCENTAGE',
      price_modifier_value: 0,
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'rate-sbm-deluxe-cp',
      property_code: 'sbm-hotel',
      room_type_id: 'room-sbm-deluxe',
      name: 'Prasad & Breakfast Plan (CP)',
      code: 'CP-PRASAD',
      meal_plan: 'CP',
      cancellation_policy: 'FLEXIBLE',
      price_modifier_type: 'FIXED',
      price_modifier_value: 350,
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'rate-sbm-deluxe-nref',
      property_code: 'sbm-hotel',
      room_type_id: 'room-sbm-deluxe',
      name: 'Non-Refundable Promo Rate',
      code: 'NON-REF',
      meal_plan: 'EP',
      cancellation_policy: 'NON_REFUNDABLE',
      price_modifier_type: 'PERCENTAGE',
      price_modifier_value: -10,
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'rate-sbm-family-ep',
      property_code: 'sbm-hotel',
      room_type_id: 'room-sbm-family',
      name: 'Family Suite Standard (EP)',
      code: 'EP-FAM',
      meal_plan: 'EP',
      cancellation_policy: 'FLEXIBLE',
      price_modifier_type: 'PERCENTAGE',
      price_modifier_value: 0,
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'rate-sbm-family-cp',
      property_code: 'sbm-hotel',
      room_type_id: 'room-sbm-family',
      name: 'Family Suite with Prasad & Breakfast (CP)',
      code: 'CP-FAM-PRASAD',
      meal_plan: 'CP',
      cancellation_policy: 'FLEXIBLE',
      price_modifier_type: 'FIXED',
      price_modifier_value: 600,
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'rate-gh-deluxe-ep',
      property_code: 'sbm-guest-house',
      room_type_id: 'room-guesthouse-deluxe',
      name: 'Guest House Deluxe Standard (EP)',
      code: 'EP-GH-DLX',
      meal_plan: 'EP',
      cancellation_policy: 'FLEXIBLE',
      price_modifier_type: 'PERCENTAGE',
      price_modifier_value: 0,
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'rate-gh-deluxe-cp',
      property_code: 'sbm-guest-house',
      room_type_id: 'room-guesthouse-deluxe',
      name: 'Guest House Deluxe with Breakfast (CP)',
      code: 'CP-GH-DLX',
      meal_plan: 'CP',
      cancellation_policy: 'FLEXIBLE',
      price_modifier_type: 'FIXED',
      price_modifier_value: 300,
      is_active: true,
      created_at: now,
      updated_at: now
    },
    {
      id: 'rate-gh-family-ep',
      property_code: 'sbm-guest-house',
      room_type_id: 'room-guesthouse-family',
      name: 'Guest House Family Standard (EP)',
      code: 'EP-GH-FAM',
      meal_plan: 'EP',
      cancellation_policy: 'FLEXIBLE',
      price_modifier_type: 'PERCENTAGE',
      price_modifier_value: 0,
      is_active: true,
      created_at: now,
      updated_at: now
    }
  ];
}

function getInitialManagedImages(now: string): ManagedImage[] {
  return [
    // Dedicated Property Cover Images
    {
      id: 'img-prop-cover-sbm-hotel-1',
      imageUrl: DEFAULT_PHOTOS.sbmHotelExterior,
      title: 'SBM Hotel - Primary Facade & Temple Approach',
      description: 'Main Temple Road Facade directly opposite Salasar Balaji Temple',
      category: 'Property Cover',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      isPrimaryCover: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-prop-cover-sbm-hotel-2',
      imageUrl: DEFAULT_PHOTOS.sbmHotelEvening,
      title: 'SBM Hotel - Evening Twilight Lighting',
      description: 'Warm architectural night illumination and exterior facade',
      category: 'Property Cover',
      propertyId: 'sbm-hotel',
      displayOrder: 2,
      isPrimaryCover: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-prop-cover-sbm-gh-1',
      imageUrl: DEFAULT_PHOTOS.sbmGuestHouseExterior,
      title: 'SBM 2 Guest House - Main Entrance & Facade',
      description: 'Peaceful facade and courtyard along Temple Approach Road',
      category: 'Property Cover',
      propertyId: 'sbm-guest-house',
      displayOrder: 1,
      isPrimaryCover: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-prop-cover-sbm-gh-2',
      imageUrl: DEFAULT_PHOTOS.sbmEntranceFacade,
      title: 'SBM 2 Guest House - Approach Pathway',
      description: 'Welcoming front entrance and pathway for devotee families',
      category: 'Property Cover',
      propertyId: 'sbm-guest-house',
      displayOrder: 2,
      isPrimaryCover: false,
      createdAt: now,
      updatedAt: now
    },

    // Deluxe Room
    {
      id: 'img-deluxe-1',
      imageUrl: DEFAULT_PHOTOS.deluxeRoom,
      title: 'Deluxe Room - Master King Bed',
      description: 'King Bed with Cushioned Leather Headboard and side tables',
      category: 'Deluxe Room',
      roomId: 'deluxe',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      isPrimaryCover: true,
      isMainForRoom: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-deluxe-2',
      imageUrl: DEFAULT_PHOTOS.deluxeSeating,
      title: 'Deluxe Room - Private Seating Area',
      description: 'Comfortable sofa seating with tea table',
      category: 'Deluxe Room',
      roomId: 'deluxe',
      propertyId: 'sbm-hotel',
      displayOrder: 2,
      isPrimaryCover: false,
      isMainForRoom: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-deluxe-3',
      imageUrl: DEFAULT_PHOTOS.deluxeLounge,
      title: 'Deluxe Room - Corner Lounge & Vanity',
      description: 'Work desk and private vanity access',
      category: 'Deluxe Room',
      roomId: 'deluxe',
      propertyId: 'sbm-hotel',
      displayOrder: 3,
      isPrimaryCover: false,
      isMainForRoom: false,
      createdAt: now,
      updatedAt: now
    },

    // Family Suite
    {
      id: 'img-family-1',
      imageUrl: DEFAULT_PHOTOS.familySuite,
      title: 'Family Suite - Main Bedroom Layout',
      description: 'Spacious dual beds for group and family devotees',
      category: 'Family Suite',
      roomId: 'family',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      isPrimaryCover: true,
      isMainForRoom: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-family-2',
      imageUrl: DEFAULT_PHOTOS.familySuiteTV,
      title: 'Family Suite - Smart TV & Daybed Lounge',
      description: 'Smart TV entertainment unit, leather daybed and lounge space',
      category: 'Family Suite',
      roomId: 'family',
      propertyId: 'sbm-hotel',
      displayOrder: 2,
      isPrimaryCover: false,
      isMainForRoom: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-family-3',
      imageUrl: DEFAULT_PHOTOS.deluxeLounge,
      title: 'Family Suite - Seating & Storage Area',
      description: 'Spacious luggage storage and seating corner',
      category: 'Family Suite',
      roomId: 'family',
      propertyId: 'sbm-hotel',
      displayOrder: 3,
      isPrimaryCover: false,
      isMainForRoom: false,
      createdAt: now,
      updatedAt: now
    },

    // Hotel Exterior
    {
      id: 'img-hotel-ext-1',
      imageUrl: DEFAULT_PHOTOS.sbmHotelExterior,
      title: 'SBM Hotel - Day Exterior Facade',
      description: 'Main Temple Road Facade opposite Salasar Balaji Temple',
      category: 'Hotel Exterior',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      isPrimaryCover: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-hotel-eve-1',
      imageUrl: DEFAULT_PHOTOS.sbmHotelEvening,
      title: 'SBM Hotel - Evening Twilight View',
      description: 'Warm architectural night lighting and exterior illumination',
      category: 'Hotel Exterior',
      propertyId: 'sbm-hotel',
      displayOrder: 2,
      isPrimaryCover: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-gh-ext-1',
      imageUrl: DEFAULT_PHOTOS.sbmGuestHouseExterior,
      title: 'SBM 2 Guest House - Front View',
      description: 'Peaceful facade on Temple Approach Road',
      category: 'Hotel Exterior',
      propertyId: 'sbm-guest-house',
      displayOrder: 1,
      isPrimaryCover: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-gh-ent-1',
      imageUrl: DEFAULT_PHOTOS.sbmEntranceFacade,
      title: 'SBM 2 Guest House - Entrance Pathway',
      description: 'Welcoming front entrance and peaceful pathway for devotees',
      category: 'Hotel Entrance',
      propertyId: 'sbm-guest-house',
      displayOrder: 2,
      isPrimaryCover: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'img-gh-eve-1',
      imageUrl: DEFAULT_PHOTOS.sbmHotelEvening,
      title: 'SBM 2 Guest House - Evening View',
      description: 'Serene twilight ambiance along Temple Approach Road',
      category: 'Hotel Exterior',
      propertyId: 'sbm-guest-house',
      displayOrder: 3,
      isPrimaryCover: false,
      createdAt: now,
      updatedAt: now
    },

    // Hotel Entrance
    {
      id: 'img-hotel-ent-1',
      imageUrl: DEFAULT_PHOTOS.sbmEntranceFacade,
      title: 'SBM Hotel - Welcome Entrance',
      description: 'Driveway & Temple View Entrance Walkway',
      category: 'Hotel Entrance',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      isPrimaryCover: false,
      createdAt: now,
      updatedAt: now
    },

    // Lobby
    {
      id: 'img-hotel-lobby-1',
      imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
      title: 'Hotel Main Lobby',
      description: 'Welcoming air-conditioned lobby lounge with comfortable seating for arriving guests',
      category: 'Lobby',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      createdAt: now,
      updatedAt: now
    },

    // Reception
    {
      id: 'img-hotel-rec-1',
      imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      title: '24/7 Reception Desk',
      description: 'Front desk check-in counter and concierge assistance',
      category: 'Reception',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      createdAt: now,
      updatedAt: now
    },

    // Restaurant
    {
      id: 'img-hotel-rest-1',
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
      title: 'Pure Veg Dining Hall',
      description: 'Hygienic pure vegetarian dining for devotees and families',
      category: 'Restaurant',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      createdAt: now,
      updatedAt: now
    },

    // Common Areas
    {
      id: 'img-hotel-comm-1',
      imageUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&q=80',
      title: 'Spacious Hallways & Elevator Access',
      description: 'Wide well-lit corridors and elevator access to all floors',
      category: 'Common Areas',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      createdAt: now,
      updatedAt: now
    },

    // Facilities
    {
      id: 'img-hotel-fac-1',
      imageUrl: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80',
      title: 'Secure Parking & Backup Facility',
      description: 'Dedicated on-site vehicle parking with 24/7 security and power backup',
      category: 'Facilities',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      createdAt: now,
      updatedAt: now
    },

    // Food
    {
      id: 'img-hotel-food-1',
      imageUrl: 'https://images.unsplash.com/photo-1613292443284-c7702f2c7a9c?auto=format&fit=crop&w=1200&q=80',
      title: 'Traditional Rajasthani Thali & Refreshments',
      description: 'Freshly prepared pure vegetarian meals, chai, and breakfast for pilgrims',
      category: 'Food',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      createdAt: now,
      updatedAt: now
    },

    // Temple Surroundings
    {
      id: 'img-hotel-temple-1',
      imageUrl: 'https://images.unsplash.com/photo-1609766857041-ed402ea8069a?auto=format&fit=crop&w=1200&q=80',
      title: 'Salasar Balaji Temple Area',
      description: 'Salasar Balaji Temple street view directly across from SBM Hotel',
      category: 'Temple Surroundings',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      createdAt: now,
      updatedAt: now
    },

    // Location
    {
      id: 'img-hotel-loc-1',
      imageUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80',
      title: 'Salasar Dham Road',
      description: 'Convenient access on Main Temple Road with easy pilgrimage navigation',
      category: 'Location',
      propertyId: 'sbm-hotel',
      displayOrder: 1,
      createdAt: now,
      updatedAt: now
    }
  ];
}

class DatabaseService {
  private data: DatabaseData;

  constructor() {
    this.data = this.loadData();
    this.syncRoomTypeImages();
    this.syncPropertyImages();
  }

  private loadData(): DatabaseData {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed: DatabaseData = JSON.parse(raw);
        // Ensure default properties / admin exist
        if (!parsed.admin_passwords) {
          parsed.admin_passwords = {};
        }
        if (Array.isArray(parsed.admins)) {
          const salt = bcrypt.genSaltSync(10);
          const defaultHash = bcrypt.hashSync('sbmadmin2026!', salt);
          for (const adm of parsed.admins) {
            if (!parsed.admin_passwords[adm.id]) {
              parsed.admin_passwords[adm.id] = defaultHash;
            }
          }
        }
        if (!parsed.managed_images || parsed.managed_images.length === 0) {
          parsed.managed_images = getInitialManagedImages(new Date().toISOString());
        } else {
          // If existing database does not have Property Cover images, inject initial ones
          const hasPropertyCovers = parsed.managed_images.some(img => img.category === 'Property Cover');
          if (!hasPropertyCovers) {
            const initialCovers = getInitialManagedImages(new Date().toISOString()).filter(img => img.category === 'Property Cover');
            parsed.managed_images = [...initialCovers, ...parsed.managed_images];
          }
        }

        // Initialize Channel Manager tables if not present
        const now = new Date().toISOString();
        if (!parsed.channels || parsed.channels.length === 0) {
          parsed.channels = getInitialChannels(now);
        }
        if (!parsed.pms_rate_plans || parsed.pms_rate_plans.length === 0) {
          parsed.pms_rate_plans = getInitialPMSRatePlans(now);
        }
        if (!parsed.channel_room_mappings) {
          parsed.channel_room_mappings = [];
        }
        if (!parsed.channel_rate_mappings) {
          parsed.channel_rate_mappings = [];
        }
        if (!parsed.sync_jobs) {
          parsed.sync_jobs = [];
        }

        return parsed;
      }
    } catch (err) {
      console.error('Error loading database file, falling back to initial seed data', err);
    }
    const init = getInitialData();
    this.saveDataDirect(init);
    return init;
  }

  private saveDataDirect(data: DatabaseData) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save database file', err);
    }
  }

  public save() {
    this.saveDataDirect(this.data);
  }

  // --- PROPERTIES ---
  public getProperties(): Property[] {
    this.syncPropertyImages();
    return this.data.properties;
  }

  public getPropertyByCode(code: string): Property | undefined {
    this.syncPropertyImages();
    return this.data.properties.find(p => p.code === code || p.id === code);
  }

  public updateProperty(id: string, updates: Partial<Property>): Property {
    const idx = this.data.properties.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Property not found');
    this.data.properties[idx] = { ...this.data.properties[idx], ...updates };
    this.save();
    return this.data.properties[idx];
  }

  // --- ROOM TYPES ---
  public getRoomTypes(propertyCode?: string): RoomType[] {
    if (!propertyCode || propertyCode === 'both') {
      return this.data.room_types;
    }
    return this.data.room_types.filter(
      r => r.property_code === propertyCode || r.property_id === propertyCode
    );
  }

  public updateRoomType(id: string, updates: Partial<RoomType>): RoomType {
    const idx = this.data.room_types.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Room type not found');
    this.data.room_types[idx] = { ...this.data.room_types[idx], ...updates };
    this.save();
    return this.data.room_types[idx];
  }

  // --- AVAILABILITY ENGINE ---
  // Calculates real available rooms for a date range [checkIn, checkOut)
  public checkAvailability(query: AvailabilitySearchQuery): RoomAvailabilityResult[] {
    const checkInDate = new Date(query.check_in);
    const checkOutDate = new Date(query.check_out);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
      throw new Error('Invalid check-in or check-out dates.');
    }

    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Target room types
    let targetRooms = this.data.room_types.filter(r => r.status === 'active');
    if (query.property_code && query.property_code !== 'both') {
      targetRooms = targetRooms.filter(r => r.property_code === query.property_code);
    }

    // Filter by guest capacity if required
    const totalGuests = Number(query.adults || 1) + Number(query.children || 0);

    const results: RoomAvailabilityResult[] = [];

    // Helper: generate array of night date strings 'YYYY-MM-DD'
    const nightsList: string[] = [];
    const cur = new Date(checkInDate);
    while (cur < checkOutDate) {
      nightsList.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    const holdPending = this.data.settings.hold_pending_inventory;

    for (const room of targetRooms) {
      const property = this.data.properties.find(p => p.id === room.property_id || p.code === room.property_code);
      if (!property) continue;

      // Find max occupancy for any night in stay
      let maxOccupied = 0;

      for (const nightDate of nightsList) {
        // Bookings occupying this night
        const activeBookings = this.data.bookings.filter(b => {
          if (b.room_type_id !== room.id) return false;
          if (b.booking_status === 'Cancelled' || b.booking_status === 'No Show') return false;
          if (b.booking_status === 'Pending' && !holdPending) return false;
          // Check if nightDate falls inside [b.check_in, b.check_out)
          return b.check_in <= nightDate && nightDate < b.check_out;
        });

        const bookedCount = activeBookings.reduce((sum, b) => sum + (b.rooms_requested || 1), 0);

        // Blocked rooms covering this night
        const blocks = this.data.blocked_rooms.filter(blk => {
          if (blk.room_type_id !== room.id) return false;
          return blk.start_date <= nightDate && nightDate < blk.end_date;
        });

        const blockedCount = blocks.reduce((sum, blk) => sum + (blk.quantity || 1), 0);

        const occupiedOnNight = bookedCount + blockedCount;
        if (occupiedOnNight > maxOccupied) {
          maxOccupied = occupiedOnNight;
        }
      }

      const availableCount = Math.max(0, room.total_rooms - maxOccupied);
      const isCapacityOk = room.capacity >= Math.ceil(totalGuests / (query.rooms || 1));
      const isAvailable = availableCount >= (query.rooms || 1) && isCapacityOk;

      const subtotal = room.price_per_night * nights * (query.rooms || 1);
      const taxAmount = Math.round(subtotal * (this.data.settings.gst_percent / 100));
      const totalAmount = subtotal + taxAmount;

      results.push({
        property,
        roomType: room,
        availableRooms: availableCount,
        totalRooms: room.total_rooms,
        isAvailable,
        nights,
        pricePerNight: room.price_per_night,
        subtotal,
        taxAmount,
        totalAmount
      });
    }

    return results;
  }

  // --- BOOKING OPERATIONS ---
  public createBooking(bookingData: Omit<Booking, 'id' | 'booking_number' | 'created_at' | 'updated_at'>): Booking {
    // 0. Contact Number & Gmail Validation
    const cleanPhone = (bookingData.guest_phone || '').trim();
    const cleanEmail = (bookingData.guest_email || '').trim().toLowerCase();

    const isPhoneValid = /^[0-9]{10}$/.test(cleanPhone);
    const isEmailValid = /^[a-z0-9._%+-]+@gmail\.com$/.test(cleanEmail);

    if (!isPhoneValid || !isEmailValid) {
      if (!isPhoneValid && !isEmailValid) {
        throw new Error('Please enter a valid 10-digit mobile number and Gmail address ending with @gmail.com.');
      } else if (!isPhoneValid) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      } else {
        throw new Error('Please enter a valid Gmail address ending with @gmail.com.');
      }
    }

    bookingData.guest_phone = cleanPhone;
    bookingData.guest_email = cleanEmail;

    // 1. Double booking validation server-side
    const avail = this.checkAvailability({
      property_code: bookingData.property_code,
      check_in: bookingData.check_in,
      check_out: bookingData.check_out,
      adults: bookingData.adults,
      children: bookingData.children,
      rooms: bookingData.rooms_requested
    });

    const targetRes = avail.find(a => a.roomType.id === bookingData.room_type_id);

    if (!targetRes || targetRes.availableRooms < bookingData.rooms_requested) {
      throw new Error(`Sorry, only ${targetRes ? targetRes.availableRooms : 0} room(s) available for the selected dates.`);
    }

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const bookingNumber = `SBM-2026-${randomSuffix}`;
    const now = new Date().toISOString();

    const newBooking: Booking = {
      ...bookingData,
      id: `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      booking_number: bookingNumber,
      created_at: now,
      updated_at: now
    };

    this.data.bookings.unshift(newBooking);
    this.save();
    return newBooking;
  }

  public getBookings(filters?: {
    property_code?: string;
    booking_status?: string;
    payment_status?: string;
    search?: string;
    date?: string;
  }): Booking[] {
    let list = [...this.data.bookings];

    if (filters?.property_code && filters.property_code !== 'all') {
      list = list.filter(b => b.property_code === filters.property_code);
    }
    if (filters?.booking_status && filters.booking_status !== 'all') {
      list = list.filter(b => b.booking_status === filters.booking_status);
    }
    if (filters?.payment_status && filters.payment_status !== 'all') {
      list = list.filter(b => b.payment_status === filters.payment_status);
    }
    if (filters?.date) {
      list = list.filter(b => b.check_in <= filters.date! && filters.date! < b.check_out);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        b =>
          b.booking_number.toLowerCase().includes(q) ||
          b.guest_name.toLowerCase().includes(q) ||
          b.guest_phone.includes(q) ||
          b.guest_email.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getBookingByIdOrNumber(identifier: string, contact?: string): Booking | undefined {
    const q = identifier.trim().toUpperCase();
    const booking = this.data.bookings.find(
      b => b.booking_number.toUpperCase() === q || b.id === identifier
    );

    if (!booking) return undefined;

    if (contact) {
      const c = contact.trim().toLowerCase();
      const matchPhone = booking.guest_phone.replace(/\D/g, '').includes(c.replace(/\D/g, ''));
      const matchEmail = booking.guest_email.toLowerCase() === c;
      if (!matchPhone && !matchEmail) {
        return undefined; // Verification mismatch
      }
    }

    return booking;
  }

  public getBookingByRazorpayOrderId(orderId: string): Booking | undefined {
    if (!orderId) return undefined;
    return this.data.bookings.find(b => b.razorpay_order_id === orderId);
  }

  public getBookingByRazorpayPaymentId(paymentId: string): Booking | undefined {
    if (!paymentId) return undefined;
    return this.data.bookings.find(b => b.razorpay_payment_id === paymentId || b.payment_txn_id === paymentId);
  }

  public updateBooking(id: string, updates: Partial<Booking>): Booking {
    const idx = this.data.bookings.findIndex(b => b.id === id);
    if (idx === -1) throw new Error('Booking not found');

    const updated = {
      ...this.data.bookings[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };

    this.data.bookings[idx] = updated;
    this.save();
    return updated;
  }

  // --- BLOCKED ROOMS ---
  public getBlockedRooms(): BlockedRoom[] {
    return this.data.blocked_rooms;
  }

  public createBlockedRoom(blk: Omit<BlockedRoom, 'id' | 'created_at'>): BlockedRoom {
    const newBlk: BlockedRoom = {
      ...blk,
      id: `blk-${Date.now()}`,
      created_at: new Date().toISOString()
    };
    this.data.blocked_rooms.push(newBlk);
    this.save();
    return newBlk;
  }

  public deleteBlockedRoom(id: string): boolean {
    const initLen = this.data.blocked_rooms.length;
    this.data.blocked_rooms = this.data.blocked_rooms.filter(b => b.id !== id);
    if (this.data.blocked_rooms.length !== initLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- INQUIRIES ---
  public getInquiries(): Inquiry[] {
    return this.data.inquiries.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public createInquiry(inq: Omit<Inquiry, 'id' | 'status' | 'created_at'>): Inquiry {
    const newInq: Inquiry = {
      ...inq,
      id: `inq-${Date.now()}`,
      status: 'unread',
      created_at: new Date().toISOString()
    };
    this.data.inquiries.unshift(newInq);
    this.save();
    return newInq;
  }

  public updateInquiryStatus(id: string, status: 'unread' | 'read' | 'resolved'): Inquiry {
    const idx = this.data.inquiries.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Inquiry not found');
    this.data.inquiries[idx].status = status;
    this.save();
    return this.data.inquiries[idx];
  }

  public deleteInquiry(id: string): boolean {
    const initLen = this.data.inquiries.length;
    this.data.inquiries = this.data.inquiries.filter(i => i.id !== id);
    if (this.data.inquiries.length !== initLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- PHYSICAL ROOMS & VISUAL INVENTORY ---
  public getPhysicalRooms(propertyCode?: string, targetDate?: string): PhysicalRoom[] {
    if (!this.data.physical_rooms) {
      this.data.physical_rooms = [];
    }
    const dateStr = targetDate || new Date().toISOString().split('T')[0];

    let list = [...this.data.physical_rooms];
    if (propertyCode && propertyCode !== 'all' && propertyCode !== 'both') {
      list = list.filter(r => r.property_code === propertyCode);
    }

    // Dynamic calculated status for targetDate
    return list.map(room => {
      // 1. Check Maintenance
      if (room.status === 'Maintenance' && !room.block_end_date) {
        return room;
      }
      // 2. Check Blocked dates
      if (room.block_start_date && room.block_end_date) {
        if (room.block_start_date <= dateStr && dateStr < room.block_end_date) {
          return { ...room, status: 'Blocked' };
        }
      }
      // 3. Check active bookings covering targetDate
      const activeBooking = this.data.bookings.find(b => {
        if (b.property_code !== room.property_code) return false;
        if (b.room_name !== room.room_name && b.room_type_id !== room.room_type_id) return false;
        if (b.booking_status === 'Cancelled' || b.booking_status === 'No Show' || b.booking_status === 'Checked Out') return false;
        // Check if room number matches or matches assigned booking
        if (b.room_number && b.room_number !== room.room_number) return false;
        return b.check_in <= dateStr && dateStr < b.check_out;
      });

      if (activeBooking) {
        const calculatedStatus: RoomStatus = activeBooking.booking_status === 'Checked In' ? 'Occupied' : 'Reserved';
        return {
          ...room,
          status: calculatedStatus,
          assigned_booking_id: activeBooking.id,
          current_guest_name: activeBooking.guest_name,
          check_in_date: activeBooking.check_in,
          check_out_date: activeBooking.check_out
        };
      }

      // Default
      if (room.status === 'Occupied' || room.status === 'Reserved') {
        return {
          ...room,
          status: 'Available',
          assigned_booking_id: undefined,
          current_guest_name: undefined,
          check_in_date: undefined,
          check_out_date: undefined
        };
      }

      return room;
    });
  }

  public updatePhysicalRoom(id: string, updates: Partial<PhysicalRoom>): PhysicalRoom {
    if (!this.data.physical_rooms) this.data.physical_rooms = [];
    const idx = this.data.physical_rooms.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Physical room not found.');

    const updated = {
      ...this.data.physical_rooms[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.data.physical_rooms[idx] = updated;
    this.save();
    return updated;
  }

  public addPhysicalRoom(roomData: Omit<PhysicalRoom, 'id' | 'updated_at'>): PhysicalRoom {
    if (!this.data.physical_rooms) this.data.physical_rooms = [];
    // Check duplicate room number in property
    const existing = this.data.physical_rooms.find(
      r => r.property_code === roomData.property_code && r.room_number.trim() === roomData.room_number.trim()
    );
    if (existing) {
      throw new Error(`Room number ${roomData.room_number} already exists in ${roomData.property_name || roomData.property_code}.`);
    }

    const newRoom: PhysicalRoom = {
      ...roomData,
      room_number: roomData.room_number.trim(),
      id: `rm-${roomData.property_code}-${roomData.room_number.trim()}`,
      updated_at: new Date().toISOString()
    };
    this.data.physical_rooms.push(newRoom);
    this.syncRoomCounts();
    this.save();
    return newRoom;
  }

  public deletePhysicalRoom(id: string): boolean {
    if (!this.data.physical_rooms) this.data.physical_rooms = [];
    const initialLen = this.data.physical_rooms.length;
    this.data.physical_rooms = this.data.physical_rooms.filter(r => r.id !== id && r.room_number !== id);
    const deleted = this.data.physical_rooms.length < initialLen;
    if (deleted) {
      this.syncRoomCounts();
      this.save();
    }
    return deleted;
  }

  // Synchronize room count statistics on room_types according to actual physical rooms
  public syncRoomCounts(): void {
    if (!this.data.room_types) return;
    const physicalRooms = this.data.physical_rooms || [];
    for (const rt of this.data.room_types) {
      const count = physicalRooms.filter(
        pr => (pr.property_code === rt.property_code || pr.property_name === rt.property_id) &&
              (pr.room_type_id === rt.id || pr.room_code === rt.room_code)
      ).length;
      rt.total_rooms = count;
    }
  }

  // Complete Production Clean Reset for Testing
  public resetTestData(performedBy: string = 'SuperAdmin'): { success: boolean; message: string } {
    this.data.bookings = [];
    this.data.physical_rooms = [];
    this.data.activities = [];
    this.data.blocked_rooms = [];
    this.data.inquiries = [];

    // Reset room category counts to 0
    if (this.data.room_types) {
      for (const rt of this.data.room_types) {
        rt.total_rooms = 0;
      }
    }

    // Add clean start audit log
    const now = new Date();
    const act: FrontDeskActivity = {
      id: `act-${Date.now()}`,
      timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      date: now.toISOString().split('T')[0],
      action: 'Maintenance',
      description: `PMS Test Data Reset performed by ${performedBy}. Clean state ready for real room entry.`,
      property_code: 'sbm-hotel',
      performed_by: performedBy
    };
    this.data.activities.push(act);

    this.save();
    return {
      success: true,
      message: 'All test rooms, bookings, guests, payments, and front-desk activities have been completely reset.'
    };
  }

  // --- FRONT DESK ACTIVITIES ---
  public getActivities(propertyCode?: string): FrontDeskActivity[] {
    if (!this.data.activities) this.data.activities = [];
    let list = [...this.data.activities];
    if (propertyCode && propertyCode !== 'all') {
      list = list.filter(a => !a.property_code || a.property_code === propertyCode);
    }
    return list.slice(0, 50); // latest 50
  }

  public addActivity(
    action: FrontDeskActivity['action'],
    description: string,
    property_code?: PropertyCode,
    performed_by: string = 'Front Desk'
  ): FrontDeskActivity {
    if (!this.data.activities) this.data.activities = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];

    const act: FrontDeskActivity = {
      id: `act-${Date.now()}`,
      timestamp: timeStr,
      date: dateStr,
      action,
      description,
      property_code,
      performed_by
    };
    this.data.activities.unshift(act);
    this.save();
    return act;
  }

  // --- CHECK-IN / CHECK-OUT ENGINE ---
  public checkInBooking(bookingId: string, roomNumber?: string): Booking {
    const idx = this.data.bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) throw new Error('Booking not found');

    const booking = this.data.bookings[idx];
    const assignedRoom = roomNumber || booking.room_number || '104';

    const updated: Booking = {
      ...booking,
      booking_status: 'Checked In',
      room_number: assignedRoom,
      updated_at: new Date().toISOString()
    };

    this.data.bookings[idx] = updated;

    // Update physical room status
    if (this.data.physical_rooms) {
      const pRoomIdx = this.data.physical_rooms.findIndex(
        r => r.property_code === booking.property_code && r.room_number === assignedRoom
      );
      if (pRoomIdx !== -1) {
        this.data.physical_rooms[pRoomIdx].status = 'Occupied';
        this.data.physical_rooms[pRoomIdx].assigned_booking_id = booking.id;
        this.data.physical_rooms[pRoomIdx].current_guest_name = booking.guest_name;
        this.data.physical_rooms[pRoomIdx].check_in_date = booking.check_in;
        this.data.physical_rooms[pRoomIdx].check_out_date = booking.check_out;
      }
    }

    this.addActivity('Check-in', `${booking.guest_name} checked in — Room ${assignedRoom} (${booking.property_name})`, booking.property_code);
    this.save();
    return updated;
  }

  public checkOutBooking(bookingId: string): Booking {
    const idx = this.data.bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) throw new Error('Booking not found');

    const booking = this.data.bookings[idx];

    const updated: Booking = {
      ...booking,
      booking_status: 'Checked Out',
      updated_at: new Date().toISOString()
    };

    this.data.bookings[idx] = updated;

    // Free physical room
    if (this.data.physical_rooms) {
      const pRoomIdx = this.data.physical_rooms.findIndex(
        r => r.assigned_booking_id === booking.id || (r.property_code === booking.property_code && r.room_number === booking.room_number)
      );
      if (pRoomIdx !== -1) {
        this.data.physical_rooms[pRoomIdx].status = 'Available';
        this.data.physical_rooms[pRoomIdx].assigned_booking_id = undefined;
        this.data.physical_rooms[pRoomIdx].current_guest_name = undefined;
      }
    }

    this.addActivity('Check-out', `${booking.guest_name} checked out — ${booking.room_name} ${booking.room_number ? 'Room ' + booking.room_number : ''}`, booking.property_code);
    this.save();
    return updated;
  }

  // --- PMS METHODS ---

  // 1. Create Reservation PMS (supports all sources, auto guest creation, payment recording)
  public createReservationPMS(input: {
    property_code: PropertyCode;
    room_type_id: string;
    check_in: string;
    check_out: string;
    adults?: number;
    children?: number;
    rooms?: number;
    guest_name: string;
    guest_phone: string;
    guest_email?: string;
    guest_address?: string;
    guest_id_type?: string;
    guest_id_number?: string;
    source?: BookingSource;
    source_booking_id?: string;
    room_number?: string;
    payment_method?: string;
    initial_payment_amount?: number;
    initial_payment_method?: string;
    special_request?: string;
    internal_notes?: string;
    created_by?: string;
  }): Booking {
    const roomType = this.data.room_types.find(r => r.id === input.room_type_id || r.room_code === input.room_type_id);
    if (!roomType) throw new Error('Invalid room type selected.');

    const property = this.data.properties.find(p => p.code === input.property_code || p.id === input.property_code);
    if (!property) throw new Error('Invalid property selected.');

    const checkInDate = new Date(input.check_in);
    const checkOutDate = new Date(input.check_out);
    const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
    const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const roomsCount = input.rooms || 1;
    const pricePerNight = roomType.price_per_night;
    const subtotal = pricePerNight * nights * roomsCount;
    const tax = Math.round(subtotal * (this.data.settings.gst_percent / 100));
    const totalAmount = subtotal + tax;

    // Upsert guest record
    const guest = this.upsertGuest({
      fullName: input.guest_name,
      phone: input.guest_phone,
      email: input.guest_email,
      address: input.guest_address,
      idType: input.guest_id_type,
      idNumber: input.guest_id_number
    });

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const bookingNumber = `SBM-2026-${randomSuffix}`;
    const now = new Date().toISOString();
    const reservationId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let initialPaymentStatus: any = 'Pending';
    let paidAmount = 0;

    const newBooking: Booking = {
      id: reservationId,
      booking_number: bookingNumber,
      property_id: property.id,
      property_code: property.code as PropertyCode,
      property_name: property.name,
      guest_id: guest.id,
      guest_name: input.guest_name.trim(),
      guest_phone: input.guest_phone.trim(),
      guest_email: (input.guest_email || '').trim(),
      guest_address: input.guest_address,
      guest_id_type: input.guest_id_type,
      guest_id_number: input.guest_id_number,
      source: input.source || 'WEBSITE',
      room_type_id: roomType.id,
      room_name: roomType.name,
      room_number: input.room_number || undefined,
      adults: input.adults || 2,
      children: input.children || 0,
      rooms_requested: roomsCount,
      check_in: input.check_in,
      check_out: input.check_out,
      nights,
      price_per_night: pricePerNight,
      room_subtotal: subtotal,
      tax_amount: tax,
      total_amount: totalAmount,
      paid_amount: 0,
      outstanding_amount: totalAmount,
      payment_status: initialPaymentStatus,
      booking_status: 'Confirmed',
      payment_method: input.payment_method || (input.source === 'WALK_IN' ? 'CASH' : 'online_razorpay'),
      special_request: input.special_request || '',
      internal_notes: input.internal_notes || '',
      created_by: input.created_by || 'Front Desk',
      created_at: now,
      updated_at: now
    };

    // If initial payment provided (e.g. at front desk)
    if (input.initial_payment_amount && input.initial_payment_amount > 0) {
      paidAmount = input.initial_payment_amount;
      const outstanding = Math.max(0, totalAmount - paidAmount);
      newBooking.paid_amount = paidAmount;
      newBooking.outstanding_amount = outstanding;
      newBooking.payment_status = outstanding === 0 ? 'Paid' : 'Partial';

      if (!this.data.payments) this.data.payments = [];
      this.data.payments.push({
        id: `pay-${Date.now()}`,
        reservation_id: reservationId,
        provider: input.initial_payment_method || 'CASH',
        method: input.initial_payment_method || 'CASH',
        amount: paidAmount,
        currency: 'INR',
        status: 'PAID',
        transaction_id: `txn-pms-${Date.now()}`,
        payment_reference: `Initial ${input.initial_payment_method || 'CASH'} payment`,
        notes: `Initial advance collected at booking creation`,
        recorded_by: input.created_by || 'Front Desk',
        paid_at: now
      });
    }

    this.data.bookings.unshift(newBooking);

    // Update physical room status if room assigned
    if (input.room_number && this.data.physical_rooms) {
      const pIdx = this.data.physical_rooms.findIndex(
        r => r.property_code === property.code && r.room_number === input.room_number
      );
      if (pIdx !== -1) {
        this.data.physical_rooms[pIdx].status = 'Reserved';
        this.data.physical_rooms[pIdx].assigned_booking_id = reservationId;
        this.data.physical_rooms[pIdx].current_guest_name = input.guest_name;
        this.data.physical_rooms[pIdx].check_in_date = input.check_in;
        this.data.physical_rooms[pIdx].check_out_date = input.check_out;
      }
    }

    this.save();
    return newBooking;
  }

  // 2. Get Reservations PMS with enriched payment totals
  public getReservationsPMS(filters?: {
    property_code?: string;
    booking_status?: string;
    payment_status?: string;
    search?: string;
    date?: string;
    source?: string;
  }): Booking[] {
    let list = this.getBookings({
      property_code: filters?.property_code,
      booking_status: filters?.booking_status,
      payment_status: filters?.payment_status,
      search: filters?.search,
      date: filters?.date
    });

    if (filters?.source && filters.source !== 'all') {
      list = list.filter(b => (b.source || 'WEBSITE') === filters.source);
    }

    return list.map(b => {
      const payments = this.getPaymentsForReservation(b.id);
      const paid = payments.reduce((sum, p) => sum + (p.status === 'PAID' ? Number(p.amount) : 0), 0);
      const total = Number(b.total_amount) || 0;
      const outstanding = Math.max(0, total - paid);

      return {
        ...b,
        paid_amount: paid,
        outstanding_amount: outstanding,
        payments
      };
    });
  }

  public getReservationById(id: string): Booking | undefined {
    const booking = this.data.bookings.find(b => b.id === id);
    if (!booking) return undefined;
    const payments = this.getPaymentsForReservation(id);
    const paid = payments.reduce((sum, p) => sum + (p.status === 'PAID' ? Number(p.amount) : 0), 0);
    return {
      ...booking,
      paid_amount: paid,
      outstanding_amount: Math.max(0, Number(booking.total_amount) - paid),
      payments
    };
  }

  public getReservationByIdOrNumber(idOrNumber: string, contact?: string): Booking | null {
    const booking = this.data.bookings.find(b => {
      const idMatch = b.id === idOrNumber || b.booking_number.toUpperCase() === idOrNumber.toUpperCase();
      if (!idMatch) return false;
      if (contact) {
        const cleanContact = contact.replace(/[^0-9a-zA-Z@.]/g, '').toLowerCase();
        const guestPhone = (b.guest_phone || '').replace(/[^0-9]/g, '');
        const guestEmail = (b.guest_email || '').toLowerCase();
        return guestPhone.includes(cleanContact) || guestEmail.includes(cleanContact);
      }
      return true;
    });
    if (!booking) return null;
    return this.getReservationById(booking.id) || null;
  }

  // 3. Change room assignment
  public changeReservationRoom(id: string, newRoomNumber: string): Booking {
    const idx = this.data.bookings.findIndex(b => b.id === id);
    if (idx === -1) throw new Error('Reservation not found');

    const booking = this.data.bookings[idx];
    const oldRoomNumber = booking.room_number;

    booking.room_number = newRoomNumber;
    booking.updated_at = new Date().toISOString();

    // Release old room
    if (oldRoomNumber && this.data.physical_rooms) {
      const oldIdx = this.data.physical_rooms.findIndex(
        r => r.property_code === booking.property_code && r.room_number === oldRoomNumber
      );
      if (oldIdx !== -1 && this.data.physical_rooms[oldIdx].assigned_booking_id === id) {
        this.data.physical_rooms[oldIdx].status = 'Available';
        this.data.physical_rooms[oldIdx].assigned_booking_id = undefined;
        this.data.physical_rooms[oldIdx].current_guest_name = undefined;
      }
    }

    // Assign new room
    if (this.data.physical_rooms) {
      const newIdx = this.data.physical_rooms.findIndex(
        r => r.property_code === booking.property_code && r.room_number === newRoomNumber
      );
      if (newIdx !== -1) {
        this.data.physical_rooms[newIdx].status = booking.booking_status === 'Checked In' ? 'Occupied' : 'Reserved';
        this.data.physical_rooms[newIdx].assigned_booking_id = id;
        this.data.physical_rooms[newIdx].current_guest_name = booking.guest_name;
        this.data.physical_rooms[newIdx].check_in_date = booking.check_in;
        this.data.physical_rooms[newIdx].check_out_date = booking.check_out;
      }
    }

    this.save();
    return booking;
  }

  // 4. Cancel Reservation PMS
  public cancelReservationPMS(id: string, reason?: string): Booking {
    const idx = this.data.bookings.findIndex(b => b.id === id);
    if (idx === -1) throw new Error('Reservation not found');

    const booking = this.data.bookings[idx];
    booking.booking_status = 'Cancelled';
    booking.internal_notes = booking.internal_notes ? `${booking.internal_notes}\nCancellation Reason: ${reason || 'N/A'}` : `Cancellation Reason: ${reason || 'N/A'}`;
    booking.updated_at = new Date().toISOString();

    // Release physical room
    if (booking.room_number && this.data.physical_rooms) {
      const pIdx = this.data.physical_rooms.findIndex(
        r => r.property_code === booking.property_code && r.room_number === booking.room_number
      );
      if (pIdx !== -1 && this.data.physical_rooms[pIdx].assigned_booking_id === id) {
        this.data.physical_rooms[pIdx].status = 'Available';
        this.data.physical_rooms[pIdx].assigned_booking_id = undefined;
        this.data.physical_rooms[pIdx].current_guest_name = undefined;
      }
    }

    this.save();
    return booking;
  }

  // 5. Verify physical room availability for stay dates
  public isPhysicalRoomAvailableForDates(
    propertyCode: string,
    roomNumber: string,
    checkIn: string,
    checkOut: string,
    excludeBookingId?: string
  ): boolean {
    const pRoom = this.data.physical_rooms?.find(
      r => r.property_code === propertyCode && r.room_number === roomNumber
    );
    if (!pRoom) return false;
    if (pRoom.status === 'Maintenance' && !pRoom.block_end_date) return false;

    // Check overlapping bookings assigned to this room
    const conflict = this.data.bookings.find(b => {
      if (b.id === excludeBookingId) return false;
      if (b.property_code !== propertyCode) return false;
      if (b.room_number !== roomNumber) return false;
      if (b.booking_status === 'Cancelled' || b.booking_status === 'No Show' || b.booking_status === 'Checked Out') return false;
      // Date overlap
      return b.check_in < checkOut && checkIn < b.check_out;
    });

    return !conflict;
  }

  public getPhysicalRoomById(id: string): PhysicalRoom | undefined {
    return this.data.physical_rooms?.find(r => r.id === id);
  }

  public updateHousekeepingStatus(id: string, housekeeping_status: PMSHousekeepingStatus, performed_by: string = 'Staff'): PhysicalRoom {
    if (!this.data.physical_rooms) this.data.physical_rooms = [];
    const idx = this.data.physical_rooms.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Physical room not found.');

    const room = this.data.physical_rooms[idx];
    (room as any).housekeeping_status = housekeeping_status;
    room.updated_at = new Date().toISOString();

    this.addActivity('Status Update', `Housekeeping updated: Room ${room.room_number} marked as ${housekeeping_status}`, room.property_code, performed_by);
    this.save();
    return room;
  }

  public updateOperationalStatus(id: string, operational_status: PMSOperationalStatus, reason?: string, performed_by: string = 'Admin'): PhysicalRoom {
    if (!this.data.physical_rooms) this.data.physical_rooms = [];
    const idx = this.data.physical_rooms.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Physical room not found.');

    const room = this.data.physical_rooms[idx];
    room.status = operational_status === 'OUT_OF_ORDER' ? 'Maintenance' : (operational_status === 'BLOCKED' ? 'Blocked' : 'Available');
    room.maintenance_reason = reason;
    room.updated_at = new Date().toISOString();

    this.addActivity('Maintenance', `Room ${room.room_number} status set to ${operational_status}${reason ? ' (' + reason + ')' : ''}`, room.property_code, performed_by);
    this.save();
    return room;
  }

  // --- PAYMENTS ---
  public recordPaymentForReservation(params: {
    reservationId: string;
    method: string;
    amount: number;
    transactionId?: string;
    paymentReference?: string;
    notes?: string;
    recordedBy?: string;
  }): { payment: PaymentRecord; updatedBooking: Booking } {
    if (!this.data.payments) this.data.payments = [];
    const idx = this.data.bookings.findIndex(b => b.id === params.reservationId);
    if (idx === -1) throw new Error('Reservation not found.');

    const booking = this.data.bookings[idx];
    const now = new Date().toISOString();

    const payment: PaymentRecord = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      reservation_id: params.reservationId,
      provider: params.method,
      method: params.method,
      amount: Number(params.amount),
      currency: 'INR',
      status: 'PAID',
      transaction_id: params.transactionId || `txn-${Date.now()}`,
      payment_reference: params.paymentReference || `${params.method} payment`,
      notes: params.notes,
      recorded_by: params.recordedBy || 'Front Desk',
      paid_at: now
    };

    this.data.payments.push(payment);

    // Re-calculate booking paid amount
    const allPayments = this.getPaymentsForReservation(booking.id);
    const totalPaid = allPayments.reduce((sum, p) => sum + (p.status === 'PAID' ? Number(p.amount) : 0), 0);
    const totalAmount = Number(booking.total_amount) || 0;
    const outstanding = Math.max(0, totalAmount - totalPaid);

    booking.paid_amount = totalPaid;
    booking.outstanding_amount = outstanding;
    booking.payment_status = outstanding === 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');
    booking.updated_at = now;

    this.addActivity(
      'Payment',
      `Recorded ₹${params.amount.toLocaleString('en-IN')} payment (${params.method}) for ${booking.guest_name} (${booking.booking_number})`,
      booking.property_code,
      params.recordedBy || 'Front Desk'
    );

    this.save();
    return { payment, updatedBooking: booking };
  }

  public getPaymentsForReservation(reservationId: string): PaymentRecord[] {
    if (!this.data.payments) return [];
    return this.data.payments.filter(p => p.reservation_id === reservationId);
  }

  public getAllPayments(filters?: { propertyCode?: string; method?: string; startDate?: string; endDate?: string }): PaymentRecord[] {
    if (!this.data.payments) return [];
    let list = [...this.data.payments];

    if (filters?.startDate && filters?.endDate) {
      list = list.filter(p => {
        const paidDate = p.paid_at.split('T')[0];
        return paidDate >= filters.startDate! && paidDate <= filters.endDate!;
      });
    }

    if (filters?.method && filters.method !== 'all') {
      list = list.filter(p => p.method === filters.method);
    }

    return list.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
  }

  // --- GUESTS DIRECTORY ---
  public getGuests(search?: string): Guest[] {
    if (!this.data.guests) this.data.guests = [];

    // Populate guest list dynamically from bookings if guests list is small
    const phoneMap = new Map<string, Guest>();
    for (const g of this.data.guests) {
      phoneMap.set(g.phone, g);
    }

    // Enrich from all bookings
    for (const b of this.data.bookings) {
      if (!b.guest_phone) continue;
      const cleanPhone = b.guest_phone.trim();
      const existing = phoneMap.get(cleanPhone) || {
        id: b.guest_id || `guest-${cleanPhone.replace(/\D/g, '') || Math.random().toString(36).substring(7)}`,
        full_name: b.guest_name,
        phone: cleanPhone,
        email: b.guest_email || '',
        address: b.guest_address || '',
        id_type: b.guest_id_type || 'Aadhaar',
        id_number: b.guest_id_number || '',
        total_bookings: 0,
        total_spent: 0,
        last_stay: b.check_in,
        created_at: b.created_at
      };

      existing.total_bookings = (existing.total_bookings || 0) + 1;
      existing.total_spent = (existing.total_spent || 0) + (Number(b.total_amount) || 0);
      if (!existing.last_stay || b.check_in > existing.last_stay) {
        existing.last_stay = b.check_in;
      }
      phoneMap.set(cleanPhone, existing);
    }

    let guests = Array.from(phoneMap.values());

    if (search) {
      const q = search.toLowerCase();
      guests = guests.filter(
        g =>
          g.full_name.toLowerCase().includes(q) ||
          g.phone.includes(q) ||
          (g.email && g.email.toLowerCase().includes(q))
      );
    }

    return guests;
  }

  public getGuestById(id: string): Guest | null {
    const guests = this.getGuests();
    return guests.find(g => g.id === id) || null;
  }

  public upsertGuest(data: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    idType?: string;
    idNumber?: string;
  }): Guest {
    if (!this.data.guests) this.data.guests = [];
    const cleanPhone = data.phone.trim();
    const idx = this.data.guests.findIndex(g => g.phone === cleanPhone);

    const now = new Date().toISOString();

    if (idx !== -1) {
      const updated: Guest = {
        ...this.data.guests[idx],
        full_name: data.fullName.trim(),
        email: data.email?.trim() || this.data.guests[idx].email,
        address: data.address || this.data.guests[idx].address,
        id_type: data.idType || this.data.guests[idx].id_type,
        id_number: data.idNumber || this.data.guests[idx].id_number,
        updated_at: now
      };
      this.data.guests[idx] = updated;
      this.save();
      return updated;
    }

    const newGuest: Guest = {
      id: `guest-${cleanPhone.replace(/\D/g, '') || Date.now()}`,
      full_name: data.fullName.trim(),
      phone: cleanPhone,
      email: data.email?.trim() || '',
      address: data.address || '',
      city: data.city || 'Salasar',
      state: data.state || 'Rajasthan',
      country: data.country || 'India',
      id_type: data.idType || 'Aadhaar',
      id_number: data.idNumber || '',
      total_bookings: 1,
      total_spent: 0,
      created_at: now,
      updated_at: now
    };

    this.data.guests.push(newGuest);
    this.save();
    return newGuest;
  }

  public updateGuest(id: string, updates: Partial<Guest>): Guest {
    if (!this.data.guests) this.data.guests = [];
    const idx = this.data.guests.findIndex(g => g.id === id);
    if (idx === -1) throw new Error('Guest not found');

    const updated = {
      ...this.data.guests[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.data.guests[idx] = updated;
    this.save();
    return updated;
  }

  // --- INVENTORY HOLDS ---
  public registerInventoryHold(lock: any): void {
    if (!this.data.inventory_holds) this.data.inventory_holds = [];
    this.data.inventory_holds.push(lock);
  }

  public releaseInventoryHold(lockId: string): void {
    if (!this.data.inventory_holds) return;
    this.data.inventory_holds = this.data.inventory_holds.filter((l: any) => l.id !== lockId);
  }

  // --- KNOWLEDGE BASE ---
  public getKnowledgeBase(category?: string): KnowledgeItem[] {
    if (!this.data.knowledge_base) this.data.knowledge_base = [];
    if (category && category !== 'all') {
      return this.data.knowledge_base.filter(k => k.category === category);
    }
    return this.data.knowledge_base;
  }

  public addKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'updated_at'>): KnowledgeItem {
    if (!this.data.knowledge_base) this.data.knowledge_base = [];
    const newItem: KnowledgeItem = {
      ...item,
      id: `kb-${Date.now()}`,
      updated_at: new Date().toISOString()
    };
    this.data.knowledge_base.unshift(newItem);
    this.save();
    return newItem;
  }

  public updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): KnowledgeItem {
    if (!this.data.knowledge_base) this.data.knowledge_base = [];
    const idx = this.data.knowledge_base.findIndex(k => k.id === id);
    if (idx === -1) throw new Error('Knowledge base item not found');

    const updated = {
      ...this.data.knowledge_base[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.data.knowledge_base[idx] = updated;
    this.save();
    return updated;
  }

  public deleteKnowledgeItem(id: string): boolean {
    if (!this.data.knowledge_base) this.data.knowledge_base = [];
    const len = this.data.knowledge_base.length;
    this.data.knowledge_base = this.data.knowledge_base.filter(k => k.id !== id);
    if (this.data.knowledge_base.length !== len) {
      this.save();
      return true;
    }
    return false;
  }

  // --- SETTINGS ---
  public getSettings(): HotelSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<HotelSettings>): HotelSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    return this.data.settings;
  }

  // --- ADMIN AUTH ---
  public validateAdminPassword(email: string, pass: string): AdminUser | null {
    const admin = this.data.admins?.find(a => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!admin) return null;
    if (!this.data.admin_passwords) {
      this.data.admin_passwords = {};
    }
    let hash = this.data.admin_passwords[admin.id];
    if (!hash) {
      const salt = bcrypt.genSaltSync(10);
      hash = bcrypt.hashSync('sbmadmin2026!', salt);
      this.data.admin_passwords[admin.id] = hash;
      this.save();
    }
    const valid = bcrypt.compareSync(pass, hash);
    return valid ? admin : null;
  }

  // --- CHANNEL MANAGER ENGINE & PERSISTENCE ---
  public getChannels(): ChannelConfig[] {
    if (!this.data.channels) {
      this.data.channels = getInitialChannels(new Date().toISOString());
    }
    if (!this.data.channel_room_mappings) this.data.channel_room_mappings = [];
    if (!this.data.channel_rate_mappings) this.data.channel_rate_mappings = [];

    // Dynamically calculate mapping counts
    return this.data.channels.map(channel => {
      const mappedRooms = this.data.channel_room_mappings?.filter(m => m.channel_id === channel.id || m.channel_code === channel.code).length || 0;
      const mappedRates = this.data.channel_rate_mappings?.filter(m => m.channel_id === channel.id || m.channel_code === channel.code).length || 0;
      return {
        ...channel,
        mappedRoomsCount: channel.code === 'DIRECT' ? 4 : mappedRooms,
        mappedRatePlansCount: channel.code === 'DIRECT' ? 6 : mappedRates
      };
    });
  }

  public getChannelById(id: string): ChannelConfig | undefined {
    return this.getChannels().find(c => c.id === id || c.code === id);
  }

  public updateChannelConfig(id: string, updates: Partial<ChannelConfig>): ChannelConfig {
    if (!this.data.channels) this.data.channels = getInitialChannels(new Date().toISOString());
    const idx = this.data.channels.findIndex(c => c.id === id || c.code === id);
    if (idx === -1) throw new Error(`Channel with ID ${id} not found.`);

    const now = new Date().toISOString();
    const existing = this.data.channels[idx];

    const updated: ChannelConfig = {
      ...existing,
      ...updates,
      settings: {
        ...existing.settings,
        ...(updates.settings || {})
      },
      updatedAt: now
    };

    this.data.channels[idx] = updated;
    this.save();
    return updated;
  }

  // --- CHANNEL ROOM MAPPING ---
  public getChannelRoomMappings(channelId?: string, propertyCode?: string): ChannelRoomMapping[] {
    if (!this.data.channel_room_mappings) this.data.channel_room_mappings = [];
    let list = [...this.data.channel_room_mappings];
    if (channelId && channelId !== 'all') {
      list = list.filter(m => m.channel_id === channelId || m.channel_code === channelId);
    }
    if (propertyCode && propertyCode !== 'all' && propertyCode !== 'both') {
      list = list.filter(m => m.property_code === propertyCode);
    }
    return list;
  }

  public saveChannelRoomMapping(mapping: Partial<ChannelRoomMapping>): ChannelRoomMapping {
    if (!this.data.channel_room_mappings) this.data.channel_room_mappings = [];
    const now = new Date().toISOString();

    if (mapping.id) {
      const idx = this.data.channel_room_mappings.findIndex(m => m.id === mapping.id);
      if (idx !== -1) {
        const updated: ChannelRoomMapping = {
          ...this.data.channel_room_mappings[idx],
          ...mapping,
          updated_at: now
        } as ChannelRoomMapping;
        this.data.channel_room_mappings[idx] = updated;
        this.save();
        return updated;
      }
    }

    // New Mapping
    const newMapping: ChannelRoomMapping = {
      id: `crm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      channel_id: mapping.channel_id || 'chan-booking-com',
      channel_code: mapping.channel_code || 'BOOKING_COM',
      property_code: mapping.property_code || 'sbm-hotel',
      pms_room_type_id: mapping.pms_room_type_id || 'room-sbm-deluxe',
      pms_room_type_name: mapping.pms_room_type_name || 'Deluxe Room',
      channel_room_id: mapping.channel_room_id || `OTA-ROOM-${Date.now()}`,
      channel_room_name: mapping.channel_room_name || 'Deluxe Double Room',
      is_active: mapping.is_active !== undefined ? mapping.is_active : true,
      sync_inventory: mapping.sync_inventory !== undefined ? mapping.sync_inventory : true,
      created_at: now,
      updated_at: now
    };

    this.data.channel_room_mappings.push(newMapping);
    this.save();
    return newMapping;
  }

  public deleteChannelRoomMapping(id: string): boolean {
    if (!this.data.channel_room_mappings) return false;
    const initialLen = this.data.channel_room_mappings.length;
    this.data.channel_room_mappings = this.data.channel_room_mappings.filter(m => m.id !== id);
    if (this.data.channel_room_mappings.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- PMS RATE PLANS ---
  public getPMSRatePlans(propertyCode?: string, roomTypeId?: string): PMSRatePlan[] {
    if (!this.data.pms_rate_plans) {
      this.data.pms_rate_plans = getInitialPMSRatePlans(new Date().toISOString());
    }
    let list = [...this.data.pms_rate_plans];
    if (propertyCode && propertyCode !== 'all' && propertyCode !== 'both') {
      list = list.filter(p => p.property_code === propertyCode);
    }
    if (roomTypeId && roomTypeId !== 'all') {
      list = list.filter(p => p.room_type_id === roomTypeId);
    }
    return list;
  }

  public savePMSRatePlan(plan: Partial<PMSRatePlan>): PMSRatePlan {
    if (!this.data.pms_rate_plans) this.data.pms_rate_plans = getInitialPMSRatePlans(new Date().toISOString());
    const now = new Date().toISOString();

    if (plan.id) {
      const idx = this.data.pms_rate_plans.findIndex(p => p.id === plan.id);
      if (idx !== -1) {
        const updated: PMSRatePlan = {
          ...this.data.pms_rate_plans[idx],
          ...plan,
          updated_at: now
        } as PMSRatePlan;
        this.data.pms_rate_plans[idx] = updated;
        this.save();
        return updated;
      }
    }

    const newPlan: PMSRatePlan = {
      id: `rate-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_code: plan.property_code || 'sbm-hotel',
      room_type_id: plan.room_type_id || 'room-sbm-deluxe',
      name: plan.name || 'Standard Flexible Rate',
      code: plan.code || `RATE-${Date.now()}`,
      meal_plan: plan.meal_plan || 'EP',
      cancellation_policy: plan.cancellation_policy || 'FLEXIBLE',
      price_modifier_type: plan.price_modifier_type || 'PERCENTAGE',
      price_modifier_value: plan.price_modifier_value || 0,
      is_active: plan.is_active !== undefined ? plan.is_active : true,
      created_at: now,
      updated_at: now
    };

    this.data.pms_rate_plans.push(newPlan);
    this.save();
    return newPlan;
  }

  public deletePMSRatePlan(id: string): boolean {
    if (!this.data.pms_rate_plans) return false;
    const initialLen = this.data.pms_rate_plans.length;
    this.data.pms_rate_plans = this.data.pms_rate_plans.filter(p => p.id !== id);
    if (this.data.pms_rate_plans.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- CHANNEL RATE MAPPING ---
  public getChannelRateMappings(channelId?: string, propertyCode?: string): ChannelRateMapping[] {
    if (!this.data.channel_rate_mappings) this.data.channel_rate_mappings = [];
    let list = [...this.data.channel_rate_mappings];
    if (channelId && channelId !== 'all') {
      list = list.filter(m => m.channel_id === channelId || m.channel_code === channelId);
    }
    if (propertyCode && propertyCode !== 'all' && propertyCode !== 'both') {
      list = list.filter(m => m.property_code === propertyCode);
    }
    return list;
  }

  public saveChannelRateMapping(mapping: Partial<ChannelRateMapping>): ChannelRateMapping {
    if (!this.data.channel_rate_mappings) this.data.channel_rate_mappings = [];
    const now = new Date().toISOString();

    if (mapping.id) {
      const idx = this.data.channel_rate_mappings.findIndex(m => m.id === mapping.id);
      if (idx !== -1) {
        const updated: ChannelRateMapping = {
          ...this.data.channel_rate_mappings[idx],
          ...mapping,
          updated_at: now
        } as ChannelRateMapping;
        this.data.channel_rate_mappings[idx] = updated;
        this.save();
        return updated;
      }
    }

    const newRateMapping: ChannelRateMapping = {
      id: `cra-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      channel_id: mapping.channel_id || 'chan-booking-com',
      channel_code: mapping.channel_code || 'BOOKING_COM',
      property_code: mapping.property_code || 'sbm-hotel',
      pms_room_type_id: mapping.pms_room_type_id || 'room-sbm-deluxe',
      pms_rate_plan_id: mapping.pms_rate_plan_id || 'rate-sbm-deluxe-ep',
      pms_rate_plan_name: mapping.pms_rate_plan_name || 'Standard Room Only (EP)',
      channel_room_id: mapping.channel_room_id || 'OTA-DLX-01',
      channel_rate_plan_id: mapping.channel_rate_plan_id || 'OTA-RATE-FLEX',
      channel_rate_plan_name: mapping.channel_rate_plan_name || 'Standard Flexible Rate',
      price_multiplier: mapping.price_multiplier || 1.0,
      is_active: mapping.is_active !== undefined ? mapping.is_active : true,
      created_at: now,
      updated_at: now
    };

    this.data.channel_rate_mappings.push(newRateMapping);
    this.save();
    return newRateMapping;
  }

  public deleteChannelRateMapping(id: string): boolean {
    if (!this.data.channel_rate_mappings) return false;
    const initialLen = this.data.channel_rate_mappings.length;
    this.data.channel_rate_mappings = this.data.channel_rate_mappings.filter(m => m.id !== id);
    if (this.data.channel_rate_mappings.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- SYNC JOBS QUEUE ---
  public getSyncJobs(filters?: {
    channel_id?: string;
    channel_code?: string;
    status?: string;
    operation?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): SyncJob[] {
    if (!this.data.sync_jobs) this.data.sync_jobs = [];
    let list = [...this.data.sync_jobs];

    if (filters?.channel_id && filters.channel_id !== 'all') {
      list = list.filter(j => j.channel_id === filters.channel_id || j.channel_code === filters.channel_id);
    }
    if (filters?.channel_code && filters.channel_code !== 'all') {
      list = list.filter(j => j.channel_code === filters.channel_code);
    }
    if (filters?.status && filters.status !== 'all') {
      list = list.filter(j => j.status === filters.status);
    }
    if (filters?.operation && filters.operation !== 'all') {
      list = list.filter(j => j.operation === filters.operation);
    }
    if (filters?.startDate) {
      list = list.filter(j => j.created_at.split('T')[0] >= filters.startDate!);
    }
    if (filters?.endDate) {
      list = list.filter(j => j.created_at.split('T')[0] <= filters.endDate!);
    }

    // Sort latest first
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (filters?.limit && filters.limit > 0) {
      return list.slice(0, filters.limit);
    }
    return list;
  }

  public getSyncJobById(id: string): SyncJob | undefined {
    if (!this.data.sync_jobs) return undefined;
    return this.data.sync_jobs.find(j => j.id === id);
  }

  public createSyncJob(
    jobData: Omit<SyncJob, 'id' | 'created_at' | 'status' | 'retry_count'> & {
      status?: SyncJobStatus;
      retry_count?: number;
    }
  ): SyncJob {
    if (!this.data.sync_jobs) this.data.sync_jobs = [];
    const now = new Date().toISOString();

    const job: SyncJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      channel_id: jobData.channel_id,
      channel_code: jobData.channel_code,
      channel_name: jobData.channel_name,
      property_code: jobData.property_code,
      room_type_id: jobData.room_type_id,
      room_name: jobData.room_name,
      operation: jobData.operation,
      date_range: jobData.date_range,
      payload: jobData.payload,
      status: jobData.status || 'PENDING',
      retry_count: jobData.retry_count || 0,
      max_retries: jobData.max_retries || 3,
      created_at: now
    };

    this.data.sync_jobs.unshift(job);
    // Keep maximum 500 historical sync jobs
    if (this.data.sync_jobs.length > 500) {
      this.data.sync_jobs = this.data.sync_jobs.slice(0, 500);
    }
    this.save();
    return job;
  }

  public updateSyncJob(id: string, updates: Partial<SyncJob>): SyncJob {
    if (!this.data.sync_jobs) this.data.sync_jobs = [];
    const idx = this.data.sync_jobs.findIndex(j => j.id === id);
    if (idx === -1) throw new Error(`Sync job ${id} not found.`);

    const updated: SyncJob = {
      ...this.data.sync_jobs[idx],
      ...updates
    };

    this.data.sync_jobs[idx] = updated;
    this.save();
    return updated;
  }

  // --- CENTRAL CHANNEL INVENTORY (READING DIRECTLY FROM PMS) ---
  public getChannelInventory(
    propertyCode: PropertyCode | 'all' | 'both',
    startDate: string,
    endDate: string
  ): ChannelInventorySummary[] {
    const propertiesToQuery: PropertyCode[] =
      propertyCode === 'all' || propertyCode === 'both'
        ? ['sbm-hotel', 'sbm-guest-house']
        : [propertyCode];

    const result: ChannelInventorySummary[] = [];

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }

    // Iterate through each date
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().split('T')[0];

      for (const pCode of propertiesToQuery) {
        const roomTypes = this.getRoomTypes(pCode);
        const physicalRooms = this.getPhysicalRooms(pCode);
        const bookings = this.getBookings({ property_code: pCode });
        const blockedRooms = this.getBlockedRooms().filter(br => br.property_code === pCode);

        for (const rt of roomTypes) {
          // Physical rooms belonging to this room category
          const rtPhysicalRooms = physicalRooms.filter(
            pr => pr.property_code === pCode && (pr.room_type_id === rt.id || pr.room_code === rt.room_code)
          );
          const totalPhysical = rtPhysicalRooms.length;

          // Bookings occupying room on dateStr
          const overlappingBookings = bookings.filter(b => {
            if (b.booking_status === 'Cancelled') return false;
            const matchesRoomType = b.room_type_id === rt.id || (b.room_name && b.room_name.toLowerCase().includes(rt.name.toLowerCase()));
            if (!matchesRoomType) return false;
            return b.check_in <= dateStr && dateStr < b.check_out;
          });

          const reservedCount = overlappingBookings.reduce((sum, b) => sum + Number(b.rooms_requested || 1), 0);

          // Blocked rooms on dateStr
          const overlappingBlocked = blockedRooms.filter(br => {
            const matchesRoom = br.room_type_id === rt.id || br.room_code === rt.room_code;
            if (!matchesRoom) return false;
            return br.start_date <= dateStr && dateStr < br.end_date;
          });
          const blockedCount = overlappingBlocked.reduce((sum, br) => sum + Number(br.quantity || 1), 0);

          // Out of order physical rooms
          const oooCount = rtPhysicalRooms.filter(
            pr => pr.status === 'Maintenance' || pr.status === 'Blocked'
          ).length;

          const availableCount = Math.max(0, totalPhysical - reservedCount - blockedCount - oooCount);

          result.push({
            property_code: pCode,
            date: dateStr,
            room_type_id: rt.id,
            room_name: rt.name,
            total_physical_rooms: totalPhysical,
            reserved_count: reservedCount,
            blocked_count: blockedCount,
            out_of_order_count: oooCount,
            available_count: availableCount
          });
        }
      }

      cur.setDate(cur.getDate() + 1);
    }

    return result;
  }

  // --- IMAGE MANAGEMENT ---
  public getManagedImages(filters?: { category?: string; roomId?: string; propertyId?: string }): ManagedImage[] {
    if (!this.data.managed_images) {
      this.data.managed_images = getInitialManagedImages(new Date().toISOString());
    }

    // Sanitize / normalize all managed images to ensure no blob URLs or invalid URLs are returned or stored
    this.data.managed_images = this.data.managed_images.map(img => {
      let url = img.imageUrl;
      if (!url || url.trim() === '' || url.startsWith('blob:')) {
        if (img.roomId === 'deluxe' || img.category === 'Deluxe Room') {
          url = DEFAULT_PHOTOS.deluxeRoom;
        } else if (img.roomId === 'family' || img.category === 'Family Suite') {
          url = DEFAULT_PHOTOS.familySuite;
        } else {
          url = DEFAULT_PHOTOS.sbmHotelExterior;
        }
      }
      return { ...img, imageUrl: url };
    });

    let list = [...this.data.managed_images];

    if (filters) {
      if (filters.roomId) {
        list = list.filter(img => img.roomId === filters.roomId || (filters.roomId === 'deluxe' && img.category === 'Deluxe Room') || (filters.roomId === 'family' && img.category === 'Family Suite'));
      }
      if (filters.category && filters.category !== 'all') {
        list = list.filter(img => img.category === filters.category);
      }
      if (filters.propertyId && filters.propertyId !== 'all') {
        list = list.filter(img => !img.propertyId || img.propertyId === filters.propertyId);
      }
    }

    // Sort: primary covers first, then by displayOrder ascending, then updatedAt/createdAt descending
    return list.sort((a, b) => {
      if (a.isPrimaryCover && !b.isPrimaryCover) return -1;
      if (!a.isPrimaryCover && b.isPrimaryCover) return 1;
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  public getManagedImageById(id: string): ManagedImage | undefined {
    if (!this.data.managed_images) this.data.managed_images = [];
    return this.data.managed_images.find(img => img.id === id);
  }

  public addManagedImage(imageData: Omit<ManagedImage, 'id' | 'createdAt' | 'updatedAt'>): ManagedImage {
    if (!this.data.managed_images) {
      this.data.managed_images = getInitialManagedImages(new Date().toISOString());
    }

    let cleanUrl = imageData.imageUrl;
    if (!cleanUrl || cleanUrl.trim() === '' || cleanUrl.startsWith('blob:')) {
      if (imageData.roomId === 'deluxe' || imageData.category === 'Deluxe Room') {
        cleanUrl = DEFAULT_PHOTOS.deluxeRoom;
      } else if (imageData.roomId === 'family' || imageData.category === 'Family Suite') {
        cleanUrl = DEFAULT_PHOTOS.familySuite;
      } else {
        cleanUrl = DEFAULT_PHOTOS.sbmHotelExterior;
      }
    }

    const now = new Date().toISOString();
    const id = `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Calculate display order if not set
    let displayOrder = imageData.displayOrder;
    if (typeof displayOrder !== 'number' || isNaN(displayOrder)) {
      const sameCategory = this.data.managed_images.filter(
        img => (imageData.roomId && img.roomId === imageData.roomId) || img.category === imageData.category
      );
      displayOrder = sameCategory.length > 0
        ? Math.max(...sameCategory.map(i => i.displayOrder || 0)) + 1
        : 1;
    }

    const isPrimary = Boolean(imageData.isPrimaryCover || imageData.isMainForRoom);

    // If marked as primary, unmark other images in the same room category / gallery category / property
    if (isPrimary) {
      this.data.managed_images.forEach(img => {
        if (
          (imageData.roomId && img.roomId === imageData.roomId) ||
          (imageData.propertyId && img.propertyId === imageData.propertyId && img.category === imageData.category) ||
          (imageData.category && img.category === imageData.category && (!imageData.propertyId || img.propertyId === imageData.propertyId))
        ) {
          img.isPrimaryCover = false;
          img.isMainForRoom = false;
        }
      });
    }

    const newImage: ManagedImage = {
      ...imageData,
      imageUrl: cleanUrl,
      id,
      displayOrder,
      isPrimaryCover: isPrimary,
      isMainForRoom: isPrimary,
      createdAt: now,
      updatedAt: now
    };

    this.data.managed_images.push(newImage);
    this.syncRoomTypeImages();
    this.syncPropertyImages();
    this.save();
    return newImage;
  }

  public updateManagedImage(id: string, updates: Partial<ManagedImage>): ManagedImage {
    if (!this.data.managed_images) this.data.managed_images = [];
    const idx = this.data.managed_images.findIndex(img => img.id === id);
    if (idx === -1) throw new Error('Image not found');

    const existing = this.data.managed_images[idx];
    const isPrimary = updates.isPrimaryCover !== undefined ? updates.isPrimaryCover : updates.isMainForRoom;

    if (isPrimary) {
      const targetRoomId = updates.roomId || existing.roomId;
      const targetCategory = updates.category || existing.category;
      const targetPropertyId = updates.propertyId || existing.propertyId;

      this.data.managed_images.forEach(img => {
        if (
          img.id !== id &&
          ((targetRoomId && img.roomId === targetRoomId) ||
            (targetPropertyId && img.propertyId === targetPropertyId && (!targetCategory || img.category === targetCategory)) ||
            (targetCategory && img.category === targetCategory && (!targetPropertyId || img.propertyId === targetPropertyId)))
        ) {
          img.isPrimaryCover = false;
          img.isMainForRoom = false;
        }
      });
    }

    const updated: ManagedImage = {
      ...existing,
      ...updates,
      isPrimaryCover: isPrimary !== undefined ? Boolean(isPrimary) : existing.isPrimaryCover,
      isMainForRoom: isPrimary !== undefined ? Boolean(isPrimary) : existing.isMainForRoom,
      updatedAt: new Date().toISOString()
    };

    this.data.managed_images[idx] = updated;
    this.syncRoomTypeImages();
    this.syncPropertyImages();
    this.save();
    return updated;
  }

  public deleteManagedImage(id: string): boolean {
    if (!this.data.managed_images) this.data.managed_images = [];
    const target = this.data.managed_images.find(img => img.id === id);
    if (!target) return false;

    const wasPrimary = target.isPrimaryCover || target.isMainForRoom;
    const roomId = target.roomId;
    const category = target.category;
    const propertyId = target.propertyId;

    this.data.managed_images = this.data.managed_images.filter(img => img.id !== id);

    // If deleted image was primary, automatically assign primary status to next available image
    if (wasPrimary) {
      const fallback = this.data.managed_images.find(
        img => (roomId && img.roomId === roomId) ||
               (propertyId && img.propertyId === propertyId) ||
               (category && img.category === category)
      );
      if (fallback) {
        fallback.isPrimaryCover = true;
        fallback.isMainForRoom = true;
        fallback.updatedAt = new Date().toISOString();
      }
    }

    this.syncRoomTypeImages();
    this.syncPropertyImages();
    this.save();
    return true;
  }

  public setPrimaryManagedImage(id: string, roomId?: string, propertyId?: string): ManagedImage {
    if (!this.data.managed_images) this.data.managed_images = [];
    const target = this.data.managed_images.find(img => img.id === id);
    if (!target) throw new Error('Image not found');

    const effectiveRoomId = roomId || target.roomId;
    const effectivePropertyId = propertyId || target.propertyId;
    const effectiveCategory = target.category;

    // Reset primary flag on all images of the same room/property/category
    this.data.managed_images.forEach(img => {
      if (effectiveCategory === 'Property Cover') {
        // For Property Cover, reset primary flag ONLY for the same property
        const isSameProp = (effectivePropertyId && img.propertyId === effectivePropertyId) ||
          (!effectivePropertyId && (!img.propertyId || img.propertyId === 'sbm-hotel'));
        if (img.category === 'Property Cover' && isSameProp) {
          img.isPrimaryCover = false;
          img.isMainForRoom = false;
        }
      } else if (
        (effectiveRoomId && img.roomId === effectiveRoomId) ||
        (effectivePropertyId && img.propertyId === effectivePropertyId) ||
        (effectiveCategory && img.category === effectiveCategory && (!effectivePropertyId || img.propertyId === effectivePropertyId))
      ) {
        img.isPrimaryCover = false;
        img.isMainForRoom = false;
      }
    });

    target.isPrimaryCover = true;
    target.isMainForRoom = true;
    target.updatedAt = new Date().toISOString();

    this.syncRoomTypeImages();
    this.syncPropertyImages();
    this.save();
    return target;
  }

  public reorderManagedImages(orderedIds: string[]): ManagedImage[] {
    if (!this.data.managed_images) this.data.managed_images = [];

    orderedIds.forEach((id, index) => {
      const img = this.data.managed_images?.find(i => i.id === id);
      if (img) {
        img.displayOrder = index + 1;
        img.updatedAt = new Date().toISOString();
      }
    });

    this.syncRoomTypeImages();
    this.syncPropertyImages();
    this.save();
    return this.getManagedImages();
  }

  // Synchronize room type images so website frontend always displays current primary and gallery images
  public syncRoomTypeImages(): void {
    if (!this.data.room_types || !this.data.managed_images) return;

    for (const roomType of this.data.room_types) {
      const rCode = roomType.room_code || (roomType.id.includes('deluxe') ? 'deluxe' : 'family');
      const rName = roomType.name;

      // Find all managed images for this room type
      const roomImgs = this.data.managed_images.filter(
        img => img.roomId === rCode || img.category === rName || (rCode === 'deluxe' && img.category === 'Deluxe Room') || (rCode === 'family' && img.category === 'Family Suite')
      );

      // Filter out invalid/empty/blob URLs
      const validRoomImgs = roomImgs.filter(
        img => img.imageUrl && img.imageUrl.trim() !== '' && !img.imageUrl.startsWith('blob:')
      );

      if (validRoomImgs.length > 0) {
        // Sort: primary cover first, then displayOrder
        const sorted = [...validRoomImgs].sort((a, b) => {
          if (a.isPrimaryCover && !b.isPrimaryCover) return -1;
          if (!a.isPrimaryCover && b.isPrimaryCover) return 1;
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        });
        roomType.images = sorted.map(i => i.imageUrl);
      }
    }
  }

  // Synchronize property images so public website PropertyCards always display current primary and ordered managed images
  public syncPropertyImages(): void {
    if (!this.data.properties || !this.data.managed_images) return;

    for (const property of this.data.properties) {
      const propCode = property.code; // 'sbm-hotel' or 'sbm-guest-house'
      const propId = property.id;     // 'prop-sbm-hotel' or 'prop-sbm-guesthouse'

      // Priority 1: Managed Property Cover images specifically assigned to this property
      const propCovers = this.data.managed_images.filter(img => {
        if (img.category !== 'Property Cover') return false;
        if (img.propertyId === propCode || img.propertyId === propId) return true;
        if (propCode === 'sbm-hotel' && !img.propertyId) return true;
        return false;
      });

      // Priority 2: Other managed exterior/entrance photos for this property
      const otherPropImages = this.data.managed_images.filter(img => {
        if (img.category === 'Property Cover') return false;
        if (
          img.roomId === 'deluxe' ||
          img.roomId === 'family' ||
          img.category === 'Deluxe Room' ||
          img.category === 'Family Suite'
        ) {
          return false;
        }
        if (img.propertyId === propCode || img.propertyId === propId) return true;
        if (propCode === 'sbm-hotel' && !img.propertyId && (img.category === 'Hotel Exterior' || img.category === 'Hotel Entrance')) return true;
        return false;
      });

      // Filter out invalid/empty/blob URLs
      const validCovers = propCovers.filter(
        img => img.imageUrl && img.imageUrl.trim() !== '' && !img.imageUrl.startsWith('blob:')
      );
      const validOther = otherPropImages.filter(
        img => img.imageUrl && img.imageUrl.trim() !== '' && !img.imageUrl.startsWith('blob:')
      );

      // Sort covers: primary cover first, then by displayOrder ascending, then createdAt descending
      const sortedCovers = [...validCovers].sort((a, b) => {
        const aPrimary = Boolean(a.isPrimaryCover);
        const bPrimary = Boolean(b.isPrimaryCover);
        if (aPrimary && !bPrimary) return -1;
        if (!aPrimary && bPrimary) return 1;
        if ((a.displayOrder || 0) !== (b.displayOrder || 0)) {
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      const sortedOther = [...validOther].sort((a, b) => {
        if ((a.displayOrder || 0) !== (b.displayOrder || 0)) {
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      const allValidImages = [...sortedCovers, ...sortedOther];

      if (allValidImages.length > 0) {
        property.images = allValidImages.map(i => i.imageUrl);
      } else {
        // Fallback to default photography
        if (propCode === 'sbm-guest-house') {
          property.images = [
            DEFAULT_PHOTOS.sbmGuestHouseExterior,
            DEFAULT_PHOTOS.sbmEntranceFacade,
            DEFAULT_PHOTOS.sbmHotelEvening
          ];
        } else {
          property.images = [
            DEFAULT_PHOTOS.sbmHotelExterior,
            DEFAULT_PHOTOS.sbmHotelEvening,
            DEFAULT_PHOTOS.sbmEntranceFacade
          ];
        }
      }
    }
  }
}

export const db = new DatabaseService();

