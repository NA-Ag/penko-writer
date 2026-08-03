import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

interface PresentationViewProps {
  content: string;
  onClose: () => void;
  darkMode: boolean;
}

export const PresentationView: React.FC<PresentationViewProps> = ({ content, onClose, darkMode }) => {
  const [slides, setSlides] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Parse content into slides based on H1/H2 tags
  useEffect(() => {
    const div = document.createElement('div');
    div.innerHTML = content;
    
    const newSlides: string[] = [];
    let currentSlideContent = '';
    let hasContent = false;

    Array.from(div.children).forEach((child) => {
      const tagName = child.tagName.toLowerCase();
      
      // Split on H1 or H2, or if content gets too long (simple heuristic)
      if ((tagName === 'h1' || tagName === 'h2') && hasContent) {
        newSlides.push(currentSlideContent);
        currentSlideContent = '';
      }
      
      currentSlideContent += child.outerHTML;
      hasContent = true;
    });

    if (currentSlideContent) {
      newSlides.push(currentSlideContent);
    }

    if (newSlides.length === 0) {
        newSlides.push('<h1 style="text-align:center">Start Typing to Create Slides</h1><p style="text-align:center">Use Heading 1 or Heading 2 to create new slides.</p>');
    }

    setSlides(newSlides);
  }, [content]);

  const nextSlide = useCallback(() => {
    setCurrentSlide(prev => (prev < slides.length - 1 ? prev + 1 : prev));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide(prev => (prev > 0 ? prev - 1 : 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col">
      {/* Header Controls */}
      <div className="absolute top-4 right-4 flex gap-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
        <span className="bg-white/10 px-3 py-1 rounded-full text-sm font-medium">
            {currentSlide + 1} / {slides.length}
        </span>
        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full">
            <X size={24} />
        </button>
      </div>

      {/* Slide Content */}
      <div className="flex-1 flex items-center justify-center p-20 overflow-hidden">
        <div 
           className="w-full max-w-6xl aspect-video flex flex-col justify-center animate-in fade-in zoom-in duration-300"
           key={currentSlide} // Key forces re-render for animation
        >
           <div 
             className="prose prose-xl prose-invert max-w-none text-center [&>h1]:text-6xl [&>h1]:mb-8 [&>h1]:text-blue-400 [&>h2]:text-5xl [&>h2]:mb-6 [&>h2]:text-purple-400 [&>p]:text-3xl [&>ul]:text-left [&>ul]:inline-block [&>ul]:text-2xl [&>li]:mb-4"
             dangerouslySetInnerHTML={{ __html: slides[currentSlide] || '' }}
           />
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 z-50 opacity-0 hover:opacity-100 transition-opacity">
         <button onClick={prevSlide} disabled={currentSlide === 0} className="p-4 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft size={32} />
         </button>
         <button onClick={nextSlide} disabled={currentSlide === slides.length - 1} className="p-4 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight size={32} />
         </button>
      </div>
    </div>
  );
};