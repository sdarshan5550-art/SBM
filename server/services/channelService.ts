/**
 * Channel Manager Service - Phase 1 Integration Interface
 * Note: External OTA connections (MMT, Goibibo, Booking.com, Agoda) are prepared
 * in database architecture and interfaces, but remain dormant/disabled in Phase 1
 * as strictly requested.
 */

export interface ChannelConnectionConfig {
  id: string;
  property_id: string;
  channel: 'MMT' | 'GOIBIBO' | 'BOOKING_COM' | 'AGODA';
  provider: string;
  external_property_id?: string;
  status: 'DISABLED' | 'ACTIVE' | 'SYNC_ERROR';
}

export const channelService = {
  // Sync inventory update notification (stub for future OTA integration)
  async notifyInventoryChanged(propertyCode: string, roomCode: string, dateRange: { checkIn: string; checkOut: string }): Promise<void> {
    // In Phase 1, channel connections are inactive.
    // When enabled in Phase 2, this will dispatch inventory delta updates to OTA channel manager APIs.
    return;
  },

  // Get active channel connection statuses
  getConnections(): ChannelConnectionConfig[] {
    return [
      {
        id: 'cm-mmt-sbm',
        property_id: 'prop-sbm-hotel',
        channel: 'MMT',
        provider: 'Direct OTA Bridge',
        status: 'DISABLED'
      },
      {
        id: 'cm-goibibo-sbm',
        property_id: 'prop-sbm-hotel',
        channel: 'GOIBIBO',
        provider: 'Direct OTA Bridge',
        status: 'DISABLED'
      }
    ];
  }
};
