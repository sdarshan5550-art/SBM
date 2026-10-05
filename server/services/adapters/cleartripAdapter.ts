import { BaseOTAAdapter } from './baseAdapter';
import { ChannelCode, ChannelConfig, NormalizedOTAReservation } from '../../../src/types';

/**
 * Cleartrip OTA Adapter
 * Integrates directly with Cleartrip Hoteliers Extranet API.
 */
export class CleartripAdapter extends BaseOTAAdapter {
  public channelCode: ChannelCode = 'CLEARTRIP';
  public channelName: string = 'Cleartrip';

  public async testConnection(config?: ChannelConfig): Promise<{ success: boolean; message: string; details?: any }> {
    const isReady = Boolean(config?.credentialsConfigured && config?.settings?.propertyId);
    if (!isReady) {
      return {
        success: false,
        message: 'Cleartrip Hotel ID not configured. Please enter your Cleartrip Property Code.',
        details: { status: 'NOT_CONFIGURED', channel: this.channelCode }
      };
    }

    return {
      success: false,
      message: `Cleartrip Handshake: Property Code ${config?.settings?.propertyId} mapped. Awaiting live Cleartrip XML/REST credentials.`,
      details: { status: 'PENDING_PARTNER_CREDENTIALS', propertyId: config?.settings?.propertyId }
    };
  }

  public parseWebhookReservation(body: any): NormalizedOTAReservation | null {
    if (!body) return null;
    const externalId = body.cleartrip_id || body.booking_id || body.externalReservationId;
    if (!externalId) return null;

    return {
      externalReservationId: String(externalId),
      channel: 'OTHER',
      channelCode: 'CLEARTRIP',
      propertyCode: body.property_code || 'sbm-hotel',
      guestName: body.lead_traveler_name || body.guest_name || body.guestName || 'Cleartrip Guest',
      guestEmail: body.lead_traveler_email || body.guestEmail,
      guestPhone: body.lead_traveler_phone || body.guestPhone,
      guestAddress: body.guest_address || body.guestAddress,
      roomTypeId: body.room_type_id || body.roomTypeId || 'room-sbm-deluxe',
      ratePlanCode: body.rate_plan_id || 'CLEAR-STD',
      checkIn: body.check_in || body.checkIn,
      checkOut: body.check_out || body.checkOut,
      adults: Number(body.adults || 2),
      children: Number(body.children || 0),
      rooms: Number(body.rooms || 1),
      totalAmount: Number(body.total_amount || body.totalAmount || 0),
      currency: 'INR',
      paymentStatus: body.payment_status || 'Paid',
      reservationStatus: body.status === 'CANCELLED' || body.isCancelled ? 'Cancelled' : 'Confirmed',
      isCancelled: Boolean(body.status === 'CANCELLED' || body.isCancelled),
      specialRequests: body.special_requests || body.specialRequests,
      rawPayload: body
    };
  }
}
