import { db } from '../db';
import { AvailabilitySearchQuery, RoomAvailabilityResult, PropertyCode, RoomCategoryCode } from '../../src/types';

export interface InventoryLock {
  id: string;
  property_id: string;
  property_code: PropertyCode;
  room_type_id: string;
  check_in: string;
  check_out: string;
  rooms_count: number;
  session_id: string;
  reservation_id?: string;
  expires_at: string;
  status: 'ACTIVE' | 'RELEASED' | 'EXPIRED' | 'CONVERTED';
  created_at: string;
}

// In-memory active locks store with persistent sync
const memoryLocks: Map<string, InventoryLock> = new Map();

export const inventoryService = {
  // 1. Central source of truth for checking room availability
  checkAvailability(query: AvailabilitySearchQuery): RoomAvailabilityResult[] {
    this.cleanupExpiredLocks();
    return db.checkAvailability(query);
  },

  // 2. Check exact availability count for a specific room type and date range
  getAvailableRoomCount(propertyCode: PropertyCode, roomTypeId: string, checkIn: string, checkOut: string): number {
    this.cleanupExpiredLocks();
    const results = db.checkAvailability({
      property_code: propertyCode,
      check_in: checkIn,
      check_out: checkOut,
      adults: 2,
      children: 0,
      rooms: 1
    });

    const match = results.find(r => r.roomType.id === roomTypeId || r.roomType.room_code === roomTypeId);
    return match ? match.availableRooms : 0;
  },

  // 3. Acquire temporary inventory lock / hold for checkout
  acquireLock(params: {
    propertyCode: PropertyCode;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    roomsCount: number;
    sessionId: string;
    holdMinutes?: number;
  }): { success: boolean; lockId?: string; error?: string } {
    this.cleanupExpiredLocks();

    const { propertyCode, roomTypeId, checkIn, checkOut, roomsCount, sessionId, holdMinutes = 10 } = params;

    // Check availability
    const available = this.getAvailableRoomCount(propertyCode, roomTypeId, checkIn, checkOut);
    if (available < roomsCount) {
      return {
        success: false,
        error: `Only ${available} room(s) currently available for selected dates.`
      };
    }

    const lockId = `lock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();

    const lock: InventoryLock = {
      id: lockId,
      property_id: propertyCode === 'sbm-guest-house' ? 'prop-sbm-guesthouse' : 'prop-sbm-hotel',
      property_code: propertyCode,
      room_type_id: roomTypeId,
      check_in: checkIn,
      check_out: checkOut,
      rooms_count: roomsCount,
      session_id: sessionId,
      expires_at: expiresAt,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };

    memoryLocks.set(lockId, lock);

    // Also register temporary hold in DB so DB queries recognize it
    db.registerInventoryHold(lock);

    return { success: true, lockId };
  },

  // Alias helper for acquireHold
  acquireHold(
    propertyCode: PropertyCode,
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
    roomsCount: number,
    sessionId: string
  ): { success: boolean; lockId?: string; error?: string } | null {
    const res = this.acquireLock({
      propertyCode,
      roomTypeId,
      checkIn,
      checkOut,
      roomsCount,
      sessionId
    });
    return res.success ? res : null;
  },

  // 4. Release inventory lock on dismissal or failure
  releaseLock(lockIdOrSessionId: string): void {
    for (const [id, lock] of memoryLocks.entries()) {
      if (id === lockIdOrSessionId || lock.session_id === lockIdOrSessionId) {
        lock.status = 'RELEASED';
        memoryLocks.delete(id);
        db.releaseInventoryHold(id);
      }
    }
  },

  releaseHold(lockIdOrSessionId: string): void {
    this.releaseLock(lockIdOrSessionId);
  },

  // 5. Convert inventory lock to confirmed reservation
  convertLock(lockIdOrSessionId: string, reservationId: string): void {
    for (const [id, lock] of memoryLocks.entries()) {
      if (id === lockIdOrSessionId || lock.session_id === lockIdOrSessionId) {
        lock.status = 'CONVERTED';
        lock.reservation_id = reservationId;
        memoryLocks.delete(id);
        db.releaseInventoryHold(id);
      }
    }
  },

  // 6. Housekeeping cleanup for expired locks
  cleanupExpiredLocks(): void {
    const now = new Date().toISOString();
    for (const [id, lock] of memoryLocks.entries()) {
      if (lock.expires_at < now && lock.status === 'ACTIVE') {
        lock.status = 'EXPIRED';
        memoryLocks.delete(id);
        db.releaseInventoryHold(id);
      }
    }
  }
};
