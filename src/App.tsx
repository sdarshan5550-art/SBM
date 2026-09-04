import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { RoomsPage } from './pages/RoomsPage';
import { PropertyPage } from './pages/PropertyPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { ManageBookingPage } from './pages/ManageBookingPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { AdminPage } from './pages/AdminPage';
import { ConciergeChat } from './components/ConciergeChat';
import { BookingFlowModal } from './components/BookingFlowModal';
import { RoomAvailabilityResult, Booking, PropertyCode, RoomCategoryCode } from './types';
import { api } from './lib/api';
import { Phone, Mail, MapPin, Calendar, HeartHandshake } from 'lucide-react';

const getInitialTab = () => {
  const path = window.location.pathname.toLowerCase();
  if (path === '/admin' || path === '/admin/' || path.endsWith('/admin')) {
    return 'admin';
  }
  return 'home';
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>(getInitialTab);
  const [propertyCodeParam, setPropertyCodeParam] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === '/admin' || path === '/admin/' || path.endsWith('/admin')) {
        setCurrentTab('admin');
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedAvailResult, setSelectedAvailResult] = useState<RoomAvailabilityResult | null>(null);
  const [bookingSearchParams, setBookingSearchParams] = useState<any>({
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    adults: 2,
    children: 0,
    rooms: 1
  });

  const handleNavigate = (page: string, params?: any) => {
    setCurrentTab(page);
    if (params?.code) {
      setPropertyCodeParam(params.code);
    }
    if (page === 'admin') {
      if (window.location.pathname !== '/admin') {
        window.history.pushState({}, '', '/admin');
      }
    } else {
      if (window.location.pathname === '/admin' || window.location.pathname.endsWith('/admin')) {
        window.history.pushState({}, '', '/');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectRoomToBook = (result: RoomAvailabilityResult, searchParams: any) => {
    setSelectedAvailResult(result);
    if (searchParams) {
      setBookingSearchParams(searchParams);
    }
    setBookingModalOpen(true);
  };

  const handleOpenQuickBookingModal = () => {
    // If no search result is selected yet, create a default lookup or scroll to search
    if (!selectedAvailResult) {
      const el = document.getElementById('booking-widget-container');
      if (el && currentTab === 'home') {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      handleNavigate('home');
      setTimeout(() => {
        const target = document.getElementById('booking-widget-container');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      setBookingModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans flex flex-col selection:bg-[#C5A059] selection:text-white">
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => handleNavigate(tab)}
        onOpenBookingModal={handleOpenQuickBookingModal}
      />

      {/* Main Content View */}
      <main className="flex-1">
        {currentTab === 'home' && (
          <HomePage
            onSelectRoomToBook={handleSelectRoomToBook}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'rooms' && (
          <RoomsPage
            onOpenBookingModal={() => handleNavigate('home')}
          />
        )}

        {currentTab === 'properties' && (
          <PropertyPage
            initialCode={propertyCodeParam}
            onOpenBookingModal={() => handleNavigate('home')}
          />
        )}

        {currentTab === 'about' && <AboutPage />}

        {currentTab === 'contact' && <ContactPage />}

        {currentTab === 'manage-booking' && <ManageBookingPage />}

        {currentTab === 'policies' && <PoliciesPage />}

        {currentTab === 'admin' && <AdminPage onOpenBookingModal={handleOpenQuickBookingModal} />}
      </main>

      {/* Floating AI Hotel Concierge (Hidden on Admin) */}
      {currentTab !== 'admin' && (
        <ConciergeChat
          onSelectBookingRoom={async ({ propertyCode, roomCode, checkIn, checkOut, adults, children }) => {
            const queryCheckIn = checkIn || new Date().toISOString().split('T')[0];
            const queryCheckOut = checkOut || new Date(Date.now() + 86400000).toISOString().split('T')[0];
            const queryAdults = adults || 2;
            const queryChildren = children || 0;

            const searchParams = {
              property_code: propertyCode || 'both',
              check_in: queryCheckIn,
              check_out: queryCheckOut,
              adults: queryAdults,
              children: queryChildren,
              rooms: 1
            };

            try {
              const availResults = await api.checkAvailability(searchParams);
              const matched = availResults.find(r => r.property.code === propertyCode && r.roomType.room_code === roomCode);
              if (matched) {
                handleSelectRoomToBook(matched, searchParams);
              } else if (availResults.length > 0) {
                handleSelectRoomToBook(availResults[0], searchParams);
              } else {
                alert('No direct online availability for selected dates. Please try different dates or call SBM Front Desk.');
              }
            } catch (err) {
              console.error('Concierge booking lookup failed:', err);
              alert('Could not check real-time availability right now. Please call SBM front desk.');
            }
          }}
        />
      )}

      {/* Booking Flow Modal */}
      {bookingModalOpen && selectedAvailResult && (
        <BookingFlowModal
          selectedResult={selectedAvailResult}
          searchParams={bookingSearchParams}
          onClose={() => setBookingModalOpen(false)}
          onSuccess={(booking: Booking) => {
            console.log('Booking confirmed:', booking);
          }}
        />
      )}

      {/* Footer (Hidden on Admin tab) */}
      {currentTab !== 'admin' && (
        <footer className="bg-[#1A1A1A] border-t border-[#C5A059]/20 text-white/80 py-12 px-4 sm:px-6 lg:px-8 mt-auto shrink-0">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Column 1: Brand */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#C5A059] flex items-center justify-center text-white font-serif font-bold italic text-sm">
                  S
                </div>
                <span className="font-serif text-xl tracking-widest text-white">SBM HOTEL</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                Premium accommodation near Sri Salasar Balaji Temple, Salasar, Rajasthan. Delivering refined comfort and pure vegetarian Indian hospitality.
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-semibold text-[#C5A059] uppercase tracking-[0.2em] text-[11px]">Quick Links</h4>
              <ul className="space-y-2 text-white/60">
                <li><button onClick={() => handleNavigate('home')} className="hover:text-white transition-colors">Home</button></li>
                <li><button onClick={() => handleNavigate('rooms')} className="hover:text-white transition-colors">Room Categories</button></li>
                <li><button onClick={() => handleNavigate('properties')} className="hover:text-white transition-colors">Our Properties</button></li>
                <li><button onClick={() => handleNavigate('about')} className="hover:text-white transition-colors">About SBM</button></li>
                <li><button onClick={() => handleNavigate('manage-booking')} className="hover:text-white transition-colors">Manage My Booking</button></li>
              </ul>
            </div>

            {/* Column 3: Contact */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-semibold text-[#C5A059] uppercase tracking-[0.2em] text-[11px]">Reservations & Help</h4>
              <div className="space-y-2 text-white/60">
                <p><strong className="text-white/80">SBM Hotel:</strong> +91 99835 67921</p>
                <p><strong className="text-white/80">SBM 2 Guest House:</strong> +91 98285 00845, +91 98286 36000</p>
                <p><strong className="text-white/80">Email:</strong> sbmhotel@gmail.com, sbmguesthouse@gmail.com</p>
                <p><strong className="text-white/80">Location:</strong> Salasar, Rajasthan 331506</p>
              </div>
            </div>

            {/* Column 4: Policies */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-semibold text-[#C5A059] uppercase tracking-[0.2em] text-[11px]">Hotel Policies</h4>
              <ul className="space-y-2 text-white/60">
                <li><button onClick={() => handleNavigate('policies')} className="hover:text-white transition-colors">Terms & Conditions</button></li>
                <li><button onClick={() => handleNavigate('policies')} className="hover:text-white transition-colors">Privacy Policy</button></li>
                <li><button onClick={() => handleNavigate('policies')} className="hover:text-white transition-colors">Refund & Cancellation</button></li>
              </ul>
            </div>
          </div>

          <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center text-[10px] text-white/40 tracking-wider uppercase">
            <span>© {new Date().getFullYear()} SBM Hotel, Salasar, Rajasthan. All Rights Reserved.</span>
            <span className="mt-2 sm:mt-0 text-[#C5A059]/80 font-medium">Pure Vegetarian Family Premises</span>
          </div>
        </footer>
      )}
    </div>
  );
}
