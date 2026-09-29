import { db } from '../db';
import { auditService } from './auditService';
import { getChannelAdapter } from './channelAdapter';
import { emailService } from './emailService';
import {
  ChannelCode,
  ChannelConfig,
  ChannelInventorySummary,
  ChannelRateMapping,
  ChannelRoomMapping,
  NormalizedOTAReservation,
  PMSRatePlan,
  PropertyCode,
  SyncJob,
  SyncOperation
} from '../../src/types';

export const channelManagerService = {
  // 1. Get all configured channels
  getChannels(): ChannelConfig[] {
    return db.getChannels();
  },

  // 2. Get single channel
  getChannelById(id: string): ChannelConfig | undefined {
    return db.getChannelById(id);
  },

  // 3. Update channel config (enable/disable, multipliers, settings)
  updateChannelConfig(id: string, updates: Partial<ChannelConfig>, performedBy: string = 'Admin'): ChannelConfig {
    const existing = db.getChannelById(id);
    if (!existing) throw new Error(`Channel ${id} not found.`);

    const updated = db.updateChannelConfig(id, updates);

    auditService.log({
      action: 'Status Update',
      description: `Updated Channel Manager settings for ${updated.name} (Enabled: ${updated.enabled}, Status: ${updated.connectionStatus})`,
      performedBy
    });

    return updated;
  },

  // 4. Test Channel Connection
  async testChannelConnection(channelId: string, performedBy: string = 'Admin'): Promise<{ success: boolean; message: string; details?: any }> {
    const channel = db.getChannelById(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found.`);

    const adapter = getChannelAdapter(channel.code);
    const result = await adapter.testConnection(channel);

    auditService.log({
      action: 'Status Update',
      description: `Tested connection for ${channel.name}: ${result.message}`,
      performedBy
    });

    return result;
  },

  // 5. Room Mappings CRUD
  getRoomMappings(channelId?: string, propertyCode?: string): ChannelRoomMapping[] {
    return db.getChannelRoomMappings(channelId, propertyCode);
  },

  saveRoomMapping(mapping: Partial<ChannelRoomMapping>, performedBy: string = 'Admin'): ChannelRoomMapping {
    const saved = db.saveChannelRoomMapping(mapping);
    auditService.log({
      action: 'Status Update',
      description: `Saved room mapping for ${saved.channel_code}: PMS ${saved.pms_room_type_name} ➔ OTA ${saved.channel_room_name} (${saved.channel_room_id})`,
      propertyCode: saved.property_code,
      performedBy
    });
    return saved;
  },

  deleteRoomMapping(id: string, performedBy: string = 'Admin'): boolean {
    const success = db.deleteChannelRoomMapping(id);
    if (success) {
      auditService.log({
        action: 'Status Update',
        description: `Deleted channel room mapping (ID: ${id})`,
        performedBy
      });
    }
    return success;
  },

  // 6. PMS Rate Plans CRUD
  getPMSRatePlans(propertyCode?: string, roomTypeId?: string): PMSRatePlan[] {
    return db.getPMSRatePlans(propertyCode, roomTypeId);
  },

  savePMSRatePlan(plan: Partial<PMSRatePlan>, performedBy: string = 'Admin'): PMSRatePlan {
    const saved = db.savePMSRatePlan(plan);
    auditService.log({
      action: 'Status Update',
      description: `Saved PMS Rate Plan: ${saved.name} (${saved.code}) for ${saved.property_code}`,
      propertyCode: saved.property_code,
      performedBy
    });
    return saved;
  },

  deletePMSRatePlan(id: string, performedBy: string = 'Admin'): boolean {
    const success = db.deletePMSRatePlan(id);
    if (success) {
      auditService.log({
        action: 'Status Update',
        description: `Deleted PMS Rate Plan (ID: ${id})`,
        performedBy
      });
    }
    return success;
  },

  // 7. Channel Rate Mappings CRUD
  getRateMappings(channelId?: string, propertyCode?: string): ChannelRateMapping[] {
    return db.getChannelRateMappings(channelId, propertyCode);
  },

  saveRateMapping(mapping: Partial<ChannelRateMapping>, performedBy: string = 'Admin'): ChannelRateMapping {
    const saved = db.saveChannelRateMapping(mapping);
    auditService.log({
      action: 'Status Update',
      description: `Saved rate mapping for ${saved.channel_code}: PMS ${saved.pms_rate_plan_name} ➔ OTA ${saved.channel_rate_plan_name} (Multiplier: ${saved.price_multiplier}x)`,
      propertyCode: saved.property_code,
      performedBy
    });
    return saved;
  },

  deleteRateMapping(id: string, performedBy: string = 'Admin'): boolean {
    const success = db.deleteChannelRateMapping(id);
    if (success) {
      auditService.log({
        action: 'Status Update',
        description: `Deleted channel rate mapping (ID: ${id})`,
        performedBy
      });
    }
    return success;
  },

  // 8. Derived Central Inventory
  getChannelInventory(
    propertyCode: PropertyCode | 'all' | 'both',
    startDate: string,
    endDate: string
  ): ChannelInventorySummary[] {
    return db.getChannelInventory(propertyCode, startDate, endDate);
  },

  // 9. Queue Channel Synchronization Jobs
  async queueInventorySync(params: {
    propertyCode: PropertyCode;
    roomTypeId?: string;
    startDate: string;
    endDate: string;
    operation?: SyncOperation;
    triggerReason?: string;
  }): Promise<SyncJob[]> {
    const { propertyCode, roomTypeId, startDate, endDate, operation = 'AVAILABILITY_UPDATE', triggerReason } = params;

    const channels = db.getChannels();
    const createdJobs: SyncJob[] = [];

    // Find room name
    const roomTypes = db.getRoomTypes(propertyCode);
    const matchedRoom = roomTypeId ? roomTypes.find(r => r.id === roomTypeId || r.room_code === roomTypeId) : undefined;
    const roomName = matchedRoom ? matchedRoom.name : 'All Room Types';

    for (const channel of channels) {
      // Create a sync job for Direct and every configured/active channel
      const job = db.createSyncJob({
        channel_id: channel.id,
        channel_code: channel.code,
        channel_name: channel.name,
        property_code: propertyCode,
        room_type_id: roomTypeId,
        room_name: roomName,
        operation,
        date_range: {
          start: startDate,
          end: endDate
        },
        payload: {
          triggerReason: triggerReason || 'PMS Central Inventory Adjustment',
          queuedAt: new Date().toISOString()
        },
        status: 'PENDING',
        retry_count: 0,
        max_retries: 3
      });

      createdJobs.push(job);
    }

    // Trigger non-blocking async execution of the queue
    this.processSyncQueue().catch(err => {
      console.error('Error processing channel sync queue in background:', err);
    });

    return createdJobs;
  },

  // 10. Process Sync Queue Jobs
  async processSyncQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const pendingJobs = db.getSyncJobs({ status: 'PENDING', limit: 25 });
    let succeeded = 0;
    let failed = 0;

    for (const job of pendingJobs) {
      const startTime = Date.now();
      db.updateSyncJob(job.id, {
        status: 'PROCESSING',
        last_attempt_at: new Date().toISOString()
      });

      const channel = db.getChannelById(job.channel_id);
      const adapter = getChannelAdapter(job.channel_code);

      try {
        if (!channel || !channel.enabled || channel.connectionStatus !== 'CONNECTED') {
          // Direct website is always connected; OTAs return accurate not-connected status
          if (job.channel_code === 'DIRECT') {
            // Direct sync succeeds natively
            const duration = Date.now() - startTime;
            db.updateSyncJob(job.id, {
              status: 'COMPLETED',
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              external_reference: `DIR-${Date.now()}`
            });
            succeeded++;
            continue;
          }

          // OTA channel is not connected
          const duration = Date.now() - startTime;
          const errMsg = `Channel ${job.channel_name} is not connected (${channel?.connectionStatus || 'NOT_CONFIGURED'}). Synchronization skipped.`;
          db.updateSyncJob(job.id, {
            status: 'FAILED',
            error_message: errMsg,
            duration_ms: duration,
            completed_at: new Date().toISOString()
          });

          db.updateChannelConfig(job.channel_id, {
            lastSyncAt: new Date().toISOString(),
            lastError: errMsg
          });

          failed++;
          continue;
        }

        // Fetch central PMS availability for the date range
        const inventorySummaries = db.getChannelInventory(
          job.property_code,
          job.date_range.start,
          job.date_range.end
        );

        const relevantInventories = job.room_type_id
          ? inventorySummaries.filter(inv => inv.room_type_id === job.room_type_id)
          : inventorySummaries;

        const syncPayload = {
          propertyCode: job.property_code,
          roomTypeId: job.room_type_id || 'all',
          dateRange: job.date_range,
          datesAvailability: relevantInventories.map(inv => ({
            date: inv.date,
            availableRooms: inv.available_count,
            totalRooms: inv.total_physical_rooms
          }))
        };

        const result = await adapter.pushAvailability(syncPayload, channel);
        const duration = Date.now() - startTime;

        if (result.success) {
          db.updateSyncJob(job.id, {
            status: 'COMPLETED',
            duration_ms: duration,
            external_reference: result.externalReference,
            completed_at: new Date().toISOString()
          });

          db.updateChannelConfig(job.channel_id, {
            lastSyncAt: new Date().toISOString(),
            lastSuccessfulSyncAt: new Date().toISOString(),
            lastError: undefined
          });

          succeeded++;
        } else {
          const newRetryCount = (job.retry_count || 0) + 1;
          const willRetry = newRetryCount < job.max_retries;

          db.updateSyncJob(job.id, {
            status: willRetry ? 'PENDING' : 'FAILED',
            retry_count: newRetryCount,
            error_message: result.error || result.message,
            duration_ms: duration,
            completed_at: willRetry ? undefined : new Date().toISOString()
          });

          db.updateChannelConfig(job.channel_id, {
            lastSyncAt: new Date().toISOString(),
            lastError: result.error || result.message
          });

          failed++;
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        const newRetryCount = (job.retry_count || 0) + 1;
        const willRetry = newRetryCount < job.max_retries;

        db.updateSyncJob(job.id, {
          status: willRetry ? 'PENDING' : 'FAILED',
          retry_count: newRetryCount,
          error_message: err.message,
          duration_ms: duration,
          completed_at: willRetry ? undefined : new Date().toISOString()
        });

        db.updateChannelConfig(job.channel_id, {
          lastSyncAt: new Date().toISOString(),
          lastError: err.message
        });

        failed++;
      }
    }

    return { processed: pendingJobs.length, succeeded, failed };
  },

  // 11. Manual Sync for a single channel
  async syncChannel(channelId: string, performedBy: string = 'Admin'): Promise<{ success: boolean; message: string; jobsQueued: number }> {
    const channel = db.getChannelById(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found.`);

    if (channel.code !== 'DIRECT' && (channel.connectionStatus !== 'CONNECTED' || !channel.enabled)) {
      auditService.log({
        action: 'Status Update',
        description: `Manual sync attempted for ${channel.name}: Channel not connected.`,
        performedBy
      });

      return {
        success: false,
        message: `Channel not connected: ${channel.name} is currently ${channel.connectionStatus}. Please configure API credentials before triggering sync.`,
        jobsQueued: 0
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const job = db.createSyncJob({
      channel_id: channel.id,
      channel_code: channel.code,
      channel_name: channel.name,
      property_code: 'sbm-hotel',
      operation: 'FULL_SYNC',
      date_range: { start: todayStr, end: futureDate },
      payload: { manual: true, triggeredBy: performedBy },
      status: 'PENDING',
      max_retries: 3
    });

    // Process
    await this.processSyncQueue();

    auditService.log({
      action: 'Status Update',
      description: `Manual sync job dispatched for ${channel.name}`,
      performedBy
    });

    return {
      success: true,
      message: `Synchronization initiated for ${channel.name}.`,
      jobsQueued: 1
    };
  },

  // 12. Manual Sync for all channels
  async syncAllChannels(performedBy: string = 'Admin'): Promise<{ success: boolean; message: string; totalChannels: number; activeChannels: number; jobsQueued: number }> {
    const channels = db.getChannels();
    const todayStr = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    let jobsQueued = 0;
    let activeChannels = 0;

    for (const channel of channels) {
      if (channel.enabled && channel.connectionStatus === 'CONNECTED') {
        activeChannels++;
      }

      // Queue sync job
      db.createSyncJob({
        channel_id: channel.id,
        channel_code: channel.code,
        channel_name: channel.name,
        property_code: 'sbm-hotel',
        operation: 'FULL_SYNC',
        date_range: { start: todayStr, end: futureDate },
        payload: { manualAll: true, triggeredBy: performedBy },
        status: 'PENDING',
        max_retries: 3
      });
      jobsQueued++;
    }

    await this.processSyncQueue();

    auditService.log({
      action: 'Status Update',
      description: `Global sync triggered across ${jobsQueued} channels (${activeChannels} active connected).`,
      performedBy
    });

    return {
      success: true,
      message: `Dispatched synchronization jobs across ${channels.length} channels (${activeChannels} active connected).`,
      totalChannels: channels.length,
      activeChannels,
      jobsQueued
    };
  },

  // 13. Retry Failed Sync Job
  async retrySyncJob(jobId: string, performedBy: string = 'Admin'): Promise<SyncJob> {
    const job = db.getSyncJobById(jobId);
    if (!job) throw new Error(`Sync job ${jobId} not found.`);

    const updated = db.updateSyncJob(jobId, {
      status: 'PENDING',
      error_message: undefined,
      retry_count: (job.retry_count || 0) + 1
    });

    auditService.log({
      action: 'Status Update',
      description: `Retried sync job ${jobId} for ${job.channel_name} (${job.operation})`,
      performedBy
    });

    await this.processSyncQueue();
    return db.getSyncJobById(jobId) || updated;
  },

  // 14. Get Sync Jobs (Filterable)
  getSyncJobs(filters?: any): SyncJob[] {
    return db.getSyncJobs(filters);
  },

  // 15. OTA Reservation Import Architecture & Normalizer with Idempotency
  async importOTAReservation(
    otaRes: NormalizedOTAReservation,
    performedBy: string = 'OTA Channel Adapter'
  ): Promise<{ success: boolean; isExisting: boolean; booking: any; message: string }> {
    if (!otaRes.externalReservationId) {
      throw new Error('External Reservation ID is required for OTA import.');
    }
    if (!otaRes.channel) {
      throw new Error('OTA channel source is required.');
    }

    const allBookings = db.getBookings();

    // Idempotency check: look up existing booking matching channel + externalReservationId
    const existing = allBookings.find(
      b =>
        b.source === otaRes.channel &&
        ((b.source_booking_id && b.source_booking_id.toUpperCase() === otaRes.externalReservationId.toUpperCase()) ||
          (b.id && b.id.toUpperCase() === otaRes.externalReservationId.toUpperCase()))
    );

    if (existing) {
      // Existing booking found -> IDEMPOTENT UPDATE
      if (otaRes.isCancelled || otaRes.reservationStatus === 'Cancelled') {
        const cancelled = db.cancelReservationPMS(
          existing.id,
          `Cancelled via OTA Channel (${otaRes.channel} Ref: ${otaRes.externalReservationId})`
        );

        auditService.log({
          action: 'Cancellation',
          description: `OTA reservation cancelled: ${existing.booking_number} (${otaRes.channel} ID: ${otaRes.externalReservationId}) for ${existing.guest_name}`,
          propertyCode: existing.property_code,
          reservationId: existing.id,
          performedBy
        });

        // Queue sync job for inventory release
        this.queueInventorySync({
          propertyCode: existing.property_code,
          roomTypeId: existing.room_type_id,
          startDate: existing.check_in,
          endDate: existing.check_out,
          triggerReason: `OTA Cancellation - Ref ${otaRes.externalReservationId}`
        }).catch(console.error);

        // Async cancellation notification
        emailService.sendBookingCancellationEmail(cancelled, `Cancelled via ${otaRes.channel} OTA`).catch((err: any) => {
          console.error('[EmailService] OTA cancellation notification error:', err?.message || err);
        });

        return {
          success: true,
          isExisting: true,
          booking: cancelled,
          message: `Successfully cancelled existing reservation ${existing.booking_number} via OTA update.`
        };
      }

      // Update existing booking details safely
      const updated = db.updateBooking(existing.id, {
        check_in: otaRes.checkIn || existing.check_in,
        check_out: otaRes.checkOut || existing.check_out,
        guest_name: otaRes.guestName || existing.guest_name,
        guest_email: otaRes.guestEmail || existing.guest_email,
        guest_phone: otaRes.guestPhone || existing.guest_phone,
        total_amount: otaRes.totalAmount || existing.total_amount,
        payment_status: otaRes.paymentStatus || existing.payment_status,
        special_request: otaRes.specialRequests || existing.special_request,
        internal_notes: `OTA Ref: ${otaRes.externalReservationId} (Synced at ${new Date().toLocaleTimeString()})`
      });

      auditService.log({
        action: 'Status Update',
        description: `OTA reservation modified: ${updated.booking_number} (${otaRes.channel} ID: ${otaRes.externalReservationId}) for ${updated.guest_name}`,
        propertyCode: updated.property_code,
        reservationId: updated.id,
        performedBy
      });

      // Queue inventory refresh
      this.queueInventorySync({
        propertyCode: updated.property_code,
        roomTypeId: updated.room_type_id,
        startDate: updated.check_in,
        endDate: updated.check_out,
        triggerReason: `OTA Modification - Ref ${otaRes.externalReservationId}`
      }).catch(console.error);

      return {
        success: true,
        isExisting: true,
        booking: updated,
        message: `Updated existing reservation ${updated.booking_number} for OTA reference ${otaRes.externalReservationId}.`
      };
    }

    // New Booking Creation from OTA
    const roomTypes = db.getRoomTypes(otaRes.propertyCode);
    const roomType =
      roomTypes.find(r => r.id === otaRes.roomTypeId || r.room_code === otaRes.roomTypeId) || roomTypes[0];

    const newBooking = db.createReservationPMS({
      property_code: otaRes.propertyCode,
      room_type_id: roomType ? roomType.id : otaRes.roomTypeId,
      check_in: otaRes.checkIn,
      check_out: otaRes.checkOut,
      adults: otaRes.adults || 2,
      children: otaRes.children || 0,
      rooms: otaRes.rooms || 1,
      guest_name: otaRes.guestName,
      guest_phone: otaRes.guestPhone || '+91 99887 76655',
      guest_email: otaRes.guestEmail || 'ota.guest@sbmhotel.com',
      guest_address: otaRes.guestAddress,
      source: otaRes.channel,
      source_booking_id: otaRes.externalReservationId,
      special_request: otaRes.specialRequests,
      internal_notes: `Imported from ${otaRes.channel} (OTA Ref: ${otaRes.externalReservationId})`,
      created_by: `OTA: ${otaRes.channel}`
    });

    auditService.log({
      action: 'Booking',
      description: `New OTA reservation imported: ${newBooking.booking_number} (${otaRes.channel} ID: ${otaRes.externalReservationId}) for ${newBooking.guest_name}`,
      propertyCode: newBooking.property_code,
      reservationId: newBooking.id,
      performedBy
    });

    // Queue sync job to distribute adjusted inventory to other channels
    this.queueInventorySync({
      propertyCode: newBooking.property_code,
      roomTypeId: newBooking.room_type_id,
      startDate: newBooking.check_in,
      endDate: newBooking.check_out,
      triggerReason: `New OTA Booking Import - ${newBooking.booking_number}`
    }).catch(console.error);

    // Asynchronously notify admin of new OTA booking
    emailService.sendAdminBookingNotification(newBooking).catch((err: any) => {
      console.error('[EmailService] OTA admin alert error:', err?.message || err);
    });

    return {
      success: true,
      isExisting: false,
      booking: newBooking,
      message: `Successfully imported new OTA reservation ${newBooking.booking_number}.`
    };
  }
};
