import React, { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Globe,
  DollarSign,
  X,
  RotateCw,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { ChannelRestriction, ChannelConfig, PropertyCode, RoomType } from '../../types';

interface Props {
  restrictions: ChannelRestriction[];
  channels: ChannelConfig[];
  propertyCode: PropertyCode | 'all';
  onRestrictionsChanged: () => void;
}

export const RestrictionsManager: React.FC<Props> = ({
  restrictions,
  channels,
  propertyCode,
  onRestrictionsChanged
}) => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [formScope, setFormScope] = useState<'ALL' | 'CHANNEL'>('ALL');
  const [formChannelCode, setFormChannelCode] = useState<string>('ALL');
  const [formPropertyCode, setFormPropertyCode] = useState<PropertyCode>('sbm-hotel');
  const [formRoomTypeId, setFormRoomTypeId] = useState<string>('room-sbm-deluxe');
  const [formStartDate, setFormStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formStopSell, setFormStopSell] = useState<boolean>(false);
  const [formCTA, setFormCTA] = useState<boolean>(false);
  const [formCTD, setFormCTD] = useState<boolean>(false);
  const [formMinStay, setFormMinStay] = useState<number>(1);
  const [formMaxStay, setFormMaxStay] = useState<number>(30);

  // Filter
  const [filterScope, setFilterScope] = useState<string>('all');

  const filteredRestrictions = restrictions.filter(r => {
    if (filterScope === 'all') return true;
    if (filterScope === 'GLOBAL') return !r.channel_code || r.channel_code === 'ALL';
    return r.channel_code === filterScope;
  });

  const handleOpenAddModal = () => {
    setShowModal(true);
    setFormStopSell(true);
    setFormCTA(false);
    setFormCTD(false);
    setFormMinStay(1);
    setFormMaxStay(30);
  };

  const handleSaveRestriction = async () => {
    setLoading(true);
    setNotification(null);
    try {
      // Create entries for each date in [formStartDate, formEndDate]
      const cur = new Date(formStartDate);
      const end = new Date(formEndDate);
      const entries: Partial<ChannelRestriction>[] = [];

      while (cur <= end) {
        entries.push({
          property_code: formPropertyCode,
          channel_code: formScope === 'ALL' ? 'ALL' : (formChannelCode as any),
          room_type_id: formRoomTypeId,
          date: cur.toISOString().split('T')[0],
          stop_sell: formStopSell,
          closed_to_arrival: formCTA,
          closed_to_departure: formCTD,
          min_stay: Number(formMinStay),
          max_stay: Number(formMaxStay)
        });
        cur.setDate(cur.getDate() + 1);
      }

      await api.channelManager.bulkUpdateRestrictions(entries);
      setNotification({ type: 'success', message: `Saved ${entries.length} restriction rule(s) successfully.` });
      setShowModal(false);
      onRestrictionsChanged();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to save restriction rule.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterScope}
            onChange={e => setFilterScope(e.target.value)}
            className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium text-stone-700"
          >
            <option value="all">All Scopes (Global & Channel-Specific)</option>
            <option value="GLOBAL">Global Only (All Channels)</option>
            <option value="DIRECT">Direct Website Only</option>
            <option value="BOOKING_COM">Booking.com Only</option>
            <option value="MMT">MakeMyTrip Only</option>
            <option value="AGODA">Agoda Only</option>
          </select>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Restriction Rule
        </button>
      </div>

      {notification && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Restrictions Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Scope</th>
                <th className="p-3.5">Room Category</th>
                <th className="p-3.5">Stop Sell</th>
                <th className="p-3.5">CTA / CTD</th>
                <th className="p-3.5">Min / Max Stay</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredRestrictions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-400">
                    No active restrictions found for current view.
                  </td>
                </tr>
              ) : (
                filteredRestrictions.map(r => (
                  <tr key={r.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="p-3.5 font-bold text-stone-900 font-mono">
                      {r.date}
                    </td>
                    <td className="p-3.5">
                      {!r.channel_code || r.channel_code === 'ALL' ? (
                        <span className="px-2 py-0.5 bg-stone-900 text-white rounded font-bold text-[10px] tracking-wide">
                          GLOBAL (ALL)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[10px]">
                          {r.channel_code}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-semibold text-stone-800 capitalize">
                      {r.room_type_id.replace('room-', '').replace('-', ' ')}
                    </td>
                    <td className="p-3.5">
                      {r.stop_sell ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">
                          STOP SELL
                        </span>
                      ) : (
                        <span className="text-stone-400">Open</span>
                      )}
                    </td>
                    <td className="p-3.5 space-x-1">
                      {r.closed_to_arrival && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">CTA</span>
                      )}
                      {r.closed_to_departure && (
                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold text-[10px]">CTD</span>
                      )}
                      {!r.closed_to_arrival && !r.closed_to_departure && (
                        <span className="text-stone-400">None</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-stone-700">
                      Min: {r.min_stay || 1}N | Max: {r.max_stay || 30}N
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={async () => {
                          await api.channelManager.saveRestriction({
                            ...r,
                            stop_sell: false,
                            closed_to_arrival: false,
                            closed_to_departure: false,
                            min_stay: 1,
                            max_stay: 30
                          });
                          onRestrictionsChanged();
                        }}
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-100 transition-colors"
                        title="Clear Restriction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Restriction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
            <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">Configure Channel Restrictions</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-stone-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Scope Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Restriction Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormScope('ALL')}
                    className={`p-3 rounded-xl border text-left text-xs font-semibold ${formScope === 'ALL' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}
                  >
                    <span className="font-bold block">GLOBAL (All Channels)</span>
                    <span className="text-[11px] text-stone-500 font-normal">Applies across Direct Website & all OTAs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormScope('CHANNEL')}
                    className={`p-3 rounded-xl border text-left text-xs font-semibold ${formScope === 'CHANNEL' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}
                  >
                    <span className="font-bold block">CHANNEL-SPECIFIC</span>
                    <span className="text-[11px] text-stone-500 font-normal">Isolate to one specific OTA only</span>
                  </button>
                </div>
              </div>

              {formScope === 'CHANNEL' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Target Channel</label>
                  <select
                    value={formChannelCode}
                    onChange={e => setFormChannelCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {channels.map(c => (
                      <option key={c.id} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Room Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Property</label>
                  <select
                    value={formPropertyCode}
                    onChange={e => setFormPropertyCode(e.target.value as PropertyCode)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="sbm-hotel">SBM Hotel</option>
                    <option value="sbm-guest-house">SBM 2 Guest House</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Room Category</label>
                  <select
                    value={formRoomTypeId}
                    onChange={e => setFormRoomTypeId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="room-sbm-deluxe">Deluxe Room</option>
                    <option value="room-sbm-family">Family Suite</option>
                    <option value="room-gh-deluxe">GH Deluxe Room</option>
                    <option value="room-gh-family">GH Family Suite</option>
                  </select>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Rules Checklist */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-bold text-red-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formStopSell}
                    onChange={e => setFormStopSell(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  STOP SELL (Block all sales for target scope)
                </label>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCTA}
                      onChange={e => setFormCTA(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    Closed to Arrival (CTA)
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCTD}
                      onChange={e => setFormCTD(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    Closed to Departure (CTD)
                  </label>
                </div>
              </div>

              {/* Min / Max Stay */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Minimum Stay (Nights)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formMinStay}
                    onChange={e => setFormMinStay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Maximum Stay (Nights)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={formMaxStay}
                    onChange={e => setFormMaxStay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRestriction}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Apply Restrictions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
