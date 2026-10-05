import React, { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  Filter,
  RefreshCw,
  User,
  Shield,
  Layers,
  DollarSign,
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import { api } from '../../lib/api';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.channelManager.getAuditLogs({
        action: actionFilter === 'all' ? undefined : actionFilter,
        limit: 100
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      log.description?.toLowerCase().includes(q) ||
      log.performedBy?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.propertyCode?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search audit trail by description, admin user, or action..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium text-stone-700"
          >
            <option value="all">All Actions</option>
            <option value="Status Update">Settings & Channel Status</option>
            <option value="Booking">Bookings & Reservations</option>
            <option value="Cancellation">Cancellations</option>
            <option value="Check-In">Check-ins</option>
          </select>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">User / Initiator</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Property</th>
                <th className="p-3.5">Event Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-400">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-600" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-400">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="p-3.5 font-mono text-stone-500 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-semibold text-stone-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      {log.performedBy || 'System'}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded font-semibold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-stone-600 capitalize">
                      {log.propertyCode ? log.propertyCode.replace('-', ' ') : 'Global'}
                    </td>
                    <td className="p-3.5 text-stone-800">
                      {log.description}
                    </td>
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
