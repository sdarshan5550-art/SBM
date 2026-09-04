import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  LogIn,
  LogOut,
  Bed,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  Wrench,
  Ban,
  Shield,
  Phone,
  Mail,
  UserCheck,
  Building,
  Filter,
  Check,
  X
} from 'lucide-react';
import { api } from '../lib/api';
import { PhysicalRoom, Booking, FrontDeskActivity, PropertyCode, RoomStatus } from '../types';

interface FrontDeskDashboardProps {
  token: string;
  adminRole?: string;
  onOpenBookingModal: (prefill?: any) => void;
}

export const FrontDeskDashboard: React.FC<FrontDeskDashboardProps> = ({ token, adminRole, onOpenBookingModal }) => {
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rooms, setRooms] = useState<PhysicalRoom[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activities, setActivities] = useState<FrontDeskActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Room Edit Modal State
  const [activeRoomModal, setActiveRoomModal] = useState<PhysicalRoom | null>(null);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [updatingRoom, setUpdatingRoom] = useState(false);

  // Check In Modal State
  const [checkInModalBooking, setCheckInModalBooking] = useState<Booking | null>(null);
  const [assignedRoomNumber, setAssignedRoomNumber] = useState('');

  const loadFrontDeskData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomsRes, bookingsRes, activitiesRes] = await Promise.all([
        api.admin.getPhysicalRooms(token, selectedProperty, selectedDate),
        api.admin.getBookings(token, { date: selectedDate }),
        api.admin.getActivities(token, selectedProperty)
      ]);
      setRooms(roomsRes);
      setBookings(bookingsRes);
      setActivities(activitiesRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load front desk data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFrontDeskData();
  }, [selectedProperty, selectedDate]);

  // Derived Stats
  const todayCheckIns = bookings.filter(b => b.check_in === selectedDate && b.booking_status !== 'Cancelled');
  const todayCheckOuts = bookings.filter(b => b.check_out === selectedDate && b.booking_status !== 'Cancelled');
  const activeInHouse = bookings.filter(
    b => b.check_in <= selectedDate && selectedDate < b.check_out && (b.booking_status === 'Confirmed' || b.booking_status === 'Checked In')
  );
  const totalAvailableRooms = rooms.filter(r => r.status === 'Available').length;

  const handleUpdateRoomStatus = async (roomId: string, newStatus: RoomStatus, reason?: string) => {
    setUpdatingRoom(true);
    try {
      await api.admin.updatePhysicalRoom(token, roomId, {
        status: newStatus,
        maintenance_reason: reason || undefined
      });
      // Log activity
      await api.admin.addActivity(
        token,
        'Status Update',
        `Room ${activeRoomModal?.room_number} status changed to ${newStatus}${reason ? ' (' + reason + ')' : ''}`,
        activeRoomModal?.property_code
      );
      setActiveRoomModal(null);
      setMaintenanceReason('');
      loadFrontDeskData();
    } catch (err: any) {
      alert(err.message || 'Failed to update room status');
    } finally {
      setUpdatingRoom(false);
    }
  };

  const handleCheckInSubmit = async (bookingId: string) => {
    try {
      await api.admin.checkInBooking(token, bookingId, assignedRoomNumber || undefined);
      setCheckInModalBooking(null);
      setAssignedRoomNumber('');
      loadFrontDeskData();
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    }
  };

  const handleCheckOutSubmit = async (bookingId: string) => {
    if (!confirm('Confirm guest check-out and mark physical room as available?')) return;
    try {
      await api.admin.checkOutBooking(token, bookingId);
      loadFrontDeskData();
    } catch (err: any) {
      alert(err.message || 'Check-out failed');
    }
  };

  // Filtered Rooms
  const filteredRooms = rooms.filter(r => {
    const matchesSearch =
      r.room_number.includes(searchQuery) ||
      r.room_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.current_guest_name && r.current_guest_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Front Desk Header & Property Selector */}
      <div className="bg-white border border-[#C5A059]/20 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#1A1A1A] text-[#C5A059] text-[10px] font-bold uppercase tracking-widest px-2.5 py-1">
              FRONT DESK OPERATOR MODE
            </span>
            <span className="text-stone-400 text-xs">SBM Reception Desk</span>
          </div>
          <h1 className="text-2xl font-serif text-[#1A1A1A] font-medium mt-1">SBM Front Desk Operations</h1>
          <p className="text-xs text-stone-500">
            Real-time room availability grid, guest check-in/out console, and front desk log.
          </p>
        </div>

        {/* Filters: Property & Date */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-lg text-xs">
            <Building className="w-3.5 h-3.5 text-[#C5A059]" />
            <select
              value={selectedProperty}
              onChange={e => setSelectedProperty(e.target.value)}
              className="bg-transparent text-stone-800 font-medium focus:outline-none"
            >
              <option value="all">All SBM Properties</option>
              <option value="sbm-hotel">SBM Hotel (Main Temple)</option>
              <option value="sbm-guest-house">SBM 2 Guest House</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-lg text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#C5A059]" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-stone-800 font-medium focus:outline-none"
            />
          </div>

          <button
            onClick={loadFrontDeskData}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 p-2 rounded-lg transition-colors"
            title="Refresh Front Desk Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C5A059]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Check-ins */}
        <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-medium uppercase tracking-wider">Today's Check-ins</span>
            <LogIn className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold text-stone-900">{todayCheckIns.length}</span>
            <span className="text-xs text-stone-500">Guests arriving</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium">
            {todayCheckIns.filter(b => b.booking_status === 'Checked In').length} already checked in
          </p>
        </div>

        {/* Today's Check-outs */}
        <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-medium uppercase tracking-wider">Today's Check-outs</span>
            <LogOut className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold text-stone-900">{todayCheckOuts.length}</span>
            <span className="text-xs text-stone-500">Guests departing</span>
          </div>
          <p className="text-[11px] text-amber-700 font-medium">
            {todayCheckOuts.filter(b => b.booking_status === 'Checked Out').length} already checked out
          </p>
        </div>

        {/* Active In-House Guests */}
        <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-medium uppercase tracking-wider">In-House Guests</span>
            <Users className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold text-stone-900">
              {activeInHouse.reduce((sum, b) => sum + (b.adults + b.children), 0)}
            </span>
            <span className="text-xs text-stone-500">In residence</span>
          </div>
          <p className="text-[11px] text-stone-500 font-medium">{activeInHouse.length} active room bookings</p>
        </div>

        {/* Available Physical Rooms */}
        <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-medium uppercase tracking-wider">Rooms Available</span>
            <Bed className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold text-stone-900">{totalAvailableRooms}</span>
            <span className="text-xs text-stone-500">/ {rooms.length} total rooms</span>
          </div>
          <p className="text-[11px] text-blue-700 font-medium">Ready for immediate walk-ins</p>
        </div>
      </div>

      {/* Main Front Desk Actions & Search Bar */}
      <div className="bg-white border border-stone-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search room # or guest name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-[#C5A059]"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
          {['all', 'Available', 'Occupied', 'Reserved', 'Maintenance', 'Blocked'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {st === 'all' ? 'All Rooms' : st}
            </button>
          ))}
        </div>

        {/* New Walk-in Button */}
        <button
          onClick={() => onOpenBookingModal()}
          className="bg-[#C5A059] hover:bg-[#B48E4B] text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-2xs"
        >
          <Plus className="w-4 h-4" /> New Walk-In Booking
        </button>
      </div>

      {/* VISUAL ROOM INVENTORY GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif text-[#1A1A1A] font-medium flex items-center gap-2">
            Visual Room Inventory Grid ({filteredRooms.length})
          </h2>
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Reserved
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Occupied
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Maintenance
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredRooms.map(room => {
            let statusBg = 'bg-emerald-50 border-emerald-300 text-emerald-900';
            let statusBadge = 'bg-emerald-600 text-white';

            if (room.status === 'Occupied') {
              statusBg = 'bg-amber-50 border-amber-300 text-amber-900';
              statusBadge = 'bg-amber-600 text-white';
            } else if (room.status === 'Reserved') {
              statusBg = 'bg-blue-50 border-blue-300 text-blue-900';
              statusBadge = 'bg-blue-600 text-white';
            } else if (room.status === 'Maintenance') {
              statusBg = 'bg-red-50 border-red-300 text-red-900';
              statusBadge = 'bg-red-600 text-white';
            } else if (room.status === 'Blocked') {
              statusBg = 'bg-stone-100 border-stone-300 text-stone-600';
              statusBadge = 'bg-stone-600 text-white';
            }

            return (
              <div
                key={room.id}
                onClick={() => {
                  setActiveRoomModal(room);
                  setMaintenanceReason(room.maintenance_reason || '');
                }}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md flex flex-col justify-between h-32 ${statusBg}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xl font-bold font-mono text-stone-900">Room {room.room_number}</span>
                    <span className="block text-[10px] text-stone-500 font-medium truncate">{room.room_name}</span>
                  </div>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusBadge}`}>
                    {room.status}
                  </span>
                </div>

                <div className="text-[11px] truncate mt-2">
                  {room.status === 'Occupied' && (
                    <div>
                      <strong className="block text-stone-900 truncate">{room.current_guest_name}</strong>
                      <span className="text-[10px] text-stone-500">Out: {room.check_out_date}</span>
                    </div>
                  )}
                  {room.status === 'Reserved' && (
                    <div>
                      <strong className="block text-stone-900 truncate">{room.current_guest_name || 'Upcoming'}</strong>
                      <span className="text-[10px] text-stone-500">In: {room.check_in_date}</span>
                    </div>
                  )}
                  {room.status === 'Maintenance' && (
                    <span className="text-red-700 text-[10px] italic truncate block">
                      {room.maintenance_reason || 'AC/Cleaning'}
                    </span>
                  )}
                  {room.status === 'Available' && (
                    <span className="text-emerald-700 text-[10px] font-medium">Ready for Guest</span>
                  )}
                </div>

                <span className="text-[9px] text-stone-400 font-sans tracking-tight">
                  {room.property_code === 'sbm-hotel' ? 'SBM Hotel' : 'Guest House'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* TODAY'S EXPECTED ARRIVALS / DEPARTURES CONSOLE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arrivals Panel */}
        <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-serif text-base font-medium text-stone-900 flex items-center gap-2">
              <LogIn className="w-4 h-4 text-emerald-600" /> Expected Arrivals Today ({todayCheckIns.length})
            </h3>
            <span className="text-xs text-stone-400">{selectedDate}</span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {todayCheckIns.length === 0 ? (
              <p className="text-xs text-stone-400 py-4 text-center italic">No pending arrivals for this date.</p>
            ) : (
              todayCheckIns.map(bk => (
                <div
                  key={bk.id}
                  className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-between text-xs gap-3"
                >
                  <div>
                    <strong className="text-stone-900 block font-medium">{bk.guest_name}</strong>
                    <span className="text-stone-500 text-[11px]">
                      {bk.room_name} ({bk.rooms_requested} rm) • {bk.guest_phone}
                    </span>
                    <span className="block text-[10px] text-[#C5A059] font-mono mt-0.5">{bk.booking_number}</span>
                  </div>

                  {bk.booking_status === 'Checked In' ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded">
                      Checked In
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setCheckInModalBooking(bk);
                        setAssignedRoomNumber(bk.room_number || '101');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] px-3 py-1.5 rounded transition-colors"
                    >
                      Check In
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Departures Panel */}
        <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-serif text-base font-medium text-stone-900 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-amber-600" /> Expected Departures Today ({todayCheckOuts.length})
            </h3>
            <span className="text-xs text-stone-400">{selectedDate}</span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {todayCheckOuts.length === 0 ? (
              <p className="text-xs text-stone-400 py-4 text-center italic">No scheduled departures for this date.</p>
            ) : (
              todayCheckOuts.map(bk => (
                <div
                  key={bk.id}
                  className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-between text-xs gap-3"
                >
                  <div>
                    <strong className="text-stone-900 block font-medium">{bk.guest_name}</strong>
                    <span className="text-stone-500 text-[11px]">
                      {bk.room_name} {bk.room_number ? '• Room ' + bk.room_number : ''}
                    </span>
                    <span className="block text-[10px] text-[#C5A059] font-mono mt-0.5">{bk.booking_number}</span>
                  </div>

                  {bk.booking_status === 'Checked Out' ? (
                    <span className="bg-stone-200 text-stone-700 text-[10px] font-bold px-2 py-1 rounded">
                      Checked Out
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCheckOutSubmit(bk.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] px-3 py-1.5 rounded transition-colors"
                    >
                      Complete Check Out
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* FRONT DESK AUDIT TRAIL LOG */}
      <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h3 className="font-serif text-base font-medium text-stone-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#C5A059]" /> Front Desk Activity Log
          </h3>
          <span className="text-xs text-stone-400">Audited System Feed</span>
        </div>

        <div className="space-y-2.5 max-h-60 overflow-y-auto text-xs">
          {activities.length === 0 ? (
            <p className="text-xs text-stone-400 py-3 italic">No recent activities recorded.</p>
          ) : (
            activities.map(act => (
              <div
                key={act.id}
                className="flex items-center justify-between p-2.5 bg-stone-50 rounded-lg border border-stone-100"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-[#1A1A1A] text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                    {act.action}
                  </span>
                  <span className="text-stone-800">{act.description}</span>
                </div>
                <div className="flex items-center gap-2 text-stone-400 text-[11px]">
                  <span>{act.performed_by || 'Staff'}</span>
                  <span>•</span>
                  <span>{act.timestamp}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ROOM STATUS MODAL */}
      {activeRoomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif text-xl font-medium text-stone-900">
                  Manage Room {activeRoomModal.room_number}
                </h3>
                <p className="text-xs text-stone-500">
                  {activeRoomModal.room_name} • {activeRoomModal.property_name}
                </p>
              </div>
              <button
                onClick={() => setActiveRoomModal(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Current Status</label>
                <span className="inline-block bg-stone-100 border border-stone-300 text-stone-800 font-bold px-3 py-1 rounded">
                  {activeRoomModal.status}
                </span>
              </div>

              {activeRoomModal.current_guest_name && (
                <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                  <strong className="block text-stone-900 font-medium">Assigned Guest:</strong>
                  <p>{activeRoomModal.current_guest_name}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Check-in: {activeRoomModal.check_in_date} | Check-out: {activeRoomModal.check_out_date}
                  </p>
                </div>
              )}

              <div>
                <label className="block font-medium text-stone-700 mb-1">Set Maintenance Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. AC servicing, deep cleaning, plumbing"
                  value={maintenanceReason}
                  onChange={e => setMaintenanceReason(e.target.value)}
                  className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="block font-medium text-stone-700">Quick Actions</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={updatingRoom}
                    onClick={() => handleUpdateRoomStatus(activeRoomModal.id, 'Available')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-xs transition-colors"
                  >
                    Mark Available
                  </button>
                  <button
                    disabled={updatingRoom}
                    onClick={() => handleUpdateRoomStatus(activeRoomModal.id, 'Maintenance', maintenanceReason)}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg text-xs transition-colors"
                  >
                    Set Maintenance
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECK-IN MODAL */}
      {checkInModalBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-start border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif text-xl font-medium text-stone-900">Guest Check-In</h3>
                <p className="text-xs text-stone-500">
                  {checkInModalBooking.guest_name} • {checkInModalBooking.booking_number}
                </p>
              </div>
              <button
                onClick={() => setCheckInModalBooking(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-700">
              <div className="bg-stone-50 p-3 rounded-lg space-y-1">
                <p><strong>Room Category:</strong> {checkInModalBooking.room_name}</p>
                <p><strong>Property:</strong> {checkInModalBooking.property_name}</p>
                <p><strong>Dates:</strong> {checkInModalBooking.check_in} to {checkInModalBooking.check_out}</p>
                <p><strong>Payment Status:</strong> {checkInModalBooking.payment_status}</p>
              </div>

              <div>
                <label className="block font-medium mb-1">Assign Physical Room Number</label>
                <input
                  type="text"
                  placeholder="e.g. 101, 102, 201"
                  value={assignedRoomNumber}
                  onChange={e => setAssignedRoomNumber(e.target.value)}
                  className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  onClick={() => setCheckInModalBooking(null)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCheckInSubmit(checkInModalBooking.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                >
                  Confirm Check-In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
