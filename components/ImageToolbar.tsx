import React, { useState, useEffect } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight, Maximize2, Minimize2,
  RotateCw, Image as ImageIcon, Trash2, Type, Sparkles,
  Move, Anchor, Square, Blend, FileText, RefreshCw
} from 'lucide-react';
import {
  ImagePositionMode, ImageEffect, ImageBorderStyle, ImageShadowStyle,
  applyImageBorder, applyImageShadow, addImageCaption, getImageCaption,
  rotateImage, compressImage, shouldCompressImage
} from '../utils/imageUtils';
import { t } from '../utils/translations';
import { LanguageCode } from '../types';

interface ImageToolbarProps {
  image: HTMLImageElement;
  onPositionChange: (mode: ImagePositionMode) => void;
  onResize: (percent: number) => void;
  onRotate: (degrees: number) => void;
  onEffect: (effect: ImageEffect, value?: number) => void;
  onAltText: () => void;
  onReplace: () => void;
  onDelete: () => void;
  darkMode: boolean;
  language: LanguageCode;
}

export const ImageToolbar: React.FC<ImageToolbarProps> = ({
  image,
  onPositionChange,
  onResize,
  onRotate,
  onEffect,
  onAltText,
  onReplace,
  onDelete,
  darkMode,
  language
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [currentMode, setCurrentMode] = useState<ImagePositionMode>('inline');
  const [showEffectsMenu, setShowEffectsMenu] = useState(false);
  const [showBorderMenu, setShowBorderMenu] = useState(false);
  const [showShadowMenu, setShowShadowMenu] = useState(false);
  const [showCaptionDialog, setShowCaptionDialog] = useState(false);
  const [captionText, setCaptionText] = useState('');

  useEffect(() => {
    // Calculate toolbar position relative to image
    const updatePosition = () => {
      if (!image) return;

      const rect = image.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      // Position toolbar above the image
      setPosition({
        top: rect.top + scrollY - 50,
        left: rect.left + scrollX
      });
    };

    updatePosition();

    // Update position on scroll or resize
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [image]);

  useEffect(() => {
    const mode = (image.getAttribute('data-position-mode') || 'inline') as ImagePositionMode;
    setCurrentMode(mode);
  }, [image]);

  const handlePositionChange = (mode: ImagePositionMode) => {
    setCurrentMode(mode);
    onPositionChange(mode);
  };

  const btnClass = `p-2 rounded transition-colors ${
    darkMode
      ? 'bg-gray-700 hover:bg-gray-600 text-gray-100'
      : 'bg-white hover:bg-gray-100 text-gray-700'
  }`;

  const activeBtnClass = `p-2 rounded transition-colors ${
    darkMode
      ? 'bg-blue-600 hover:bg-blue-500 text-white'
      : 'bg-blue-500 hover:bg-blue-600 text-white'
  }`;

  return (
    <div
      className={`fixed z-50 shadow-lg border rounded-lg p-2 flex items-center gap-1 ${
        darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
      }`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`
      }}
    >
      {/* Positioning Modes */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2" style={{ borderColor: darkMode ? '#4b5563' : '#d1d5db' }}>
        <button
          className={currentMode === 'inline' ? activeBtnClass : btnClass}
          onClick={() => handlePositionChange('inline')}
          title={t(language, 'imgInline')}
        >
          <Anchor size={16} />
        </button>
        <button
          className={currentMode === 'float-left' ? activeBtnClass : btnClass}
          onClick={() => handlePositionChange('float-left')}
          title={t(language, 'imgFloatLeft')}
        >
          <AlignLeft size={16} />
        </button>
        <button
          className={currentMode === 'centered' ? activeBtnClass : btnClass}
          onClick={() => handlePositionChange('centered')}
          title={t(language, 'imgCentered')}
        >
          <AlignCenter size={16} />
        </button>
        <button
          className={currentMode === 'float-right' ? activeBtnClass : btnClass}
          onClick={() => handlePositionChange('float-right')}
          title={t(language, 'imgFloatRight')}
        >
          <AlignRight size={16} />
        </button>
        <button
          className={currentMode === 'absolute' ? activeBtnClass : btnClass}
          onClick={() => handlePositionChange('absolute')}
          title={t(language, 'imgAbsolute')}
        >
          <Move size={16} />
        </button>
      </div>

      {/* Resize */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2" style={{ borderColor: darkMode ? '#4b5563' : '#d1d5db' }}>
        <button
          className={btnClass}
          onClick={() => onResize(25)}
          title="25%"
        >
          <Minimize2 size={14} />
          <span className="text-xs ml-1">25%</span>
        </button>
        <button
          className={btnClass}
          onClick={() => onResize(50)}
          title="50%"
        >
          <Minimize2 size={16} />
          <span className="text-xs ml-1">50%</span>
        </button>
        <button
          className={btnClass}
          onClick={() => onResize(100)}
          title="100%"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Rotate */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2" style={{ borderColor: darkMode ? '#4b5563' : '#d1d5db' }}>
        <button
          className={btnClass}
          onClick={() => onRotate(90)}
          title={t(language, 'imgRotate')}
        >
          <RotateCw size={16} />
        </button>
      </div>

      {/* Effects */}
      <div className="relative">
        <button
          className={btnClass}
          onClick={() => setShowEffectsMenu(!showEffectsMenu)}
          title={t(language, 'imgEffects')}
        >
          <Sparkles size={16} />
        </button>

        {showEffectsMenu && (
          <div
            className={`absolute top-full left-0 mt-1 rounded-lg shadow-lg border p-2 min-w-[160px] ${
              darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
            }`}
          >
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { onEffect('none'); setShowEffectsMenu(false); }}
            >
              {t(language, 'imgEffectNone')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { onEffect('grayscale'); setShowEffectsMenu(false); }}
            >
              {t(language, 'imgEffectGrayscale')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { onEffect('sepia'); setShowEffectsMenu(false); }}
            >
              {t(language, 'imgEffectSepia')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { onEffect('brightness', 150); setShowEffectsMenu(false); }}
            >
              {t(language, 'imgEffectBrighter')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { onEffect('brightness', 50); setShowEffectsMenu(false); }}
            >
              {t(language, 'imgEffectDarker')}
            </button>
          </div>
        )}
      </div>

      {/* Border */}
      <div className="relative">
        <button
          className={btnClass}
          onClick={() => setShowBorderMenu(!showBorderMenu)}
          title={t(language, 'imgBorder')}
        >
          <Square size={16} />
        </button>

        {showBorderMenu && (
          <div
            className={`absolute top-full left-0 mt-1 rounded-lg shadow-lg border p-2 min-w-[160px] ${
              darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
            }`}
          >
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { applyImageBorder(image, 'none'); setShowBorderMenu(false); }}
            >
              {t(language, 'imgBorderNone')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { applyImageBorder(image, 'thin'); setShowBorderMenu(false); }}
            >
              {t(language, 'imgBorderThin')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { applyImageBorder(image, 'medium'); setShowBorderMenu(false); }}
            >
              {t(language, 'imgBorderMedium')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { applyImageBorder(image, 'thick'); setShowBorderMenu(false); }}
            >
              {t(language, 'imgBorderThick')}
            </button>
          </div>
        )}
      </div>

      {/* Shadow */}
      <div className="relative">
        <button
          className={btnClass}
          onClick={() => setShowShadowMenu(!showShadowMenu)}
          title={t(language, 'imgShadow')}
        >
          <Blend size={16} />
        </button>

        {showShadowMenu && (
          <div
            className={`absolute top-full left-0 mt-1 rounded-lg shadow-lg border p-2 min-w-[160px] ${
              darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
            }`}
          >
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { applyImageShadow(image, 'none'); setShowShadowMenu(false); }}
            >
              {t(language, 'imgShadowNone')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { applyImageShadow(image, 'small'); setShowShadowMenu(false); }}
            >
              {t(language, 'imgShadowSmall')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { applyImageShadow(image, 'medium'); setShowShadowMenu(false); }}
            >
              {t(language, 'imgShadowMedium')}
            </button>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`}
              onClick={() => { applyImageShadow(image, 'large'); setShowShadowMenu(false); }}
            >
              {t(language, 'imgShadowLarge')}
            </button>
          </div>
        )}
      </div>

      {/* Caption */}
      <button
        className={btnClass}
        onClick={() => {
          const currentCaption = getImageCaption(image);
          const newCaption = prompt(t(language, 'imgCaption'), currentCaption);
          if (newCaption !== null) {
            addImageCaption(image, newCaption);
          }
        }}
        title={t(language, 'imgCaption')}
      >
        <FileText size={16} />
      </button>

      {/* Replace */}
      <button
        className={btnClass}
        onClick={onReplace}
        title={t(language, 'imgReplace')}
      >
        <RefreshCw size={16} />
      </button>

      {/* Alt Text */}
      <button
        className={btnClass}
        onClick={onAltText}
        title={t(language, 'imgAltText')}
      >
        <Type size={16} />
      </button>

      {/* Delete */}
      <button
        className={`${btnClass} text-red-500 hover:text-red-600`}
        onClick={onDelete}
        title={t(language, 'delete')}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};
