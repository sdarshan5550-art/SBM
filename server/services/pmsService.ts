import { db } from '../db';
import { PMSCalendarData, PMSDashboardStats, PMSReportData, BookingSource, PropertyCode } from '../../src/types';

export const pmsService = {
  // 1. PMS Calendar Grid Data
  getCalendarData(propertyCode: string = 'sbm-hotel', startDateStr?: string, daysCount: number = 7): PMSCalendarData {
    const today = new Date();
    const start = startDateStr ? new Date(startDateStr) : today;

    const dates: string[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // Fetch physical rooms
    const rooms = db.getPhysicalRooms(propertyCode);

    // Fetch all active reservations spanning this date range
    const allBookings = db.getBookings({ property_code: propertyCode === 'both' ? undefined : propertyCode });
    const relevantBookings = allBookings.filter(b => {
      if (b.booking_status === 'Cancelled') return false;
      // Check date overlap: reservation check_in < endDate AND reservation check_out > startDate
      return b.check_in <= endDate && b.check_out >= startDate;
    }).map(b => {
      const payments = db.getPaymentsForReservation(b.id);
      const paid = payments.reduce((sum, p) => sum + (p.status === 'PAID' ? Number(p.amount) : 0), 0);
      const total = Number(b.total_amount) || 0;
      const outstanding = Math.max(0, total - paid);

      return {
        ...b,
        source: (b.source || 'WEBSITE') as BookingSource,
        paid_amount: paid,
        outstanding_amount: outstanding
      };
    });

    const unassignedReservations = relevantBookings.filter(b => !b.room_number);

    return {
      dates,
      startDate,
      endDate,
      rooms: rooms.map(r => ({
        id: r.id,
        property_id: r.property_code === 'sbm-guest-house' ? 'prop-sbm-guesthouse' : 'prop-sbm-hotel',
        property_code: r.property_code,
        property_name: r.property_name,
        room_type_id: r.room_type_id,
        room_code: r.room_code,
        room_name: r.room_name,
        room_number: r.room_number,
        floor: r.floor || 'Ground Floor',
        operational_status: r.status === 'Maintenance' ? 'OUT_OF_ORDER' : (r.status === 'Blocked' ? 'BLOCKED' : 'AVAILABLE'),
        housekeeping_status: r.housekeeping_status || 'CLEAN',
        maintenance_reason: r.maintenance_reason,
        active: true
      })),
      reservations: relevantBookings,
      unassignedReservations
    };
  },

  // 2. PMS Dashboard Comprehensive Statistics
  getDashboardStats(propertyCode?: string, dateStr?: string): PMSDashboardStats {
    const todayStr = dateStr || new Date().toISOString().split('T')[0];
    const isFiltered = propertyCode && propertyCode !== 'all' && propertyCode !== 'both';
    const allBookings = db.getBookings({ property_code: isFiltered ? (propertyCode as PropertyCode) : undefined });
    const allRooms = db.getPhysicalRooms(isFiltered ? propertyCode : undefined);
    const allBlocked = db.getBlockedRooms();
    const activities = db.getActivities(isFiltered ? propertyCode : undefined).slice(0, 10);

    const todayArrivals = allBookings.filter(b => b.check_in === todayStr && b.booking_status !== 'Cancelled');
    const todayDepartures = allBookings.filter(b => b.check_out === todayStr && b.booking_status !== 'Cancelled');
    
    const inHouseBookings = allBookings.filter(b =>
      b.check_in <= todayStr &&
      todayStr < b.check_out &&
      (b.booking_status === 'Checked In' || b.booking_status === 'Confirmed')
    );

    const inHouseGuests = inHouseBookings.reduce((sum, b) => sum + (Number(b.adults || 2) + Number(b.children || 0)), 0);
    const inHouseRooms = inHouseBookings.reduce((sum, b) => sum + Number(b.rooms_requested || 1), 0);

    const totalPhysicalRooms = allRooms.length;
    const blockedCount = allBlocked.filter(br => br.start_date <= todayStr && todayStr < br.end_date).length;
    const occupiedCount = inHouseRooms;
    const availableCount = Math.max(0, totalPhysicalRooms - occupiedCount - blockedCount);
    const occupancyPercentage = totalPhysicalRooms > 0 ? Math.min(100, Math.round((occupiedCount / totalPhysicalRooms) * 100)) : 0;

    // Today's revenue
    const todayPayments = db.getAllPayments({ startDate: todayStr, endDate: todayStr });
    const todayRevenue = todayPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Total revenue
    const totalRevenue = allBookings
      .filter(b => b.booking_status !== 'Cancelled')
      .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

    // Pending payments
    const pendingPaymentsAmount = allBookings
      .filter(b => b.booking_status !== 'Cancelled' && (b.payment_status === 'Pending' || b.payment_status === 'Partial'))
      .reduce((sum, b) => {
        const payments = db.getPaymentsForReservation(b.id);
        const paid = payments.reduce((pSum, p) => pSum + (p.status === 'PAID' ? Number(p.amount) : 0), 0);
        return sum + Math.max(0, Number(b.total_amount) - paid);
      }, 0);

    // Source breakdown
    const sources: BookingSource[] = ['WEBSITE', 'WALK_IN', 'PHONE', 'WHATSAPP', 'ADMIN', 'MMT', 'GOIBIBO'];
    const sourceBreakdown = sources.map(src => {
      const srcBookings = allBookings.filter(b => (b.source || 'WEBSITE') === src && b.booking_status !== 'Cancelled');
      return {
        source: src,
        count: srcBookings.length,
        revenue: srcBookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0)
      };
    });

    return {
      today_date: todayStr,
      today_arrivals_count: todayArrivals.length,
      today_departures_count: todayDepartures.length,
      in_house_guests_count: inHouseGuests,
      in_house_rooms_count: inHouseRooms,
      available_rooms_count: availableCount,
      occupied_rooms_count: occupiedCount,
      blocked_rooms_count: blockedCount,
      occupancy_percentage: occupancyPercentage,
      today_revenue: todayRevenue,
      total_revenue: totalRevenue,
      pending_payments_amount: pendingPaymentsAmount,
      source_breakdown: sourceBreakdown,
      recent_activities: activities
    };
  },

  // 3. PMS Reports
  getReports(propertyCode: string = 'all', period: string = 'this_month', customStart?: string, customEnd?: string): PMSReportData {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let startDate = new Date();
    let endDate = new Date();

    if (period === 'today') {
      startDate = new Date(today);
      endDate = new Date(today);
    } else if (period === 'yesterday') {
      startDate.setDate(today.getDate() - 1);
      endDate.setDate(today.getDate() - 1);
    } else if (period === 'this_week') {
      startDate.setDate(today.getDate() - today.getDay());
      endDate.setDate(startDate.getDate() + 6);
    } else if (period === 'this_month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (period === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const isFiltered = propertyCode && propertyCode !== 'all' && propertyCode !== 'both';
    const allBookings = db.getBookings({ property_code: isFiltered ? (propertyCode as PropertyCode) : undefined });
    const allPhysicalRooms = db.getPhysicalRooms(isFiltered ? propertyCode : undefined);
    const roomTypes = db.getRoomTypes(isFiltered ? propertyCode : undefined);
    const allBlocked = db.getBlockedRooms();

    // Filter active/relevant bookings for revenue & occupancy (stay date overlap)
    const activeBookings = allBookings.filter(b => {
      return b.check_in <= endStr && b.check_out >= startStr;
    });

    const nonCancelledBookings = activeBookings.filter(b => b.booking_status !== 'Cancelled');

    const totalRevenue = nonCancelledBookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    
    let paidRevenue = 0;
    let refundedRevenue = 0;
    nonCancelledBookings.forEach(b => {
      const payments = db.getPaymentsForReservation(b.id);
      paidRevenue += payments.reduce((sum, p) => sum + (p.status === 'PAID' ? Number(p.amount) : 0), 0);
      refundedRevenue += payments.reduce((sum, p) => sum + (p.status === 'REFUNDED' ? Number(p.amount) : 0), 0);
    });
    const outstandingRevenue = Math.max(0, totalRevenue - paidRevenue);

    const totalRooms = allPhysicalRooms.length;
    const occupiedRooms = nonCancelledBookings.reduce((sum, b) => sum + Number(b.rooms_requested || 1), 0);
    const blockedRooms = allBlocked.filter(br => br.start_date <= endStr && br.end_date >= startStr).length;
    const availableRooms = Math.max(0, totalRooms - occupiedRooms - blockedRooms);
    const occupancyRate = totalRooms > 0 ? Math.min(100, Math.round((occupiedRooms / totalRooms) * 100)) : 0;

    // Booking status counts
    const confirmedBookings = activeBookings.filter(b => b.booking_status === 'Confirmed' || b.booking_status === 'Checked In' || b.booking_status === 'Checked Out').length;
    const pendingBookings = activeBookings.filter(b => b.booking_status === 'Pending').length;
    const cancelledBookings = activeBookings.filter(b => b.booking_status === 'Cancelled').length;
    const checkedInBookings = activeBookings.filter(b => b.booking_status === 'Checked In').length;
    const checkedOutBookings = activeBookings.filter(b => b.booking_status === 'Checked Out').length;
    const totalBookings = activeBookings.length;

    const totalRoomsSold = occupiedRooms;
    const averageDailyRate = totalRoomsSold > 0 ? Math.round(totalRevenue / totalRoomsSold) : 0;
    const revPAR = totalRooms > 0 ? Math.round(totalRevenue / totalRooms) : 0;

    // Today arrivals & departures
    const todayArrivalsCount = allBookings.filter(b => b.check_in === todayStr && b.booking_status !== 'Cancelled').length;
    const todayDeparturesCount = allBookings.filter(b => b.check_out === todayStr && b.booking_status !== 'Cancelled').length;

    // Upcoming arrivals (next 7 days)
    const next7Days = new Date(today);
    next7Days.setDate(today.getDate() + 7);
    const next7DaysStr = next7Days.toISOString().split('T')[0];
    const upcomingArrivalsCount = allBookings.filter(b => b.check_in > todayStr && b.check_in <= next7DaysStr && b.booking_status !== 'Cancelled').length;
    const upcomingDeparturesCount = allBookings.filter(b => b.check_out > todayStr && b.check_out <= next7DaysStr && b.booking_status !== 'Cancelled').length;

    // Source breakdown
    const defaultSources = ['WEBSITE', 'WALK_IN', 'PHONE', 'WHATSAPP', 'ADMIN', 'MMT', 'GOIBIBO', 'BOOKING_COM', 'AGODA', 'EXPEDIA'];
    const activeSources = Array.from(new Set([...defaultSources, ...nonCancelledBookings.map(b => b.source || 'WEBSITE')]));
    const sourceBreakdown = activeSources.map(src => {
      const srcBookings = nonCancelledBookings.filter(b => (b.source || 'WEBSITE') === src);
      const rev = srcBookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
      return {
        source: src,
        count: srcBookings.length,
        revenue: rev,
        percentage: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0
      };
    }).filter(s => s.count > 0);

    // Room type performance
    const roomTypePerformance = roomTypes.map(rt => {
      const rtBookings = nonCancelledBookings.filter(b => b.room_type_id === rt.id || (b.room_name && b.room_name.toLowerCase().includes(rt.name.toLowerCase())));
      const roomsSold = rtBookings.reduce((sum, b) => sum + Number(b.rooms_requested || 1), 0);
      const rev = rtBookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
      const rtPhysicalCount = allPhysicalRooms.filter(pr => pr.room_type_id === rt.id || pr.room_code === rt.room_code).length;
      const rtOccRate = rtPhysicalCount > 0 ? Math.min(100, Math.round((roomsSold / rtPhysicalCount) * 100)) : 0;

      return {
        roomTypeId: rt.id,
        roomTypeName: rt.name,
        propertyCode: rt.property_code,
        roomsSold,
        revenue: rev,
        occupancyRate: rtOccRate
      };
    });

    // Payment breakdown
    const allPayments = db.getAllPayments({ propertyCode: isFiltered ? propertyCode : undefined, startDate: startStr, endDate: endStr });
    const paymentMethods = ['Razorpay', 'Cash', 'Card', 'Bank Transfer', 'UPI', 'ONLINE', 'CASH'];
    const activeMethods = Array.from(new Set([...paymentMethods, ...allPayments.map(p => p.method || 'Cash')]));
    const paymentBreakdown = activeMethods.map(method => {
      const methodPayments = allPayments.filter(p => (p.method || 'Cash').toLowerCase() === method.toLowerCase());
      const amount = methodPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return {
        method,
        count: methodPayments.length,
        amount
      };
    }).filter(p => p.count > 0 || p.amount > 0);

    // Property breakdown
    const propList: PropertyCode[] = ['sbm-hotel', 'sbm-guest-house'];
    const propertyBreakdown = propList.map(code => {
      const pBookings = nonCancelledBookings.filter(b => b.property_code === code);
      const rev = pBookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
      const pName = code === 'sbm-hotel' ? 'SBM Hotel' : 'SBM 2 Guest House';
      const propRooms = db.getPhysicalRooms(code).length;
      return {
        property_code: code,
        property_name: pName,
        total_bookings: pBookings.length,
        revenue: rev,
        occupancy_rate: propRooms > 0 ? Math.min(100, Math.round((pBookings.length / propRooms) * 100)) : 0
      };
    });

    return {
      period,
      startDate: startStr,
      endDate: endStr,
      totalRooms,
      occupiedRooms,
      availableRooms,
      blockedRooms,
      occupancyRate,
      totalRevenue,
      paidRevenue,
      outstandingRevenue,
      refundedRevenue,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      cancelledBookings,
      checkedInBookings,
      checkedOutBookings,
      totalRoomsSold,
      averageDailyRate,
      revPAR,
      todayArrivalsCount,
      todayDeparturesCount,
      upcomingArrivalsCount,
      upcomingDeparturesCount,
      bookingsBySource: sourceBreakdown,
      roomTypePerformance,
      paymentBreakdown,
      propertyBreakdown,
      // Snake case aliases
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
      available_rooms: availableRooms,
      blocked_rooms: blockedRooms,
      occupancy_rate: occupancyRate,
      total_revenue: totalRevenue,
      paid_revenue: paidRevenue,
      outstanding_revenue: outstandingRevenue,
      source_breakdown: sourceBreakdown,
      property_breakdown: propertyBreakdown
    };
  }
};
