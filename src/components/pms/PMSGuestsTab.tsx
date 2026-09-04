import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Plus,
  RefreshCw,
  Edit2,
  CheckCircle2,
  FileText,
  UserCheck
} from 'lucide-react';
import { api } from '../../lib/api';
import { Guest } from '../../types';

interface PMSGuestsTabProps {
  onOpenNewBookingForGuest?: (guest: Guest) => void;
}

export const PMSGuestsTab: React.FC<PMSGuestsTabProps> = ({ onOpenNewBookingForGuest }) => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Edit Guest Modal
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [savingGuest, setSavingGuest] = useState(false);

  const fetchGuests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.pms.getGuests(searchQuery);
      setGuests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load guest directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGuests();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleUpdateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuest) return;
    setSavingGuest(true);
    try {
      await api.pms.updateGuest(editingGuest.id, editingGuest);
      setEditingGuest(null);
      fetchGuests();
    } catch (err: any) {
      alert(err.message || 'Failed to update guest profile');
    } finally {
      setSavingGuest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Search Bar */}
      <div className="bg-white border border-stone-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, phone number, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-300 text-xs font-medium focus:ring-1 focus:ring-[#C5A059] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-500 font-medium">
            Total Profiles: <strong>{guests.length}</strong>
          </span>
          <button
            onClick={fetchGuests}
            className="p-2 border border-stone-300 text-stone-600 hover:text-stone-900 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Guest Directory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {guests.map((g) => (
          <div
            key={g.id}
            className="bg-white border border-[#C5A059]/20 p-5 shadow-sm hover:border-[#C5A059]/50 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-900">
                    {g.full_name}
                  </h3>
                  <span className="text-[10px] text-stone-400 font-mono">ID: {g.id}</span>
                </div>
                <button
                  onClick={() => setEditingGuest(g)}
                  className="p-1.5 text-stone-400 hover:text-[#C5A059] transition"
                  title="Edit Guest Profile"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 text-xs text-stone-600 mb-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span className="font-medium text-stone-800">{g.phone}</span>
                </div>
                {g.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    <span className="truncate">{g.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-stone-400" />
                  <span>
                    {g.id_type || 'ID'}: <strong>{g.id_number || 'Not recorded'}</strong>
                  </span>
                </div>
                {g.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span className="truncate">{g.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Stay Stats & Action */}
            <div className="border-t border-stone-100 pt-3 flex items-center justify-between text-xs">
              <div>
                <span className="text-stone-400 text-[10px] uppercase font-bold block">Total Stays</span>
                <span className="font-serif font-bold text-stone-900">{g.total_bookings || 1}</span>
              </div>
              <div>
                <span className="text-stone-400 text-[10px] uppercase font-bold block">Total Spend</span>
                <span className="font-serif font-bold text-emerald-800">
                  ₹{(g.total_spent || 0).toLocaleString('en-IN')}
                </span>
              </div>
              {onOpenNewBookingForGuest && (
                <button
                  onClick={() => onOpenNewBookingForGuest(g)}
                  className="bg-[#C5A059] hover:bg-[#B38F48] text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition"
                >
                  Book Stay
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Guest Profile Modal */}
      {editingGuest && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full border border-[#C5A059]/40 shadow-2xl p-6 relative">
            <h3 className="font-serif font-bold text-lg text-stone-900 mb-4">
              Edit Guest Information
            </h3>

            <form onSubmit={handleUpdateGuest} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingGuest.full_name}
                  onChange={(e) => setEditingGuest({ ...editingGuest, full_name: e.target.value })}
                  className="w-full bg-white border border-stone-300 p-2 font-medium"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editingGuest.phone}
                  onChange={(e) => setEditingGuest({ ...editingGuest, phone: e.target.value })}
                  className="w-full bg-white border border-stone-300 p-2 font-medium"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">Email</label>
                <input
                  type="email"
                  value={editingGuest.email || ''}
                  onChange={(e) => setEditingGuest({ ...editingGuest, email: e.target.value })}
                  className="w-full bg-white border border-stone-300 p-2 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 uppercase block mb-1">ID Type</label>
                  <select
                    value={editingGuest.id_type || 'Aadhaar'}
                    onChange={(e) => setEditingGuest({ ...editingGuest, id_type: e.target.value })}
                    className="w-full bg-white border border-stone-300 p-2"
                  >
                    <option value="Aadhaar">Aadhaar</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">DL</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-stone-700 uppercase block mb-1">ID Number</label>
                  <input
                    type="text"
                    value={editingGuest.id_number || ''}
                    onChange={(e) => setEditingGuest({ ...editingGuest, id_number: e.target.value })}
                    className="w-full bg-white border border-stone-300 p-2 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">Address</label>
                <textarea
                  value={editingGuest.address || ''}
                  onChange={(e) => setEditingGuest({ ...editingGuest, address: e.target.value })}
                  className="w-full bg-white border border-stone-300 p-2 font-medium h-16"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingGuest(null)}
                  className="bg-stone-200 text-stone-700 px-3 py-1.5 font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGuest}
                  className="bg-[#C5A059] text-white px-4 py-1.5 font-bold uppercase tracking-wider hover:bg-[#B38F48]"
                >
                  {savingGuest ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
