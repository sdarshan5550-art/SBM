import React, { useState } from 'react';
import {
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  CreditCard,
  Layers,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { PropertyCode, NormalizedOTAReservation } from '../../types';

interface Props {
  onReservationImported: () => void;
}

export const OTASimulatorView: React.FC<Props> = ({ onReservationImported }) => {
  const [channel, setChannel] = useState<any>('BOOKING_COM');
  const [extId, setExtId] = useState<string>(() => `OTA-${Math.floor(100000 + Math.random() * 900000)}`);
  const [guestName, setGuestName] = useState<string>('Rameshwar Prasad');
  const [guestPhone, setGuestPhone] = useState<string>('+91 98765 43210');
  const [guestEmail, setGuestEmail] = useState<string>('rameshwar.prasad@example.com');
  const [propertyCode, setPropertyCode] = useState<PropertyCode>('sbm-hotel');
  const [roomTypeId, setRoomTypeId] = useState<string>('room-sbm-deluxe');
  const [checkIn, setCheckIn] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().split('T')[0];
  });
  const [checkOut, setCheckOut] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  });
  const [amount, setAmount] = useState<number>(5600);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    const payload: NormalizedOTAReservation = {
      externalReservationId: extId.trim(),
      channel: channel as any,
      channelCode: channel as any,
      propertyCode,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim(),
      guestPhone: guestPhone.trim(),
      roomTypeId,
      checkIn,
      checkOut,
      adults: 2,
      children: 0,
      rooms: 1,
      totalAmount: Number(amount) || 5000,
      currency: 'INR',
      paymentStatus: 'Paid',
      reservationStatus: isCancelled ? 'Cancelled' : 'Confirmed',
      isCancelled
    };

    try {
      const res = await api.channelManager.importOTAReservation(payload);
      setResult(res);
      onReservationImported();
    } catch (err: any) {
      setError(err.message || 'Simulation import error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-600" />
              OTA Inbound Webhook Simulator
            </h3>
            <p className="text-xs text-stone-500">
              Simulate inbound bookings, modifications, and cancellations from Booking.com, Agoda, MakeMyTrip, and Expedia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExtId(`OTA-${Math.floor(100000 + Math.random() * 900000)}`)}
            className="px-3 py-1 text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-300 rounded-lg hover:bg-stone-50"
          >
            Generate New OTA Ref
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-bold">Simulation Error / Rejection</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{result.isExisting ? 'Idempotent Duplicate / Update Acknowledged' : 'New OTA Reservation Successfully Ingested'}</span>
            </div>
            <p>{result.message}</p>
            {result.booking && (
              <div className="bg-white p-3 rounded-lg border border-emerald-200 font-mono text-[11px] text-stone-800">
                Booking #: {result.booking.booking_number} | Room: {result.booking.room_name} | Dates: {result.booking.check_in} ➔ {result.booking.check_out} | Status: {result.booking.booking_status}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Channel Source</label>
            <select
              value={channel}
              onChange={e => setChannel(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold text-stone-800"
            >
              <option value="BOOKING_COM">Booking.com</option>
              <option value="MMT">MakeMyTrip</option>
              <option value="GOIBIBO">Goibibo</option>
              <option value="AGODA">Agoda</option>
              <option value="EXPEDIA">Expedia</option>
              <option value="CTRIP">Trip.com / Ctrip</option>
              <option value="CLEARTRIP">Cleartrip</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">External OTA Booking ID</label>
            <input
              type="text"
              value={extId}
              onChange={e => setExtId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Total Amount (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Guest Full Name</label>
            <input
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Guest Phone</label>
            <input
              type="text"
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Guest Email</label>
            <input
              type="email"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Room Category</label>
            <select
              value={roomTypeId}
              onChange={e => setRoomTypeId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="room-sbm-deluxe">Deluxe Room (SBM Hotel)</option>
              <option value="room-sbm-family">Family Suite (SBM Hotel)</option>
              <option value="room-gh-deluxe">Deluxe Room (Guest House)</option>
              <option value="room-gh-family">Family Suite (Guest House)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Check-In Date</label>
            <input
              type="date"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Check-Out Date</label>
            <input
              type="date"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
          <label className="flex items-center gap-2 text-xs font-bold text-red-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isCancelled}
              onChange={e => setIsCancelled(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500"
            />
            Simulate Cancellation Event (isCancelled: true)
          </label>

          <button
            type="button"
            onClick={handleSimulate}
            disabled={loading}
            className="px-6 py-2.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-amber-400" />}
            Trigger Inbound Webhook Event
          </button>
        </div>
      </div>
    </div>
  );
};
