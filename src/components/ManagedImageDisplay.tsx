import React, { useState } from 'react';
import { DEFAULT_PHOTOS } from '../data/mockPhotos';
import { ImageIcon, AlertCircle } from 'lucide-react';

interface ManagedImageDisplayProps {
  src?: string;
  alt?: string;
  className?: string;
  fallbackType?: 'deluxe' | 'family' | 'hotel' | 'guest-house' | 'general';
  isAdmin?: boolean;
  onReplaceClick?: () => void;
}

export const ManagedImageDisplay: React.FC<ManagedImageDisplayProps> = ({
  src,
  alt = 'SBM Hotel Image',
  className = '',
  fallbackType = 'hotel',
  isAdmin = false,
  onReplaceClick
}) => {
  const [hasError, setHasError] = useState(false);

  const getFallbackSrc = () => {
    switch (fallbackType) {
      case 'deluxe':
        return DEFAULT_PHOTOS.deluxeRoom;
      case 'family':
        return DEFAULT_PHOTOS.familySuite;
      case 'guest-house':
        return DEFAULT_PHOTOS.sbmGuestHouseExterior;
      case 'hotel':
      default:
        return DEFAULT_PHOTOS.sbmHotelExterior;
    }
  };

  const isInvalidUrl = !src || src.trim() === '' || src.startsWith('blob:');
  const imageSrc = isInvalidUrl || hasError ? getFallbackSrc() : src;

  if ((isInvalidUrl || hasError) && isAdmin) {
    return (
      <div className={`bg-stone-100 border border-stone-300 flex flex-col items-center justify-center p-4 text-center ${className}`}>
        <AlertCircle className="w-6 h-6 text-amber-600 mb-1" />
        <p className="text-[11px] font-semibold text-stone-800">Image unavailable</p>
        <p className="text-[10px] text-stone-500 mb-2">Source URL missing or expired.</p>
        {onReplaceClick && (
          <button
            onClick={onReplaceClick}
            className="px-2.5 py-1 text-[10px] font-semibold bg-[#1A1A1A] text-white hover:bg-[#C5A059] transition-colors cursor-pointer"
          >
            Replace Image
          </button>
        )}
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      referrerPolicy="no-referrer"
    />
  );
};
