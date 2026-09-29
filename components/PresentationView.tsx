import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { t } from '../utils/translations';
import { escapeHtml } from '../editor/sanitize';
import { splitIntoSlides, slideNeedsLightSurface } from '../utils/slides';
import { useSuppressDialogShortcuts } from '../utils/hooks';
import '../editor/editor.css';

interface PresentationViewProps {
  content: string;
  onClose: () => void;
}

const CONTROLS_HIDE_MS = 2500;
const SWIPE_PX = 50;

export const PresentationView: React.FC<PresentationViewProps> = ({ content, onClose }) => {
  const { uiLanguage, flushPendingEdits } = useApp();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number>(0);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);

  // Make sure the latest keystrokes are in currentDoc.content; take focus so
  // keys don't go to the button that opened the presentation.
  useEffect(() => {
    flushPendingEdits();
    const previous = document.activeElement as HTMLElement | null;
    rootRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const slides = useMemo(() => {
    const list = splitIntoSlides(content);
    if (list.length) return list;
    return [
      `<h1 style="text-align:center">${escapeHtml(t(uiLanguage, 'presentationEmptyTitle'))}</h1><p style="text-align:center">${escapeHtml(t(uiLanguage, 'presentationEmptyHint'))}</p>`,
    ];
  }, [content, uiLanguage]);

  useEffect(() => {
    setCurrentSlide(i => Math.min(i, slides.length - 1));
  }, [slides.length]);

  const slideHtml = slides[currentSlide] || '';
  const lightSurface = useMemo(() => slideNeedsLightSurface(slideHtml), [slideHtml]);

  const nextSlide = useCallback(() => {
    setCurrentSlide(prev => (prev < slides.length - 1 ? prev + 1 : prev));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide(prev => (prev > 0 ? prev - 1 : 0));
  }, []);

  // --- controls visibility (shown on activity, focus and touch) ---
  const showControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);
  useEffect(() => {
    showControls();
    return () => window.clearTimeout(hideTimer.current);
  }, [showControls]);

  // --- fullscreen ---
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    } else if (el.requestFullscreen) {
      void el.requestFullscreen().catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement === rootRef.current) void document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Dialog shortcuts (import, find, link…) would open dialogs hidden underneath
  useSuppressDialogShortcuts(true);

  // --- keyboard navigation ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      // Let focused buttons handle Space/Enter themselves
      const onButton = target?.tagName === 'BUTTON';
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          nextSlide();
          break;
        case ' ':
        case 'Enter':
          if (onButton) return;
          e.preventDefault();
          if (e.shiftKey) prevSlide();
          else nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          prevSlide();
          break;
        case 'Home':
          e.preventDefault();
          setCurrentSlide(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentSlide(slides.length - 1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          // In fullscreen the browser consumes Escape to leave fullscreen first
          if (!document.fullscreenElement) onClose();
          break;
        default:
          return;
      }
      showControls();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, onClose, slides.length, toggleFullscreen, showControls]);

  // --- swipe on touch ---
  const onPointerDown = (e: React.PointerEvent) => {
    showControls();
    if (e.pointerType === 'mouse') return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) nextSlide();
      else prevSlide();
    }
  };

  // --- scale long / wide slides to fit instead of clipping ---
  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = contentRef.current;
    if (!box || !inner) return;
    const measure = () => {
      const availH = box.clientHeight;
      const availW = box.clientWidth;
      const h = inner.scrollHeight;
      const w = inner.scrollWidth;
      if (!availH || !h) return;
      const s = Math.min(1, availH / h, availW / Math.max(w, 1));
      setFit(prev => (Math.abs(prev.scale - s) < 0.005 && prev.height === h ? prev : { scale: s, height: h }));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(box);
    ro?.observe(inner);
    // images load asynchronously
    const imgs = Array.from(inner.querySelectorAll('img'));
    imgs.forEach(img => img.addEventListener('load', measure));
    return () => {
      ro?.disconnect();
      imgs.forEach(img => img.removeEventListener('load', measure));
    };
  }, [slideHtml, currentSlide, isFullscreen]);

  const { scale, height: contentHeight } = fit;
  const controlsOpacity = controlsVisible ? 'opacity-100' : 'opacity-0';

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] bg-black text-white flex flex-col outline-none"
      onPointerMove={e => {
        if (e.pointerType === 'mouse') showControls();
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
      // Horizontal swipes are ours; without this the browser claims the touch
      // (pointercancel) and swipes never register
      style={{ touchAction: 'pan-y pinch-zoom' }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-roledescription="presentation"
    >
      {/* Header Controls */}
      <div className={`absolute top-4 right-4 flex gap-4 z-50 ${controlsOpacity} hover:opacity-100 focus-within:opacity-100 transition-opacity`}>
        <span className="bg-white/10 px-3 py-1 rounded-full text-sm font-medium self-center" aria-live="polite">
            {currentSlide + 1} / {slides.length}
        </span>
        <button
          onClick={toggleFullscreen}
          className="bg-white/10 hover:bg-white/20 p-2 rounded-full"
          title={t(uiLanguage, isFullscreen ? 'exitFullscreen' : 'fullscreen')}
          aria-label={t(uiLanguage, isFullscreen ? 'exitFullscreen' : 'fullscreen')}
        >
            {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
        </button>
        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full" title={t(uiLanguage, 'close')} aria-label={t(uiLanguage, 'close')}>
            <X size={24} />
        </button>
      </div>

      {/* Slide Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-20 overflow-hidden">
        <div
           ref={boxRef}
           className={`w-full max-w-6xl max-h-full h-full sm:h-auto sm:aspect-video flex flex-col justify-center overflow-hidden animate-in fade-in zoom-in duration-300 ${lightSurface ? 'bg-white text-gray-900 rounded-lg p-6' : ''}`}
           key={currentSlide} // Key forces re-render for animation
        >
           <div
             ref={contentRef}
             className={`penko-doc prose prose-xl max-w-none text-center [&_h1]:text-6xl [&_h1]:mb-8 [&_h2]:text-5xl [&_h2]:mb-6 [&_h3]:text-4xl [&_h3]:mb-6 [&_p]:text-3xl [&_ul]:text-left [&_ul]:inline-block [&_ul]:text-2xl [&_li]:mb-4 ${lightSurface ? '' : 'prose-invert penko-doc-dark [&_h1]:text-blue-400 [&_h2]:text-purple-400'}`}
             style={{
               transform: scale < 1 ? `scale(${scale})` : undefined,
               transformOrigin: 'top center',
               marginBottom: scale < 1 ? -(contentHeight * (1 - scale)) : undefined,
             }}
             dangerouslySetInnerHTML={{ __html: slideHtml }}
           />
        </div>
      </div>

      {/* Navigation Controls */}
      <div className={`absolute bottom-8 left-0 right-0 flex justify-center gap-8 z-50 ${controlsOpacity} hover:opacity-100 focus-within:opacity-100 transition-opacity`}>
         <button onClick={prevSlide} disabled={currentSlide === 0} className="p-4 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed" aria-label={t(uiLanguage, 'previousSlide')}>
            <ChevronLeft size={32} />
         </button>
         <button onClick={nextSlide} disabled={currentSlide === slides.length - 1} className="p-4 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed" aria-label={t(uiLanguage, 'nextSlide')}>
            <ChevronRight size={32} />
         </button>
      </div>
    </div>
  );
};
