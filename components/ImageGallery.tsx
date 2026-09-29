import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Trash2, Search } from 'lucide-react';
import { getImageInfo, ImageInfo, estimateDataUrlBytes, formatBytes } from '../utils/imageUtils';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';

interface ImageGalleryProps {
  onClose: () => void;
  darkMode: boolean;
  language: LanguageCode;
}

const POSITION_LABEL: Record<ImageInfo['positionMode'], string> = {
  inline: 'imgInline',
  'float-left': 'imgFloatLeft',
  'float-right': 'imgFloatRight',
  centered: 'imgCentered',
};

interface GalleryImage {
  pos: number;
  info: ImageInfo;
  /** decoded size of an embedded (data URL) image, 0 otherwise */
  bytes: number;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  onClose,
  darkMode,
  language
}) => {
  const { editor } = useApp();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [natural, setNatural] = useState<Record<string, { w: number; h: number }>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Images listed live from the document
  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      setImages([]);
      return;
    }
    let timer = 0;
    const updateImages = () => {
      if (editor.isDestroyed) return;
      const list: GalleryImage[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image') list.push({ pos, info: getImageInfo(node.attrs), bytes: estimateDataUrlBytes(node.attrs.src || '') });
        return true;
      });
      setImages(list);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(updateImages, 200);
    };
    updateImages();
    editor.on('update', schedule);
    return () => {
      window.clearTimeout(timer);
      editor.off('update', schedule);
    };
  }, [editor]);

  const term = searchTerm.toLowerCase();
  const filteredImages = images.filter(({ info }) =>
    info.alt.toLowerCase().includes(term) ||
    (!info.src.startsWith('data:') && info.src.toLowerCase().includes(term))
  );

  const selectImage = (pos: number) => {
    if (!editor || editor.isDestroyed) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'image') return;
    editor.chain().focus().setNodeSelection(pos).scrollIntoView().run();
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  };

  const deleteImage = (pos: number) => {
    setConfirmDelete(null);
    if (!editor || editor.isDestroyed) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'image') return;
    editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
  };

  const formatDimensions = (info: ImageInfo): string => {
    if (info.width && info.height) return `${Math.round(info.width)} × ${Math.round(info.height)}`;
    const n = natural[info.src];
    if (n) return `${n.w} × ${n.h}`;
    return t(language, 'rvUnknown');
  };

  return (
    <div
      role="complementary"
      aria-labelledby="image-gallery-title"
      data-image-gallery=""
      // Esc closes the gallery while focus is inside it
      onKeyDown={e => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault();
          onClose();
        }
      }}
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
          <h2 id="image-gallery-title" className="font-semibold text-lg">{t(language, 'imgGallery')}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label={t(language, 'close')}
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
            aria-label={t(language, 'imgSearchPlaceholder')}
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
          filteredImages.map(({ pos, info: metadata, bytes }) => (
            <div
              key={pos}
              role="button"
              tabIndex={0}
              aria-label={metadata.alt || t(language, 'imgNoAlt')}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  selectImage(pos);
                }
              }}
              className={`border rounded-lg overflow-hidden cursor-pointer transition-all ${
                darkMode
                  ? 'border-gray-700 hover:border-blue-500 hover:bg-gray-800'
                  : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
              }`}
              onClick={() => selectImage(pos)}
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
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const src = metadata.src;
                    if (img.naturalWidth && !natural[src]) setNatural(prev => ({ ...prev, [src]: { w: img.naturalWidth, h: img.naturalHeight } }));
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
                  {confirmDelete === pos ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => deleteImage(pos)}
                        className="px-2 py-0.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                      >
                        {t(language, 'delete')}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className={`px-2 py-0.5 text-xs rounded ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      >
                        {t(language, 'cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(pos);
                      }}
                      aria-label={t(language, 'delete')}
                      title={t(language, 'delete')}
                      className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>{t(language, 'imgSize')}:</span>
                    <span className="font-mono">{formatDimensions(metadata)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t(language, 'imgPosition')}:</span>
                    <span>{t(language, POSITION_LABEL[metadata.positionMode])}</span>
                  </div>
                  {bytes > 0 && (
                    <div className="flex justify-between">
                      <span>{t(language, 'rvFileSize')}:</span>
                      <span className="font-mono">{formatBytes(bytes)}</span>
                    </div>
                  )}
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
