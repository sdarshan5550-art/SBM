import {
  ChannelCode,
  ChannelConfig,
  NormalizedOTAReservation,
  PropertyCode,
  SyncOperation
} from '../../src/types';

export interface ChannelSyncResult {
  success: boolean;
  statusCode?: number;
  message: string;
  externalReference?: string;
  error?: string;
  timestamp: string;
}

export interface ChannelAvailabilityPayload {
  propertyCode: PropertyCode;
  roomTypeId: string;
  channelRoomId?: string;
  dateRange: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  datesAvailability: {
    date: string;
    availableRooms: number;
    totalRooms: number;
    pricePerNight?: number;
    minStay?: number;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
  }[];
}

export interface ChannelRatesPayload {
  propertyCode: PropertyCode;
  roomTypeId: string;
  channelRoomId?: string;
  channelRatePlanId?: string;
  dateRange: {
    start: string;
    end: string;
  };
  rates: {
    date: string;
    amount: number;
    currency: string;
  }[];
}

export interface ChannelRestrictionsPayload {
  propertyCode: PropertyCode;
  roomTypeId: string;
  channelRoomId?: string;
  dateRange: {
    start: string;
    end: string;
  };
  minStay?: number;
  stopSell?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
}

/**
 * ChannelAdapter interface defines standard operations required by every OTA channel integration.
 * No OTA APIs are connected yet - adapters return accurate status indications (e.g., Not Connected / Unconfigured).
 */
export interface ChannelAdapter {
  channelCode: ChannelCode;
  channelName: string;

  connect(config?: any): Promise<{ success: boolean; message: string }>;
  disconnect(): Promise<{ success: boolean; message: string }>;
  testConnection(config?: any): Promise<{ success: boolean; message: string; details?: any }>;
  pushAvailability(payload: ChannelAvailabilityPayload, config?: ChannelConfig): Promise<ChannelSyncResult>;
  pushRates(payload: ChannelRatesPayload, config?: ChannelConfig): Promise<ChannelSyncResult>;
  pushRestrictions(payload: ChannelRestrictionsPayload, config?: ChannelConfig): Promise<ChannelSyncResult>;
  fetchReservations(config?: ChannelConfig): Promise<NormalizedOTAReservation[]>;
  acknowledgeReservation(externalId: string, config?: ChannelConfig): Promise<boolean>;
}

/**
 * Direct Website Adapter (Internal SBM Booking Engine)
 * Always active and connected as the primary source of truth.
 */
export class DirectWebsiteAdapter implements ChannelAdapter {
  channelCode: ChannelCode = 'DIRECT';
  channelName: string = 'Direct Website';

  async connect(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Direct website engine is natively integrated.' };
  }

  async disconnect(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'Direct website engine is the core PMS channel and cannot be disconnected.' };
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    return {
      success: true,
      message: 'Direct Website booking engine is online and connected to PMS central inventory.',
      details: { engine: 'SBM Internal Core', mode: 'Live Native', latencyMs: 1 }
    };
  }

  async pushAvailability(payload: ChannelAvailabilityPayload): Promise<ChannelSyncResult> {
    return {
      success: true,
      message: `Direct inventory synced instantaneously for ${payload.roomTypeId} (${payload.dateRange.start} to ${payload.dateRange.end}).`,
      externalReference: `DIR-INV-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  async pushRates(payload: ChannelRatesPayload): Promise<ChannelSyncResult> {
    return {
      success: true,
      message: `Direct website rate table refreshed for ${payload.roomTypeId}.`,
      externalReference: `DIR-RATE-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  async pushRestrictions(payload: ChannelRestrictionsPayload): Promise<ChannelSyncResult> {
    return {
      success: true,
      message: `Direct restrictions applied.`,
      externalReference: `DIR-REST-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  async fetchReservations(): Promise<NormalizedOTAReservation[]> {
    return [];
  }

  async acknowledgeReservation(): Promise<boolean> {
    return true;
  }
}

/**
 * Base OTA Adapter Stub
 * Provides standardized "Not Connected / Credentials not configured" responses without fake successful connections.
 */
export class BaseOTAAdapterStub implements ChannelAdapter {
  channelCode: ChannelCode;
  channelName: string;

  constructor(channelCode: ChannelCode, channelName: string) {
    this.channelCode = channelCode;
    this.channelName = channelName;
  }

  async connect(config?: any): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: `${this.channelName} integration core is ready. API credentials/token not configured.`
    };
  }

  async disconnect(): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `${this.channelName} channel marked disconnected.`
    };
  }

  async testConnection(config?: any): Promise<{ success: boolean; message: string; details?: any }> {
    const isConfigured = Boolean(config?.credentialsConfigured && config?.settings?.accountReference);
    if (!isConfigured) {
      return {
        success: false,
        message: `Channel credentials/configuration not configured for ${this.channelName}. Please configure API Hotel ID and Secure Token in server configuration.`,
        details: { status: 'NOT_CONFIGURED', channel: this.channelCode }
      };
    }
    return {
      success: false,
      message: `${this.channelName} API endpoint handshake pending activation.`,
      details: { status: 'PENDING_ACTIVATION', channel: this.channelCode }
    };
  }

  async pushAvailability(payload: ChannelAvailabilityPayload, config?: ChannelConfig): Promise<ChannelSyncResult> {
    if (!config?.enabled || config.connectionStatus !== 'CONNECTED') {
      return {
        success: false,
        message: `Channel not connected: ${this.channelName} is currently ${config?.connectionStatus || 'NOT_CONFIGURED'}. Synchronization skipped.`,
        error: `Channel ${this.channelName} is not connected or active.`,
        timestamp: new Date().toISOString()
      };
    }

    // Ready for Phase 2 real OTA API payload dispatch
    return {
      success: false,
      message: `${this.channelName} endpoint not active.`,
      error: 'OTA_API_INACTIVE',
      timestamp: new Date().toISOString()
    };
  }

  async pushRates(payload: ChannelRatesPayload, config?: ChannelConfig): Promise<ChannelSyncResult> {
    return {
      success: false,
      message: `Channel not connected: ${this.channelName} rates cannot be pushed.`,
      error: `Channel ${this.channelName} is not connected.`,
      timestamp: new Date().toISOString()
    };
  }

  async pushRestrictions(payload: ChannelRestrictionsPayload, config?: ChannelConfig): Promise<ChannelSyncResult> {
    return {
      success: false,
      message: `Channel not connected: ${this.channelName} restrictions cannot be pushed.`,
      error: `Channel ${this.channelName} is not connected.`,
      timestamp: new Date().toISOString()
    };
  }

  async fetchReservations(config?: ChannelConfig): Promise<NormalizedOTAReservation[]> {
    return [];
  }

  async acknowledgeReservation(externalId: string, config?: ChannelConfig): Promise<boolean> {
    return false;
  }
}

// Concrete adapter instances for each OTA
export class BookingComAdapter extends BaseOTAAdapterStub {
  constructor() {
    super('BOOKING_COM', 'Booking.com');
  }
}

export class MakeMyTripAdapter extends BaseOTAAdapterStub {
  constructor() {
    super('MMT', 'MakeMyTrip');
  }
}

export class GoibiboAdapter extends BaseOTAAdapterStub {
  constructor() {
    super('GOIBIBO', 'Goibibo');
  }
}

export class AgodaAdapter extends BaseOTAAdapterStub {
  constructor() {
    super('AGODA', 'Agoda');
  }
}

export class ExpediaAdapter extends BaseOTAAdapterStub {
  constructor() {
    super('EXPEDIA', 'Expedia');
  }
}

export class GenericOTAAdapter extends BaseOTAAdapterStub {
  constructor() {
    super('OTHER', 'Custom OTA / GDS');
  }
}

// Registry map
const adapterRegistry: Map<ChannelCode, ChannelAdapter> = new Map([
  ['DIRECT', new DirectWebsiteAdapter()],
  ['BOOKING_COM', new BookingComAdapter()],
  ['MMT', new MakeMyTripAdapter()],
  ['GOIBIBO', new GoibiboAdapter()],
  ['AGODA', new AgodaAdapter()],
  ['EXPEDIA', new ExpediaAdapter()],
  ['OTHER', new GenericOTAAdapter()]
]);

export function getChannelAdapter(channelCode: ChannelCode): ChannelAdapter {
  const adapter = adapterRegistry.get(channelCode);
  if (!adapter) {
    return new GenericOTAAdapter();
  }
  return adapter;
}
