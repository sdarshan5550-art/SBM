import React, { useState } from 'react';
import { Property } from '../types';
import { MapPin, Phone, Mail, CheckCircle2, ArrowRight, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { DEFAULT_PHOTOS } from '../data/mockPhotos';
import { ManagedImageDisplay } from './ManagedImageDisplay';

interface PropertyCardProps {
  property: Property;
  onViewRooms: (propertyCode: string) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, onViewRooms }) => {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const validImages = (property.images || []).filter(
    (img) => typeof img === 'string' && img.trim() !== '' && !img.startsWith('blob:')
  );

  const images = validImages.length > 0
    ? validImages
    : [property.code === 'sbm-guest-house' ? DEFAULT_PHOTOS.sbmGuestHouseExterior : DEFAULT_PHOTOS.sbmHotelExterior];

  const safeIndex = currentImgIndex < images.length ? currentImgIndex : 0;

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="bg-white border border-[#C5A059]/20 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group">
      {/* Property Image Header with Carousel */}
      <div className="relative h-64 overflow-hidden bg-stone-100">
        <ManagedImageDisplay
          src={images[safeIndex] || images[0]}
          alt={`${property.name} view ${safeIndex + 1}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          fallbackType={property.code === 'sbm-guest-house' ? 'guest-house' : 'hotel'}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/80 via-transparent to-transparent pointer-events-none" />

        {/* Carousel arrows */}
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
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
              <span className="text-[9px] font-mono text-white mr-1">{safeIndex + 1}/{images.length}</span>
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImgIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === safeIndex
                      ? 'w-4 bg-[#C5A059]'
                      : 'w-1.5 bg-white/60 hover:bg-white'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <div className="absolute bottom-4 left-4 right-4 pointer-events-none z-10">
          <span className="bg-[#C5A059] text-white text-[9px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 shadow-sm inline-block">
            {property.code === 'sbm-hotel' ? 'Property 1 — Temple Side' : 'Property 2 — Serene Setting'}
          </span>
          <h3 className="text-2xl font-serif text-white mt-1.5 font-medium">
            {property.name}
          </h3>
        </div>
      </div>

      {/* Property Details */}
      <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          <p className="text-[#666666] text-xs leading-relaxed">
            {property.description}
          </p>

          <div className="space-y-1.5 text-xs text-[#666666]">
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
              <span>{property.address}</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#C5A059] shrink-0" />
              <span>Mobile: {property.phone} | Landline: {property.landline}</span>
            </p>
          </div>

          {/* Key Amenities */}
          <div className="pt-3 border-t border-stone-100">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059] mb-2">Property Highlights</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#666666]">
              {property.amenities.slice(0, 4).map((amenity, idx) => (
                <div key={idx} className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  <span className="truncate">{amenity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing info & Action */}
        <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#999999]">Starting From</div>
            <div className="text-lg font-serif font-bold text-[#C5A059]">₹2,500 <span className="text-[10px] font-sans font-normal text-[#999999]">/ night</span></div>
          </div>

          <button
            onClick={() => onViewRooms(property.code)}
            className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[10px] uppercase tracking-[0.2em] font-semibold px-4 py-2.5 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>View Rooms</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
