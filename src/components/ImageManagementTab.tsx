import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  CheckCircle,
  Star,
  RefreshCw,
  Eye,
  X,
  Plus,
  ArrowUpDown,
  MoveLeft,
  MoveRight,
  AlertCircle,
  FolderOpen,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Edit3,
  Building2
} from 'lucide-react';
import { api, getAdminToken } from '../lib/api';
import { ManagedImage, GalleryCategory } from '../types';
import { ManagedImageDisplay } from './ManagedImageDisplay';

const GALLERY_CATEGORIES: GalleryCategory[] = [
  'Hotel Exterior',
  'Hotel Entrance',
  'Lobby',
  'Reception',
  'Restaurant',
  'Common Areas',
  'Facilities',
  'Food',
  'Temple Surroundings',
  'Location'
];

export const ImageManagementTab: React.FC = () => {
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active navigation view inside Image Management: Rooms, Gallery, or Property Cover Images
  const [mainView, setMainView] = useState<'rooms' | 'gallery' | 'property-covers'>('rooms');
  const [selectedRoomForGallery, setSelectedRoomForGallery] = useState<'deluxe' | 'family' | null>(null);
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState<string>('all');

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTargetRoom, setUploadTargetRoom] = useState<'deluxe' | 'family' | 'none'>('none');
  const [uploadTargetProperty, setUploadTargetProperty] = useState<string>('sbm-hotel');
  const [uploadTargetCategory, setUploadTargetCategory] = useState<string>('Hotel Exterior');
  const [uploadIsPrimary, setUploadIsPrimary] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; size: number; base64: string }[]>([]);
  const [uploadUrlInput, setUploadUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Replace Modal
  const [replacingImage, setReplacingImage] = useState<ManagedImage | null>(null);
  const [replaceFile, setReplaceFile] = useState<{ name: string; size: number; base64: string } | null>(null);
  const [replaceUrlInput, setReplaceUrlInput] = useState('');
  const [replaceTitle, setReplaceTitle] = useState('');
  const [replaceDescription, setReplaceDescription] = useState('');
  const [replaceIsPrimary, setReplaceIsPrimary] = useState(false);
  const [replaceTargetProperty, setReplaceTargetProperty] = useState<string>('sbm-hotel');

  // Delete Confirmation
  const [deletingImage, setDeletingImage] = useState<ManagedImage | null>(null);

  // Lightbox Preview
  const [previewImage, setPreviewImage] = useState<ManagedImage | null>(null);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const token = getAdminToken() || '';

  const showNotification = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => {
      setActionMessage(null);
    }, 4000);
  };

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminImages(token);
      setImages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load managed images', err);
      setError(err?.message || 'Failed to load images. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  // 1. Room Images
  const deluxeImages = (images || []).filter(
    img => img.roomId === 'deluxe' || img.category === 'Deluxe Room'
  );
  const familyImages = (images || []).filter(
    img => img.roomId === 'family' || img.category === 'Family Suite'
  );

  const deluxePrimary = deluxeImages.find(img => img.isPrimaryCover || img.isMainForRoom) || deluxeImages[0];
  const familyPrimary = familyImages.find(img => img.isPrimaryCover || img.isMainForRoom) || familyImages[0];

  // 2. Property Cover Images (Dedicated for Our Properties cards on public site)
  const propertyCoverImages = (images || []).filter(
    img => img.category === 'Property Cover'
  );
  const sbmHotelCoverImages = propertyCoverImages.filter(
    img => !img.propertyId || img.propertyId === 'sbm-hotel'
  );
  const sbmGuestHouseCoverImages = propertyCoverImages.filter(
    img => img.propertyId === 'sbm-guest-house'
  );

  const sbmHotelPrimaryCover = sbmHotelCoverImages.find(img => img.isPrimaryCover) || sbmHotelCoverImages[0];
  const sbmGuestHousePrimaryCover = sbmGuestHouseCoverImages.find(img => img.isPrimaryCover) || sbmGuestHouseCoverImages[0];

  // 3. Hotel Gallery Images (General property amenities, excluding room categories and dedicated property covers)
  const hotelGalleryImages = (images || []).filter(
    img => img.roomId !== 'deluxe' &&
           img.roomId !== 'family' &&
           img.category !== 'Deluxe Room' &&
           img.category !== 'Family Suite' &&
           img.category !== 'Property Cover'
  );

  const filteredHotelGallery = galleryCategoryFilter === 'all'
    ? hotelGalleryImages
    : hotelGalleryImages.filter(img => img.category === galleryCategoryFilter);

  // Handlers for File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList: { name: string; size: number; base64: string }[] = [];
    let oversized = false;
    const fileArray: File[] = Array.from(files);

    fileArray.forEach(file => {
      if (file.size > 2 * 1024 * 1024) {
        oversized = true;
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          fileList.push({
            name: file.name,
            size: file.size,
            base64: event.target.result as string
          });
          if (fileList.length === fileArray.length || fileList.length === fileArray.length - (oversized ? 1 : 0)) {
            setSelectedFiles(prev => [...prev, ...fileList]);
          }
        }
      };
      reader.readAsDataURL(file);
    });

    if (oversized) {
      showNotification('error', 'Some files were skipped because they exceed the 2MB size limit.');
    }
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showNotification('error', 'File exceeds the 2MB limit. Please choose a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setReplaceFile({
          name: file.name,
          size: file.size,
          base64: event.target.result as string
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const itemsToUpload: Partial<ManagedImage>[] = [];

      // Determine category and roomId
      let targetCat = uploadTargetCategory;
      let targetRoom: string | undefined = undefined;

      if (uploadTargetRoom === 'deluxe') {
        targetCat = 'Deluxe Room';
        targetRoom = 'deluxe';
      } else if (uploadTargetRoom === 'family') {
        targetCat = 'Family Suite';
        targetRoom = 'family';
      }

      // Add base64 files
      selectedFiles.forEach((file, index) => {
        itemsToUpload.push({
          imageUrl: file.base64,
          title: uploadTitle || file.name.replace(/\.[^/.]+$/, ''),
          description: uploadDescription,
          category: targetCat,
          roomId: targetRoom,
          propertyId: uploadTargetRoom === 'none' ? uploadTargetProperty : 'sbm-hotel',
          isPrimaryCover: uploadIsPrimary && index === 0,
          isMainForRoom: uploadIsPrimary && index === 0
        });
      });

      // Add direct URL if provided
      if (uploadUrlInput.trim()) {
        itemsToUpload.push({
          imageUrl: uploadUrlInput.trim(),
          title: uploadTitle || 'Public Image',
          description: uploadDescription,
          category: targetCat,
          roomId: targetRoom,
          propertyId: uploadTargetRoom === 'none' ? uploadTargetProperty : 'sbm-hotel',
          isPrimaryCover: uploadIsPrimary && itemsToUpload.length === 0,
          isMainForRoom: uploadIsPrimary && itemsToUpload.length === 0
        });
      }

      if (itemsToUpload.length === 0) {
        showNotification('error', 'Please select at least one image file or provide a valid image URL.');
        setIsSubmitting(false);
        return;
      }

      if (itemsToUpload.length === 1) {
        await api.addImage(token, itemsToUpload[0]);
      } else {
        await api.addImage(token, { images: itemsToUpload });
      }

      showNotification('success', `Successfully uploaded ${itemsToUpload.length} image${itemsToUpload.length > 1 ? 's' : ''}.`);
      setIsUploadModalOpen(false);
      resetUploadForm();
      fetchImages();
    } catch (err: any) {
      console.error('Upload failed', err);
      showNotification('error', err?.message || 'Failed to upload images.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedFiles([]);
    setUploadUrlInput('');
    setUploadTitle('');
    setUploadDescription('');
    setUploadIsPrimary(false);
    setUploadTargetProperty('sbm-hotel');
  };

  // Replace submission
  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacingImage) return;

    setIsSubmitting(true);
    try {
      const newImageUrl = replaceFile ? replaceFile.base64 : replaceUrlInput.trim() || replacingImage.imageUrl;

      await api.updateImage(token, replacingImage.id, {
        imageUrl: newImageUrl,
        title: replaceTitle.trim() || replacingImage.title,
        description: replaceDescription.trim() || replacingImage.description,
        isPrimaryCover: replaceIsPrimary,
        isMainForRoom: replaceIsPrimary,
        propertyId: replaceTargetProperty
      });

      showNotification('success', 'Image successfully replaced and updated.');
      setReplacingImage(null);
      setReplaceFile(null);
      setReplaceUrlInput('');
      fetchImages();
    } catch (err: any) {
      console.error('Replace failed', err);
      showNotification('error', err?.message || 'Failed to replace image.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set as Primary Image
  const handleSetPrimary = async (image: ManagedImage) => {
    try {
      await api.setPrimaryImage(token, image.id, image.roomId, image.propertyId);
      showNotification('success', `Set "${image.title || 'Image'}" as primary cover.`);
      fetchImages();
    } catch (err: any) {
      console.error('Failed to set primary image', err);
      showNotification('error', err?.message || 'Failed to set primary image.');
    }
  };

  // Delete Image
  const handleDeleteConfirm = async () => {
    if (!deletingImage) return;
    try {
      await api.deleteImage(token, deletingImage.id);
      showNotification('success', 'Image deleted successfully.');
      setDeletingImage(null);
      fetchImages();
    } catch (err: any) {
      console.error('Delete failed', err);
      showNotification('error', err?.message || 'Failed to delete image.');
    }
  };

  // Reorder Images (Move Left / Right)
  const handleMoveOrder = async (list: ManagedImage[], index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const reordered = [...list];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const orderedIds = reordered.map(img => img.id);

    // Optimistic UI update
    setImages(prev => {
      const updatedMap = new Map<string, ManagedImage>(prev.map(item => [item.id, item]));
      orderedIds.forEach((id, idx) => {
        const item = updatedMap.get(id);
        if (item) {
          updatedMap.set(id, { ...item, displayOrder: idx + 1 });
        }
      });
      return Array.from(updatedMap.values());
    });

    try {
      await api.reorderImages(token, orderedIds);
      showNotification('success', 'Image order updated successfully.');
    } catch (err: any) {
      console.error('Failed to reorder images', err);
      showNotification('error', 'Failed to update order on server.');
      fetchImages();
    }
  };

  const openUploadForRoom = (roomCode: 'deluxe' | 'family', isPrimary: boolean = false) => {
    setUploadTargetRoom(roomCode);
    setUploadIsPrimary(isPrimary);
    setUploadTargetCategory(roomCode === 'deluxe' ? 'Deluxe Room' : 'Family Suite');
    setIsUploadModalOpen(true);
  };

  const openUploadForGallery = (category?: string) => {
    setUploadTargetRoom('none');
    setUploadIsPrimary(false);
    setUploadTargetCategory(category || 'Hotel Exterior');
    setUploadTargetProperty('sbm-hotel');
    setIsUploadModalOpen(true);
  };

  const openUploadForPropertyCover = (propertyCode: 'sbm-hotel' | 'sbm-guest-house' = 'sbm-hotel') => {
    setUploadTargetRoom('none');
    setUploadTargetCategory('Property Cover');
    setUploadTargetProperty(propertyCode);
    setUploadIsPrimary(true);
    setIsUploadModalOpen(true);
  };

  const openReplaceModal = (image: ManagedImage) => {
    setReplacingImage(image);
    setReplaceTitle(image.title || '');
    setReplaceDescription(image.description || '');
    setReplaceFile(null);
    setReplaceUrlInput('');
    setReplaceIsPrimary(Boolean(image.isPrimaryCover || image.isMainForRoom));
    setReplaceTargetProperty(image.propertyId || 'sbm-hotel');
  };

  return (
    <div id="image-management-module" className="space-y-6">
      {/* Module Header */}
      <div className="bg-white border border-[#C5A059]/20 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.2em] text-[#C5A059] uppercase mb-1">
            <ImageIcon className="w-3.5 h-3.5" />
            Public Media Asset System
          </div>
          <h2 className="text-2xl font-serif text-[#1A1A1A] font-semibold">
            Image Management & Hotel Gallery
          </h2>
          <p className="text-xs text-stone-600 mt-1 max-w-2xl">
            Manage public-facing photography for Room Categories (Deluxe Room & Family Suite), official Hotel Gallery, and Property Cover Images.
            Primary cover images and galleries set here synchronize automatically with the live booking website.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="refresh-images-btn"
            onClick={fetchImages}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-medium border border-stone-200 hover:border-[#C5A059] bg-stone-50 hover:bg-stone-100 text-stone-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Reload images from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            id="upload-master-btn"
            onClick={() => {
              if (mainView === 'rooms' && selectedRoomForGallery) {
                openUploadForRoom(selectedRoomForGallery);
              } else if (mainView === 'property-covers') {
                openUploadForPropertyCover('sbm-hotel');
              } else {
                openUploadForGallery();
              }
            }}
            className="px-4 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Upload New Photos
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 text-xs flex items-center justify-between transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs (Room Images | Hotel Gallery | Property Cover Images) */}
      <div className="border-b border-stone-200 bg-white px-6 pt-3 flex items-center gap-4 flex-wrap">
        <button
          id="nav-room-images-tab"
          onClick={() => {
            setMainView('rooms');
            setSelectedRoomForGallery(null);
          }}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer flex items-center gap-2 ${
            mainView === 'rooms'
              ? 'text-[#1A1A1A] border-b-2 border-[#C5A059]'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Layers className="w-4 h-4 text-[#C5A059]" />
          ROOM IMAGES ({deluxeImages.length + familyImages.length})
        </button>

        <button
          id="nav-hotel-gallery-tab"
          onClick={() => {
            setMainView('gallery');
            setSelectedRoomForGallery(null);
          }}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer flex items-center gap-2 ${
            mainView === 'gallery'
              ? 'text-[#1A1A1A] border-b-2 border-[#C5A059]'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-[#C5A059]" />
          HOTEL GALLERY ({hotelGalleryImages.length})
        </button>

        <button
          id="nav-property-covers-tab"
          onClick={() => {
            setMainView('property-covers');
            setSelectedRoomForGallery(null);
          }}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer flex items-center gap-2 ${
            mainView === 'property-covers'
              ? 'text-[#1A1A1A] border-b-2 border-[#C5A059]'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Building2 className="w-4 h-4 text-[#C5A059]" />
          PROPERTY COVER IMAGES ({propertyCoverImages.length})
        </button>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="text-sm font-semibold text-rose-900">Unable to load image assets</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchImages}
            className="px-4 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          <div className="bg-white border border-stone-200 p-6 space-y-4 h-80">
            <div className="h-6 bg-stone-200 w-1/3" />
            <div className="h-44 bg-stone-100 w-full" />
            <div className="h-8 bg-stone-200 w-full" />
          </div>
          <div className="bg-white border border-stone-200 p-6 space-y-4 h-80">
            <div className="h-6 bg-stone-200 w-1/3" />
            <div className="h-44 bg-stone-100 w-full" />
            <div className="h-8 bg-stone-200 w-full" />
          </div>
        </div>
      )}

      {/* MAIN VIEW 1: ROOM IMAGES */}
      {!loading && !error && mainView === 'rooms' && !selectedRoomForGallery && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deluxe Room Card */}
            <div id="card-deluxe-room-images" className="bg-white border border-[#C5A059]/20 shadow-sm p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C5A059]" />
                    <h3 className="text-lg font-serif font-semibold text-[#1A1A1A]">Deluxe Room</h3>
                  </div>
                  <span className="text-[11px] font-semibold bg-stone-100 text-stone-700 px-2.5 py-0.5 border border-stone-200">
                    Gallery: {deluxeImages.length} {deluxeImages.length === 1 ? 'image' : 'images'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mb-4">
                  Default public room category for 1-2 guests (₹2,500/night). The primary image is shown on room cards across the website.
                </p>

                {/* Primary Cover Image Preview */}
                <div className="relative h-60 bg-stone-100 border border-stone-200 overflow-hidden group">
                  {deluxePrimary ? (
                    <>
                      <ManagedImageDisplay
                        src={deluxePrimary.imageUrl}
                        alt={deluxePrimary.title || 'Deluxe Room Cover'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        fallbackType="deluxe"
                        isAdmin={true}
                        onReplaceClick={() => openReplaceModal(deluxePrimary)}
                      />
                      <div className="absolute top-3 left-3 bg-[#1A1A1A]/85 text-[#C5A059] border border-[#C5A059]/40 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 backdrop-blur-sm flex items-center gap-1.5 shadow-sm">
                        <Star className="w-3 h-3 fill-[#C5A059]" />
                        Primary Cover
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white pointer-events-none">
                        <p className="text-xs font-semibold">{deluxePrimary.title || 'Deluxe Room'}</p>
                        {deluxePrimary.description && (
                          <p className="text-[11px] text-stone-300 line-clamp-1">{deluxePrimary.description}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                      <ImageIcon className="w-10 h-10 mb-2 opacity-40" />
                      <p className="text-xs">No images uploaded for Deluxe Room</p>
                    </div>
                  )}
                </div>

                {/* Mini thumbnails preview */}
                {deluxeImages.length > 1 && (
                  <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                    {deluxeImages.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={() => openReplaceModal(img)}
                        className={`relative w-14 h-12 shrink-0 border overflow-hidden cursor-pointer transition-all ${
                          img.id === deluxePrimary?.id ? 'border-[#C5A059] ring-2 ring-[#C5A059]/30' : 'border-stone-200 opacity-70 hover:opacity-100'
                        }`}
                        title={img.title || `Photo ${idx + 1}`}
                      >
                        <ManagedImageDisplay
                          src={img.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          fallbackType="deluxe"
                          isAdmin={true}
                        />
                        {img.id === deluxePrimary?.id && (
                          <div className="absolute bottom-0 inset-x-0 bg-[#C5A059] text-[8px] font-bold text-white text-center py-0.2">
                            PRIMARY
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-stone-100 flex items-center gap-2">
                <button
                  id="change-deluxe-cover-btn"
                  onClick={() => openUploadForRoom('deluxe', true)}
                  className="flex-1 py-2 text-xs font-medium border border-stone-300 hover:border-[#C5A059] bg-white hover:bg-stone-50 text-stone-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                  Change Cover
                </button>
                <button
                  id="manage-deluxe-gallery-btn"
                  onClick={() => setSelectedRoomForGallery('deluxe')}
                  className="flex-1 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Manage Gallery ({deluxeImages.length})
                </button>
              </div>
            </div>

            {/* Family Suite Card */}
            <div id="card-family-suite-images" className="bg-white border border-[#C5A059]/20 shadow-sm p-6 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C5A059]" />
                    <h3 className="text-lg font-serif font-semibold text-[#1A1A1A]">Family Suite</h3>
                  </div>
                  <span className="text-[11px] font-semibold bg-stone-100 text-stone-700 px-2.5 py-0.5 border border-stone-200">
                    Gallery: {familyImages.length} {familyImages.length === 1 ? 'image' : 'images'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mb-4">
                  Spacious accommodation for 3-5 guests with dual beds and lounge (₹3,500/night). Displayed on public website and booking dialogs.
                </p>

                {/* Primary Cover Image Preview */}
                <div className="relative h-60 bg-stone-100 border border-stone-200 overflow-hidden group">
                  {familyPrimary ? (
                    <>
                      <ManagedImageDisplay
                        src={familyPrimary.imageUrl}
                        alt={familyPrimary.title || 'Family Suite Cover'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        fallbackType="family"
                        isAdmin={true}
                        onReplaceClick={() => openReplaceModal(familyPrimary)}
                      />
                      <div className="absolute top-3 left-3 bg-[#1A1A1A]/85 text-[#C5A059] border border-[#C5A059]/40 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 backdrop-blur-sm flex items-center gap-1.5 shadow-sm">
                        <Star className="w-3 h-3 fill-[#C5A059]" />
                        Primary Cover
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white pointer-events-none">
                        <p className="text-xs font-semibold">{familyPrimary.title || 'Family Suite'}</p>
                        {familyPrimary.description && (
                          <p className="text-[11px] text-stone-300 line-clamp-1">{familyPrimary.description}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                      <ImageIcon className="w-10 h-10 mb-2 opacity-40" />
                      <p className="text-xs">No images uploaded for Family Suite</p>
                    </div>
                  )}
                </div>

                {/* Mini thumbnails preview */}
                {familyImages.length > 1 && (
                  <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                    {familyImages.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={() => openReplaceModal(img)}
                        className={`relative w-14 h-12 shrink-0 border overflow-hidden cursor-pointer transition-all ${
                          img.id === familyPrimary?.id ? 'border-[#C5A059] ring-2 ring-[#C5A059]/30' : 'border-stone-200 opacity-70 hover:opacity-100'
                        }`}
                        title={img.title || `Photo ${idx + 1}`}
                      >
                        <ManagedImageDisplay
                          src={img.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          fallbackType="family"
                          isAdmin={true}
                        />
                        {img.id === familyPrimary?.id && (
                          <div className="absolute bottom-0 inset-x-0 bg-[#C5A059] text-[8px] font-bold text-white text-center py-0.2">
                            PRIMARY
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-stone-100 flex items-center gap-2">
                <button
                  id="change-family-cover-btn"
                  onClick={() => openUploadForRoom('family', true)}
                  className="flex-1 py-2 text-xs font-medium border border-stone-300 hover:border-[#C5A059] bg-white hover:bg-stone-50 text-stone-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                  Change Cover
                </button>
                <button
                  id="manage-family-gallery-btn"
                  onClick={() => setSelectedRoomForGallery('family')}
                  className="flex-1 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Manage Gallery ({familyImages.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED ROOM GALLERY VIEW (When a Room Category is clicked) */}
      {!loading && !error && mainView === 'rooms' && selectedRoomForGallery && (
        <div className="space-y-6">
          {/* Breadcrumb & Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-stone-200 p-4">
            <div className="flex items-center gap-3">
              <button
                id="back-to-room-overview-btn"
                onClick={() => setSelectedRoomForGallery(null)}
                className="p-1.5 border border-stone-200 hover:border-[#C5A059] hover:bg-stone-50 text-stone-700 transition-colors cursor-pointer"
                title="Back to Room Overview"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-base font-serif font-semibold text-[#1A1A1A] flex items-center gap-2">
                  {selectedRoomForGallery === 'deluxe' ? 'Deluxe Room Gallery' : 'Family Suite Gallery'}
                  <span className="text-xs font-normal text-stone-500 font-sans">
                    ({(selectedRoomForGallery === 'deluxe' ? deluxeImages : familyImages).length} photos)
                  </span>
                </h3>
                <p className="text-[11px] text-stone-500">
                  Set primary cover, reorder photos, replace files, or upload new high-resolution interior photos.
                </p>
              </div>
            </div>

            <button
              id="upload-room-photos-btn"
              onClick={() => openUploadForRoom(selectedRoomForGallery)}
              className="px-3.5 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload Photo for {selectedRoomForGallery === 'deluxe' ? 'Deluxe Room' : 'Family Suite'}
            </button>
          </div>

          {/* Room Gallery Grid */}
          {(() => {
            const currentList = selectedRoomForGallery === 'deluxe' ? deluxeImages : familyImages;
            if (currentList.length === 0) {
              return (
                <div className="bg-white border border-stone-200 p-12 text-center space-y-3">
                  <ImageIcon className="w-12 h-12 text-stone-300 mx-auto" />
                  <h4 className="text-sm font-semibold text-stone-700">No photos uploaded yet</h4>
                  <p className="text-xs text-stone-500">Upload your first photo for this room category to display it on the website.</p>
                  <button
                    onClick={() => openUploadForRoom(selectedRoomForGallery)}
                    className="px-4 py-2 text-xs font-medium bg-[#C5A059] text-white hover:bg-[#b08e4d] transition-colors cursor-pointer"
                  >
                    + Upload Photo
                  </button>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentList.map((img, index) => {
                  const isPrimary = Boolean(img.isPrimaryCover || img.isMainForRoom);
                  return (
                    <div
                      key={img.id}
                      className={`bg-white border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                        isPrimary
                          ? 'border-[#C5A059] ring-2 ring-[#C5A059]/20 shadow-md'
                          : 'border-stone-200 hover:border-stone-300 shadow-sm'
                      }`}
                    >
                      {/* Image Thumbnail with Overlay controls */}
                      <div className="relative h-48 bg-stone-100 overflow-hidden group">
                        <img
                          src={img.imageUrl}
                          alt={img.title || 'Room photo'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                          {isPrimary && (
                            <span className="bg-[#1A1A1A]/90 text-[#C5A059] border border-[#C5A059]/50 text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 shadow-sm flex items-center gap-1 backdrop-blur-sm">
                              <Star className="w-2.5 h-2.5 fill-[#C5A059]" />
                              Primary Cover
                            </span>
                          )}
                          <span className="bg-black/60 text-white text-[9px] font-mono px-2 py-0.5 backdrop-blur-sm self-start">
                            #{index + 1}
                          </span>
                        </div>

                        {/* Zoom Preview Button */}
                        <button
                          onClick={() => setPreviewImage(img)}
                          className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 text-white p-1.5 transition-opacity opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                          title="View Fullscreen"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Info & Metadata */}
                      <div className="p-3.5 space-y-1.5 flex-1">
                        <h4 className="text-xs font-semibold text-[#1A1A1A] line-clamp-1">
                          {img.title || 'Untitled photo'}
                        </h4>
                        {img.description && (
                          <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                            {img.description}
                          </p>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="p-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-1 text-xs">
                        {/* Reorder Left/Right */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveOrder(currentList, index, 'left')}
                            disabled={index === 0}
                            className="p-1 border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Move Earlier"
                          >
                            <MoveLeft className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleMoveOrder(currentList, index, 'right')}
                            disabled={index === currentList.length - 1}
                            className="p-1 border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Move Later"
                          >
                            <MoveRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Set Primary or Replace */}
                        <div className="flex items-center gap-1">
                          {!isPrimary ? (
                            <button
                              onClick={() => handleSetPrimary(img)}
                              className="px-2 py-1 text-[10px] font-semibold bg-white hover:bg-[#C5A059] hover:text-white border border-[#C5A059] text-[#C5A059] transition-all cursor-pointer"
                              title="Set as Primary Room Cover"
                            >
                              Make Cover
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 px-1.5">
                              <Check className="w-3 h-3" /> Cover
                            </span>
                          )}

                          <button
                            onClick={() => openReplaceModal(img)}
                            className="p-1 text-stone-600 hover:text-[#1A1A1A] hover:bg-stone-200 transition-colors cursor-pointer"
                            title="Replace / Edit image"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeletingImage(img)}
                            className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* MAIN VIEW 2: HOTEL GALLERY */}
      {!loading && !error && mainView === 'gallery' && (
        <div className="space-y-6">
          {/* Category Filter Bar */}
          <div className="bg-white border border-stone-200 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                <Filter className="w-3.5 h-3.5 text-[#C5A059]" />
                Filter by Category:
              </div>
              <button
                id="upload-category-btn"
                onClick={() => openUploadForGallery(galleryCategoryFilter !== 'all' ? galleryCategoryFilter : 'Hotel Exterior')}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Upload Photo to {galleryCategoryFilter === 'all' ? 'Gallery' : galleryCategoryFilter}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                onClick={() => setGalleryCategoryFilter('all')}
                className={`px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  galleryCategoryFilter === 'all'
                    ? 'bg-[#1A1A1A] text-white shadow-sm'
                    : 'bg-stone-50 text-stone-600 border border-stone-200 hover:border-[#C5A059]'
                }`}
              >
                All Categories ({hotelGalleryImages.length})
              </button>

              {GALLERY_CATEGORIES.map(cat => {
                const count = hotelGalleryImages.filter(img => img.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setGalleryCategoryFilter(cat)}
                    className={`px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                      galleryCategoryFilter === cat
                        ? 'bg-[#1A1A1A] text-white shadow-sm'
                        : 'bg-stone-50 text-stone-600 border border-stone-200 hover:border-[#C5A059]'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hotel Gallery Grid */}
          {filteredHotelGallery.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center space-y-3">
              <ImageIcon className="w-12 h-12 text-stone-300 mx-auto" />
              <h4 className="text-sm font-semibold text-stone-700">
                No photos found in {galleryCategoryFilter === 'all' ? 'Hotel Gallery' : galleryCategoryFilter}
              </h4>
              <p className="text-xs text-stone-500">
                Upload photos to show guests the hotel exterior, entrance, dining, lobby, and temple surroundings.
              </p>
              <button
                onClick={() => openUploadForGallery(galleryCategoryFilter !== 'all' ? galleryCategoryFilter : 'Hotel Exterior')}
                className="px-4 py-2 text-xs font-medium bg-[#C5A059] text-white hover:bg-[#b08e4d] transition-colors cursor-pointer"
              >
                + Upload First Photo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredHotelGallery.map((img, index) => {
                return (
                  <div
                    key={img.id}
                    className="bg-white border border-stone-200 hover:border-stone-300 shadow-sm transition-all overflow-hidden flex flex-col justify-between"
                  >
                    {/* Image Thumbnail */}
                    <div className="relative h-48 bg-stone-100 overflow-hidden group">
                      <img
                        src={img.imageUrl}
                        alt={img.title || img.category}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Category & Property Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                        {img.isPrimaryCover && (
                          <span className="bg-[#1A1A1A]/95 text-[#C5A059] border border-[#C5A059]/60 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-sm flex items-center gap-1 backdrop-blur-sm">
                            <Star className="w-2.5 h-2.5 fill-[#C5A059]" /> Primary Property Cover
                          </span>
                        )}
                        <span className="bg-[#1A1A1A]/90 text-[#C5A059] border border-[#C5A059]/40 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 backdrop-blur-sm self-start">
                          {img.category}
                        </span>
                        <span className="bg-stone-900/80 text-stone-300 border border-stone-700/50 text-[9px] font-medium px-2 py-0.5 backdrop-blur-sm self-start">
                          {img.propertyId === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel'}
                        </span>
                        <span className="bg-black/60 text-white text-[9px] font-mono px-2 py-0.5 backdrop-blur-sm self-start">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Zoom Button */}
                      <button
                        onClick={() => setPreviewImage(img)}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 text-white p-1.5 transition-opacity opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                        title="View Fullscreen"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Metadata */}
                    <div className="p-3.5 space-y-1.5 flex-1">
                      <h4 className="text-xs font-semibold text-[#1A1A1A] line-clamp-1">
                        {img.title || img.category}
                      </h4>
                      {img.description && (
                        <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                          {img.description}
                        </p>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="p-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-1 text-xs">
                      {/* Reorder buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveOrder(filteredHotelGallery, index, 'left')}
                          disabled={index === 0}
                          className="p-1 border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title="Move Left"
                        >
                          <MoveLeft className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveOrder(filteredHotelGallery, index, 'right')}
                          disabled={index === filteredHotelGallery.length - 1}
                          className="p-1 border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title="Move Right"
                        >
                          <MoveRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!img.isPrimaryCover ? (
                          <button
                            onClick={() => handleSetPrimary(img)}
                            className="px-2 py-1 text-[10px] font-semibold bg-white hover:bg-[#C5A059] hover:text-white border border-[#C5A059] text-[#C5A059] transition-all cursor-pointer"
                            title="Set as Primary Cover for this Property"
                          >
                            Set Cover
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 px-1">
                            <Check className="w-3 h-3" /> Primary
                          </span>
                        )}

                        <button
                          onClick={() => openReplaceModal(img)}
                          className="p-1 text-stone-600 hover:text-[#1A1A1A] hover:bg-stone-200 transition-colors cursor-pointer"
                          title="Replace / Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeletingImage(img)}
                          className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MAIN VIEW 3: PROPERTY COVER IMAGES */}
      {!loading && !error && mainView === 'property-covers' && (
        <div id="view-property-covers" className="space-y-6">
          {/* Informational Guidance Banner */}
          <div className="bg-gradient-to-r from-amber-50/90 to-stone-50 border border-[#C5A059]/30 p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#C5A059] shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-stone-700">
                <p className="font-bold text-[#1A1A1A] uppercase tracking-wider text-[11px]">
                  Public Website "Our Properties" Cover Images
                </p>
                <p className="max-w-3xl">
                  Manage the primary featured cover and carousel photography for each hotel property (<strong>SBM Hotel</strong> and <strong>SBM 2 Guest House</strong>).
                  The marked <strong>Primary Cover</strong> is displayed as the prominent hero image on the public homepage card.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => openUploadForPropertyCover('sbm-hotel')}
                className="px-3 py-1.5 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Upload Cover Photo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* PROPERTY 1: SBM HOTEL */}
            <div id="property-card-sbm-hotel" className="bg-white border border-[#C5A059]/20 shadow-sm p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#C5A059] ring-2 ring-[#C5A059]/20" />
                    <div>
                      <h3 className="text-xl font-serif font-semibold text-[#1A1A1A]">SBM Hotel</h3>
                      <p className="text-[11px] text-stone-500">Main Temple Road, Opp. Salasar Balaji Temple • Property ID: sbm-hotel</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold bg-stone-100 text-stone-700 px-3 py-1 border border-stone-200">
                    {sbmHotelCoverImages.length} {sbmHotelCoverImages.length === 1 ? 'cover image' : 'cover images'}
                  </span>
                </div>

                {/* Primary Cover Hero Preview */}
                <div className="relative h-64 sm:h-72 bg-stone-100 border border-stone-200 overflow-hidden group shadow-inner">
                  {sbmHotelPrimaryCover ? (
                    <>
                      <ManagedImageDisplay
                        src={sbmHotelPrimaryCover.imageUrl}
                        alt={sbmHotelPrimaryCover.title || 'SBM Hotel Main Cover'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        fallbackType="sbm-hotel"
                        isAdmin={true}
                        onReplaceClick={() => openReplaceModal(sbmHotelPrimaryCover)}
                      />

                      {/* Primary Cover Badge */}
                      <div className="absolute top-3 left-3 bg-[#1A1A1A]/90 text-[#C5A059] border border-[#C5A059]/50 text-[10px] font-bold uppercase tracking-wider px-3 py-1 backdrop-blur-sm flex items-center gap-1.5 shadow-md">
                        <Star className="w-3.5 h-3.5 fill-[#C5A059]" />
                        PRIMARY PROPERTY COVER
                      </div>

                      {/* Public Website Status Badge */}
                      <div className="absolute top-3 right-3 bg-emerald-950/85 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold px-2.5 py-1 backdrop-blur-sm flex items-center gap-1 shadow-md">
                        <Check className="w-3 h-3 text-emerald-400" />
                        Live on Public Card
                      </div>

                      {/* Bottom Caption Overlay */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{sbmHotelPrimaryCover.title || 'SBM Hotel Main Exterior'}</p>
                            <p className="text-xs text-stone-300 line-clamp-1">{sbmHotelPrimaryCover.description || 'Public homepage property carousel cover photo'}</p>
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A059] bg-black/50 px-2 py-0.5 border border-[#C5A059]/30">
                            Slide 1 of {sbmHotelCoverImages.length || 1}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 p-6 text-center">
                      <Building2 className="w-12 h-12 mb-2 text-[#C5A059]/40" />
                      <p className="text-sm font-semibold text-stone-700">No cover images uploaded for SBM Hotel</p>
                      <p className="text-xs text-stone-400 mt-1 max-w-xs">Upload photography to customize the SBM Hotel card on the homepage.</p>
                      <button
                        onClick={() => openUploadForPropertyCover('sbm-hotel')}
                        className="mt-3 px-4 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all cursor-pointer"
                      >
                        Upload SBM Hotel Cover
                      </button>
                    </div>
                  )}
                </div>

                {/* Primary Cover Quick Action Bar */}
                {sbmHotelPrimaryCover && (
                  <div className="p-3 bg-stone-50 border border-stone-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-stone-600 font-medium text-[11px]">
                      <Star className="w-3.5 h-3.5 text-[#C5A059] fill-[#C5A059]" />
                      Active Primary Cover
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openUploadForPropertyCover('sbm-hotel')}
                        className="px-3 py-1 text-xs font-medium bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Another Cover
                      </button>

                      <button
                        onClick={() => openReplaceModal(sbmHotelPrimaryCover)}
                        className="px-3 py-1 text-xs font-semibold bg-white hover:bg-[#C5A059] hover:text-white text-[#1A1A1A] border border-stone-300 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Replace Cover
                      </button>

                      <button
                        onClick={() => setDeletingImage(sbmHotelPrimaryCover)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                        title="Delete this image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Property Carousel Order / Gallery Sequence */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
                      Property Carousel Sequence ({sbmHotelCoverImages.length})
                    </h4>
                    <span className="text-[10px] text-stone-500">Order controls carousel sequence on homepage</span>
                  </div>

                  {sbmHotelCoverImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {sbmHotelCoverImages.map((img, idx) => {
                        const isPrimary = Boolean(img.isPrimaryCover);
                        return (
                          <div
                            key={img.id}
                            className={`border bg-white transition-all flex flex-col justify-between ${
                              isPrimary
                                ? 'border-[#C5A059] ring-2 ring-[#C5A059]/20 shadow-sm'
                                : 'border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            <div className="relative h-28 bg-stone-100 overflow-hidden">
                              <ManagedImageDisplay
                                src={img.imageUrl}
                                alt={img.title || ''}
                                className="w-full h-full object-cover cursor-pointer"
                                fallbackType="sbm-hotel"
                                isAdmin={true}
                                onReplaceClick={() => openReplaceModal(img)}
                              />

                              {isPrimary && (
                                <div className="absolute top-1.5 left-1.5 bg-[#C5A059] text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 flex items-center gap-1 shadow">
                                  <Star className="w-2.5 h-2.5 fill-white" />
                                  Cover
                                </div>
                              )}

                              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-semibold px-1.5 py-0.2">
                                #{idx + 1}
                              </div>
                            </div>

                            <div className="p-2 space-y-1.5 bg-white">
                              <p className="text-[11px] font-medium text-stone-800 truncate" title={img.title || ''}>
                                {img.title || `Photo #${idx + 1}`}
                              </p>

                              {/* Controls */}
                              <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleMoveOrder(sbmHotelCoverImages, idx, 'left')}
                                    disabled={idx === 0}
                                    className="p-1 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="Move Left (Earlier in carousel)"
                                  >
                                    <MoveLeft className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveOrder(sbmHotelCoverImages, idx, 'right')}
                                    disabled={idx === sbmHotelCoverImages.length - 1}
                                    className="p-1 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="Move Right (Later in carousel)"
                                  >
                                    <MoveRight className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1">
                                  {!isPrimary ? (
                                    <button
                                      onClick={() => handleSetPrimary(img)}
                                      className="px-1.5 py-0.5 text-[10px] font-semibold bg-white hover:bg-[#C5A059] hover:text-white border border-[#C5A059] text-[#C5A059] transition-all cursor-pointer"
                                      title="Make Primary Cover"
                                    >
                                      Make Cover
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> Main
                                    </span>
                                  )}

                                  <button
                                    onClick={() => openReplaceModal(img)}
                                    className="p-1 text-stone-600 hover:text-[#1A1A1A] hover:bg-stone-100 cursor-pointer"
                                    title="Replace"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>

                                  <button
                                    onClick={() => setDeletingImage(img)}
                                    className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 italic py-2">No cover images uploaded yet.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
                <span className="text-[11px] text-stone-500">Live sync active on Homepage property card</span>
                <button
                  onClick={() => openUploadForPropertyCover('sbm-hotel')}
                  className="px-4 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload Photo for SBM Hotel
                </button>
              </div>
            </div>

            {/* PROPERTY 2: SBM 2 GUEST HOUSE */}
            <div id="property-card-sbm-guest-house" className="bg-white border border-[#C5A059]/20 shadow-sm p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#C5A059] ring-2 ring-[#C5A059]/20" />
                    <div>
                      <h3 className="text-xl font-serif font-semibold text-[#1A1A1A]">SBM 2 Guest House</h3>
                      <p className="text-[11px] text-stone-500">Near Temple Approach Road, Salasar • Property ID: sbm-guest-house</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold bg-stone-100 text-stone-700 px-3 py-1 border border-stone-200">
                    {sbmGuestHouseCoverImages.length} {sbmGuestHouseCoverImages.length === 1 ? 'cover image' : 'cover images'}
                  </span>
                </div>

                {/* Primary Cover Hero Preview */}
                <div className="relative h-64 sm:h-72 bg-stone-100 border border-stone-200 overflow-hidden group shadow-inner">
                  {sbmGuestHousePrimaryCover ? (
                    <>
                      <ManagedImageDisplay
                        src={sbmGuestHousePrimaryCover.imageUrl}
                        alt={sbmGuestHousePrimaryCover.title || 'SBM 2 Guest House Main Cover'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        fallbackType="guest-house"
                        isAdmin={true}
                        onReplaceClick={() => openReplaceModal(sbmGuestHousePrimaryCover)}
                      />

                      {/* Primary Cover Badge */}
                      <div className="absolute top-3 left-3 bg-[#1A1A1A]/90 text-[#C5A059] border border-[#C5A059]/50 text-[10px] font-bold uppercase tracking-wider px-3 py-1 backdrop-blur-sm flex items-center gap-1.5 shadow-md">
                        <Star className="w-3.5 h-3.5 fill-[#C5A059]" />
                        PRIMARY PROPERTY COVER
                      </div>

                      {/* Public Website Status Badge */}
                      <div className="absolute top-3 right-3 bg-emerald-950/85 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold px-2.5 py-1 backdrop-blur-sm flex items-center gap-1 shadow-md">
                        <Check className="w-3 h-3 text-emerald-400" />
                        Live on Public Card
                      </div>

                      {/* Bottom Caption Overlay */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{sbmGuestHousePrimaryCover.title || 'SBM 2 Guest House Main Exterior'}</p>
                            <p className="text-xs text-stone-300 line-clamp-1">{sbmGuestHousePrimaryCover.description || 'Public homepage property carousel cover photo'}</p>
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A059] bg-black/50 px-2 py-0.5 border border-[#C5A059]/30">
                            Slide 1 of {sbmGuestHouseCoverImages.length || 1}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 p-6 text-center">
                      <Building2 className="w-12 h-12 mb-2 text-[#C5A059]/40" />
                      <p className="text-sm font-semibold text-stone-700">No cover images uploaded for SBM 2 Guest House</p>
                      <p className="text-xs text-stone-400 mt-1 max-w-xs">Upload photography to customize the SBM 2 Guest House card on the homepage.</p>
                      <button
                        onClick={() => openUploadForPropertyCover('sbm-guest-house')}
                        className="mt-3 px-4 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all cursor-pointer"
                      >
                        Upload SBM 2 Guest House Cover
                      </button>
                    </div>
                  )}
                </div>

                {/* Primary Cover Quick Action Bar */}
                {sbmGuestHousePrimaryCover && (
                  <div className="p-3 bg-stone-50 border border-stone-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-stone-600 font-medium text-[11px]">
                      <Star className="w-3.5 h-3.5 text-[#C5A059] fill-[#C5A059]" />
                      Active Primary Cover
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openUploadForPropertyCover('sbm-guest-house')}
                        className="px-3 py-1 text-xs font-medium bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Another Cover
                      </button>

                      <button
                        onClick={() => openReplaceModal(sbmGuestHousePrimaryCover)}
                        className="px-3 py-1 text-xs font-semibold bg-white hover:bg-[#C5A059] hover:text-white text-[#1A1A1A] border border-stone-300 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Replace Cover
                      </button>

                      <button
                        onClick={() => setDeletingImage(sbmGuestHousePrimaryCover)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                        title="Delete this image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Property Carousel Order / Gallery Sequence */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
                      Property Carousel Sequence ({sbmGuestHouseCoverImages.length})
                    </h4>
                    <span className="text-[10px] text-stone-500">Order controls carousel sequence on homepage</span>
                  </div>

                  {sbmGuestHouseCoverImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {sbmGuestHouseCoverImages.map((img, idx) => {
                        const isPrimary = Boolean(img.isPrimaryCover);
                        return (
                          <div
                            key={img.id}
                            className={`border bg-white transition-all flex flex-col justify-between ${
                              isPrimary
                                ? 'border-[#C5A059] ring-2 ring-[#C5A059]/20 shadow-sm'
                                : 'border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            <div className="relative h-28 bg-stone-100 overflow-hidden">
                              <ManagedImageDisplay
                                src={img.imageUrl}
                                alt={img.title || ''}
                                className="w-full h-full object-cover cursor-pointer"
                                fallbackType="guest-house"
                                isAdmin={true}
                                onReplaceClick={() => openReplaceModal(img)}
                              />

                              {isPrimary && (
                                <div className="absolute top-1.5 left-1.5 bg-[#C5A059] text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 flex items-center gap-1 shadow">
                                  <Star className="w-2.5 h-2.5 fill-white" />
                                  Cover
                                </div>
                              )}

                              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-semibold px-1.5 py-0.2">
                                #{idx + 1}
                              </div>
                            </div>

                            <div className="p-2 space-y-1.5 bg-white">
                              <p className="text-[11px] font-medium text-stone-800 truncate" title={img.title || ''}>
                                {img.title || `Photo #${idx + 1}`}
                              </p>

                              {/* Controls */}
                              <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleMoveOrder(sbmGuestHouseCoverImages, idx, 'left')}
                                    disabled={idx === 0}
                                    className="p-1 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="Move Left (Earlier in carousel)"
                                  >
                                    <MoveLeft className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveOrder(sbmGuestHouseCoverImages, idx, 'right')}
                                    disabled={idx === sbmGuestHouseCoverImages.length - 1}
                                    className="p-1 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    title="Move Right (Later in carousel)"
                                  >
                                    <MoveRight className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1">
                                  {!isPrimary ? (
                                    <button
                                      onClick={() => handleSetPrimary(img)}
                                      className="px-1.5 py-0.5 text-[10px] font-semibold bg-white hover:bg-[#C5A059] hover:text-white border border-[#C5A059] text-[#C5A059] transition-all cursor-pointer"
                                      title="Make Primary Cover"
                                    >
                                      Make Cover
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> Main
                                    </span>
                                  )}

                                  <button
                                    onClick={() => openReplaceModal(img)}
                                    className="p-1 text-stone-600 hover:text-[#1A1A1A] hover:bg-stone-100 cursor-pointer"
                                    title="Replace"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>

                                  <button
                                    onClick={() => setDeletingImage(img)}
                                    className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 italic py-2">No cover images uploaded yet.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
                <span className="text-[11px] text-stone-500">Live sync active on Homepage property card</span>
                <button
                  onClick={() => openUploadForPropertyCover('sbm-guest-house')}
                  className="px-4 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload Photo for SBM 2 Guest House
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: UPLOAD PHOTOS */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#C5A059]/30 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#C5A059]" />
                <h3 className="text-base font-serif font-semibold text-[#1A1A1A]">
                  Upload Public Images
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  resetUploadForm();
                }}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              {/* Destination Selector */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Target Destination / Section
                </label>
                <select
                  value={
                    uploadTargetCategory === 'Property Cover'
                      ? uploadTargetProperty === 'sbm-guest-house'
                        ? 'property-sbm-guest-house'
                        : 'property-sbm-hotel'
                      : uploadTargetRoom
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'deluxe') {
                      setUploadTargetRoom('deluxe');
                      setUploadTargetCategory('Deluxe Room');
                      setUploadTargetProperty('sbm-hotel');
                    } else if (val === 'family') {
                      setUploadTargetRoom('family');
                      setUploadTargetCategory('Family Suite');
                      setUploadTargetProperty('sbm-hotel');
                    } else if (val === 'property-sbm-hotel') {
                      setUploadTargetRoom('none');
                      setUploadTargetCategory('Property Cover');
                      setUploadTargetProperty('sbm-hotel');
                      setUploadIsPrimary(true);
                    } else if (val === 'property-sbm-guest-house') {
                      setUploadTargetRoom('none');
                      setUploadTargetCategory('Property Cover');
                      setUploadTargetProperty('sbm-guest-house');
                      setUploadIsPrimary(true);
                    } else {
                      setUploadTargetRoom('none');
                      setUploadTargetCategory('Hotel Exterior');
                      setUploadTargetProperty('sbm-hotel');
                      setUploadIsPrimary(false);
                    }
                  }}
                  className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none bg-white"
                >
                  <optgroup label="Room Categories (Public Website)">
                    <option value="deluxe">Room: Deluxe Room (Public Category)</option>
                    <option value="family">Room: Family Suite (Public Category)</option>
                  </optgroup>
                  <optgroup label="Property Cover Images (Our Properties on Homepage)">
                    <option value="property-sbm-hotel">Property Cover: SBM Hotel (Homepage Featured Card)</option>
                    <option value="property-sbm-guest-house">Property Cover: SBM 2 Guest House (Homepage Featured Card)</option>
                  </optgroup>
                  <optgroup label="General Hotel Gallery">
                    <option value="none">Hotel Gallery (Outdoor, Entrance, Lobby, Dining, etc.)</option>
                  </optgroup>
                </select>
              </div>

              {/* Category selector if Hotel Gallery (and not Property Cover) */}
              {uploadTargetRoom === 'none' && uploadTargetCategory !== 'Property Cover' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700 block">
                      Target Property
                    </label>
                    <select
                      value={uploadTargetProperty}
                      onChange={(e) => setUploadTargetProperty(e.target.value)}
                      className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none bg-white"
                    >
                      <option value="sbm-hotel">SBM Hotel</option>
                      <option value="sbm-guest-house">SBM 2 Guest House</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700 block">
                      Gallery Category
                    </label>
                    <select
                      value={uploadTargetCategory}
                      onChange={(e) => setUploadTargetCategory(e.target.value)}
                      className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none bg-white"
                    >
                      {GALLERY_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Note for Property Cover */}
              {uploadTargetCategory === 'Property Cover' && (
                <div className="p-2.5 bg-amber-50 border border-[#C5A059]/30 text-xs text-stone-700 flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#C5A059] shrink-0" />
                  <span>
                    Uploading as <strong>Property Cover</strong> for <strong>{uploadTargetProperty === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel'}</strong>.
                  </span>
                </div>
              )}

              {/* Primary Cover Checkbox (for rooms & properties) */}
              <div className="flex items-center gap-2 p-3 bg-amber-50/60 border border-[#C5A059]/30">
                <input
                  type="checkbox"
                  id="set-primary-checkbox"
                  checked={uploadIsPrimary}
                  onChange={(e) => setUploadIsPrimary(e.target.checked)}
                  className="w-4 h-4 text-[#C5A059] border-stone-300 rounded focus:ring-[#C5A059]"
                />
                <label htmlFor="set-primary-checkbox" className="text-xs text-stone-800 font-medium cursor-pointer">
                  {uploadTargetRoom !== 'none'
                    ? 'Set as Primary Cover Image for this Room Category'
                    : uploadTargetCategory === 'Property Cover'
                    ? `Set as Primary Featured Cover for ${uploadTargetProperty === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel'}`
                    : `Set as Primary Property Cover for ${uploadTargetProperty === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel'}`}
                </label>
              </div>

              {/* Drag & Drop File Selector */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Select Image File(s) <span className="text-stone-400 font-normal">(JPG, JPEG, PNG, WEBP — Max 2MB each)</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-300 hover:border-[#C5A059] bg-stone-50/50 p-6 text-center cursor-pointer transition-colors"
                >
                  <Upload className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-stone-700">
                    Click to browse or drag & drop files here
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">Supports multiple files</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-stone-600">
                    Selected Files ({selectedFiles.length}):
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-stone-50 border border-stone-200 text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <img src={file.base64} alt="" className="w-8 h-8 object-cover border border-stone-300 shrink-0" />
                          <div className="truncate">
                            <p className="font-medium text-stone-800 truncate">{file.name}</p>
                            <p className="text-[10px] text-stone-400">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct URL Input (Alternative) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Or Enter Image Web URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={uploadUrlInput}
                  onChange={(e) => setUploadUrlInput(e.target.value)}
                  className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none"
                />
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Image Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deluxe Room Bed View / SBM Hotel Night Facade"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Description / Caption (Optional)
                </label>
                <textarea
                  placeholder="Brief description of the room amenity or property location"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none"
                />
              </div>

              {/* Submit / Cancel */}
              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    resetUploadForm();
                  }}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (selectedFiles.length === 0 && !uploadUrlInput.trim())}
                  className="px-5 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSubmitting ? 'Uploading...' : 'Save & Publish Photos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REPLACE / EDIT IMAGE */}
      {replacingImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#C5A059]/30 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#C5A059]" />
                <h3 className="text-base font-serif font-semibold text-[#1A1A1A]">
                  Edit / Replace Image
                </h3>
              </div>
              <button
                onClick={() => setReplacingImage(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="p-5 space-y-4">
              {/* Current Image Preview */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Current Image Preview
                </label>
                <div className="h-44 bg-stone-100 border border-stone-200 overflow-hidden relative">
                  <img
                    src={replaceFile ? replaceFile.base64 : replaceUrlInput.trim() || replacingImage.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {replaceFile && (
                    <div className="absolute bottom-2 left-2 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 shadow">
                      New File Selected
                    </div>
                  )}
                </div>
              </div>

              {/* Upload New File to Replace */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Replace with New Image File (Max 2MB)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => replaceFileInputRef.current?.click()}
                    className="px-3.5 py-2 text-xs font-medium border border-stone-300 hover:border-[#C5A059] bg-stone-50 hover:bg-stone-100 text-stone-800 transition-colors cursor-pointer"
                  >
                    Select New File
                  </button>
                  {replaceFile && (
                    <span className="text-xs text-stone-600 truncate">{replaceFile.name}</span>
                  )}
                  <input
                    ref={replaceFileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleReplaceFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Or New URL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Or Replace with Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={replaceUrlInput}
                  onChange={(e) => setReplaceUrlInput(e.target.value)}
                  className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none"
                />
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Title
                </label>
                <input
                  type="text"
                  value={replaceTitle}
                  onChange={(e) => setReplaceTitle(e.target.value)}
                  className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none"
                />
              </div>

              {/* Property Assignment (if hotel gallery image) */}
              {!replacingImage.roomId && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 block">
                    Property Assignment
                  </label>
                  <select
                    value={replaceTargetProperty}
                    onChange={(e) => setReplaceTargetProperty(e.target.value)}
                    className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none bg-white"
                  >
                    <option value="sbm-hotel">SBM Hotel</option>
                    <option value="sbm-guest-house">SBM 2 Guest House</option>
                  </select>
                </div>
              )}

              {/* Primary Cover Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-amber-50/60 border border-[#C5A059]/30">
                <input
                  type="checkbox"
                  id="replace-primary-checkbox"
                  checked={replaceIsPrimary}
                  onChange={(e) => setReplaceIsPrimary(e.target.checked)}
                  className="w-4 h-4 text-[#C5A059] border-stone-300 rounded focus:ring-[#C5A059]"
                />
                <label htmlFor="replace-primary-checkbox" className="text-xs text-stone-800 font-medium cursor-pointer">
                  {replacingImage.roomId
                    ? 'Set as Primary Cover Image for this Room Category'
                    : `Set as Primary Property Cover for ${replaceTargetProperty === 'sbm-guest-house' ? 'SBM 2 Guest House' : 'SBM Hotel'}`}
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Description
                </label>
                <textarea
                  value={replaceDescription}
                  onChange={(e) => setReplaceDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2.5 border border-stone-300 focus:border-[#C5A059] outline-none"
                />
              </div>

              {/* Submit / Cancel */}
              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReplacingImage(null)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-[#1A1A1A] hover:bg-[#C5A059] text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-serif font-semibold text-stone-900">
                Confirm Image Deletion
              </h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-stone-900">"{deletingImage.title || 'this image'}"</strong>?
              This image will be removed from the public website gallery.
            </p>

            <div className="h-32 bg-stone-100 border border-stone-200 overflow-hidden">
              <img src={deletingImage.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingImage(null)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
              >
                Delete Image
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: FULLSCREEN LIGHTBOX PREVIEW */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full bg-[#1A1A1A] border border-[#C5A059]/40 overflow-hidden shadow-2xl relative cursor-default"
          >
            {/* Close button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 text-white/70 hover:text-white bg-black/60 p-2 z-10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image */}
            <div className="max-h-[75vh] flex items-center justify-center bg-black/40">
              <img
                src={previewImage.imageUrl}
                alt={previewImage.title || 'Preview'}
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Caption */}
            <div className="p-4 bg-[#141414] border-t border-stone-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 border border-[#C5A059]/30">
                    {previewImage.category}
                  </span>
                  {(previewImage.isPrimaryCover || previewImage.isMainForRoom) && (
                    <span className="text-[10px] font-bold text-[#C5A059] flex items-center gap-1">
                      <Star className="w-3 h-3 fill-[#C5A059]" /> Primary Cover
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-semibold mt-1">{previewImage.title || 'Untitled photo'}</h4>
                {previewImage.description && (
                  <p className="text-xs text-stone-400 mt-0.5">{previewImage.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => {
                    openReplaceModal(previewImage);
                    setPreviewImage(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium border border-stone-700 hover:border-[#C5A059] text-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit / Replace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
