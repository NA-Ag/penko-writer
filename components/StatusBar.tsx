import React, { useState } from 'react';
import { Minus, Plus, Globe, ChevronUp } from 'lucide-react';
import { LANGUAGES } from '../constants';
import { LanguageCode } from '../utils/translations';

interface StatusBarProps {
  wordCount: number;
  zoom: number;
  setZoom: (z: number) => void;
  darkMode: boolean;
  onShowStats: () => void;
  language: string;
  onChangeLanguage: (lang: string) => void;
  uiLanguage: LanguageCode;
}

export const StatusBar: React.FC<StatusBarProps> = ({ wordCount, zoom, setZoom, darkMode, onShowStats, language, onChangeLanguage, uiLanguage }) => {
  const [showLangMenu, setShowLangMenu] = useState(false);
  
  const currentLangName = LANGUAGES.find(l => l.code === language)?.name || language;

  return (
    <div className={`h-10 px-4 rounded-full shadow-lg border backdrop-blur-md flex items-center space-x-6 select-none transition-all
       ${darkMode ? 'bg-[#1e1e1e]/90 border-gray-700 text-gray-300' : 'bg-white/90 border-gray-200 text-gray-600'}
    `}>
        {/* Word Count */}
        <button onClick={onShowStats} className="hover:text-blue-500 font-medium text-xs transition-colors flex items-center gap-1">
           {wordCount} words
        </button>
        
        <div className={`w-px h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

        {/* Language Picker */}
        <div className="relative">
           <button 
             onClick={() => setShowLangMenu(!showLangMenu)} 
             className="flex items-center gap-1.5 hover:text-blue-500 text-xs font-medium focus:outline-none transition-colors"
           >
             <Globe size={12} />
             <span>{currentLangName}</span>
           </button>
           
           {showLangMenu && (
             <>
               {/* Click outside closer */}
               <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)}></div>
               
               <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 shadow-xl rounded-xl border z-50 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-bottom-2
                  ${darkMode ? 'bg-[#252525] border-gray-700' : 'bg-white border-gray-100'}
               `}>
                 {LANGUAGES.map(lang => (
                   <button
                     key={lang.code}
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
          <button onClick={() => setZoom(Math.max(10, zoom - 10))} className="hover:text-blue-500 p-1">
            <Minus size={12} />
          </button>
          
          <span className="text-xs font-medium w-8 text-center">{zoom}%</span>
          
          <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="hover:text-blue-500 p-1">
            <Plus size={12} />
          </button>
        </div>
    </div>
  );
};