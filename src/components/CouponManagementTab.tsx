import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  AlertCircle,
  Calendar,
  DollarSign,
  Building,
  Filter,
  X,
  Tag,
  Check,
  Percent
} from 'lucide-react';
import { Coupon, CouponStatus, CouponUsage, RoomType } from '../types';
import { api } from '../lib/api';

interface CouponManagementTabProps {
  roomTypes: RoomType[];
}

export const CouponManagementTab: React.FC<CouponManagementTabProps> = ({ roomTypes }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [summary, setSummary] = useState({
    activeCount: 0,
    expiredCount: 0,
    totalUses: 0,
    totalDiscountGiven: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [usageCoupon, setUsageCoupon] = useState<Coupon | null>(null);
  const [couponUsageList, setCouponUsageList] = useState<CouponUsage[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState<number | ''>(10);
  const [formMinBooking, setFormMinBooking] = useState<number | ''>('');
  const [formMaxDiscount, setFormMaxDiscount] = useState<number | ''>('');
  const [formValidFrom, setFormValidFrom] = useState('');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState<number | ''>('');
  const [formPerCustomerLimit, setFormPerCustomerLimit] = useState<number | ''>(1);
  const [formApplicableRooms, setFormApplicableRooms] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState<CouponStatus>('active');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminCoupons();
      setCoupons(res.coupons || []);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load coupon records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    const now = new Date();
    const future = new Date(Date.now() + 30 * 86400000);
    setEditingCoupon(null);
    setFormCode('');
    setFormDiscountType('percentage');
    setFormDiscountValue(10);
    setFormMinBooking('');
    setFormMaxDiscount('');
    setFormValidFrom(now.toISOString().slice(0, 16));
    setFormValidUntil(future.toISOString().slice(0, 16));
    setFormUsageLimit('');
    setFormPerCustomerLimit(1);
    setFormApplicableRooms([]);
    setFormStatus('active');
    setFormError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (cpn: Coupon) => {
    setEditingCoupon(cpn);
    setFormCode(cpn.code);
    setFormDiscountType(cpn.discount_type);
    setFormDiscountValue(cpn.discount_value);
    setFormMinBooking(cpn.minimum_booking_amount || '');
    setFormMaxDiscount(cpn.maximum_discount || '');
    setFormValidFrom(cpn.valid_from ? new Date(cpn.valid_from).toISOString().slice(0, 16) : '');
    setFormValidUntil(cpn.valid_until ? new Date(cpn.valid_until).toISOString().slice(0, 16) : '');
    setFormUsageLimit(cpn.usage_limit || '');
    setFormPerCustomerLimit(cpn.per_customer_limit !== undefined && cpn.per_customer_limit !== null ? cpn.per_customer_limit : 1);
    setFormApplicableRooms(cpn.applicable_rooms || []);
    setFormStatus(cpn.status);
    setFormError(null);
    setShowCreateModal(true);
  };

  const openUsageModal = async (cpn: Coupon) => {
    setUsageCoupon(cpn);
    setLoadingUsage(true);
    try {
      const list = await api.getAdminCouponUsage(cpn.id);
      setCouponUsageList(list || []);
    } catch (err: any) {
      console.error('Error loading coupon usage:', err);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const normCode = formCode.trim().toUpperCase();
    if (!normCode) {
      setFormError('Coupon Code is required.');
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(normCode)) {
      setFormError('Coupon Code can only contain uppercase letters, numbers, underscores, and hyphens.');
      return;
    }

    const val = Number(formDiscountValue);
    if (!val || val <= 0) {
      setFormError('Discount Value must be greater than 0.');
      return;
    }
    if (formDiscountType === 'percentage' && val > 100) {
      setFormError('Percentage discount cannot exceed 100%.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<Coupon> = {
        code: normCode,
        discount_type: formDiscountType,
        discount_value: val,
        minimum_booking_amount: formMinBooking !== '' ? Number(formMinBooking) : 0,
        maximum_discount: formMaxDiscount !== '' ? Number(formMaxDiscount) : undefined,
        valid_from: formValidFrom ? new Date(formValidFrom).toISOString() : undefined,
        valid_until: formValidUntil ? new Date(formValidUntil).toISOString() : undefined,
        usage_limit: formUsageLimit !== '' ? Number(formUsageLimit) : null,
        per_customer_limit: formPerCustomerLimit !== '' ? Number(formPerCustomerLimit) : null,
        applicable_rooms: formApplicableRooms,
        status: formStatus
      };

      if (editingCoupon) {
        await api.updateAdminCoupon(editingCoupon.id, payload);
        setSuccessMsg(`Coupon '${normCode}' updated successfully!`);
      } else {
        await api.createAdminCoupon(payload);
        setSuccessMsg(`Coupon '${normCode}' created successfully!`);
      }

      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save coupon.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (cpn: Coupon) => {
    const nextStatus: CouponStatus = cpn.status === 'active' ? 'inactive' : 'active';
    try {
      await api.toggleAdminCouponStatus(cpn.id, nextStatus);
      setSuccessMsg(`Coupon '${cpn.code}' set to ${nextStatus.toUpperCase()}.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteAdminCoupon(deleteTarget.id);
      setSuccessMsg(`Coupon '${deleteTarget.code}' deleted successfully.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete coupon.');
    }
  };

  const handleToggleRoomSelection = (roomId: string) => {
    if (roomId === 'all') {
      setFormApplicableRooms([]);
      return;
    }
    if (formApplicableRooms.includes(roomId)) {
      setFormApplicableRooms(formApplicableRooms.filter(r => r !== roomId));
    } else {
      setFormApplicableRooms([...formApplicableRooms, roomId]);
    }
  };

  // Filtered Coupon List
  const filteredCoupons = coupons.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || c.code.toLowerCase().includes(q) || c.discount_type.toLowerCase().includes(q);

    const now = new Date();
    const isExpired = Boolean(c.valid_until && new Date(c.valid_until) < now);

    if (statusFilter === 'active') {
      return matchesQuery && c.status === 'active' && !isExpired;
    }
    if (statusFilter === 'inactive') {
      return matchesQuery && c.status === 'inactive';
    }
    if (statusFilter === 'expired') {
      return matchesQuery && isExpired;
    }
    return matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#C5A059]/20 p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#C5A059]" />
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">
              SBM Hotel Coupon Management
            </h3>
          </div>
          <p className="text-xs text-[#666666] mt-1">
            Create and manage promotional discount codes for direct SBM website bookings.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold px-4 py-2.5 text-xs tracking-wider uppercase transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4 text-[#C5A059]" />
          Create Coupon
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 text-xs cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] block">Active Coupons</span>
          <div className="text-2xl font-serif font-bold text-emerald-700">{summary.activeCount}</div>
          <span className="text-[10px] text-stone-500 block">Ready for guest checkout</span>
        </div>

        <div className="bg-white border border-stone-200 p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] block">Expired Coupons</span>
          <div className="text-2xl font-serif font-bold text-amber-600">{summary.expiredCount}</div>
          <span className="text-[10px] text-stone-500 block">Past valid date range</span>
        </div>

        <div className="bg-white border border-stone-200 p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] block">Total Uses</span>
          <div className="text-2xl font-serif font-bold text-[#1A1A1A]">{summary.totalUses}</div>
          <span className="text-[10px] text-stone-500 block">Successful redeemed bookings</span>
        </div>

        <div className="bg-white border border-stone-200 p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666666] block">Total Discount Given</span>
          <div className="text-2xl font-serif font-bold text-[#C5A059]">₹{summary.totalDiscountGiven.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-stone-500 block">Saved by direct website guests</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-stone-200 p-4 flex flex-col sm:flex-row gap-3 justify-between items-center text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search coupon code..."
            className="w-full bg-[#FDFCFB] border border-stone-200 pl-9 pr-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-stone-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059] cursor-pointer"
          >
            <option value="all">All Statuses ({coupons.length})</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="expired">Expired Only</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition-colors cursor-pointer"
            title="Refresh coupons"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-white border border-stone-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-stone-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#C5A059]" />
            Loading coupon catalog...
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-8 text-center text-stone-500 text-xs space-y-2">
            <Ticket className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="font-medium text-stone-700">No coupon codes found.</p>
            <p className="text-[11px]">Click "Create Coupon" above to generate your first promotional code.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1A1A1A] text-white border-b border-stone-200 text-[11px] uppercase tracking-wider font-serif">
                  <th className="p-3 font-semibold">Code</th>
                  <th className="p-3 font-semibold">Discount</th>
                  <th className="p-3 font-semibold">Min Booking</th>
                  <th className="p-3 font-semibold">Validity</th>
                  <th className="p-3 font-semibold">Usage</th>
                  <th className="p-3 font-semibold">Applicable Rooms</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-[#1A1A1A]">
                {filteredCoupons.map((cpn) => {
                  const now = new Date();
                  const isExpired = Boolean(cpn.valid_until && new Date(cpn.valid_until) < now);

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200 rounded-2xs uppercase">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                    </span>
                  );

                  if (cpn.status === 'inactive') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5 border border-stone-300 rounded-2xs uppercase">
                        <XCircle className="w-3 h-3 text-stone-400" /> Inactive
                      </span>
                    );
                  } else if (isExpired) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-300 rounded-2xs uppercase">
                        <AlertCircle className="w-3 h-3 text-amber-600" /> Expired
                      </span>
                    );
                  }

                  const roomDisplay = (!cpn.applicable_rooms || cpn.applicable_rooms.length === 0)
                    ? 'All Rooms'
                    : cpn.applicable_rooms.map(id => {
                        const r = roomTypes.find(rt => rt.id === id || rt.room_code === id);
                        return r ? r.name : id;
                      }).join(', ');

                  return (
                    <tr key={cpn.id} className="hover:bg-[#FDFCFB] transition-colors">
                      <td className="p-3 font-mono font-bold text-sm text-[#1A1A1A]">
                        {cpn.code}
                      </td>
                      <td className="p-3 font-semibold text-[#C5A059]">
                        {cpn.discount_type === 'percentage' ? (
                          <span>{cpn.discount_value}% OFF {cpn.maximum_discount ? `(Max ₹${cpn.maximum_discount})` : ''}</span>
                        ) : (
                          <span>₹{cpn.discount_value.toLocaleString('en-IN')} OFF</span>
                        )}
                      </td>
                      <td className="p-3 text-stone-600">
                        {cpn.minimum_booking_amount && cpn.minimum_booking_amount > 0 ? (
                          <span>₹{cpn.minimum_booking_amount.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-stone-400">None</span>
                        )}
                      </td>
                      <td className="p-3 text-stone-600 text-[11px] whitespace-nowrap">
                        {cpn.valid_from || cpn.valid_until ? (
                          <div>
                            <div>From: {cpn.valid_from ? new Date(cpn.valid_from).toLocaleDateString('en-IN') : 'Any'}</div>
                            <div>Until: {cpn.valid_until ? new Date(cpn.valid_until).toLocaleDateString('en-IN') : 'Unlimited'}</div>
                          </div>
                        ) : (
                          <span className="text-stone-400">Always Valid</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-[#1A1A1A]">{cpn.used_count || 0}</span>
                        <span className="text-stone-500"> / {cpn.usage_limit ? cpn.usage_limit : '∞'}</span>
                        <span className="block text-[10px] text-stone-400">({cpn.per_customer_limit || 1} per guest)</span>
                      </td>
                      <td className="p-3 text-stone-600 max-w-xs truncate" title={roomDisplay}>
                        {roomDisplay}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {statusBadge}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Active Switch */}
                          <button
                            onClick={() => handleToggleStatus(cpn)}
                            className={`px-2 py-1 text-[10px] font-bold border uppercase transition cursor-pointer ${
                              cpn.status === 'active'
                                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                            title={cpn.status === 'active' ? 'Deactivate coupon' : 'Activate coupon'}
                          >
                            {cpn.status === 'active' ? 'Disable' : 'Enable'}
                          </button>

                          {/* View Usage */}
                          <button
                            onClick={() => openUsageModal(cpn)}
                            className="p-1.5 border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition cursor-pointer"
                            title="View usage history"
                          >
                            <Eye className="w-3.5 h-3.5 text-sky-600" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(cpn)}
                            className="p-1.5 border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition cursor-pointer"
                            title="Edit coupon details"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#C5A059]" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(cpn)}
                            className="p-1.5 border border-stone-200 bg-white hover:bg-stone-50 text-rose-600 transition cursor-pointer"
                            title="Delete coupon"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT COUPON MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#C5A059]/30 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl my-auto">
            <div className="bg-[#1A1A1A] text-white p-4 border-b border-[#C5A059] flex justify-between items-center">
              <h4 className="font-serif font-bold text-sm tracking-wide">
                {editingCoupon ? `Edit Coupon — ${editingCoupon.code}` : 'Create New Coupon'}
              </h4>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="p-5 space-y-4 overflow-y-auto text-xs text-[#1A1A1A]">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Coupon Code */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Coupon Code <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SBM10, WELCOME500"
                  className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 font-mono uppercase font-bold text-sm text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  Uppercase letters, numbers, hyphens and underscores only. Automatically normalized to uppercase.
                </p>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Discount Type <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formDiscountType}
                    onChange={(e: any) => setFormDiscountType(e.target.value)}
                    className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059] cursor-pointer font-medium"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Discount Value <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={0.01}
                      max={formDiscountType === 'percentage' ? 100 : 100000}
                      step="any"
                      value={formDiscountValue}
                      onChange={(e) => setFormDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={formDiscountType === 'percentage' ? '10' : '500'}
                      className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 font-bold text-sm text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-stone-400">
                      {formDiscountType === 'percentage' ? '%' : '₹'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Min Booking & Max Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Minimum Booking Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formMinBooking}
                    onChange={(e) => setFormMinBooking(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 1000 (Optional)"
                    className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                  />
                  <p className="text-[10px] text-stone-400 mt-0.5">Subtotal threshold required to apply coupon.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Maximum Discount Limit (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 500 (Optional for %)"
                    className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                  />
                  <p className="text-[10px] text-stone-400 mt-0.5">Caps maximum savings amount for percentage discounts.</p>
                </div>
              </div>

              {/* Valid From & Valid Until */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Valid From
                  </label>
                  <input
                    type="datetime-local"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="datetime-local"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Total Usage Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formUsageLimit}
                    onChange={(e) => setFormUsageLimit(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 100 (Leave empty for unlimited)"
                    className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Usage Limit Per Customer
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formPerCustomerLimit}
                    onChange={(e) => setFormPerCustomerLimit(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Default 1"
                    className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                  />
                  <p className="text-[10px] text-stone-400 mt-0.5">Prevents same guest email/phone from repeated reuse.</p>
                </div>
              </div>

              {/* Applicable Rooms */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Applicable Rooms
                </label>
                <div className="bg-[#FDFCFB] border border-stone-200 p-3 space-y-2 rounded-2xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={formApplicableRooms.length === 0}
                      onChange={() => handleToggleRoomSelection('all')}
                      className="accent-[#C5A059]"
                    />
                    <span>All Rooms & Categories</span>
                  </label>
                  {roomTypes.map(rt => (
                    <label key={rt.id} className="flex items-center gap-2 cursor-pointer text-xs ml-4">
                      <input
                        type="checkbox"
                        checked={formApplicableRooms.includes(rt.id)}
                        onChange={() => handleToggleRoomSelection(rt.id)}
                        className="accent-[#C5A059]"
                      />
                      <span>{rt.name} ({rt.property_code === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel'})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e: any) => setFormStatus(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059] cursor-pointer font-bold"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-stone-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-stone-200 bg-white hover:bg-stone-50 font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Confirm Coupon Deletion</span>
            </div>
            <p className="text-stone-700">
              Are you sure you want to delete coupon <strong className="font-mono text-sm font-bold">{deleteTarget.code}</strong>?
            </p>
            <p className="text-stone-500 text-[11px] bg-stone-50 p-2.5 border border-stone-200">
              Note: Deleting this coupon will remove it from future guest availability. Historical booking records and analytics will remain preserved.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-stone-200 bg-white hover:bg-stone-50 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Yes, Delete Coupon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USAGE HISTORY MODAL */}
      {usageCoupon && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#C5A059]/30 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl my-auto">
            <div className="bg-[#1A1A1A] text-white p-4 border-b border-[#C5A059] flex justify-between items-center">
              <div>
                <h4 className="font-serif font-bold text-sm tracking-wide">
                  Coupon Usage History — {usageCoupon.code}
                </h4>
                <p className="text-[11px] text-[#C5A059]">Total Redemptions: {usageCoupon.used_count || 0}</p>
              </div>
              <button
                onClick={() => setUsageCoupon(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 min-h-0 text-xs">
              {loadingUsage ? (
                <div className="p-6 text-center text-stone-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-[#C5A059]" />
                  Loading redemption records...
                </div>
              ) : couponUsageList.length === 0 ? (
                <div className="p-6 text-center text-stone-500">
                  No redemptions recorded for this coupon code yet.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 uppercase font-serif text-[10px] tracking-wider border-b border-stone-200">
                      <th className="p-2.5">Booking #</th>
                      <th className="p-2.5">Guest Email / Phone</th>
                      <th className="p-2.5">Discount Given</th>
                      <th className="p-2.5">Redeemed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-[#1A1A1A]">
                    {couponUsageList.map((u) => (
                      <tr key={u.id} className="hover:bg-[#FDFCFB]">
                        <td className="p-2.5 font-mono font-bold">{u.booking_number || u.booking_id}</td>
                        <td className="p-2.5 text-stone-600">
                          <div>{u.guest_email || 'N/A'}</div>
                          <div className="text-[10px] text-stone-400">{u.guest_phone || ''}</div>
                        </td>
                        <td className="p-2.5 font-bold text-emerald-700">₹{u.discount_amount.toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-stone-500 text-[11px]">{new Date(u.used_at).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setUsageCoupon(null)}
                className="px-4 py-2 bg-[#1A1A1A] text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
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
