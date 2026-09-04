import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  User,
  Phone,
  DoorOpen,
  DollarSign,
  AlertCircle,
  Plus,
  RefreshCw,
  Eye,
  Check,
  X,
  CreditCard
} from 'lucide-react';
import { api } from '../../lib/api';
import { PMSCalendarData, Booking } from '../../types';

interface PMSCalendarViewProps {
  onOpenNewBookingModal: (prefill?: any) => void;
  onSelectBooking?: (booking: Booking) => void;
}

export const PMSCalendarView: React.FC<PMSCalendarViewProps> = ({
  onOpenNewBookingModal,
  onSelectBooking
}) => {
  const [propertyCode, setPropertyCode] = useState<string>('sbm-hotel');
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [daysCount, setDaysCount] = useState<number>(7);
  const [calendarData, setCalendarData] = useState<PMSCalendarData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Booking Drawer
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Payment Recording in Drawer
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  // Room Change in Drawer
  const [showRoomChange, setShowRoomChange] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');

  const fetchCalendar = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.pms.getCalendarData(propertyCode, startDate, daysCount);
      setCalendarData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load PMS tape chart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [propertyCode, startDate, daysCount]);

  const handlePrevPeriod = () => {
    const cur = new Date(startDate);
    cur.setDate(cur.getDate() - daysCount);
    setStartDate(cur.toISOString().split('T')[0]);
  };

  const handleNextPeriod = () => {
    const cur = new Date(startDate);
    cur.setDate(cur.getDate() + daysCount);
    setStartDate(cur.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setStartDate(new Date().toISOString().split('T')[0]);
  };

  const handleCheckIn = async (bookingId: string, roomNum?: string) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const updated = await api.pms.checkIn(bookingId, roomNum);
      setActiveBooking(updated);
      setActionMessage('Guest checked in successfully!');
      fetchCalendar();
    } catch (err: any) {
      setActionMessage(`Check-in failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    if (!confirm('Confirm guest check-out? This will release the physical room.')) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const updated = await api.pms.checkOut(bookingId);
      setActiveBooking(updated);
      setActionMessage('Guest checked out successfully!');
      fetchCalendar();
    } catch (err: any) {
      setActionMessage(`Check-out failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (bookingId: string) => {
    if (!paymentAmount || paymentAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.pms.recordPayment(bookingId, {
        method: paymentMethod,
        amount: paymentAmount,
        notes: `Recorded in PMS Calendar View`
      });
      setActiveBooking(res.updatedBooking);
      setShowPaymentInput(false);
      setPaymentAmount(0);
      setActionMessage(`Recorded ₹${paymentAmount} payment via ${paymentMethod}`);
      fetchCalendar();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeRoom = async (bookingId: string) => {
    if (!newRoomNumber.trim()) {
      alert('Please enter room number');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await api.pms.changeRoom(bookingId, newRoomNumber.trim());
      setActiveBooking(updated);
      setShowRoomChange(false);
      setActionMessage(`Room updated to Room ${newRoomNumber}`);
      fetchCalendar();
    } catch (err: any) {
      alert(err.message || 'Room change failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tape Chart Top Controls */}
      <div className="bg-white border border-[#C5A059]/20 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Property:
            </span>
            <select
              id="pms-calendar-property-select"
              value={propertyCode}
              onChange={(e) => setPropertyCode(e.target.value)}
              className="bg-stone-50 border border-stone-300 text-stone-800 text-sm font-medium px-3 py-2 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
            >
              <option value="sbm-hotel">SBM Hotel (Opp. Temple)</option>
              <option value="sbm-guesthouse">SBM 2 Guest House</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Days:
            </span>
            <select
              id="pms-calendar-days-select"
              value={daysCount}
              onChange={(e) => setDaysCount(Number(e.target.value))}
              className="bg-stone-50 border border-stone-300 text-stone-800 text-sm font-medium px-3 py-2 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
            >
              <option value={7}>7 Days (1 Week)</option>
              <option value={14}>14 Days (2 Weeks)</option>
              <option value={30}>30 Days (Month)</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-stone-100 p-1 border border-stone-200">
            <button
              id="pms-calendar-prev-btn"
              onClick={handlePrevPeriod}
              className="p-1.5 hover:bg-white text-stone-700 transition"
              title="Previous Period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="pms-calendar-today-btn"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider hover:bg-white text-stone-800 transition"
            >
              Today
            </button>
            <button
              id="pms-calendar-next-btn"
              onClick={handleNextPeriod}
              className="p-1.5 hover:bg-white text-stone-700 transition"
              title="Next Period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#C5A059]" />
            <input
              id="pms-calendar-date-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-stone-50 border border-stone-300 text-stone-800 text-xs px-2.5 py-2 font-medium focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="pms-calendar-refresh-btn"
            onClick={fetchCalendar}
            className="p-2 border border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-400 transition"
            title="Refresh Tape Chart"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            id="pms-calendar-new-walkin-btn"
            onClick={() => onOpenNewBookingModal({ propertyCode, checkIn: startDate })}
            className="bg-[#C5A059] hover:bg-[#B38F48] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Walk-in / Direct
          </button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="bg-stone-50 border border-stone-200 px-4 py-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="font-bold text-stone-600 uppercase tracking-wider">Legend:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-emerald-600 rounded-sm"></div>
          <span className="text-stone-700">Checked In (Occupied)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-amber-500 rounded-sm"></div>
          <span className="text-stone-700">Confirmed (Reserved)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-sky-500 rounded-sm"></div>
          <span className="text-stone-700">Pending Advance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-rose-600 rounded-sm"></div>
          <span className="text-stone-700">Maintenance / OOO</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-stone-200 border border-stone-300 rounded-sm"></div>
          <span className="text-stone-700">Available</span>
        </div>
      </div>

      {/* Tape Chart Grid */}
      {loading && !calendarData ? (
        <div className="bg-white border border-stone-200 p-12 text-center text-stone-500 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[#C5A059]" />
          <p className="font-medium text-sm">Loading PMS Visual Tape Chart...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 p-6 text-center text-rose-700">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
          <p className="font-semibold">{error}</p>
          <button
            onClick={fetchCalendar}
            className="mt-3 bg-rose-600 text-white text-xs px-4 py-2 font-bold uppercase tracking-wider hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : calendarData ? (
        <div className="bg-white border border-stone-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            {/* Table Header with Dates */}
            <thead>
              <tr className="bg-stone-900 text-white text-xs uppercase tracking-wider">
                <th className="p-3 border-r border-stone-800 sticky left-0 bg-stone-900 z-10 w-44">
                  Room / Category
                </th>
                {calendarData.dates.map((d) => {
                  const dateObj = new Date(d);
                  const isToday = d === new Date().toISOString().split('T')[0];
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = dateObj.getDate();
                  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

                  return (
                    <th
                      key={d}
                      className={`p-2.5 text-center border-r border-stone-800 font-semibold ${
                        isToday ? 'bg-[#C5A059] text-stone-900 font-bold' : ''
                      }`}
                    >
                      <div className="text-[10px] tracking-widest">{dayName}</div>
                      <div className="text-sm font-serif">
                        {dayNum} {monthName}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body with Physical Rooms & Reservation Bars */}
            <tbody className="divide-y divide-stone-200 text-xs">
              {calendarData.rooms.length === 0 ? (
                <tr>
                  <td colSpan={calendarData.dates.length + 1} className="p-12 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-3 py-6">
                      <DoorOpen className="w-10 h-10 text-[#C5A059] opacity-80" />
                      <div className="font-serif font-bold text-base text-stone-800">
                        No Physical Rooms Registered Yet
                      </div>
                      <p className="text-xs text-stone-500 max-w-md">
                        This property currently has 0 physical rooms. You can manually create your rooms one by one under the <strong>Room Inventory</strong> tab.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                calendarData.rooms.map((room) => {
                return (
                  <tr key={room.id} className="hover:bg-stone-50/60 transition">
                    {/* Room Info Cell */}
                    <td className="p-3 font-medium text-stone-800 border-r border-stone-200 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-sm text-stone-900">
                            Room {room.room_number}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              room.status === 'Available'
                                ? 'bg-emerald-100 text-emerald-800'
                                : room.status === 'Occupied'
                                ? 'bg-emerald-800 text-white'
                                : room.status === 'Maintenance'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {room.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-stone-500 truncate mt-0.5">
                        {room.room_name} • Floor {room.floor}
                      </div>
                    </td>

                    {/* Day Cells */}
                    {calendarData.dates.map((dateStr) => {
                      // Find if any booking occupies this room on this date
                      const cellBooking = calendarData.reservations.find((res) => {
                        const isThisRoom =
                          res.room_number === room.room_number ||
                          res.room_name === room.room_name;
                        const inStay = res.check_in <= dateStr && dateStr < res.check_out;
                        return isThisRoom && inStay && res.booking_status !== 'Cancelled';
                      });

                      const isCheckInDay = cellBooking && cellBooking.check_in === dateStr;
                      const isCheckOutDay = cellBooking && cellBooking.check_out === dateStr;

                      return (
                        <td
                          key={dateStr}
                          className="p-1 border-r border-stone-200 h-14 relative align-middle"
                        >
                          {cellBooking ? (
                            <div
                              onClick={() => {
                                setActiveBooking(cellBooking);
                                if (onSelectBooking) onSelectBooking(cellBooking);
                              }}
                              className={`h-full rounded cursor-pointer p-1.5 flex flex-col justify-between text-[11px] font-medium transition shadow-sm hover:opacity-95 ${
                                cellBooking.booking_status === 'Checked In'
                                  ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                  : cellBooking.booking_status === 'Confirmed'
                                  ? 'bg-amber-500 text-stone-900 hover:bg-amber-600'
                                  : 'bg-sky-600 text-white hover:bg-sky-700'
                              }`}
                              title={`${cellBooking.guest_name} (${cellBooking.booking_number}) - Click to open front desk actions`}
                            >
                              <div className="flex items-center justify-between font-bold truncate">
                                <span className="truncate">
                                  {isCheckInDay ? '➔ ' : ''}
                                  {cellBooking.guest_name}
                                </span>
                                <span className="text-[9px] uppercase px-1 bg-black/20 rounded ml-1">
                                  {cellBooking.source || 'WEB'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] opacity-90">
                                <span>{cellBooking.booking_number.replace('SBM-2026-', '#')}</span>
                                <span>₹{cellBooking.total_amount}</span>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                onOpenNewBookingModal({
                                  propertyCode,
                                  roomTypeId: room.room_type_id,
                                  roomNumber: room.room_number,
                                  checkIn: dateStr
                                })
                              }
                              className="w-full h-full rounded hover:bg-[#C5A059]/10 group flex items-center justify-center text-transparent hover:text-[#C5A059] transition"
                              title={`Create booking for Room ${room.room_number} on ${dateStr}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Selected Reservation Detail Modal / Drawer */}
      {activeBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full border border-[#C5A059]/30 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setActiveBooking(null);
                setActionMessage(null);
                setShowPaymentInput(false);
                setShowRoomChange(false);
              }}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="bg-[#1A1A1A] text-[#C5A059] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">
                PMS RESERVATION RECORD
              </span>
              <span className="text-xs text-stone-500 font-mono">
                {activeBooking.booking_number}
              </span>
            </div>

            <h3 className="text-xl font-serif font-bold text-stone-900 mb-1">
              {activeBooking.guest_name}
            </h3>

            <div className="flex flex-wrap gap-2 text-xs text-stone-600 mb-4">
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#C5A059]" /> {activeBooking.guest_phone}
              </span>
              <span>•</span>
              <span>Source: <strong className="uppercase">{activeBooking.source || 'WEBSITE'}</strong></span>
              <span>•</span>
              <span
                className={`font-bold px-2 py-0.5 rounded ${
                  activeBooking.booking_status === 'Checked In'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeBooking.booking_status === 'Confirmed'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-stone-100 text-stone-800'
                }`}
              >
                {activeBooking.booking_status}
              </span>
            </div>

            {actionMessage && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{actionMessage}</span>
              </div>
            )}

            {/* Stay & Room Details */}
            <div className="bg-stone-50 border border-stone-200 p-4 space-y-2 mb-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-stone-500">Property:</span>
                  <p className="font-semibold text-stone-800">{activeBooking.property_name}</p>
                </div>
                <div>
                  <span className="text-stone-500">Room Category:</span>
                  <p className="font-semibold text-stone-800">{activeBooking.room_name}</p>
                </div>
                <div>
                  <span className="text-stone-500">Assigned Physical Room:</span>
                  <p className="font-bold text-stone-900">
                    {activeBooking.room_number ? `Room ${activeBooking.room_number}` : 'Not assigned yet'}
                  </p>
                </div>
                <div>
                  <span className="text-stone-500">Stay Dates:</span>
                  <p className="font-semibold text-stone-800">
                    {activeBooking.check_in} ➔ {activeBooking.check_out} ({activeBooking.nights} nights)
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Ledger */}
            <div className="border border-stone-200 p-4 mb-4 text-xs space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-stone-600">Total Tariff (incl. GST):</span>
                <span className="text-stone-900 font-serif text-sm">₹{activeBooking.total_amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">Amount Paid:</span>
                <span className="text-emerald-700 font-bold">₹{activeBooking.paid_amount || 0}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2 font-bold text-sm">
                <span className="text-rose-700">Balance Due:</span>
                <span className="text-rose-700">₹{activeBooking.outstanding_amount ?? (activeBooking.total_amount - (activeBooking.paid_amount || 0))}</span>
              </div>
            </div>

            {/* Room Change Drawer */}
            {showRoomChange && (
              <div className="bg-amber-50 border border-amber-200 p-4 mb-4 space-y-3">
                <h4 className="font-bold text-xs uppercase text-amber-900">Change Physical Room</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter new room number (e.g. 104)"
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    className="flex-1 bg-white border border-stone-300 px-3 py-1.5 text-xs font-medium focus:outline-none"
                  />
                  <button
                    onClick={() => handleChangeRoom(activeBooking.id)}
                    disabled={actionLoading}
                    className="bg-[#C5A059] text-white px-3 py-1.5 text-xs font-bold uppercase hover:bg-[#B38F48] transition"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowRoomChange(false)}
                    className="bg-stone-200 text-stone-700 px-3 py-1.5 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Payment Input Drawer */}
            {showPaymentInput && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 mb-4 space-y-3">
                <h4 className="font-bold text-xs uppercase text-emerald-900">Collect & Record Payment</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-stone-600 block mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full bg-white border border-stone-300 px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-stone-600 block mb-1">Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-white border border-stone-300 px-3 py-1.5 text-xs font-medium"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI (GPay / PhonePe)</option>
                      <option value="CARD">Debit / Credit Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                      <option value="ONLINE_RAZORPAY">Razorpay</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRecordPayment(activeBooking.id)}
                    disabled={actionLoading}
                    className="bg-emerald-700 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-emerald-800 transition"
                  >
                    Save Payment
                  </button>
                  <button
                    onClick={() => setShowPaymentInput(false)}
                    className="bg-stone-200 text-stone-700 px-3 py-2 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-200">
              {activeBooking.booking_status !== 'Checked In' && activeBooking.booking_status !== 'Checked Out' && (
                <button
                  onClick={() => handleCheckIn(activeBooking.id, activeBooking.room_number)}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs font-bold uppercase tracking-wider transition text-center"
                >
                  Check In
                </button>
              )}

              {activeBooking.booking_status === 'Checked In' && (
                <button
                  onClick={() => handleCheckOut(activeBooking.id)}
                  disabled={actionLoading}
                  className="bg-stone-800 hover:bg-stone-900 text-white py-2 text-xs font-bold uppercase tracking-wider transition text-center"
                >
                  Check Out
                </button>
              )}

              <button
                onClick={() => {
                  setShowPaymentInput(true);
                  setPaymentAmount(activeBooking.outstanding_amount || (activeBooking.total_amount - (activeBooking.paid_amount || 0)));
                }}
                className="bg-[#C5A059] hover:bg-[#B38F48] text-white py-2 text-xs font-bold uppercase tracking-wider transition text-center flex items-center justify-center gap-1"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Add Pay
              </button>

              <button
                onClick={() => setShowRoomChange(true)}
                className="border border-stone-300 hover:border-stone-400 text-stone-700 py-2 text-xs font-bold uppercase tracking-wider transition text-center"
              >
                Move Room
              </button>

              <button
                onClick={() => {
                  setActiveBooking(null);
                }}
                className="bg-stone-100 hover:bg-stone-200 text-stone-700 py-2 text-xs font-bold uppercase tracking-wider transition text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
