import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Building,
  PieChart,
  BarChart,
  RefreshCw,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { api } from '../../lib/api';
import { PMSReportsData } from '../../types';

export const PMSReportsTab: React.FC = () => {
  const [propertyCode, setPropertyCode] = useState<string>('all');
  const [period, setPeriod] = useState<string>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [report, setReport] = useState<PMSReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.pms.getReports(
        propertyCode,
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined
      );
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load PMS reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom' || (customStart && customEnd)) {
      fetchReports();
    }
  }, [propertyCode, period, customStart, customEnd]);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white border border-stone-200 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Property:</span>
            <select
              value={propertyCode}
              onChange={(e) => setPropertyCode(e.target.value)}
              className="bg-stone-50 border border-stone-300 text-xs font-medium px-3 py-2 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
            >
              <option value="all">All Properties</option>
              <option value="sbm-hotel">SBM Hotel (Opp. Temple)</option>
              <option value="sbm-guest-house">SBM 2 Guest House</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Period:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-stone-50 border border-stone-300 text-xs font-medium px-3 py-2 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-stone-50 border border-stone-300 text-xs px-2 py-1.5 focus:outline-none"
              />
              <span className="text-stone-400 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-stone-50 border border-stone-300 text-xs px-2 py-1.5 focus:outline-none"
              />
            </div>
          )}
        </div>

        <button
          onClick={fetchReports}
          className="flex items-center gap-2 px-3 py-2 bg-stone-900 text-white hover:bg-stone-800 text-xs font-medium transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Reports</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !report ? (
        <div className="bg-white border border-stone-200 p-16 text-center text-stone-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#C5A059]" />
          <p className="font-serif font-bold text-base text-stone-800">Generating PMS Analytics...</p>
          <p className="text-xs text-stone-500 mt-1">Aggregating reservation revenue, room nights, and occupancy KPIs.</p>
        </div>
      ) : report ? (
        <>
          {/* Key Hotel KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-[#C5A059]/30 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
                Total Revenue
              </span>
              <div className="text-xl font-serif font-bold text-stone-900">
                ₹{(report.totalRevenue ?? report.total_revenue ?? 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                Gross Tariff + GST
              </span>
            </div>

            <div className="bg-white border border-stone-200 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
                Paid Amount
              </span>
              <div className="text-xl font-serif font-bold text-emerald-700">
                ₹{(report.paidRevenue ?? 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-stone-500 mt-1 block">
                Collected via Razorpay/Cash
              </span>
            </div>

            <div className="bg-white border border-stone-200 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
                Outstanding
              </span>
              <div className="text-xl font-serif font-bold text-amber-700">
                ₹{(report.outstandingRevenue ?? 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-stone-500 mt-1 block">
                Pending collection
              </span>
            </div>

            <div className="bg-white border border-stone-200 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
                Occupancy Rate
              </span>
              <div className="text-xl font-serif font-bold text-stone-900">
                {report.occupancyRate ?? report.occupancy_rate ?? 0}%
              </div>
              <span className="text-[10px] text-stone-500 mt-1 block">
                {report.occupiedRooms ?? report.occupied_rooms ?? 0} of {report.totalRooms ?? report.total_rooms ?? 0} rooms sold
              </span>
            </div>

            <div className="bg-white border border-stone-200 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
                ADR (Avg Rate)
              </span>
              <div className="text-xl font-serif font-bold text-stone-900">
                ₹{(report.averageDailyRate ?? 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-stone-500 mt-1 block">
                Revenue / Sold Room
              </span>
            </div>

            <div className="bg-white border border-stone-200 p-4 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
                RevPAR
              </span>
              <div className="text-xl font-serif font-bold text-stone-900">
                ₹{(report.revPAR ?? 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-stone-500 mt-1 block">
                Revenue / Available Room
              </span>
            </div>
          </div>

          {/* Occupancy & Bookings Status Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Occupancy Breakdown */}
            <div className="bg-white border border-stone-200 p-5 shadow-sm">
              <h3 className="font-serif font-bold text-sm text-stone-900 mb-3 flex items-center justify-between">
                <span>Room Inventory & Occupancy</span>
                <Building className="w-4 h-4 text-[#C5A059]" />
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                  <span className="text-stone-600">Total Physical Rooms</span>
                  <span className="font-bold text-stone-900">{report.totalRooms ?? report.total_rooms ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                  <span className="text-emerald-700 font-medium">Occupied / Sold Rooms</span>
                  <span className="font-bold text-emerald-800">{report.occupiedRooms ?? report.occupied_rooms ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                  <span className="text-blue-700 font-medium">Available Sellable Rooms</span>
                  <span className="font-bold text-blue-800">{report.availableRooms ?? report.available_rooms ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                  <span className="text-amber-700 font-medium">Blocked / Maintenance Rooms</span>
                  <span className="font-bold text-amber-800">{report.blockedRooms ?? report.blocked_rooms ?? 0}</span>
                </div>
                <div className="flex justify-between items-center pt-1 font-bold">
                  <span className="text-stone-900">Occupancy Percentage</span>
                  <span className="text-stone-900 text-sm font-serif">{report.occupancyRate ?? report.occupancy_rate ?? 0}%</span>
                </div>
              </div>
            </div>

            {/* Bookings Status Breakdown */}
            <div className="bg-white border border-stone-200 p-5 shadow-sm">
              <h3 className="font-serif font-bold text-sm text-stone-900 mb-3 flex items-center justify-between">
                <span>Reservations Status Summary</span>
                <Calendar className="w-4 h-4 text-[#C5A059]" />
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                  <span className="text-stone-600 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Confirmed Bookings</span>
                  <span className="font-bold text-stone-900">{report.confirmedBookings ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                  <span className="text-stone-600 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Payment</span>
                  <span className="font-bold text-stone-900">{report.pendingBookings ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                  <span className="text-stone-600 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-blue-600" /> Checked-In (In-House)</span>
                  <span className="font-bold text-stone-900">{report.checkedInBookings ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                  <span className="text-stone-600 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-stone-500" /> Checked-Out</span>
                  <span className="font-bold text-stone-900">{report.checkedOutBookings ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-stone-100">
                  <span className="text-stone-600 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-rose-600" /> Cancelled</span>
                  <span className="font-bold text-stone-900">{report.cancelledBookings ?? 0}</span>
                </div>
                <div className="flex justify-between items-center pt-1 font-bold">
                  <span className="text-stone-900">Total Reservations</span>
                  <span className="text-stone-900 text-sm font-serif">{report.totalBookings ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Arrivals & Departures */}
            <div className="bg-white border border-stone-200 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-serif font-bold text-sm text-stone-900 mb-3 flex items-center justify-between">
                  <span>Front Desk Operations</span>
                  <Users className="w-4 h-4 text-[#C5A059]" />
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center p-2 bg-stone-50 border border-stone-100">
                    <span className="font-medium text-stone-700">Today's Arrivals</span>
                    <span className="font-bold text-emerald-800 text-sm font-serif">{report.todayArrivalsCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-stone-50 border border-stone-100">
                    <span className="font-medium text-stone-700">Today's Departures</span>
                    <span className="font-bold text-amber-800 text-sm font-serif">{report.todayDeparturesCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-stone-50 border border-stone-100">
                    <span className="font-medium text-stone-700">Upcoming Arrivals (7 Days)</span>
                    <span className="font-bold text-stone-900 text-sm font-serif">{report.upcomingArrivalsCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-stone-50 border border-stone-100">
                    <span className="font-medium text-stone-700">Upcoming Departures (7 Days)</span>
                    <span className="font-bold text-stone-900 text-sm font-serif">{report.upcomingDeparturesCount ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 text-[10px] text-stone-500 italic">
                Report Period: {report.startDate} to {report.endDate}
              </div>
            </div>
          </div>

          {/* Room Type Performance & Booking Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Room Type Performance Table */}
            <div className="bg-white border border-stone-200 p-5 shadow-sm">
              <h3 className="font-serif font-bold text-base text-stone-900 mb-4 flex items-center justify-between">
                <span>Room Type Performance</span>
                <BarChart className="w-4 h-4 text-[#C5A059]" />
              </h3>

              {report.roomTypePerformance && report.roomTypePerformance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-stone-50 text-stone-500 uppercase font-semibold border-b border-stone-200">
                        <th className="p-2.5">Room Category</th>
                        <th className="p-2.5">Property</th>
                        <th className="p-2.5 text-right">Sold</th>
                        <th className="p-2.5 text-right">Revenue</th>
                        <th className="p-2.5 text-right">Occ %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {report.roomTypePerformance.map((rt) => (
                        <tr key={rt.roomTypeId} className="hover:bg-stone-50/50">
                          <td className="p-2.5 font-bold text-stone-900">{rt.roomTypeName}</td>
                          <td className="p-2.5 text-stone-600">{rt.propertyCode === 'sbm-hotel' ? 'SBM Hotel' : 'Guest House'}</td>
                          <td className="p-2.5 text-right font-medium text-stone-800">{rt.roomsSold}</td>
                          <td className="p-2.5 text-right font-bold text-stone-900">₹{rt.revenue.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-serif font-bold text-emerald-800">{rt.occupancyRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-stone-500 py-8 text-center">No data available for the selected period.</p>
              )}
            </div>

            {/* Bookings by Source */}
            <div className="bg-white border border-stone-200 p-5 shadow-sm">
              <h3 className="font-serif font-bold text-base text-stone-900 mb-4 flex items-center justify-between">
                <span>Bookings & Revenue by Source</span>
                <PieChart className="w-4 h-4 text-[#C5A059]" />
              </h3>

              {report.bookingsBySource && report.bookingsBySource.length > 0 ? (
                <div className="space-y-3">
                  {report.bookingsBySource.map((s) => (
                    <div key={s.source} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="font-bold text-stone-800 uppercase tracking-wider">
                          {s.source.replace('_', ' ')}
                        </span>
                        <span className="text-stone-600">
                          {s.count} bookings ({s.percentage}%) • <strong>₹{s.revenue.toLocaleString('en-IN')}</strong>
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#C5A059] h-full"
                          style={{ width: `${s.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 py-8 text-center">No data available for the selected period.</p>
              )}
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-white border border-stone-200 p-5 shadow-sm">
            <h3 className="font-serif font-bold text-base text-stone-900 mb-4 flex items-center justify-between">
              <span>Payment Methods Summary</span>
              <CreditCard className="w-4 h-4 text-[#C5A059]" />
            </h3>

            {report.paymentBreakdown && report.paymentBreakdown.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {report.paymentBreakdown.map((pm) => (
                  <div key={pm.method} className="bg-stone-50 border border-stone-200 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                      {pm.method}
                    </span>
                    <div className="text-lg font-serif font-bold text-stone-900">
                      ₹{pm.amount.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[11px] text-stone-600 mt-0.5 block">
                      {pm.count} payment transactions
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 py-8 text-center">No payment records found for the selected period.</p>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white border border-stone-200 p-12 text-center text-stone-500">
          <p className="text-xs">No data available for the selected period.</p>
        </div>
      )}
    </div>
  );
};
