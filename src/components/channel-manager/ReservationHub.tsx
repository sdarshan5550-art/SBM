import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Layers,
  User,
  Phone,
  Mail,
  CreditCard,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Eye,
  X,
  ExternalLink,
  Shield,
  FileText,
  DollarSign
} from 'lucide-react';
import { api } from '../../lib/api';
import { Booking, BookingSource, PropertyCode } from '../../types';

interface Props {
  propertyCode: PropertyCode | 'all';
}

export const ReservationHub: React.FC<Props> = ({ propertyCode }) => {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRes, setSelectedRes] = useState<any | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const res = await api.channelManager.getReservations({
        propertyCode: propertyCode === 'all' ? undefined : propertyCode,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 50
      });
      setReservations(res.reservations);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Failed to load reservation hub:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [propertyCode, sourceFilter, statusFilter, startDate, endDate, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReservations();
  };

  const getSourceBadge = (source: string) => {
    const s = (source || 'DIRECT').toUpperCase();
    switch (s) {
      case 'BOOKING_COM':
        return <span className="px-2 py-0.5 bg-blue-900 text-white rounded text-[10px] font-bold">Booking.com</span>;
      case 'MMT':
        return <span className="px-2 py-0.5 bg-red-700 text-white rounded text-[10px] font-bold">MakeMyTrip</span>;
      case 'GOIBIBO':
        return <span className="px-2 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold">Goibibo</span>;
      case 'AGODA':
        return <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-[10px] font-bold">Agoda</span>;
      case 'EXPEDIA':
        return <span className="px-2 py-0.5 bg-yellow-500 text-stone-900 rounded text-[10px] font-bold">Expedia</span>;
      case 'CTRIP':
        return <span className="px-2 py-0.5 bg-sky-700 text-white rounded text-[10px] font-bold">Trip.com / Ctrip</span>;
      case 'CLEARTRIP':
        return <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">Cleartrip</span>;
      case 'WEBSITE':
      case 'DIRECT':
      default:
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">Direct Website</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">Confirmed</span>;
      case 'Checked In':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">Checked In</span>;
      case 'Checked Out':
        return <span className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded font-semibold text-[10px]">Checked Out</span>;
      case 'Cancelled':
        return <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold text-[10px]">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded font-semibold text-[10px]">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by Guest Name, Phone, Booking ID, or OTA Ref..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sourceFilter}
              onChange={e => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium text-stone-700"
            >
              <option value="all">All Booking Sources</option>
              <option value="WEBSITE">Direct Website</option>
              <option value="BOOKING_COM">Booking.com</option>
              <option value="MMT">MakeMyTrip</option>
              <option value="GOIBIBO">Goibibo</option>
              <option value="AGODA">Agoda</option>
              <option value="EXPEDIA">Expedia</option>
              <option value="CTRIP">Trip.com / Ctrip</option>
              <option value="CLEARTRIP">Cleartrip</option>
              <option value="WALK_IN">Walk-in</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium text-stone-700"
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Checked In">Checked In</option>
              <option value="Checked Out">Checked Out</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Reservation Hub Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="p-3.5">Booking ID</th>
                <th className="p-3.5">Guest Info</th>
                <th className="p-3.5">Source</th>
                <th className="p-3.5">Room Category</th>
                <th className="p-3.5">Stay Dates</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Sync State</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-stone-400">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-600" />
                    Loading reservations from PMS...
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-stone-400">
                    No reservations found matching active filters.
                  </td>
                </tr>
              ) : (
                reservations.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedRes(b)}
                    className="hover:bg-amber-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="p-3.5 font-mono font-bold text-stone-900">
                      <div>{b.booking_number}</div>
                      {b.source_booking_id && (
                        <div className="text-[10px] text-stone-400 font-mono">OTA: {b.source_booking_id}</div>
                      )}
                    </td>
                    <td className="p-3.5 font-medium text-stone-800">
                      <div className="font-bold text-stone-900">{b.guest_name}</div>
                      <div className="text-[11px] text-stone-500">{b.guest_phone}</div>
                    </td>
                    <td className="p-3.5">
                      {getSourceBadge(b.source)}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-stone-800">{b.room_name}</div>
                      <div className="text-[10px] text-stone-400">{b.rooms_requested || 1} Room(s)</div>
                    </td>
                    <td className="p-3.5 font-medium text-stone-700">
                      <div>{b.check_in}</div>
                      <div className="text-[10px] text-stone-400">➔ {b.check_out}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-stone-900 font-mono">₹{b.total_amount?.toLocaleString('en-IN')}</div>
                      <div className={`text-[10px] font-semibold ${b.payment_status === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {b.payment_status || 'Pending'}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {getStatusBadge(b.booking_status)}
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {b.syncStatus || 'SYNCED'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRes(b);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 hover:bg-amber-100/60 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reservation Detail Slide-Over Drawer */}
      {selectedRes && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col animate-slide-left">
            {/* Drawer Header */}
            <div className="bg-stone-900 text-white p-5 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    {selectedRes.booking_number}
                    {getSourceBadge(selectedRes.source)}
                  </h3>
                  <p className="text-xs text-stone-400">Created: {new Date(selectedRes.created_at || Date.now()).toLocaleString()}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRes(null)}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Guest & Contact */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  Guest Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Full Name</span>
                    <span className="font-bold text-stone-900">{selectedRes.guest_name}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Phone Number</span>
                    <span className="font-semibold text-stone-900">{selectedRes.guest_phone || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-stone-400 block text-[10px]">Email Address</span>
                    <span className="font-semibold text-stone-900">{selectedRes.guest_email || 'N/A'}</span>
                  </div>
                  {selectedRes.guest_address && (
                    <div className="col-span-2">
                      <span className="text-stone-400 block text-[10px]">Address</span>
                      <span className="text-stone-700">{selectedRes.guest_address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Room & Stay Details */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  Stay & Room Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Room Category</span>
                    <span className="font-bold text-stone-900">{selectedRes.room_name}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Assigned Room #</span>
                    <span className="font-semibold text-amber-800">{selectedRes.room_number || 'Auto-Allocated on Arrival'}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Check-In</span>
                    <span className="font-bold text-emerald-800">{selectedRes.check_in}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Check-Out</span>
                    <span className="font-bold text-stone-800">{selectedRes.check_out}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Guests</span>
                    <span className="font-semibold text-stone-800">{selectedRes.adults || 2} Adults, {selectedRes.children || 0} Children</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Meal Plan</span>
                    <span className="font-semibold text-stone-800">EP (Room Only)</span>
                  </div>
                </div>
              </div>

              {/* Pricing, Taxes & Payment */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                  Pricing & Settlement
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-500">Gross Tariff:</span>
                    <span className="font-bold text-stone-900 font-mono">₹{selectedRes.total_amount?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-500">Payment Status:</span>
                    <span className={`font-bold ${selectedRes.payment_status === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {selectedRes.payment_status || 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-500">Payment Mode / Ref:</span>
                    <span className="font-mono text-stone-700">{selectedRes.payment_method || selectedRes.razorpay_payment_id || 'Cash / Counter'}</span>
                  </div>
                  {selectedRes.source_booking_id && (
                    <div className="flex justify-between py-1">
                      <span className="text-stone-500">OTA Extranet Reference:</span>
                      <span className="font-mono font-bold text-blue-800">{selectedRes.source_booking_id}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Trail for this Reservation */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Audit Trail & History
                </h4>
                {selectedRes.auditTrail && selectedRes.auditTrail.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedRes.auditTrail.map((log: any, i: number) => (
                      <div key={i} className="text-[11px] p-2 bg-white border border-stone-200 rounded-lg space-y-0.5">
                        <div className="flex justify-between text-stone-500">
                          <span className="font-semibold text-stone-800">{log.action}</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-stone-600">{log.description}</p>
                        <span className="text-[10px] text-stone-400 block">By: {log.performedBy || 'System'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">Created via {selectedRes.source || 'Website'}.</p>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="bg-stone-50 border-t border-stone-200 p-4">
              <button
                onClick={() => setSelectedRes(null)}
                className="w-full py-2.5 text-xs font-bold text-stone-700 hover:text-stone-900 border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors"
              >
                Close Reservation Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
