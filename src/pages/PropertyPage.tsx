import React, { useState, useEffect } from 'react';
import { Property, RoomType } from '../types';
import { api } from '../lib/api';
import { RoomCard } from '../components/RoomCard';
import { MapPin, Phone, Mail, Building, CheckCircle2, CalendarCheck } from 'lucide-react';
import { DEFAULT_PHOTOS } from '../data/mockPhotos';
import { ManagedImageDisplay } from '../components/ManagedImageDisplay';

interface PropertyPageProps {
  initialCode?: string;
  onOpenBookingModal: () => void;
}

export const PropertyPage: React.FC<PropertyPageProps> = ({ initialCode, onOpenBookingModal }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyCode, setSelectedPropertyCode] = useState<string>(initialCode || 'sbm-hotel');
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  useEffect(() => {
    api.getProperties().then((props) => {
      setProperties(props);
      if (!initialCode && props.length > 0) {
        setSelectedPropertyCode(props[0].code);
      }
    });
  }, [initialCode]);

  useEffect(() => {
    if (selectedPropertyCode) {
      api.getRoomTypes(selectedPropertyCode).then(setRoomTypes).catch(console.error);
    }
  }, [selectedPropertyCode]);

  const activeProp = properties.find((p) => p.code === selectedPropertyCode) || properties[0];
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  useEffect(() => {
    setActiveImgIndex(0);
  }, [selectedPropertyCode]);

  const activeImages = (activeProp && activeProp.images && activeProp.images.length > 0)
    ? activeProp.images
    : [activeProp?.code === 'sbm-guest-house' ? DEFAULT_PHOTOS.sbmGuestHouseExterior : DEFAULT_PHOTOS.sbmHotelExterior];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Property Switcher Tabs */}
      <div className="flex justify-center border-b border-[#C5A059]/15 pb-4">
        <div className="inline-flex bg-white p-1 border border-stone-200">
          {properties.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPropertyCode(p.code)}
              className={`px-6 py-2.5 font-serif text-xs transition-colors cursor-pointer uppercase tracking-[0.15em] ${
                selectedPropertyCode === p.code
                  ? 'bg-[#1A1A1A] text-white font-bold'
                  : 'text-[#666666] hover:text-[#1A1A1A]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {activeProp && (
        <div className="space-y-12">
          {/* Header Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-white border border-[#C5A059]/20 p-6 sm:p-8 shadow-sm">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">
                Property Overview
              </span>
              <h1 className="text-3xl sm:text-4xl font-serif text-[#1A1A1A] font-medium">
                {activeProp.name}
              </h1>
              <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
                {activeProp.description}
              </p>

              <div className="space-y-2 text-xs text-[#666666] pt-2 border-t border-stone-100">
                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
                  <span>{activeProp.address}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#C5A059] shrink-0" />
                  <span>Phone: {activeProp.phone} | Landline: {activeProp.landline}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#C5A059] shrink-0" />
                  <span>Email: {activeProp.email}</span>
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={onOpenBookingModal}
                  className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white text-[11px] font-bold uppercase tracking-[0.2em] px-6 py-3.5 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4 text-[#C5A059]" />
                  Book Room at {activeProp.name}
                </button>
              </div>
            </div>

            {/* Gallery Main Display & Thumbnails */}
            <div className="space-y-3">
              <div className="relative h-72 lg:h-96 border border-stone-200 overflow-hidden bg-stone-100">
                <ManagedImageDisplay
                  src={activeImages[activeImgIndex] || activeImages[0]}
                  alt={`${activeProp.name} photo ${activeImgIndex + 1}`}
                  className="w-full h-full object-cover transition-all duration-300"
                  fallbackType="hotel"
                />
                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-mono px-2.5 py-1 rounded backdrop-blur-sm">
                  {activeImgIndex + 1} / {activeImages.length}
                </div>
              </div>

              {/* Thumbnails */}
              {activeImages.length > 1 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-1">
                  {activeImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImgIndex(idx)}
                      className={`relative w-20 h-14 border-2 overflow-hidden shrink-0 transition-all cursor-pointer ${
                        idx === activeImgIndex ? 'border-[#C5A059] opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <ManagedImageDisplay
                        src={imgUrl}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                        fallbackType="hotel"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rooms List for Property */}
          <div className="space-y-6">
            <h2 className="text-2xl font-serif text-[#1A1A1A] font-medium">
              Available Room Categories at {activeProp.name}
            </h2>

            <div className="grid grid-cols-1 gap-6">
              {roomTypes.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onSelect={() => onOpenBookingModal()}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
