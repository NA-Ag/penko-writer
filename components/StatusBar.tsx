import React, { useState, useEffect } from 'react';
import { Minus, Plus, Globe } from 'lucide-react';
import { LANGUAGES } from '../constants';
import { LanguageCode, t } from '../utils/translations';
import { SyncIndicator } from './SyncIndicator';
import { LinkedFilePill } from './files/LinkedFilePill';

interface StatusBarProps {
  wordCount: number;
  zoom: number;
  setZoom: (z: number) => void;
  darkMode: boolean;
  onShowStats: () => void;
  language: string;
  onChangeLanguage: (lang: string) => void;
  uiLanguage: LanguageCode;
  /** Page with the cursor / total pages; omitted when the layout isn't paginated. */
  pageInfo?: { current: number; total: number };
}

export const StatusBar: React.FC<StatusBarProps> = ({ wordCount, zoom, setZoom, darkMode, onShowStats, language, onChangeLanguage, uiLanguage, pageInfo }) => {
  const [showLangMenu, setShowLangMenu] = useState(false);

  useEffect(() => {
    if (!showLangMenu) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowLangMenu(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showLangMenu]);
  
  const currentLangName = LANGUAGES.find(l => l.code === language)?.name || language;

  return (
    <div className={`h-10 px-4 rounded-full shadow-lg border backdrop-blur-md flex items-center space-x-6 select-none transition-all w-max
       ${darkMode ? 'bg-[#1e1e1e]/90 border-gray-700 text-gray-300' : 'bg-white/90 border-gray-200 text-gray-600'}
    `}>
        {pageInfo && (
          <>
            <span className="font-medium text-xs tabular-nums" aria-live="polite">
              {t(uiLanguage, 'pageXofY').replace('{PAGE}', String(pageInfo.current)).replace('{PAGES}', String(pageInfo.total))}
            </span>
            <div className={`w-px h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
          </>
        )}

        <LinkedFilePill darkMode={darkMode} uiLanguage={uiLanguage} />

        <SyncIndicator uiLanguage={uiLanguage} darkMode={darkMode} />

        {/* Word Count */}
        <button onClick={onShowStats} className="hover:text-blue-500 font-medium text-xs transition-colors flex items-center gap-1">
           {wordCount} {t(uiLanguage, 'wordCountSuffix')}
        </button>
        
        <div className={`w-px h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

        {/* Language Picker */}
        <div className="relative">
           <button 
             onClick={() => setShowLangMenu(!showLangMenu)}
             aria-haspopup="listbox"
             aria-expanded={showLangMenu}
             aria-label={`${t(uiLanguage, 'documentLanguage')}: ${currentLangName}`}
             className="flex items-center gap-1.5 hover:text-blue-500 text-xs font-medium focus:outline-none transition-colors"
           >
             <Globe size={12} />
             <span>{currentLangName}</span>
           </button>
           
           {showLangMenu && (
             <>
               {/* Click outside closer */}
               <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)}></div>
               
               <div role="listbox" aria-label={t(uiLanguage, 'documentLanguage')} className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 shadow-xl rounded-xl border z-50 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-bottom-2
                  ${darkMode ? 'bg-[#252525] border-gray-700' : 'bg-white border-gray-100'}
               `}>
                 {LANGUAGES.map(lang => (
                   <button
                     key={lang.code}
                     role="option"
                     aria-selected={language === lang.code}
                     className={`w-full text-left px-4 py-2 text-xs flex justify-between items-center transition-colors
                        ${darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'}
                        ${language === lang.code ? 'font-bold text-blue-500' : ''}
                     `}
                     onClick={() => {
                       onChangeLanguage(lang.code);
                       setShowLangMenu(false);
                     }}
                   >
                     {lang.name}
                     {language === lang.code && <span>✓</span>}
                   </button>
                 ))}
               </div>
             </>
           )}
        </div>

        <div className={`w-px h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-2">
          <button onClick={() => setZoom(Math.max(10, zoom - 10))} className="hover:text-blue-500 p-1" aria-label={t(uiLanguage, 'zoomOut')} title={t(uiLanguage, 'zoomOut')}>
            <Minus size={12} />
          </button>
          
          <span className="text-xs font-medium w-8 text-center" aria-live="polite">{zoom}%</span>
          
          <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="hover:text-blue-500 p-1" aria-label={t(uiLanguage, 'zoomIn')} title={t(uiLanguage, 'zoomIn')}>
            <Plus size={12} />
          </button>
        </div>
    </div>
  );
};