import { db } from '../db';
import { PhysicalRoom, PropertyCode, PMSOperationalStatus, PMSHousekeepingStatus } from '../../src/types';

export const roomService = {
  getRooms(propertyCode?: string, date?: string): any[] {
    return db.getPhysicalRooms(propertyCode, date);
  },

  getRoomById(id: string): any | null {
    return db.getPhysicalRoomById(id);
  },

  addRoom(data: any): any {
    return db.addPhysicalRoom(data);
  },

  updateRoom(id: string, updates: any): any {
    return db.updatePhysicalRoom(id, updates);
  },

  updateHousekeepingStatus(id: string, housekeeping_status: PMSHousekeepingStatus, performed_by: string = 'Staff'): any {
    return db.updateHousekeepingStatus(id, housekeeping_status, performed_by);
  },

  updateOperationalStatus(id: string, operational_status: PMSOperationalStatus, reason?: string, performed_by: string = 'Admin'): any {
    return db.updateOperationalStatus(id, operational_status, reason, performed_by);
  },

  deleteRoom(id: string): boolean {
    return db.deletePhysicalRoom(id);
  },

  // Room Blocking management
  getBlockedRooms() {
    return db.getBlockedRooms();
  },

  createBlockedRoom(data: any) {
    return db.createBlockedRoom(data);
  },

  deleteBlockedRoom(id: string) {
    return db.deleteBlockedRoom(id);
  }
};
