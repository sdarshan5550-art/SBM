import { db } from '../db';
import { Guest } from '../../src/types';

export const guestService = {
  // Get all guests with calculated stay statistics
  getGuests(search?: string): Guest[] {
    return db.getGuests(search);
  },

  // Get guest by ID
  getGuestById(id: string): Guest | null {
    return db.getGuestById(id);
  },

  // Upsert guest from booking or frontdesk
  upsertGuest(data: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    idType?: string;
    idNumber?: string;
  }): Guest {
    return db.upsertGuest(data);
  },

  // Update guest details
  updateGuest(id: string, updates: Partial<Guest>): Guest {
    return db.updateGuest(id, updates);
  }
};
