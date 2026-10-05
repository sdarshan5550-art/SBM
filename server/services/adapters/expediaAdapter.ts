import { BaseOTAAdapter } from './baseAdapter';
import { ChannelCode, ChannelConfig, NormalizedOTAReservation } from '../../../src/types';

/**
 * Expedia OTA Adapter
 * Integrates directly with Expedia Partner Central (EPC) QuickConnect API.
 * Supports ARI updates and Booking Retrieval / Notification API.
 */
export class ExpediaAdapter extends BaseOTAAdapter {
  public channelCode: ChannelCode = 'EXPEDIA';
  public channelName: string = 'Expedia';

  public async testConnection(config?: ChannelConfig): Promise<{ success: boolean; message: string; details?: any }> {
    const isReady = Boolean(config?.credentialsConfigured && config?.settings?.propertyId);
    if (!isReady) {
      return {
        success: false,
        message: 'Expedia Partner Central (EPC) Hotel ID not configured. Please enter your Expedia Hotel ID.',
        details: { status: 'NOT_CONFIGURED', channel: this.channelCode }
      };
    }

    return {
      success: false,
      message: `Expedia Partner Central Handshake: Hotel ID ${config?.settings?.propertyId} mapped. Awaiting live QuickConnect credentials.`,
      details: { status: 'PENDING_PARTNER_CREDENTIALS', propertyId: config?.settings?.propertyId }
    };
  }

  public parseWebhookReservation(body: any): NormalizedOTAReservation | null {
    if (!body) return null;
    const externalId = body.expedia_booking_id || body.booking_id || body.externalReservationId;
    if (!externalId) return null;

    return {
      externalReservationId: String(externalId),
      channel: 'EXPEDIA',
      channelCode: 'EXPEDIA',
      propertyCode: body.property_code || 'sbm-hotel',
      guestName: body.primary_guest_name || body.guest_name || body.guestName || 'Expedia Guest',
      guestEmail: body.guest_email || body.guestEmail,
      guestPhone: body.guest_phone || body.phone || body.guestPhone,
      guestAddress: body.guest_address || body.guestAddress,
      roomTypeId: body.room_type_id || body.roomTypeId || 'room-sbm-deluxe',
      ratePlanCode: body.rate_plan_id || 'EXP-STD',
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
