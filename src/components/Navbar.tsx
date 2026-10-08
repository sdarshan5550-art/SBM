import React, { useState, useEffect } from 'react';
import { Building2, CalendarCheck, Phone, Menu, X, ShieldCheck, MapPin, Instagram, Facebook } from 'lucide-react';
import { DEFAULT_PHOTOS } from '../data/mockPhotos';
import { api } from '../lib/api';
import { SocialMediaSettings } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenBookingModal: () => void;
  socialMediaSettings?: SocialMediaSettings;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, onOpenBookingModal, socialMediaSettings }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [socialSettings, setSocialSettings] = useState<SocialMediaSettings | null>(socialMediaSettings || null);

  useEffect(() => {
    if (socialMediaSettings) {
      setSocialSettings(socialMediaSettings);
    } else {
      api.getSettings().then((s) => {
        if (s.social_media) {
          setSocialSettings(s.social_media);
        }
      }).catch(() => {});
    }
  }, [socialMediaSettings]);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'properties', label: 'Our Properties' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
    { id: 'manage-booking', label: 'Manage Booking' },
  ];

  const handleNavClick = (id: string) => {
    setCurrentTab(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const instagramVisible = Boolean(
    socialSettings?.instagram?.enabled &&
    (socialSettings?.instagram?.show_in_header ?? socialSettings?.instagram?.showInHeader ?? true) &&
    socialSettings?.instagram?.url
  );

  const facebookVisible = Boolean(
    socialSettings?.facebook?.enabled &&
    (socialSettings?.facebook?.show_in_header ?? socialSettings?.facebook?.showInHeader ?? true) &&
    socialSettings?.facebook?.url
  );

  const hasHeaderSocials = instagramVisible || facebookVisible;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#C5A059]/20 text-[#1A1A1A] shadow-sm">
      {/* Top Bar with Contact Info & Social Links */}
      <div className="hidden md:block bg-[#1A1A1A] text-white/70 text-[11px] py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 hover:text-[#C5A059] transition-colors">
              <MapPin className="w-3.5 h-3.5 text-[#C5A059]" />
              Adjacent to Salasar Balaji Temple, Salasar, Rajasthan
            </span>
            <span className="flex items-center gap-1.5 hover:text-[#C5A059] transition-colors">
              <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
              SBM Hotel: +91 99835 67921 | SBM 2 Guest House: +91 98285 00845, +91 98286 36000
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {hasHeaderSocials && (
              <div className="flex items-center gap-2 border-r border-white/20 pr-4">
                {instagramVisible && (
                  <a
                    href={socialSettings!.instagram.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Follow SBM Hotel on Instagram"
                    className="text-white/70 hover:text-[#C5A059] transition-colors p-1"
                    title="Instagram"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                  </a>
                )}
                {facebookVisible && (
                  <a
                    href={socialSettings!.facebook.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Follow SBM Hotel on Facebook"
                    className="text-white/70 hover:text-[#C5A059] transition-colors p-1"
                    title="Facebook"
                  >
                    <Facebook className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
            <span className="text-white/40 text-[10px] tracking-wider uppercase font-medium">
              Pure Vegetarian Family Lodging
            </span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => handleNavClick('home')}
          className="cursor-pointer flex items-center gap-3 group"
        >
          <img
            src={DEFAULT_PHOTOS.logo}
            alt="SBM Hotel Logo"
            className="h-9 sm:h-11 w-auto object-contain group-hover:opacity-90 transition-opacity"
            onError={(e) => {
              const target = e.currentTarget;
              target.onerror = null;
              target.style.display = 'none';
            }}
          />
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-semibold text-[#666666]">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`transition-colors relative py-1 cursor-pointer ${
                currentTab === item.id
                  ? 'text-[#C5A059]'
                  : 'hover:text-[#1A1A1A]'
              }`}
            >
              {item.label}
              {currentTab === item.id && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#C5A059]" />
              )}
            </button>
          ))}
        </nav>

        {/* Header Right Action */}
        <div className="hidden lg:flex items-center gap-4">
          {hasHeaderSocials && (
            <div className="flex items-center gap-2 pr-2 border-r border-[#C5A059]/20">
              {instagramVisible && (
                <a
                  href={socialSettings!.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  title="Instagram"
                  className="w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center text-[#1A1A1A] hover:text-[#C5A059] hover:border-[#C5A059] transition-colors bg-white shadow-2xs"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {facebookVisible && (
                <a
                  href={socialSettings!.facebook.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  title="Facebook"
                  className="w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center text-[#1A1A1A] hover:text-[#C5A059] hover:border-[#C5A059] transition-colors bg-white shadow-2xs"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
            </div>
          )}

          <button
            onClick={onOpenBookingModal}
            className="bg-[#1A1A1A] hover:bg-[#C5A059] text-white px-6 py-2.5 text-[11px] uppercase tracking-[0.15em] font-medium transition-colors shadow-sm cursor-pointer flex items-center gap-2"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Book Your Stay
          </button>
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="flex lg:hidden items-center gap-2">
          {hasHeaderSocials && (
            <div className="flex items-center gap-1.5 mr-1">
              {instagramVisible && (
                <a
                  href={socialSettings!.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="p-1.5 text-[#1A1A1A] hover:text-[#C5A059]"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {facebookVisible && (
                <a
                  href={socialSettings!.facebook.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="p-1.5 text-[#1A1A1A] hover:text-[#C5A059]"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
          <button
            onClick={onOpenBookingModal}
            className="bg-[#1A1A1A] text-white text-[10px] uppercase tracking-[0.15em] font-bold px-3 py-2 flex items-center gap-1"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-[#C5A059]" />
            Book
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#1A1A1A] hover:text-[#C5A059] focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-[#C5A059]" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-[#C5A059]/20 px-4 pt-3 pb-6 space-y-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`block w-full text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                currentTab === item.id
                  ? 'text-[#C5A059] border-l-2 border-[#C5A059] pl-3'
                  : 'text-[#666666] hover:text-[#1A1A1A]'
              }`}
            >
              {item.label}
            </button>
          ))}

          {hasHeaderSocials && (
            <div className="pt-3 border-t border-stone-200 flex items-center gap-3 px-3">
              <span className="text-[11px] text-[#666666] uppercase tracking-wider font-medium">Follow Us:</span>
              {instagramVisible && (
                <a
                  href={socialSettings!.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1A1A1A] hover:text-[#C5A059] p-1 flex items-center gap-1 text-xs"
                >
                  <Instagram className="w-4 h-4 text-[#C5A059]" />
                  <span>Instagram</span>
                </a>
              )}
              {facebookVisible && (
                <a
                  href={socialSettings!.facebook.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1A1A1A] hover:text-[#C5A059] p-1 flex items-center gap-1 text-xs"
                >
                  <Facebook className="w-4 h-4 text-[#C5A059]" />
                  <span>Facebook</span>
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
