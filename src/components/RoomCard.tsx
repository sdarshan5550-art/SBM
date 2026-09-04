import React, { useState } from 'react';
import { RoomType, RoomAvailabilityResult } from '../types';
import { Users, BedDouble, CheckCircle, Wifi, Tv, Wind, Coffee, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { DEFAULT_PHOTOS } from '../data/mockPhotos';
import { ManagedImageDisplay } from './ManagedImageDisplay';

interface RoomCardProps {
  room: RoomType;
  availabilityResult?: RoomAvailabilityResult;
  onSelect: (room: RoomType, result?: RoomAvailabilityResult) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, availabilityResult, onSelect }) => {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const isAvailable = availabilityResult ? availabilityResult.isAvailable : true;
  const availableCount = availabilityResult ? availabilityResult.availableRooms : room.total_rooms;

  const images = (room.images && room.images.length > 0)
    ? room.images
    : [DEFAULT_PHOTOS.deluxeRoom];

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="bg-white border border-[#C5A059]/20 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row group">
      {/* Image Container with Carousel Controls */}
      <div className="md:w-5/12 relative h-64 md:h-auto overflow-hidden bg-stone-100 shrink-0">
        <ManagedImageDisplay
          src={images[currentImgIndex] || images[0]}
          alt={`${room.name} view ${currentImgIndex + 1}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          fallbackType={room.room_code === 'deluxe' ? 'deluxe' : 'family'}
        />

        {/* Image Controls if multiple photos */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full transition-opacity opacity-80 md:opacity-0 md:group-hover:opacity-100 z-10 cursor-pointer"
              title="Previous photo"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full transition-opacity opacity-80 md:opacity-0 md:group-hover:opacity-100 z-10 cursor-pointer"
              title="Next photo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center items-center gap-1.5">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImgIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentImgIndex
                      ? 'w-5 bg-[#C5A059]'
                      : 'w-1.5 bg-white/70 hover:bg-white'
                  }`}
                  title={`Photo ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Availability Badge */}
        <div className="absolute top-3 left-3 z-10">
          {isAvailable ? (
            <span className="bg-[#1A1A1A]/85 text-white border border-[#C5A059]/40 text-[10px] font-semibold uppercase tracking-widest px-3 py-1 shadow-sm backdrop-blur-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse" />
              {availableCount} Room{availableCount > 1 ? 's' : ''} Available
            </span>
          ) : (
            <span className="bg-rose-900/90 text-white text-[10px] font-semibold uppercase tracking-widest px-3 py-1 shadow-sm backdrop-blur-sm flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-rose-300" />
              Sold Out
            </span>
          )}
        </div>

        {/* Image Counter Badge */}
        {images.length > 1 && (
          <div className="absolute top-3 right-3 z-10 bg-black/60 text-white text-[9px] font-mono px-2 py-0.5 rounded backdrop-blur-sm">
            {currentImgIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Details Container */}
      <div className="p-5 md:p-6 md:w-7/12 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex justify-between items-start gap-2">
            <div>
              <h3 className="text-xl font-serif text-[#1A1A1A] group-hover:text-[#C5A059] transition-colors font-medium">
                {room.name}
              </h3>
              <p className="text-xs text-[#666666] mt-1 line-clamp-2 leading-relaxed">
                {room.description}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-serif font-bold text-[#C5A059]">
                ₹{room.price_per_night.toLocaleString('en-IN')}
              </div>
              <div className="text-[9px] text-[#999999] uppercase tracking-wider">per night + GST</div>
            </div>
          </div>

          {/* Key Specs */}
          <div className="flex flex-wrap gap-4 py-2.5 text-xs text-[#666666] border-y border-stone-100 my-3">
            <span className="flex items-center gap-1.5 font-medium">
              <Users className="w-3.5 h-3.5 text-[#C5A059]" />
              Up to {room.capacity} Guests
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <BedDouble className="w-3.5 h-3.5 text-[#C5A059]" />
              {room.bed_information}
            </span>
          </div>

          {/* Amenities Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs text-[#666666]">
            {room.amenities.slice(0, 4).map((amenity, i) => (
              <span key={i} className="flex items-center gap-1.5 truncate">
                <CheckCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                {amenity}
              </span>
            ))}
          </div>
        </div>

        {/* Pricing Calculation Summary if searching */}
        {availabilityResult && (
          <div className="bg-[#FDFCFB] p-3 border border-stone-200 text-xs flex justify-between items-center">
            <div>
              <span className="text-[#666666]">Total for {availabilityResult.nights} Night(s):</span>
              <span className="ml-2 font-bold text-[#1A1A1A] font-serif text-sm">₹{availabilityResult.totalAmount.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-[#999999] ml-1">(incl. GST)</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div>
          <button
            disabled={!isAvailable}
            onClick={() => onSelect(room, availabilityResult)}
            className={`w-full py-3 px-5 text-[11px] uppercase tracking-[0.15em] font-semibold transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              isAvailable
                ? 'bg-[#1A1A1A] hover:bg-[#C5A059] text-white shadow-sm'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            {isAvailable ? 'SELECT THIS ROOM' : 'SOLD OUT FOR SELECTED DATES'}
          </button>
        </div>
      </div>
    </div>
  );
};
