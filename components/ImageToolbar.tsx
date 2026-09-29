import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight, Maximize2, Minimize2,
  RotateCw, Trash2, Type, Sparkles,
  Anchor, Square, Blend, RefreshCw, Images
} from 'lucide-react';
import {
  ImagePositionMode, ImageEffect, ImageBorderStyle, ImageShadowStyle,
  positionPatch, getPositionMode, rotatePatch, effectPatch, borderPatch, shadowPatch,
} from '../utils/imageUtils';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';

interface ImageToolbarProps {
  darkMode: boolean;
  language: LanguageCode;
}

type Menu = 'effects' | 'border' | 'shadow' | 'alt' | 'delete' | null;

/**
 * Floating toolbar for the selected image. Every action goes through the
 * editor (updateSelectedImage / handleImageAction), so changes are saved and
 * undoable.
 */
export const ImageToolbar: React.FC<ImageToolbarProps> = ({ darkMode, language }) => {
  const { editor, selectedImage, updateSelectedImage, handleImageAction, deleteSelectedImage, setShowImageGallery, zoom } = useApp();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [openMenu, setOpenMenu] = useState<Menu>(null);
  const [altText, setAltText] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);

  const attrs = selectedImage?.attrs || {};
  const style: string | null = attrs.style || null;
  const currentMode = getPositionMode(style);

  // Position the toolbar above the image (below it when there's no room),
  // following the editor's scroll container, window resizes, edits and zoom
  // (the page is scaled with an animated CSS transform: re-measure when it ends).
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed || !selectedImage) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        let dom: HTMLElement | null = null;
        try {
          dom = (editor.view.nodeDOM(selectedImage.pos) as HTMLElement | null) || selectedImage.dom;
        } catch {
          dom = selectedImage.dom;
        }
        if (!dom || !dom.isConnected) {
          setPosition(null);
          return;
        }
        const img = (dom.tagName === 'IMG' ? dom : dom.querySelector('img')) || dom;
        const rect = img.getBoundingClientRect();
        const bar = toolbarRef.current?.getBoundingClientRect();
        const height = bar?.height || 44;
        const width = bar?.width || 520;
        let top = rect.top - height - 8;
        if (top < 8) top = Math.min(rect.bottom + 8, window.innerHeight - height - 8);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        setPosition(prev => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
      });
    };
    update();
    const scroller = document.getElementById('editor-scroll-container');
    scroller?.addEventListener('scroll', update, { passive: true });
    scroller?.addEventListener('transitionend', update);
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    editor.on('transaction', update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (selectedImage.dom) ro?.observe(selectedImage.dom);
    return () => {
      cancelAnimationFrame(frame);
      scroller?.removeEventListener('scroll', update);
      scroller?.removeEventListener('transitionend', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      editor.off('transaction', update);
      ro?.disconnect();
    };
  }, [editor, selectedImage?.pos, selectedImage?.dom, zoom]);

  // Close menus when another image gets selected
  useEffect(() => setOpenMenu(null), [selectedImage?.pos]);

  if (!selectedImage) return null;

  const setMode = (mode: ImagePositionMode) => updateSelectedImage({ style: positionPatch(mode) });
  const applyEffect = (effect: ImageEffect, value?: number) => {
    updateSelectedImage({ style: effectPatch(effect, value) });
    setOpenMenu(null);
  };
  const applyBorder = (b: ImageBorderStyle) => {
    updateSelectedImage({ style: borderPatch(b) });
    setOpenMenu(null);
  };
  const applyShadow = (s: ImageShadowStyle) => {
    updateSelectedImage({ style: shadowPatch(s) });
    setOpenMenu(null);
  };
  const saveAlt = () => {
    updateSelectedImage({ attrs: { alt: altText.trim() || null } });
    setOpenMenu(null);
  };
  const toggle = (menu: Menu) => {
    if (menu === 'alt') setAltText(attrs.alt || '');
    setOpenMenu(openMenu === menu ? null : menu);
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

  const menuClass = `absolute top-full left-0 mt-1 rounded-lg shadow-lg border p-2 min-w-[160px] ${
    darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
  }`;
  const menuItemClass = `w-full text-left px-3 py-2 rounded hover:bg-opacity-10 ${darkMode ? 'hover:bg-white' : 'hover:bg-black'}`;

  const iconBtn = (label: string, onClick: () => void, icon: React.ReactNode, active = false, extra?: Partial<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button className={active ? activeBtnClass : btnClass} onClick={onClick} title={label} aria-label={label} {...extra}>
      {icon}
    </button>
  );

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t(language, 'rvImageToolbar')}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && openMenu) {
          e.preventDefault();
          e.stopPropagation();
          setOpenMenu(null);
        }
      }}
      className={`fixed z-50 shadow-lg border rounded-lg p-2 flex flex-wrap items-center gap-1 max-w-[calc(100vw-16px)] ${
        darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
      }`}
      style={{
        top: `${position?.top ?? -9999}px`,
        left: `${position?.left ?? -9999}px`,
        visibility: position ? 'visible' : 'hidden'
      }}
    >
      {/* Positioning Modes */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2" style={{ borderColor: darkMode ? '#4b5563' : '#d1d5db' }}>
        {iconBtn(t(language, 'imgInline'), () => setMode('inline'), <Anchor size={16} />, currentMode === 'inline', { 'aria-pressed': currentMode === 'inline' })}
        {iconBtn(t(language, 'imgFloatLeft'), () => setMode('float-left'), <AlignLeft size={16} />, currentMode === 'float-left', { 'aria-pressed': currentMode === 'float-left' })}
        {iconBtn(t(language, 'imgCentered'), () => setMode('centered'), <AlignCenter size={16} />, currentMode === 'centered', { 'aria-pressed': currentMode === 'centered' })}
        {iconBtn(t(language, 'imgFloatRight'), () => setMode('float-right'), <AlignRight size={16} />, currentMode === 'float-right', { 'aria-pressed': currentMode === 'float-right' })}
      </div>

      {/* Resize */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2" style={{ borderColor: darkMode ? '#4b5563' : '#d1d5db' }}>
        <button className={btnClass} onClick={() => handleImageAction('resize', 25)} title="25%" aria-label={t(language, 'rvResizeTo').replace('{n}', '25')}>
          <Minimize2 size={14} />
          <span className="text-xs ml-1">25%</span>
        </button>
        <button className={btnClass} onClick={() => handleImageAction('resize', 50)} title="50%" aria-label={t(language, 'rvResizeTo').replace('{n}', '50')}>
          <Minimize2 size={16} />
          <span className="text-xs ml-1">50%</span>
        </button>
        {iconBtn('100%', () => handleImageAction('resize', 100), <Maximize2 size={16} />)}
      </div>

      {/* Rotate */}
      <div className="flex items-center gap-1 border-r pr-2 mr-2" style={{ borderColor: darkMode ? '#4b5563' : '#d1d5db' }}>
        {iconBtn(t(language, 'imgRotate'), () => updateSelectedImage({ style: rotatePatch(style, 90) }), <RotateCw size={16} />)}
      </div>

      {/* Effects */}
      <div className="relative">
        {iconBtn(t(language, 'imgEffects'), () => toggle('effects'), <Sparkles size={16} />, false, { 'aria-haspopup': 'menu', 'aria-expanded': openMenu === 'effects' })}
        {openMenu === 'effects' && (
          <div className={menuClass} role="menu">
            <button role="menuitem" className={menuItemClass} onClick={() => applyEffect('none')}>{t(language, 'imgEffectNone')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyEffect('grayscale')}>{t(language, 'imgEffectGrayscale')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyEffect('sepia')}>{t(language, 'imgEffectSepia')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyEffect('brightness', 150)}>{t(language, 'imgEffectBrighter')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyEffect('brightness', 50)}>{t(language, 'imgEffectDarker')}</button>
          </div>
        )}
      </div>

      {/* Border */}
      <div className="relative">
        {iconBtn(t(language, 'imgBorder'), () => toggle('border'), <Square size={16} />, false, { 'aria-haspopup': 'menu', 'aria-expanded': openMenu === 'border' })}
        {openMenu === 'border' && (
          <div className={menuClass} role="menu">
            <button role="menuitem" className={menuItemClass} onClick={() => applyBorder('none')}>{t(language, 'imgBorderNone')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyBorder('thin')}>{t(language, 'imgBorderThin')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyBorder('medium')}>{t(language, 'imgBorderMedium')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyBorder('thick')}>{t(language, 'imgBorderThick')}</button>
          </div>
        )}
      </div>

      {/* Shadow */}
      <div className="relative">
        {iconBtn(t(language, 'imgShadow'), () => toggle('shadow'), <Blend size={16} />, false, { 'aria-haspopup': 'menu', 'aria-expanded': openMenu === 'shadow' })}
        {openMenu === 'shadow' && (
          <div className={menuClass} role="menu">
            <button role="menuitem" className={menuItemClass} onClick={() => applyShadow('none')}>{t(language, 'imgShadowNone')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyShadow('small')}>{t(language, 'imgShadowSmall')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyShadow('medium')}>{t(language, 'imgShadowMedium')}</button>
            <button role="menuitem" className={menuItemClass} onClick={() => applyShadow('large')}>{t(language, 'imgShadowLarge')}</button>
          </div>
        )}
      </div>

      {/* Replace */}
      {iconBtn(t(language, 'imgReplace'), () => handleImageAction('replace'), <RefreshCw size={16} />)}

      {/* Alt Text */}
      <div className="relative">
        {iconBtn(t(language, 'imgAltText'), () => toggle('alt'), <Type size={16} />, !!attrs.alt, { 'aria-expanded': openMenu === 'alt' })}
        {openMenu === 'alt' && (
          <div className={`${menuClass} min-w-[260px]`}>
            <label htmlFor="image-alt-input" className={`block text-xs mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {t(language, 'imgAltText')}
            </label>
            <input
              id="image-alt-input"
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveAlt();
                }
              }}
              autoFocus
              className={`w-full px-2 py-1 text-sm rounded border outline-none focus:ring-2 focus:ring-blue-500/50 ${
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
            <div className="flex justify-end gap-1 mt-2">
              <button className={`px-2 py-1 text-xs rounded ${darkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}`} onClick={() => setOpenMenu(null)}>
                {t(language, 'cancel')}
              </button>
              <button className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white" onClick={saveAlt}>
                {t(language, 'save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image gallery */}
      {iconBtn(t(language, 'imgGallery'), () => setShowImageGallery(true), <Images size={16} />)}

      {/* Delete (inline confirmation) */}
      <div className="relative">
        {iconBtn(t(language, 'delete'), () => toggle('delete'), <Trash2 size={16} />, false, { className: `${btnClass} text-red-500 hover:text-red-600`, 'aria-expanded': openMenu === 'delete' })}
        {openMenu === 'delete' && (
          <div className={`${menuClass} left-auto right-0`} role="alertdialog" aria-label={t(language, 'rvDeleteImageQ')}>
            <p className={`text-sm mb-2 whitespace-nowrap ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{t(language, 'rvDeleteImageQ')}</p>
            <div className="flex justify-end gap-1">
              <button className={`px-2 py-1 text-xs rounded ${darkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}`} onClick={() => setOpenMenu(null)} autoFocus>
                {t(language, 'cancel')}
              </button>
              <button className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteSelectedImage()}>
                {t(language, 'delete')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
