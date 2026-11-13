import React, { useState, useEffect } from 'react';
import { RoomType } from '../types';
import { api } from '../lib/api';
import { RoomCard } from '../components/RoomCard';
import { CheckCircle2, BedDouble, Users, Sparkles, Coffee, Droplets } from 'lucide-react';

interface RoomsPageProps {
  onOpenBookingModal: () => void;
}

const CATEGORY_ORDER: Record<string, number> = {
  'deluxe': 1,
  'super-deluxe': 2,
  'family': 3
};

export const RoomsPage: React.FC<RoomsPageProps> = ({ onOpenBookingModal }) => {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  useEffect(() => {
    api.getRoomTypes()
      .then(types => {
        const sorted = [...types].sort((a, b) => {
          const orderA = CATEGORY_ORDER[a.room_code] || 99;
          const orderB = CATEGORY_ORDER[b.room_code] || 99;
          return orderA - orderB;
        });
        setRoomTypes(sorted);
      })
      .catch(console.error);
  }, []);

  const deluxeRoom = roomTypes.find(r => r.property_code === 'sbm-hotel' && r.room_code === 'deluxe');
  const superDeluxeRoom = roomTypes.find(r => r.property_code === 'sbm-hotel' && r.room_code === 'super-deluxe');
  const familyRoom = roomTypes.find(r => r.property_code === 'sbm-hotel' && r.room_code === 'family');

  const deluxePrice = Number(deluxeRoom?.price_per_night) > 0 ? Number(deluxeRoom?.price_per_night) : null;
  const superDeluxePrice = Number(superDeluxeRoom?.price_per_night) > 0 ? Number(superDeluxeRoom?.price_per_night) : null;
  const familyPrice = Number(familyRoom?.price_per_night) > 0 ? Number(familyRoom?.price_per_night) : null;

  // Filter SBM Hotel categories in strict canonical order: 1. Deluxe, 2. Super Deluxe, 3. Family Suite
  const sbmRooms = roomTypes
    .filter(r => r.property_code === 'sbm-hotel')
    .sort((a, b) => (CATEGORY_ORDER[a.room_code] || 99) - (CATEGORY_ORDER[b.room_code] || 99));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Accommodations</span>
        <h1 className="text-3xl sm:text-4xl font-serif text-[#1A1A1A] font-medium">
          Room Categories at SBM Hotel
        </h1>
        <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
        <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
          We offer three distinct room categories designed for your comfort and spiritual pilgrimage in Salasar: <strong className="text-[#1A1A1A]">Deluxe Room</strong> ({deluxePrice === null ? 'Price not configured' : `₹${deluxePrice.toLocaleString('en-IN')}/night`}), <strong className="text-[#1A1A1A]">Super Deluxe Room</strong> ({superDeluxePrice === null ? 'Price not configured' : `₹${superDeluxePrice.toLocaleString('en-IN')}/night`} inclusive of GST), and <strong className="text-[#1A1A1A]">Family Suite</strong> ({familyPrice === null ? 'Price not configured' : `₹${familyPrice.toLocaleString('en-IN')}/night`}).
        </p>
      </div>

      {/* Room Category Cards in Exact Order: 1. Deluxe, 2. Super Deluxe, 3. Family Suite */}
      <div className="space-y-8">
        {(sbmRooms.length > 0 ? sbmRooms : roomTypes.slice(0, 3)).map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            onSelect={() => onOpenBookingModal()}
          />
        ))}
      </div>

      {/* 3-Column Category Comparison Box */}
      <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="text-center space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#C5A059] tracking-widest">Compare & Choose</span>
          <h3 className="text-xl sm:text-2xl font-serif text-[#1A1A1A] font-medium">
            Which Category Best Suits Your Stay?
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#666666]">
          {/* 1. Deluxe Room */}
          <div className="bg-[#FDFCFB] p-5 border border-stone-100 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">Category 1</div>
              <div className="text-base font-serif font-bold text-[#1A1A1A]">
                Deluxe Room
              </div>
              <div className="text-sm font-serif font-bold text-[#C5A059]">
                {deluxePrice === null ? 'Price not configured' : `₹${deluxePrice.toLocaleString('en-IN')}`} <span className="text-[10px] text-stone-500 font-sans font-normal">/ night + GST</span>
              </div>
              <p className="text-[#666666] leading-relaxed pt-1">
                Ideal for couples, solitary pilgrims, or business travelers seeking a comfortable and serene stay near Sri Salasar Balaji Temple.
              </p>
            </div>
            <ul className="space-y-2 text-[#1A1A1A] pt-3 border-t border-stone-100">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                Double Occupancy (Up to 2 Guests)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                1 Double / King Bed
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                AC, Flat TV, Hot Water Geyser
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                Attached Private Bathroom
              </li>
            </ul>
          </div>

          {/* 2. Super Deluxe Room */}
          <div className="bg-[#FAF8F5] p-5 border-2 border-[#C5A059]/40 space-y-3 flex flex-col justify-between relative shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C5A059]">Category 2 &bull; New</span>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[#C5A059] text-white">GST Included</span>
              </div>
              <div className="text-base font-serif font-bold text-[#1A1A1A]">
                Super Deluxe Room
              </div>
              <div className="text-sm font-serif font-bold text-[#C5A059]">
                {superDeluxePrice === null ? 'Price not configured' : `₹${superDeluxePrice.toLocaleString('en-IN')}`} <span className="text-[10px] text-stone-500 font-sans font-normal">/ night (inclusive of GST)</span>
              </div>
              <p className="text-[#666666] leading-relaxed pt-1">
                Spacious room featuring 1 King Size Bed, dedicated in-room tea facilities, and refreshing bathroom amenities.
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-[#C5A059]/20 text-[#1A1A1A]">
              <div>
                <span className="font-semibold block text-[11px] text-[#1A1A1A] mb-1">Occupancy & Bed:</span>
                <div className="space-y-1 text-stone-600">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" /> Double Occupancy</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" /> 1 King Size Bed</div>
                </div>
              </div>

              <div>
                <span className="font-semibold flex items-center gap-1 text-[11px] text-[#C5A059] mb-1">
                  <Coffee className="w-3.5 h-3.5" /> In-Room Tea Amenities:
                </span>
                <div className="grid grid-cols-2 gap-1 text-stone-600 pl-1">
                  <span>&bull; Tea Kit</span>
                  <span>&bull; 2 Cups</span>
                  <span>&bull; 2 Glasses</span>
                  <span>&bull; Electric Kettle</span>
                </div>
              </div>

              <div>
                <span className="font-semibold flex items-center gap-1 text-[11px] text-[#C5A059] mb-1">
                  <Droplets className="w-3.5 h-3.5" /> Bathroom Amenities:
                </span>
                <div className="grid grid-cols-2 gap-1 text-stone-600 pl-1">
                  <span>&bull; 2 Bath Towels</span>
                  <span>&bull; Shampoo</span>
                  <span>&bull; Hand Soap</span>
                  <span>&bull; Moisturizer</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Family Suite */}
          <div className="bg-[#FDFCFB] p-5 border border-stone-100 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#888888]">Category 3</div>
              <div className="text-base font-serif font-bold text-[#1A1A1A]">
                Family Suite
              </div>
              <div className="text-sm font-serif font-bold text-[#C5A059]">
                {familyPrice === null ? 'Price not configured' : `₹${familyPrice.toLocaleString('en-IN')}`} <span className="text-[10px] text-stone-500 font-sans font-normal">/ night + GST</span>
              </div>
              <p className="text-[#666666] leading-relaxed pt-1">
                Spacious layout designed for larger families, parents with children, or pilgrim groups traveling together to Salasar.
              </p>
            </div>
            <ul className="space-y-2 text-[#1A1A1A] pt-3 border-t border-stone-100">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                Capacity: 4 to 5 Guests
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                Multiple Beds / Large Family Beds
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                Air Conditioning & Smart TV
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                Spacious Attached Bathroom & Seating
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
