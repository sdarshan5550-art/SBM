import React, { useState, useEffect } from 'react';
import {
  Globe,
  RefreshCw,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  DollarSign,
  Calendar,
  ListFilter,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Shield,
  ArrowRight,
  Database,
  Search,
  Eye,
  Info,
  Clock,
  Zap,
  Check,
  X,
  Play,
  RotateCw,
  Activity,
  FileText,
  Lock,
  Building2
} from 'lucide-react';
import { api } from '../lib/api';
import {
  ChannelConfig,
  ChannelRoomMapping,
  PMSRatePlan,
  ChannelRateMapping,
  SyncJob,
  ChannelInventorySummary,
  PropertyCode,
  ChannelRestriction
} from '../types';

import { ChannelOverview } from './channel-manager/ChannelOverview';
import { ChannelActivationModal } from './channel-manager/ChannelActivationModal';
import { ChannelConfigModal } from './channel-manager/ChannelConfigModal';
import { ManualSyncModal } from './channel-manager/ManualSyncModal';
import { RoomMappingsManager } from './channel-manager/RoomMappingsManager';
import { RatePlansAndMappings } from './channel-manager/RatePlansAndMappings';
import { InventoryCalendarView } from './channel-manager/InventoryCalendarView';
import { RateCalendarView } from './channel-manager/RateCalendarView';
import { RestrictionsManager } from './channel-manager/RestrictionsManager';
import { ReservationHub } from './channel-manager/ReservationHub';
import { SyncCenterAndLogs } from './channel-manager/SyncCenterAndLogs';
import { AuditTrailView } from './channel-manager/AuditTrailView';
import { OTASimulatorView } from './channel-manager/OTASimulatorView';

export const ChannelManagerTab: React.FC = () => {
  const [subTab, setSubTab] = useState<
    'overview' | 'rooms' | 'rates' | 'inventory' | 'rate-calendar' | 'restrictions' | 'reservations' | 'logs' | 'audit' | 'simulator'
  >('overview');

  // Core Data
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [roomMappings, setRoomMappings] = useState<ChannelRoomMapping[]>([]);
  const [pmsRatePlans, setPmsRatePlans] = useState<PMSRatePlan[]>([]);
  const [rateMappings, setRateMappings] = useState<ChannelRateMapping[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [restrictions, setRestrictions] = useState<ChannelRestriction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Property Filter
  const [selectedProperty, setSelectedProperty] = useState<PropertyCode | 'all'>('all');

  // Modals
  const [activationChannel, setActivationChannel] = useState<ChannelConfig | null>(null);
  const [configuringChannel, setConfiguringChannel] = useState<ChannelConfig | null>(null);
  const [showManualSyncModal, setShowManualSyncModal] = useState<boolean>(false);
  const [manualSyncTargetChannel, setManualSyncTargetChannel] = useState<ChannelConfig | null>(null);

  // Load All Channel Manager Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [chList, rMaps, rPlans, rtMaps, jobs, rests] = await Promise.all([
        api.channelManager.getChannels(),
        api.channelManager.getRoomMappings({ propertyCode: selectedProperty === 'all' ? undefined : selectedProperty }),
        api.channelManager.getPMSRatePlans({ propertyCode: selectedProperty === 'all' ? undefined : selectedProperty }),
        api.channelManager.getRateMappings({ propertyCode: selectedProperty === 'all' ? undefined : selectedProperty }),
        api.channelManager.getSyncJobs({ limit: 150 }),
        api.channelManager.getRestrictions({ propertyCode: selectedProperty === 'all' ? undefined : selectedProperty })
      ]);

      setChannels(chList);
      setRoomMappings(rMaps);
      setPmsRatePlans(rPlans);
      setRateMappings(rtMaps);
      setSyncJobs(jobs);
      setRestrictions(rests);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to load Channel Manager data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProperty]);

  // Overall Statistics
  const activeChannelsCount = channels.filter(c => c.enabled && c.connectionStatus === 'CONNECTED').length;
  const activeRoomMappingsCount = roomMappings.filter(m => m.is_active).length;
  const activeRateMappingsCount = rateMappings.filter(m => m.is_active).length;
  const pendingJobsCount = syncJobs.filter(j => j.status === 'PENDING' || j.status === 'PROCESSING' || j.status === 'RETRYING').length;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white p-6 rounded-3xl shadow-xl border border-stone-800/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Primary Source of Truth
              </span>
              <span className="text-xs text-stone-400 font-mono">Phase 2 Core Hardened</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              SBM Hotel Channel Manager Control Center
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Centralized inventory allocation, multi-night rate engines, channel restrictions, and idempotent reservation synchronization across Direct Website and Connected OTAs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setManualSyncTargetChannel(null);
                setShowManualSyncModal(true);
              }}
              className="px-4 py-2.5 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-stone-900" />
              Manual Sync Center
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-stone-800 text-xs">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-stone-400 block text-[11px]">Active Channels</span>
            <span className="text-lg font-bold text-white font-mono">{activeChannelsCount} / {channels.length}</span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-stone-400 block text-[11px]">Mapped Room Categories</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">{activeRoomMappingsCount} Active</span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-stone-400 block text-[11px]">Mapped Rate Plans</span>
            <span className="text-lg font-bold text-amber-400 font-mono">{activeRateMappingsCount} Plans</span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-stone-400 block text-[11px]">Sync Queue State</span>
            <span className="text-lg font-bold text-white font-mono">
              {pendingJobsCount === 0 ? (
                <span className="text-emerald-400">All Synced ✓</span>
              ) : (
                <span className="text-amber-400">{pendingJobsCount} Pending</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Property Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
        {/* Sub Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview & Channels', icon: Globe },
            { id: 'rooms', label: 'Room Mappings', icon: Layers },
            { id: 'rates', label: 'Rate Plans', icon: DollarSign },
            { id: 'inventory', label: 'Inventory Calendar', icon: Calendar },
            { id: 'rate-calendar', label: 'Rate Calendar', icon: DollarSign },
            { id: 'restrictions', label: 'Restrictions', icon: Shield },
            { id: 'reservations', label: 'Reservation Hub', icon: FileText },
            { id: 'logs', label: 'Sync Center & Logs', icon: RotateCw },
            { id: 'audit', label: 'Audit Trail', icon: Clock },
            { id: 'simulator', label: 'OTA Simulator', icon: Play }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${isActive ? 'bg-stone-900 text-white shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Property Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <Building2 className="w-4 h-4 text-stone-400" />
          <select
            value={selectedProperty}
            onChange={e => setSelectedProperty(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none text-stone-800"
          >
            <option value="all">All Properties</option>
            <option value="sbm-hotel">SBM Hotel (Main)</option>
            <option value="sbm-guest-house">SBM 2 Guest House</option>
          </select>
        </div>
      </div>

      {/* SUB-TAB CONTENTS */}
      {subTab === 'overview' && (
        <ChannelOverview
          channels={channels}
          syncJobs={syncJobs}
          onConfigureChannel={channel => setConfiguringChannel(channel)}
          onActivateChannel={channel => setActivationChannel(channel)}
          onSyncChannel={channel => {
            setManualSyncTargetChannel(channel);
            setShowManualSyncModal(true);
          }}
          onViewLogs={channelCode => {
            setSubTab('logs');
          }}
          onRefresh={loadData}
        />
      )}

      {subTab === 'rooms' && (
        <RoomMappingsManager
          roomMappings={roomMappings}
          channels={channels}
          propertyCode={selectedProperty}
          onMappingsChanged={loadData}
        />
      )}

      {subTab === 'rates' && (
        <RatePlansAndMappings
          pmsRatePlans={pmsRatePlans}
          rateMappings={rateMappings}
          channels={channels}
          propertyCode={selectedProperty}
          onPlansChanged={loadData}
        />
      )}

      {subTab === 'inventory' && (
        <InventoryCalendarView
          propertyCode={selectedProperty}
          restrictions={restrictions}
          onRefresh={loadData}
        />
      )}

      {subTab === 'rate-calendar' && (
        <RateCalendarView
          propertyCode={selectedProperty}
          onRateChanged={loadData}
        />
      )}

      {subTab === 'restrictions' && (
        <RestrictionsManager
          restrictions={restrictions}
          channels={channels}
          propertyCode={selectedProperty}
          onRestrictionsChanged={loadData}
        />
      )}

      {subTab === 'reservations' && (
        <ReservationHub propertyCode={selectedProperty} />
      )}

      {subTab === 'logs' && (
        <SyncCenterAndLogs
          syncJobs={syncJobs}
          channels={channels}
          onJobRetried={loadData}
          onRefresh={loadData}
        />
      )}

      {subTab === 'audit' && (
        <AuditTrailView />
      )}

      {subTab === 'simulator' && (
        <OTASimulatorView onReservationImported={loadData} />
      )}

      {/* Modals */}
      {activationChannel && (
        <ChannelActivationModal
          channel={activationChannel}
          isOpen={Boolean(activationChannel)}
          onClose={() => setActivationChannel(null)}
          onActivated={updated => {
            setNotification({ type: 'success', message: `${updated.name} has been certified and activated.` });
            loadData();
          }}
          roomMappings={roomMappings}
          rateMappings={rateMappings}
        />
      )}

      {configuringChannel && (
        <ChannelConfigModal
          channel={configuringChannel}
          isOpen={Boolean(configuringChannel)}
          onClose={() => setConfiguringChannel(null)}
          onSaved={updated => {
            setNotification({ type: 'success', message: `Updated configuration for ${updated.name}.` });
            loadData();
          }}
        />
      )}

      {showManualSyncModal && (
        <ManualSyncModal
          isOpen={showManualSyncModal}
          onClose={() => setShowManualSyncModal(false)}
          channels={channels}
          selectedChannel={manualSyncTargetChannel}
          onSyncComplete={loadData}
        />
      )}
    </div>
  );
};
