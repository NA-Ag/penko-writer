import React, { useState } from 'react';
import { X, Search, Replace, ChevronDown, ChevronUp } from 'lucide-react';
import { useFocusTrap, useAriaAnnouncer } from '../utils/hooks';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export const SearchDialog: React.FC<SearchDialogProps> = ({ isOpen, onClose, darkMode }) => {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const { announcement, announce } = useAriaAnnouncer();

  if (!isOpen) return null;

  const handleFind = (direction: 'next' | 'prev') => {
    if (!searchText) return;
    // @ts-ignore
    const found = window.find(searchText, false, direction === 'prev', true, false, false, false);
    if (!found) {
      announce('Text not found');
    } else {
      announce(`Found: ${searchText}`);
    }
  };

  const handleReplace = () => {
    if (!searchText) return;
    const selection = window.getSelection();
    if (selection && selection.toString().toLowerCase() === searchText.toLowerCase()) {
      document.execCommand('insertText', false, replaceText);
      handleFind('next');
    } else {
      handleFind('next');
    }
  };

  const handleReplaceAll = () => {
    if (!searchText) return;
    const editor = document.getElementById('editor-content');
    if (editor) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    let count = 0;
    while (count < 1000) {
        // @ts-ignore
        const found = window.find(searchText, false, false, false, false, false, false);
        if (!found) break;
        document.execCommand('insertText', false, replaceText);
        count++;
    }
    announce(`Replaced ${count} occurrences.`);
  };

  const bg = darkMode ? 'bg-[#222] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const headerBg = darkMode ? 'bg-[#333] border-gray-600' : 'bg-[#f3f4f6] border-gray-200';
  const inputBg = darkMode ? 'bg-[#333] border-gray-500 text-white' : 'bg-white border-gray-300';
  const btnBg = darkMode ? 'bg-[#333] hover:bg-[#444] border-gray-500 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 border-gray-300';

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="search-dialog-title" className={`fixed top-20 right-10 shadow-xl border rounded-lg w-80 z-50 overflow-hidden text-sm ${bg}`}>
      <div className={`px-3 py-2 flex justify-between items-center border-b handle cursor-move ${headerBg}`}>
        <span id="search-dialog-title" className="font-semibold">Find and Replace</span>
        <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-red-500"><X size={16}/></button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className={`block text-xs mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Find what:</label>
          <div className="flex gap-1">
             <input 
                autoFocus
                className={`flex-1 border rounded px-2 py-1 outline-none focus:border-blue-500 ${inputBg}`}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFind('next')}
            />
          </div>
        </div>
        <div>
          <label className={`block text-xs mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Replace with:</label>
           <input 
              className={`w-full border rounded px-2 py-1 outline-none focus:border-blue-500 ${inputBg}`}
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 pt-2">
            <button onClick={() => handleFind('prev')} aria-label="Find Previous" className={`px-2 py-1 rounded border ${btnBg}`}>
               <ChevronUp size={16}/>
            </button>
            <button onClick={() => handleFind('next')} className={`px-2 py-1 rounded border flex-1 text-center ${btnBg}`}>
               Find Next
            </button>
        </div>
        <div className="flex gap-2">
             <button onClick={handleReplace} className={`px-3 py-1 rounded border flex-1 ${btnBg}`}>
               Replace
            </button>
            <button onClick={handleReplaceAll} className={`px-3 py-1 rounded border flex-1 ${btnBg}`}>
               Replace All
            </button>
        </div>
        {/* Screen reader announcements */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>
      </div>
    </div>
  );
};