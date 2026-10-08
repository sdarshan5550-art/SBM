import React, { useState, useEffect } from 'react';
import { X, Calendar, Building, Users, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft, CreditCard, Lock, AlertCircle, RefreshCw, Check, Tag, Ticket } from 'lucide-react';
import { RoomAvailabilityResult, Booking, CouponValidateResult } from '../types';
import { api } from '../lib/api';
import { openRazorpayCheckout } from '../lib/razorpay';
import { BookingVoucher } from './BookingVoucher';

interface BookingFlowModalProps {
  selectedResult: RoomAvailabilityResult;
  searchParams: {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    rooms: number;
  };
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
}

export const BookingFlowModal: React.FC<BookingFlowModalProps> = ({
  selectedResult,
  searchParams,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Guest Details, 2: Payment/Review, 3: Success Voucher
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [specialRequest, setSpecialRequest] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'online_razorpay' | 'pay_at_hotel'>('online_razorpay');

  // Coupon System State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidateResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatusNote, setPaymentStatusNote] = useState<string | null>(null);
  const [activePendingBookingId, setActivePendingBookingId] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [gatewayConfig, setGatewayConfig] = useState<{ key_id: string; is_configured: boolean; mode: string } | null>(null);

  useEffect(() => {
    api.getPaymentConfig()
      .then(setGatewayConfig)
      .catch(() => {
        setGatewayConfig({ key_id: 'rzp_test_sbmhotel2026', is_configured: false, mode: 'test' });
      });
  }, []);

  const cleanPhone = guestPhone.trim();
  const cleanEmail = guestEmail.trim().toLowerCase();

  const isPhoneValid = /^[0-9]{10}$/.test(cleanPhone);
  const isEmailValid = /^[a-z0-9._%+-]+@gmail\.com$/.test(cleanEmail);

  // Dynamic pricing calculation with coupon
  const subtotalAmt = selectedResult.subtotal;
  const discountAmt = appliedCoupon?.valid ? appliedCoupon.discountAmount : 0;
  const taxableAmt = Math.max(0, subtotalAmt - discountAmt);
  const taxAmt = appliedCoupon?.valid ? appliedCoupon.taxAmount : selectedResult.taxAmount;
  const finalTotalAmt = appliedCoupon?.valid ? appliedCoupon.totalAmount : selectedResult.totalAmount;

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await api.validateCoupon({
        code: couponCodeInput.trim(),
        roomId: selectedResult.roomType.id,
        bookingAmount: subtotalAmt,
        guestEmail: cleanEmail || undefined,
        guestPhone: cleanPhone || undefined
      });

      if (res.valid) {
        setAppliedCoupon(res);
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(res.error || 'Invalid coupon code.');
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err.message || 'Failed to validate coupon code.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCouponError(null);
  };

  // Handle Online Razorpay Payment Flow
  const handlePayWithRazorpay = async () => {
    setLoading(true);
    setError(null);
    setPaymentStatusNote(null);

    try {
      // 1. Create Order on Backend (server calculates total amount)
      const orderData = await api.createPaymentOrder({
        property_code: selectedResult.property.code,
        room_type_id: selectedResult.roomType.id,
        check_in: searchParams.checkIn,
        check_out: searchParams.checkOut,
        adults: searchParams.adults,
        children: searchParams.children,
        rooms: searchParams.rooms,
        guest_name: guestName.trim(),
        guest_phone: cleanPhone,
        guest_email: cleanEmail,
        special_request: specialRequest.trim(),
        coupon_code: appliedCoupon?.code,
        existing_booking_id: activePendingBookingId || undefined
      });

      setActivePendingBookingId(orderData.booking_id);

      // 2. Open Razorpay Standard Checkout
      await openRazorpayCheckout({
        key: orderData.key_id || gatewayConfig?.key_id || 'rzp_test_sbmhotel2026',
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'SBM Hotel Salasar',
        description: `${selectedResult.roomType.name} — ${selectedResult.property.name} (${selectedResult.nights}N)`,
        order_id: orderData.order_id,
        prefill: {
          name: guestName.trim(),
          email: cleanEmail,
          contact: cleanPhone
        },
        notes: {
          booking_id: orderData.booking_id,
          booking_number: orderData.booking_number,
          property: selectedResult.property.name,
          room: selectedResult.roomType.name
        },
        theme: {
          color: '#C5A059'
        },
        handler: async (response) => {
          // 3. Verify Payment Signature on Backend
          setVerifying(true);
          setLoading(false);
          try {
            const verifyRes = await api.verifyPayment({
              booking_id: orderData.booking_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyRes.success && verifyRes.booking) {
              setConfirmedBooking(verifyRes.booking);
              setStep(3);
              onSuccess(verifyRes.booking);
            } else {
              setError(verifyRes.message || 'Payment signature verification could not be completed.');
            }
          } catch (verifyErr: any) {
            setError(verifyErr.message || 'Payment verification failed on server. Please contact reception with payment ID.');
          } finally {
            setVerifying(false);
          }
        },
        onPaymentFailed: async (failedRes) => {
          setLoading(false);
          const desc = failedRes?.error?.description || failedRes?.error?.reason || 'Payment was declined by your bank or payment method.';
          setError(`Online Payment Failed: ${desc}. You can retry or choose "Pay at Reception (Offline)".`);
          try {
            await api.recordPaymentFailure({
              booking_id: orderData.booking_id,
              razorpay_order_id: failedRes?.error?.metadata?.order_id || orderData.order_id,
              error_code: failedRes?.error?.code,
              error_description: desc
            });
          } catch (ignore) {}
        },
        modal: {
          ondismiss: async () => {
            setLoading(false);
            setPaymentStatusNote('Payment window was closed before completion. Your room is temporarily held in pending status. Click "PAY NOW" to try again or select "Pay at Reception".');
            try {
              await api.recordPaymentFailure({
                booking_id: orderData.booking_id,
                razorpay_order_id: orderData.order_id,
                error_description: 'Checkout modal dismissed by user before completion.'
              });
            } catch (ignore) {}
          }
        }
      });
    } catch (err: any) {
      setLoading(false);
      const msg = err.message || 'Unable to initialize online payment. Please try again or choose Pay at Reception.';
      setError(msg);
    }
  };

  // Handle Pay at Hotel Offline Confirmation
  const handlePayAtHotel = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: Partial<Booking> = {
        property_id: selectedResult.property.id,
        property_code: selectedResult.property.code,
        property_name: selectedResult.property.name,
        room_type_id: selectedResult.roomType.id,
        room_name: selectedResult.roomType.name,
        guest_name: guestName.trim(),
        guest_phone: cleanPhone,
        guest_email: cleanEmail,
        adults: searchParams.adults,
        children: searchParams.children,
        rooms_requested: searchParams.rooms,
        check_in: searchParams.checkIn,
        check_out: searchParams.checkOut,
        nights: selectedResult.nights,
        price_per_night: selectedResult.pricePerNight,
        room_subtotal: selectedResult.subtotal,
        discount_amount: discountAmt,
        coupon_code: appliedCoupon?.code,
        tax_amount: taxAmt,
        total_amount: finalTotalAmt,
        payment_method: 'pay_at_hotel',
        payment_status: 'Pending',
        booking_status: 'Confirmed',
        special_request: specialRequest.trim()
      };

      const result = await api.createBooking(payload);
      setConfirmedBooking(result);
      setStep(3);
      onSuccess(result);
    } catch (err: any) {
      setError(err.message || 'Failed to complete booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneTouched(true);
    setEmailTouched(true);

    if (!guestName.trim()) {
      setError('Please provide your Full Name.');
      return;
    }
    if (!isPhoneValid && !isEmailValid) {
      setError('Please enter a valid 10-digit mobile number and Gmail address ending with @gmail.com.');
      return;
    }
    if (!isPhoneValid) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!isEmailValid) {
      setError('Please enter a valid Gmail address ending with @gmail.com.');
      return;
    }
    if (!agreedTerms) {
      setError('Please agree to the Terms & Conditions and Privacy Policy.');
      return;
    }

    if (paymentMethod === 'online_razorpay') {
      await handlePayWithRazorpay();
    } else {
      await handlePayAtHotel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className={`relative w-full ${step === 3 ? 'max-w-3xl' : 'max-w-2xl'} max-h-[92vh] flex flex-col bg-white border border-[#C5A059]/30 shadow-2xl text-[#1A1A1A] my-auto overflow-hidden`}>
        {/* Header */}
        <div className="bg-[#1A1A1A] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center text-white border-b-2 border-[#C5A059] shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="text-base sm:text-lg font-serif font-medium text-white truncate">
              {step === 3 ? 'Reservation Confirmed' : 'Complete Your Booking'}
            </h3>
            <p className="text-xs text-[#C5A059] font-medium tracking-wide truncate">
              {selectedResult.property.name} — {selectedResult.roomType.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {step === 3 && confirmedBooking ? (
            <BookingVoucher
              booking={confirmedBooking}
              property={selectedResult.property}
              onClose={onClose}
              isEmbeddedInModal={true}
            />
          ) : (
            <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            {/* Step Progress Bar */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-4 text-xs uppercase tracking-widest font-semibold text-[#999999]">
              <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#C5A059]' : ''}`}>
                <span className="w-5 h-5 bg-[#C5A059] text-white flex items-center justify-center text-[10px] font-bold">1</span>
                Guest Information
              </div>
              <div className="w-8 h-px bg-stone-200" />
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#C5A059]' : ''}`}>
                <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold ${step >= 2 ? 'bg-[#C5A059] text-white' : 'bg-stone-200 text-[#666]'}`}>2</span>
                Review & Payment
              </div>
            </div>

            {/* Stay Summary Bar */}
            <div className="bg-[#FDFCFB] p-4 border border-stone-200 text-xs space-y-2">
              <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                <span className="text-[#666666]">Stay Duration</span>
                <span className="text-[#1A1A1A] font-semibold">{searchParams.checkIn} to {searchParams.checkOut} ({selectedResult.nights} Night{selectedResult.nights > 1 ? 's' : ''})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#666666]">Guests & Rooms</span>
                <span className="text-[#1A1A1A] font-semibold">{searchParams.adults} Adult(s), {searchParams.children} Child(ren) • {searchParams.rooms} {selectedResult.roomType.name}</span>
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Payment / Booking Notice:</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            {paymentStatusNote && !error && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>{paymentStatusNote}</div>
              </div>
            )}

            {verifying && (
              <div className="p-4 bg-[#C5A059]/10 border border-[#C5A059] text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-[#C5A059] animate-spin mx-auto" />
                <div className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">Verifying Razorpay Payment...</div>
                <div className="text-[11px] text-[#666666]">Please do not refresh or close this window while we secure your booking.</div>
              </div>
            )}

            {/* Step 1: Guest Information */}
            {step === 1 && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#C5A059]">Guest Information</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#1A1A1A] mb-1">
                      Full Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1A1A1A] mb-1">
                      Mobile Number <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="9876543210"
                      value={guestPhone}
                      onChange={(e) => {
                        setGuestPhone(e.target.value);
                        setPhoneTouched(true);
                        if (error) setError(null);
                      }}
                      onBlur={() => setPhoneTouched(true)}
                      className={`w-full bg-[#FDFCFB] border px-3.5 py-2.5 text-sm text-[#1A1A1A] focus:outline-none transition-colors ${
                        isPhoneValid
                          ? 'border-emerald-500 focus:border-emerald-600'
                          : (phoneTouched || step === 2 || guestPhone.length > 0)
                          ? 'border-rose-400 focus:border-rose-600'
                          : 'border-stone-200 focus:border-[#C5A059]'
                      }`}
                    />
                    {isPhoneValid ? (
                      <p className="text-emerald-700 text-xs mt-1 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>✓ Valid mobile number</span>
                      </p>
                    ) : (phoneTouched || step === 2 || guestPhone.length > 0) ? (
                      <p className="text-rose-600 text-xs mt-1 font-medium">
                        Please enter a valid 10-digit mobile number.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">
                    Email Address (Gmail) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="guest@gmail.com"
                    value={guestEmail}
                    onChange={(e) => {
                      setGuestEmail(e.target.value);
                      setEmailTouched(true);
                      if (error) setError(null);
                    }}
                    onBlur={() => setEmailTouched(true)}
                    className={`w-full bg-[#FDFCFB] border px-3.5 py-2.5 text-sm text-[#1A1A1A] focus:outline-none transition-colors ${
                      isEmailValid
                        ? 'border-emerald-500 focus:border-emerald-600'
                        : (emailTouched || step === 2 || guestEmail.length > 0)
                        ? 'border-rose-400 focus:border-rose-600'
                        : 'border-stone-200 focus:border-[#C5A059]'
                    }`}
                  />
                  {isEmailValid ? (
                    <p className="text-emerald-700 text-xs mt-1 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>✓ Valid Gmail address</span>
                    </p>
                  ) : (emailTouched || step === 2 || guestEmail.length > 0) ? (
                    <p className="text-rose-600 text-xs mt-1 font-medium">
                      Please enter a valid Gmail address ending with @gmail.com.
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#999999] mt-1">
                      Your digital voucher & receipt will be sent here.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Ground floor room, early check-in inquiry, extra bedding..."
                    value={specialRequest}
                    onChange={(e) => setSpecialRequest(e.target.value)}
                    className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!guestName.trim() || !isPhoneValid || !isEmailValid}
                    onClick={() => {
                      setPhoneTouched(true);
                      setEmailTouched(true);
                      if (!guestName.trim()) {
                        setError('Please enter your Full Name.');
                        return;
                      }
                      if (!isPhoneValid && !isEmailValid) {
                        setError('Please enter a valid 10-digit mobile number and Gmail address ending with @gmail.com.');
                        return;
                      }
                      if (!isPhoneValid) {
                        setError('Please enter a valid 10-digit mobile number.');
                        return;
                      }
                      if (!isEmailValid) {
                        setError('Please enter a valid Gmail address ending with @gmail.com.');
                        return;
                      }
                      setError(null);
                      setStep(2);
                    }}
                    className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-[0.2em] font-bold py-3.5 px-6 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Proceed to Review & Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Review & Payment */}
            {step === 2 && (
              <form onSubmit={handleSubmitBooking} className="space-y-5">
                {/* Booking & Guest Summary */}
                <div className="bg-[#FDFCFB] p-4 border border-stone-200 text-xs space-y-3">
                  <h4 className="font-bold text-[#C5A059] uppercase tracking-[0.2em] text-[10px]">Booking Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-[#1A1A1A]">
                    <div>
                      <span className="text-[#666666] block text-[11px]">Property</span>
                      <strong className="font-serif text-sm">{selectedResult.property.name}</strong>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[11px]">Room Category</span>
                      <strong>{searchParams.rooms} × {selectedResult.roomType.name}</strong>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[11px]">Check-in</span>
                      <span>{searchParams.checkIn} (12:00 PM)</span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[11px]">Check-out</span>
                      <span>{searchParams.checkOut} (11:00 AM)</span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[11px]">Primary Guest</span>
                      <span>{guestName} ({cleanPhone})</span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[11px]">Email</span>
                      <span>{cleanEmail}</span>
                    </div>
                  </div>
                </div>

                {/* Have a coupon code? Section */}
                <div className="bg-[#FDFCFB] p-4 border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-[#C5A059]" />
                      Have a coupon code?
                    </span>
                    {appliedCoupon?.valid && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200 rounded-xs flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Coupon Applied ({appliedCoupon.code})
                      </span>
                    )}
                  </div>

                  {!appliedCoupon?.valid ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(e) => {
                          setCouponCodeInput(e.target.value.toUpperCase());
                          if (couponError) setCouponError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyCoupon();
                          }
                        }}
                        placeholder="e.g. SBM10 or WELCOME500"
                        className="flex-1 bg-white border border-stone-200 px-3 py-2 text-xs font-mono uppercase text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                      />
                      <button
                        type="button"
                        disabled={couponLoading || !couponCodeInput.trim()}
                        onClick={handleApplyCoupon}
                        className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {couponLoading ? 'Applying...' : 'Apply'}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-xs flex items-center justify-between">
                      <div className="text-xs text-emerald-900">
                        <span className="font-bold block text-sm text-emerald-800">
                          {appliedCoupon.code} &mdash; Saved ₹{discountAmt.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[11px] text-emerald-700">
                          {appliedCoupon.message || 'Coupon discount applied to taxable room charges.'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-xs text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer ml-3 shrink-0"
                      >
                        Remove Coupon
                      </button>
                    </div>
                  )}

                  {couponError && (
                    <p className="text-rose-600 text-xs font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{couponError}</span>
                    </p>
                  )}
                </div>

                {/* Price Breakdown */}
                <div className="bg-[#FDFCFB] p-4 border border-stone-200 space-y-2 text-xs">
                  <h4 className="font-bold text-[#C5A059] uppercase tracking-[0.2em] text-[10px] mb-2">Price Breakdown</h4>
                  <div className="flex justify-between text-[#666666]">
                    <span>
                      Room Charges ({searchParams.rooms} Room × {selectedResult.nights} Night @ ₹{selectedResult.pricePerNight.toLocaleString('en-IN')})
                    </span>
                    <span className="font-medium text-[#1A1A1A]">₹{subtotalAmt.toLocaleString('en-IN')}</span>
                  </div>

                  {discountAmt > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Coupon Discount ({appliedCoupon?.code || 'Applied'})</span>
                        <span className="font-bold">-₹{discountAmt.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-[#666666] pt-0.5 border-t border-dashed border-stone-200">
                        <span>Taxable Amount</span>
                        <span className="font-medium text-[#1A1A1A]">₹{taxableAmt.toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-[#666666]">
                    <span>GST & Taxes (12%)</span>
                    <span className="font-medium text-[#1A1A1A]">₹{taxAmt.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t border-stone-200 pt-2 flex justify-between text-sm font-serif font-bold text-[#1A1A1A]">
                    <span>Total Amount Payable</span>
                    <span className="text-[#C5A059] text-base font-bold">₹{finalTotalAmt.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Payment Option Selection */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-[#1A1A1A]">Payment Option</label>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                      Razorpay Checkout Active
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      onClick={() => setPaymentMethod('online_razorpay')}
                      className={`p-3.5 border cursor-pointer flex items-start gap-3 transition-all ${
                        paymentMethod === 'online_razorpay'
                          ? 'bg-[#C5A059]/10 border-[#C5A059] text-[#1A1A1A] ring-1 ring-[#C5A059]'
                          : 'bg-white border-stone-200 text-[#666666] hover:border-stone-300'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-[#C5A059] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                          <span>Pay Online (Razorpay)</span>
                          {paymentMethod === 'online_razorpay' && (
                            <Check className="w-3.5 h-3.5 text-[#C5A059]" />
                          )}
                        </div>
                        <div className="text-[11px] text-[#666666] mt-0.5">
                          UPI (GPay, PhonePe, Paytm), Cards, Netbanking & Wallets.
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => setPaymentMethod('pay_at_hotel')}
                      className={`p-3.5 border cursor-pointer flex items-start gap-3 transition-all ${
                        paymentMethod === 'pay_at_hotel'
                          ? 'bg-[#C5A059]/10 border-[#C5A059] text-[#1A1A1A] ring-1 ring-[#C5A059]'
                          : 'bg-white border-stone-200 text-[#666666] hover:border-stone-300'
                      }`}
                    >
                      <Building className="w-5 h-5 text-[#C5A059] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                          <span>Pay at Reception</span>
                          {paymentMethod === 'pay_at_hotel' && (
                            <Check className="w-3.5 h-3.5 text-[#C5A059]" />
                          )}
                        </div>
                        <div className="text-[11px] text-[#666666] mt-0.5">
                          Pay cash or UPI at the front desk upon check-in.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Terms Agreement Checkbox */}
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#666666] pt-1">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 accent-[#C5A059]"
                  />
                  <span>
                    I agree to the <strong className="text-[#1A1A1A]">Terms & Conditions</strong>, Privacy Policy, and Salasar Balaji temple stay rules of SBM Hotel.
                  </span>
                </label>

                {/* Form Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={loading || verifying}
                    onClick={() => setStep(1)}
                    className="w-1/3 bg-stone-100 hover:bg-stone-200 text-[#1A1A1A] font-semibold py-3.5 transition-colors text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={loading || verifying || !agreedTerms || !isPhoneValid || !isEmailValid || !guestName.trim()}
                    className="w-2/3 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-[0.15em] font-bold py-3.5 shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading || verifying ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#C5A059]" />
                        {verifying ? 'Verifying Signature...' : 'Opening Checkout...'}
                      </span>
                    ) : paymentMethod === 'online_razorpay' ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>PAY NOW (₹{finalTotalAmt.toLocaleString('en-IN')})</span>
                      </>
                    ) : (
                      <>
                        <Building className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Confirm Reservation (₹{finalTotalAmt.toLocaleString('en-IN')})</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);
};

