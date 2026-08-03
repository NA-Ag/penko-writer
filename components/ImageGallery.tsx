import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Trash2, Search } from 'lucide-react';
import { getAllImages, getImageMetadata, ImageMetadata } from '../utils/imageUtils';
import { t } from '../utils/translations';
import { LanguageCode } from '../types';

interface ImageGalleryProps {
  editorElement: HTMLElement | null;
  onClose: () => void;
  onImageSelect: (img: HTMLImageElement) => void;
  onImageDelete: (img: HTMLImageElement) => void;
  darkMode: boolean;
  language: LanguageCode;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  editorElement,
  onClose,
  onImageSelect,
  onImageDelete,
  darkMode,
  language
}) => {
  const [images, setImages] = useState<{ element: HTMLImageElement; metadata: ImageMetadata }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!editorElement) return;

    const updateImages = () => {
      const allImages = getAllImages(editorElement);
      const imageData = allImages.map(img => ({
        element: img,
        metadata: getImageMetadata(img)
      }));
      setImages(imageData);
    };

    updateImages();

    // Update when editor content changes
    const observer = new MutationObserver(updateImages);
    observer.observe(editorElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'alt']
    });

    return () => observer.disconnect();
  }, [editorElement]);

  const filteredImages = images.filter(({ metadata }) =>
    metadata.alt.toLowerCase().includes(searchTerm.toLowerCase()) ||
    metadata.src.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (src: string): string => {
    // Estimate file size from base64 string
    const sizeInBytes = src.length * 0.75;
    const sizeInKB = sizeInBytes / 1024;
    const sizeInMB = sizeInKB / 1024;

    if (sizeInMB >= 1) {
      return `${sizeInMB.toFixed(1)} MB`;
    }
    return `${sizeInKB.toFixed(0)} KB`;
  };

  const formatDimensions = (metadata: ImageMetadata): string => {
    if (metadata.width && metadata.height) {
      return `${metadata.width} × ${metadata.height}`;
    }
    if (metadata.naturalWidth && metadata.naturalHeight) {
      return `${metadata.naturalWidth} × ${metadata.naturalHeight}`;
    }
    return 'Unknown';
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full w-80 shadow-2xl z-40 flex flex-col ${
        darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 border-b ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <ImageIcon size={20} />
          <h2 className="font-semibold text-lg">{t(language, 'imgGallery')}</h2>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded hover:bg-opacity-10 ${
            darkMode ? 'hover:bg-white' : 'hover:bg-black'
          }`}
        >
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="p-4">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded border ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'
          }`}
        >
          <Search size={16} className="text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(language, 'imgSearchPlaceholder')}
            className={`flex-1 bg-transparent outline-none text-sm ${
              darkMode ? 'text-gray-100 placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>
      </div>

      {/* Image List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ImageIcon size={48} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              {searchTerm ? t(language, 'imgNoResults') : t(language, 'imgNoImages')}
            </p>
          </div>
        ) : (
          filteredImages.map(({ element, metadata }, index) => (
            <div
              key={index}
              className={`border rounded-lg overflow-hidden cursor-pointer transition-all ${
                darkMode
                  ? 'border-gray-700 hover:border-blue-500 hover:bg-gray-800'
                  : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
              }`}
              onClick={() => onImageSelect(element)}
            >
              {/* Image Thumbnail */}
              <div
                className={`relative w-full h-32 flex items-center justify-center ${
                  darkMode ? 'bg-gray-800' : 'bg-gray-100'
                }`}
              >
                <img
                  src={metadata.src}
                  alt={metadata.alt}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    filter: metadata.effect !== 'none' ? `${metadata.effect}(100%)` : 'none'
                  }}
                />
              </div>

              {/* Image Info */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    {metadata.alt ? (
                      <p className="text-sm font-medium truncate">{metadata.alt}</p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">{t(language, 'imgNoAlt')}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onImageDelete(element);
                    }}
                    className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>{t(language, 'imgSize')}:</span>
                    <span className="font-mono">{formatDimensions(metadata)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t(language, 'imgPosition')}:</span>
                    <span className="capitalize">{metadata.positionMode.replace('-', ' ')}</span>
                  </div>
                  {metadata.effect && metadata.effect !== 'none' && (
                    <div className="flex justify-between">
                      <span>{t(language, 'imgEffect')}:</span>
                      <span className="capitalize">{metadata.effect}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer - Stats */}
      <div
        className={`p-4 border-t text-sm ${
          darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'
        }`}
      >
        <div className="flex justify-between">
          <span>{t(language, 'imgTotal')}:</span>
          <span className="font-semibold">{images.length}</span>
        </div>
      </div>
    </div>
  );
};
