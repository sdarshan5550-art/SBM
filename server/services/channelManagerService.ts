import { db } from '../db';
import { auditService } from './auditService';
import { getChannelAdapter } from './channelAdapter';
import { emailService } from './emailService';
import { inventoryService } from './inventoryService';
import {
  ChannelCode,
  ChannelConfig,
  ChannelInventorySummary,
  ChannelRateMapping,
  ChannelRestriction,
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

  // 3. Update channel config (enable/disable, multipliers, settings, credentials)
  updateChannelConfig(id: string, updates: Partial<ChannelConfig>, performedBy: string = 'Admin'): ChannelConfig {
    const existing = db.getChannelById(id);
    if (!existing) throw new Error(`Channel ${id} not found.`);

    // If enabling and credentials are present, mark credentialsConfigured
    const credentialsProvided = Boolean(
      updates.settings?.propertyId ||
      updates.settings?.accountReference ||
      updates.settings?.apiKeyMasked ||
      existing.credentialsConfigured
    );

    const mergedUpdates = {
      ...updates,
      credentialsConfigured: credentialsProvided
    };

    const updated = db.updateChannelConfig(id, mergedUpdates);

    auditService.log({
      action: 'Status Update',
      description: `Updated Channel Manager settings for ${updated.name} (Enabled: ${updated.enabled}, Status: ${updated.connectionStatus})`,
      performedBy
    });

    return updated;
  },

  // 4. Test Channel Connection
  async testChannelConnection(channelId: string, performedBy: string = 'Admin'): Promise<{ success: boolean; message: string; details?: any }> {
    const rawConfig = db.getChannelRawConfig ? db.getChannelRawConfig(channelId) : db.getChannelById(channelId);
    const channel = rawConfig || db.getChannelById(channelId);
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

  // 8. Restrictions CRUD
  getRestrictions(propertyCode?: string, startDate?: string, endDate?: string): ChannelRestriction[] {
    return db.getChannelRestrictions(propertyCode, startDate, endDate);
  },

  saveRestriction(restriction: Partial<ChannelRestriction>, performedBy: string = 'Admin'): ChannelRestriction {
    const saved = db.saveChannelRestriction(restriction);
    auditService.log({
      action: 'Status Update',
      description: `Updated channel restriction on ${saved.date} for ${saved.property_code} (StopSell: ${saved.stop_sell}, MinStay: ${saved.min_stay})`,
      propertyCode: saved.property_code,
      performedBy
    });

    // Queue sync for this restriction
    this.queueRestrictionsSync({
      propertyCode: saved.property_code,
      roomTypeId: saved.room_type_id,
      startDate: saved.date,
      endDate: saved.date,
      triggerReason: `Restriction changed on ${saved.date}`
    }).catch(console.error);

    return saved;
  },

  bulkUpdateRestrictions(restrictions: Partial<ChannelRestriction>[], performedBy: string = 'Admin'): ChannelRestriction[] {
    const saved = db.bulkUpdateRestrictions(restrictions);
    if (saved.length > 0) {
      const first = saved[0];
      const last = saved[saved.length - 1];
      auditService.log({
        action: 'Status Update',
        description: `Bulk updated ${saved.length} restriction entries (${first.date} to ${last.date})`,
        propertyCode: first.property_code,
        performedBy
      });

      this.queueRestrictionsSync({
        propertyCode: first.property_code,
        roomTypeId: first.room_type_id,
        startDate: first.date,
        endDate: last.date,
        triggerReason: 'Bulk restriction update'
      }).catch(console.error);
    }
    return saved;
  },

  // 9. Derived Central Inventory
  getChannelInventory(
    propertyCode: PropertyCode | 'all' | 'both',
    startDate: string,
    endDate: string
  ): ChannelInventorySummary[] {
    return db.getChannelInventory(propertyCode, startDate, endDate);
  },

  // 10. Queue Channel Availability/Inventory Synchronization Jobs
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

    const roomTypes = db.getRoomTypes(propertyCode);
    const matchedRoom = roomTypeId ? roomTypes.find(r => r.id === roomTypeId || r.room_code === roomTypeId) : undefined;
    const roomName = matchedRoom ? matchedRoom.name : 'All Room Types';

    for (const channel of channels) {
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
      console.error('[ChannelManager] Error processing channel sync queue in background:', err);
    });

    return createdJobs;
  },

  // Update Daily Rate centrally and dispatch rate sync
  async updateDailyRate(params: {
    propertyCode: PropertyCode;
    roomTypeId: string;
    ratePlanId?: string;
    date: string;
    price: number;
    performedBy?: string;
  }): Promise<{ success: boolean; syncJobsCount: number; message: string }> {
    const { propertyCode, roomTypeId, ratePlanId, date, price, performedBy = 'Admin' } = params;

    // Update room type price if applicable
    const roomTypes = db.getRoomTypes(propertyCode);
    const roomType = roomTypes.find(r => r.id === roomTypeId || r.room_code === roomTypeId);
    const roomTypeName = roomType ? roomType.name : roomTypeId;

    if (roomType) {
      roomType.price_per_night = price;
      db.save();
    }

    if ((db as any).data && Array.isArray((db as any).data.physical_rooms)) {
      for (const pr of (db as any).data.physical_rooms) {
        if (pr.room_type_id === roomTypeId || (pr.property_code === propertyCode && pr.room_code === roomType?.room_code)) {
          pr.price = price;
        }
      }
      db.save();
    }

    // Calculate next day date for date range
    const d = new Date(date);
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);
    const nextDateStr = nextD.toISOString().split('T')[0];

    // Queue sync jobs
    const jobs = await this.queueRatesSync({
      propertyCode,
      roomTypeId,
      startDate: date,
      endDate: nextDateStr,
      triggerReason: `Daily rate update for ${roomTypeName} on ${date} (₹${price.toLocaleString('en-IN')})`
    });

    // Log audit event
    auditService.log({
      action: 'Status Update',
      description: `Updated daily rate for ${roomTypeName} on ${date} to ₹${price.toLocaleString('en-IN')}`,
      propertyCode,
      performedBy
    });

    return {
      success: true,
      syncJobsCount: jobs.length,
      message: `Updated rate for ${roomTypeName} on ${date} to ₹${price.toLocaleString('en-IN')}`
    };
  },

  // Check if Stop Sell is active for a channel
  isStopSellActive(
    propertyCode: PropertyCode,
    roomTypeId: string,
    date: string,
    channelCode: string = 'DIRECT'
  ): boolean {
    const restrictions = db.getChannelRestrictions(propertyCode, date, date);
    return restrictions.some(r => {
      if (!r.stop_sell) return false;
      if (r.room_type_id !== roomTypeId && r.room_type_id !== 'ALL') return false;
      return r.channel_code === 'ALL' || r.channel_code === channelCode;
    });
  },

  // 11. Queue Rates Synchronization Jobs
  async queueRatesSync(params: {
    propertyCode: PropertyCode;
    roomTypeId?: string;
    startDate: string;
    endDate: string;
    triggerReason?: string;
  }): Promise<SyncJob[]> {
    return this.queueInventorySync({
      ...params,
      operation: 'RATE_UPDATE',
      triggerReason: params.triggerReason || 'PMS Rate adjustment'
    });
  },

  // 12. Queue Restrictions Synchronization Jobs
  async queueRestrictionsSync(params: {
    propertyCode: PropertyCode;
    roomTypeId?: string;
    startDate: string;
    endDate: string;
    triggerReason?: string;
  }): Promise<SyncJob[]> {
    return this.queueInventorySync({
      ...params,
      operation: 'RESTRICTION_UPDATE',
      triggerReason: params.triggerReason || 'PMS Restriction adjustment'
    });
  },

  // 13. Process Sync Queue Jobs with Atomic Worker Claims & Real Exponential Backoff
  async processSyncQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    let job: SyncJob | null = null;

    // Atomic claim loop: only this worker processes the claimed job, preventing duplicate worker execution
    while ((job = db.claimNextPendingSyncJob(workerId)) !== null) {
      processed++;
      const startTime = Date.now();

      const rawConfig = db.getChannelRawConfig ? db.getChannelRawConfig(job.channel_id) : db.getChannelById(job.channel_id);
      const channel = rawConfig || db.getChannelById(job.channel_id);
      const adapter = getChannelAdapter(job.channel_code);

      try {
        if (!channel || !channel.enabled || channel.connectionStatus !== 'CONNECTED') {
          // Direct website is always connected natively
          if (job.channel_code === 'DIRECT') {
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
          const errMsg = `Channel ${job.channel_name} is ${channel?.connectionStatus || 'NOT_CONFIGURED'}. Synchronization skipped.`;
          db.updateSyncJob(job.id, {
            status: 'FAILED',
            error_message: errMsg,
            duration_ms: duration,
            completed_at: new Date().toISOString()
          });

          db.updateChannelConfig(job.channel_id, {
            lastSyncAt: new Date().toISOString(),
            lastError: errMsg,
            inventoryStatus: 'ERROR'
          });

          failed++;
          continue;
        }

        let result: any;

        if (job.operation === 'RATE_UPDATE') {
          // Fetch Rate Plans & Multipliers
          const rateMappings = db.getChannelRateMappings(job.channel_id, job.property_code);
          const roomTypes = db.getRoomTypes(job.property_code);
          const matchedRoom = job.room_type_id ? roomTypes.find(r => r.id === job.room_type_id) : roomTypes[0];
          const basePrice = matchedRoom ? matchedRoom.price_per_night : 2500;

          // Precedence: Individual Room/Rate Mapping multiplier > Channel Settings multiplier > 1.0
          const rateMapping = rateMappings.find(m => m.pms_room_type_id === job.room_type_id);
          const multiplier = (rateMapping && rateMapping.price_multiplier && rateMapping.price_multiplier > 0)
            ? rateMapping.price_multiplier
            : (channel.settings?.priceMultiplier || 1.0);

          const calculatedRate = Math.round(basePrice * multiplier);

          // Iterate through EVERY night in date range [start, end)
          const ratesList = [];
          const cur = new Date(job.date_range.start);
          const end = new Date(job.date_range.end);

          if (isNaN(cur.getTime()) || isNaN(end.getTime()) || cur >= end) {
            // Single night fallback
            ratesList.push({
              date: job.date_range.start,
              amount: calculatedRate,
              netAmount: calculatedRate,
              taxAmount: Math.round(calculatedRate * 0.12),
              grossAmount: Math.round(calculatedRate * 1.12),
              currency: 'INR',
              taxIncluded: false
            });
          } else {
            while (cur < end) {
              const dStr = cur.toISOString().split('T')[0];
              ratesList.push({
                date: dStr,
                amount: calculatedRate,
                netAmount: calculatedRate,
                taxAmount: Math.round(calculatedRate * 0.12),
                grossAmount: Math.round(calculatedRate * 1.12),
                currency: 'INR',
                taxIncluded: false
              });
              cur.setDate(cur.getDate() + 1);
            }
          }

          result = await adapter.pushRates({
            propertyCode: job.property_code,
            roomTypeId: job.room_type_id || 'all',
            dateRange: job.date_range,
            rates: ratesList
          }, channel);

        } else if (job.operation === 'RESTRICTION_UPDATE') {
          // Fetch Restrictions
          const restrictions = db.getChannelRestrictions(job.property_code, job.date_range.start, job.date_range.end);
          result = await adapter.pushRestrictions({
            propertyCode: job.property_code,
            roomTypeId: job.room_type_id || 'all',
            dateRange: job.date_range,
            restrictions: restrictions.map(r => ({
              date: r.date,
              stopSell: r.stop_sell,
              closedToArrival: r.closed_to_arrival,
              closedToDeparture: r.closed_to_departure,
              minStay: r.min_stay,
              maxStay: r.max_stay
            }))
          }, channel);

        } else {
          // AVAILABILITY_UPDATE, INVENTORY_UPDATE, or FULL_SYNC
          const inventorySummaries = db.getChannelInventory(
            job.property_code,
            job.date_range.start,
            job.date_range.end
          );

          const relevantInventories = job.room_type_id
            ? inventorySummaries.filter(inv => inv.room_type_id === job.room_type_id)
            : inventorySummaries;

          result = await adapter.pushAvailability({
            propertyCode: job.property_code,
            roomTypeId: job.room_type_id || 'all',
            dateRange: job.date_range,
            datesAvailability: relevantInventories.map(inv => ({
              date: inv.date,
              availableRooms: inv.available_count,
              totalRooms: inv.total_physical_rooms
            }))
          }, channel);
        }

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
            lastError: undefined,
            inventoryStatus: 'SYNCED',
            ratesStatus: 'SYNCED',
            reservationsStatus: 'SYNCED'
          });

          succeeded++;
        } else {
          const newRetryCount = (job.retry_count || 0) + 1;
          const isFatal =
            result.statusCode === 400 ||
            result.statusCode === 401 ||
            result.statusCode === 403 ||
            result.statusCode === 404 ||
            result.isRetryable === false ||
            String(result.error || '').includes('NOT_CONFIGURED') ||
            String(result.message || '').includes('not configured');

          const willRetry = !isFatal && newRetryCount < job.max_retries;

          // Calculate real exponential backoff delay with jitter
          const baseDelayMs = 2000;
          const maxDelayMs = 60000;
          const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, Math.max(0, newRetryCount - 1)) + Math.floor(Math.random() * 500));
          const nextRetryAt = willRetry ? new Date(Date.now() + delay).toISOString() : undefined;

          db.updateSyncJob(job.id, {
            status: willRetry ? 'RETRYING' : 'FAILED',
            retry_count: newRetryCount,
            error_message: result.error || result.message,
            duration_ms: duration,
            next_retry_at: nextRetryAt,
            completed_at: willRetry ? undefined : new Date().toISOString()
          });

          db.updateChannelConfig(job.channel_id, {
            lastSyncAt: new Date().toISOString(),
            lastError: result.error || result.message,
            inventoryStatus: 'ERROR'
          });

          failed++;
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        const newRetryCount = (job.retry_count || 0) + 1;
        const willRetry = newRetryCount < job.max_retries;

        const baseDelayMs = 2000;
        const maxDelayMs = 60000;
        const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, Math.max(0, newRetryCount - 1)) + Math.floor(Math.random() * 500));
        const nextRetryAt = willRetry ? new Date(Date.now() + delay).toISOString() : undefined;

        db.updateSyncJob(job.id, {
          status: willRetry ? 'RETRYING' : 'FAILED',
          retry_count: newRetryCount,
          error_message: err.message,
          duration_ms: duration,
          next_retry_at: nextRetryAt,
          completed_at: willRetry ? undefined : new Date().toISOString()
        });

        db.updateChannelConfig(job.channel_id, {
          lastSyncAt: new Date().toISOString(),
          lastError: err.message,
          inventoryStatus: 'ERROR'
        });

        failed++;
      }
    }

    return { processed, succeeded, failed };
  },

  // 14. Manual Sync for a single channel
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

    db.createSyncJob({
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

    await this.processSyncQueue();

    auditService.log({
      action: 'Status Update',
      description: `Manual sync job dispatched for ${channel.name}`,
      performedBy
    });

    return {
      success: true,
      message: `Synchronization completed for ${channel.name}.`,
      jobsQueued: 1
    };
  },

  // 15. Manual Sync for all channels
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

  // 16. Retry Failed Sync Job
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

  // 17. Get Sync Jobs (Filterable)
  getSyncJobs(filters?: any): SyncJob[] {
    return db.getSyncJobs(filters);
  },

  // 18. OTA Reservation Import with Strict Idempotency & Double-Booking Protection
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

    // IDEMPOTENCY CHECK: channel + externalReservationId
    const existing = allBookings.find(
      b =>
        b.source === otaRes.channel &&
        ((b.source_booking_id && b.source_booking_id.toUpperCase() === otaRes.externalReservationId.toUpperCase()) ||
          (b.id && b.id.toUpperCase() === otaRes.externalReservationId.toUpperCase()))
    );

    if (existing) {
      // 1. CANCELLATION HANDLING
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

        // Immediately release inventory and queue sync to other OTAs
        this.queueInventorySync({
          propertyCode: existing.property_code,
          roomTypeId: existing.room_type_id,
          startDate: existing.check_in,
          endDate: existing.check_out,
          triggerReason: `OTA Cancellation - Ref ${otaRes.externalReservationId}`
        }).catch(console.error);

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

      // Check if any booking data has actually changed
      const isModified =
        (otaRes.checkIn && otaRes.checkIn !== existing.check_in) ||
        (otaRes.checkOut && otaRes.checkOut !== existing.check_out) ||
        (otaRes.totalAmount && otaRes.totalAmount !== existing.total_amount) ||
        (otaRes.guestName && otaRes.guestName !== existing.guest_name);

      if (!isModified) {
        // Strict Idempotent return: no duplicate update, no duplicate notifications
        return {
          success: true,
          isExisting: true,
          booking: existing,
          message: `Idempotent acknowledgment: Reservation ${existing.booking_number} already active for ${otaRes.channel} Ref ${otaRes.externalReservationId}.`
        };
      }

      // 2. MODIFICATION HANDLING
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

      // Synchronize modified availability
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

    // Out-of-Order Webhook: Cancellation received before booking creation
    if (otaRes.isCancelled || otaRes.reservationStatus === 'Cancelled') {
      db.savePendingExternalEvent({
        id: `pevt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channel: otaRes.channel,
        external_booking_id: otaRes.externalReservationId,
        event_type: 'CANCELLATION',
        payload: otaRes,
        status: 'PENDING',
        received_at: new Date().toISOString()
      });

      auditService.log({
        action: 'Cancellation',
        description: `Out-of-order OTA cancellation received before booking creation (${otaRes.channel} Ref: ${otaRes.externalReservationId}). Logged to pending external events queue.`,
        propertyCode: otaRes.propertyCode,
        performedBy
      });

      return {
        success: true,
        isExisting: false,
        booking: null,
        message: `Out-of-order OTA cancellation logged to pending events for ${otaRes.channel} Ref ${otaRes.externalReservationId}.`
      };
    }

    // 3. NEW INBOUND RESERVATION WITH ATOMIC DOUBLE-BOOKING CHECK
    const roomTypes = db.getRoomTypes(otaRes.propertyCode);
    const roomType =
      roomTypes.find(r => r.id === otaRes.roomTypeId || r.room_code === otaRes.roomTypeId) || roomTypes[0];

    const targetRoomTypeId = roomType ? roomType.id : otaRes.roomTypeId;
    const requestedRooms = otaRes.rooms || 1;

    // Check central availability
    const available = inventoryService.getAvailableRoomCount(
      otaRes.propertyCode,
      targetRoomTypeId,
      otaRes.checkIn,
      otaRes.checkOut
    );

    if (available < requestedRooms) {
      const errMsg = `DOUBLE-BOOKING PREVENTED: Insufficient inventory on ${otaRes.checkIn} to ${otaRes.checkOut}. Requested ${requestedRooms}, only ${available} available.`;
      console.warn(`[ChannelManager Double-Booking Guard] ${errMsg}`);
      throw new Error(errMsg);
    }

    // Atomic Creation in PMS
    const newBooking = db.createReservationPMS({
      property_code: otaRes.propertyCode,
      room_type_id: targetRoomTypeId,
      check_in: otaRes.checkIn,
      check_out: otaRes.checkOut,
      adults: otaRes.adults || 2,
      children: otaRes.children || 0,
      rooms: requestedRooms,
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

    // Check for prior out-of-order cancellation received before creation
    const priorPendingEvent = db.getPendingExternalEvent(otaRes.channel, otaRes.externalReservationId);
    if (priorPendingEvent && priorPendingEvent.event_type === 'CANCELLATION') {
      db.markPendingExternalEventProcessed(priorPendingEvent.id);
      const cancelledBooking = db.cancelReservationPMS(
        newBooking.id,
        `Auto-cancelled via prior out-of-order OTA cancellation event (${priorPendingEvent.id})`
      );

      auditService.log({
        action: 'Cancellation',
        description: `Applied prior out-of-order cancellation to newly arrived reservation ${newBooking.booking_number} (${otaRes.channel} Ref: ${otaRes.externalReservationId})`,
        propertyCode: newBooking.property_code,
        reservationId: newBooking.id,
        performedBy
      });

      return {
        success: true,
        isExisting: false,
        booking: cancelledBooking,
        message: `Imported reservation ${newBooking.booking_number} and immediately applied prior out-of-order cancellation.`
      };
    }

    auditService.log({
      action: 'Booking',
      description: `New OTA reservation imported: ${newBooking.booking_number} (${otaRes.channel} ID: ${otaRes.externalReservationId}) for ${newBooking.guest_name}`,
      propertyCode: newBooking.property_code,
      reservationId: newBooking.id,
      performedBy
    });

    // Synchronize adjusted inventory across all OTHER channels immediately
    this.queueInventorySync({
      propertyCode: newBooking.property_code,
      roomTypeId: newBooking.room_type_id,
      startDate: newBooking.check_in,
      endDate: newBooking.check_out,
      triggerReason: `New OTA Booking Import - ${newBooking.booking_number}`
    }).catch(console.error);

    // Notify Admin via email
    emailService.sendAdminBookingNotification(newBooking).catch((err: any) => {
      console.error('[EmailService] OTA admin alert error:', err?.message || err);
    });

    return {
      success: true,
      isExisting: false,
      booking: newBooking,
      message: `Successfully imported new OTA reservation ${newBooking.booking_number}.`
    };
  },

  // 19. Validate Channel Configuration
  validateChannelConfig(channelId: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    channelName: string;
    channelCode: ChannelCode;
  } {
    const channel = db.getChannelById(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found.`);

    const errors: string[] = [];
    const warnings: string[] = [];

    if (channel.code === 'DIRECT') {
      return {
        valid: true,
        errors: [],
        warnings: ['Direct Website connects natively without OTA extranet credentials.'],
        channelName: channel.name,
        channelCode: channel.code
      };
    }

    // 1. Room Mappings Check
    const roomMappings = db.getChannelRoomMappings(channel.id, channel.property_code === 'both' ? undefined : channel.property_code);
    const activeRoomMappings = roomMappings.filter(m => m.is_active);
    if (activeRoomMappings.length === 0) {
      errors.push('No active room mappings configured. At least one SBM room must be mapped to an OTA room ID.');
    }

    // 2. Rate Plan Mappings Check
    const rateMappings = db.getChannelRateMappings(channel.id, channel.property_code === 'both' ? undefined : channel.property_code);
    const activeRateMappings = rateMappings.filter(m => m.is_active);
    if (activeRateMappings.length === 0) {
      errors.push('No active rate plan mappings configured. Map at least one rate plan.');
    }

    // 3. Credentials Check
    const hasPropertyId = Boolean(channel.settings?.propertyId || channel.settings?.accountReference);
    if (!hasPropertyId && !channel.credentialsConfigured) {
      errors.push(`Missing Property ID / Account Reference for ${channel.name}.`);
    }

    // 4. Webhook Warning
    if (!channel.settings?.webhookSecretMasked) {
      warnings.push('Webhook secret is not configured. Inbound real-time webhooks will be rejected until a secret is set.');
    }

    // 5. Rate Multiplier Warning
    const multiplier = channel.settings?.priceMultiplier;
    if (multiplier === 1.0 || multiplier === undefined) {
      warnings.push('Rate multiplier is set to 1.00 (Standard PMS rates will be pushed to OTA without commission markup).');
    } else if (multiplier < 0.5 || multiplier > 3.0) {
      warnings.push(`Rate multiplier ${multiplier}x is outside typical range (0.8x - 1.5x).`);
    }

    // 6. Auto-Sync Warning
    if (channel.settings?.autoSyncInventory === false) {
      warnings.push('Automatic inventory synchronization is currently disabled in settings.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      channelName: channel.name,
      channelCode: channel.code
    };
  },

  // 20. Channel Activation Workflow
  async activateChannel(
    channelId: string,
    performedBy: string = 'Admin'
  ): Promise<{
    success: boolean;
    channel: ChannelConfig;
    message: string;
    validation: { valid: boolean; errors: string[]; warnings: string[] };
    syncResults?: any;
  }> {
    const channel = db.getChannelById(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found.`);

    // Run strict validation
    const validation = this.validateChannelConfig(channelId);
    if (!validation.valid) {
      throw new Error(`Cannot activate channel ${channel.name}: ${validation.errors.join('; ')}`);
    }

    // Update state to CONNECTED & Enabled
    const updated = db.updateChannelConfig(channelId, {
      enabled: true,
      connectionStatus: 'CONNECTED',
      inventoryStatus: 'PENDING',
      ratesStatus: 'PENDING',
      reservationsStatus: 'SYNCED',
      lastError: undefined
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const in30DaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    // Trigger Initial Inventory Sync & Initial Rate Sync
    await this.queueInventorySync({
      propertyCode: channel.property_code === 'both' ? 'sbm-hotel' : channel.property_code,
      startDate: todayStr,
      endDate: in30DaysStr,
      triggerReason: `Initial Inventory Sync on Channel Activation (${channel.name})`
    });

    await this.queueRatesSync({
      propertyCode: channel.property_code === 'both' ? 'sbm-hotel' : channel.property_code,
      startDate: todayStr,
      endDate: in30DaysStr,
      triggerReason: `Initial Rate Sync on Channel Activation (${channel.name})`
    });

    auditService.log({
      action: 'Status Update',
      description: `Activated Channel: ${channel.name} (Status: CONNECTED, Enabled: true). Initial sync jobs queued.`,
      performedBy
    });

    return {
      success: true,
      channel: db.getChannelById(channelId) || updated,
      message: `Channel ${channel.name} successfully activated and initial synchronization dispatched.`,
      validation
    };
  },

  // 21. Disable Channel
  disableChannel(
    channelId: string,
    performedBy: string = 'Admin'
  ): { success: boolean; channel: ChannelConfig; message: string } {
    const channel = db.getChannelById(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found.`);

    const updated = db.updateChannelConfig(channelId, {
      enabled: false,
      connectionStatus: 'DISABLED'
    });

    auditService.log({
      action: 'Status Update',
      description: `Disabled Channel: ${channel.name} (Status: DISABLED, Enabled: false)`,
      performedBy
    });

    return {
      success: true,
      channel: updated,
      message: `Channel ${channel.name} has been disabled.`
    };
  },

  // 22. Central Rate Calendar Grid
  getRateCalendar(
    propertyCode: PropertyCode | 'all' | 'both',
    startDate: string,
    endDate: string,
    roomTypeId?: string
  ) {
    const propertiesToQuery: PropertyCode[] =
      propertyCode === 'all' || propertyCode === 'both'
        ? ['sbm-hotel', 'sbm-guest-house']
        : [propertyCode];

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }

    const result = [];
    const channels = db.getChannels();

    for (const pCode of propertiesToQuery) {
      const roomTypes = db.getRoomTypes(pCode);
      const targetRooms = roomTypeId && roomTypeId !== 'all' ? roomTypes.filter(r => r.id === roomTypeId) : roomTypes;
      const ratePlans = db.getPMSRatePlans(pCode);
      const rateMappings = db.getChannelRateMappings(undefined, pCode);

      for (const room of targetRooms) {
        const cur = new Date(start);
        const roomPlans = ratePlans.filter(p => p.room_type_id === room.id);
        const effectivePlans = roomPlans.length > 0 ? roomPlans : [
          {
            id: `default-${room.id}`,
            property_code: pCode,
            room_type_id: room.id,
            name: 'Standard Room Only (EP)',
            code: 'EP',
            meal_plan: 'EP' as const,
            cancellation_policy: 'FLEXIBLE' as const,
            price_modifier_type: 'PERCENTAGE' as const,
            price_modifier_value: 0,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];

        while (cur <= end) {
          const dateStr = cur.toISOString().split('T')[0];

          for (const plan of effectivePlans) {
            let baseRate = room.price_per_night || 2500;
            if (plan.price_modifier_type === 'PERCENTAGE') {
              baseRate = Math.round(baseRate * (1 + (plan.price_modifier_value || 0) / 100));
            } else if (plan.price_modifier_type === 'FIXED') {
              baseRate = baseRate + (plan.price_modifier_value || 0);
            }

            const channelRates = channels.map(ch => {
              const mapping = rateMappings.find(
                m => (m.channel_id === ch.id || m.channel_code === ch.code) &&
                     m.pms_room_type_id === room.id &&
                     (m.pms_rate_plan_id === plan.id || m.pms_rate_plan_name === plan.name)
              );
              const multiplier = mapping?.price_multiplier || ch.settings?.priceMultiplier || 1.0;
              const finalRate = Math.round(baseRate * multiplier);
              return {
                channelId: ch.id,
                channelCode: ch.code,
                channelName: ch.name,
                multiplier,
                rate: finalRate,
                netRate: finalRate,
                taxAmount: Math.round(finalRate * 0.12),
                grossRate: Math.round(finalRate * 1.12)
              };
            });

            result.push({
              property_code: pCode,
              date: dateStr,
              room_type_id: room.id,
              room_name: room.name,
              rate_plan_id: plan.id,
              rate_plan_name: plan.name,
              meal_plan: plan.meal_plan,
              cancellation_policy: plan.cancellation_policy,
              base_rate: baseRate,
              tax_amount: Math.round(baseRate * 0.12),
              gross_rate: Math.round(baseRate * 1.12),
              channel_rates: channelRates
            });
          }

          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    return result;
  },

  // 23. Update Manual Rates
  async updateManualRates(
    params: {
      propertyCode: PropertyCode;
      roomTypeId: string;
      ratePlanId?: string;
      startDate: string;
      endDate: string;
      basePrice: number;
      priceMultiplier?: number;
      notes?: string;
    },
    performedBy: string = 'Admin'
  ): Promise<{ success: boolean; message: string; jobsQueued: number }> {
    const { propertyCode, roomTypeId, startDate, endDate, basePrice } = params;

    // Update Room Type Base Price
    const room = db.updateRoomType(roomTypeId, {
      price_per_night: basePrice
    });

    auditService.log({
      action: 'Status Update',
      description: `Manual rate adjustment for ${room.name}: Rs ${basePrice}/night (Effective ${startDate} to ${endDate})`,
      propertyCode,
      performedBy
    });

    // Queue RATE_UPDATE sync across all active channels
    const jobs = await this.queueRatesSync({
      propertyCode,
      roomTypeId,
      startDate,
      endDate,
      triggerReason: `Manual Rate Adjustment by ${performedBy}`
    });

    return {
      success: true,
      message: `Updated rate for ${room.name} to Rs ${basePrice}. Queued ${jobs.length} rate synchronization jobs.`,
      jobsQueued: jobs.length
    };
  },

  // 24. Central Reservation Hub with Rich Details & Filter Support
  getReservationsHub(filters?: {
    propertyCode?: string;
    source?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    let bookings = db.getBookings(filters?.propertyCode ? { property_code: filters.propertyCode } : undefined);

    if (filters?.source && filters.source !== 'all') {
      bookings = bookings.filter(b => b.source === filters.source);
    }

    if (filters?.status && filters.status !== 'all') {
      bookings = bookings.filter(b => b.booking_status === filters.status);
    }

    if (filters?.startDate) {
      bookings = bookings.filter(b => b.check_in >= filters.startDate!);
    }

    if (filters?.endDate) {
      bookings = bookings.filter(b => b.check_out <= filters.endDate!);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      bookings = bookings.filter(
        b =>
          b.booking_number.toLowerCase().includes(q) ||
          b.guest_name.toLowerCase().includes(q) ||
          (b.guest_phone && b.guest_phone.toLowerCase().includes(q)) ||
          (b.guest_email && b.guest_email.toLowerCase().includes(q)) ||
          (b.source_booking_id && b.source_booking_id.toLowerCase().includes(q)) ||
          (b.room_name && b.room_name.toLowerCase().includes(q))
      );
    }

    // Sort newest check-in first
    bookings.sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime());

    const total = bookings.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const startIndex = (page - 1) * limit;
    const paginated = bookings.slice(startIndex, startIndex + limit);

    // Attach sync status and audit trail to each reservation
    const auditLogs = auditService.getLogs();

    const enriched = paginated.map(b => {
      const reservationAudit = auditLogs.filter(
        l => l.reservationId === b.id || l.description?.includes(b.booking_number)
      );

      return {
        ...b,
        auditTrail: reservationAudit,
        syncStatus: b.source === 'WEBSITE' ? 'NATIVE_SYNCED' : b.source_booking_id ? 'OTA_SYNCED' : 'LOCAL'
      };
    });

    return {
      reservations: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  // 25. Channel Health Overview Summary
  getChannelHealthSummary() {
    const channels = db.getChannels();
    const allJobs = db.getSyncJobs({ limit: 500 });

    return channels.map(ch => {
      const channelJobs = allJobs.filter(j => j.channel_id === ch.id || j.channel_code === ch.code);
      const pendingJobs = channelJobs.filter(j => j.status === 'PENDING' || j.status === 'PROCESSING' || j.status === 'RETRYING').length;
      const failedJobs = channelJobs.filter(j => j.status === 'FAILED').length;
      const succeededJobs = channelJobs.filter(j => j.status === 'COMPLETED').length;

      let healthStatus: 'HEALTHY' | 'WARNING' | 'ERROR' | 'DISABLED' | 'NOT_CONFIGURED' = 'HEALTHY';

      if (!ch.enabled || ch.connectionStatus === 'DISABLED') {
        healthStatus = 'DISABLED';
      } else if (ch.code !== 'DIRECT' && !ch.credentialsConfigured) {
        healthStatus = 'NOT_CONFIGURED';
      } else if (failedJobs > 0 || ch.inventoryStatus === 'ERROR' || ch.ratesStatus === 'ERROR') {
        healthStatus = 'ERROR';
      } else if (pendingJobs > 5 || ch.inventoryStatus === 'PENDING') {
        healthStatus = 'WARNING';
      }

      return {
        id: ch.id,
        code: ch.code,
        name: ch.name,
        type: ch.type,
        enabled: ch.enabled,
        connectionStatus: ch.connectionStatus,
        credentialsConfigured: ch.credentialsConfigured,
        healthStatus,
        inventoryStatus: ch.inventoryStatus || 'SYNCED',
        ratesStatus: ch.ratesStatus || 'SYNCED',
        reservationsStatus: ch.reservationsStatus || 'SYNCED',
        pendingJobs,
        failedJobs,
        succeededJobs,
        totalJobs: channelJobs.length,
        lastSyncAt: ch.lastSyncAt,
        lastSuccessfulSyncAt: ch.lastSuccessfulSyncAt,
        lastError: ch.lastError
      };
    });
  },

  // 26. Scoped Manual Sync
  async manualScopedSync(
    params: {
      channelId?: string;
      scope: 'ALL' | 'INVENTORY' | 'RATES' | 'RESTRICTIONS' | 'RESERVATIONS';
      allActive?: boolean;
    },
    performedBy: string = 'Admin'
  ): Promise<{ success: boolean; message: string; jobsQueued: number }> {
    const { channelId, scope, allActive } = params;
    const channels = db.getChannels();
    const targetChannels = allActive
      ? channels.filter(c => c.enabled && c.connectionStatus === 'CONNECTED')
      : channels.filter(c => c.id === channelId || c.code === channelId);

    if (targetChannels.length === 0) {
      return {
        success: false,
        message: 'No active connected channels found matching criteria.',
        jobsQueued: 0
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const in30DaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    let jobsQueued = 0;

    for (const ch of targetChannels) {
      if (scope === 'INVENTORY' || scope === 'ALL') {
        db.createSyncJob({
          channel_id: ch.id,
          channel_code: ch.code,
          channel_name: ch.name,
          property_code: 'sbm-hotel',
          operation: 'AVAILABILITY_UPDATE',
          date_range: { start: todayStr, end: in30DaysStr },
          payload: { manual: true, scope, triggeredBy: performedBy },
          status: 'PENDING',
          max_retries: 3
        });
        jobsQueued++;
      }

      if (scope === 'RATES' || scope === 'ALL') {
        db.createSyncJob({
          channel_id: ch.id,
          channel_code: ch.code,
          channel_name: ch.name,
          property_code: 'sbm-hotel',
          operation: 'RATE_UPDATE',
          date_range: { start: todayStr, end: in30DaysStr },
          payload: { manual: true, scope, triggeredBy: performedBy },
          status: 'PENDING',
          max_retries: 3
        });
        jobsQueued++;
      }

      if (scope === 'RESTRICTIONS' || scope === 'ALL') {
        db.createSyncJob({
          channel_id: ch.id,
          channel_code: ch.code,
          channel_name: ch.name,
          property_code: 'sbm-hotel',
          operation: 'RESTRICTION_UPDATE',
          date_range: { start: todayStr, end: in30DaysStr },
          payload: { manual: true, scope, triggeredBy: performedBy },
          status: 'PENDING',
          max_retries: 3
        });
        jobsQueued++;
      }
    }

    // Process sync queue in non-blocking background
    this.processSyncQueue().catch(err => {
      console.error('[ChannelManager] Error processing manual scoped sync queue:', err);
    });

    auditService.log({
      action: 'Status Update',
      description: `Dispatched manual ${scope} synchronization across ${targetChannels.length} channels (${jobsQueued} jobs queued).`,
      performedBy
    });

    return {
      success: true,
      message: `Successfully queued ${jobsQueued} ${scope} synchronization jobs across ${targetChannels.length} channel(s).`,
      jobsQueued
    };
  }
};
