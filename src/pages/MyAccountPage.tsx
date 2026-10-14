import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  ShieldCheck,
  CalendarCheck,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  LogOut,
  RefreshCw,
  Building,
  CreditCard,
  Edit2,
  Save,
  X,
  MessageSquare,
  LogIn,
  UserPlus,
  Mail,
  Lock
} from 'lucide-react';
import { api, getCustomerToken, setCustomerToken, clearCustomerToken } from '../lib/api';
import { Booking } from '../types';
import { BookingVoucher } from '../components/BookingVoucher';

interface CustomerProfile {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  isVerified?: boolean;
  totalBookings?: number;
  totalSpent?: number;
}

interface MyAccountPageProps {
  onOpenBookingModal?: () => void;
}

export const MyAccountPage: React.FC<MyAccountPageProps> = ({ onOpenBookingModal }) => {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(getCustomerToken()));
  const [authMainTab, setAuthMainTab] = useState<'signin' | 'register' | 'mobile_otp'>('signin');
  const [signInSubTab, setSignInSubTab] = useState<'mobile' | 'email'>('mobile');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regStep, setRegStep] = useState<'form' | 'otp'>('form');
  const [regOtpInput, setRegOtpInput] = useState('');
  const [emailAuthMode, setEmailAuthMode] = useState<'login' | 'forgot'>('login');

  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  // Email auth inputs
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  
  // UI feedback & timers
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [isNotConfigured, setIsNotConfigured] = useState(false);

  // Customer data states
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Profile edit modal
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Selected booking for voucher display
  const [selectedVoucherBooking, setSelectedVoucherBooking] = useState<Booking | null>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Load customer profile when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadCustomerData();
    }
  }, [isAuthenticated]);

  const loadCustomerData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const res = await api.customer.getProfile();
      setCustomer(res.customer);
      setBookings(res.bookings || []);
      setEditName(res.customer.fullName || '');
      setEditEmail(res.customer.email || '');
      setEditAddress(res.customer.address || '');
    } catch (err: any) {
      console.error('[MyAccount] Failed to load customer profile:', err);
      if (err?.message?.includes('expired') || err?.message?.includes('authentication required')) {
        handleLogout();
      } else {
        setError(err.message || 'Failed to load account information.');
      }
    } finally {
      setLoadingData(false);
    }
  };

  // 1. Request WhatsApp OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneInput.trim()) {
      setError('Please enter your mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setIsNotConfigured(false);

    try {
      const res = await api.customer.requestOtp(phoneInput.trim());
      setMaskedPhone(res.maskedPhone || phoneInput.trim());
      setStep('otp');
      setCooldown(res.cooldownSeconds || 60);
      setSuccessMsg(res.message || 'If the request was accepted, a verification code will be sent to your WhatsApp number.');
    } catch (err: any) {
      console.error('[MyAccount] Request OTP error:', err);
      if (err?.notConfigured || err?.message?.includes('unconfigured') || err?.message?.includes('BHASHSMS')) {
        setIsNotConfigured(true);
      }
      setError(err.message || 'Failed to send WhatsApp OTP.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify WhatsApp OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim() || otpInput.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.customer.verifyOtp(phoneInput.trim(), otpInput.trim());
      setCustomerToken(res.token);
      setIsAuthenticated(true);
      setCustomer(res.customer);
      setSuccessMsg('Successfully verified and logged in via WhatsApp OTP!');
      setOtpInput('');
    } catch (err: any) {
      console.error('[MyAccount] Verify OTP error:', err);
      setError(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Email Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.customer.loginEmail(emailInput.trim(), passwordInput);
      setCustomerToken(res.token);
      setIsAuthenticated(true);
      setCustomer(res.customer);
      setSuccessMsg('Logged in successfully!');
      setEmailInput('');
      setPasswordInput('');
    } catch (err: any) {
      console.error('[MyAccount] Email Login error:', err);
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Customer Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regEmail.trim() || !regPhone.trim() || !regPassword || !regConfirmPassword) {
      setError('All registration fields (Full Name, Mobile Number, Email Address, Password, Confirm Password) are required.');
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    const digitsOnly = regPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please ensure both password fields are identical.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.customer.register({
        fullName: regFullName.trim(),
        email: cleanEmail,
        phone: regPhone.trim(),
        password: regPassword
      });

      if (res.requiresOtp) {
        setMaskedPhone(res.maskedPhone || regPhone.trim());
        setCooldown(res.cooldownSeconds || 60);
        setRegStep('otp');
        setSuccessMsg(res.message || 'Please enter the 6-digit WhatsApp verification code sent to your mobile number.');
      } else if (res.token && res.customer) {
        setCustomerToken(res.token);
        setIsAuthenticated(true);
        setCustomer(res.customer);
        setSuccessMsg('Account created successfully! Welcome to SBM Hotel.');
        setRegFullName('');
        setRegEmail('');
        setRegPhone('');
        setRegPassword('');
        setRegConfirmPassword('');
        setRegStep('form');
      }
    } catch (err: any) {
      console.error('[MyAccount] Registration error:', err);
      if (err?.notConfigured || err?.message?.includes('unconfigured') || err?.message?.includes('BHASHSMS')) {
        setIsNotConfigured(true);
      }
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  // 4b. Verify Registration WhatsApp OTP
  const handleVerifyRegOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regOtpInput.trim() || regOtpInput.length !== 6) {
      setError('Please enter the 6-digit verification code sent to your WhatsApp.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.customer.verifyOtp(regPhone.trim(), regOtpInput.trim());
      setCustomerToken(res.token);
      setIsAuthenticated(true);
      setCustomer(res.customer);
      setSuccessMsg('Account created and mobile number verified successfully! Welcome to SBM Hotel.');
      setRegFullName('');
      setRegEmail('');
      setRegPhone('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegOtpInput('');
      setRegStep('form');
    } catch (err: any) {
      console.error('[MyAccount] Registration OTP verify error:', err);
      setError(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  // 4c. Resend Registration WhatsApp OTP
  const handleResendRegOtp = async () => {
    if (cooldown > 0 || !regPhone.trim()) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.customer.requestOtp(regPhone.trim());
      setMaskedPhone(res.maskedPhone || regPhone.trim());
      setCooldown(res.cooldownSeconds || 60);
      setSuccessMsg('A new verification code has been dispatched to your WhatsApp.');
    } catch (err: any) {
      console.error('[MyAccount] Resend Registration OTP error:', err);
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Forgot Password Request
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.customer.forgotPassword(forgotEmail.trim());
      setSuccessMsg(res.message || 'Password reset code sent.');
      setForgotStep('verify');
      if (res.devResetCode) {
        setResetCode(res.devResetCode);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process password reset request.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Reset Password Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim() || !newPassword) {
      setError('Please enter the reset code and your new password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.customer.resetPassword(forgotEmail.trim(), resetCode.trim(), newPassword);
      setSuccessMsg(res.message || 'Password reset successfully! You can now log in.');
      setEmailAuthMode('login');
      setForgotStep('request');
      setForgotEmail('');
      setResetCode('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Logout
  const handleLogout = () => {
    clearCustomerToken();
    setIsAuthenticated(false);
    setCustomer(null);
    setBookings([]);
    setStep('phone');
    setPhoneInput('');
    setOtpInput('');
    setError(null);
    setSuccessMsg(null);
  };

  // 4. Update Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      const res = await api.customer.updateProfile({
        fullName: editName.trim(),
        email: editEmail.trim(),
        address: editAddress.trim()
      });
      setCustomer(res.customer);
      setIsEditingProfile(false);
      setSuccessMsg('Profile updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">
          SBM Guest Portal
        </span>
        <h1 className="text-3xl sm:text-4xl font-serif text-[#1A1A1A] font-medium">
          My Account
        </h1>
        <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
        <p className="text-xs sm:text-sm text-[#666666] max-w-xl mx-auto">
          Access your personal booking history, review confirmed reservations across SBM Hotel & SBM Guest House, and manage your guest profile securely via WhatsApp OTP.
        </p>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="max-w-xl mx-auto p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{error}</p>
            {isNotConfigured && (
              <p className="text-xs text-rose-700">
                To enable live WhatsApp OTP delivery, configure <code className="bg-rose-100 px-1 py-0.5 font-mono">BHASHSMS_API_URL</code> and <code className="bg-rose-100 px-1 py-0.5 font-mono">BHASHSMS_API_KEY</code> (or User/Password) in the server environment variables.
              </p>
            )}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="max-w-xl mx-auto p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-3 shadow-xs">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}

      {/* UNAUTHENTICATED VIEW: THREE CLEAR OPTIONS */}
      {!isAuthenticated ? (
        <div className="max-w-xl mx-auto bg-white border border-[#C5A059]/20 p-6 sm:p-8 shadow-sm space-y-6">
          {/* Three Clear Options Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 p-1.5 bg-[#F5F3EF] rounded-xl border border-stone-200 text-xs font-semibold text-center gap-1.5">
            <button
              type="button"
              onClick={() => { setAuthMainTab('signin'); setError(null); setSuccessMsg(null); }}
              className={`py-2.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMainTab === 'signin'
                  ? 'bg-[#1A1A1A] text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-white/80'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMainTab('register'); setRegStep('form'); setError(null); setSuccessMsg(null); }}
              className={`py-2.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMainTab === 'register'
                  ? 'bg-[#1A1A1A] text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-white/80'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>New User? Create Account</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMainTab('mobile_otp'); setError(null); setSuccessMsg(null); }}
              className={`py-2.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMainTab === 'mobile_otp'
                  ? 'bg-[#1A1A1A] text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-white/80'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
              <span>Continue with Mobile</span>
            </button>
          </div>

          {/* 1. SIGN IN (MOBILE OTP OR EMAIL) */}
          {authMainTab === 'signin' && (
            <div className="space-y-6">
              {/* Sign In Sub-Tabs */}
              <div className="flex bg-[#F7F5F0] p-1 rounded-lg border border-stone-200 text-xs font-semibold gap-1">
                <button
                  type="button"
                  onClick={() => { setSignInSubTab('mobile'); setError(null); setSuccessMsg(null); }}
                  className={`flex-1 py-2 px-3 rounded-md transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    signInSubTab === 'mobile'
                      ? 'bg-white text-[#1A1A1A] font-bold shadow-xs border border-stone-200/80'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>Mobile Number (WhatsApp OTP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setSignInSubTab('email'); setError(null); setSuccessMsg(null); }}
                  className={`flex-1 py-2 px-3 rounded-md transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    signInSubTab === 'email'
                      ? 'bg-white text-[#1A1A1A] font-bold shadow-xs border border-stone-200/80'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Email Address</span>
                </button>
              </div>

              {signInSubTab === 'mobile' ? (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-[#1A1A1A] text-[#C5A059] rounded-full flex items-center justify-center mx-auto shadow-xs">
                      <MessageSquare className="w-6 h-6 text-[#25D366]" />
                    </div>
                    <h2 className="text-xl font-serif text-[#1A1A1A] font-semibold">
                      Sign In with WhatsApp OTP
                    </h2>
                    <p className="text-xs text-[#666666]">
                      {step === 'phone'
                        ? 'Enter your mobile number to receive a secure One-Time Password (OTP) on WhatsApp.'
                        : `Enter the 6-digit OTP sent to ${maskedPhone}.`}
                    </p>
                  </div>

                  {step === 'phone' ? (
                    <form onSubmit={handleRequestOtp} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                          Mobile Number
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            required
                            placeholder="e.g. 9983567921"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            className="w-full bg-[#FDFCFB] border border-stone-200 pl-10 pr-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                          />
                          <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                      >
                        <MessageSquare className="w-4 h-4 text-[#25D366]" />
                        <span>{loading ? 'Requesting OTP...' : 'GET WHATSAPP OTP'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                          6-Digit WhatsApp OTP
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          placeholder="123456"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-[#FDFCFB] border border-stone-200 px-4 py-3 text-center text-xl font-mono tracking-widest text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                        />
                        <p className="text-[11px] text-stone-500 mt-1.5 flex items-center justify-between">
                          <span>Valid for 10 minutes</span>
                          {cooldown > 0 ? (
                            <span className="text-[#C5A059] font-medium">Resend in {cooldown}s</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRequestOtp()}
                              disabled={loading}
                              className="text-[#C5A059] hover:underline font-semibold cursor-pointer"
                            >
                              Resend OTP
                            </button>
                          )}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || otpInput.length !== 6}
                        className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                        <span>{loading ? 'Verifying...' : 'VERIFY & SIGN IN'}</span>
                      </button>

                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => { setStep('phone'); setError(null); }}
                          className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                        >
                          &larr; Change mobile number
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-[#1A1A1A] text-[#C5A059] rounded-full flex items-center justify-center mx-auto shadow-xs">
                      <User className="w-6 h-6 text-[#C5A059]" />
                    </div>
                    <h2 className="text-xl font-serif text-[#1A1A1A] font-semibold">
                      {emailAuthMode === 'login' ? 'Sign In with Email' : 'Reset Password'}
                    </h2>
                    <p className="text-xs text-[#666666]">
                      {emailAuthMode === 'login'
                        ? 'Enter your registered email address and password.'
                        : (forgotStep === 'request' ? 'Enter your registered email to receive a password reset code.' : 'Enter reset code and new password.')}
                    </p>
                  </div>

                  {emailAuthMode === 'login' ? (
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. guest@example.com"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => { setEmailAuthMode('forgot'); setError(null); setSuccessMsg(null); }}
                            className="text-[11px] text-[#C5A059] hover:underline font-medium cursor-pointer"
                          >
                            Forgot Password?
                          </button>
                        </div>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                      >
                        <span>{loading ? 'Signing In...' : 'SIGN IN WITH EMAIL'}</span>
                      </button>

                      <div className="text-center pt-2">
                        <p className="text-xs text-stone-600">
                          New to SBM Hotel?{' '}
                          <button
                            type="button"
                            onClick={() => { setAuthMainTab('register'); setError(null); setSuccessMsg(null); }}
                            className="text-[#C5A059] font-bold hover:underline cursor-pointer"
                          >
                            Create Account
                          </button>
                        </p>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      {forgotStep === 'request' ? (
                        <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                              Registered Email Address
                            </label>
                            <input
                              type="email"
                              required
                              placeholder="e.g. guest@example.com"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                          >
                            <span>{loading ? 'Sending Code...' : 'SEND RESET CODE'}</span>
                          </button>
                          <div className="text-center pt-2">
                            <button
                              type="button"
                              onClick={() => { setEmailAuthMode('login'); setForgotStep('request'); setError(null); setSuccessMsg(null); }}
                              className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                            >
                              &larr; Back to Sign In
                            </button>
                          </div>
                        </form>
                      ) : (
                        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                              6-Digit Reset Code
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={6}
                              placeholder="123456"
                              value={resetCode}
                              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-[#FDFCFB] border border-stone-200 px-4 py-3 text-center text-xl font-mono tracking-widest text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                              New Password (min 6 characters)
                            </label>
                            <input
                              type="password"
                              required
                              minLength={6}
                              placeholder="••••••••"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                          >
                            <span>{loading ? 'Resetting...' : 'RESET PASSWORD & LOGIN'}</span>
                          </button>
                          <div className="text-center pt-2">
                            <button
                              type="button"
                              onClick={() => { setForgotStep('request'); setError(null); setSuccessMsg(null); }}
                              className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                            >
                              &larr; Resend code
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. NEW USER? CREATE ACCOUNT */}
          {authMainTab === 'register' && (
            <div className="space-y-6">
              {regStep === 'form' ? (
                <>
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-[#1A1A1A] text-[#C5A059] rounded-full flex items-center justify-center mx-auto shadow-xs">
                      <UserPlus className="w-6 h-6 text-[#C5A059]" />
                    </div>
                    <h2 className="text-xl font-serif text-[#1A1A1A] font-semibold">
                      New User? Create Account
                    </h2>
                    <p className="text-xs text-[#666666]">
                      Register your profile to access booking history across SBM Hotel & Guest House.
                    </p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rajesh Sharma"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                        Mobile Number *
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 9983567921"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          className="w-full bg-[#FDFCFB] border border-stone-200 pl-10 pr-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                        />
                        <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1">We will send a 6-digit WhatsApp OTP to verify this number.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                        Email Address *
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          placeholder="e.g. rajesh@example.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full bg-[#FDFCFB] border border-stone-200 pl-10 pr-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                        />
                        <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                        Password * (min 6 characters)
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="••••••••"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full bg-[#FDFCFB] border border-stone-200 pl-10 pr-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                        />
                        <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="••••••••"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          className="w-full bg-[#FDFCFB] border border-stone-200 pl-10 pr-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                        />
                        <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4 text-[#C5A059]" />
                      <span>{loading ? 'Processing...' : 'CREATE ACCOUNT'}</span>
                    </button>

                    <div className="text-center pt-2">
                      <p className="text-xs text-stone-600">
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => { setAuthMainTab('signin'); setSignInSubTab('email'); setError(null); setSuccessMsg(null); }}
                          className="text-[#C5A059] font-bold hover:underline cursor-pointer"
                        >
                          Sign In
                        </button>
                      </p>
                    </div>
                  </form>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-[#1A1A1A] text-[#C5A059] rounded-full flex items-center justify-center mx-auto shadow-xs">
                      <MessageSquare className="w-6 h-6 text-[#25D366]" />
                    </div>
                    <h2 className="text-xl font-serif text-[#1A1A1A] font-semibold">
                      Verify Your Mobile Number
                    </h2>
                    <p className="text-xs text-[#666666]">
                      Enter the 6-digit WhatsApp OTP sent to <span className="font-semibold text-stone-900">{maskedPhone}</span> to activate your account.
                    </p>
                  </div>

                  <form onSubmit={handleVerifyRegOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                        6-Digit WhatsApp OTP
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="123456"
                        value={regOtpInput}
                        onChange={(e) => setRegOtpInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-[#FDFCFB] border border-stone-200 px-4 py-3 text-center text-xl font-mono tracking-widest text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                      />
                      <p className="text-[11px] text-stone-500 mt-1.5 flex items-center justify-between">
                        <span>Valid for 10 minutes</span>
                        {cooldown > 0 ? (
                          <span className="text-[#C5A059] font-medium">Resend in {cooldown}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendRegOtp}
                            disabled={loading}
                            className="text-[#C5A059] hover:underline font-semibold cursor-pointer"
                          >
                            Resend OTP
                          </button>
                        )}
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || regOtpInput.length !== 6}
                      className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                      <span>{loading ? 'Verifying...' : 'VERIFY & ACTIVATE ACCOUNT'}</span>
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => { setRegStep('form'); setError(null); }}
                        className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                      >
                        &larr; Edit registration details
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 3. CONTINUE WITH MOBILE NUMBER (DIRECT WHATSAPP OTP) */}
          {authMainTab === 'mobile_otp' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-[#1A1A1A] text-[#C5A059] rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <MessageSquare className="w-6 h-6 text-[#25D366]" />
                </div>
                <h2 className="text-xl font-serif text-[#1A1A1A] font-semibold">
                  Continue with Mobile Number
                </h2>
                <p className="text-xs text-[#666666]">
                  {step === 'phone'
                    ? 'Instant WhatsApp OTP verification for fast guest access.'
                    : `Enter the 6-digit WhatsApp OTP sent to ${maskedPhone}.`}
                </p>
              </div>

              {step === 'phone' ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9983567921"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className="w-full bg-[#FDFCFB] border border-stone-200 pl-10 pr-3.5 py-3 text-[#1A1A1A] text-sm focus:outline-none focus:border-[#C5A059]"
                      />
                      <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                  >
                    <MessageSquare className="w-4 h-4 text-[#25D366]" />
                    <span>{loading ? 'Sending OTP...' : 'CONTINUE WITH WHATSAPP'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider mb-1">
                      6-Digit WhatsApp OTP
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="123456"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[#FDFCFB] border border-stone-200 px-4 py-3 text-center text-xl font-mono tracking-widest text-[#1A1A1A] focus:outline-none focus:border-[#C5A059]"
                    />
                    <p className="text-[11px] text-stone-500 mt-1.5 flex items-center justify-between">
                      <span>Valid for 10 minutes</span>
                      {cooldown > 0 ? (
                        <span className="text-[#C5A059] font-medium">Resend in {cooldown}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestOtp()}
                          disabled={loading}
                          className="text-[#C5A059] hover:underline font-semibold cursor-pointer"
                        >
                          Resend OTP
                        </button>
                      )}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpInput.length !== 6}
                    className="w-full bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold py-3.5 px-6 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                    <span>{loading ? 'Verifying...' : 'VERIFY & CONTINUE'}</span>
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { setStep('phone'); setError(null); }}
                      className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                    >
                      &larr; Change mobile number
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Secure Trust Notice */}
          <div className="pt-4 border-t border-stone-100 text-center">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-stone-500 uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
              Secured with Encrypted Authentication & JWT Sessions
            </span>
          </div>
        </div>
      ) : (
        /* VIEW 2: AUTHENTICATED CUSTOMER PORTAL */
        <div className="space-y-8">
          {/* Profile Card & Account Summary */}
          <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-14 h-14 bg-[#FAF8F5] border-2 border-[#C5A059] text-[#1A1A1A] rounded-full flex items-center justify-center font-serif text-2xl font-bold shrink-0 shadow-2xs">
                {customer?.fullName?.charAt(0) || 'G'}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-serif text-[#1A1A1A] font-bold">
                    {customer?.fullName || 'Valued Guest'}
                  </h2>
                  {customer?.isVerified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider rounded-xs">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Verified Mobile
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#666666]">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
                    {customer?.phone}
                  </span>
                  {customer?.email && (
                    <span>• {customer.email}</span>
                  )}
                  {customer?.city && (
                    <span>• {customer.city}, {customer.country || 'India'}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="px-4 py-2 border border-stone-200 text-stone-700 hover:border-[#C5A059] hover:text-[#C5A059] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-rose-700 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#FAF8F5] border border-[#C5A059]/20 p-5 shadow-2xs space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#666666] font-semibold">Total Bookings</span>
              <p className="text-2xl font-serif text-[#1A1A1A] font-bold">{bookings.length}</p>
              <p className="text-[11px] text-stone-500">Across SBM Hotel & SBM Guest House</p>
            </div>
            <div className="bg-[#FAF8F5] border border-[#C5A059]/20 p-5 shadow-2xs space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#666666] font-semibold">Total Spent</span>
              <p className="text-2xl font-serif text-[#1A1A1A] font-bold">
                ₹{bookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0).toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-stone-500">Includes all stay dates</p>
            </div>
            <div className="bg-[#FAF8F5] border border-[#C5A059]/20 p-5 shadow-2xs space-y-1 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#666666] font-semibold">Ready for Darshan?</span>
                <p className="text-xs text-stone-600 mt-1">Book your next spiritual pilgrimage directly with us.</p>
              </div>
              {onOpenBookingModal && (
                <button
                  type="button"
                  onClick={onOpenBookingModal}
                  className="text-xs text-[#C5A059] font-bold uppercase tracking-wider hover:underline text-left cursor-pointer pt-2"
                >
                  + Book Another Room &rarr;
                </button>
              )}
            </div>
          </div>

          {/* Bookings Section */}
          <div className="bg-white border border-[#C5A059]/20 shadow-sm space-y-4 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-xl font-serif text-[#1A1A1A] font-semibold">
                  Your Booking History
                </h3>
                <p className="text-xs text-[#666666]">
                  Real-time status of current and past room reservations linked to {customer?.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={loadCustomerData}
                disabled={loadingData}
                className="text-xs text-[#C5A059] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                Refresh History
              </button>
            </div>

            {loadingData ? (
              <div className="py-12 text-center text-xs text-stone-500">
                Loading your reservations...
              </div>
            ) : bookings.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <CalendarCheck className="w-12 h-12 text-stone-300 mx-auto" />
                <p className="text-base font-serif text-[#1A1A1A]">No bookings found for this mobile number yet.</p>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  When you make a reservation on the website using this mobile number, it will automatically appear here.
                </p>
                {onOpenBookingModal && (
                  <button
                    type="button"
                    onClick={onOpenBookingModal}
                    className="mt-2 inline-flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-5 py-2.5 text-xs uppercase tracking-widest font-semibold transition-colors cursor-pointer"
                  >
                    Book Your Stay Now
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => {
                  const isConfirmed = booking.booking_status === 'Confirmed' || booking.payment_status === 'Completed' || booking.payment_status === 'Paid';
                  const isPending = booking.booking_status === 'Pending' || booking.payment_status === 'Pending';
                  const isCancelled = booking.booking_status === 'Cancelled';

                  return (
                    <div
                      key={booking.id}
                      className="border border-stone-200 hover:border-[#C5A059]/40 p-5 transition-all bg-[#FDFCFB] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xs"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#C5A059]">
                            {booking.booking_number}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1A1A1A] bg-stone-100 px-2 py-0.5">
                            <Building className="w-3 h-3 text-[#C5A059]" />
                            {booking.property_name || (booking.property_code === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel')}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-xs ${
                              isConfirmed
                                ? 'bg-emerald-100 text-emerald-800'
                                : isCancelled
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {booking.booking_status || 'Confirmed'}
                          </span>
                        </div>

                        <div className="text-xs text-[#1A1A1A] font-medium">
                          {booking.rooms_requested} × {booking.room_name}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#666666]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
                            {booking.check_in} to {booking.check_out} ({booking.nights} Nights)
                          </span>
                          <span>• {booking.adults} Adults, {booking.children || 0} Children</span>
                        </div>

                        {booking.whatsapp_status === 'sent' && (
                          <div className="text-[10px] text-emerald-700 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            WhatsApp confirmation delivered
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between w-full md:w-auto gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-stone-200">
                        <div className="text-left md:text-right">
                          <span className="text-[10px] uppercase tracking-wider text-stone-500 block">Total Amount</span>
                          <span className="text-lg font-bold text-[#1A1A1A]">
                            ₹{Number(booking.total_amount).toLocaleString('en-IN')}
                          </span>
                          <span
                            className={`block text-[10px] font-semibold uppercase ${
                              booking.payment_status === 'Completed' || booking.payment_status === 'Paid'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            Payment: {booking.payment_status}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedVoucherBooking(booking)}
                          className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] uppercase tracking-wider font-semibold transition-colors cursor-pointer w-full sm:w-auto text-center"
                        >
                          View Digital Voucher
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#C5A059]/30 max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h3 className="text-lg font-serif font-bold text-[#1A1A1A]">
                Edit Guest Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2 text-sm focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. guest@gmail.com"
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2 text-sm focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">Address / City</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="e.g. Jaipur, Rajasthan"
                  className="w-full bg-[#FDFCFB] border border-stone-200 px-3.5 py-2 text-sm focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Voucher Modal */}
      {selectedVoucherBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#C5A059]/30 max-w-3xl w-full p-6 space-y-4 shadow-2xl relative my-8">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-[#C5A059]">
                Booking Reference: {selectedVoucherBooking.booking_number}
              </span>
              <button
                type="button"
                onClick={() => setSelectedVoucherBooking(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <BookingVoucher booking={selectedVoucherBooking} />

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setSelectedVoucherBooking(null)}
                className="text-xs text-[#C5A059] hover:underline font-semibold cursor-pointer"
              >
                &larr; Close Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
