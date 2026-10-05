import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  X,
  Layers,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { PropertyCode, RoomType, PMSRatePlan } from '../../types';

interface Props {
  propertyCode: PropertyCode | 'all';
  onRateChanged: () => void;
}

export const RateCalendarView: React.FC<Props> = ({
  propertyCode,
  onRateChanged
}) => {
  const [daysRange, setDaysRange] = useState<7 | 14 | 30>(14);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [ratesData, setRatesData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Rate Edit Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editRoomTypeId, setEditRoomTypeId] = useState<string>('');
  const [editRoomName, setEditRoomName] = useState<string>('');
  const [editBasePrice, setEditBasePrice] = useState<number>(2500);
  const [editStartDate, setEditStartDate] = useState<string>(startDate);
  const [editEndDate, setEditEndDate] = useState<string>(startDate);
  const [editNotes, setEditNotes] = useState<string>('Seasonal tariff adjustment');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const computeEndDate = (start: string, days: number): string => {
    const d = new Date(start);
    d.setDate(d.getDate() + days - 1);
    return d.toISOString().split('T')[0];
  };

  const endDate = computeEndDate(startDate, daysRange);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const data = await api.channelManager.getRates({
        propertyCode: propertyCode === 'all' ? undefined : propertyCode,
        startDate,
        endDate
      });
      setRatesData(data);
    } catch (err) {
      console.error('Failed to load rate calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, [propertyCode, startDate, daysRange]);

  const handleNav = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setStartDate(new Date().toISOString().split('T')[0]);
      return;
    }
    const current = new Date(startDate);
    const delta = direction === 'next' ? daysRange : -daysRange;
    current.setDate(current.getDate() + delta);
    setStartDate(current.toISOString().split('T')[0]);
  };

  // Generate date list
  const dateList: string[] = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    dateList.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }

  // Unique Room Types & Plans
  const plansMap = new Map<string, { id: string; name: string; roomId: string; roomName: string; mealPlan: string; basePrice: number }>();
  ratesData.forEach(r => {
    const key = `${r.room_type_id}-${r.rate_plan_name}`;
    if (!plansMap.has(key)) {
      plansMap.set(key, {
        id: r.rate_plan_id,
        name: r.rate_plan_name,
        roomId: r.room_type_id,
        roomName: r.room_name,
        mealPlan: r.meal_plan || 'EP',
        basePrice: r.base_rate
      });
    }
  });

  const plans = Array.from(plansMap.values());

  const handleOpenEdit = (plan: any) => {
    setEditRoomTypeId(plan.roomId);
    setEditRoomName(plan.roomName);
    setEditBasePrice(plan.basePrice);
    setEditStartDate(startDate);
    setEditEndDate(endDate);
    setShowEditModal(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSaveRateUpdate = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.channelManager.updateManualRates({
        propertyCode: 'sbm-hotel',
        roomTypeId: editRoomTypeId,
        startDate: editStartDate,
        endDate: editEndDate,
        basePrice: Number(editBasePrice),
        notes: editNotes
      });

      setSuccessMsg(res.message);
      fetchRates();
      onRateChanged();
      setTimeout(() => {
        setShowEditModal(false);
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Rate update failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNav('prev')}
            className="p-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            title="Previous Period"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleNav('today')}
            className="px-3 py-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => handleNav('next')}
            className="p-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            title="Next Period"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="ml-2 flex items-center gap-2 text-xs font-semibold text-stone-800">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>
              {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' — '}
              {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Range Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-semibold text-stone-600">
            {([7, 14, 30] as const).map(range => (
              <button
                key={range}
                onClick={() => setDaysRange(range)}
                className={`px-2.5 py-1 rounded-md transition-all ${daysRange === range ? 'bg-white text-stone-900 shadow-xs font-bold' : 'hover:text-stone-900'}`}
              >
                {range}d
              </button>
            ))}
          </div>

          <button
            onClick={fetchRates}
            disabled={loading}
            className="p-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            title="Refresh Rates"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Hotel-Style Rate Calendar Grid */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-900 text-white text-[11px] font-semibold tracking-wide">
                <th className="p-3.5 sticky left-0 z-20 bg-stone-900 border-r border-stone-800 min-w-[200px] shadow-sm">
                  Rate Plan & Room
                </th>
                {dateList.map(dateStr => {
                  const d = new Date(dateStr);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = dateStr === new Date().toISOString().split('T')[0];
                  return (
                    <th
                      key={dateStr}
                      className={`p-2.5 text-center min-w-[80px] border-r border-stone-800 ${isToday ? 'bg-amber-900/60 font-bold text-amber-300' : isWeekend ? 'bg-stone-800/80 text-amber-200' : ''}`}
                    >
                      <div className="text-[10px] uppercase opacity-75">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className="text-xs font-bold">{d.getDate()} {d.toLocaleDateString('en-US', { month: 'short' })}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={dateList.length + 1} className="p-8 text-center text-stone-400">
                    No rate plan data loaded.
                  </td>
                </tr>
              ) : (
                plans.map(p => (
                  <tr key={`${p.roomId}-${p.name}`} className="hover:bg-stone-50/70 transition-colors group">
                    <td className="p-3.5 sticky left-0 z-10 bg-white border-r border-stone-200 font-bold text-stone-800 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-amber-600" />
                            {p.roomName}
                          </div>
                          <div className="text-[11px] text-stone-500 font-medium mt-0.5 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 bg-stone-100 text-stone-700 rounded font-semibold text-[10px] uppercase">{p.mealPlan}</span>
                            <span>{p.name}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-stone-100 rounded-lg text-amber-600 transition-all"
                          title="Edit Rate"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {dateList.map(dateStr => {
                      const item = ratesData.find(
                        r => r.room_type_id === p.roomId && r.rate_plan_name === p.name && r.date === dateStr
                      );
                      const baseRate = item ? item.base_rate : p.basePrice;
                      const grossRate = item ? item.gross_rate : Math.round(baseRate * 1.12);

                      return (
                        <td
                          key={dateStr}
                          className="p-2.5 text-center border-r border-stone-200 hover:bg-amber-50/40 cursor-pointer transition-colors"
                          onClick={() => handleOpenEdit(p)}
                          title={`Base Rate: ₹${baseRate} | GST 12%: ₹${Math.round(baseRate * 0.12)} | Gross: ₹${grossRate}`}
                        >
                          <div className="font-mono font-bold text-xs text-stone-900">
                            ₹{baseRate}
                          </div>
                          <div className="text-[9px] text-stone-400 font-mono">
                            +12% gst
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Rate Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
            <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">Manual Rate Adjustment</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-stone-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {successMsg}
                </div>
              )}

              <div className="bg-amber-50/60 border border-amber-200/80 p-3 rounded-xl text-xs text-amber-900">
                Adjusting rate for <strong>{editRoomName}</strong> will automatically queue rate sync jobs across all active channels.
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Base Price (₹ per night)
                </label>
                <input
                  type="number"
                  step="50"
                  min="500"
                  value={editBasePrice}
                  onChange={e => setEditBasePrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono text-base font-bold text-stone-900"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  Net Tariff excluding GST (12% GST = ₹{Math.round(editBasePrice * 0.12)}, Gross Total = ₹{Math.round(editBasePrice * 1.12)})
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={e => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={e => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Audit Reason / Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="e.g. Festival Season Surge"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRateUpdate}
                disabled={actionLoading || editBasePrice <= 0}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    Updating & Syncing...
                  </>
                ) : (
                  <>
                    Save & Push Rates
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
