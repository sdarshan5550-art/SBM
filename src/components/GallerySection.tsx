import React, { useState, useEffect } from 'react';
import { Camera, Maximize2, X, ImageOff } from 'lucide-react';
import { api } from '../lib/api';
import { ManagedImage } from '../types';
import { ManagedImageDisplay } from './ManagedImageDisplay';

export const GallerySection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'hotel' | 'guesthouse' | 'rooms'>('all');
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [dynamicImages, setDynamicImages] = useState<ManagedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    api.getImages()
      .then(images => {
        if (isMounted) {
          setDynamicImages(Array.isArray(images) ? images : []);
          setIsLoading(false);
        }
      })
      .catch(err => {
        console.warn('Could not fetch dynamic gallery images', err);
        if (isMounted) {
          setDynamicImages([]);
          setIsLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  const galleryItems = (dynamicImages || [])
    .filter(img => (img.status || 'active') === 'active')
    .map(img => {
      const isRooms = img.category === 'Rooms & Interiors' ||
                      img.category === 'rooms-interiors' ||
                      img.category === 'rooms' ||
                      img.roomId === 'deluxe' ||
                      img.roomId === 'family' ||
                      img.category === 'Deluxe Room' ||
                      img.category === 'Family Suite' ||
                      (img.category && img.category.includes('Room')) ||
                      (img.category && img.category.includes('Suite'));

      const isGuestHouse = img.propertyId === 'sbm-guest-house' ||
                           img.propertyId === 'prop-sbm-guesthouse' ||
                           (img.category && img.category.toLowerCase().includes('guest')) ||
                           (img.category && img.category.toLowerCase().includes('sbm 2'));

      const propKey: 'hotel' | 'guesthouse' = isGuestHouse ? 'guesthouse' : 'hotel';
      const catKey: 'hotel' | 'guesthouse' | 'rooms' = isRooms ? 'rooms' : propKey;

      return {
        id: img.id,
        url: img.imageUrl,
        title: img.title || img.category,
        subtitle: img.description || (isGuestHouse ? 'SBM 2 Guest House' : 'SBM Hotel'),
        category: catKey,
        propertyId: propKey,
        rawCategory: img.category
      };
    });

  const filteredItems = selectedCategory === 'all'
    ? galleryItems
    : selectedCategory === 'hotel'
    ? galleryItems.filter(item => item.propertyId === 'hotel' || item.category === 'hotel')
    : selectedCategory === 'guesthouse'
    ? galleryItems.filter(item => item.propertyId === 'guesthouse' || item.category === 'guesthouse')
    : galleryItems.filter(item => item.category === 'rooms');

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
        {isLoading ? (
          <div className="text-center py-12 px-4 bg-white border border-stone-200 shadow-xs">
            <p className="text-xs text-stone-500">Loading gallery photos...</p>
          </div>
        ) : galleryItems.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white border border-stone-200 shadow-xs space-y-2">
            <Camera className="w-10 h-10 text-stone-300 mx-auto" />
            <h4 className="text-sm font-semibold text-stone-700">No Gallery Photos Published</h4>
            <p className="text-xs text-stone-500">Photos published in Image Management will appear here.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white border border-stone-200 shadow-xs space-y-2">
            <ImageOff className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-xs text-stone-500">No photos available in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item, index) => (
              <div
                key={item.id || index}
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
                    {item.rawCategory || (item.category === 'hotel' ? 'SBM Hotel 1' : item.category === 'guesthouse' ? 'SBM 2 Guest House' : 'Rooms & Interiors')}
                  </span>
                  <h3 className="font-serif text-sm font-medium leading-snug">{item.title}</h3>
                  <p className="text-[11px] text-white/70 font-sans">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        )}
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
