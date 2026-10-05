import React, { useState } from 'react';
import {
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  Eye,
  Filter,
  X,
  Zap,
  Globe,
  RefreshCw,
  Info,
  Layers,
  Calendar
} from 'lucide-react';
import { api } from '../../lib/api';
import { SyncJob, ChannelConfig, SyncJobStatus, SyncOperation } from '../../types';

interface Props {
  syncJobs: SyncJob[];
  channels: ChannelConfig[];
  onJobRetried: () => void;
  onRefresh: () => void;
}

export const SyncCenterAndLogs: React.FC<Props> = ({
  syncJobs,
  channels,
  onJobRetried,
  onRefresh
}) => {
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<SyncJob | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter jobs
  const filteredJobs = syncJobs.filter(job => {
    if (channelFilter !== 'all' && job.channel_id !== channelFilter && job.channel_code !== channelFilter) return false;
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;
    if (operationFilter !== 'all' && job.operation !== operationFilter) return false;
    return true;
  });

  // Aggregate Metrics
  const totalCount = syncJobs.length;
  const completedCount = syncJobs.filter(j => j.status === 'COMPLETED').length;
  const pendingCount = syncJobs.filter(j => j.status === 'PENDING').length;
  const processingCount = syncJobs.filter(j => j.status === 'PROCESSING').length;
  const retryingCount = syncJobs.filter(j => j.status === 'RETRYING').length;
  const failedCount = syncJobs.filter(j => j.status === 'FAILED').length;

  const handleRetryJob = async (job: SyncJob) => {
    setRetryingJobId(job.id);
    setNotification(null);
    try {
      await api.channelManager.retrySyncJob(job.id);
      setNotification({ type: 'success', message: `Retried sync job for ${job.channel_name} (${job.operation}).` });
      onJobRetried();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Retry failed' });
    } finally {
      setRetryingJobId(null);
    }
  };

  const getStatusBadge = (status: SyncJobStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            COMPLETED
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700">
            <Clock className="w-3 h-3 text-stone-500" />
            PENDING
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 animate-pulse">
            <RotateCw className="w-3 h-3 text-blue-600 animate-spin" />
            PROCESSING
          </span>
        );
      case 'RETRYING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            <RotateCw className="w-3 h-3 text-amber-600" />
            RETRYING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 text-red-600" />
            FAILED
          </span>
        );
    }
  };

  const getOperationBadge = (op: SyncOperation) => {
    switch (op) {
      case 'AVAILABILITY_UPDATE':
      case 'INVENTORY_UPDATE':
        return <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-semibold text-[10px]">Inventory</span>;
      case 'RATE_UPDATE':
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">Rates</span>;
      case 'RESTRICTION_UPDATE':
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold text-[10px]">Restrictions</span>;
      case 'FULL_SYNC':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded text-[10px]">Full Sync</span>;
      case 'RESERVATION_IMPORT':
      case 'BOOKING_CREATE':
        return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold text-[10px]">Booking</span>;
      case 'BOOKING_MODIFY':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">Modification</span>;
      case 'BOOKING_CANCEL':
        return <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold text-[10px]">Cancellation</span>;
      default:
        return <span className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded text-[10px]">{op}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total Jobs</span>
          <span className="text-xl font-bold text-stone-900 font-mono mt-0.5 block">{totalCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Succeeded</span>
          <span className="text-xl font-bold text-emerald-800 font-mono mt-0.5 block">{completedCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Pending</span>
          <span className="text-xl font-bold text-stone-800 font-mono mt-0.5 block">{pendingCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Processing</span>
          <span className="text-xl font-bold text-blue-800 font-mono mt-0.5 block">{processingCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Retrying</span>
          <span className="text-xl font-bold text-amber-800 font-mono mt-0.5 block">{retryingCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-red-200 bg-red-50/20 shadow-xs">
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Failed</span>
          <span className="text-xl font-bold text-red-800 font-mono mt-0.5 block">{failedCount}</span>
        </div>
      </div>

      {notification && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="all">All Channels</option>
            {channels.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={operationFilter}
            onChange={e => setOperationFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="all">All Operations</option>
            <option value="AVAILABILITY_UPDATE">Inventory Updates</option>
            <option value="RATE_UPDATE">Rate Updates</option>
            <option value="RESTRICTION_UPDATE">Restrictions</option>
            <option value="FULL_SYNC">Full Synchronizations</option>
            <option value="RESERVATION_IMPORT">Inbound Bookings</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="RETRYING">Retrying</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Sync Jobs Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="p-3.5">Channel</th>
                <th className="p-3.5">Operation</th>
                <th className="p-3.5">Entity / Scope</th>
                <th className="p-3.5">Created</th>
                <th className="p-3.5">Duration</th>
                <th className="p-3.5">Attempts</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Outcome / Error</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-stone-400">
                    No sync jobs match the current filters.
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <tr key={job.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="p-3.5 font-bold text-stone-900">
                      {job.channel_name}
                      <span className="block text-[10px] text-stone-400 font-mono font-normal">{job.channel_code}</span>
                    </td>
                    <td className="p-3.5">
                      {getOperationBadge(job.operation)}
                    </td>
                    <td className="p-3.5 text-stone-700">
                      <div className="font-semibold">{job.room_name || 'All Rooms'}</div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        {job.date_range.start} ➔ {job.date_range.end}
                      </div>
                    </td>
                    <td className="p-3.5 text-stone-500 font-mono text-[11px]">
                      {new Date(job.created_at).toLocaleTimeString()}
                    </td>
                    <td className="p-3.5 text-stone-600 font-mono">
                      {job.duration_ms !== undefined ? `${job.duration_ms}ms` : '—'}
                    </td>
                    <td className="p-3.5 text-stone-700 font-mono">
                      {job.retry_count} / {job.max_retries}
                    </td>
                    <td className="p-3.5">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="p-3.5 max-w-xs truncate">
                      {job.status === 'COMPLETED' ? (
                        <span className="text-emerald-700 text-[11px] font-mono">
                          {job.external_reference || 'Ref: Success'}
                        </span>
                      ) : job.error_message ? (
                        <span className="text-red-700 text-[11px]" title={job.error_message}>
                          {job.error_message}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                      {(job.status === 'FAILED' || job.status === 'RETRYING') && (
                        <button
                          onClick={() => handleRetryJob(job)}
                          disabled={retryingJobId === job.id}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-semibold text-[11px] transition-colors"
                          title="Retry Job Immediately"
                        >
                          {retryingJobId === job.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedJobForDetails(job)}
                        className="px-2 py-1 text-stone-600 hover:text-stone-900 border border-stone-200 rounded hover:bg-stone-100 text-[11px] transition-colors"
                        title="View Technical Details"
                      >
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

      {/* Technical Details Modal */}
      {selectedJobForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">Sync Job Technical Details</h3>
              </div>
              <button
                onClick={() => setSelectedJobForDetails(null)}
                className="p-1 text-stone-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto font-mono text-xs">
              <div className="space-y-1.5 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                <div className="flex justify-between"><span className="text-stone-500">Job ID:</span><span className="font-bold text-stone-800">{selectedJobForDetails.id}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Channel:</span><span>{selectedJobForDetails.channel_name} ({selectedJobForDetails.channel_code})</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Operation:</span><span>{selectedJobForDetails.operation}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Date Range:</span><span>{selectedJobForDetails.date_range.start} ➔ {selectedJobForDetails.date_range.end}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Worker ID:</span><span>{selectedJobForDetails.worker_id || 'unassigned'}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Duration:</span><span>{selectedJobForDetails.duration_ms || 0}ms</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Retry Count:</span><span>{selectedJobForDetails.retry_count} / {selectedJobForDetails.max_retries}</span></div>
                {selectedJobForDetails.next_retry_at && (
                  <div className="flex justify-between"><span className="text-stone-500">Next Retry At:</span><span className="text-amber-700">{selectedJobForDetails.next_retry_at}</span></div>
                )}
              </div>

              {selectedJobForDetails.error_message && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 space-y-1">
                  <span className="font-bold block text-[11px] uppercase tracking-wider text-red-700">Error Payload:</span>
                  <p className="whitespace-pre-wrap">{selectedJobForDetails.error_message}</p>
                </div>
              )}

              {selectedJobForDetails.payload && (
                <div className="p-3.5 bg-stone-900 text-stone-200 rounded-xl space-y-1">
                  <span className="font-bold block text-[10px] text-stone-400 uppercase tracking-wider">Payload Metadata:</span>
                  <pre className="text-[11px] overflow-x-auto">{JSON.stringify(selectedJobForDetails.payload, null, 2)}</pre>
                </div>
              )}
            </div>

            <div className="bg-stone-50 border-t border-stone-200 p-4 flex justify-end">
              <button
                onClick={() => setSelectedJobForDetails(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-300 rounded-lg hover:bg-stone-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
