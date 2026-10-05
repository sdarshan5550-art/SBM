import React, { useState } from 'react';
import {
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Zap,
  Sliders,
  Play,
  Layers,
  DollarSign,
  Shield,
  Activity,
  Clock,
  Eye,
  Settings,
  Power
} from 'lucide-react';
import { api } from '../../lib/api';
import { ChannelConfig, SyncJob } from '../../types';

interface Props {
  channels: ChannelConfig[];
  syncJobs: SyncJob[];
  onConfigureChannel: (channel: ChannelConfig) => void;
  onActivateChannel: (channel: ChannelConfig) => void;
  onSyncChannel: (channel: ChannelConfig) => void;
  onViewLogs: (channelCode: string) => void;
  onRefresh: () => void;
}

export const ChannelOverview: React.FC<Props> = ({
  channels,
  syncJobs,
  onConfigureChannel,
  onActivateChannel,
  onSyncChannel,
  onViewLogs,
  onRefresh
}) => {
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleTestConnection = async (channel: ChannelConfig) => {
    setTestingChannelId(channel.id);
    setNotification(null);
    try {
      const res = await api.channelManager.testChannel(channel.id);
      if (res.success) {
        setNotification({ type: 'success', message: `${channel.name}: ${res.message}` });
      } else {
        setNotification({ type: 'info', message: `${channel.name}: ${res.message}` });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `${channel.name}: ${err.message}` });
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleToggleEnable = async (channel: ChannelConfig) => {
    try {
      if (channel.enabled) {
        await api.channelManager.disableChannel(channel.id);
        setNotification({ type: 'info', message: `Disabled ${channel.name}.` });
      } else {
        await api.channelManager.activateChannel(channel.id);
        setNotification({ type: 'success', message: `Activated ${channel.name}.` });
      }
      onRefresh();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Action failed.' });
    }
  };

  const getStatusBadge = (channel: ChannelConfig) => {
    if (!channel.enabled || channel.connectionStatus === 'DISABLED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600 border border-stone-200">
          <Power className="w-3 h-3 text-stone-400" />
          DISABLED
        </span>
      );
    }

    if (channel.code === 'DIRECT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          CONNECTED (Native)
        </span>
      );
    }

    if (channel.connectionStatus === 'CONNECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          CONNECTED
        </span>
      );
    }

    if (channel.connectionStatus === 'ERROR' || channel.lastError) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300">
          <AlertTriangle className="w-3 h-3 text-red-600" />
          ERROR
        </span>
      );
    }

    if (channel.credentialsConfigured) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <Activity className="w-3 h-3 text-amber-600" />
          CONFIGURED (Pending Activation)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-500 border border-stone-200">
        <Sliders className="w-3 h-3 text-stone-400" />
        NOT CONFIGURED
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-xl text-xs flex items-center justify-between border ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : notification.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-stone-600 text-xs">Dismiss</button>
        </div>
      )}

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map(channel => {
          const channelJobs = syncJobs.filter(j => j.channel_id === channel.id || j.channel_code === channel.code);
          const pendingJobs = channelJobs.filter(j => j.status === 'PENDING' || j.status === 'PROCESSING' || j.status === 'RETRYING').length;
          const failedJobs = channelJobs.filter(j => j.status === 'FAILED').length;

          const isDirect = channel.code === 'DIRECT';
          const isConnected = channel.enabled && channel.connectionStatus === 'CONNECTED';

          return (
            <div
              key={channel.id}
              className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${isConnected ? 'border-emerald-300 ring-1 ring-emerald-500/10' : 'border-stone-200'}`}
            >
              {/* Card Header */}
              <div className="p-5 border-b border-stone-100 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                      <Globe className={`w-4 h-4 ${isDirect ? 'text-amber-600' : 'text-blue-600'}`} />
                      {channel.name}
                    </h3>
                    <p className="text-[11px] text-stone-400 font-mono mt-0.5">{channel.code}</p>
                  </div>
                  {getStatusBadge(channel)}
                </div>

                {/* Status Pills */}
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1">
                  <div className="bg-stone-50 p-1.5 rounded-lg border border-stone-200/80">
                    <span className="text-stone-400 block uppercase">Inventory</span>
                    <span className="font-bold text-emerald-700">
                      {channel.inventoryStatus === 'ERROR' ? '⚠ Error' : '✓ Synced'}
                    </span>
                  </div>
                  <div className="bg-stone-50 p-1.5 rounded-lg border border-stone-200/80">
                    <span className="text-stone-400 block uppercase">Rates</span>
                    <span className="font-bold text-emerald-700">
                      {channel.ratesStatus === 'ERROR' ? '⚠ Error' : '✓ Live'}
                    </span>
                  </div>
                  <div className="bg-stone-50 p-1.5 rounded-lg border border-stone-200/80">
                    <span className="text-stone-400 block uppercase">Bookings</span>
                    <span className="font-bold text-emerald-700">
                      {isDirect ? '✓ Realtime' : channel.credentialsConfigured ? '✓ Webhook' : '— Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Middle: Sync Status & Metadata */}
              <div className="p-5 space-y-2.5 text-xs text-stone-600 bg-stone-50/40">
                <div className="flex justify-between">
                  <span className="text-stone-400">Rate Multiplier:</span>
                  <span className="font-mono font-bold text-stone-800">
                    {channel.settings?.priceMultiplier || 1.0}x
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-stone-400">Mapped Rooms:</span>
                  <span className="font-semibold text-stone-800">
                    {channel.mappedRoomsCount || (isDirect ? 4 : 0)} Categories
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-stone-400">Sync Queue:</span>
                  <span className="font-mono font-semibold">
                    {pendingJobs > 0 ? (
                      <span className="text-amber-700 font-bold">{pendingJobs} Pending</span>
                    ) : (
                      <span className="text-emerald-700">Clear</span>
                    )}
                    {failedJobs > 0 && (
                      <span className="text-red-700 font-bold ml-1.5">({failedJobs} Failed)</span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between pt-1 border-t border-stone-200/60 text-[11px]">
                  <span className="text-stone-400">Last Successful Sync:</span>
                  <span className="font-mono text-stone-600">
                    {channel.lastSuccessfulSyncAt
                      ? new Date(channel.lastSuccessfulSyncAt).toLocaleTimeString()
                      : isDirect ? 'Active' : 'Pending Initial Sync'}
                  </span>
                </div>

                {channel.lastError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                    <span className="font-bold block">Last Error:</span>
                    <span className="truncate block" title={channel.lastError}>{channel.lastError}</span>
                  </div>
                )}
              </div>

              {/* Card Actions Footer */}
              <div className="p-4 bg-white border-t border-stone-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {!isDirect && (
                    <button
                      onClick={() => handleTestConnection(channel)}
                      disabled={testingChannelId === channel.id}
                      className="px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1"
                      title="Test Connection Ping"
                    >
                      <RotateCw className={`w-3 h-3 ${testingChannelId === channel.id ? 'animate-spin' : ''}`} />
                      Test
                    </button>
                  )}

                  <button
                    onClick={() => onSyncChannel(channel)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1"
                    title="Trigger Manual Sync"
                  >
                    <Zap className="w-3 h-3 text-amber-600" />
                    Sync Now
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onConfigureChannel(channel)}
                    className="p-1.5 text-stone-500 hover:text-stone-800 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                    title="Channel Configuration"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {!isDirect && (
                    !isConnected ? (
                      <button
                        onClick={() => onActivateChannel(channel)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors"
                      >
                        Activate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleEnable(channel)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:text-red-900 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Disable
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
