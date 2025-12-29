import React, { useState, useEffect } from 'react';
import { X, Check, FileText, ListOrdered } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';

interface FootnoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (noteData: { type: 'footnote' | 'endnote'; content: string; number: number }) => void;
  darkMode: boolean;
  existingNotes: { type: 'footnote' | 'endnote'; content: string; number: number }[];
  uiLanguage: LanguageCode;
}

const FootnoteDialog: React.FC<FootnoteDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
  darkMode,
  existingNotes,
  uiLanguage,
}) => {
  const [noteType, setNoteType] = useState<'footnote' | 'endnote'>('footnote');
  const [content, setContent] = useState('');
  const [nextNumber, setNextNumber] = useState(1);

  useEffect(() => {
    if (isOpen) {
      // Calculate next number based on existing notes of the same type
      const notesOfType = existingNotes.filter(note => note.type === noteType);
      const maxNumber = notesOfType.length > 0
        ? Math.max(...notesOfType.map(n => n.number))
        : 0;
      setNextNumber(maxNumber + 1);
    }
  }, [isOpen, noteType, existingNotes]);

  useEffect(() => {
    if (!isOpen) {
      setContent('');
      setNoteType('footnote');
    }
  }, [isOpen]);

  const handleInsert = () => {
    if (content.trim()) {
      onInsert({
        type: noteType,
        content: content.trim(),
        number: nextNumber,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className={`
        max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{noteType === 'footnote' ? t(uiLanguage, 'insertFootnote') : t(uiLanguage, 'insertEndnote')}</h2>
              <p className="text-green-100 text-sm">{t(uiLanguage, 'addReferenceNote')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Note Type Selection */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'noteType')}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="noteType"
                  checked={noteType === 'footnote'}
                  onChange={() => setNoteType('footnote')}
                  className="w-4 h-4 border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                  <strong>{t(uiLanguage, 'footnote')}</strong> - {t(uiLanguage, 'footnoteAppears')}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="noteType"
                  checked={noteType === 'endnote'}
                  onChange={() => setNoteType('endnote')}
                  className="w-4 h-4 border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                  <strong>{t(uiLanguage, 'endnote')}</strong> - {t(uiLanguage, 'endnoteAppears')}
                </span>
              </label>
            </div>
          </div>

          {/* Note Number Info */}
          <div className={`
            mb-4 p-3 rounded-lg text-sm flex items-center gap-2
            ${darkMode ? 'bg-green-900/20 text-green-300' : 'bg-green-50 text-green-800'}
          `}>
            <ListOrdered className="w-4 h-4" />
            <span>{t(uiLanguage, 'thisWillBe')} {t(uiLanguage, noteType)} <strong>#{nextNumber}</strong></span>
          </div>

          {/* Content Input */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'noteContent')}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t(uiLanguage, 'enterNoteText')}
              rows={5}
              className={`
                w-full px-4 py-3 rounded-lg text-sm
                ${darkMode
                  ? 'bg-gray-800 text-white border-gray-700'
                  : 'bg-gray-50 text-gray-900 border-gray-300'
                }
                border-2 focus:border-green-500 outline-none transition-colors resize-none
              `}
            />
          </div>

          {/* Existing Notes Summary */}
          {existingNotes.length > 0 && (
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'existingNotes')} ({existingNotes.length})
              </label>
              <div className={`
                p-3 rounded-lg max-h-32 overflow-y-auto text-xs
                ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}
              `}>
                {existingNotes.map((note, idx) => (
                  <div key={idx} className={`mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <strong>{note.type === 'footnote' ? 'FN' : 'EN'} #{note.number}:</strong> {note.content.substring(0, 50)}{note.content.length > 50 ? '...' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className={`
            p-4 rounded-lg text-sm
            ${darkMode ? 'bg-teal-900/20 border-teal-700' : 'bg-teal-50 border-teal-200'}
            border
          `}>
            <p className={darkMode ? 'text-teal-200' : 'text-teal-900'}>
              {t(uiLanguage, 'footnotesHowItWorks')} {t(uiLanguage, noteType === 'footnote' ? 'bottomOfPage' : 'endOfDocument')}.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`
          p-6 border-t flex justify-end gap-3
          ${darkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}
        `}>
          <button
            onClick={onClose}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-colors
              ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }
            `}
          >
            {t(uiLanguage, 'cancel')}
          </button>
          <button
            onClick={handleInsert}
            disabled={!content.trim()}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
              ${!content.trim()
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white'
              }
            `}
          >
            <Check className="w-5 h-5" />
            {noteType === 'footnote' ? t(uiLanguage, 'insertFootnote') : t(uiLanguage, 'insertEndnote')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FootnoteDialog;
