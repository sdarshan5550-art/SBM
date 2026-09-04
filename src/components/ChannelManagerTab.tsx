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
  RotateCw
} from 'lucide-react';
import { api } from '../lib/api';
import {
  ChannelConfig,
  ChannelRoomMapping,
  PMSRatePlan,
  ChannelRateMapping,
  SyncJob,
  ChannelInventorySummary,
  NormalizedOTAReservation,
  PropertyCode
} from '../types';

export const ChannelManagerTab: React.FC = () => {
  const [subTab, setSubTab] = useState<'overview' | 'rooms' | 'rates' | 'inventory' | 'logs' | 'simulator'>('overview');

  // Core Data
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [roomMappings, setRoomMappings] = useState<ChannelRoomMapping[]>([]);
  const [pmsRatePlans, setPmsRatePlans] = useState<PMSRatePlan[]>([]);
  const [rateMappings, setRateMappings] = useState<ChannelRateMapping[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [inventorySummaries, setInventorySummaries] = useState<ChannelInventorySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Filters
  const [selectedProperty, setSelectedProperty] = useState<PropertyCode | 'all'>('all');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all');

  // Modals & Forms
  const [editingChannel, setEditingChannel] = useState<ChannelConfig | null>(null);
  const [showRoomMappingModal, setShowRoomMappingModal] = useState<boolean>(false);
  const [editingRoomMapping, setEditingRoomMapping] = useState<Partial<ChannelRoomMapping> | null>(null);
  const [showRatePlanModal, setShowRatePlanModal] = useState<boolean>(false);
  const [editingRatePlan, setEditingRatePlan] = useState<Partial<PMSRatePlan> | null>(null);
  const [showRateMappingModal, setShowRateMappingModal] = useState<boolean>(false);
  const [editingRateMapping, setEditingRateMapping] = useState<Partial<ChannelRateMapping> | null>(null);

  // Simulator State
  const [simChannel, setSimChannel] = useState<string>('BOOKING_COM');
  const [simExtId, setSimExtId] = useState<string>(`OTA-BKG-${Math.floor(100000 + Math.random() * 900000)}`);
  const [simGuestName, setSimGuestName] = useState<string>('Rajesh Malhotra');
  const [simGuestPhone, setSimGuestPhone] = useState<string>('+91 98765 43210');
  const [simGuestEmail, setSimGuestEmail] = useState<string>('rajesh.malhotra@example.com');
  const [simProperty, setSimProperty] = useState<PropertyCode>('sbm-hotel');
  const [simRoomType, setSimRoomType] = useState<string>('room-sbm-deluxe');
  const [simCheckIn, setSimCheckIn] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [simCheckOut, setSimCheckOut] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [simAmount, setSimAmount] = useState<number>(5598);
  const [simIsCancelled, setSimIsCancelled] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Load All Channel Manager Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [chList, rMaps, rPlans, rtMaps, jobs, inv] = await Promise.all([
        api.channelManager.getChannels(),
        api.channelManager.getRoomMappings(),
        api.channelManager.getPMSRatePlans(),
        api.channelManager.getRateMappings(),
        api.channelManager.getSyncJobs({ limit: 100 }),
        api.channelManager.getInventory({ propertyCode: selectedProperty })
      ]);

      setChannels(chList);
      setRoomMappings(rMaps);
      setPmsRatePlans(rPlans);
      setRateMappings(rtMaps);
      setSyncJobs(jobs);
      setInventorySummaries(inv);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to load Channel Manager data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProperty]);

  // Handle Channel Update
  const handleUpdateChannel = async (id: string, updates: Partial<ChannelConfig>) => {
    setActionLoading(id);
    try {
      const updated = await api.channelManager.updateChannel(id, updates);
      setChannels(prev => prev.map(c => c.id === id ? updated : c));
      setNotification({ type: 'success', message: `Updated settings for ${updated.name}` });
      setEditingChannel(null);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Test Channel Connection
  const handleTestConnection = async (channel: ChannelConfig) => {
    setActionLoading(`test-${channel.id}`);
    try {
      const res = await api.channelManager.testChannel(channel.id);
      if (res.success) {
        setNotification({ type: 'success', message: `${channel.name}: ${res.message}` });
      } else {
        setNotification({ type: 'info', message: `${channel.name}: ${res.message}` });
      }
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Sync Single Channel
  const handleSyncChannel = async (channel: ChannelConfig) => {
    setActionLoading(`sync-${channel.id}`);
    try {
      const res = await api.channelManager.syncChannel(channel.id);
      if (res.success) {
        setNotification({ type: 'success', message: res.message });
      } else {
        setNotification({ type: 'error', message: res.message });
      }
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Global Sync All Channels
  const handleSyncAll = async () => {
    setActionLoading('sync-all');
    try {
      const res = await api.channelManager.syncAllChannels();
      setNotification({ type: 'success', message: res.message });
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Retry Sync Job
  const handleRetryJob = async (jobId: string) => {
    setActionLoading(`retry-${jobId}`);
    try {
      await api.channelManager.retrySyncJob(jobId);
      setNotification({ type: 'success', message: `Retried sync job ${jobId}` });
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Save Room Mapping
  const handleSaveRoomMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoomMapping) return;
    try {
      await api.channelManager.saveRoomMapping(editingRoomMapping);
      setNotification({ type: 'success', message: 'Room mapping saved successfully!' });
      setShowRoomMappingModal(false);
      setEditingRoomMapping(null);
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Delete Room Mapping
  const handleDeleteRoomMapping = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this room mapping?')) return;
    try {
      await api.channelManager.deleteRoomMapping(id);
      setNotification({ type: 'success', message: 'Room mapping deleted.' });
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Save Rate Plan
  const handleSaveRatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRatePlan) return;
    try {
      await api.channelManager.savePMSRatePlan(editingRatePlan);
      setNotification({ type: 'success', message: 'PMS Rate Plan saved!' });
      setShowRatePlanModal(false);
      setEditingRatePlan(null);
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Delete Rate Plan
  const handleDeleteRatePlan = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this rate plan?')) return;
    try {
      await api.channelManager.deletePMSRatePlan(id);
      setNotification({ type: 'success', message: 'Rate plan deleted.' });
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Save Rate Mapping
  const handleSaveRateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRateMapping) return;
    try {
      await api.channelManager.saveRateMapping(editingRateMapping);
      setNotification({ type: 'success', message: 'Rate mapping saved!' });
      setShowRateMappingModal(false);
      setEditingRateMapping(null);
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Delete Rate Mapping
  const handleDeleteRateMapping = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this rate mapping?')) return;
    try {
      await api.channelManager.deleteRateMapping(id);
      setNotification({ type: 'success', message: 'Rate mapping deleted.' });
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Execute OTA Simulator Test
  const handleRunSimulator = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('simulator');
    setSimResult(null);

    const payload: NormalizedOTAReservation = {
      externalReservationId: simExtId,
      channel: simChannel as any,
      channelCode: simChannel as any,
      propertyCode: simProperty,
      roomTypeId: simRoomType,
      checkIn: simCheckIn,
      checkOut: simCheckOut,
      adults: 2,
      children: 0,
      rooms: 1,
      guestName: simGuestName,
      guestPhone: simGuestPhone,
      guestEmail: simGuestEmail,
      totalAmount: Number(simAmount),
      currency: 'INR',
      paymentStatus: 'Paid',
      reservationStatus: simIsCancelled ? 'Cancelled' : 'Confirmed',
      isCancelled: simIsCancelled,
      specialRequests: `OTA Simulator test injection on ${new Date().toLocaleTimeString()}`
    };

    try {
      const res = await api.channelManager.importOTAReservation(payload);
      setSimResult(res);
      setNotification({
        type: 'success',
        message: res.isExisting
          ? `[Idempotent Match] Updated existing booking ${res.booking?.booking_number}`
          : `[New Ingest] Created booking ${res.booking?.booking_number}`
      });
      loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
      setSimResult({ error: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Helpers
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Connected
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Disconnected
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Error
          </span>
        );
      case 'NOT_CONFIGURED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase bg-stone-100 text-stone-600 border border-stone-200">
            <Clock className="w-3 h-3 text-stone-400" /> Ready to Connect
          </span>
        );
    }
  };

  const activeConnectedChannels = channels.filter(c => c.connectionStatus === 'CONNECTED').length;
  const pendingSyncJobs = syncJobs.filter(j => j.status === 'PENDING' || j.status === 'PROCESSING').length;
  const failedSyncJobs = syncJobs.filter(j => j.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 border flex items-center justify-between transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-stone-400 hover:text-stone-700 cursor-pointer text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="bg-white border border-[#C5A059]/20 p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-[#C5A059]" />
            <h2 className="text-xl font-serif font-medium text-[#1A1A1A]">
              Channel Manager CORE
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#1A1A1A] text-[#C5A059] px-2 py-0.5 ml-2">
              PMS Master Hub
            </span>
          </div>
          <p className="text-xs text-[#666666] max-w-2xl">
            Single Source of Truth inventory and rate distribution engine. Synchronizes availability, rates, and bookings across OTAs without breaking direct PMS reservations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="bg-white hover:bg-stone-50 text-[#1A1A1A] border border-stone-200 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#C5A059] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleSyncAll}
            disabled={actionLoading === 'sync-all'}
            className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C5A059] ${actionLoading === 'sync-all' ? 'animate-spin' : ''}`} />
            <span>Sync All Channels</span>
          </button>
        </div>
      </div>

      {/* Metric Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[#666666] uppercase tracking-wider">Active Channels</span>
            <Globe className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-[#1A1A1A]">{activeConnectedChannels}</span>
            <span className="text-xs text-[#666666]">/ {channels.length} Total</span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[#666666] uppercase tracking-wider">Room Mappings</span>
            <Layers className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-[#1A1A1A]">{roomMappings.length}</span>
            <span className="text-xs text-emerald-600 font-semibold">Active</span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[#666666] uppercase tracking-wider">PMS Rate Plans</span>
            <DollarSign className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-[#1A1A1A]">{pmsRatePlans.length}</span>
            <span className="text-xs text-[#666666]">Plans ({rateMappings.length} Mapped)</span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[#666666] uppercase tracking-wider">Sync Queue</span>
            <Clock className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-[#1A1A1A]">{pendingSyncJobs}</span>
            <span className="text-xs text-amber-600 font-semibold">Pending</span>
            {failedSyncJobs > 0 && (
              <span className="text-xs text-rose-600 font-semibold ml-2">({failedSyncJobs} failed)</span>
            )}
          </div>
        </div>
      </div>

      {/* Subtab Navigation */}
      <div className="flex overflow-x-auto border-b border-stone-200 space-x-2 pb-1">
        <button
          onClick={() => setSubTab('overview')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            subTab === 'overview'
              ? 'bg-[#1A1A1A] text-white font-bold'
              : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-[#C5A059]" />
          Channel Cards & Integrations
        </button>

        <button
          onClick={() => setSubTab('rooms')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            subTab === 'rooms'
              ? 'bg-[#1A1A1A] text-white font-bold'
              : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
          Room Mappings ({roomMappings.length})
        </button>

        <button
          onClick={() => setSubTab('rates')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            subTab === 'rates'
              ? 'bg-[#1A1A1A] text-white font-bold'
              : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-[#C5A059]" />
          Rate Plans & Multipliers
        </button>

        <button
          onClick={() => setSubTab('inventory')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            subTab === 'inventory'
              ? 'bg-[#1A1A1A] text-white font-bold'
              : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-[#C5A059]" />
          Central Inventory Truth
        </button>

        <button
          onClick={() => setSubTab('logs')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            subTab === 'logs'
              ? 'bg-[#1A1A1A] text-white font-bold'
              : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5 text-[#C5A059]" />
          Sync Queue & Audit Logs ({syncJobs.length})
        </button>

        <button
          onClick={() => setSubTab('simulator')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            subTab === 'simulator'
              ? 'bg-[#1A1A1A] text-white font-bold'
              : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-[#C5A059]" />
          OTA Webhook & Idempotency Sandbox
        </button>
      </div>

      {/* SUBTAB 1: CHANNEL OVERVIEW CARDS */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map(channel => {
              const isDirect = channel.code === 'DIRECT';
              return (
                <div
                  key={channel.id}
                  className="bg-white border border-stone-200 p-6 flex flex-col justify-between hover:border-[#C5A059]/50 transition-colors shadow-sm relative"
                >
                  {/* Channel Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A059]">
                          {channel.channelType}
                        </span>
                        <h3 className="text-lg font-serif font-medium text-[#1A1A1A]">
                          {channel.name}
                        </h3>
                      </div>
                      <div>{getStatusBadge(channel.connectionStatus)}</div>
                    </div>

                    <p className="text-xs text-[#666666] line-clamp-2 mb-4">
                      {channel.description || 'OTA Channel integration ready for live credentials.'}
                    </p>

                    {/* Meta information */}
                    <div className="bg-[#FDFCFB] border border-stone-200 p-3 space-y-2 text-xs mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[#666666]">Channel Enabled:</span>
                        <button
                          onClick={() => handleUpdateChannel(channel.id, { enabled: !channel.enabled })}
                          disabled={actionLoading === channel.id || isDirect}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                            channel.enabled ? 'bg-emerald-600' : 'bg-stone-300'
                          } ${isDirect ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              channel.enabled ? 'translate-x-4.5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[#666666]">Rate Multiplier:</span>
                        <span className="font-bold text-[#1A1A1A]">
                          {channel.rateMultiplier || 1.0}x
                          {channel.rateMultiplier && channel.rateMultiplier > 1 && (
                            <span className="text-emerald-600 text-[10px] ml-1 font-semibold">
                              (+{Math.round((channel.rateMultiplier - 1) * 100)}%)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[#666666]">Mapped Rooms / Rates:</span>
                        <span className="font-medium text-[#1A1A1A]">
                          {channel.mappedRoomsCount || 0} Rooms • {channel.mappedRatePlansCount || 0} Rates
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[#666666]">Last Sync:</span>
                        <span className="text-[#1A1A1A] font-medium">
                          {channel.lastSyncAt ? new Date(channel.lastSyncAt).toLocaleTimeString() : 'Never'}
                        </span>
                      </div>

                      {channel.lastError && (
                        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                          <strong>Notice:</strong> {channel.lastError}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Channel Card Actions */}
                  <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleSyncChannel(channel)}
                      disabled={actionLoading === `sync-${channel.id}`}
                      className="flex-1 bg-stone-100 hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] py-2 px-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 text-[#C5A059] ${
                          actionLoading === `sync-${channel.id}` ? 'animate-spin' : ''
                        }`}
                      />
                      <span>Sync Now</span>
                    </button>

                    <button
                      onClick={() => handleTestConnection(channel)}
                      disabled={actionLoading === `test-${channel.id}`}
                      className="bg-white hover:bg-stone-50 text-[#1A1A1A] border border-stone-200 py-2 px-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Zap className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>Test</span>
                    </button>

                    <button
                      onClick={() => setEditingChannel(channel)}
                      className="bg-white hover:bg-stone-50 text-[#1A1A1A] border border-stone-200 py-2 px-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#666666]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Architecture Architecture Notice */}
          <div className="bg-[#FAF8F5] border border-[#C5A059]/30 p-6 flex flex-col md:flex-row gap-4 items-start">
            <div className="w-10 h-10 bg-[#1A1A1A] text-[#C5A059] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div className="space-y-1 text-xs text-[#1A1A1A]">
              <h4 className="font-serif font-semibold text-sm">Security & Architectural Isolation</h4>
              <p className="text-[#666666] leading-relaxed">
                All OTA channel adapters are running in isolated server-side modules. Inbound OTA bookings are checked against 
                <code className="mx-1 bg-stone-200 px-1 py-0.5 text-[#1A1A1A] font-bold">channel + externalReservationId</code> 
                to guarantee zero duplicate reservations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ROOM MAPPINGS */}
      {subTab === 'rooms' && (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[#666666] uppercase tracking-wider">Channel Filter:</span>
              <select
                value={selectedChannelId}
                onChange={e => setSelectedChannelId(e.target.value)}
                className="border border-stone-200 px-3 py-1.5 text-xs bg-white text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
              >
                <option value="all">All Channels</option>
                {channels.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setEditingRoomMapping({
                  channel_id: channels[1]?.id || 'chan-booking-com',
                  channel_code: channels[1]?.code || 'BOOKING_COM',
                  property_code: 'sbm-hotel',
                  pms_room_type_id: 'room-sbm-deluxe',
                  pms_room_type_name: 'Deluxe Room',
                  channel_room_id: '',
                  channel_room_name: '',
                  is_active: true,
                  sync_inventory: true
                });
                setShowRoomMappingModal(true);
              }}
              className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Map New Room</span>
            </button>
          </div>

          {/* Room Mappings Table */}
          <div className="bg-white border border-stone-200 overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-[#666666] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Channel</th>
                  <th className="p-3.5">Property</th>
                  <th className="p-3.5">PMS Room Category</th>
                  <th className="p-3.5">OTA Room Name / ID</th>
                  <th className="p-3.5">Sync Inventory</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {roomMappings
                  .filter(m => selectedChannelId === 'all' || m.channel_id === selectedChannelId || m.channel_code === selectedChannelId)
                  .map(mapping => (
                    <tr key={mapping.id} className="hover:bg-stone-50/60">
                      <td className="p-3.5 font-bold text-[#1A1A1A]">{mapping.channel_code}</td>
                      <td className="p-3.5 text-[#666666] uppercase font-semibold text-[11px]">{mapping.property_code}</td>
                      <td className="p-3.5">
                        <span className="font-semibold text-[#1A1A1A]">{mapping.pms_room_type_name}</span>
                        <div className="text-[10px] text-[#666666] font-mono">{mapping.pms_room_type_id}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-[#1A1A1A]">{mapping.channel_room_name}</span>
                        <div className="text-[10px] text-[#C5A059] font-mono font-bold">ID: {mapping.channel_room_id}</div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase ${
                            mapping.sync_inventory ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {mapping.sync_inventory ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase ${
                            mapping.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {mapping.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingRoomMapping(mapping);
                            setShowRoomMappingModal(true);
                          }}
                          className="text-[#666666] hover:text-[#1A1A1A] cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoomMapping(mapping.id)}
                          className="text-stone-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}

                {roomMappings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#666666]">
                      No room mappings defined yet. Click "Map New Room" to connect a PMS Room Type to an OTA channel room.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: RATE PLANS & MULTIPLIERS */}
      {subTab === 'rates' && (
        <div className="space-y-8">
          {/* PMS Rate Plans Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-serif font-medium text-[#1A1A1A]">Master PMS Rate Plans</h3>
                <p className="text-xs text-[#666666]">Base pricing models, meal plans, and cancellation policies.</p>
              </div>
              <button
                onClick={() => {
                  setEditingRatePlan({
                    property_code: 'sbm-hotel',
                    room_type_id: 'room-sbm-deluxe',
                    name: 'EP - Room Only Standard',
                    code: 'EP-STD',
                    meal_plan: 'EP',
                    cancellation_policy: 'FLEXIBLE',
                    price_modifier_type: 'PERCENTAGE',
                    price_modifier_value: 0,
                    is_active: true
                  });
                  setShowRatePlanModal(true);
                }}
                className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Add PMS Rate Plan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pmsRatePlans.map(plan => (
                <div key={plan.id} className="bg-white border border-stone-200 p-5 space-y-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono uppercase bg-stone-100 text-[#1A1A1A] px-2 py-0.5 font-bold">
                        {plan.code}
                      </span>
                      <h4 className="font-serif font-semibold text-sm text-[#1A1A1A] mt-1">{plan.name}</h4>
                    </div>
                    <span className="text-xs font-bold text-[#C5A059] bg-[#FAF8F5] px-2 py-1 border border-[#C5A059]/20">
                      {plan.meal_plan}
                    </span>
                  </div>

                  <div className="text-xs text-[#666666] space-y-1">
                    <div>Property: <strong className="text-[#1A1A1A]">{plan.property_code}</strong></div>
                    <div>Cancellation: <strong className="text-[#1A1A1A]">{plan.cancellation_policy}</strong></div>
                    <div>
                      Modifier:{' '}
                      <strong className="text-emerald-700">
                        {plan.price_modifier_value > 0 ? `+${plan.price_modifier_value}%` : 'Base Standard'}
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingRatePlan(plan);
                        setShowRatePlanModal(true);
                      }}
                      className="text-xs text-[#666666] hover:text-[#1A1A1A] font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRatePlan(plan.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Channel Rate Mappings Section */}
          <div className="space-y-4 pt-6 border-t border-stone-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-serif font-medium text-[#1A1A1A]">Channel Rate Mappings</h3>
                <p className="text-xs text-[#666666]">
                  Connect PMS master rate plans to external OTA rate codes with custom markups / multipliers.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingRateMapping({
                    channel_id: 'chan-booking-com',
                    channel_code: 'BOOKING_COM',
                    property_code: 'sbm-hotel',
                    pms_room_type_id: 'room-sbm-deluxe',
                    pms_rate_plan_id: pmsRatePlans[0]?.id || 'rate-sbm-deluxe-ep',
                    pms_rate_plan_name: pmsRatePlans[0]?.name || 'Standard Flexible EP',
                    channel_room_id: 'OTA-DLX-01',
                    channel_rate_plan_id: 'OTA-RATE-FLEX',
                    channel_rate_plan_name: 'Flexible Rate (Booking.com)',
                    price_multiplier: 1.15,
                    is_active: true
                  });
                  setShowRateMappingModal(true);
                }}
                className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Map Channel Rate</span>
              </button>
            </div>

            <div className="bg-white border border-stone-200 overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-[#666666] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-3.5">Channel</th>
                    <th className="p-3.5">PMS Rate Plan</th>
                    <th className="p-3.5">OTA Rate Code / Name</th>
                    <th className="p-3.5">Price Multiplier</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rateMappings.map(mapping => (
                    <tr key={mapping.id} className="hover:bg-stone-50/60">
                      <td className="p-3.5 font-bold text-[#1A1A1A]">{mapping.channel_code}</td>
                      <td className="p-3.5">
                        <span className="font-semibold text-[#1A1A1A]">{mapping.pms_rate_plan_name}</span>
                        <div className="text-[10px] text-[#666666] font-mono">{mapping.pms_rate_plan_id}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-[#1A1A1A]">{mapping.channel_rate_plan_name}</span>
                        <div className="text-[10px] text-[#C5A059] font-mono font-bold">Code: {mapping.channel_rate_plan_id}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-[#1A1A1A] bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5">
                          {mapping.price_multiplier}x
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase ${
                            mapping.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {mapping.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingRateMapping(mapping);
                            setShowRateMappingModal(true);
                          }}
                          className="text-[#666666] hover:text-[#1A1A1A] cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDeleteRateMapping(mapping.id)}
                          className="text-stone-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rateMappings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#666666]">
                        No channel rate mappings found. Click "Map Channel Rate" to set up OTA price rules.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: CENTRAL INVENTORY SOURCE OF TRUTH */}
      {subTab === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 p-4 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="text-sm font-serif font-medium text-[#1A1A1A]">
                PMS Master Availability Truth (Next 14 Days)
              </h3>
              <p className="text-xs text-[#666666]">
                Calculated directly from physical rooms, active PMS reservations, blocked rooms, and maintenance.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#666666]">Property:</span>
              <select
                value={selectedProperty}
                onChange={e => setSelectedProperty(e.target.value as any)}
                className="border border-stone-200 px-3 py-1.5 text-xs bg-white text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
              >
                <option value="all">Both Properties</option>
                <option value="sbm-hotel">SBM Hotel (Main)</option>
                <option value="sbm-guest-house">SBM Guest House</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-stone-200 overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-[#666666] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Property</th>
                  <th className="p-3">Room Type</th>
                  <th className="p-3 text-center">Total Physical</th>
                  <th className="p-3 text-center">Reserved</th>
                  <th className="p-3 text-center">Blocked / Maint</th>
                  <th className="p-3 text-center bg-emerald-50 text-emerald-900">Available to Channels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {inventorySummaries.map((item, idx) => (
                  <tr key={`${item.date}-${item.room_type_id}-${idx}`} className="hover:bg-stone-50/60">
                    <td className="p-3 font-mono font-medium text-[#1A1A1A]">{item.date}</td>
                    <td className="p-3 text-[#666666] uppercase font-semibold text-[11px]">{item.property_code}</td>
                    <td className="p-3 font-semibold text-[#1A1A1A]">{item.room_name}</td>
                    <td className="p-3 text-center font-bold text-stone-700">{item.total_physical_rooms}</td>
                    <td className="p-3 text-center font-bold text-blue-700">
                      {item.reserved_count > 0 ? item.reserved_count : '-'}
                    </td>
                    <td className="p-3 text-center font-bold text-amber-700">
                      {item.blocked_count + item.out_of_order_count > 0
                        ? item.blocked_count + item.out_of_order_count
                        : '-'}
                    </td>
                    <td className="p-3 text-center font-bold text-sm bg-emerald-50/40 text-emerald-800">
                      {item.available_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 5: SYNC QUEUE & AUDIT LOGS */}
      {subTab === 'logs' && (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 p-4 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[#666666] uppercase tracking-wider">Status:</span>
              <select
                value={logStatusFilter}
                onChange={e => setLogStatusFilter(e.target.value)}
                className="border border-stone-200 px-3 py-1.5 text-xs bg-white text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
              >
                <option value="all">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div className="text-xs text-[#666666]">
              Showing {syncJobs.filter(j => logStatusFilter === 'all' || j.status === logStatusFilter).length} recorded jobs
            </div>
          </div>

          <div className="bg-white border border-stone-200 overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-[#666666] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Job ID / Time</th>
                  <th className="p-3.5">Channel</th>
                  <th className="p-3.5">Operation</th>
                  <th className="p-3.5">Date Range</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5">Result / Error</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {syncJobs
                  .filter(j => logStatusFilter === 'all' || j.status === logStatusFilter)
                  .map(job => (
                    <tr key={job.id} className="hover:bg-stone-50/60">
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-[#1A1A1A]">{job.id}</span>
                        <div className="text-[10px] text-[#666666]">
                          {new Date(job.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold text-[#1A1A1A]">{job.channel_name}</td>
                      <td className="p-3.5">
                        <span className="bg-stone-100 text-[#1A1A1A] px-2 py-0.5 font-mono text-[10px] font-bold">
                          {job.operation}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-[#666666]">
                        {job.date_range.start} → {job.date_range.end}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            job.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : job.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {job.status}
                          {job.retry_count && job.retry_count > 0 ? ` (${job.retry_count}x)` : ''}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#666666] font-mono">
                        {job.duration_ms ? `${job.duration_ms}ms` : '-'}
                      </td>
                      <td className="p-3.5 max-w-xs">
                        {job.error_message ? (
                          <span className="text-rose-700 text-[11px] font-medium break-words">
                            {job.error_message}
                          </span>
                        ) : job.external_reference ? (
                          <span className="text-emerald-700 font-mono text-[11px]">
                            Ref: {job.external_reference}
                          </span>
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {job.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            disabled={actionLoading === `retry-${job.id}`}
                            className="text-xs font-bold text-[#C5A059] hover:text-[#1A1A1A] uppercase tracking-wider cursor-pointer"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 6: OTA WEBHOOK & IDEMPOTENCY SANDBOX */}
      {subTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#C5A059]/30 p-6 shadow-sm">
            <div className="max-w-2xl space-y-2 mb-6">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A059]">
                Developer Testing Sandbox
              </span>
              <h3 className="text-xl font-serif font-medium text-[#1A1A1A]">
                OTA Reservation Ingest & Idempotency Test
              </h3>
              <p className="text-xs text-[#666666] leading-relaxed">
                Test normalized inbound OTA payloads safely. Submitting with the same <strong>External Reservation ID</strong> verifies that the PMS performs an idempotent update without creating duplicate bookings.
              </p>
            </div>

            <form onSubmit={handleRunSimulator} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">OTA Channel</label>
                <select
                  value={simChannel}
                  onChange={e => setSimChannel(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A]"
                >
                  <option value="BOOKING_COM">Booking.com</option>
                  <option value="MAKEMYTRIP">MakeMyTrip</option>
                  <option value="GOIBIBO">Goibibo</option>
                  <option value="AGODA">Agoda</option>
                  <option value="EXPEDIA">Expedia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">
                  External Reservation ID (Idempotency Key)
                </label>
                <input
                  type="text"
                  required
                  value={simExtId}
                  onChange={e => setSimExtId(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs font-mono text-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Guest Full Name</label>
                <input
                  type="text"
                  required
                  value={simGuestName}
                  onChange={e => setSimGuestName(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Guest Phone</label>
                <input
                  type="text"
                  value={simGuestPhone}
                  onChange={e => setSimGuestPhone(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Property</label>
                <select
                  value={simProperty}
                  onChange={e => setSimProperty(e.target.value as PropertyCode)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A]"
                >
                  <option value="sbm-hotel">SBM Hotel (Main)</option>
                  <option value="sbm-guest-house">SBM Guest House</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">PMS Room Category</label>
                <select
                  value={simRoomType}
                  onChange={e => setSimRoomType(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A]"
                >
                  <option value="room-sbm-deluxe">Deluxe Room</option>
                  <option value="room-sbm-executive">Executive Suite</option>
                  <option value="room-sbm-family">Family Suite</option>
                  <option value="room-gh-deluxe">Guest House Deluxe</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Check-in Date</label>
                <input
                  type="date"
                  required
                  value={simCheckIn}
                  onChange={e => setSimCheckIn(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Check-out Date</label>
                <input
                  type="date"
                  required
                  value={simCheckOut}
                  onChange={e => setSimCheckOut(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Total Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={simAmount}
                  onChange={e => setSimAmount(Number(e.target.value))}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A]"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="simCancelCheck"
                  checked={simIsCancelled}
                  onChange={e => setSimIsCancelled(e.target.checked)}
                  className="w-4 h-4 text-[#C5A059]"
                />
                <label htmlFor="simCancelCheck" className="text-xs font-bold text-rose-700 cursor-pointer">
                  Simulate OTA Cancellation Event
                </label>
              </div>

              <div className="md:col-span-2 pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={actionLoading === 'simulator'}
                  className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Play className="w-4 h-4 text-[#C5A059]" />
                  <span>Send Ingest Test</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSimExtId(`OTA-BKG-${Math.floor(100000 + Math.random() * 900000)}`)}
                  className="bg-white border border-stone-200 text-[#1A1A1A] px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer"
                >
                  Generate New ID
                </button>
              </div>
            </form>

            {/* Test Execution Output */}
            {simResult && (
              <div className="mt-6 p-4 bg-[#1A1A1A] text-stone-200 text-xs font-mono rounded overflow-x-auto space-y-2">
                <div className="text-[#C5A059] font-bold">Simulator Response Payload:</div>
                <pre>{JSON.stringify(simResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: EDIT CHANNEL CONFIG */}
      {editingChannel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#C5A059]/30">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <h3 className="font-serif font-medium text-lg text-[#1A1A1A]">
                Configure {editingChannel.name}
              </h3>
              <button
                onClick={() => setEditingChannel(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">Rate Markup Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="2.5"
                  value={editingChannel.rateMultiplier || 1.0}
                  onChange={e =>
                    setEditingChannel({ ...editingChannel, rateMultiplier: Number(e.target.value) })
                  }
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                />
                <p className="text-[11px] text-[#666666] mt-1">
                  e.g., 1.15 adds a +15% pricing markup for bookings originated on this OTA channel.
                </p>
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">API Environment</label>
                <select
                  value={editingChannel.settings?.environment || 'sandbox'}
                  onChange={e =>
                    setEditingChannel({
                      ...editingChannel,
                      settings: { ...editingChannel.settings, environment: e.target.value as any }
                    })
                  }
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                >
                  <option value="sandbox">Sandbox / Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">Channel Hotel / Property ID</label>
                <input
                  type="text"
                  value={editingChannel.settings?.propertyId || ''}
                  onChange={e =>
                    setEditingChannel({
                      ...editingChannel,
                      settings: { ...editingChannel.settings, propertyId: e.target.value }
                    })
                  }
                  placeholder="e.g. BKG-984210"
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                />
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 text-[11px] text-[#666666]">
                🔒 <strong>Server Security:</strong> API keys, hotel partner tokens, and webhooks are securely isolated in backend environment variables and cannot be exposed to the client.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditingChannel(null)}
                className="px-4 py-2 text-xs font-semibold text-[#666666] hover:text-[#1A1A1A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateChannel(editingChannel.id, editingChannel)}
                className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ROOM MAPPING */}
      {showRoomMappingModal && editingRoomMapping && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveRoomMapping}
            className="bg-white max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#C5A059]/30"
          >
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <h3 className="font-serif font-medium text-lg text-[#1A1A1A]">
                {editingRoomMapping.id ? 'Edit Room Mapping' : 'Create Room Mapping'}
              </h3>
              <button
                type="button"
                onClick={() => setShowRoomMappingModal(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">Target Channel</label>
                <select
                  value={editingRoomMapping.channel_code}
                  onChange={e => {
                    const ch = channels.find(c => c.code === e.target.value);
                    setEditingRoomMapping({
                      ...editingRoomMapping,
                      channel_code: e.target.value as any,
                      channel_id: ch?.id || 'chan-booking-com'
                    });
                  }}
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                >
                  {channels.map(c => (
                    <option key={c.id} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">Property</label>
                <select
                  value={editingRoomMapping.property_code}
                  onChange={e =>
                    setEditingRoomMapping({
                      ...editingRoomMapping,
                      property_code: e.target.value as PropertyCode
                    })
                  }
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                >
                  <option value="sbm-hotel">SBM Hotel (Main)</option>
                  <option value="sbm-guest-house">SBM Guest House</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">PMS Room Category</label>
                <select
                  value={editingRoomMapping.pms_room_type_id}
                  onChange={e => {
                    const selName = e.target.options[e.target.selectedIndex].text;
                    setEditingRoomMapping({
                      ...editingRoomMapping,
                      pms_room_type_id: e.target.value,
                      pms_room_type_name: selName
                    });
                  }}
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                >
                  <option value="room-sbm-deluxe">Deluxe Room</option>
                  <option value="room-sbm-executive">Executive Suite</option>
                  <option value="room-sbm-family">Family Suite</option>
                  <option value="room-gh-deluxe">Guest House Deluxe</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">OTA Channel Room ID</label>
                <input
                  type="text"
                  required
                  value={editingRoomMapping.channel_room_id || ''}
                  onChange={e =>
                    setEditingRoomMapping({ ...editingRoomMapping, channel_room_id: e.target.value })
                  }
                  placeholder="e.g. BKG-DLX-99"
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A] font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">OTA Channel Room Display Name</label>
                <input
                  type="text"
                  required
                  value={editingRoomMapping.channel_room_name || ''}
                  onChange={e =>
                    setEditingRoomMapping({ ...editingRoomMapping, channel_room_name: e.target.value })
                  }
                  placeholder="e.g. Deluxe Double Room (Non-Smoking)"
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="syncInvCheck"
                  checked={editingRoomMapping.sync_inventory}
                  onChange={e =>
                    setEditingRoomMapping({ ...editingRoomMapping, sync_inventory: e.target.checked })
                  }
                  className="w-4 h-4 text-[#C5A059]"
                />
                <label htmlFor="syncInvCheck" className="font-medium text-[#1A1A1A] cursor-pointer">
                  Sync Real-Time Availability
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowRoomMappingModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#666666] hover:text-[#1A1A1A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Save Mapping
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: RATE PLAN */}
      {showRatePlanModal && editingRatePlan && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveRatePlan}
            className="bg-white max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#C5A059]/30"
          >
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <h3 className="font-serif font-medium text-lg text-[#1A1A1A]">
                {editingRatePlan.id ? 'Edit Rate Plan' : 'Create PMS Master Rate Plan'}
              </h3>
              <button
                type="button"
                onClick={() => setShowRatePlanModal(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">Rate Plan Name</label>
                <input
                  type="text"
                  required
                  value={editingRatePlan.name || ''}
                  onChange={e => setEditingRatePlan({ ...editingRatePlan, name: e.target.value })}
                  placeholder="e.g. CP - Bed & Breakfast Flexible"
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">Rate Code</label>
                <input
                  type="text"
                  required
                  value={editingRatePlan.code || ''}
                  onChange={e => setEditingRatePlan({ ...editingRatePlan, code: e.target.value })}
                  placeholder="e.g. CP-FLEX"
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A] font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1A1A1A] mb-1">Meal Plan</label>
                  <select
                    value={editingRatePlan.meal_plan}
                    onChange={e =>
                      setEditingRatePlan({ ...editingRatePlan, meal_plan: e.target.value as any })
                    }
                    className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                  >
                    <option value="EP">EP (Room Only)</option>
                    <option value="CP">CP (Breakfast Included)</option>
                    <option value="MAP">MAP (Breakfast + Dinner)</option>
                    <option value="AP">AP (All Meals)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[#1A1A1A] mb-1">Cancellation Policy</label>
                  <select
                    value={editingRatePlan.cancellation_policy}
                    onChange={e =>
                      setEditingRatePlan({
                        ...editingRatePlan,
                        cancellation_policy: e.target.value as any
                      })
                    }
                    className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                  >
                    <option value="FLEXIBLE">Flexible (24h)</option>
                    <option value="MODERATE">Moderate (48h)</option>
                    <option value="NON_REFUNDABLE">Non-Refundable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">Price Modifier (%)</label>
                <input
                  type="number"
                  value={editingRatePlan.price_modifier_value || 0}
                  onChange={e =>
                    setEditingRatePlan({ ...editingRatePlan, price_modifier_value: Number(e.target.value) })
                  }
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowRatePlanModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#666666] hover:text-[#1A1A1A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Save Rate Plan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: RATE MAPPING */}
      {showRateMappingModal && editingRateMapping && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveRateMapping}
            className="bg-white max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#C5A059]/30"
          >
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <h3 className="font-serif font-medium text-lg text-[#1A1A1A]">
                {editingRateMapping.id ? 'Edit Rate Mapping' : 'Create Channel Rate Mapping'}
              </h3>
              <button
                type="button"
                onClick={() => setShowRateMappingModal(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">Target Channel</label>
                <select
                  value={editingRateMapping.channel_code}
                  onChange={e => {
                    const ch = channels.find(c => c.code === e.target.value);
                    setEditingRateMapping({
                      ...editingRateMapping,
                      channel_code: e.target.value as any,
                      channel_id: ch?.id || 'chan-booking-com'
                    });
                  }}
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                >
                  {channels.map(c => (
                    <option key={c.id} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">PMS Master Rate Plan</label>
                <select
                  value={editingRateMapping.pms_rate_plan_id}
                  onChange={e => {
                    const selName = e.target.options[e.target.selectedIndex].text;
                    setEditingRateMapping({
                      ...editingRateMapping,
                      pms_rate_plan_id: e.target.value,
                      pms_rate_plan_name: selName
                    });
                  }}
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                >
                  {pmsRatePlans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">OTA Rate Plan ID</label>
                <input
                  type="text"
                  required
                  value={editingRateMapping.channel_rate_plan_id || ''}
                  onChange={e =>
                    setEditingRateMapping({ ...editingRateMapping, channel_rate_plan_id: e.target.value })
                  }
                  placeholder="e.g. OTA-RATE-FLEX"
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A] font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">OTA Rate Plan Display Name</label>
                <input
                  type="text"
                  required
                  value={editingRateMapping.channel_rate_plan_name || ''}
                  onChange={e =>
                    setEditingRateMapping({ ...editingRateMapping, channel_rate_plan_name: e.target.value })
                  }
                  placeholder="e.g. Flexible Room Only"
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#1A1A1A] mb-1">Price Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={editingRateMapping.price_multiplier || 1.0}
                  onChange={e =>
                    setEditingRateMapping({
                      ...editingRateMapping,
                      price_multiplier: Number(e.target.value)
                    })
                  }
                  className="w-full border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowRateMappingModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#666666] hover:text-[#1A1A1A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Save Rate Mapping
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
