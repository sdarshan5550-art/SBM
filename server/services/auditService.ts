import { db } from '../db';
import { FrontDeskActivity, PropertyCode } from '../../src/types';

export const auditService = {
  log(params: {
    action: 'Booking' | 'Check-in' | 'Check-out' | 'Maintenance' | 'Status Update' | 'Payment' | 'Room Assignment' | 'Cancellation' | string;
    description: string;
    propertyCode?: PropertyCode;
    reservationId?: string;
    performedBy?: string;
  }): FrontDeskActivity {
    const { action, description, propertyCode, performedBy = 'Admin' } = params;
    return db.addActivity(action as any, description, propertyCode, performedBy);
  },

  getActivities(propertyCode?: string, limit: number = 50): FrontDeskActivity[] {
    return db.getActivities(propertyCode).slice(0, limit);
  }
};
