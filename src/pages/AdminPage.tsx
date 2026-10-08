import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  LogOut,
  Calendar,
  Users,
  DollarSign,
  BedDouble,
  Building,
  Mail,
  Sliders,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  AlertTriangle,
  Lock,
  Eye,
  Edit3,
  LayoutGrid,
  Bot,
  Image as ImageIcon,
  CreditCard,
  BarChart3,
  TrendingUp,
  Table,
  Globe,
  Instagram,
  Facebook,
  ExternalLink,
  RotateCcw,
  Ticket
} from 'lucide-react';
import { api, getAdminToken, setAdminToken, clearAdminToken } from '../lib/api';
import { Booking, Property, RoomType, BlockedRoom, Inquiry, HotelSettings } from '../types';
import { FrontDeskDashboard } from './FrontDeskDashboard';
import { KnowledgeBaseAdmin } from '../components/KnowledgeBaseAdmin';
import { RoomManagementTab } from '../components/RoomManagementTab';  
import { ImageManagementTab } from '../components/ImageManagementTab';
import { ChannelManagerTab } from '../components/ChannelManagerTab';
import { CouponManagementTab } from '../components/CouponManagementTab';
import { PMSCalendarView } from '../components/pms/PMSCalendarView';
import { PMSPaymentsTab } from '../components/pms/PMSPaymentsTab';
import { PMSGuestsTab } from '../components/pms/PMSGuestsTab';
import { PMSReportsTab } from '../components/pms/PMSReportsTab';
import { NewPMSReservationModal } from '../components/pms/NewPMSReservationModal';

interface AdminPageProps {
  onOpenBookingModal?: (prefill?: any) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onOpenBookingModal }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUser, setAdminUser] = useState<any>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('frontdesk@sbmhotel.com');
  const [loginPassword, setLoginPassword] = useState('sbmdesk2026!');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Forgot Password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMsg, setForgotMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotMsg({ type: 'error', text: 'Please enter your admin email address.' });
      return;
    }
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      const res = await api.adminForgotPassword(forgotEmail.trim());
      setForgotMsg({ type: 'success', text: res.message || 'OTP has been dispatched to manager@sbmhotel.com.' });
      setForgotStep(2);
    } catch (err: any) {
      setForgotMsg({ type: 'error', text: err.message || 'Failed to send OTP.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotOtp.trim() || !newPassword.trim()) {
      setForgotMsg({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }
    if (newPassword.length < 6) {
      setForgotMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      const res = await api.adminResetPassword({
        email: forgotEmail.trim(),
        otp: forgotOtp.trim(),
        newPassword: newPassword.trim()
      });
      setForgotMsg({ type: 'success', text: res.message || 'Password reset successfully! You can now log in.' });
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotStep(1);
        setLoginEmail(forgotEmail.trim());
        setLoginPassword('');
        setForgotMsg(null);
      }, 2000);
    } catch (err: any) {
      setForgotMsg({ type: 'error', text: err.message || 'Failed to reset password.' });
    } finally {
      setForgotLoading(false);
    }
  };
  const [activeTab, setActiveTab] = useState<
    | 'frontdesk'
    | 'tapechart'
    | 'overview'
    | 'bookings'
    | 'payments'
    | 'guests'
    | 'reports'
    | 'channels'
    | 'inventory'
    | 'rooms'
    | 'images'
    | 'calendar'
    | 'properties'
    | 'inquiries'
    | 'knowledge'
    | 'coupons'
    | 'settings'
  >('frontdesk');

  // PMS Walk-in Modal State
  const [showPMSModal, setShowPMSModal] = useState(false);
  const [pmsModalPrefill, setPmsModalPrefill] = useState<any>(null);

  // Overview Data
  const [overview, setOverview] = useState<any>(null);

  // Bookings Data & Filters
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filterProp, setFilterProp] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Room Inventory
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);

  // Blocked Rooms
  const [blockedRooms, setBlockedRooms] = useState<BlockedRoom[]>([]);
  const [newBlockProp, setNewBlockProp] = useState('sbm-hotel');
  const [newBlockRoomId, setNewBlockRoomId] = useState('');
  const [newBlockStart, setNewBlockStart] = useState('');
  const [newBlockEnd, setNewBlockEnd] = useState('');
  const [newBlockQty, setNewBlockQty] = useState(1);
  const [newBlockReason, setNewBlockReason] = useState('Maintenance / Maintenance hold');

  // Inquiries
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  // Settings
  const [settings, setSettings] = useState<HotelSettings | null>(null);
  const [initialSocialSettings, setInitialSocialSettings] = useState<any>(null);
  const [savingSocialMedia, setSavingSocialMedia] = useState(false);
  const [socialMediaSuccessMsg, setSocialMediaSuccessMsg] = useState<string | null>(null);

  // Email Notification Diagnostics & Test
  const [emailStatus, setEmailStatus] = useState<{
    is_configured: boolean;
    host: string | null;
    port: number;
    from: string;
    admin_email: string;
    has_user: boolean;
    has_password: boolean;
  } | null>(null);
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  // Check Token on load
  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      api.adminVerifyToken()
        .then((res) => {
          setIsAuthenticated(true);
          setAdminUser(res.admin);
          loadAdminData();
        })
        .catch(() => {
          clearAdminToken();
          setIsAuthenticated(false);
        });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);

    try {
      const res = await api.adminLogin(loginEmail, loginPassword);
      setAdminToken(res.token);
      setAdminUser(res.admin);
      setIsAuthenticated(true);
      loadAdminData();
    } catch (err: any) {
      setLoginError(err.message || 'Invalid login credentials.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
    setAdminUser(null);
  };

  const loadAdminData = () => {
    api.getAdminOverview().then(setOverview).catch(console.error);
    api.getAdminBookings().then(setBookings).catch(console.error);
    api.getProperties().then(setProperties).catch(console.error);
    api.getRoomTypes().then(setRoomTypes).catch(console.error);
    api.getBlockedRooms().then(setBlockedRooms).catch(console.error);
    api.getAdminInquiries().then(setInquiries).catch(console.error);
    api.getAdminSettings().then((s) => {
      setSettings(s);
      if (s?.social_media) {
        setInitialSocialSettings(JSON.parse(JSON.stringify(s.social_media)));
      }
    }).catch(console.error);
    api.email.getStatus().then(setEmailStatus).catch(console.error);
  };

  const refreshBookings = () => {
    api.getAdminBookings({
      propertyCode: filterProp,
      bookingStatus: filterStatus,
      search: searchQuery
    }).then(setBookings).catch(console.error);
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshBookings();
    }
  }, [filterProp, filterStatus, searchQuery, isAuthenticated]);

  // Export Bookings to CSV
  const exportCSV = () => {
    if (bookings.length === 0) return;
    const headers = ['Booking Number', 'Guest Name', 'Phone', 'Property', 'Room', 'Check In', 'Check Out', 'Nights', 'Total Amount', 'Status', 'Payment'];
    const rows = bookings.map(b => [
      b.booking_number,
      `"${b.guest_name}"`,
      b.guest_phone,
      `"${b.property_name}"`,
      `"${b.room_name}"`,
      b.check_in,
      b.check_out,
      b.nights,
      b.total_amount,
      b.booking_status,
      b.payment_status
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SBM_Bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create Room Block
  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockRoomId || !newBlockStart || !newBlockEnd) return;
    try {
      const selectedRoom = roomTypes.find(r => r.id === newBlockRoomId);
      await api.createBlockedRoom({
        property_id: selectedRoom?.property_id,
        property_code: newBlockProp as any,
        room_type_id: newBlockRoomId,
        room_code: selectedRoom?.room_code,
        start_date: newBlockStart,
        end_date: newBlockEnd,
        quantity: Number(newBlockQty),
        reason: newBlockReason
      });
      api.getBlockedRooms().then(setBlockedRooms);
      setNewBlockStart('');
      setNewBlockEnd('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (confirm('Are you sure you want to remove this room block?')) {
      await api.deleteBlockedRoom(id);
      api.getBlockedRooms().then(setBlockedRooms);
    }
  };

  // Handle Room Edit Save
  const handleSaveRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    try {
      const updated = await api.updateRoomType(editingRoom.id, {
        price_per_night: Number(editingRoom.price_per_night),
        total_rooms: Number(editingRoom.total_rooms),
        capacity: Number(editingRoom.capacity),
        description: editingRoom.description,
        amenities: editingRoom.amenities
      });
      setRoomTypes(roomTypes.map(r => r.id === updated.id ? updated : r));
      setEditingRoom(null);
      alert('Room category updated successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // LOGIN SCREEN
  if (!isAuthenticated) {
    if (showForgotPassword) {
      return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white border border-[#C5A059]/20 p-8 shadow-sm text-[#1A1A1A] space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-[#1A1A1A] text-[#C5A059] font-serif font-bold text-xl flex items-center justify-center mx-auto shadow-sm">
                SBM
              </div>
              <h2 className="text-2xl font-serif font-medium text-[#1A1A1A]">Forgot Admin Password</h2>
              <p className="text-xs text-[#666666]">
                {forgotStep === 1
                  ? 'Enter your admin email to receive a password reset OTP at manager@sbmhotel.com'
                  : 'Enter the 6-digit OTP sent to manager@sbmhotel.com and your new password'}
              </p>
            </div>

            {forgotMsg && (
              <div
                className={`p-3 text-xs font-medium border ${
                  forgotMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {forgotMsg.text}
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Admin Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@sbmhotel.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 transition-colors text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{forgotLoading ? 'Sending OTP...' : 'SEND OTP'}</span>
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotMsg(null);
                    }}
                    className="text-xs text-[#C5A059] hover:underline font-medium cursor-pointer"
                  >
                    &larr; Back to Admin Login
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Admin Email Address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">6-Digit OTP</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059] tracking-widest font-mono"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Check email inbox for manager@sbmhotel.com</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 transition-colors text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{forgotLoading ? 'Updating Password...' : 'RESET PASSWORD'}</span>
                </button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-stone-500 hover:text-[#1A1A1A] underline cursor-pointer"
                  >
                    Resend OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotStep(1);
                      setForgotMsg(null);
                    }}
                    className="text-[#C5A059] hover:underline font-medium cursor-pointer"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white border border-[#C5A059]/20 p-8 shadow-sm text-[#1A1A1A] space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-[#1A1A1A] text-[#C5A059] font-serif font-bold text-xl flex items-center justify-center mx-auto shadow-sm">
              SBM
            </div>
            <h2 className="text-2xl font-serif font-medium text-[#1A1A1A]">Admin Portal</h2>
            <p className="text-xs text-[#666666]">SBM Hotel & Guest House Management System</p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Email Address</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2.5 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 transition-colors text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4 text-[#C5A059]" />
              <span>{loggingIn ? 'Authenticating...' : 'LOG IN TO DASHBOARD'}</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setForgotEmail(loginEmail);
                  setForgotStep(1);
                  setForgotMsg(null);
                }}
                className="text-xs text-[#C5A059] hover:underline font-medium cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // MAIN ADMIN DASHBOARD
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#1A1A1A]">
      {/* Top Admin Header */}
      <div className="bg-white border border-[#C5A059]/20 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A1A1A] text-[#C5A059] font-serif font-bold text-lg flex items-center justify-center">
            SBM
          </div>
          <div>
            <h1 className="text-xl font-serif text-[#1A1A1A] font-medium">
              SBM Hotel Admin Dashboard
            </h1>
            <p className="text-xs text-[#C5A059] font-medium">
              Logged in as {adminUser?.email || 'admin@sbmhotel.com'}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="bg-white hover:bg-stone-50 text-[#1A1A1A] hover:text-rose-600 text-xs px-4 py-2 border border-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer uppercase tracking-wider font-semibold"
        >
          <LogOut className="w-4 h-4 text-[#C5A059]" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-stone-200 space-x-2 pb-2">
        <button
          onClick={() => setActiveTab('frontdesk')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'frontdesk' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5 text-[#C5A059]" />
          Front Desk Ops
        </button>

        <button
          onClick={() => setActiveTab('tapechart')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'tapechart' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Table className="w-3.5 h-3.5 text-[#C5A059]" />
          PMS Tape Chart
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'overview' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-[#C5A059]" />
          Today's Overview
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'bookings' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-[#C5A059]" />
          Bookings ({bookings.length})
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'payments' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-[#C5A059]" />
          Payments & Ledger
        </button>

        <button
          onClick={() => setActiveTab('guests')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'guests' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-[#C5A059]" />
          Guest Directory
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'reports' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#C5A059]" />
          PMS Reports (RevPAR/ADR)
        </button>

        <button
          onClick={() => setActiveTab('channels')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'channels'
              ? 'bg-[#1A1A1A] text-white font-bold'
              : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-[#C5A059]" />
          Channel Manager
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'rooms'
              ? 'bg-[#1A1A1A] text-white font-bold'
              : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <BedDouble className="w-3.5 h-3.5 text-[#C5A059]" />
          Room Management
        </button>

        <button
          onClick={() => setActiveTab('images')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'images'
              ? 'bg-[#1A1A1A] text-white font-bold'
              : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#C5A059]" />
          Image Management
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'calendar' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
          Blocked Rooms & Calendar
        </button>

        <button
          onClick={() => setActiveTab('knowledge')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'knowledge' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-[#C5A059]" />
          AI Knowledge Base
        </button>

        <button
          onClick={() => setActiveTab('inquiries')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'inquiries' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-[#C5A059]" />
          Inquiries ({inquiries.length})
        </button>

        <button
          onClick={() => setActiveTab('coupons')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'coupons' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Ticket className="w-3.5 h-3.5 text-[#C5A059]" />
          Coupons
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 text-xs font-serif uppercase tracking-[0.15em] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'settings' ? 'bg-[#1A1A1A] text-white font-bold' : 'bg-white text-[#666666] border border-stone-200 hover:text-[#1A1A1A]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-[#C5A059]" />
          Settings
        </button>
      </div>

      {/* TAB: FRONT DESK DASHBOARD */}
      {activeTab === 'frontdesk' && (
        <FrontDeskDashboard
          token={getAdminToken() || ''}
          adminRole={adminUser?.role}
          onOpenBookingModal={(prefill) => {
            setPmsModalPrefill(prefill);
            setShowPMSModal(true);
          }}
        />
      )}

      {/* TAB: PMS TAPE CHART / CALENDAR */}
      {activeTab === 'tapechart' && (
        <PMSCalendarView
          onOpenNewBookingModal={(prefill) => {
            setPmsModalPrefill(prefill);
            setShowPMSModal(true);
          }}
          onSelectBooking={(b) => {
            setSelectedBooking(b);
          }}
        />
      )}

      {/* TAB: PAYMENTS LEDGER */}
      {activeTab === 'payments' && (
        <PMSPaymentsTab />
      )}

      {/* TAB: GUEST DIRECTORY */}
      {activeTab === 'guests' && (
        <PMSGuestsTab
          onOpenNewBookingForGuest={(guest) => {
            setPmsModalPrefill({
              guestName: guest.full_name,
              guestPhone: guest.phone,
              guestEmail: guest.email
            });
            setShowPMSModal(true);
          }}
        />
      )}

      {/* TAB: PMS REPORTS */}
      {activeTab === 'reports' && (
        <PMSReportsTab />
      )}

      {/* TAB: CHANNEL MANAGER */}
      {activeTab === 'channels' && (
        <ChannelManagerTab />
      )}

      {/* TAB: AI KNOWLEDGE BASE */}
      {activeTab === 'knowledge' && (
        <KnowledgeBaseAdmin token={getAdminToken() || ''} />
      )}

      {/* TAB: ROOM MANAGEMENT */}
      {activeTab === 'rooms' && (
        <RoomManagementTab />
      )}

      {/* TAB: IMAGE MANAGEMENT */}
      {activeTab === 'images' && (
        <ImageManagementTab />
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#C5A059]/20 p-5 space-y-1 shadow-sm">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#666666] font-bold">Today's Check-ins</span>
              <div className="text-3xl font-serif font-bold text-[#1A1A1A]">{overview.today_check_ins_count}</div>
            </div>

            <div className="bg-white border border-[#C5A059]/20 p-5 space-y-1 shadow-sm">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#666666] font-bold">Today's Check-outs</span>
              <div className="text-3xl font-serif font-bold text-[#1A1A1A]">{overview.today_check_outs_count}</div>
            </div>

            <div className="bg-white border border-[#C5A059]/20 p-5 space-y-1 shadow-sm">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#666666] font-bold">Active Guests In Hotel</span>
              <div className="text-3xl font-serif font-bold text-emerald-700">{overview.active_guests_count}</div>
            </div>

            <div className="bg-white border border-[#C5A059]/20 p-5 space-y-1 shadow-sm">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#666666] font-bold">Total Confirmed Revenue</span>
              <div className="text-3xl font-serif font-bold text-[#C5A059]">₹{overview.total_revenue?.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div className="bg-white border border-[#C5A059]/20 p-6 space-y-4 shadow-sm">
            <h3 className="text-lg font-serif text-[#1A1A1A] font-medium">Recent Bookings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1A1A1A]">
                <thead className="bg-[#1A1A1A] text-white uppercase text-[9px] tracking-[0.2em]">
                  <tr>
                    <th className="p-3">Booking ID</th>
                    <th className="p-3">Guest Name</th>
                    <th className="p-3">Property</th>
                    <th className="p-3">Room</th>
                    <th className="p-3">Dates</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {overview.recent_bookings?.map((b: Booking) => (
                    <tr key={b.id} className="hover:bg-[#FDFCFB]">
                      <td className="p-3 font-mono text-[#C5A059] font-bold">{b.booking_number}</td>
                      <td className="p-3 font-semibold text-[#1A1A1A]">{b.guest_name}</td>
                      <td className="p-3">{b.property_name}</td>
                      <td className="p-3">{b.room_name}</td>
                      <td className="p-3">{b.check_in} to {b.check_out}</td>
                      <td className="p-3 font-bold text-[#1A1A1A]">₹{b.total_amount?.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {b.booking_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BOOKINGS MANAGEMENT */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white border border-[#C5A059]/20 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center shadow-sm">
            <input
              type="text"
              placeholder="Search Name, Phone, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#FDFCFB] border border-stone-200 px-3.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
            />

            <select
              value={filterProp}
              onChange={(e) => setFilterProp(e.target.value)}
              className="bg-[#FDFCFB] border border-stone-200 px-3.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
            >
              <option value="all">All Properties</option>
              <option value="sbm-hotel">SBM Hotel</option>
              <option value="sbm-guest-house">SBM 2 Guest House</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#FDFCFB] border border-stone-200 px-3.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
            >
              <option value="all">All Booking Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Checked In">Checked In</option>
              <option value="Checked Out">Checked Out</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <button
              onClick={exportCSV}
              className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold text-xs py-2 px-4 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Bookings Table */}
          <div className="bg-white border border-[#C5A059]/20 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1A1A1A]">
                <thead className="bg-[#1A1A1A] text-white uppercase text-[9px] tracking-[0.2em]">
                  <tr>
                    <th className="p-3">Booking ID</th>
                    <th className="p-3">Guest & Phone</th>
                    <th className="p-3">Property</th>
                    <th className="p-3">Room</th>
                    <th className="p-3">Stay Dates</th>
                    <th className="p-3">Total Amount</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Booking Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-[#666666]">
                        No bookings match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-[#FDFCFB]">
                        <td className="p-3 font-mono font-bold text-[#C5A059]">{b.booking_number}</td>
                        <td className="p-3">
                          <div className="font-semibold text-[#1A1A1A]">{b.guest_name}</div>
                          <div className="text-[11px] text-[#666666]">{b.guest_phone}</div>
                        </td>
                        <td className="p-3">{b.property_name}</td>
                        <td className="p-3">{b.rooms_requested} × {b.room_name}</td>
                        <td className="p-3">{b.check_in} to {b.check_out} ({b.nights}N)</td>
                        <td className="p-3 font-bold text-[#1A1A1A]">₹{b.total_amount?.toLocaleString('en-IN')}</td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-xs ${
                              b.payment_status === 'Paid' || b.payment_status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : b.payment_status === 'Failed'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {b.payment_status}
                            </span>
                            <div className="text-[10px] text-[#666666]">
                              {b.payment_method === 'online_razorpay' ? 'Razorpay' : 'Pay at Hotel'}
                            </div>
                            {(b.razorpay_payment_id || b.payment_txn_id) && (
                              <div className="font-mono text-[9px] text-[#888888] truncate max-w-[110px]" title={b.razorpay_payment_id || b.payment_txn_id}>
                                {b.razorpay_payment_id || b.payment_txn_id}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <select
                            value={b.booking_status}
                            onChange={async (e) => {
                              const updated = await api.updateBooking(b.id, { booking_status: e.target.value as any });
                              setBookings(bookings.map(item => item.id === b.id ? updated : item));
                            }}
                            className="bg-[#FDFCFB] text-[11px] font-semibold border border-stone-200 px-2 py-1 focus:outline-none focus:border-[#C5A059]"
                          >
                            <option value="Confirmed">Confirmed</option>
                            <option value="Pending">Pending</option>
                            <option value="Checked In">Checked In</option>
                            <option value="Checked Out">Checked Out</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => setSelectedBooking(b)}
                            className="p-1.5 border border-stone-200 hover:border-[#C5A059] text-[#1A1A1A] text-[11px] flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C5A059]" />
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

          {/* Booking Details Modal */}
          {selectedBooking && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-[#C5A059]/40 max-w-2xl w-full text-[#1A1A1A] shadow-2xl overflow-hidden">
                <div className="bg-[#1A1A1A] px-6 py-4 flex justify-between items-center text-white border-b-2 border-[#C5A059]">
                  <div>
                    <h3 className="font-serif text-base font-medium text-white flex items-center gap-2">
                      <span>Booking Details</span>
                      <span className="font-mono text-[#C5A059] text-sm">#{selectedBooking.booking_number}</span>
                    </h3>
                    <p className="text-[11px] text-stone-400">{selectedBooking.property_name}</p>
                  </div>
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="p-1 text-white/70 hover:text-white cursor-pointer"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
                  {/* Guest Information */}
                  <div className="bg-[#FDFCFB] p-4 border border-stone-200 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[#666666] block text-[10px] uppercase font-bold">Guest Name</span>
                      <span className="font-semibold text-sm text-[#1A1A1A]">{selectedBooking.guest_name}</span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[10px] uppercase font-bold">Mobile & Email</span>
                      <span className="text-[#1A1A1A] block">{selectedBooking.guest_phone}</span>
                      <span className="text-[#666666] text-[11px]">{selectedBooking.guest_email || 'No email provided'}</span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[10px] uppercase font-bold">Stay Dates</span>
                      <span className="text-[#1A1A1A]">{selectedBooking.check_in} to {selectedBooking.check_out} ({selectedBooking.nights} Nights)</span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[10px] uppercase font-bold">Room Category & Occupancy</span>
                      <span className="text-[#1A1A1A]">{selectedBooking.rooms_requested} × {selectedBooking.room_name} ({selectedBooking.adults}A, {selectedBooking.children}C)</span>
                    </div>
                  </div>

                  {/* Payment & Razorpay Details */}
                  <div className="border border-stone-200 p-4 space-y-3 bg-white">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#C5A059] border-b border-stone-100 pb-1.5 flex justify-between items-center">
                      <span>Payment & Gateway Information</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                        selectedBooking.payment_status === 'Paid' || selectedBooking.payment_status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedBooking.payment_status}
                      </span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-[#666666] block">Payment Mode:</span>
                        <strong className="text-[#1A1A1A]">{selectedBooking.payment_method === 'online_razorpay' ? 'Razorpay Gateway (Online)' : 'Pay at Reception'}</strong>
                      </div>
                      <div>
                        <span className="text-[#666666] block">Room Charges:</span>
                        <span className="text-[#1A1A1A]">₹{selectedBooking.room_subtotal?.toLocaleString('en-IN') || selectedBooking.total_amount?.toLocaleString('en-IN')}</span>
                      </div>
                      {selectedBooking.discount_amount && selectedBooking.discount_amount > 0 ? (
                        <>
                          <div>
                            <span className="text-[#666666] block">Coupon Applied ({selectedBooking.coupon_code}):</span>
                            <span className="font-bold text-emerald-700">-₹{selectedBooking.discount_amount?.toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-[#666666] block">Taxable Amount:</span>
                            <span className="text-[#1A1A1A]">₹{Math.max(0, (selectedBooking.room_subtotal || 0) - (selectedBooking.discount_amount || 0)).toLocaleString('en-IN')}</span>
                          </div>
                        </>
                      ) : null}
                      <div>
                        <span className="text-[#666666] block">GST Amount:</span>
                        <span className="text-[#1A1A1A]">₹{selectedBooking.tax_amount?.toLocaleString('en-IN') || 0}</span>
                      </div>
                      <div>
                        <span className="text-[#666666] block">Final Total Amount:</span>
                        <strong className="text-sm font-serif text-[#C5A059]">₹{selectedBooking.total_amount?.toLocaleString('en-IN')}</strong>
                      </div>
                      {selectedBooking.razorpay_order_id && (
                        <div>
                          <span className="text-[#666666] block">Razorpay Order ID:</span>
                          <span className="font-mono text-[10px] text-[#1A1A1A] bg-stone-100 px-1.5 py-0.5 rounded">{selectedBooking.razorpay_order_id}</span>
                        </div>
                      )}
                      {(selectedBooking.razorpay_payment_id || selectedBooking.payment_txn_id) && (
                        <div>
                          <span className="text-[#666666] block">Razorpay Payment ID:</span>
                          <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{selectedBooking.razorpay_payment_id || selectedBooking.payment_txn_id}</span>
                        </div>
                      )}
                      {selectedBooking.payment_verified_at && (
                        <div className="col-span-2">
                          <span className="text-[#666666] block">Signature Verified At:</span>
                          <span className="text-[#1A1A1A]">{new Date(selectedBooking.payment_verified_at).toLocaleString('en-IN')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Email Dispatch Status */}
                  <div className="border border-stone-200 p-4 space-y-3 bg-white">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#C5A059] border-b border-stone-100 pb-1.5 flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Automated Email Notification Status</span>
                      </span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-[#666666] block">Customer Confirmation:</span>
                        <div className="mt-1 flex items-center gap-1.5">
                          {selectedBooking.customer_email_status === 'sent' ? (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 border border-emerald-200 rounded text-[10px] flex items-center gap-1">
                              ✓ Sent
                            </span>
                          ) : selectedBooking.customer_email_status === 'failed' ? (
                            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 border border-rose-200 rounded text-[10px] flex items-center gap-1">
                              ✕ Failed
                            </span>
                          ) : (
                            <span className="text-stone-700 font-medium bg-stone-100 px-2 py-0.5 border border-stone-200 rounded text-[10px]">
                              {selectedBooking.customer_email_status || 'Delivered'}
                            </span>
                          )}
                          {selectedBooking.customer_email_sent_at && (
                            <span className="text-[10px] text-stone-400">
                              ({new Date(selectedBooking.customer_email_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[#666666] block">Hotel Admin Alert:</span>
                        <div className="mt-1 flex items-center gap-1.5">
                          {selectedBooking.admin_email_status === 'sent' ? (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 border border-emerald-200 rounded text-[10px] flex items-center gap-1">
                              ✓ Sent
                            </span>
                          ) : selectedBooking.admin_email_status === 'failed' ? (
                            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 border border-rose-200 rounded text-[10px] flex items-center gap-1">
                              ✕ Failed
                            </span>
                          ) : (
                            <span className="text-stone-700 font-medium bg-stone-100 px-2 py-0.5 border border-stone-200 rounded text-[10px]">
                              {selectedBooking.admin_email_status || 'Delivered'}
                            </span>
                          )}
                          {selectedBooking.admin_email_sent_at && (
                            <span className="text-[10px] text-stone-400">
                              ({new Date(selectedBooking.admin_email_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Special Requests */}
                  {selectedBooking.special_request && (
                    <div className="bg-amber-50/60 border border-amber-200 p-3 text-xs">
                      <span className="font-bold text-amber-900 block text-[10px] uppercase">Special Request:</span>
                      <p className="text-amber-950 mt-0.5">{selectedBooking.special_request}</p>
                    </div>
                  )}

                  {/* Actions in Modal */}
                  <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-stone-200">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedBooking.payment_status !== 'Paid' && selectedBooking.payment_status !== 'Completed' && (
                        <button
                          onClick={async () => {
                            const updated = await api.updateBooking(selectedBooking.id, { payment_status: 'Paid' });
                            setSelectedBooking(updated);
                            setBookings(bookings.map(b => b.id === updated.id ? updated : b));
                          }}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-2 text-[10px] uppercase tracking-wider cursor-pointer"
                        >
                          Mark as Paid (Front Desk)
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          const token = getAdminToken() || '';
                          try {
                            const res = await api.resendBookingEmail(token, selectedBooking.id, 'customer');
                            if (res.booking) {
                              setSelectedBooking(res.booking);
                              setBookings(bookings.map(b => b.id === res.booking?.id ? res.booking : b));
                            }
                            alert('Confirmation email sent successfully.');
                          } catch (err: any) {
                            alert(`Failed to send email: ${err?.message || err}`);
                          }
                        }}
                        className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold px-3 py-2 text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Resend Customer Email</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedBooking(null)}
                        className="bg-stone-100 hover:bg-stone-200 text-[#1A1A1A] font-bold px-4 py-2 text-[10px] uppercase tracking-wider cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ROOM INVENTORY & PRICING MANAGER */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-[#C5A059]/10 border border-[#C5A059]/30 p-4 text-xs text-[#1A1A1A]">
            <strong>Strict Category Notice:</strong> The hotel inventory is restricted to two room categories: <strong>Deluxe Room (₹2,500/night)</strong> and <strong>Family Suite (₹3,500/night)</strong>.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roomTypes.map((room) => (
              <div key={room.id} className="bg-white border border-[#C5A059]/20 p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-start border-b border-stone-100 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#C5A059] tracking-[0.2em]">{room.property_code === 'sbm-hotel' ? 'SBM Hotel' : 'SBM 2 Guest House'}</span>
                    <h3 className="text-xl font-serif text-[#1A1A1A] font-medium">{room.name}</h3>
                  </div>
                  <button
                    onClick={() => setEditingRoom(room)}
                    className="p-2 border border-stone-200 hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-[#C5A059]" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-[#1A1A1A]">
                  <div className="bg-[#FDFCFB] border border-stone-200 p-3">
                    <span className="text-[10px] uppercase text-[#666666] block tracking-wider">Price Per Night</span>
                    <span className="text-lg font-bold text-[#C5A059]">₹{room.price_per_night.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="bg-[#FDFCFB] border border-stone-200 p-3">
                    <span className="text-[10px] uppercase text-[#666666] block tracking-wider">Total Inventory</span>
                    <span className="text-lg font-bold text-[#1A1A1A]">{room.total_rooms} Rooms</span>
                  </div>
                </div>

                <p className="text-xs text-[#666666]">{room.description}</p>
              </div>
            ))}
          </div>

          {/* Edit Room Modal */}
          {editingRoom && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-[#C5A059]/30 p-6 max-w-md w-full text-[#1A1A1A] space-y-4 shadow-lg">
                <h3 className="text-lg font-serif text-[#1A1A1A] font-medium">Edit Category: {editingRoom.name}</h3>

                <form onSubmit={handleSaveRoomType} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[#1A1A1A] mb-1 font-medium">Price Per Night (₹)</label>
                    <input
                      type="number"
                      required
                      value={editingRoom.price_per_night}
                      onChange={(e) => setEditingRoom({ ...editingRoom, price_per_night: Number(e.target.value) })}
                      className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#1A1A1A] mb-1 font-medium">Total Rooms Count</label>
                    <input
                      type="number"
                      required
                      value={editingRoom.total_rooms}
                      onChange={(e) => setEditingRoom({ ...editingRoom, total_rooms: Number(e.target.value) })}
                      className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#1A1A1A] mb-1 font-medium">Max Occupancy</label>
                    <input
                      type="number"
                      required
                      value={editingRoom.capacity}
                      onChange={(e) => setEditingRoom({ ...editingRoom, capacity: Number(e.target.value) })}
                      className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#1A1A1A] mb-1 font-medium">Description</label>
                    <textarea
                      rows={3}
                      value={editingRoom.description}
                      onChange={(e) => setEditingRoom({ ...editingRoom, description: e.target.value })}
                      className="w-full bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-[#1A1A1A]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingRoom(null)}
                      className="w-1/2 py-2 border border-stone-200 text-[#1A1A1A] font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-1/2 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold transition-colors cursor-pointer uppercase text-[10px] tracking-wider"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BLOCKED ROOMS & CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#C5A059]/20 p-6 space-y-4 shadow-sm">
            <h3 className="text-lg font-serif text-[#1A1A1A] font-medium">Block Rooms for Maintenance / Private Booking</h3>

            <form onSubmit={handleCreateBlock} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end">
              <div>
                <label className="block text-[#666666] mb-1 font-medium">Property</label>
                <select
                  value={newBlockProp}
                  onChange={(e) => setNewBlockProp(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-[#1A1A1A]"
                >
                  <option value="sbm-hotel">SBM Hotel</option>
                  <option value="sbm-guest-house">SBM 2 Guest House</option>
                </select>
              </div>

              <div>
                <label className="block text-[#666666] mb-1 font-medium">Room Category</label>
                <select
                  value={newBlockRoomId}
                  onChange={(e) => setNewBlockRoomId(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-[#1A1A1A]"
                >
                  <option value="">-- Select Category --</option>
                  {roomTypes.filter(r => r.property_code === newBlockProp).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#666666] mb-1 font-medium">Start Date</label>
                <input
                  type="date"
                  required
                  value={newBlockStart}
                  onChange={(e) => setNewBlockStart(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 p-2 text-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-[#666666] mb-1 font-medium">End Date</label>
                <input
                  type="date"
                  required
                  value={newBlockEnd}
                  onChange={(e) => setNewBlockEnd(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 p-2 text-[#1A1A1A]"
                />
              </div>

              <button
                type="submit"
                className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-2.5 px-4 flex items-center justify-center gap-1 cursor-pointer transition-colors uppercase text-[10px] tracking-wider"
              >
                <Plus className="w-4 h-4 text-[#C5A059]" />
                <span>Add Block</span>
              </button>
            </form>
          </div>

          <div className="bg-white border border-[#C5A059]/20 p-6 space-y-4 shadow-sm">
            <h3 className="text-lg font-serif text-[#1A1A1A] font-medium">Active Room Blocks</h3>
            {blockedRooms.length === 0 ? (
              <p className="text-xs text-[#666666]">No manual room blocks currently active.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#1A1A1A]">
                  <thead className="bg-[#1A1A1A] text-white uppercase text-[9px] tracking-[0.2em]">
                    <tr>
                      <th className="p-3">Property & Room</th>
                      <th className="p-3">Block Dates</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {blockedRooms.map(blk => (
                      <tr key={blk.id}>
                        <td className="p-3 font-semibold text-[#C5A059]">{blk.property_code} — {blk.room_code}</td>
                        <td className="p-3">{blk.start_date} to {blk.end_date}</td>
                        <td className="p-3">{blk.quantity} Room(s)</td>
                        <td className="p-3 text-[#666666]">{blk.reason}</td>
                        <td className="p-3">
                          <button
                            onClick={() => handleDeleteBlock(blk.id)}
                            className="p-1.5 bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 text-[11px] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: INQUIRIES */}
      {activeTab === 'inquiries' && (
        <div className="bg-white border border-[#C5A059]/20 p-6 space-y-4 shadow-sm">
          <h3 className="text-lg font-serif text-[#1A1A1A] font-medium">Customer Messages & Inquiries</h3>
          {inquiries.length === 0 ? (
            <p className="text-xs text-[#666666]">No customer inquiries received yet.</p>
          ) : (
            <div className="space-y-3">
              {inquiries.map((inq) => (
                <div key={inq.id} className="bg-[#FDFCFB] p-4 border border-stone-200 text-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <strong className="text-[#1A1A1A] text-sm block font-serif">{inq.name}</strong>
                      <span className="text-[#666666]">Phone: {inq.phone} | Email: {inq.email || 'N/A'}</span>
                    </div>
                    <span className="text-[10px] text-[#666666]">{new Date(inq.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[#1A1A1A] bg-white p-3 border border-stone-100">{inq.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: COUPON MANAGEMENT */}
      {activeTab === 'coupons' && (
        <CouponManagementTab roomTypes={roomTypes} />
      )}

      {/* TAB 6: SETTINGS */}
      {activeTab === 'settings' && settings && (
        <div className="bg-white border border-[#C5A059]/20 p-6 space-y-4 max-w-xl shadow-sm">
          <h3 className="text-lg font-serif text-[#1A1A1A] font-medium">System Configuration</h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#666666] mb-1 font-medium">Hotel Name</label>
              <input
                type="text"
                value={settings.hotel_name}
                onChange={(e) => setSettings({ ...settings, hotel_name: e.target.value })}
                className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-[#1A1A1A]"
              />
            </div>

            <div>
              <label className="block text-[#666666] mb-1 font-medium">GST Tax Percentage (%)</label>
              <input
                type="number"
                value={settings.gst_percent}
                onChange={(e) => setSettings({ ...settings, gst_percent: Number(e.target.value) })}
                className="w-full bg-[#FDFCFB] border border-stone-200 p-2.5 text-[#1A1A1A]"
              />
            </div>

            <button
              onClick={async () => {
                await api.updateAdminSettings(settings);
                alert('Settings updated!');
              }}
              className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold px-5 py-2.5 transition-colors cursor-pointer uppercase text-[10px] tracking-[0.15em]"
            >
              Save Configuration
            </button>
          </div>

          {/* Social Media Links Management Section */}
          <div className="border-t border-stone-200 pt-5 mt-6 space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#C5A059]">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-serif font-bold text-stone-800 text-sm">
                  Website Settings &mdash; Social Media Links
                </h4>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Configure your official social media URLs and choose where the icons appear (Header, Contact Us page).
              </p>
            </div>

            {socialMediaSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xs flex items-center justify-between">
                <span>{socialMediaSuccessMsg}</span>
                <button
                  type="button"
                  onClick={() => setSocialMediaSuccessMsg(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 text-xs"
                >
                  &times;
                </button>
              </div>
            )}

            {/* INSTAGRAM CONFIGURATION CARD */}
            <div className="bg-[#FDFCFB] border border-stone-200 p-4 space-y-3.5 rounded-xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-2xs">
                    <Instagram className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-serif font-bold text-sm text-[#1A1A1A]">Instagram</span>
                    <span className="text-[10px] text-stone-500 block">Visual stories & updates</span>
                  </div>
                </div>

                {/* Enable / Disable Switch */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-stone-600">
                    {settings.social_media?.instagram?.enabled ? (
                      <span className="text-emerald-700 font-bold">ON</span>
                    ) : (
                      <span className="text-stone-400">OFF</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = settings.social_media || {
                        instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true },
                        facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true }
                      };
                      setSettings({
                        ...settings,
                        social_media: {
                          ...cur,
                          instagram: {
                            ...cur.instagram,
                            enabled: !cur.instagram.enabled
                          }
                        }
                      });
                    }}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.social_media?.instagram?.enabled ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                    role="switch"
                    aria-checked={settings.social_media?.instagram?.enabled ?? true}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        settings.social_media?.instagram?.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Instagram URL */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Instagram URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={settings.social_media?.instagram?.url ?? ''}
                    onChange={(e) => {
                      const cur = settings.social_media || {
                        instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true },
                        facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true }
                      };
                      setSettings({
                        ...settings,
                        social_media: {
                          ...cur,
                          instagram: {
                            ...cur.instagram,
                            url: e.target.value
                          }
                        }
                      });
                    }}
                    placeholder="https://www.instagram.com/sbmhotel"
                    className="flex-1 bg-white border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                  />
                  {settings.social_media?.instagram?.url && (
                    <a
                      href={settings.social_media.instagram.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 hover:text-[#C5A059] text-xs flex items-center gap-1 transition"
                      title="Open link in new tab to test"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Test</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Instagram Display Location Checkboxes */}
              <div>
                <span className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Display Location:
                </span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={settings.social_media?.instagram?.show_in_header ?? true}
                      onChange={(e) => {
                        const cur = settings.social_media || {
                          instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true },
                          facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true }
                        };
                        setSettings({
                          ...settings,
                          social_media: {
                            ...cur,
                            instagram: {
                              ...cur.instagram,
                              show_in_header: e.target.checked
                            }
                          }
                        });
                      }}
                      className="rounded border-stone-300 text-[#C5A059] focus:ring-[#C5A059] w-4 h-4 cursor-pointer"
                    />
                    <span>Header</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={settings.social_media?.instagram?.show_on_contact ?? true}
                      onChange={(e) => {
                        const cur = settings.social_media || {
                          instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true, show_in_footer: true },
                          facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true, show_in_footer: true }
                        };
                        setSettings({
                          ...settings,
                          social_media: {
                            ...cur,
                            instagram: {
                              ...cur.instagram,
                              show_on_contact: e.target.checked
                            }
                          }
                        });
                      }}
                      className="rounded border-stone-300 text-[#C5A059] focus:ring-[#C5A059] w-4 h-4 cursor-pointer"
                    />
                    <span>Contact Us</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={settings.social_media?.instagram?.show_in_footer ?? true}
                      onChange={(e) => {
                        const cur = settings.social_media || {
                          instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true, show_in_footer: true },
                          facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true, show_in_footer: true }
                        };
                        setSettings({
                          ...settings,
                          social_media: {
                            ...cur,
                            instagram: {
                              ...cur.instagram,
                              show_in_footer: e.target.checked
                            }
                          }
                        });
                      }}
                      className="rounded border-stone-300 text-[#C5A059] focus:ring-[#C5A059] w-4 h-4 cursor-pointer"
                    />
                    <span>Footer</span>
                  </label>
                </div>
              </div>
            </div>

            {/* FACEBOOK CONFIGURATION CARD */}
            <div className="bg-[#FDFCFB] border border-stone-200 p-4 space-y-3.5 rounded-xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#1877F2] text-white flex items-center justify-center shadow-2xs">
                    <Facebook className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-serif font-bold text-sm text-[#1A1A1A]">Facebook</span>
                    <span className="text-[10px] text-stone-500 block">Community & guest reviews</span>
                  </div>
                </div>

                {/* Enable / Disable Switch */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-stone-600">
                    {settings.social_media?.facebook?.enabled ? (
                      <span className="text-emerald-700 font-bold">ON</span>
                    ) : (
                      <span className="text-stone-400">OFF</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = settings.social_media || {
                        instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true },
                        facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true }
                      };
                      setSettings({
                        ...settings,
                        social_media: {
                          ...cur,
                          facebook: {
                            ...cur.facebook,
                            enabled: !cur.facebook.enabled
                          }
                        }
                      });
                    }}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.social_media?.facebook?.enabled ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                    role="switch"
                    aria-checked={settings.social_media?.facebook?.enabled ?? true}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        settings.social_media?.facebook?.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Facebook URL */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Facebook URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={settings.social_media?.facebook?.url ?? ''}
                    onChange={(e) => {
                      const cur = settings.social_media || {
                        instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true },
                        facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true }
                      };
                      setSettings({
                        ...settings,
                        social_media: {
                          ...cur,
                          facebook: {
                            ...cur.facebook,
                            url: e.target.value
                          }
                        }
                      });
                    }}
                    placeholder="https://www.facebook.com/sbmhotel"
                    className="flex-1 bg-white border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                  />
                  {settings.social_media?.facebook?.url && (
                    <a
                      href={settings.social_media.facebook.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 hover:text-[#C5A059] text-xs flex items-center gap-1 transition"
                      title="Open link in new tab to test"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Test</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Facebook Display Location Checkboxes */}
              <div>
                <span className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Display Location:
                </span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={settings.social_media?.facebook?.show_in_header ?? true}
                      onChange={(e) => {
                        const cur = settings.social_media || {
                          instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true },
                          facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true }
                        };
                        setSettings({
                          ...settings,
                          social_media: {
                            ...cur,
                            facebook: {
                              ...cur.facebook,
                              show_in_header: e.target.checked
                            }
                          }
                        });
                      }}
                      className="rounded border-stone-300 text-[#C5A059] focus:ring-[#C5A059] w-4 h-4 cursor-pointer"
                    />
                    <span>Header</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={settings.social_media?.facebook?.show_on_contact ?? true}
                      onChange={(e) => {
                        const cur = settings.social_media || {
                          instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true, show_in_footer: true },
                          facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true, show_in_footer: true }
                        };
                        setSettings({
                          ...settings,
                          social_media: {
                            ...cur,
                            facebook: {
                              ...cur.facebook,
                              show_on_contact: e.target.checked
                            }
                          }
                        });
                      }}
                      className="rounded border-stone-300 text-[#C5A059] focus:ring-[#C5A059] w-4 h-4 cursor-pointer"
                    />
                    <span>Contact Us</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={settings.social_media?.facebook?.show_in_footer ?? true}
                      onChange={(e) => {
                        const cur = settings.social_media || {
                          instagram: { platform: 'instagram', enabled: true, url: '', show_in_header: true, show_on_contact: true, show_in_footer: true },
                          facebook: { platform: 'facebook', enabled: true, url: '', show_in_header: true, show_on_contact: true, show_in_footer: true }
                        };
                        setSettings({
                          ...settings,
                          social_media: {
                            ...cur,
                            facebook: {
                              ...cur.facebook,
                              show_in_footer: e.target.checked
                            }
                          }
                        });
                      }}
                      className="rounded border-stone-300 text-[#C5A059] focus:ring-[#C5A059] w-4 h-4 cursor-pointer"
                    />
                    <span>Footer</span>
                  </label>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS: SAVE & RESET */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={savingSocialMedia}
                onClick={async () => {
                  setSavingSocialMedia(true);
                  setSocialMediaSuccessMsg(null);
                  try {
                    const res = await api.updateAdminSettings(settings);
                    setSettings(res);
                    if (res.social_media) {
                      setInitialSocialSettings(JSON.parse(JSON.stringify(res.social_media)));
                    }
                    setSocialMediaSuccessMsg('✓ Social media links updated successfully! Changes are live on the website.');
                    setTimeout(() => setSocialMediaSuccessMsg(null), 5000);
                  } catch (err: any) {
                    alert(err.message || 'Failed to save social media settings');
                  } finally {
                    setSavingSocialMedia(false);
                  }
                }}
                className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold px-5 py-2.5 transition-colors cursor-pointer uppercase text-[10px] tracking-[0.15em] flex items-center gap-2 disabled:opacity-50"
              >
                <span>{savingSocialMedia ? 'Saving...' : 'Save Changes'}</span>
              </button>

              <button
                type="button"
                disabled={savingSocialMedia}
                onClick={() => {
                  if (initialSocialSettings) {
                    setSettings({
                      ...settings,
                      social_media: JSON.parse(JSON.stringify(initialSocialSettings))
                    });
                    setSocialMediaSuccessMsg('Settings reset to last saved state.');
                    setTimeout(() => setSocialMediaSuccessMsg(null), 3000);
                  }
                }}
                className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 px-4 py-2.5 transition-colors cursor-pointer uppercase text-[10px] tracking-[0.15em] flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                <span>Reset / Cancel</span>
              </button>
            </div>
          </div>

          {/* Email Notification System Card */}
          <div className="border-t border-stone-200 pt-5 mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif font-bold text-stone-800 text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#C5A059]" />
                  <span>Email Notification System</span>
                </h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Sends automated customer booking confirmations & real-time admin booking alerts.
                </p>
              </div>
              <span
                className={`text-[10px] px-2.5 py-1 font-bold uppercase tracking-wider rounded ${
                  emailStatus?.is_configured
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                    : 'bg-amber-50 text-amber-700 border border-amber-300'
                }`}
              >
                {emailStatus?.is_configured ? 'SMTP Configured' : 'Local Simulation / Active'}
              </span>
            </div>

            <div className="bg-[#FDFCFB] border border-stone-200 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-stone-600">
                <span>SMTP Provider / Host:</span>
                <span className="font-mono text-stone-800 font-semibold">{emailStatus?.host || 'Not set (console fallback)'}</span>
              </div>
              <div className="flex justify-between items-center text-stone-600">
                <span>Sender Display ("From"):</span>
                <span className="text-stone-800">{emailStatus?.from || '"SBM Hotel Salasar"'}</span>
              </div>
              <div className="flex justify-between items-center text-stone-600">
                <span>Admin Alerts Destination:</span>
                <span className="font-mono text-stone-800 font-semibold">{emailStatus?.admin_email || 'sbmhotel@gmail.com'}</span>
              </div>
            </div>

            {/* Test Email Trigger */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-stone-700">
                Send Test Confirmation Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter email to receive test booking voucher (e.g. your email)"
                  value={testEmailTarget}
                  onChange={(e) => setTestEmailTarget(e.target.value)}
                  className="flex-1 bg-[#FDFCFB] border border-stone-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                />
                <button
                  type="button"
                  disabled={sendingTestEmail}
                  onClick={async () => {
                    setSendingTestEmail(true);
                    setTestEmailResult(null);
                    try {
                      const res = await api.email.sendTestEmail({
                        targetEmail: testEmailTarget.trim() || undefined
                      });
                      if (res.success) {
                        setTestEmailResult(`✓ Test email processed for ${res.recipient} (Booking ${res.booking_number})${res.simulated ? ' [Simulated mode]' : ' [Delivered via SMTP]'}`);
                      } else {
                        setTestEmailResult(`❌ Failed: ${res.error || 'Unknown error'}`);
                      }
                    } catch (err: any) {
                      setTestEmailResult(`❌ Error: ${err.message}`);
                    } finally {
                      setSendingTestEmail(false);
                    }
                  }}
                  className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold px-4 py-2 text-xs uppercase tracking-wider transition disabled:opacity-50 cursor-pointer"
                >
                  {sendingTestEmail ? 'Sending...' : 'Send Test'}
                </button>
              </div>

              {testEmailResult && (
                <div
                  className={`p-2.5 text-xs rounded border ${
                    testEmailResult.startsWith('✓')
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {testEmailResult}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-stone-200 pt-5 mt-6 space-y-3">
            <h4 className="font-serif font-bold text-stone-800 text-sm">PMS Test Data Reset</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Clear all demo/test rooms, reservations, guests, and payments to begin real room entry and clean workflow testing. Preserves admin logins and property configurations.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (confirm('Are you sure you want to reset all test bookings, physical rooms, and guest data? This will leave 0 rooms and 0 bookings.')) {
                  try {
                    const res = await api.resetTestData();
                    alert(res.message || 'Database reset successfully!');
                    window.location.reload();
                  } catch (err: any) {
                    alert(err.message || 'Reset failed.');
                  }
                }
              }}
              className="bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-100 font-bold px-4 py-2 text-xs uppercase tracking-wider transition"
            >
              Reset Test Data
            </button>
          </div>
        </div>
      )}

      {/* PMS WALK-IN & DIRECT BOOKING MODAL */}
      {showPMSModal && (
        <NewPMSReservationModal
          prefill={pmsModalPrefill}
          onClose={() => {
            setShowPMSModal(false);
            setPmsModalPrefill(null);
          }}
          onSuccess={(newBooking) => {
            setShowPMSModal(false);
            setPmsModalPrefill(null);
            // Refresh bookings and overview
            api.getAdminBookings().then(setBookings);
            api.getAdminOverview().then(setOverview);
            alert(`Reservation ${newBooking.booking_number} created successfully!`);
          }}
        />
      )}
    </div>
  );
};
