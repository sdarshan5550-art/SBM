import {
  BaseOTAAdapter,
  ChannelAdapter,
  ChannelAvailabilityPayload,
  ChannelRatesPayload,
  ChannelRestrictionsPayload,
  ChannelSyncResult
} from './baseAdapter';
import { ChannelCode, NormalizedOTAReservation } from '../../../src/types';

/**
 * Direct Website Adapter (Internal SBM Booking Engine)
 * SBM Hotel's direct booking system is natively integrated with Central Inventory.
 * It is always connected and serves as the primary master channel.
 */
export class DirectWebsiteAdapter extends BaseOTAAdapter {
  public channelCode: ChannelCode = 'DIRECT';
  public channelName: string = 'Direct Website';

  public async connect(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Direct website engine is natively integrated with SBM PMS.' };
  }

  public async disconnect(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'Direct website is the core PMS channel and cannot be disconnected.' };
  }

  public async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    return {
      success: true,
      message: 'Direct Website booking engine is online and connected to PMS central inventory.',
      details: { engine: 'SBM Internal Core', mode: 'Live Native', latencyMs: 1 }
    };
  }

  public async pushAvailability(payload: ChannelAvailabilityPayload): Promise<ChannelSyncResult> {
    return {
      success: true,
      statusCode: 200,
      message: `Direct inventory synced instantaneously for ${payload.roomTypeId} (${payload.dateRange.start} to ${payload.dateRange.end}).`,
      externalReference: `DIR-INV-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  public async pushRates(payload: ChannelRatesPayload): Promise<ChannelSyncResult> {
    return {
      success: true,
      statusCode: 200,
      message: `Direct website rate table refreshed for ${payload.roomTypeId}.`,
      externalReference: `DIR-RATE-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  public async pushRestrictions(payload: ChannelRestrictionsPayload): Promise<ChannelSyncResult> {
    return {
      success: true,
      statusCode: 200,
      message: `Direct restrictions applied successfully.`,
      externalReference: `DIR-REST-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  public async fetchReservations(): Promise<NormalizedOTAReservation[]> {
    return [];
  }

  public async acknowledgeReservation(): Promise<boolean> {
    return true;
  }
}
