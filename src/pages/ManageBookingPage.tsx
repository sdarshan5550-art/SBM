import React, { useState } from 'react';
import { Search, CalendarCheck, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Booking } from '../types';
import { BookingVoucher } from '../components/BookingVoucher';

export const ManageBookingPage: React.FC = () => {
  const [bookingNumber, setBookingNumber] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  const handleSearchBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingNumber.trim()) {
      setError('Please enter your Booking Confirmation Number (e.g., SBM-2026-104921)');
      return;
    }

    setLoading(true);
    setError(null);
    setBooking(null);

    try {
      const res = await api.lookupBooking(bookingNumber.trim(), contact.trim() || undefined);
      setBooking(res);
    } catch (err: any) {
      setError(err.message || 'Booking not found. Please check your Booking ID and contact details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Customer Portal</span>
        <h1 className="text-3xl font-serif text-[#1A1A1A] font-medium">
          Manage Your Reservation
        </h1>
        <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
        <p className="text-xs sm:text-sm text-[#666666] max-w-lg mx-auto">
          Enter your unique SBM Confirmation Number and registered phone number or email address to view or print your digital voucher.
        </p>
      </div>

      {/* Lookup Card */}
      <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSearchBooking} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1A1A1A] mb-1">
                Booking ID *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SBM-2026-104921"
                value={bookingNumber}
                onChange={(e) => setBookingNumber(e.target.value)}
                className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-3 text-[#1A1A1A] font-mono uppercase text-sm focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1A1A1A] mb-1">
                Mobile Number or Email
              </label>
              <input
                type="text"
                placeholder="Registered phone or email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
          >
            <Search className="w-4 h-4 text-[#C5A059]" />
            <span>{loading ? 'Searching Reservation...' : 'LOOKUP BOOKING DETAILS'}</span>
          </button>
        </form>
      </div>

      {/* Booking Voucher Display */}
      {booking && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 text-emerald-900 text-xs flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Verified Reservation Record Found.</span>
          </div>

          <BookingVoucher booking={booking} />
        </div>
      )}
    </div>
  );
};
