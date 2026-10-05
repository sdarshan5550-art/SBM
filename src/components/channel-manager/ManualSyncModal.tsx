import React, { useState } from 'react';
import {
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
  DollarSign,
  Shield,
  Calendar,
  Zap,
  Globe
} from 'lucide-react';
import { api } from '../../lib/api';
import { ChannelConfig } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  channels: ChannelConfig[];
  selectedChannel?: ChannelConfig | null;
  onSyncComplete: () => void;
}

export const ManualSyncModal: React.FC<Props> = ({
  isOpen,
  onClose,
  channels,
  selectedChannel,
  onSyncComplete
}) => {
  const [targetMode, setTargetMode] = useState<'single' | 'all_active'>(selectedChannel ? 'single' : 'all_active');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(selectedChannel?.id || (channels[0]?.id || ''));
  const [syncScope, setSyncScope] = useState<'ALL' | 'INVENTORY' | 'RATES' | 'RESTRICTIONS'>('ALL');
  const [confirmedFullSync, setConfirmedFullSync] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<{ success: boolean; message: string; jobsQueued: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeChannels = channels.filter(c => c.enabled && c.connectionStatus === 'CONNECTED');
  const isFullSync = syncScope === 'ALL' && targetMode === 'all_active';

  const handleExecuteSync = async () => {
    if (isFullSync && !confirmedFullSync) {
      setError('Please check the confirmation box before initiating a Global Synchronization across all active channels.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.channelManager.manualScopedSync({
        channelId: targetMode === 'single' ? selectedChannelId : undefined,
        scope: syncScope,
        allActive: targetMode === 'all_active'
      });

      setResult(res);
      onSyncComplete();
    } catch (err: any) {
      setError(err.message || 'Synchronization dispatch failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Manual Channel Synchronization</h3>
              <p className="text-xs text-stone-300">Push real-time state from Central PMS to connected OTAs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Sync Request Failed</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Synchronization Dispatched</p>
                <p className="mt-0.5">{result.message}</p>
                <p className="text-[11px] text-emerald-600 mt-1 font-semibold">{result.jobsQueued} background queue jobs generated.</p>
              </div>
            </div>
          )}

          {/* Target Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
              Sync Target
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetMode('all_active')}
                className={`p-3 rounded-xl border text-left transition-all ${targetMode === 'all_active' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Globe className="w-3.5 h-3.5 text-amber-600" />
                  All Active Channels
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">{activeChannels.length} connected OTAs</p>
              </button>

              <button
                type="button"
                onClick={() => setTargetMode('single')}
                className={`p-3 rounded-xl border text-left transition-all ${targetMode === 'single' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  Single Channel
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">Target specific OTA</p>
              </button>
            </div>
          </div>

          {/* Single Channel Dropdown */}
          {targetMode === 'single' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Select Channel
              </label>
              <select
                value={selectedChannelId}
                onChange={e => setSelectedChannelId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {channels.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.connectionStatus === 'CONNECTED' ? 'Connected' : 'Disconnected/Disabled'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sync Scope */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
              Synchronization Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSyncScope('ALL')}
                className={`p-2.5 rounded-xl border text-left text-xs font-semibold ${syncScope === 'ALL' ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}
              >
                ⚡ Everything (Full Sync)
              </button>

              <button
                type="button"
                onClick={() => setSyncScope('INVENTORY')}
                className={`p-2.5 rounded-xl border text-left text-xs font-semibold ${syncScope === 'INVENTORY' ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}
              >
                📅 Inventory Only
              </button>

              <button
                type="button"
                onClick={() => setSyncScope('RATES')}
                className={`p-2.5 rounded-xl border text-left text-xs font-semibold ${syncScope === 'RATES' ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}
              >
                💰 Rates Only
              </button>

              <button
                type="button"
                onClick={() => setSyncScope('RESTRICTIONS')}
                className={`p-2.5 rounded-xl border text-left text-xs font-semibold ${syncScope === 'RESTRICTIONS' ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'}`}
              >
                🚫 Restrictions Only
              </button>
            </div>
          </div>

          {/* Safety Confirmation for Global Full Sync */}
          {isFullSync && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900">
                  <strong>Safety Notice:</strong> A global full synchronization pushes inventory, rates, and restrictions for all room types across all connected channels for the next 30 days.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={confirmedFullSync}
                  onChange={e => setConfirmedFullSync(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                I confirm dispatching global sync across all active channels
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-stone-50 border-t border-stone-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800"
          >
            Close
          </button>

          <button
            onClick={handleExecuteSync}
            disabled={loading || (isFullSync && !confirmedFullSync)}
            className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Dispatching Sync...
              </>
            ) : (
              <>
                <RotateCw className="w-4 h-4" />
                Trigger Sync Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
