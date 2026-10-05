import { BaseOTAAdapter } from './baseAdapter';
import { ChannelCode, ChannelConfig, NormalizedOTAReservation } from '../../../src/types';

/**
 * MakeMyTrip (MMT) OTA Adapter
 * Direct integration with MakeMyTrip IngoMMT extranet API.
 * Supports ARI inventory sync, rate multipliers, and instant booking push notifications.
 */
export class MakeMyTripAdapter extends BaseOTAAdapter {
  public channelCode: ChannelCode = 'MMT';
  public channelName: string = 'MakeMyTrip';

  public async testConnection(config?: ChannelConfig): Promise<{ success: boolean; message: string; details?: any }> {
    const isReady = Boolean(config?.credentialsConfigured && config?.settings?.propertyId);
    if (!isReady) {
      return {
        success: false,
        message: 'MakeMyTrip Hotel ID not configured. Please enter your IngoMMT Hotel ID in Settings.',
        details: { status: 'NOT_CONFIGURED', channel: this.channelCode }
      };
    }

    return {
      success: false,
      message: `IngoMMT Direct Handshake: Hotel ID ${config?.settings?.propertyId} mapped. Inbound webhook endpoint ready.`,
      details: { status: 'PENDING_PARTNER_CREDENTIALS', propertyId: config?.settings?.propertyId }
    };
  }

  public parseWebhookReservation(body: any): NormalizedOTAReservation | null {
    if (!body) return null;
    const externalId = body.mmt_booking_id || body.booking_reference_id || body.externalReservationId;
    if (!externalId) return null;

    return {
      externalReservationId: String(externalId),
      channel: 'MMT',
      channelCode: 'MMT',
      propertyCode: body.property_code || 'sbm-hotel',
      guestName: body.primary_guest_name || body.guest_name || body.guestName || 'MakeMyTrip Guest',
      guestEmail: body.guest_email || body.guestEmail,
      guestPhone: body.guest_contact || body.guest_phone || body.guestPhone,
      guestAddress: body.guest_address || body.guestAddress,
      roomTypeId: body.hotel_room_id || body.room_type_id || body.roomTypeId || 'room-sbm-deluxe',
      ratePlanCode: body.rate_plan_code || 'MMT-EP',
      checkIn: body.checkin_date || body.check_in || body.checkIn,
      checkOut: body.checkout_date || body.check_out || body.checkOut,
      adults: Number(body.num_adults || body.adults || 2),
      children: Number(body.num_children || body.children || 0),
      rooms: Number(body.num_rooms || body.rooms || 1),
      totalAmount: Number(body.net_amount || body.total_amount || body.totalAmount || 0),
      currency: 'INR',
      paymentStatus: body.payment_status || 'Paid',
      reservationStatus: body.booking_status === 'CANCELLED' || body.isCancelled ? 'Cancelled' : 'Confirmed',
      isCancelled: Boolean(body.booking_status === 'CANCELLED' || body.isCancelled),
      specialRequests: body.special_notes || body.specialRequests,
      rawPayload: body
    };
  }
}
