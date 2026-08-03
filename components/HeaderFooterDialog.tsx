import React, { useState, useRef, useEffect } from 'react';
import { X, Type, AlignLeft, AlignCenter, AlignRight, Hash } from 'lucide-react';
import { useFocusTrap } from '../utils/hooks';

interface HeaderFooterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  headerContent: string;
  footerContent: string;
  showPageNumbers: boolean;
  pageNumberPosition: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right';
  onSave: (data: {
    header: string;
    footer: string;
    showPageNumbers: boolean;
    pageNumberPosition: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right';
  }) => void;
}

export const HeaderFooterDialog: React.FC<HeaderFooterDialogProps> = ({
  isOpen,
  onClose,
  darkMode,
  headerContent,
  footerContent,
  showPageNumbers,
  pageNumberPosition,
  onSave
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [header, setHeader] = useState(headerContent);
  const [footer, setFooter] = useState(footerContent);
  const [showNumbers, setShowNumbers] = useState(showPageNumbers);
  const [numberPosition, setNumberPosition] = useState(pageNumberPosition);
  const [activeTab, setActiveTab] = useState<'header' | 'footer'>('header');

  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHeader(headerContent);
      setFooter(footerContent);
      setShowNumbers(showPageNumbers);
      setNumberPosition(pageNumberPosition);
    }
  }, [isOpen, headerContent, footerContent, showPageNumbers, pageNumberPosition]);

  const handleSave = () => {
    onSave({
      header: headerRef.current?.innerHTML || '',
      footer: footerRef.current?.innerHTML || '',
      showPageNumbers: showNumbers,
      pageNumberPosition: numberPosition
    });
    onClose();
  };

  const executeCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    const activeRef = activeTab === 'header' ? headerRef : footerRef;
    activeRef.current?.focus();
  };

  const insertPageNumber = () => {
    const activeRef = activeTab === 'header' ? headerRef : footerRef;
    if (activeRef.current) {
      const selection = window.getSelection();
      if (selection && activeRef.current.contains(selection.anchorNode)) {
        const span = document.createElement('span');
        span.className = 'page-number-placeholder';
        span.contentEditable = 'false';
        span.style.cssText = 'background: #e3f2fd; padding: 2px 6px; border-radius: 3px; font-weight: 500; color: #1976d2;';
        span.textContent = '{PAGE}';

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(span);
        range.setStartAfter(span);
        range.setEndAfter(span);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="header-footer-dialog-title">
      <div ref={dialogRef} className={`w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <h2 id="header-footer-dialog-title" className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Header & Footer
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">

          {/* Tabs */}
          <div className="flex space-x-2 mb-6">
            <button
              onClick={() => setActiveTab('header')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'header'
                  ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white')
                  : (darkMode ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-600')
              }`}
            >
              Header
            </button>
            <button
              onClick={() => setActiveTab('footer')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'footer'
                  ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white')
                  : (darkMode ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-600')
              }`}
            >
              Footer
            </button>
          </div>

          {/* Formatting Toolbar */}
          <div className={`flex items-center space-x-2 p-3 rounded-lg mb-4 ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('bold')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('italic')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title="Italic"
            >
              <em>I</em>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('underline')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title="Underline"
            >
              <u>U</u>
            </button>
            <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('justifyLeft')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title="Align Left"
            >
              <AlignLeft size={16} />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('justifyCenter')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title="Align Center"
            >
              <AlignCenter size={16} />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('justifyRight')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title="Align Right"
            >
              <AlignRight size={16} />
            </button>
            <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertPageNumber}
              className={`px-3 py-2 rounded flex items-center space-x-2 ${darkMode ? 'hover:bg-white/10 bg-blue-600/20 text-blue-400' : 'hover:bg-gray-200 bg-blue-50 text-blue-600'}`}
              title="Insert Page Number"
            >
              <Hash size={16} />
              <span className="text-sm font-medium">Page #</span>
            </button>
          </div>

          {/* Header Editor */}
          {activeTab === 'header' && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Header Content
              </label>
              <div
                ref={headerRef}
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: header }}
                onInput={(e) => setHeader(e.currentTarget.innerHTML)}
                className={`min-h-[120px] p-4 rounded-lg border-2 outline-none transition-colors ${
                  darkMode
                    ? 'bg-[#0f0f0f] border-gray-700 text-gray-200 focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
                }`}
                style={{ fontSize: '11pt', lineHeight: '1.5' }}
              />
            </div>
          )}

          {/* Footer Editor */}
          {activeTab === 'footer' && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Footer Content
              </label>
              <div
                ref={footerRef}
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: footer }}
                onInput={(e) => setFooter(e.currentTarget.innerHTML)}
                className={`min-h-[120px] p-4 rounded-lg border-2 outline-none transition-colors ${
                  darkMode
                    ? 'bg-[#0f0f0f] border-gray-700 text-gray-200 focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
                }`}
                style={{ fontSize: '11pt', lineHeight: '1.5' }}
              />
            </div>
          )}

          {/* Page Number Settings */}
          <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showNumbers}
                onChange={(e) => setShowNumbers(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Show page numbers
              </span>
            </label>

            {showNumbers && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNumberPosition('header-left')}
                  className={`p-3 rounded-lg text-sm transition-all ${
                    numberPosition === 'header-left'
                      ? 'bg-blue-600 text-white'
                      : (darkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-white text-gray-700 hover:bg-gray-100')
                  }`}
                >
                  Header - Left
                </button>
                <button
                  onClick={() => setNumberPosition('header-center')}
                  className={`p-3 rounded-lg text-sm transition-all ${
                    numberPosition === 'header-center'
                      ? 'bg-blue-600 text-white'
                      : (darkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-white text-gray-700 hover:bg-gray-100')
                  }`}
                >
                  Header - Center
                </button>
                <button
                  onClick={() => setNumberPosition('header-right')}
                  className={`p-3 rounded-lg text-sm transition-all ${
                    numberPosition === 'header-right'
                      ? 'bg-blue-600 text-white'
                      : (darkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-white text-gray-700 hover:bg-gray-100')
                  }`}
                >
                  Header - Right
                </button>
                <button
                  onClick={() => setNumberPosition('footer-left')}
                  className={`p-3 rounded-lg text-sm transition-all ${
                    numberPosition === 'footer-left'
                      ? 'bg-blue-600 text-white'
                      : (darkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-white text-gray-700 hover:bg-gray-100')
                  }`}
                >
                  Footer - Left
                </button>
                <button
                  onClick={() => setNumberPosition('footer-center')}
                  className={`p-3 rounded-lg text-sm transition-all ${
                    numberPosition === 'footer-center'
                      ? 'bg-blue-600 text-white'
                      : (darkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-white text-gray-700 hover:bg-gray-100')
                  }`}
                >
                  Footer - Center
                </button>
                <button
                  onClick={() => setNumberPosition('footer-right')}
                  className={`p-3 rounded-lg text-sm transition-all ${
                    numberPosition === 'footer-right'
                      ? 'bg-blue-600 text-white'
                      : (darkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-white text-gray-700 hover:bg-gray-100')
                  }`}
                >
                  Footer - Right
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className={`flex items-center justify-end space-x-3 px-6 py-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
