import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, ExternalLink, Trash2 } from 'lucide-react';
import { useFocusTrap } from '../utils/hooks';

interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onInsert: (url: string, text: string) => void;
  onRemove: () => void;
  existingLink?: { url: string; text: string } | null;
}

export const LinkDialog: React.FC<LinkDialogProps> = ({
  isOpen,
  onClose,
  darkMode,
  onInsert,
  onRemove,
  existingLink
}) => {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (isOpen) {
      if (existingLink) {
        setUrl(existingLink.url);
        setText(existingLink.text);
      } else {
        const selection = window.getSelection();
        const selectedText = selection?.toString() || '';
        setUrl('');
        setText(selectedText);
      }
    }
  }, [isOpen, existingLink]);

  const handleInsert = () => {
    if (!url.trim()) {
      alert('Please enter a URL');
      return;
    }

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    onInsert(finalUrl, text.trim() || finalUrl);
    handleClose();
  };

  const handleRemove = () => {
    onRemove();
    handleClose();
  };

  const handleClose = () => {
    setUrl('');
    setText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="link-dialog-title">
      <div ref={dialogRef} className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <LinkIcon size={20} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
            <h2 id="link-dialog-title" className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {existingLink ? 'Edit Link' : 'Insert Link'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Display Text
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Link text"
              className={`w-full px-4 py-2 rounded-lg border-2 outline-none transition-colors ${
                darkMode
                  ? 'bg-[#0f0f0f] border-gray-700 text-gray-200 focus:border-blue-500'
                  : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
              className={`w-full px-4 py-2 rounded-lg border-2 outline-none transition-colors ${
                darkMode
                  ? 'bg-[#0f0f0f] border-gray-700 text-gray-200 focus:border-blue-500'
                  : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
              }`}
            />
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Tip: https:// will be added automatically if needed
            </p>
          </div>

          {url && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${darkMode ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
              <ExternalLink size={16} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
              <span className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                Preview: {text || url}
              </span>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div>
            {existingLink && (
              <button
                onClick={handleRemove}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  darkMode ? 'hover:bg-red-600/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                }`}
              >
                <Trash2 size={16} />
                Remove Link
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              className="px-6 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              {existingLink ? 'Update' : 'Insert'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
