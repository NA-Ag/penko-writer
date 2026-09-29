import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, ExternalLink, Trash2 } from 'lucide-react';
import { useFocusTrap } from '../utils/hooks';
import { useApp } from '../AppContext';
import { safeUrl } from '../editor/sanitize';
import { t } from '../utils/translations';

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
  const { uiLanguage, toast } = useApp();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  // An existing link has a URL; a selection without a link only pre-fills the text.
  const isEditing = !!existingLink?.url;

  useEffect(() => {
    if (isOpen) {
      setUrl(existingLink?.url || '');
      setText(existingLink?.text || '');
      setError('');
    }
  }, [isOpen, existingLink]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const handleInsert = () => {
    if (!url.trim()) {
      setError(t(uiLanguage, 'enterUrl'));
      return;
    }
    const finalUrl = safeUrl(url);
    if (!finalUrl) {
      setError(t(uiLanguage, 'invalidUrl'));
      toast.error(t(uiLanguage, 'invalidUrl'));
      return;
    }
    // Unchanged text keeps the selected (possibly formatted) text as-is.
    onInsert(finalUrl, text.trim() === (existingLink?.text || '').trim() ? existingLink?.text || '' : text.trim());
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
              {isEditing ? t(uiLanguage, 'editLink') : t(uiLanguage, 'insertLink')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label={t(uiLanguage, 'close')}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="link-dialog-text" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'displayText')}
            </label>
            <input
              id="link-dialog-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t(uiLanguage, 'linkTextPlaceholder')}
              className={`w-full px-4 py-2 rounded-lg border-2 outline-none transition-colors ${
                darkMode
                  ? 'bg-[#0f0f0f] border-gray-700 text-gray-200 focus:border-blue-500'
                  : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label htmlFor="link-dialog-url" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'url')}
            </label>
            <input
              id="link-dialog-url"
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              aria-invalid={!!error}
              aria-describedby="link-dialog-hint"
              placeholder="https://example.com"
              autoFocus
              data-autofocus
              onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
              className={`w-full px-4 py-2 rounded-lg border-2 outline-none transition-colors ${
                darkMode
                  ? 'bg-[#0f0f0f] border-gray-700 text-gray-200 focus:border-blue-500'
                  : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
              }`}
            />
            <p id="link-dialog-hint" role={error ? 'alert' : undefined} className={`text-xs mt-1 ${error ? 'text-red-500' : (darkMode ? 'text-gray-500' : 'text-gray-400')}`}>
              {error || t(uiLanguage, 'linkUrlTip')}
            </p>
          </div>

          {url && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${darkMode ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
              <ExternalLink size={16} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
              <span className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                {t(uiLanguage, 'preview')}: {text || url}
              </span>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div>
            {isEditing && (
              <button
                onClick={handleRemove}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  darkMode ? 'hover:bg-red-600/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                }`}
              >
                <Trash2 size={16} />
                {t(uiLanguage, 'removeLink')}
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
              {t(uiLanguage, 'cancel')}
            </button>
            <button
              onClick={handleInsert}
              className="px-6 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              {isEditing ? t(uiLanguage, 'update') : t(uiLanguage, 'insert')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
