import React, { useState } from 'react';
import { Calendar, Users, Building, Search, DoorClosed, Plus, Minus } from 'lucide-react';
import { PropertyCode, AvailabilitySearchQuery } from '../types';

interface HeroBookingWidgetProps {
  onSearch: (query: AvailabilitySearchQuery) => void;
  initialValues?: Partial<AvailabilitySearchQuery>;
}

export const HeroBookingWidget: React.FC<HeroBookingWidgetProps> = ({
  onSearch,
  initialValues
}) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const [propertyCode, setPropertyCode] = useState<PropertyCode | 'both'>(
    initialValues?.property_code || 'both'
  );
  const [checkIn, setCheckIn] = useState<string>(
    initialValues?.check_in || formatDate(today)
  );
  const [checkOut, setCheckOut] = useState<string>(
    initialValues?.check_out || formatDate(tomorrow)
  );
  const [adults, setAdults] = useState<number>(initialValues?.adults || 2);
  const [children, setChildren] = useState<number>(initialValues?.children || 0);
  const [rooms, setRooms] = useState<number>(initialValues?.rooms || 1);
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      property_code: propertyCode,
      check_in: checkIn,
      check_out: checkOut,
      adults,
      children,
      rooms
    });
  };

  return (
    <div className="w-full bg-white shadow-2xl border border-[#C5A059]/20 p-6 sm:p-8 text-[#1A1A1A]">
      <form onSubmit={handleSearchSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Property Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-[#999999] font-bold flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#C5A059]" />
              Property
            </label>
            <div className="relative">
              <select
                value={propertyCode}
                onChange={(e) => setPropertyCode(e.target.value as any)}
                className="w-full bg-[#FDFCFB] border border-gray-200 px-3.5 py-3 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#C5A059] cursor-pointer font-medium"
              >
                <option value="both">Both Properties (Salasar)</option>
                <option value="sbm-hotel">SBM Hotel (Temple Side)</option>
                <option value="sbm-guest-house">SBM 2 Guest House</option>
              </select>
            </div>
          </div>

          {/* Check-In Date */}
          <div className="space-y-1.5 sm:border-l sm:border-gray-100 sm:pl-4">
            <label className="text-[10px] uppercase tracking-wider text-[#999999] font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#C5A059]" />
              Check-In
            </label>
            <input
              type="date"
              value={checkIn}
              min={formatDate(today)}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (e.target.value >= checkOut) {
                  const nextDay = new Date(e.target.value);
                  nextDay.setDate(nextDay.getDate() + 1);
                  setCheckOut(formatDate(nextDay));
                }
              }}
              className="w-full bg-[#FDFCFB] border border-gray-200 px-3.5 py-3 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#C5A059] cursor-pointer font-medium"
            />
          </div>

          {/* Check-Out Date */}
          <div className="space-y-1.5 sm:border-l sm:border-gray-100 sm:pl-4">
            <label className="text-[10px] uppercase tracking-wider text-[#999999] font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#C5A059]" />
              Check-Out
            </label>
            <input
              type="date"
              value={checkOut}
              min={checkIn}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full bg-[#FDFCFB] border border-gray-200 px-3.5 py-3 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#C5A059] cursor-pointer font-medium"
            />
          </div>

          {/* Guests & Rooms Popup */}
          <div className="space-y-1.5 relative sm:border-l sm:border-gray-100 sm:pl-4">
            <label className="text-[10px] uppercase tracking-wider text-[#999999] font-bold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#C5A059]" />
              Guests & Rooms
            </label>
            <button
              type="button"
              onClick={() => setGuestDropdownOpen(!guestDropdownOpen)}
              className="w-full bg-[#FDFCFB] border border-gray-200 px-3.5 py-3 text-sm text-[#1A1A1A] font-medium text-left flex items-center justify-between focus:outline-none focus:border-[#C5A059] cursor-pointer"
            >
              <span className="truncate">
                {adults} Adult{adults > 1 ? 's' : ''}, {children} Child{children !== 1 ? 'ren' : ''} • {rooms} Room{rooms > 1 ? 's' : ''}
              </span>
            </button>

            {/* Guest Popover */}
            {guestDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-[#C5A059]/30 p-4 shadow-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#1A1A1A]">Adults</div>
                    <div className="text-[10px] text-[#666]">Ages 12+</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={adults <= 1}
                      onClick={() => setAdults(Math.max(1, adults - 1))}
                      className="w-7 h-7 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 flex items-center justify-center text-[#1A1A1A] text-xs font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold">{adults}</span>
                    <button
                      type="button"
                      onClick={() => setAdults(adults + 1)}
                      className="w-7 h-7 bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-[#1A1A1A] text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div>
                    <div className="text-xs font-bold text-[#1A1A1A]">Children</div>
                    <div className="text-[10px] text-[#666]">Ages 0-11</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={children <= 0}
                      onClick={() => setChildren(Math.max(0, children - 1))}
                      className="w-7 h-7 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 flex items-center justify-center text-[#1A1A1A] text-xs font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold">{children}</span>
                    <button
                      type="button"
                      onClick={() => setChildren(children + 1)}
                      className="w-7 h-7 bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-[#1A1A1A] text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div>
                    <div className="text-xs font-bold text-[#1A1A1A]">Rooms</div>
                    <div className="text-[10px] text-[#666]">Count</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={rooms <= 1}
                      onClick={() => setRooms(Math.max(1, rooms - 1))}
                      className="w-7 h-7 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 flex items-center justify-center text-[#1A1A1A] text-xs font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold">{rooms}</span>
                    <button
                      type="button"
                      onClick={() => setRooms(rooms + 1)}
                      className="w-7 h-7 bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-[#1A1A1A] text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setGuestDropdownOpen(false)}
                  className="w-full mt-2 bg-[#1A1A1A] hover:bg-[#C5A059] text-white font-bold text-[10px] uppercase tracking-wider py-2 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Search Button */}
          <div>
            <button
              type="submit"
              className="w-full bg-[#C5A059] hover:bg-[#B48E4B] text-white py-3.5 text-[11px] uppercase tracking-[0.2em] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
              <span>Check Availability</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
