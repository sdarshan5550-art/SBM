import React from 'react';
import { Booking, Property } from '../types';
import { CheckCircle2, Printer, Download, MapPin, Phone, Mail, Calendar, User, ShieldCheck } from 'lucide-react';

interface BookingVoucherProps {
  booking: Booking;
  property?: Property;
  onClose?: () => void;
}

export const BookingVoucher: React.FC<BookingVoucherProps> = ({ booking, property, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white text-[#1A1A1A] border border-stone-200 shadow-xl overflow-hidden max-w-3xl mx-auto my-6 print:shadow-none print:border-none print:m-0 print:max-w-none">
      {/* Header Banner */}
      <div className="bg-[#1A1A1A] text-white p-6 sm:p-8 border-b-2 border-[#C5A059] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-[#C5A059] text-[#1A1A1A] font-serif font-bold text-base flex items-center justify-center">
              SBM
            </div>
            <span className="text-xl font-serif tracking-widest font-medium text-white">SBM HOTEL</span>
          </div>
          <p className="text-[10px] text-[#C5A059] font-bold tracking-[0.2em] uppercase">
            Salasar, Rajasthan • Luxury Beside Salasar Balaji Temple
          </p>
        </div>

        <div className="text-left sm:text-right bg-[#262626] p-3 border border-white/10">
          <div className="text-[9px] uppercase text-stone-400 tracking-[0.2em]">Confirmation ID</div>
          <div className="text-base font-mono font-bold text-[#C5A059]">{booking.booking_number}</div>
          <div className="text-[10px] text-emerald-400 font-bold tracking-wider flex items-center gap-1 mt-0.5 justify-start sm:justify-end uppercase">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {booking.booking_status}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 sm:p-8 space-y-6">
        {/* Welcome message */}
        <div className="bg-[#FDFCFB] border border-[#C5A059]/30 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#C5A059] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-[#1A1A1A]">Thank you for booking with SBM Hotel</h4>
            <p className="text-xs text-[#666666] mt-0.5">
              Your reservation is confirmed. Please present this voucher or your Booking ID at check-in.
            </p>
          </div>
        </div>

        {/* Property & Stay Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Property Info */}
          <div className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Property Details</h3>
            <div className="text-base font-serif font-bold text-stone-900">{booking.property_name}</div>
            <p className="text-xs text-stone-600 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              {property?.address || 'Adjacent to Salasar Balaji Temple, Salasar, Rajasthan 331506'}
            </p>
            <p className="text-xs text-stone-600 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              {property?.phone || (booking.property_code === 'sbm-guest-house' ? '+91 98285 00845' : '+91 99835 67921')}
            </p>
            <p className="text-xs text-stone-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              {property?.email || (booking.property_code === 'sbm-guest-house' ? 'sbmguesthouse@gmail.com' : 'sbmhotel@gmail.com')}
            </p>
          </div>

          {/* Guest Info */}
          <div className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Guest Information</h3>
            <div className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-600" />
              {booking.guest_name}
            </div>
            <p className="text-xs text-stone-600">Mobile: <span className="font-medium text-stone-800">{booking.guest_phone}</span></p>
            {booking.guest_email && (
              <p className="text-xs text-stone-600">Email: <span className="font-medium text-stone-800">{booking.guest_email}</span></p>
            )}
            <p className="text-xs text-stone-600">
              Occupants: <span className="font-medium text-stone-800">{booking.adults} Adult(s), {booking.children} Child(ren)</span>
            </p>
            <p className="text-xs text-stone-600">
              Rooms Reserved: <span className="font-medium text-stone-800">{booking.rooms_requested} × {booking.room_name}</span>
            </p>
          </div>
        </div>

        {/* Stay Dates Box */}
        <div className="grid grid-cols-3 gap-3 bg-stone-900 text-stone-100 p-4 rounded-xl text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-amber-400/90 font-medium">Check-In Date</div>
            <div className="text-base font-bold text-stone-100 mt-0.5">{booking.check_in}</div>
            <div className="text-[10px] text-stone-400">From 12:00 PM</div>
          </div>
          <div className="border-x border-stone-800 flex flex-col justify-center">
            <div className="text-[10px] uppercase tracking-wider text-stone-400">Duration</div>
            <div className="text-base font-bold text-amber-400">{booking.nights} Night(s)</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-amber-400/90 font-medium">Check-Out Date</div>
            <div className="text-base font-bold text-stone-100 mt-0.5">{booking.check_out}</div>
            <div className="text-[10px] text-stone-400">By 11:00 AM</div>
          </div>
        </div>

        {/* Payment & Price Table */}
        <div className="border border-stone-200 overflow-hidden bg-white shadow-xs">
          <div className="bg-[#1A1A1A] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] text-white flex justify-between items-center">
            <span>Payment & Price Breakdown</span>
            <span className={`text-[10px] px-2 py-0.5 font-bold uppercase ${
              booking.payment_status === 'Completed' || booking.payment_status === 'Paid'
                ? 'bg-emerald-500 text-white'
                : 'bg-[#C5A059] text-[#1A1A1A]'
            }`}>
              {booking.payment_status === 'Completed' || booking.payment_status === 'Paid' ? 'PAID ONLINE' : booking.payment_status}
            </span>
          </div>
          <div className="p-4 space-y-2.5 text-xs text-[#1A1A1A]">
            <div className="flex justify-between text-[#666666]">
              <span>{booking.room_name} ({booking.rooms_requested} Room × {booking.nights} Night @ ₹{booking.price_per_night.toLocaleString('en-IN')})</span>
              <span className="font-medium text-[#1A1A1A]">₹{booking.room_subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-[#666666]">
              <span>GST & Taxes (12%)</span>
              <span className="font-medium text-[#1A1A1A]">₹{booking.tax_amount.toLocaleString('en-IN')}</span>
            </div>
            <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-serif font-bold text-[#1A1A1A]">
              <span>Total Amount Paid / Payable</span>
              <span className="text-[#C5A059] text-base font-bold">₹{booking.total_amount.toLocaleString('en-IN')}</span>
            </div>

            {/* Payment Gateway Specifics */}
            <div className="pt-3 border-t border-dashed border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-[#FDFCFB] p-3 border">
              <div>
                <span className="text-[#666666] block">Payment Method:</span>
                <span className="font-semibold text-[#1A1A1A]">{booking.payment_method === 'online_razorpay' ? 'Razorpay Standard Checkout (Online)' : 'Pay at Reception'}</span>
              </div>
              {booking.razorpay_payment_id || booking.payment_txn_id ? (
                <div>
                  <span className="text-[#666666] block">Razorpay Payment ID:</span>
                  <span className="font-mono font-bold text-emerald-700">{booking.razorpay_payment_id || booking.payment_txn_id}</span>
                </div>
              ) : null}
              {booking.razorpay_order_id ? (
                <div>
                  <span className="text-[#666666] block">Razorpay Order ID:</span>
                  <span className="font-mono text-[#1A1A1A]">{booking.razorpay_order_id}</span>
                </div>
              ) : null}
              {booking.payment_verified_at ? (
                <div>
                  <span className="text-[#666666] block">Paid On:</span>
                  <span className="text-[#1A1A1A]">{new Date(booking.payment_verified_at).toLocaleString('en-IN')}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {booking.special_request && (
          <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg text-xs">
            <span className="font-bold text-stone-700">Special Request: </span>
            <span className="text-stone-600">{booking.special_request}</span>
          </div>
        )}

        {/* Footer info / Rules */}
        <div className="text-[11px] text-stone-500 space-y-1 border-t border-stone-200 pt-4">
          <p className="font-bold text-stone-700">Important Hotel Guidelines:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Government-issued Photo ID (Aadhaar / Voter ID / Passport) is mandatory for all adult guests at check-in.</li>
            <li>Standard Check-in: 12:00 PM | Standard Check-out: 11:00 AM.</li>
            <li>Pure vegetarian food premises in accordance with Salasar Balaji holy guidelines.</li>
          </ul>
        </div>
      </div>

      {/* Action Buttons (Hidden when printing) */}
      <div className="bg-stone-100 px-6 py-4 border-t border-stone-200 flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div className="text-xs text-stone-500">
          Need help? Call <strong className="text-stone-800">+91 99835 67921</strong>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-200 transition-colors"
            >
              Close
            </button>
          )}
          <button
            onClick={handlePrint}
            className="bg-stone-900 hover:bg-stone-800 text-stone-100 font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            Print Confirmation
          </button>
        </div>
      </div>
    </div>
  );
};
