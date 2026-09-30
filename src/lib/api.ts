import {
  Property,
  RoomType,
  Booking,
  BlockedRoom,
  Inquiry,
  HotelSettings,
  AvailabilitySearchQuery,
  RoomAvailabilityResult,
  ManagedImage,
  PMSCalendarData,
  PMSDashboardStats,
  PMSReportsData,
  Guest,
  PaymentRecord,
  PMSHousekeepingStatus,
  PMSOperationalStatus,
  ChannelConnection,
  ChannelConfig,
  ChannelRoomMapping,
  PMSRatePlan,
  ChannelRateMapping,
  SyncJob,
  NormalizedOTAReservation,
  ChannelInventorySummary,
  AboutPageImage
} from '../types';

const ADMIN_TOKEN_KEY = 'sbm_admin_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options?.headers as Record<string, string>)
  };

  const token = getAdminToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';

  let data: any;
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = { error: `Failed to parse response from server (${res.status})` };
    }
  } else {
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(`Server request failed with status ${res.status}: ${res.statusText || 'Server Error'}`);
      }
      throw new Error(`Server returned unexpected format (${contentType || 'non-JSON'}). Please try again or contact hotel reception.`);
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  // Public
  getProperties: () => request<Property[]>('/api/properties'),
  getPropertyByCode: (code: string) => request<Property>(`/api/properties/${code}`),
  getRoomTypes: (propertyCode?: string) => {
  const params = new URLSearchParams();

  if (propertyCode) {
    params.set('propertyCode', propertyCode);
  }

  params.set('_t', Date.now().toString());

  return request<RoomType[]>(
    `/api/room-types?${params.toString()}`
  );
},
  checkAvailability: (query: AvailabilitySearchQuery) => request<RoomAvailabilityResult[]>('/api/availability/check', {
    method: 'POST',
    body: JSON.stringify(query)
  }),
  createBooking: (bookingData: Partial<Booking>) => request<Booking>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData)
  }),
  lookupBooking: (bookingNumber: string, contact?: string) =>
    request<Booking>(`/api/bookings/lookup?bookingNumber=${encodeURIComponent(bookingNumber)}${contact ? `&contact=${encodeURIComponent(contact)}` : ''}`),
  createInquiry: (data: { name: string; phone: string; email: string; subject?: string; message: string }) =>
    request<Inquiry>('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getSettings: () => request<HotelSettings>('/api/settings'),

  // Razorpay Payments API
  getPaymentConfig: () => request<{ key_id: string; is_configured: boolean; mode: 'test' | 'live'; currency: string }>('/api/payments/config'),
  createPaymentOrder: (payload: any) => request<{
    success: boolean;
    order_id: string;
    amount: number;
    currency: string;
    key_id: string;
    booking_id: string;
    booking_number: string;
    total_amount: number;
    customer: { name: string; email: string; contact: string };
  }>('/api/payments/create-order', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  verifyPayment: (payload: {
    booking_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => request<{
    success: boolean;
    message: string;
    booking: Booking;
  }>('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  recordPaymentFailure: (payload: {
    booking_id: string;
    razorpay_order_id?: string;
    error_code?: string;
    error_description?: string;
  }) => request<{
    success: boolean;
    message: string;
    booking?: Booking;
  }>('/api/payments/failure', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Admin
  adminLogin: (email: string, pass: string) => request<{ token: string; admin: any }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pass })
  }),
  adminVerifyToken: () => request<{ valid: boolean; admin: any }>('/api/admin/verify'),
  getAdminOverview: () => request<any>('/api/admin/overview'),
  getAdminBookings: (filters?: { propertyCode?: string; bookingStatus?: string; paymentStatus?: string; search?: string; date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.propertyCode) params.set('propertyCode', filters.propertyCode);
    if (filters?.bookingStatus) params.set('bookingStatus', filters.bookingStatus);
    if (filters?.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.date) params.set('date', filters.date);
    return request<Booking[]>(`/api/admin/bookings?${params.toString()}`);
  },
  updateBooking: (id: string, updates: Partial<Booking>) => request<Booking>(`/api/admin/bookings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }),
  updateRoomType: (id: string, updates: Partial<RoomType>) => request<RoomType>(`/api/admin/room-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }),
  updateProperty: (id: string, updates: Partial<Property>) => request<Property>(`/api/admin/properties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  }),
  getBlockedRooms: () => request<BlockedRoom[]>('/api/admin/blocked-rooms'),
  createBlockedRoom: (data: Partial<BlockedRoom>) => request<BlockedRoom>('/api/admin/blocked-rooms', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteBlockedRoom: (id: string) => request<{ success: boolean }>(`/api/admin/blocked-rooms/${id}`, {
    method: 'DELETE'
  }),
  getAdminInquiries: () => request<Inquiry[]>('/api/admin/inquiries'),
  updateInquiryStatus: (id: string, status: 'unread' | 'read' | 'resolved') => request<Inquiry>(`/api/admin/inquiries/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  }),
  deleteInquiry: (id: string) => request<{ success: boolean }>(`/api/admin/inquiries/${id}`, {
    method: 'DELETE'
  }),
  getAdminSettings: () => request<HotelSettings>('/api/admin/settings'),
  updateAdminSettings: (updates: Partial<HotelSettings>) => request<HotelSettings>('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(updates)
  }),

  // Admin sub-object for convenience
  admin: {
    getBookings: (token?: string, filters?: { propertyCode?: string; bookingStatus?: string; paymentStatus?: string; search?: string; date?: string }) => {
      const params = new URLSearchParams();
      if (filters?.propertyCode) params.set('propertyCode', filters.propertyCode);
      if (filters?.bookingStatus) params.set('bookingStatus', filters.bookingStatus);
      if (filters?.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.date) params.set('date', filters.date);
      return request<Booking[]>(`/api/admin/bookings?${params.toString()}`);
    },
    getPhysicalRooms: (token?: string, propertyCode?: string, date?: string) => {
      const params = new URLSearchParams();
      if (propertyCode) params.set('propertyCode', propertyCode);
      if (date) params.set('date', date);
      return request<any[]>(`/api/admin/physical-rooms?${params.toString()}`);
    },
    updatePhysicalRoom: (token: string, id: string, updates: any) =>
      request<any>(`/api/admin/physical-rooms/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }),
    addPhysicalRoom: (token: string, roomData: any) =>
      request<any>('/api/admin/physical-rooms', {
        method: 'POST',
        body: JSON.stringify(roomData)
      }),
    deletePhysicalRoom: (token: string, id: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/physical-rooms/${id}`, {
        method: 'DELETE'
      }),
    resetTestData: () =>
      request<{ success: boolean; message: string }>('/api/admin/reset-test-data', {
        method: 'POST'
      }),
    checkInBooking: (token: string, id: string, roomNumber?: string) =>
      request<Booking>(`/api/admin/check-in/${id}`, {
        method: 'POST',
        body: JSON.stringify({ roomNumber })
      }),
    checkOutBooking: (token: string, id: string) =>
      request<Booking>(`/api/admin/check-out/${id}`, {
        method: 'POST',
        body: JSON.stringify({})
      }),
    getActivities: (token?: string, propertyCode?: string) => {
      const params = new URLSearchParams();
      if (propertyCode) params.set('propertyCode', propertyCode);
      return request<any[]>(`/api/admin/activities?${params.toString()}`);
    },
    addActivity: (token: string, action: string, description: string, propertyCode?: string) =>
      request<any>('/api/admin/activities', {
        method: 'POST',
        body: JSON.stringify({ action, description, property_code: propertyCode })
      }),
    getKnowledgeBase: (token?: string, category?: string) => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      return request<any[]>(`/api/admin/knowledge-base?${params.toString()}`);
    },
    addKnowledgeItem: (token: string, item: any) =>
      request<any>('/api/admin/knowledge-base', {
        method: 'POST',
        body: JSON.stringify(item)
      }),
    updateKnowledgeItem: (token: string, id: string, updates: any) =>
      request<any>(`/api/admin/knowledge-base/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }),
    deleteKnowledgeItem: (token: string, id: string) =>
      request<{ success: boolean }>(`/api/admin/knowledge-base/${id}`, {
        method: 'DELETE'
      })
  },

  // Physical Rooms & Front Desk
  getPhysicalRooms: (token?: string, propertyCode?: string, date?: string) => {
    const params = new URLSearchParams();
    if (propertyCode) params.set('propertyCode', propertyCode);
    if (date) params.set('date', date);
    return request<any[]>(`/api/admin/physical-rooms?${params.toString()}`);
  },
  updatePhysicalRoom: (token: string, id: string, updates: any) =>
    request<any>(`/api/admin/physical-rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),
  addPhysicalRoom: (token: string, roomData: any) =>
    request<any>('/api/admin/physical-rooms', {
      method: 'POST',
      body: JSON.stringify(roomData)
    }),
  deletePhysicalRoom: (token: string, id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/physical-rooms/${id}`, {
      method: 'DELETE'
    }),
  resetTestData: () =>
    request<{ success: boolean; message: string }>('/api/admin/reset-test-data', {
      method: 'POST'
    }),
  checkInBooking: (token: string, id: string, roomNumber?: string) =>
    request<Booking>(`/api/admin/check-in/${id}`, {
      method: 'POST',
      body: JSON.stringify({ roomNumber })
    }),
  checkOutBooking: (token: string, id: string) =>
    request<Booking>(`/api/admin/check-out/${id}`, {
      method: 'POST',
      body: JSON.stringify({})
    }),
  getActivities: (token?: string, propertyCode?: string) => {
    const params = new URLSearchParams();
    if (propertyCode) params.set('propertyCode', propertyCode);
    return request<any[]>(`/api/admin/activities?${params.toString()}`);
  },
  addActivity: (token: string, action: string, description: string, propertyCode?: string) =>
    request<any>('/api/admin/activities', {
      method: 'POST',
      body: JSON.stringify({ action, description, property_code: propertyCode })
    }),

  // AI Knowledge Base
  getKnowledgeBase: (token?: string, category?: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    return request<any[]>(`/api/admin/knowledge-base?${params.toString()}`);
  },
  addKnowledgeItem: (token: string, item: any) =>
    request<any>('/api/admin/knowledge-base', {
      method: 'POST',
      body: JSON.stringify(item)
    }),
  updateKnowledgeItem: (token: string, id: string, updates: any) =>
    request<any>(`/api/admin/knowledge-base/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),
  deleteKnowledgeItem: (token: string, id: string) =>
    request<{ success: boolean }>(`/api/admin/knowledge-base/${id}`, {
      method: 'DELETE'
    }),

  // Public & Admin Image Management
  getImages: (filters?: { category?: string; roomId?: string; propertyId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.roomId) params.set('roomId', filters.roomId);
    if (filters?.propertyId) params.set('propertyId', filters.propertyId);
    return request<ManagedImage[]>(`/api/images?${params.toString()}`);
  },
  getAdminImages: (token?: string, filters?: { category?: string; roomId?: string; propertyId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.roomId) params.set('roomId', filters.roomId);
    if (filters?.propertyId) params.set('propertyId', filters.propertyId);
    return request<ManagedImage[]>(`/api/admin/images?${params.toString()}`);
  },
  addImage: (token: string, imageData: Partial<ManagedImage> | { images: Partial<ManagedImage>[] }) =>
    request<ManagedImage | ManagedImage[]>('/api/admin/images', {
      method: 'POST',
      body: JSON.stringify(imageData)
    }),
  updateImage: (token: string, id: string, updates: Partial<ManagedImage>) =>
    request<ManagedImage>(`/api/admin/images/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),
  deleteImage: (token: string, id: string) =>
    request<{ success: boolean }>(`/api/admin/images/${id}`, {
      method: 'DELETE'
    }),
  setPrimaryImage: (token: string, id: string, roomId?: string, propertyId?: string) =>
    request<ManagedImage>(`/api/admin/images/${id}/set-primary`, {
      method: 'PUT',
      body: JSON.stringify({ roomId, propertyId })
    }),
  reorderImages: (token: string, orderedIds: string[]) =>
    request<ManagedImage[]>('/api/admin/images/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds })
    }),

  // Dedicated About Page Images
  getAboutImages: () => request<AboutPageImage[]>('/api/about-images'),
  getAdminAboutImages: (token?: string) => request<AboutPageImage[]>('/api/admin/about-images'),
  saveAboutImage: (token: string, propertyId: string, imageUrl: string, title?: string, caption?: string) =>
    request<AboutPageImage>('/api/admin/about-images', {
      method: 'POST',
      body: JSON.stringify({ propertyId, imageUrl, title, caption })
    }),
  deleteAboutImage: (token: string, propertyId: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/about-images/${propertyId}`, {
      method: 'DELETE'
    }),

  // Email Notification Services
  resendBookingEmail: (token: string, bookingId: string, type: 'customer' | 'admin' | 'both' = 'customer') =>
    request<{ success: boolean; message: string; results?: any; booking?: Booking }>(`/api/admin/bookings/${bookingId}/resend-email`, {
      method: 'POST',
      body: JSON.stringify({ type })
    }),
  getEmailStatus: (token?: string) => request<any>('/api/admin/email/status'),
  verifySmtp: (token?: string) => request<{ success: boolean; message: string; details?: any }>('/api/admin/email/verify-smtp', {
    method: 'POST',
    body: JSON.stringify({})
  }),
  sendTestEmail: (token: string, targetEmail: string, bookingId?: string) =>
    request<{ success: boolean; simulated?: boolean; messageId?: string; recipient?: string; error?: string }>('/api/admin/email/test', {
      method: 'POST',
      body: JSON.stringify({ targetEmail, bookingId })
    }),

  // ==========================================
  // --- HOTEL PMS PHASE 1 FRONTEND CLIENT ---
  // ==========================================
  pms: {
    // 1. Calendar / Tape Chart
    getCalendarData: (propertyCode: string, startDate: string, days: number = 7) =>
      request<PMSCalendarData>(`/api/pms/calendar?propertyCode=${encodeURIComponent(propertyCode)}&startDate=${encodeURIComponent(startDate)}&days=${days}`),

    // 2. Dashboard Stats
    getDashboardStats: (propertyCode: string = 'all', date?: string) =>
      request<PMSDashboardStats>(`/api/pms/dashboard?propertyCode=${encodeURIComponent(propertyCode)}${date ? `&date=${encodeURIComponent(date)}` : ''}`),

    // 3. Reports
    getReports: (propertyCode: string = 'all', period: string = 'this_month', startDate?: string, endDate?: string) => {
      const params = new URLSearchParams({ propertyCode, period });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      return request<PMSReportsData>(`/api/pms/reports?${params.toString()}`);
    },

    // 4. Reservations
    getReservations: (filters?: { propertyCode?: string; status?: string; paymentStatus?: string; source?: string; search?: string; date?: string }) => {
      const params = new URLSearchParams();
      if (filters?.propertyCode) params.set('propertyCode', filters.propertyCode);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
      if (filters?.source) params.set('source', filters.source);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.date) params.set('date', filters.date);
      return request<Booking[]>(`/api/pms/reservations?${params.toString()}`);
    },

    getReservationById: (id: string) => request<Booking>(`/api/pms/reservations/${id}`),

    createReservation: (data: any) =>
      request<Booking>('/api/pms/reservations', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    checkIn: (id: string, roomNumber?: string) =>
      request<Booking>(`/api/pms/reservations/${id}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ roomNumber })
      }),

    checkOut: (id: string) =>
      request<Booking>(`/api/pms/reservations/${id}/check-out`, {
        method: 'POST',
        body: JSON.stringify({})
      }),

    changeRoom: (id: string, newRoomNumber: string) =>
      request<Booking>(`/api/pms/reservations/${id}/change-room`, {
        method: 'PUT',
        body: JSON.stringify({ newRoomNumber })
      }),

    cancelReservation: (id: string, reason?: string) =>
      request<Booking>(`/api/pms/reservations/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }),

    // 5. Payments
    recordPayment: (reservationId: string, data: { method: string; amount: number; transactionId?: string; paymentReference?: string; notes?: string }) =>
      request<{ payment: PaymentRecord; updatedBooking: Booking }>(`/api/pms/reservations/${reservationId}/payments`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    getReservationPayments: (reservationId: string) =>
      request<PaymentRecord[]>(`/api/pms/reservations/${reservationId}/payments`),

    getAllPayments: (filters?: { propertyCode?: string; method?: string; startDate?: string; endDate?: string }) => {
      const params = new URLSearchParams();
      if (filters?.propertyCode) params.set('propertyCode', filters.propertyCode);
      if (filters?.method) params.set('method', filters.method);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      return request<PaymentRecord[]>(`/api/pms/payments?${params.toString()}`);
    },

    // 6. Guests
    getGuests: (search?: string) =>
      request<Guest[]>(`/api/pms/guests${search ? `?search=${encodeURIComponent(search)}` : ''}`),

    getGuestById: (id: string) =>
      request<Guest>(`/api/pms/guests/${id}`),

    updateGuest: (id: string, updates: Partial<Guest>) =>
      request<Guest>(`/api/pms/guests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }),

    // 7. Rooms Status
    updateHousekeepingStatus: (id: string, housekeeping_status: PMSHousekeepingStatus) =>
      request<any>(`/api/pms/rooms/${id}/housekeeping`, {
        method: 'PUT',
        body: JSON.stringify({ housekeeping_status })
      }),

    updateOperationalStatus: (id: string, operational_status: PMSOperationalStatus, reason?: string) =>
      request<any>(`/api/pms/rooms/${id}/operational`, {
        method: 'PUT',
        body: JSON.stringify({ operational_status, reason })
      }),

    // 8. Channels (legacy overview)
    getChannels: () => request<ChannelConnection[]>('/api/pms/channels'),

    // 9. Inventory Hold
    acquireLock: (data: { propertyCode: string; roomTypeId: string; checkIn: string; checkOut: string; count?: number; sessionId: string }) =>
      request<{ success: boolean; lock?: any }>('/api/inventory/lock', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    releaseLock: (lockId: string) =>
      request<{ success: boolean }>('/api/inventory/release-lock', {
        method: 'POST',
        body: JSON.stringify({ lockId })
      })
  },

  // CHANNEL MANAGER CORE API
  channelManager: {
    getChannels: () => request<ChannelConfig[]>('/api/admin/channels'),
    getChannelById: (id: string) => request<ChannelConfig>(`/api/admin/channels/${id}`),
    updateChannel: (id: string, updates: Partial<ChannelConfig>) =>
      request<ChannelConfig>(`/api/admin/channels/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      }),
    testChannel: (id: string) =>
      request<{ success: boolean; message: string; details?: any }>(`/api/admin/channels/${id}/test`, {
        method: 'POST'
      }),
    syncChannel: (id: string) =>
      request<{ success: boolean; message: string; jobsQueued: number }>(`/api/admin/channels/${id}/sync`, {
        method: 'POST'
      }),
    syncAllChannels: () =>
      request<{ success: boolean; message: string; totalChannels: number; activeChannels: number; jobsQueued: number }>('/api/admin/channels/sync-all', {
        method: 'POST'
      }),
    getInventory: (params?: { propertyCode?: string; startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams();
      if (params?.propertyCode) q.set('propertyCode', params.propertyCode);
      if (params?.startDate) q.set('startDate', params.startDate);
      if (params?.endDate) q.set('endDate', params.endDate);
      return request<ChannelInventorySummary[]>(`/api/admin/channels/inventory?${q.toString()}`);
    },
    getRoomMappings: (params?: { channelId?: string; propertyCode?: string }) => {
      const q = new URLSearchParams();
      if (params?.channelId) q.set('channelId', params.channelId);
      if (params?.propertyCode) q.set('propertyCode', params.propertyCode);
      return request<ChannelRoomMapping[]>(`/api/admin/channels/mappings/rooms?${q.toString()}`);
    },
    saveRoomMapping: (mapping: Partial<ChannelRoomMapping>) =>
      request<ChannelRoomMapping>('/api/admin/channels/mappings/rooms', {
        method: 'POST',
        body: JSON.stringify(mapping)
      }),
    deleteRoomMapping: (id: string) =>
      request<{ success: boolean }>(`/api/admin/channels/mappings/rooms/${id}`, {
        method: 'DELETE'
      }),
    getPMSRatePlans: (params?: { propertyCode?: string; roomTypeId?: string }) => {
      const q = new URLSearchParams();
      if (params?.propertyCode) q.set('propertyCode', params.propertyCode);
      if (params?.roomTypeId) q.set('roomTypeId', params.roomTypeId);
      return request<PMSRatePlan[]>(`/api/admin/channels/rate-plans?${q.toString()}`);
    },
    savePMSRatePlan: (plan: Partial<PMSRatePlan>) =>
      request<PMSRatePlan>('/api/admin/channels/rate-plans', {
        method: 'POST',
        body: JSON.stringify(plan)
      }),
    deletePMSRatePlan: (id: string) =>
      request<{ success: boolean }>(`/api/admin/channels/rate-plans/${id}`, {
        method: 'DELETE'
      }),
    getRateMappings: (params?: { channelId?: string; propertyCode?: string }) => {
      const q = new URLSearchParams();
      if (params?.channelId) q.set('channelId', params.channelId);
      if (params?.propertyCode) q.set('propertyCode', params.propertyCode);
      return request<ChannelRateMapping[]>(`/api/admin/channels/mappings/rates?${q.toString()}`);
    },
    saveRateMapping: (mapping: Partial<ChannelRateMapping>) =>
      request<ChannelRateMapping>('/api/admin/channels/mappings/rates', {
        method: 'POST',
        body: JSON.stringify(mapping)
      }),
    deleteRateMapping: (id: string) =>
      request<{ success: boolean }>(`/api/admin/channels/mappings/rates/${id}`, {
        method: 'DELETE'
      }),
    getSyncJobs: (filters?: {
      channel_id?: string;
      channel_code?: string;
      status?: string;
      operation?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }) => {
      const q = new URLSearchParams();
      if (filters?.channel_id) q.set('channel_id', filters.channel_id);
      if (filters?.channel_code) q.set('channel_code', filters.channel_code);
      if (filters?.status) q.set('status', filters.status);
      if (filters?.operation) q.set('operation', filters.operation);
      if (filters?.startDate) q.set('startDate', filters.startDate);
      if (filters?.endDate) q.set('endDate', filters.endDate);
      if (filters?.limit) q.set('limit', filters.limit.toString());
      return request<SyncJob[]>(`/api/admin/channels/jobs?${q.toString()}`);
    },
    retrySyncJob: (id: string) =>
      request<SyncJob>(`/api/admin/channels/jobs/${id}/retry`, {
        method: 'POST'
      }),
    importOTAReservation: (data: NormalizedOTAReservation) =>
      request<{ success: boolean; isExisting: boolean; booking: any; message: string }>('/api/admin/channels/ota/import', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },

  // Email Notifications Management
  email: {
    getStatus: () =>
      request<{
        is_configured: boolean;
        host: string | null;
        port: number;
        from: string;
        admin_email: string;
        has_user: boolean;
        has_password: boolean;
      }>('/api/admin/email/status'),
    sendTestEmail: (data: { targetEmail?: string; bookingId?: string }) =>
      request<{
        success: boolean;
        simulated: boolean;
        messageId?: string;
        recipient: string;
        booking_number: string;
        error?: string;
      }>('/api/admin/email/test', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  }
};

