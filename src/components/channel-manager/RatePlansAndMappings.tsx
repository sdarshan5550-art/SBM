import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  X,
  Layers,
  Percent,
  Shield,
  Coffee,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { PMSRatePlan, ChannelRateMapping, ChannelConfig, PropertyCode } from '../../types';

interface Props {
  pmsRatePlans: PMSRatePlan[];
  rateMappings: ChannelRateMapping[];
  channels: ChannelConfig[];
  propertyCode: PropertyCode | 'all';
  onPlansChanged: () => void;
}

export const RatePlansAndMappings: React.FC<Props> = ({
  pmsRatePlans,
  rateMappings,
  channels,
  propertyCode,
  onPlansChanged
}) => {
  const [activeSection, setActiveSection] = useState<'mappings' | 'plans'>('mappings');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Rate Mapping Form State
  const [mapChannelId, setMapChannelId] = useState<string>('');
  const [mapPropertyCode, setMapPropertyCode] = useState<PropertyCode>('sbm-hotel');
  const [mapPmsRoomTypeId, setMapPmsRoomTypeId] = useState<string>('room-sbm-deluxe');
  const [mapPmsPlanId, setMapPmsPlanId] = useState<string>('');
  const [mapPmsPlanName, setMapPmsPlanName] = useState<string>('Standard Room Only (EP)');
  const [mapOtaPlanId, setMapOtaPlanId] = useState<string>('');
  const [mapOtaPlanName, setMapOtaPlanName] = useState<string>('Standard Flexible Rate');
  const [mapMultiplier, setMapMultiplier] = useState<number>(1.15);
  const [mapIsActive, setMapIsActive] = useState<boolean>(true);

  // PMS Rate Plan Form State
  const [planPropertyCode, setPlanPropertyCode] = useState<PropertyCode>('sbm-hotel');
  const [planRoomTypeId, setPlanRoomTypeId] = useState<string>('room-sbm-deluxe');
  const [planName, setPlanName] = useState<string>('');
  const [planCode, setPlanCode] = useState<string>('');
  const [planMealPlan, setPlanMealPlan] = useState<'EP' | 'CP' | 'MAP' | 'AP'>('EP');
  const [planCancellation, setPlanCancellation] = useState<'FLEXIBLE' | 'MODERATE' | 'NON_REFUNDABLE'>('FLEXIBLE');
  const [planModifierType, setPlanModifierType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [planModifierValue, setPlanModifierValue] = useState<number>(0);

  const filteredMappings = rateMappings.filter(m => {
    if (selectedChannelId !== 'all' && m.channel_id !== selectedChannelId && m.channel_code !== selectedChannelId) {
      return false;
    }
    return true;
  });

  const handleOpenAddMapping = () => {
    const firstChan = channels.find(c => c.code !== 'DIRECT') || channels[0];
    const firstPlan = pmsRatePlans[0];
    setMapChannelId(firstChan?.id || '');
    setMapPropertyCode('sbm-hotel');
    setMapPmsRoomTypeId('room-sbm-deluxe');
    setMapPmsPlanId(firstPlan?.id || 'rate-sbm-deluxe-ep');
    setMapPmsPlanName(firstPlan?.name || 'Standard Room Only (EP)');
    setMapOtaPlanId('');
    setMapOtaPlanName('');
    setMapMultiplier(1.15);
    setMapIsActive(true);
    setShowMappingModal(true);
    setNotification(null);
  };

  const handleSaveMapping = async () => {
    if (!mapOtaPlanId.trim()) {
      setNotification({ type: 'error', message: 'OTA Rate Plan ID is required.' });
      return;
    }

    const chan = channels.find(c => c.id === mapChannelId);
    const channelCode = chan ? chan.code : 'BOOKING_COM';

    setLoading(true);
    try {
      await api.channelManager.saveRateMapping({
        channel_id: mapChannelId,
        channel_code: channelCode,
        property_code: mapPropertyCode,
        pms_room_type_id: mapPmsRoomTypeId,
        pms_rate_plan_id: mapPmsPlanId,
        pms_rate_plan_name: mapPmsPlanName,
        channel_room_id: 'OTA-ROOM-01',
        channel_rate_plan_id: mapOtaPlanId.trim(),
        channel_rate_plan_name: mapOtaPlanName.trim() || mapPmsPlanName,
        price_multiplier: Number(mapMultiplier) || 1.0,
        is_active: mapIsActive
      });

      setNotification({ type: 'success', message: `Saved rate plan mapping for ${channelCode}.` });
      setShowMappingModal(false);
      onPlansChanged();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to save rate mapping.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddPlan = () => {
    setPlanPropertyCode('sbm-hotel');
    setPlanRoomTypeId('room-sbm-deluxe');
    setPlanName('');
    setPlanCode('');
    setPlanMealPlan('EP');
    setPlanCancellation('FLEXIBLE');
    setPlanModifierType('PERCENTAGE');
    setPlanModifierValue(0);
    setShowPlanModal(true);
  };

  const handleSavePlan = async () => {
    if (!planName.trim()) {
      setNotification({ type: 'error', message: 'Plan Name is required.' });
      return;
    }

    setLoading(true);
    try {
      await api.channelManager.savePMSRatePlan({
        property_code: planPropertyCode,
        room_type_id: planRoomTypeId,
        name: planName.trim(),
        code: planCode.trim() || `PLAN-${Date.now()}`,
        meal_plan: planMealPlan,
        cancellation_policy: planCancellation,
        price_modifier_type: planModifierType,
        price_modifier_value: Number(planModifierValue) || 0,
        is_active: true
      });

      setNotification({ type: 'success', message: 'PMS Rate Plan created.' });
      setShowPlanModal(false);
      onPlansChanged();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to save rate plan.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-Switch & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-semibold text-stone-600">
            <button
              onClick={() => setActiveSection('mappings')}
              className={`px-3 py-1.5 rounded-md transition-all ${activeSection === 'mappings' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'hover:text-stone-900'}`}
            >
              OTA Rate Mappings ({rateMappings.length})
            </button>
            <button
              onClick={() => setActiveSection('plans')}
              className={`px-3 py-1.5 rounded-md transition-all ${activeSection === 'plans' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'hover:text-stone-900'}`}
            >
              PMS Rate Plans ({pmsRatePlans.length})
            </button>
          </div>

          {activeSection === 'mappings' && (
            <select
              value={selectedChannelId}
              onChange={e => setSelectedChannelId(e.target.value)}
              className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium text-stone-700"
            >
              <option value="all">All Channels</option>
              {channels.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {activeSection === 'mappings' ? (
          <button
            onClick={handleOpenAddMapping}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Map Rate Plan to OTA
          </button>
        ) : (
          <button
            onClick={handleOpenAddPlan}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create PMS Rate Plan
          </button>
        )}
      </div>

      {notification && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SECTION 1: OTA RATE MAPPINGS TABLE */}
      {activeSection === 'mappings' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="p-3.5">Channel</th>
                  <th className="p-3.5">SBM Rate Plan</th>
                  <th className="p-3.5">OTA Rate ID</th>
                  <th className="p-3.5">OTA Rate Name</th>
                  <th className="p-3.5">Multiplier</th>
                  <th className="p-3.5">Tax Mode</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredMappings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-stone-400">
                      No rate mappings configured for this channel. Click "Map Rate Plan to OTA" to assign rate multipliers.
                    </td>
                  </tr>
                ) : (
                  filteredMappings.map(m => (
                    <tr key={m.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="p-3.5 font-bold text-stone-900">
                        {m.channel_code}
                      </td>
                      <td className="p-3.5 font-semibold text-stone-800">
                        {m.pms_rate_plan_name}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-stone-800">
                        {m.channel_rate_plan_id}
                      </td>
                      <td className="p-3.5 text-stone-700">
                        {m.channel_rate_plan_name}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-amber-700">
                        {m.price_multiplier}x
                        <span className="text-[10px] text-stone-400 font-normal block">
                          (+{Math.round((m.price_multiplier - 1) * 100)}% markup)
                        </span>
                      </td>
                      <td className="p-3.5 text-stone-600 font-medium">
                        Net + 12% GST
                      </td>
                      <td className="p-3.5">
                        {m.is_active ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-stone-100 text-stone-600 font-semibold rounded text-[10px]">
                            DISABLED
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={async () => {
                            if (!window.confirm('Delete this rate plan mapping?')) return;
                            await api.channelManager.deleteRateMapping(m.id);
                            onPlansChanged();
                          }}
                          className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-100 transition-colors"
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
      )}

      {/* SECTION 2: PMS RATE PLANS TABLE */}
      {activeSection === 'plans' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="p-3.5">Plan Name</th>
                  <th className="p-3.5">Meal Plan</th>
                  <th className="p-3.5">Cancellation Policy</th>
                  <th className="p-3.5">Price Modifier</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {pmsRatePlans.map(p => (
                  <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="p-3.5 font-bold text-stone-900">
                      {p.name}
                      <span className="text-[10px] text-stone-400 font-mono block">{p.code}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px]">
                        {p.meal_plan} ({p.meal_plan === 'EP' ? 'Room Only' : p.meal_plan === 'CP' ? 'Breakfast' : 'Half Board'})
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-stone-700">
                      {p.cancellation_policy === 'NON_REFUNDABLE' ? (
                        <span className="text-red-700 font-semibold">Non-Refundable</span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Flexible (Free Cancellation)</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-stone-800">
                      {p.price_modifier_value === 0 ? 'Base Tariff' : `+${p.price_modifier_value}%`}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                        ACTIVE
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={async () => {
                          if (!window.confirm('Delete PMS Rate Plan?')) return;
                          await api.channelManager.deletePMSRatePlan(p.id);
                          onPlansChanged();
                        }}
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Map Rate Plan Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
            <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">Map Rate Plan to OTA</h3>
              </div>
              <button onClick={() => setShowMappingModal(false)} className="p-1 text-stone-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Target Channel</label>
                <select
                  value={mapChannelId}
                  onChange={e => setMapChannelId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {channels.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">PMS Rate Plan</label>
                <select
                  value={mapPmsPlanId}
                  onChange={e => {
                    setMapPmsPlanId(e.target.value);
                    const found = pmsRatePlans.find(p => p.id === e.target.value);
                    if (found) setMapPmsPlanName(found.name);
                  }}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {pmsRatePlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.meal_plan})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    OTA Rate ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mapOtaPlanId}
                    onChange={e => setMapOtaPlanId(e.target.value)}
                    placeholder="e.g. BKG-RATE-EP"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Price Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="3.0"
                    value={mapMultiplier}
                    onChange={e => setMapMultiplier(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex items-center justify-between">
              <button onClick={() => setShowMappingModal(false)} className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800">
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={loading || !mapOtaPlanId.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Save Rate Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create PMS Rate Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
            <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">New PMS Rate Plan</h3>
              </div>
              <button onClick={() => setShowPlanModal(false)} className="p-1 text-stone-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Plan Title</label>
                <input
                  type="text"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  placeholder="e.g. Bed & Breakfast Plan (CP)"
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Meal Plan</label>
                  <select
                    value={planMealPlan}
                    onChange={e => setPlanMealPlan(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="EP">EP (European Plan - Room Only)</option>
                    <option value="CP">CP (Continental Plan - Breakfast)</option>
                    <option value="MAP">MAP (Modified American Plan - Breakfast + Dinner)</option>
                    <option value="AP">AP (American Plan - All Meals)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Cancellation Policy</label>
                  <select
                    value={planCancellation}
                    onChange={e => setPlanCancellation(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="FLEXIBLE">Flexible (Free Cancellation up to 24h)</option>
                    <option value="MODERATE">Moderate (Free Cancellation up to 48h)</option>
                    <option value="NON_REFUNDABLE">Non-Refundable (100% Charge)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Price Modifier (% Over Base Room Tariff)</label>
                <input
                  type="number"
                  step="5"
                  value={planModifierValue}
                  onChange={e => setPlanModifierValue(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex items-center justify-between">
              <button onClick={() => setShowPlanModal(false)} className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800">
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                disabled={loading || !planName.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Save Rate Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
