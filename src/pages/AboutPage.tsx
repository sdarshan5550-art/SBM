import React from 'react';
import { DEFAULT_PHOTOS } from '../data/mockPhotos';
import { GallerySection } from '../components/GallerySection';
import { MapPin, ShieldCheck, HeartHandshake, Sparkles, Phone } from 'lucide-react';
import { ManagedImageDisplay } from '../components/ManagedImageDisplay';

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-16">
        {/* Hero Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">
            Welcome to Salasar
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif text-[#1A1A1A] font-medium">
            About SBM Hotel
          </h1>
          <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
          <p className="text-xs sm:text-sm text-[#666666] leading-relaxed font-sans">
            SBM Hotel was founded with a singular mission: to provide exquisite, serene, and comfortable lodging for devotees and families visiting the sacred <strong className="text-[#1A1A1A]">Sri Salasar Balaji Temple</strong> in Salasar, Rajasthan.
          </p>
        </div>

        {/* Visual Image Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
            <div className="relative h-48 sm:h-56 border border-stone-200 overflow-hidden shadow-sm group">
              <ManagedImageDisplay
                src={DEFAULT_PHOTOS.sbmHotelExterior}
                alt="SBM Hotel Main Temple Road Exterior"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                fallbackType="hotel"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-[9px] uppercase font-bold text-[#C5A059] tracking-[0.2em] bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">SBM Hotel 1</span>
                <h3 className="text-sm font-serif text-white font-medium mt-1">Main Temple Road, Salasar</h3>
              </div>
            </div>

            <div className="relative h-48 sm:h-56 border border-stone-200 overflow-hidden shadow-sm group">
              <ManagedImageDisplay
                src={DEFAULT_PHOTOS.sbmGuestHouseExterior}
                alt="SBM 2 Guest House Front Facade"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                fallbackType="hotel"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="text-[9px] uppercase font-bold text-[#C5A059] tracking-[0.2em] bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">SBM 2 Guest House</span>
                <h3 className="text-sm font-serif text-white font-medium mt-1">Temple Approach Road, Salasar</h3>
              </div>
            </div>
          </div>

          <div className="space-y-6 text-[#666666] text-xs sm:text-sm leading-relaxed">
            <h2 className="text-2xl font-serif text-[#1A1A1A] font-medium">
              A Peaceful Haven for Devotees & Families
            </h2>
            <p>
              Located in Churu district, Rajasthan, Salasar is one of India's most revered pilgrimage destinations, welcoming millions of Hanuman Ji devotees throughout the year.
            </p>
            <p>
              Whether arriving with family, elderly parents, or in a large group, SBM Hotel and SBM 2 Guest House offer thoughtful amenities, hygienic rooms, elevator access, 24/7 hot water, and pure vegetarian surroundings.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-200 text-xs">
              <div className="space-y-1">
                <strong className="block text-[#C5A059] font-serif text-sm">SBM Hotel</strong>
                <p className="text-[#666666]">Main Temple Road, adjacent to Balaji Mandir</p>
                <p className="text-[#1A1A1A] font-mono">+91 99835 67921</p>
              </div>
              <div className="space-y-1">
                <strong className="block text-[#C5A059] font-serif text-sm">SBM 2 Guest House</strong>
                <p className="text-[#666666]">Near Temple Approach Road, quiet location</p>
                <p className="text-[#1A1A1A] font-mono">+91 98285 00845, +91 98286 36000</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Outdoor & Property Gallery */}
      <GallerySection />
    </div>
  );
};
