import { db } from '../db';
import { inventoryService } from './inventoryService';
import { auditService } from './auditService';
import { channelManagerService } from './channelManagerService';
import { Booking, BookingSource, BookingStatus, PaymentStatus, PropertyCode, RoomCategoryCode } from '../../src/types';

export interface CreateReservationInput {
  property_code: PropertyCode;
  room_type_id: string;
  check_in: string;
  check_out: string;
  adults?: number;
  children?: number;
  rooms?: number;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  guest_address?: string;
  guest_id_type?: string;
  guest_id_number?: string;
  source?: BookingSource;
  source_booking_id?: string;
  room_number?: string; // Optional physical room assignment
  payment_method?: string;
  initial_payment_amount?: number;
  initial_payment_method?: string;
  special_request?: string;
  internal_notes?: string;
  created_by?: string;
  session_id?: string; // Optional lock session id
}

export const reservationService = {
  // 1. Create a reservation atomically
  createReservation(input: CreateReservationInput): Booking {
    // Validate dates
    if (!input.check_in || !input.check_out) {
      throw new Error('Check-in and Check-out dates are required.');
    }
    if (input.check_in >= input.check_out) {
      throw new Error('Check-out date must be after check-in date.');
    }
    if (!input.guest_name || !input.guest_name.trim()) {
      throw new Error('Guest name is required.');
    }
    if (!input.guest_phone || !input.guest_phone.trim()) {
      throw new Error('Guest phone number is required.');
    }

    const roomsRequested = input.rooms || 1;
    const adults = input.adults || 2;
    const children = input.children || 0;
    const source: BookingSource = input.source || 'WEBSITE';

    // ATOMIC INVENTORY RE-CHECK:
    // If a session hold was acquired, verify it; otherwise check live inventory
    const available = inventoryService.getAvailableRoomCount(
      input.property_code,
      input.room_type_id,
      input.check_in,
      input.check_out
    );

    if (available < roomsRequested) {
      throw new Error(`Insufficient inventory: Only ${available} room(s) available for selected dates.`);
    }

    // Physical room assignment validation if room number specified
    if (input.room_number) {
      const isRoomFree = db.isPhysicalRoomAvailableForDates(
        input.property_code,
        input.room_number,
        input.check_in,
        input.check_out
      );
      if (!isRoomFree) {
        throw new Error(`Room ${input.room_number} is already occupied or blocked for the selected dates.`);
      }
    }

    // Execute atomic creation in DB abstraction
    const createdBooking = db.createReservationPMS({
      ...input,
      source,
      rooms: roomsRequested,
      adults,
      children
    });

    // Convert inventory lock if session was active
    if (input.session_id) {
      inventoryService.convertLock(input.session_id, createdBooking.id);
    }

    // Log Activity
    auditService.log({
      action: 'Booking',
      description: `New ${source} booking ${createdBooking.booking_number} for ${createdBooking.guest_name} (${createdBooking.room_name}${input.room_number ? ' - Room ' + input.room_number : ''})`,
      propertyCode: createdBooking.property_code,
      reservationId: createdBooking.id,
      performedBy: input.created_by || 'System'
    });

    // Notify channel manager
    channelManagerService.queueInventorySync({
      propertyCode: createdBooking.property_code,
      roomTypeId: createdBooking.room_type_id,
      startDate: createdBooking.check_in,
      endDate: createdBooking.check_out,
      triggerReason: `New Reservation: ${createdBooking.booking_number} (${createdBooking.source})`
    }).catch(console.error);

    return createdBooking;
  },

  // 2. Get reservations with filtering
  getReservations(filters?: {
    property_code?: string;
    booking_status?: string;
    payment_status?: string;
    search?: string;
    date?: string;
    source?: string;
  }): Booking[] {
    return db.getReservationsPMS(filters);
  },

  // 3. Get reservation by ID or Booking Number
  getReservationById(idOrNumber: string, contact?: string): Booking | null {
    return db.getReservationByIdOrNumber(idOrNumber, contact);
  },

  // 4. Check In Guest
  checkIn(reservationId: string, roomNumber?: string, adminName: string = 'Front Desk'): Booking {
    const booking = db.getReservationById(reservationId);
    if (!booking) throw new Error('Reservation not found.');
    if (booking.booking_status === 'Checked In') throw new Error('Reservation is already checked in.');
    if (booking.booking_status === 'Cancelled') throw new Error('Cannot check in a cancelled reservation.');

    const targetRoomNumber = roomNumber || booking.room_number;
    if (!targetRoomNumber) {
      throw new Error('Please select a physical room number before check-in.');
    }

    // Verify room availability
    const isFree = db.isPhysicalRoomAvailableForDates(
      booking.property_code,
      targetRoomNumber,
      booking.check_in,
      booking.check_out,
      booking.id
    );
    if (!isFree) {
      throw new Error(`Room ${targetRoomNumber} is not available for these dates.`);
    }

    const updated = db.checkInBooking(reservationId, targetRoomNumber);

    auditService.log({
      action: 'Check-in',
      description: `Checked in ${updated.guest_name} into Room ${targetRoomNumber} (${updated.booking_number})`,
      propertyCode: updated.property_code,
      reservationId: updated.id,
      performedBy: adminName
    });

    return updated;
  },

  // 5. Check Out Guest
  checkOut(reservationId: string, adminName: string = 'Front Desk'): Booking {
    const booking = db.getReservationById(reservationId);
    if (!booking) throw new Error('Reservation not found.');
    if (booking.booking_status === 'Checked Out') throw new Error('Reservation is already checked out.');

    const updated = db.checkOutBooking(reservationId);

    auditService.log({
      action: 'Check-out',
      description: `Checked out ${updated.guest_name} from Room ${updated.room_number || 'N/A'} (${updated.booking_number}). Room marked DIRTY for housekeeping.`,
      propertyCode: updated.property_code,
      reservationId: updated.id,
      performedBy: adminName
    });

    return updated;
  },

  // 6. Assign Physical Room to Reservation
  assignRoom(reservationId: string, roomNumber: string, adminName: string = 'Front Desk'): Booking {
    const booking = db.getReservationById(reservationId);
    if (!booking) throw new Error('Reservation not found.');

    const isFree = db.isPhysicalRoomAvailableForDates(
      booking.property_code,
      roomNumber,
      booking.check_in,
      booking.check_out,
      booking.id
    );
    if (!isFree) {
      throw new Error(`Room ${roomNumber} is not available for ${booking.check_in} to ${booking.check_out}.`);
    }

    const updated = db.updateBooking(reservationId, { room_number: roomNumber });

    auditService.log({
      action: 'Room Assignment',
      description: `Assigned Room ${roomNumber} to ${updated.guest_name} (${updated.booking_number})`,
      propertyCode: updated.property_code,
      reservationId: updated.id,
      performedBy: adminName
    });

    return updated;
  },

  // 7. Change Physical Room
  changeRoom(reservationId: string, newRoomNumber: string, adminName: string = 'Front Desk'): Booking {
    const booking = db.getReservationById(reservationId);
    if (!booking) throw new Error('Reservation not found.');
    const oldRoom = booking.room_number;

    const isFree = db.isPhysicalRoomAvailableForDates(
      booking.property_code,
      newRoomNumber,
      booking.check_in,
      booking.check_out,
      booking.id
    );
    if (!isFree) {
      throw new Error(`Room ${newRoomNumber} is not available for ${booking.check_in} to ${booking.check_out}.`);
    }

    const updated = db.changeReservationRoom(reservationId, newRoomNumber);

    auditService.log({
      action: 'Status Update',
      description: `Changed room for ${updated.guest_name} from Room ${oldRoom || 'Unassigned'} to Room ${newRoomNumber} (${updated.booking_number})`,
      propertyCode: updated.property_code,
      reservationId: updated.id,
      performedBy: adminName
    });

    return updated;
  },

  // 8. Cancel Reservation
  cancelReservation(reservationId: string, reason?: string, adminName: string = 'Front Desk'): Booking {
    const booking = db.getReservationById(reservationId);
    if (!booking) throw new Error('Reservation not found.');
    if (booking.booking_status === 'Cancelled') throw new Error('Reservation is already cancelled.');

    const updated = db.cancelReservationPMS(reservationId, reason);

    auditService.log({
      action: 'Cancellation',
      description: `Cancelled booking ${updated.booking_number} for ${updated.guest_name}. Reason: ${reason || 'Customer request'}. Inventory released.`,
      propertyCode: updated.property_code,
      reservationId: updated.id,
      performedBy: adminName
    });

    // Notify channel manager
    channelManagerService.queueInventorySync({
      propertyCode: updated.property_code,
      roomTypeId: updated.room_type_id,
      startDate: updated.check_in,
      endDate: updated.check_out,
      triggerReason: `Reservation Cancelled: ${updated.booking_number}`
    }).catch(console.error);

    return updated;
  }
};
