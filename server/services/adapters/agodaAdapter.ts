import { BaseOTAAdapter } from './baseAdapter';
import { ChannelCode, ChannelConfig, NormalizedOTAReservation } from '../../../src/types';

/**
 * Agoda OTA Adapter
 * Integrates directly with Agoda YCS (Yield Control System) API.
 * Supports ARI updates and Agoda Booking Notification (ABN) webhooks.
 */
export class AgodaAdapter extends BaseOTAAdapter {
  public channelCode: ChannelCode = 'AGODA';
  public channelName: string = 'Agoda';

  public async testConnection(config?: ChannelConfig): Promise<{ success: boolean; message: string; details?: any }> {
    const isReady = Boolean(config?.credentialsConfigured && config?.settings?.propertyId);
    if (!isReady) {
      return {
        success: false,
        message: 'Agoda YCS Property ID and API credentials not configured. Please enter your Agoda Property ID.',
        details: { status: 'NOT_CONFIGURED', channel: this.channelCode }
      };
    }

    return {
      success: false,
      message: `Agoda YCS Handshake: Property ID ${config?.settings?.propertyId} registered. Live connection awaiting partner channel manager activation.`,
      details: { status: 'PENDING_PARTNER_CREDENTIALS', propertyId: config?.settings?.propertyId }
    };
  }

  public parseWebhookReservation(body: any): NormalizedOTAReservation | null {
    if (!body) return null;
    const externalId = body.booking_id || body.agoda_booking_id || body.externalReservationId;
    if (!externalId) return null;

    return {
      externalReservationId: String(externalId),
      channel: 'AGODA',
      channelCode: 'AGODA',
      propertyCode: body.property_code || 'sbm-hotel',
      guestName: body.guest_name || body.guestName || 'Agoda Guest',
      guestEmail: body.guest_email || body.guestEmail,
      guestPhone: body.guest_phone || body.guestPhone,
      guestAddress: body.guest_address || body.guestAddress,
      roomTypeId: body.room_type_id || body.roomTypeId || 'room-sbm-deluxe',
      ratePlanCode: body.rate_plan_id || 'AGODA-STD',
      checkIn: body.check_in || body.checkIn,
      checkOut: body.check_out || body.checkOut,
      adults: Number(body.adults || 2),
      children: Number(body.children || 0),
      rooms: Number(body.rooms || 1),
      totalAmount: Number(body.total_amount || body.totalAmount || 0),
      currency: body.currency || 'INR',
      paymentStatus: body.payment_status || 'Paid',
      reservationStatus: body.status === 'CANCELLED' || body.isCancelled ? 'Cancelled' : 'Confirmed',
      isCancelled: Boolean(body.status === 'CANCELLED' || body.isCancelled),
      specialRequests: body.special_requests || body.specialRequests,
      rawPayload: body
    };
  }
}
