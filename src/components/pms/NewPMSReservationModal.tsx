import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Calendar,
  User,
  Phone,
  Mail,
  DoorOpen,
  DollarSign,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../../lib/api';
import { Property, RoomType, BookingSource, PropertyCode } from '../../types';

interface NewPMSReservationModalProps {
  prefill?: {
    propertyCode?: string;
    roomTypeId?: string;
    roomNumber?: string;
    checkIn?: string;
    checkOut?: string;
  };
  onClose: () => void;
  onSuccess: (booking: any) => void;
}

export const NewPMSReservationModal: React.FC<NewPMSReservationModalProps> = ({
  prefill,
  onClose,
  onSuccess
}) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [propertyCode, setPropertyCode] = useState<string>(prefill?.propertyCode || 'sbm-hotel');
  const [roomTypeId, setRoomTypeId] = useState<string>(prefill?.roomTypeId || '');
  const [roomNumber, setRoomNumber] = useState<string>(prefill?.roomNumber || '');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

  const [checkIn, setCheckIn] = useState<string>(prefill?.checkIn || todayStr);
  const [checkOut, setCheckOut] = useState<string>(prefill?.checkOut || tomorrowStr);
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [roomsCount, setRoomsCount] = useState<number>(1);

  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestAddress, setGuestAddress] = useState<string>('');
  const [guestIdType, setGuestIdType] = useState<string>('Aadhaar');
  const [guestIdNumber, setGuestIdNumber] = useState<string>('');

  const [source, setSource] = useState<BookingSource>('WALK_IN');
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<number>(0);
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<string>('CASH');
  const [internalNotes, setInternalNotes] = useState<string>('');

  useEffect(() => {
    Promise.all([api.getProperties(), api.getRoomTypes()])
      .then(([propsRes, roomsRes]) => {
        setProperties(propsRes);
        setRoomTypes(roomsRes);
        if (!roomTypeId && roomsRes.length > 0) {
          const matching = roomsRes.find((r) => r.property_code === propertyCode);
          if (matching) setRoomTypeId(matching.id);
          else setRoomTypeId(roomsRes[0].id);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  const selectedRoomType = roomTypes.find((r) => r.id === roomTypeId);
  
  // Calculate Tariff
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate
    ? 1
    : Math.ceil(Math.abs(checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  const pricePerNight = selectedRoomType ? selectedRoomType.price_per_night : 2500;
  const subtotal = pricePerNight * nights * roomsCount;
  const tax = Math.round(subtotal * 0.12);
  const totalAmount = subtotal + tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!guestName.trim()) {
      setError('Guest Name is required');
      return;
    }
    if (!guestPhone.trim() || guestPhone.trim().length < 10) {
      setError('Valid 10-digit mobile number is required');
      return;
    }
    if (!roomTypeId) {
      setError('Please select a room category');
      return;
    }

    setLoading(true);
    try {
      const created = await api.pms.createReservation({
        property_code: propertyCode as PropertyCode,
        room_type_id: roomTypeId,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children,
        rooms: roomsCount,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        guest_email: guestEmail.trim() || undefined,
        guest_address: guestAddress.trim() || undefined,
        guest_id_type: guestIdType,
        guest_id_number: guestIdNumber.trim() || undefined,
        source,
        room_number: roomNumber.trim() || undefined,
        initial_payment_amount: Number(initialPaymentAmount) || 0,
        initial_payment_method: initialPaymentMethod,
        internal_notes: internalNotes.trim() || undefined
      });

      onSuccess(created);
    } catch (err: any) {
      setError(err.message || 'Failed to create reservation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full border border-[#C5A059]/40 shadow-2xl p-6 relative max-h-[95vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-800 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <span className="bg-[#1A1A1A] text-[#C5A059] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">
            FRONT DESK RESERVATION ENTRY
          </span>
        </div>
        <h2 className="text-xl font-serif font-bold text-stone-900 mb-4">
          Create Walk-in / Direct Reservation
        </h2>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Property & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-3.5 border border-stone-200">
            <div>
              <label className="font-bold text-stone-700 uppercase block mb-1">Property</label>
              <select
                value={propertyCode}
                onChange={(e) => {
                  setPropertyCode(e.target.value);
                  const matching = roomTypes.find((r) => r.property_code === e.target.value);
                  if (matching) setRoomTypeId(matching.id);
                }}
                className="w-full bg-white border border-stone-300 p-2 font-medium"
              >
                <option value="sbm-hotel">SBM Hotel (Opp. Temple)</option>
                <option value="sbm-guesthouse">SBM 2 Guest House</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-stone-700 uppercase block mb-1">Room Category</label>
              <select
                value={roomTypeId}
                onChange={(e) => setRoomTypeId(e.target.value)}
                className="w-full bg-white border border-stone-300 p-2 font-medium"
              >
                {roomTypes
                  .filter((r) => r.property_code === propertyCode)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (₹{r.price_per_night}/nt)
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-stone-700 uppercase block mb-1">
                Room No. (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 101, 102"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="w-full bg-white border border-stone-300 p-2 font-medium"
              />
            </div>
          </div>

          {/* Dates & Source */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-bold text-stone-700 uppercase block mb-1">Check-in</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-white border border-stone-300 p-2 font-medium"
                required
              />
            </div>
            <div>
              <label className="font-bold text-stone-700 uppercase block mb-1">Check-out</label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-white border border-stone-300 p-2 font-medium"
                required
              />
            </div>
            <div>
              <label className="font-bold text-stone-700 uppercase block mb-1">Adults</label>
              <select
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="w-full bg-white border border-stone-300 p-2 font-medium"
              >
                <option value={1}>1 Adult</option>
                <option value={2}>2 Adults</option>
                <option value={3}>3 Adults</option>
                <option value={4}>4 Adults</option>
                <option value={5}>5 Adults</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-stone-700 uppercase block mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as BookingSource)}
                className="w-full bg-white border border-stone-300 p-2 font-bold text-stone-900"
              >
                <option value="WALK_IN">Walk-in</option>
                <option value="PHONE">Phone Reservation</option>
                <option value="WHATSAPP">WhatsApp Direct</option>
                <option value="ADMIN_DIRECT">Front Desk Direct</option>
              </select>
            </div>
          </div>

          {/* Guest Profile */}
          <div className="border-t border-stone-200 pt-3">
            <h3 className="font-serif font-bold text-sm text-stone-900 mb-2">Guest Profile Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">
                  Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Guest Full Name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-white border border-stone-300 p-2 font-medium"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">
                  Mobile Number <span className="text-rose-600">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="10-digit Mobile"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full bg-white border border-stone-300 p-2 font-medium"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="guest@gmail.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full bg-white border border-stone-300 p-2 font-medium"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">
                  ID Proof (Aadhaar / Passport)
                </label>
                <div className="flex gap-2">
                  <select
                    value={guestIdType}
                    onChange={(e) => setGuestIdType(e.target.value)}
                    className="w-1/3 bg-white border border-stone-300 p-2 text-[11px]"
                  >
                    <option value="Aadhaar">Aadhaar</option>
                    <option value="Driving License">DL</option>
                    <option value="Passport">Passport</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>
                  <input
                    type="text"
                    placeholder="ID Number"
                    value={guestIdNumber}
                    onChange={(e) => setGuestIdNumber(e.target.value)}
                    className="w-2/3 bg-white border border-stone-300 p-2 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Advance Payment & Summary */}
          <div className="bg-stone-900 text-white p-4 space-y-3">
            <div className="flex justify-between items-center text-stone-300">
              <span>Tariff: ₹{pricePerNight} × {nights} night(s)</span>
              <span>Subtotal: ₹{subtotal}</span>
            </div>
            <div className="flex justify-between items-center text-stone-300">
              <span>GST (12%):</span>
              <span>₹{tax}</span>
            </div>
            <div className="flex justify-between items-center text-base font-serif font-bold text-[#C5A059] border-t border-stone-800 pt-2">
              <span>Total Amount:</span>
              <span>₹{totalAmount}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-800">
              <div>
                <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1">
                  Advance Collected (₹)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={initialPaymentAmount}
                  onChange={(e) => setInitialPaymentAmount(Number(e.target.value))}
                  className="w-full bg-stone-800 border border-stone-700 text-white p-2 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1">
                  Payment Mode
                </label>
                <select
                  value={initialPaymentMethod}
                  onChange={(e) => setInitialPaymentMethod(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 text-white p-2 font-medium"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-stone-200 text-stone-800 px-4 py-2 font-bold uppercase tracking-wider hover:bg-stone-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#C5A059] text-white px-6 py-2 font-bold uppercase tracking-widest hover:bg-[#B38F48] transition shadow-md flex items-center gap-2"
            >
              {loading ? 'Creating...' : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
