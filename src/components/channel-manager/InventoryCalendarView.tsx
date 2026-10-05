import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Lock,
  Shield,
  Layers,
  CheckCircle2,
  Info,
  Clock
} from 'lucide-react';
import { api } from '../../lib/api';
import { ChannelInventorySummary, ChannelRestriction, PropertyCode } from '../../types';

interface Props {
  propertyCode: PropertyCode | 'all';
  restrictions: ChannelRestriction[];
  onRefresh: () => void;
}

export const InventoryCalendarView: React.FC<Props> = ({
  propertyCode,
  restrictions,
  onRefresh
}) => {
  const [daysRange, setDaysRange] = useState<7 | 14 | 30 | 90>(14);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [inventory, setInventory] = useState<ChannelInventorySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Compute End Date
  const computeEndDate = (start: string, days: number): string => {
    const d = new Date(start);
    d.setDate(d.getDate() + days - 1);
    return d.toISOString().split('T')[0];
  };

  const endDate = computeEndDate(startDate, daysRange);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await api.channelManager.getInventory({
        propertyCode: propertyCode === 'all' ? undefined : propertyCode,
        startDate,
        endDate
      });
      setInventory(data);
    } catch (err) {
      console.error('Failed to load inventory calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [propertyCode, startDate, daysRange]);

  // Navigate dates
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

  // Group inventory by unique room types
  const roomTypesMap = new Map<string, { id: string; name: string; property: string }>();
  inventory.forEach(inv => {
    if (!roomTypesMap.has(inv.room_type_id)) {
      roomTypesMap.set(inv.room_type_id, {
        id: inv.room_type_id,
        name: inv.room_name,
        property: inv.property_code
      });
    }
  });

  const roomTypes = Array.from(roomTypesMap.values());

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
            <Calendar className="w-4 h-4 text-amber-600" />
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
            {([7, 14, 30, 90] as const).map(range => (
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
            onClick={() => {
              fetchInventory();
              onRefresh();
            }}
            disabled={loading}
            className="p-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-stone-600 px-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Available / Sellable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Low Stock (1-2)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Sold Out (0)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-1 py-0.2 bg-stone-800 text-white rounded font-mono text-[9px] font-bold">STOP</span> Stop Sell
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-1 py-0.2 bg-blue-100 text-blue-800 rounded font-mono text-[9px] font-bold">CTA/D</span> Closed to Arr/Dep
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-1 py-0.2 bg-purple-100 text-purple-800 rounded font-mono text-[9px] font-bold">MIN</span> Min Stay Rule
        </span>
      </div>

      {/* Hotel-Style Grid Calendar */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-900 text-white text-[11px] font-semibold tracking-wide">
                <th className="p-3.5 sticky left-0 z-20 bg-stone-900 border-r border-stone-800 min-w-[180px] shadow-sm">
                  Room Category
                </th>
                {dateList.map(dateStr => {
                  const d = new Date(dateStr);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = dateStr === new Date().toISOString().split('T')[0];
                  return (
                    <th
                      key={dateStr}
                      className={`p-2.5 text-center min-w-[72px] border-r border-stone-800 ${isToday ? 'bg-amber-900/60 font-bold text-amber-300' : isWeekend ? 'bg-stone-800/80 text-amber-200' : ''}`}
                    >
                      <div className="text-[10px] uppercase opacity-75">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className="text-xs font-bold">{d.getDate()} {d.toLocaleDateString('en-US', { month: 'short' })}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {roomTypes.length === 0 ? (
                <tr>
                  <td colSpan={dateList.length + 1} className="p-8 text-center text-stone-400">
                    No room inventory data available for this range.
                  </td>
                </tr>
              ) : (
                roomTypes.map(rt => (
                  <tr key={rt.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="p-3.5 sticky left-0 z-10 bg-white border-r border-stone-200 font-bold text-stone-800 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">{rt.name}</span>
                      </div>
                      <span className="text-[10px] font-normal text-stone-400 capitalize block mt-0.5">
                        {rt.property.replace('-', ' ')}
                      </span>
                    </td>

                    {dateList.map(dateStr => {
                      const dayInv = inventory.find(i => i.room_type_id === rt.id && i.date === dateStr);
                      const dayRest = restrictions.filter(r => r.room_type_id === rt.id && r.date === dateStr);
                      const isStopSell = dayRest.some(r => r.stop_sell);
                      const hasCTA = dayRest.some(r => r.closed_to_arrival);
                      const hasCTD = dayRest.some(r => r.closed_to_departure);
                      const minStay = Math.max(...dayRest.map(r => r.min_stay || 1), 1);

                      const avail = dayInv ? dayInv.available_count : 0;
                      const total = dayInv ? dayInv.total_physical_rooms : 0;
                      const reserved = dayInv ? dayInv.reserved_count : 0;
                      const blocked = dayInv ? dayInv.blocked_count : 0;

                      let cellBg = 'bg-emerald-50/50 text-emerald-800';
                      let badgeBg = 'bg-emerald-100 text-emerald-800';
                      if (avail === 0 || isStopSell) {
                        cellBg = 'bg-red-50/60 text-red-800';
                        badgeBg = 'bg-red-100 text-red-800 font-bold';
                      } else if (avail <= 2) {
                        cellBg = 'bg-amber-50/60 text-amber-800';
                        badgeBg = 'bg-amber-100 text-amber-800 font-bold';
                      }

                      return (
                        <td
                          key={dateStr}
                          className={`p-2 text-center border-r border-stone-200 align-top ${cellBg}`}
                          title={`Total: ${total} | Booked: ${reserved} | Blocked/Held: ${blocked} | Available: ${avail}`}
                        >
                          <div className="space-y-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono font-bold ${badgeBg}`}>
                              {avail}
                            </span>

                            {/* Sub counts */}
                            <div className="text-[9px] text-stone-500 font-mono flex items-center justify-center gap-1">
                              <span title="Reserved">{reserved}b</span>
                              {blocked > 0 && <span title="Blocked/Held" className="text-amber-700">{blocked}l</span>}
                            </div>

                            {/* Badges */}
                            <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5">
                              {isStopSell && (
                                <span className="px-1 py-0.2 bg-stone-900 text-white rounded text-[8px] font-bold">
                                  STOP
                                </span>
                              )}
                              {hasCTA && (
                                <span className="px-1 py-0.2 bg-blue-100 text-blue-800 rounded text-[8px] font-bold" title="Closed to Arrival">
                                  CTA
                                </span>
                              )}
                              {hasCTD && (
                                <span className="px-1 py-0.2 bg-indigo-100 text-indigo-800 rounded text-[8px] font-bold" title="Closed to Departure">
                                  CTD
                                </span>
                              )}
                              {minStay > 1 && (
                                <span className="px-1 py-0.2 bg-purple-100 text-purple-800 rounded text-[8px] font-bold" title={`Min Stay: ${minStay}`}>
                                  {minStay}N
                                </span>
                              )}
                            </div>
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
    </div>
  );
};
