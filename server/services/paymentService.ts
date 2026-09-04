import { db } from '../db';
import { PaymentRecord, PaymentStatus } from '../../src/types';

export const paymentService = {
  // Record a payment against a reservation
  recordPayment(params: {
    reservationId: string;
    method: 'RAZORPAY' | 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTA' | 'OTHER' | string;
    amount: number;
    transactionId?: string;
    paymentReference?: string;
    notes?: string;
    recordedBy?: string;
  }): { payment: PaymentRecord; updatedBooking: any } {
    const { reservationId, method, amount, transactionId, paymentReference, notes, recordedBy = 'Front Desk' } = params;

    if (amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    return db.recordPaymentForReservation({
      reservationId,
      method,
      amount,
      transactionId,
      paymentReference,
      notes,
      recordedBy
    });
  },

  // Get payment records for a reservation
  getPaymentsByReservation(reservationId: string): PaymentRecord[] {
    return db.getPaymentsForReservation(reservationId);
  },

  getPaymentsForReservation(reservationId: string): PaymentRecord[] {
    return db.getPaymentsForReservation(reservationId);
  },

  // Get all payments for admin / payments tab
  getAllPayments(filters?: { propertyCode?: string; method?: string; startDate?: string; endDate?: string }): PaymentRecord[] {
    return db.getAllPayments(filters);
  }
};
