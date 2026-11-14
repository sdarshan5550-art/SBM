import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { RoomsPage } from './pages/RoomsPage';
import { PropertyPage } from './pages/PropertyPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { ManageBookingPage } from './pages/ManageBookingPage';
import { MyAccountPage } from './pages/MyAccountPage';
import { PoliciesPage, PolicyTabKey } from './pages/PoliciesPage';
import { AdminPage } from './pages/AdminPage';
import { ConciergeChat } from './components/ConciergeChat';
import { BookingFlowModal } from './components/BookingFlowModal';
import { RoomAvailabilityResult, Booking, PropertyCode, RoomCategoryCode, SocialMediaSettings } from './types';
import { api } from './lib/api';
import { updatePageSeo } from './lib/seo';
import { Phone, Mail, MapPin, Calendar, HeartHandshake, Instagram, Facebook } from 'lucide-react';

const getInitialTab = () => {
  const path = window.location.pathname.toLowerCase();
  if (path === '/decn' || path === '/decn/' || path.endsWith('/decn')) return 'admin';
  if (path.includes('manage-booking') || window.location.search.includes('booking_number')) return 'manage-booking';
  if (path === '/my-account' || path === '/my-account/') return 'my-account';
  if (path === '/rooms' || path === '/rooms/') return 'rooms';
  if (path === '/our-properties' || path === '/our-properties/' || path.includes('/sbm-hotel-salasar') || path.includes('/sbm-2-guest-house-salasar')) return 'properties';
  if (path === '/about-salasar-balaji' || path === '/about-salasar-balaji/') return 'about';
  if (path === '/contact' || path === '/contact/') return 'contact';
  if (path === '/policies' || path === '/policies/') return 'policies';
  return 'home';
};

const getInitialPropertyCode = (): PropertyCode | undefined => {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/sbm-2-guest-house-salasar')) return 'sbm-guest-house';
  if (path.includes('/sbm-hotel-salasar')) return 'sbm-hotel';
  return undefined;
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>(getInitialTab);
  const [propertyCodeParam, setPropertyCodeParam] = useState<string | undefined>(getInitialPropertyCode);
  const [policyTabParam, setPolicyTabParam] = useState<PolicyTabKey>('terms');
  const [socialSettings, setSocialSettings] = useState<SocialMediaSettings | null>(null);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentTab(getInitialTab());
      setPropertyCodeParam(getInitialPropertyCode());
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    const isSbm2 = propertyCodeParam === 'sbm-guest-house' || window.location.pathname.includes('/sbm-2-guest-house-salasar');
    const isDedicatedProperty = window.location.pathname.includes('-salasar');
    const propertyName = isSbm2 ? 'SBM 2 Guest House' : 'SBM Hotel';
    const propertyPath = isSbm2 ? '/sbm-2-guest-house-salasar' : '/sbm-hotel-salasar';
    const page = currentTab === 'properties' && isDedicatedProperty ? 'property' : currentTab;

    const seoPages: Record<string, { title: string; description: string; path: string; noIndex?: boolean }> = {
      home: {
        title: 'Hotels Near Salasar Balaji Temple, Rajasthan | SBM Hotels',
        description: 'Find comfortable family accommodation near Salasar Balaji Temple in Salasar, Rajasthan. Explore SBM Hotel and SBM 2 Guest House and book your stay directly.',
        path: '/'
      },
      rooms: {
        title: 'Rooms & Accommodation in Salasar | SBM Hotels',
        description: 'Explore room categories and accommodation options at SBM Hotel and SBM 2 Guest House near Salasar Balaji Temple, Rajasthan.',
        path: '/rooms'
      },
      properties: {
        title: 'Our Properties in Salasar, Rajasthan | SBM Hotels',
        description: 'Explore SBM Hotel and SBM 2 Guest House, two accommodation options for families and devotees visiting Salasar Balaji Temple.',
        path: '/our-properties'
      },
      property: {
        title: `${propertyName} Near Salasar Balaji Temple | Official Booking`,
        description: isSbm2
          ? 'Explore SBM 2 Guest House in Salasar, Rajasthan. View property information, room options and contact details, and book your stay near Salasar Balaji Temple.'
          : 'Explore SBM Hotel near Salasar Balaji Temple in Salasar, Rajasthan. View property information, room options and contact details, and book your stay directly.',
        path: propertyPath
      },
      about: {
        title: 'About SBM Hotels in Salasar, Rajasthan',
        description: 'Learn about SBM Hotel and SBM 2 Guest House, offering accommodation for families and devotees visiting Sri Salasar Balaji Temple.',
        path: '/about-salasar-balaji'
      },
      contact: {
        title: 'Contact & Location | SBM Hotels, Salasar',
        description: 'Contact SBM Hotel or SBM 2 Guest House for room enquiries and direct bookings in Salasar, Rajasthan.',
        path: '/contact'
      },
      'manage-booking': {
        title: 'Manage Your Booking | SBM Hotels',
        description: 'View or manage an existing SBM Hotel or Guest House reservation.',
        path: '/manage-booking',
        noIndex: true
      },
      'my-account': {
        title: 'Guest Account | SBM Hotels',
        description: 'Access your SBM Hotels guest account.',
        path: '/my-account',
        noIndex: true
      },
      policies: {
        title: 'Booking Policies | SBM Hotels, Salasar',
        description: 'Read booking, privacy, cancellation and guest policies for SBM Hotel and SBM 2 Guest House.',
        path: '/policies'
      },
      admin: {
        title: 'Administration | SBM Hotels',
        description: 'Restricted administration area.',
        path: '/decn',
        noIndex: true
      }
    };

    const selected = seoPages[page] || seoPages.home;
    const propertySchema = (isSbm2: boolean) => ({
      '@type': 'Hotel',
      '@id': `https://sbmhotel.com${isSbm2 ? '/sbm-2-guest-house-salasar' : '/sbm-hotel-salasar'}#hotel`,
      name: isSbm2 ? 'SBM 2 Guest House' : 'SBM Hotel',
      url: `https://sbmhotel.com${isSbm2 ? '/sbm-2-guest-house-salasar' : '/sbm-hotel-salasar'}`,
      description: isSbm2
        ? 'Accommodation in Salasar, Rajasthan, for visitors to Sri Salasar Balaji Temple.'
        : 'Hotel accommodation near Sri Salasar Balaji Temple in Salasar, Rajasthan.',
      telephone: isSbm2 ? '+91 98285 00845' : '+91 99835 67921',
      email: isSbm2 ? 'sbmguesthouse@gmail.com' : 'sbmhotel@gmail.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Salasar',
        addressRegion: 'Rajasthan',
        postalCode: '331506',
        addressCountry: 'IN'
      }
    });

    const structuredData = page === 'property'
      ? propertySchema(isSbm2)
      : page === 'home' || page === 'properties'
        ? {
            '@context': 'https://schema.org',
            '@graph': [
              { '@type': 'Organization', '@id': 'https://sbmhotel.com/#organization', name: 'SBM Hotels', url: 'https://sbmhotel.com/' },
              propertySchema(false),
              propertySchema(true)
            ]
          }
        : undefined;

    updatePageSeo({ ...selected, structuredData });
  }, [currentTab, propertyCodeParam, policyTabParam]);

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.social_media) {
        setSocialSettings(s.social_media);
      }
    }).catch(() => {});
  }, []);

  const instagramFooterVisible = Boolean(
    socialSettings?.instagram?.enabled &&
    (socialSettings?.instagram?.show_in_footer ?? socialSettings?.instagram?.showInFooter ?? true) &&
    socialSettings?.instagram?.url
  );

  const facebookFooterVisible = Boolean(
    socialSettings?.facebook?.enabled &&
    (socialSettings?.facebook?.show_in_footer ?? socialSettings?.facebook?.showInFooter ?? true) &&
    socialSettings?.facebook?.url
  );

  const hasFooterSocials = instagramFooterVisible || facebookFooterVisible;

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
    if (typeof params === 'string' && ['terms', 'governing', 'privacy', 'refund'].includes(params)) {
      setPolicyTabParam(params as PolicyTabKey);
    } else if (params?.policyTab) {
      setPolicyTabParam(params.policyTab);
    } else if (page === 'policies') {
      setPolicyTabParam('terms');
    }
    const routePaths: Record<string, string> = {
      home: '/',
      rooms: '/rooms',
      properties: params?.code === 'sbm-guest-house' ? '/sbm-2-guest-house-salasar' : params?.code === 'sbm-hotel' ? '/sbm-hotel-salasar' : '/our-properties',
      about: '/about-salasar-balaji',
      contact: '/contact',
      'manage-booking': '/manage-booking',
      'my-account': '/my-account',
      policies: '/policies',
      admin: '/decn'
    };
    const nextPath = routePaths[page] || '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
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
        socialMediaSettings={socialSettings || undefined}
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
            onPropertyChange={(code) => handleNavigate('properties', { code })}
            onOpenBookingModal={() => handleNavigate('home')}
          />
        )}

        {currentTab === 'about' && <AboutPage />}

        {currentTab === 'contact' && <ContactPage />}

        {currentTab === 'manage-booking' && <ManageBookingPage />}

        {currentTab === 'my-account' && (
          <MyAccountPage onOpenBookingModal={handleOpenQuickBookingModal} />
        )}

        {currentTab === 'policies' && (
          <PoliciesPage initialTab={policyTabParam} onTabChange={setPolicyTabParam} />
        )}

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

              {hasFooterSocials && (
                <div className="pt-2 space-y-2">
                  <span className="block text-[11px] font-semibold text-[#C5A059] uppercase tracking-[0.2em]">Follow Us</span>
                  <div className="flex items-center gap-2.5">
                    {instagramFooterVisible && (
                      <a
                        href={socialSettings!.instagram.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Instagram"
                        title="Instagram"
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#C5A059] text-white/80 hover:text-white flex items-center justify-center transition-colors border border-white/10"
                      >
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                    {facebookFooterVisible && (
                      <a
                        href={socialSettings!.facebook.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Facebook"
                        title="Facebook"
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#C5A059] text-white/80 hover:text-white flex items-center justify-center transition-colors border border-white/10"
                      >
                        <Facebook className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              )}
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
                <li><button onClick={() => handleNavigate('my-account')} className="hover:text-white transition-colors text-[#C5A059]">My Account</button></li>
              </ul>
            </div>

            {/* Column 3: Contact */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-semibold text-[#C5A059] uppercase tracking-[0.2em] text-[11px]">Reservations & Help</h4>
              <div className="space-y-2 text-white/60">
                <p><strong className="text-white/80">SBM Hotel:</strong> +91 99835 67921, +91 98285 23333</p>
                <p><strong className="text-white/80">SBM 2 Guest House:</strong> +91 98285 00845, +91 98285 00855</p>
                <p><strong className="text-white/80">Email:</strong> sbmhotel@gmail.com, sbmguesthouse@gmail.com</p>
                <p><strong className="text-white/80">Location:</strong> Salasar, Rajasthan 331506</p>
              </div>
            </div>

            {/* Column 4: Policies */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-semibold text-[#C5A059] uppercase tracking-[0.2em] text-[11px]">Legal &amp; Policies</h4>
              <ul className="space-y-2 text-white/60">
                <li><button onClick={() => handleNavigate('policies', 'terms')} className="hover:text-white transition-colors">Terms &amp; Conditions</button></li>
                <li><button onClick={() => handleNavigate('policies', 'governing')} className="hover:text-white transition-colors">Governing Law &amp; Jurisdiction</button></li>
                <li><button onClick={() => handleNavigate('policies', 'privacy')} className="hover:text-white transition-colors">Privacy Policy</button></li>
                <li><button onClick={() => handleNavigate('policies', 'refund')} className="hover:text-white transition-colors">Refund &amp; Cancellation</button></li>
              </ul>
            </div>
          </div>

          <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center text-[10px] text-white/40 tracking-wider uppercase gap-2">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
              <span>© {new Date().getFullYear()} SBM Hotel, Salasar, Rajasthan. All Rights Reserved.</span>
              <span className="hidden sm:inline text-white/20">|</span>
              <span className="text-white/60 lowercase normal-case tracking-normal text-[11px]">
                Owned &amp; Managed by <strong className="text-[#C5A059] font-medium tracking-wider uppercase text-[11px]">DEVKI NANDAN PUJARI</strong>
              </span>
            </div>
            <span className="text-[#C5A059]/80 font-medium">Pure Vegetarian Family Premises</span>
          </div>
        </footer>
      )}
    </div>
  );
}
