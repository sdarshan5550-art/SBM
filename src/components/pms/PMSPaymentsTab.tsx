import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  Search,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowDownRight,
  RefreshCw,
  Building
} from 'lucide-react';
import { api } from '../../lib/api';
import { PaymentRecord } from '../../types';

export const PMSPaymentsTab: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.pms.getAllPayments({
        method: filterMethod
      });
      setPayments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payments ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [filterMethod]);

  const filteredPayments = payments.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      p.id.toLowerCase().includes(q) ||
      (p.transaction_id && p.transaction_id.toLowerCase().includes(q)) ||
      (p.reservation_id && p.reservation_id.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q));
    return matchSearch;
  });

  const totalCollected = filteredPayments.reduce((sum, p) => sum + (p.status === 'PAID' ? Number(p.amount) : 0), 0);
  const cashCollected = filteredPayments.filter((p) => p.method === 'CASH').reduce((sum, p) => sum + Number(p.amount), 0);
  const upiCollected = filteredPayments.filter((p) => p.method === 'UPI').reduce((sum, p) => sum + Number(p.amount), 0);
  const onlineCollected = filteredPayments.filter((p) => p.method === 'ONLINE_RAZORPAY' || p.provider === 'RAZORPAY').reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#C5A059]/30 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
            Total Revenue Collected
          </span>
          <div className="text-2xl font-serif font-bold text-stone-900">
            ₹{totalCollected.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Across all verified payments
          </span>
        </div>

        <div className="bg-white border border-stone-200 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
            Cash Collected (Front Desk)
          </span>
          <div className="text-2xl font-serif font-bold text-emerald-800">
            ₹{cashCollected.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Direct desk currency receipts
          </span>
        </div>

        <div className="bg-white border border-stone-200 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
            UPI Payments
          </span>
          <div className="text-2xl font-serif font-bold text-sky-800">
            ₹{upiCollected.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            GPay / PhonePe desk QR
          </span>
        </div>

        <div className="bg-white border border-stone-200 p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block mb-1">
            Online (Razorpay Gateway)
          </span>
          <div className="text-2xl font-serif font-bold text-stone-900">
            ₹{onlineCollected.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Verified website bookings
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-stone-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search txn ID, reservation ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-stone-50 border border-stone-300 text-xs font-medium focus:ring-1 focus:ring-[#C5A059] focus:outline-none w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Method:</span>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="bg-stone-50 border border-stone-300 text-xs font-medium px-3 py-2 focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
            >
              <option value="all">All Payment Modes</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="ONLINE_RAZORPAY">Razorpay</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchPayments}
          className="p-2 border border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-400 transition"
          title="Refresh Ledger"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-stone-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-stone-900 text-white uppercase tracking-wider">
              <th className="p-3.5 font-semibold">Payment ID</th>
              <th className="p-3.5 font-semibold">Date & Time</th>
              <th className="p-3.5 font-semibold">Reservation ID</th>
              <th className="p-3.5 font-semibold">Method</th>
              <th className="p-3.5 font-semibold">Txn Reference</th>
              <th className="p-3.5 font-semibold">Amount</th>
              <th className="p-3.5 font-semibold">Status</th>
              <th className="p-3.5 font-semibold">Staff / Recorded By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-stone-500">
                  No payment records found matching the criteria.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => {
                const dateObj = new Date(p.paid_at);
                const dateStr = dateObj.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
                const timeStr = dateObj.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <tr key={p.id} className="hover:bg-stone-50/70 transition">
                    <td className="p-3.5 font-mono text-stone-600 font-medium">{p.id}</td>
                    <td className="p-3.5 text-stone-700">
                      <div>{dateStr}</div>
                      <div className="text-[10px] text-stone-400">{timeStr}</div>
                    </td>
                    <td className="p-3.5 font-mono text-[#C5A059] font-bold">
                      {p.reservation_id}
                    </td>
                    <td className="p-3.5">
                      <span className="bg-stone-100 text-stone-800 px-2 py-1 rounded text-[10px] font-bold uppercase">
                        {p.method}
                      </span>
                    </td>
                    <td className="p-3.5 text-stone-600 font-mono text-[11px]">
                      {p.transaction_id || p.payment_reference || 'N/A'}
                    </td>
                    <td className="p-3.5 font-serif font-bold text-sm text-stone-900">
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-stone-600 font-medium">
                      {p.recorded_by || 'Front Desk'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
