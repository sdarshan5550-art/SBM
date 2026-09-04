import React, { useState, useEffect } from 'react';
import { DEFAULT_PHOTOS } from '../data/mockPhotos';
import { Camera, Maximize2, X } from 'lucide-react';
import { api } from '../lib/api';
import { ManagedImage } from '../types';
import { ManagedImageDisplay } from './ManagedImageDisplay';

export const GallerySection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'hotel' | 'guesthouse' | 'rooms'>('all');
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [dynamicImages, setDynamicImages] = useState<ManagedImage[]>([]);

  useEffect(() => {
    let isMounted = true;
    api.getImages()
      .then(images => {
        if (isMounted && Array.isArray(images) && images.length > 0) {
          setDynamicImages(images);
        }
      })
      .catch(err => {
        console.warn('Could not fetch dynamic gallery images, using defaults', err);
      });
    return () => { isMounted = false; };
  }, []);

  const defaultGalleryItems = [
    {
      url: DEFAULT_PHOTOS.sbmHotelExterior,
      title: 'SBM Hotel - Day Exterior Facade',
      subtitle: 'Main Temple Road Facade (SBM Hotel 1)',
      category: 'hotel'
    },
    {
      url: DEFAULT_PHOTOS.sbmHotelEvening,
      title: 'SBM Hotel - Evening Twilight View',
      subtitle: 'Warm Architectural Night Lighting',
      category: 'hotel'
    },
    {
      url: DEFAULT_PHOTOS.sbmEntranceFacade,
      title: 'SBM Hotel - Welcome Entrance',
      subtitle: 'Driveway & Temple View Entrance Walkway',
      category: 'hotel'
    },
    {
      url: DEFAULT_PHOTOS.sbmGuestHouseExterior,
      title: 'SBM 2 Guest House - Front Facade',
      subtitle: 'Peaceful Location on Temple Approach Road',
      category: 'guesthouse'
    },
    {
      url: DEFAULT_PHOTOS.deluxeRoom,
      title: 'Deluxe Room - Main Bed View',
      subtitle: 'King Bed with Cushioned Leather Headboard',
      category: 'rooms'
    },
    {
      url: DEFAULT_PHOTOS.deluxeSeating,
      title: 'Deluxe Room - Seating Area',
      subtitle: 'Private Seating & Modern Room Amenities',
      category: 'rooms'
    },
    {
      url: DEFAULT_PHOTOS.deluxeLounge,
      title: 'Deluxe Room - Corner Lounge & Vanity',
      subtitle: 'Work Desk & Hygienic Bath Vanity Access',
      category: 'rooms'
    },
    {
      url: DEFAULT_PHOTOS.familySuite,
      title: 'Family Suite - Main Bedroom Layout',
      subtitle: 'Dual Beds for Group & Family Devotees',
      category: 'rooms'
    },
    {
      url: DEFAULT_PHOTOS.familySuiteTV,
      title: 'Family Suite - Entertainment & Daybed Lounge',
      subtitle: 'Smart TV Unit, Leather Daybed & Lounge Space',
      category: 'rooms'
    }
  ];

  // Convert dynamic managed images to gallery format if present
  const galleryItems = dynamicImages.length > 0
    ? dynamicImages.map(img => {
        let cat: 'hotel' | 'guesthouse' | 'rooms' = 'hotel';
        if (img.roomId === 'deluxe' || img.roomId === 'family' || img.category.includes('Room') || img.category.includes('Suite')) {
          cat = 'rooms';
        } else if (img.category.toLowerCase().includes('guest') || img.category.toLowerCase().includes('sbm 2')) {
          cat = 'guesthouse';
        }
        return {
          url: img.imageUrl,
          title: img.title || img.category,
          subtitle: img.description || `${img.category} at SBM Hotel`,
          category: cat
        };
      })
    : defaultGalleryItems;

  const filteredItems = selectedCategory === 'all'
    ? galleryItems
    : galleryItems.filter(item => item.category === selectedCategory);

  return (
    <section className="bg-[#FDFCFB] border-y border-[#C5A059]/15 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">
            <Camera className="w-3.5 h-3.5" />
            Outdoor & Property Gallery
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif text-[#1A1A1A] font-medium">
            Explore SBM Hotel & SBM 2 Guest House
          </h2>
          <div className="w-12 h-0.5 bg-[#C5A059] mx-auto my-3" />
          <p className="text-xs sm:text-sm text-[#666666] max-w-xl mx-auto leading-relaxed">
            Take a look at our outdoor facades, entrance walkways, evening architecture, and pristine guest accommodations in Salasar.
          </p>

          {/* Gallery Category Filter */}
          <div className="flex flex-wrap justify-center items-center gap-2 pt-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-[#C5A059]'
              }`}
            >
              All Photos ({galleryItems.length})
            </button>
            <button
              onClick={() => setSelectedCategory('hotel')}
              className={`px-4 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === 'hotel'
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-[#C5A059]'
              }`}
            >
              SBM Hotel 1
            </button>
            <button
              onClick={() => setSelectedCategory('guesthouse')}
              className={`px-4 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === 'guesthouse'
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-[#C5A059]'
              }`}
            >
              SBM 2 Guest House
            </button>
            <button
              onClick={() => setSelectedCategory('rooms')}
              className={`px-4 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === 'rooms'
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-[#C5A059]'
              }`}
            >
              Rooms & Interiors
            </button>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <div
              key={index}
              onClick={() => setActiveImage(item.url)}
              className="group relative h-64 bg-stone-100 border border-stone-200 overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all"
            >
              <ManagedImageDisplay
                src={item.url}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                fallbackType="hotel"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
              
              <div className="absolute top-3 right-3 p-2 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-4 h-4" />
              </div>

              <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">
                  {item.category === 'hotel' ? 'SBM Hotel 1' : item.category === 'guesthouse' ? 'SBM 2 Guest House' : 'Outdoor View'}
                </span>
                <h3 className="font-serif text-sm font-medium leading-snug">{item.title}</h3>
                <p className="text-[11px] text-white/70 font-sans">{item.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setActiveImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center">
            <button
              onClick={() => setActiveImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-[#C5A059] p-2 cursor-pointer"
            >
              <X className="w-8 h-8" />
            </button>
            <ManagedImageDisplay
              src={activeImage}
              alt="Enlarged view"
              className="max-w-full max-h-[85vh] object-contain border border-stone-800"
              fallbackType="hotel"
            />
          </div>
        </div>
      )}
    </section>
  );
};
