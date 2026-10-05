import crypto from 'crypto';
import {
  ChannelCode,
  ChannelConfig,
  NormalizedOTAReservation,
  PropertyCode,
  SyncOperation
} from '../../../src/types';

export interface ChannelSyncResult {
  success: boolean;
  statusCode?: number;
  message: string;
  externalReference?: string;
  error?: string;
  isRetryable?: boolean;
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
    maxStay?: number;
    stopSell?: boolean;
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
    extraAdultCharge?: number;
    extraChildCharge?: number;
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
  restrictions: {
    date: string;
    stopSell?: boolean;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
    minStay?: number;
    maxStay?: number;
  }[];
}

/**
 * Universal ChannelAdapter interface.
 * Implemented by every OTA adapter (Booking.com, Agoda, MMT, Goibibo, Expedia, Ctrip, Cleartrip, Direct Website).
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
  createReservation?(reservation: NormalizedOTAReservation, config?: ChannelConfig): Promise<ChannelSyncResult>;
  modifyReservation?(reservation: NormalizedOTAReservation, config?: ChannelConfig): Promise<ChannelSyncResult>;
  cancelReservation?(reservationId: string, reason?: string, config?: ChannelConfig): Promise<ChannelSyncResult>;
  acknowledgeReservation(externalId: string, config?: ChannelConfig): Promise<boolean>;
  validateWebhook?(headers: Record<string, string | undefined>, body: any, config?: ChannelConfig): Promise<{ valid: boolean; error?: string }>;
  parseWebhookReservation?(body: any): NormalizedOTAReservation | null;
}

/**
 * Base OTA Adapter Implementation
 * Provides standard authentication checks, credential verification, and structured status reports.
 * Does NOT invent mock API responses or fake successful handshakes when credentials are not configured.
 */
export abstract class BaseOTAAdapter implements ChannelAdapter {
  public abstract channelCode: ChannelCode;
  public abstract channelName: string;

  protected isConfigured(config?: ChannelConfig): boolean {
    if (!config) return false;
    return Boolean(config.credentialsConfigured && config.enabled);
  }

  public async connect(config?: any): Promise<{ success: boolean; message: string }> {
    if (!config?.credentialsConfigured) {
      return {
        success: false,
        message: `${this.channelName} requires live API credentials (Hotel ID & Secret Token) from your extranet account.`
      };
    }
    return {
      success: true,
      message: `${this.channelName} channel marked active and ready for sync.`
    };
  }

  public async disconnect(): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `${this.channelName} disconnected. Automated synchronization paused.`
    };
  }

  public async testConnection(config?: any): Promise<{ success: boolean; message: string; details?: any }> {
    const isReady = Boolean(config?.credentialsConfigured && config?.settings?.accountReference);
    if (!isReady) {
      return {
        success: false,
        message: `${this.channelName} API credentials not configured. Please supply your OTA Hotel ID and API Key.`,
        details: { status: 'NOT_CONFIGURED', channel: this.channelCode }
      };
    }
    return {
      success: false,
      message: `${this.channelName} API endpoint handshake pending activation with production extranet credentials.`,
      details: { status: 'PENDING_ACTIVATION', channel: this.channelCode }
    };
  }

  public async pushAvailability(
    payload: ChannelAvailabilityPayload,
    config?: ChannelConfig
  ): Promise<ChannelSyncResult> {
    if (!config?.enabled || config.connectionStatus !== 'CONNECTED') {
      return {
        success: false,
        statusCode: 412,
        isRetryable: false,
        message: `${this.channelName} is ${config?.connectionStatus || 'NOT_CONFIGURED'}. Availability update skipped.`,
        error: `Channel ${this.channelName} not connected.`,
        timestamp: new Date().toISOString()
      };
    }

    // Ready for direct OTA API REST/XML dispatch when live production keys are configured
    return {
      success: false,
      statusCode: 501,
      isRetryable: true,
      message: `${this.channelName} live API dispatch awaiting extranet activation.`,
      error: 'OTA_API_NOT_CONNECTED',
      timestamp: new Date().toISOString()
    };
  }

  public async pushRates(
    payload: ChannelRatesPayload,
    config?: ChannelConfig
  ): Promise<ChannelSyncResult> {
    if (!config?.enabled || config.connectionStatus !== 'CONNECTED') {
      return {
        success: false,
        statusCode: 412,
        isRetryable: false,
        message: `${this.channelName} is not connected. Rates update skipped.`,
        error: `Channel ${this.channelName} not connected.`,
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: false,
      statusCode: 501,
      isRetryable: true,
      message: `${this.channelName} rate push awaiting extranet endpoint activation.`,
      error: 'OTA_API_NOT_CONNECTED',
      timestamp: new Date().toISOString()
    };
  }

  public async pushRestrictions(
    payload: ChannelRestrictionsPayload,
    config?: ChannelConfig
  ): Promise<ChannelSyncResult> {
    if (!config?.enabled || config.connectionStatus !== 'CONNECTED') {
      return {
        success: false,
        statusCode: 412,
        isRetryable: false,
        message: `${this.channelName} is not connected. Restrictions update skipped.`,
        error: `Channel ${this.channelName} not connected.`,
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: false,
      statusCode: 501,
      isRetryable: true,
      message: `${this.channelName} restrictions push awaiting extranet endpoint activation.`,
      error: 'OTA_API_NOT_CONNECTED',
      timestamp: new Date().toISOString()
    };
  }

  public async fetchReservations(config?: ChannelConfig): Promise<NormalizedOTAReservation[]> {
    return [];
  }

  public async createReservation(
    reservation: NormalizedOTAReservation,
    config?: ChannelConfig
  ): Promise<ChannelSyncResult> {
    return {
      success: false,
      statusCode: 501,
      message: `Inbound reservation creation for ${this.channelName} handled via SBM PMS Core.`,
      timestamp: new Date().toISOString()
    };
  }

  public async modifyReservation(
    reservation: NormalizedOTAReservation,
    config?: ChannelConfig
  ): Promise<ChannelSyncResult> {
    return {
      success: false,
      statusCode: 501,
      message: `Inbound reservation modification for ${this.channelName} handled via SBM PMS Core.`,
      timestamp: new Date().toISOString()
    };
  }

  public async cancelReservation(
    reservationId: string,
    reason?: string,
    config?: ChannelConfig
  ): Promise<ChannelSyncResult> {
    return {
      success: false,
      statusCode: 501,
      message: `Reservation cancellation for ${this.channelName} handled via SBM PMS Core.`,
      timestamp: new Date().toISOString()
    };
  }

  public async acknowledgeReservation(externalId: string, config?: ChannelConfig): Promise<boolean> {
    return false;
  }

  public async validateWebhook(
    headers: Record<string, string | undefined>,
    body: any,
    config?: ChannelConfig
  ): Promise<{ valid: boolean; error?: string }> {
    // Direct website does not receive external OTA webhook calls
    if (this.channelCode === 'DIRECT') {
      return { valid: true };
    }

    const expectedSecret = config?.settings?.webhookSecretMasked || process.env[`${this.channelCode}_WEBHOOK_SECRET`];

    // PRODUCTION HARDENING: Reject if secret is missing or empty! Never fail open.
    if (!expectedSecret || expectedSecret.trim() === '') {
      return {
        valid: false,
        error: `Webhook rejected: ${this.channelName} webhook secret is not configured. Webhooks are disabled until an authentication secret is set in Settings.`
      };
    }

    const rawIncoming = headers['x-webhook-secret'] || headers['x-api-key'] || headers['authorization'];
    if (!rawIncoming) {
      return { valid: false, error: 'Missing webhook authentication signature / secret header.' };
    }

    // Strip Bearer prefix if present
    const incomingSecret = rawIncoming.replace(/^Bearer\s+/i, '').trim();
    const cleanExpected = expectedSecret.trim();

    const incomingBuffer = Buffer.from(incomingSecret, 'utf8');
    const expectedBuffer = Buffer.from(cleanExpected, 'utf8');

    // Constant-time comparison to prevent timing attacks
    if (incomingBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(incomingBuffer, expectedBuffer)) {
      return { valid: false, error: 'Invalid webhook authentication secret.' };
    }

    return { valid: true };
  }

  public parseWebhookReservation(body: any): NormalizedOTAReservation | null {
    if (!body || !body.externalReservationId) return null;
    return body as NormalizedOTAReservation;
  }
}
