import React from 'react';
import { Booking, Property } from '../types';
import { CheckCircle2, Printer, MapPin, Phone, Mail, User, ShieldCheck } from 'lucide-react';

interface BookingVoucherProps {
  booking: Booking;
  property?: Property;
  onClose?: () => void;
  isEmbeddedInModal?: boolean;
}

export const BookingVoucher: React.FC<BookingVoucherProps> = ({
  booking,
  property,
  onClose,
  isEmbeddedInModal = false
}) => {
  const handlePrint = () => {
    window.print();
  };

  const containerClasses = isEmbeddedInModal
    ? 'w-full bg-white text-[#1A1A1A] print:shadow-none print:border-none print:m-0 print:max-w-none'
    : 'bg-white text-[#1A1A1A] border border-stone-200 shadow-xl overflow-hidden max-w-3xl w-full mx-auto my-4 sm:my-6 print:shadow-none print:border-none print:m-0 print:max-w-none';

  return (
    <div className={containerClasses}>
      {/* Header Banner */}
      <div className="bg-[#1A1A1A] text-white p-4 sm:p-6 border-b-2 border-[#C5A059] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#C5A059] text-[#1A1A1A] font-serif font-bold text-xs sm:text-sm flex items-center justify-center shrink-0">
              SBM
            </div>
            <span className="text-base sm:text-xl font-serif tracking-widest font-medium text-white truncate">
              SBM HOTEL
            </span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-[#C5A059] font-bold tracking-[0.15em] sm:tracking-[0.2em] uppercase leading-tight">
            Salasar, Rajasthan • Luxury Beside Salasar Balaji Temple
          </p>
        </div>

        <div className="w-full sm:w-auto text-left sm:text-right bg-[#262626] p-2.5 sm:p-3 border border-white/10 shrink-0">
          <div className="text-[9px] uppercase text-stone-400 tracking-[0.2em]">Confirmation ID</div>
          <div className="text-sm sm:text-base font-mono font-bold text-[#C5A059] break-all">{booking.booking_number}</div>
          <div className="text-[10px] text-emerald-400 font-bold tracking-wider flex items-center gap-1 mt-0.5 justify-start sm:justify-end uppercase">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{booking.booking_status}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
        {/* Welcome message */}
        <div className="bg-[#FDFCFB] border border-[#C5A059]/30 p-3.5 sm:p-4 flex items-start gap-2.5 sm:gap-3">
          <ShieldCheck className="w-5 h-5 text-[#C5A059] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-[#1A1A1A]">
              Thank you for booking with SBM Hotel
            </h4>
            <p className="text-xs text-[#666666] mt-0.5 leading-relaxed">
              Your reservation is confirmed. Please present this voucher or your Booking ID at check-in.
            </p>
          </div>
        </div>

        {/* Property & Stay Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {/* Property Info */}
          <div className="space-y-2 bg-stone-50 p-3.5 sm:p-4 rounded-xl border border-stone-200/80 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Property Details</h3>
            <div className="text-sm sm:text-base font-serif font-bold text-stone-900 leading-snug break-words">
              {booking.property_name}
            </div>
            <p className="text-xs text-stone-600 flex items-start gap-2 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="break-words">
                {property?.address || 'Adjacent to Salasar Balaji Temple, Salasar, Rajasthan 331506'}
              </span>
            </p>
            <p className="text-xs text-stone-600 flex items-center gap-2 min-w-0">
              <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="break-words">
                {property?.phone || (booking.property_code === 'sbm-guest-house' ? '+91 98285 00845' : '+91 99835 67921')}
              </span>
            </p>
            <p className="text-xs text-stone-600 flex items-center gap-2 min-w-0">
              <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="break-all">
                {property?.email || (booking.property_code === 'sbm-guest-house' ? 'sbmguesthouse@gmail.com' : 'sbmhotel@gmail.com')}
              </span>
            </p>
          </div>

          {/* Guest Info */}
          <div className="space-y-2 bg-stone-50 p-3.5 sm:p-4 rounded-xl border border-stone-200/80 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Guest Information</h3>
            <div className="text-sm font-semibold text-stone-900 flex items-center gap-2 min-w-0">
              <User className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">{booking.guest_name}</span>
            </div>
            <p className="text-xs text-stone-600 flex items-center gap-1.5 min-w-0">
              <span>Mobile:</span>
              <span className="font-medium text-stone-800 break-all">{booking.guest_phone}</span>
            </p>
            {booking.guest_email && (
              <p className="text-xs text-stone-600 flex items-center gap-1.5 min-w-0">
                <span>Email:</span>
                <span className="font-medium text-stone-800 break-all">{booking.guest_email}</span>
              </p>
            )}
            <p className="text-xs text-stone-600 flex items-center gap-1.5 min-w-0">
              <span>Occupants:</span>
              <span className="font-medium text-stone-800 break-words">
                {booking.adults} Adult(s), {booking.children} Child(ren)
              </span>
            </p>
            <p className="text-xs text-stone-600 flex items-center gap-1.5 min-w-0">
              <span>Rooms:</span>
              <span className="font-medium text-stone-800 break-words">
                {booking.rooms_requested} × {booking.room_name}
              </span>
            </p>
          </div>
        </div>

        {/* Stay Dates Box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 bg-stone-900 text-stone-100 p-3 sm:p-4 rounded-xl text-center divide-y sm:divide-y-0 sm:divide-x divide-stone-800">
          <div className="pb-2 sm:pb-0">
            <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">Check-In Date</div>
            <div className="text-sm sm:text-base font-bold text-stone-100 mt-0.5">{booking.check_in}</div>
            <div className="text-[10px] text-stone-400">From 12:00 PM</div>
          </div>
          <div className="py-2 sm:py-0 flex flex-col justify-center">
            <div className="text-[10px] uppercase tracking-wider text-stone-400">Duration</div>
            <div className="text-sm sm:text-base font-bold text-amber-400">{booking.nights} Night(s)</div>
            <div className="text-[10px] text-stone-400">{booking.rooms_requested} Room(s)</div>
          </div>
          <div className="pt-2 sm:pt-0">
            <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">Check-Out Date</div>
            <div className="text-sm sm:text-base font-bold text-stone-100 mt-0.5">{booking.check_out}</div>
            <div className="text-[10px] text-stone-400">By 11:00 AM</div>
          </div>
        </div>

        {/* Payment & Price Table */}
        <div className="border border-stone-200 overflow-hidden bg-white shadow-xs">
          <div className="bg-[#1A1A1A] px-3.5 sm:px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] text-white flex flex-wrap justify-between items-center gap-2">
            <span>Payment & Price Breakdown</span>
            <span
              className={`text-[10px] px-2 py-0.5 font-bold uppercase ${
                booking.payment_status === 'Completed' || booking.payment_status === 'Paid'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#C5A059] text-[#1A1A1A]'
              }`}
            >
              {booking.payment_status === 'Completed' || booking.payment_status === 'Paid'
                ? 'PAID ONLINE'
                : booking.payment_status}
            </span>
          </div>
          <div className="p-3.5 sm:p-4 space-y-2 text-xs text-[#1A1A1A]">
            <div className="flex justify-between items-start gap-3 text-[#666666]">
              <span className="min-w-0 break-words">
                {booking.room_name} ({booking.rooms_requested} Room × {booking.nights} Night @ ₹
                {booking.price_per_night.toLocaleString('en-IN')})
              </span>
              <span className="font-medium text-[#1A1A1A] shrink-0 text-right">
                ₹{booking.room_subtotal.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between items-center gap-3 text-[#666666]">
              <span>GST & Taxes (12%)</span>
              <span className="font-medium text-[#1A1A1A] shrink-0 text-right">
                ₹{booking.tax_amount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="pt-2 border-t border-stone-200 flex justify-between items-center gap-3 text-xs sm:text-sm font-serif font-bold text-[#1A1A1A]">
              <span>Total Amount</span>
              <span className="text-[#C5A059] text-base sm:text-lg font-bold shrink-0 text-right">
                ₹{booking.total_amount.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Payment Gateway Specifics */}
            <div className="pt-2.5 border-t border-dashed border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-[#FDFCFB] p-2.5 sm:p-3 border">
              <div className="min-w-0">
                <span className="text-[#666666] block text-[10px] uppercase tracking-wider">Payment Method:</span>
                <span className="font-semibold text-[#1A1A1A] break-words">
                  {booking.payment_method === 'online_razorpay'
                    ? 'Razorpay Standard Checkout (Online)'
                    : 'Pay at Reception'}
                </span>
              </div>
              {booking.razorpay_payment_id || booking.payment_txn_id ? (
                <div className="min-w-0">
                  <span className="text-[#666666] block text-[10px] uppercase tracking-wider">Payment ID:</span>
                  <span className="font-mono font-bold text-emerald-700 break-all">
                    {booking.razorpay_payment_id || booking.payment_txn_id}
                  </span>
                </div>
              ) : null}
              {booking.razorpay_order_id ? (
                <div className="min-w-0">
                  <span className="text-[#666666] block text-[10px] uppercase tracking-wider">Order ID:</span>
                  <span className="font-mono text-[#1A1A1A] break-all">{booking.razorpay_order_id}</span>
                </div>
              ) : null}
              {booking.payment_verified_at ? (
                <div className="min-w-0">
                  <span className="text-[#666666] block text-[10px] uppercase tracking-wider">Paid On:</span>
                  <span className="text-[#1A1A1A]">
                    {new Date(booking.payment_verified_at).toLocaleString('en-IN')}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {booking.special_request && (
          <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg text-xs min-w-0">
            <span className="font-bold text-stone-700">Special Request: </span>
            <span className="text-stone-600 break-words">{booking.special_request}</span>
          </div>
        )}

        {/* Footer info / Rules */}
        <div className="text-[11px] text-stone-500 space-y-1 border-t border-stone-200 pt-3">
          <p className="font-bold text-stone-700">Important Hotel Guidelines:</p>
          <ul className="list-disc pl-4 space-y-0.5 leading-relaxed">
            <li>Government-issued Photo ID (Aadhaar / Voter ID / Passport) is mandatory for all adult guests at check-in.</li>
            <li>Standard Check-in: 12:00 PM | Standard Check-out: 11:00 AM.</li>
            <li>Pure vegetarian food premises in accordance with Salasar Balaji holy guidelines.</li>
          </ul>
        </div>
      </div>

      {/* Action Buttons (Hidden when printing) */}
      <div className="bg-stone-100 px-4 sm:px-6 py-3.5 border-t border-stone-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 print:hidden shrink-0">
        <div className="text-xs text-stone-500 text-center sm:text-left">
          Need help? Call <strong className="text-stone-800 whitespace-nowrap">+91 99835 67921</strong>
        </div>

        <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
          {onClose && (
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-200 transition-colors text-center cursor-pointer"
            >
              Close
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-initial bg-stone-900 hover:bg-stone-800 text-stone-100 font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Print Confirmation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
