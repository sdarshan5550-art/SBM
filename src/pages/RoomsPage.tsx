import React, { useState, useEffect } from 'react';
import { RoomType } from '../types';
import { api } from '../lib/api';
import { RoomCard } from '../components/RoomCard';
import { CheckCircle2, BedDouble, Users, Sparkles } from 'lucide-react';

interface RoomsPageProps {
  onOpenBookingModal: () => void;
}

export const RoomsPage: React.FC<RoomsPageProps> = ({ onOpenBookingModal }) => {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  useEffect(() => {
    api.getRoomTypes().then(setRoomTypes).catch(console.error);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Accommodations</span>
        <h1 className="text-3xl sm:text-4xl font-serif text-[#1A1A1A] font-medium">
          Room Categories at SBM Hotel
        </h1>
        <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
        <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
          In strict accordance with our inventory standards, we offer two primary room categories for your comfort in Salasar: <strong className="text-[#1A1A1A]">Deluxe Room</strong> (₹2,500/night) and <strong className="text-[#1A1A1A]">Family Suite</strong> (₹3,500/night).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {roomTypes.slice(0, 4).map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            onSelect={() => onOpenBookingModal()}
          />
        ))}
      </div>

      {/* Comparison Box */}
      <div className="bg-white border border-[#C5A059]/20 p-6 sm:p-8 space-y-6 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-serif text-[#1A1A1A] font-medium text-center">
          Which Category Best Suits Your Stay?
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-[#666666]">
          <div className="bg-[#FDFCFB] p-5 border border-stone-100 space-y-3">
            <div className="text-base font-serif font-bold text-[#C5A059]">Deluxe Room — ₹2,500 / night</div>
            <p className="text-[#666666] leading-relaxed">Ideal for couples, solitary pilgrims, or business travelers seeking a comfortable and serene stay near Sri Salasar Balaji Temple.</p>
            <ul className="space-y-2 text-[#1A1A1A] pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                Capacity: Up to 2 Guests
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                King-size Double Bed
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                AC, Flat TV, Hot Water Geyser
              </li>
            </ul>
          </div>

          <div className="bg-[#FDFCFB] p-5 border border-stone-100 space-y-3">
            <div className="text-base font-serif font-bold text-[#C5A059]">Family Suite — ₹3,500 / night</div>
            <p className="text-[#666666] leading-relaxed">Spacious layout designed for larger families, parents with children, or pilgrim groups traveling together to Salasar.</p>
            <ul className="space-y-2 text-[#1A1A1A] pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                Capacity: 4 to 5 Guests
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                Multiple Beds / Large Family Beds
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                Spacious Attached Bathroom & Seating
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
