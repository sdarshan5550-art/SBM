import React, { useState, useEffect } from 'react';
import { HeroBookingWidget } from '../components/HeroBookingWidget';
import { PropertyCard } from '../components/PropertyCard';
import { RoomCard } from '../components/RoomCard';
import { Property, RoomType, AvailabilitySearchQuery, RoomAvailabilityResult } from '../types';
import { api } from '../lib/api';
import { DEFAULT_PHOTOS } from '../data/mockPhotos';
import { GallerySection } from '../components/GallerySection';
import { ShieldCheck, MapPin, Sparkles, Clock, Utensils, Award, CheckCircle } from 'lucide-react';
import { ManagedImageDisplay } from '../components/ManagedImageDisplay';

interface HomePageProps {
  onSelectRoomToBook: (result: RoomAvailabilityResult, searchParams: any) => void;
  onNavigate: (page: string, params?: any) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSelectRoomToBook, onNavigate }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [searchResults, setSearchResults] = useState<RoomAvailabilityResult[] | null>(null);
  const [searchParams, setSearchParams] = useState<any>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    api.getProperties().then(setProperties).catch(console.error);
    api.getRoomTypes().then(setRoomTypes).catch(console.error);
  }, []);

  const handleSearch = async (query: AvailabilitySearchQuery) => {
    setLoadingSearch(true);
    setSearchError(null);
    setSearchParams({
      checkIn: query.check_in,
      checkOut: query.check_out,
      adults: query.adults,
      children: query.children,
      rooms: query.rooms
    });

    try {
      const results = await api.checkAvailability(query);
      setSearchResults(results);

      // Smooth scroll to results
      const resultsEl = document.getElementById('availability-results-section');
      if (resultsEl) {
        resultsEl.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err: any) {
      setSearchError(err.message || 'Failed to check room availability.');
    } finally {
      setLoadingSearch(false);
    }
  };

  return (
    <div className="space-y-16 pb-16">
      {/* HERO SECTION WITH DIRECT BOOKING WIDGET */}
      <section className="relative min-h-[80vh] flex flex-col justify-center items-center bg-[#FDFCFB] text-[#1A1A1A] px-4 sm:px-6 pt-12 pb-16 overflow-hidden border-b border-[#C5A059]/15">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 z-0">
          <ManagedImageDisplay
            src={DEFAULT_PHOTOS.sbmHotelExterior}
            alt="SBM Hotel Salasar Exterior"
            className="w-full h-full object-cover opacity-15 filter contrast-105"
            fallbackType="hotel"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#FDFCFB]/80 via-[#FDFCFB]/60 to-[#FDFCFB]" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#C5A059] text-[10px] font-bold uppercase tracking-[0.25em]">
            <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
            Salasar, Rajasthan, India
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif tracking-tight text-[#1A1A1A] leading-tight font-medium">
            Refined Living in the <span className="italic text-[#C5A059]">Heart of Salasar</span>
          </h1>

          <p className="text-sm sm:text-base text-[#666666] max-w-2xl mx-auto font-sans leading-relaxed">
            Exquisite accommodation near Sri Salasar Balaji Temple, blending traditional pure vegetarian hospitality with modern luxury.
          </p>
        </div>

        {/* HERO BOOKING WIDGET */}
        <div id="booking-widget-container" className="relative z-10 w-full max-w-6xl mx-auto">
          <HeroBookingWidget onSearch={handleSearch} />
        </div>
      </section>

      {/* AVAILABILITY SEARCH RESULTS SECTION */}
      {searchResults && (
        <section id="availability-results-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
          <div className="bg-white border border-[#C5A059]/30 p-6 md:p-8 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">Search Results</span>
                <h2 className="text-2xl font-serif text-[#1A1A1A] font-medium mt-0.5">
                  Available Accommodations ({searchParams?.checkIn} to {searchParams?.checkOut})
                </h2>
                <p className="text-xs text-[#666666]">
                  Real-time room availability for {searchParams?.adults} Adult(s), {searchParams?.children} Child(ren) • {searchParams?.rooms} Room(s)
                </p>
              </div>

              <button
                onClick={() => setSearchResults(null)}
                className="text-xs text-[#C5A059] hover:underline font-semibold cursor-pointer"
              >
                Clear Search
              </button>
            </div>

            {searchError && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                {searchError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {searchResults.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-[#1A1A1A] font-serif text-lg">No rooms available for your selected dates.</p>
                  <p className="text-xs text-[#666666]">Please select alternative dates or consider checking both property options.</p>
                </div>
              ) : (
                searchResults.map((res, i) => (
                  <RoomCard
                    key={i}
                    room={res.roomType}
                    availabilityResult={res}
                    onSelect={(room, avail) => onSelectRoomToBook(avail!, searchParams)}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* PROPERTY OVERVIEW SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2 mb-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Our Properties</span>
          <h2 className="text-3xl sm:text-4xl font-serif text-[#1A1A1A] font-medium">
            Two Distinct Locations in Salasar
          </h2>
          <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
          <p className="text-xs sm:text-sm text-[#666666] max-w-xl mx-auto leading-relaxed">
            Choose between SBM Hotel right beside the Salasar Balaji Temple, or SBM 2 Guest House along the peaceful temple approach road.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {properties.map((prop) => (
            <PropertyCard
              key={prop.id}
              property={prop}
              onViewRooms={(code) => onNavigate('properties', { code })}
            />
          ))}
        </div>
      </section>

      {/* OUTDOOR & PROPERTY GALLERY SECTION */}
      <GallerySection />

      {/* SIMPLIFIED ROOM CATEGORIES SHOWCASE */}
      <section className="bg-white border-y border-[#C5A059]/15 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Accommodations</span>
            <h2 className="text-3xl sm:text-4xl font-serif text-[#1A1A1A] font-medium">
              Thoughtfully Designed Suites & Rooms
            </h2>
            <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
            <p className="text-xs sm:text-sm text-[#666666] max-w-xl mx-auto leading-relaxed">
              We offer two tailored room categories designed for pilgrim families, couples, and traveling groups.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {roomTypes.slice(0, 2).map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onSelect={() => {
                  const el = document.getElementById('booking-widget-container');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* WHY STAY WITH SBM HOTEL */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-[#C5A059]/20 p-8 md:p-12 shadow-sm relative overflow-hidden">
          <div className="max-w-3xl space-y-6 relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">Pure Hospitality</span>
            <h2 className="text-3xl sm:text-4xl font-serif text-[#1A1A1A] font-medium">
              Why Devotees & Families Choose SBM Hotel
            </h2>
            <p className="text-[#666666] text-xs sm:text-sm leading-relaxed">
              Situated in the holy town of Salasar, SBM Hotel provides pristine, air-conditioned accommodations with 24/7 hot water and serene vegetarian premises, making your temple pilgrimage restful and memorable.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#1A1A1A] pt-2">
              <div className="flex items-center gap-3 bg-[#FDFCFB] p-4 border border-stone-100">
                <MapPin className="w-5 h-5 text-[#C5A059] shrink-0" />
                <div>
                  <strong className="block font-serif text-sm text-[#1A1A1A]">Adjacent to Temple</strong>
                  <span className="text-[#666666] text-[11px]">Just 2 minutes walking distance to Sri Salasar Balaji Temple.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#FDFCFB] p-4 border border-stone-100">
                <Clock className="w-5 h-5 text-[#C5A059] shrink-0" />
                <div>
                  <strong className="block font-serif text-sm text-[#1A1A1A]">24/7 Desk Assistance</strong>
                  <span className="text-[#666666] text-[11px]">Seamless check-in support and temple darshan timings guidance.</span>
                </div>
              </div> 

              <div className="flex items-center gap-3 bg-[#FDFCFB] p-4 border border-stone-100">
                <Utensils className="w-5 h-5 text-[#C5A059] shrink-0" />
                <div>
                  <strong className="block font-serif text-sm text-[#1A1A1A]">Pure Veg Environment</strong>
                  <span className="text-[#666666] text-[11px]">100% vegetarian family premises with dining nearby.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#FDFCFB] p-4 border border-stone-100">
                <ShieldCheck className="w-5 h-5 text-[#C5A059] shrink-0" />
                <div>
                  <strong className="block font-serif text-sm text-[#1A1A1A]">Guaranteed Hygiene</strong>
                  <span className="text-[#666666] text-[11px]">Fresh linens, sanitized bath facilities, and hot showers.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
