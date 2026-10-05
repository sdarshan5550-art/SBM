import { BaseOTAAdapter } from './baseAdapter';
import { ChannelCode, ChannelConfig, NormalizedOTAReservation } from '../../../src/types';

/**
 * Ctrip (Trip.com) OTA Adapter
 * Integrates directly with Ctrip / Trip.com E-Booking API.
 * Supports ARI updates and real-time order push notifications.
 */
export class CtripAdapter extends BaseOTAAdapter {
  public channelCode: ChannelCode = 'CTRIP';
  public channelName: string = 'Ctrip (Trip.com)';

  public async testConnection(config?: ChannelConfig): Promise<{ success: boolean; message: string; details?: any }> {
    const isReady = Boolean(config?.credentialsConfigured && config?.settings?.propertyId);
    if (!isReady) {
      return {
        success: false,
        message: 'Ctrip / Trip.com Hotel ID not configured. Please enter your Ctrip E-Booking Hotel ID.',
        details: { status: 'NOT_CONFIGURED', channel: this.channelCode }
      };
    }

    return {
      success: false,
      message: `Ctrip / Trip.com Connectivity Handshake: Hotel ID ${config?.settings?.propertyId} mapped. Awaiting live E-Booking API token.`,
      details: { status: 'PENDING_PARTNER_CREDENTIALS', propertyId: config?.settings?.propertyId }
    };
  }

  public parseWebhookReservation(body: any): NormalizedOTAReservation | null {
    if (!body) return null;
    const externalId = body.order_id || body.ctrip_order_id || body.booking_id || body.externalReservationId;
    if (!externalId) return null;

    return {
      externalReservationId: String(externalId),
      channel: 'OTHER',
      channelCode: 'CTRIP',
      propertyCode: body.property_code || 'sbm-hotel',
      guestName: body.contact_name || body.guest_name || body.guestName || 'Ctrip Guest',
      guestEmail: body.contact_email || body.guestEmail,
      guestPhone: body.contact_phone || body.guestPhone,
      guestAddress: body.guest_address || body.guestAddress,
      roomTypeId: body.room_type_id || body.roomTypeId || 'room-sbm-deluxe',
      ratePlanCode: body.rate_plan_id || 'CTRIP-STD',
      checkIn: body.check_in || body.checkIn,
      checkOut: body.check_out || body.checkOut,
      adults: Number(body.adults || 2),
      children: Number(body.children || 0),
      rooms: Number(body.rooms || 1),
      totalAmount: Number(body.total_amount || body.totalAmount || 0),
      currency: body.currency || 'INR',
      paymentStatus: body.payment_status || 'Paid',
      reservationStatus: body.order_status === 'CANCELLED' || body.isCancelled ? 'Cancelled' : 'Confirmed',
      isCancelled: Boolean(body.order_status === 'CANCELLED' || body.isCancelled),
      specialRequests: body.special_requests || body.specialRequests,
      rawPayload: body
    };
  }
}
