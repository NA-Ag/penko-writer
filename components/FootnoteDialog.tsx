import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, FileText, ListOrdered, Trash2 } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';
import { useFocusTrap } from '../utils/hooks';
import { noteLabel } from '../editor/extensions/references';

interface FootnoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (noteData: { type: 'footnote' | 'endnote'; content: string }) => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

interface NoteInfo {
  pos: number;
  type: 'footnote' | 'endnote';
  content: string;
  number: number;
}

const FootnoteDialog: React.FC<FootnoteDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
  darkMode,
  uiLanguage,
}) => {
  const { editor, editingFootnote, setEditingFootnote, handleUpdateFootnote } = useApp();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [noteType, setNoteType] = useState<'footnote' | 'endnote'>('footnote');
  const [content, setContent] = useState('');
  const isEditing = !!editingFootnote;

  // Notes currently in the document, in document order (numbering is automatic)
  const existingNotes = useMemo<NoteInfo[]>(() => {
    if (!isOpen || !editor || editor.isDestroyed) return [];
    const notes: NoteInfo[] = [];
    const counters = { footnote: 0, endnote: 0 };
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'footnote') {
        const type = node.attrs.noteType === 'endnote' ? 'endnote' : 'footnote';
        counters[type] += 1;
        notes.push({ pos, type, content: node.attrs.content || '', number: node.attrs.number || counters[type] });
      }
      return true;
    });
    return notes;
  }, [isOpen, editor, editingFootnote]);

  // Number the new note will get: notes of the same type before the cursor + 1
  const nextNumber = useMemo(() => {
    if (isEditing) {
      return existingNotes.find(n => n.pos === editingFootnote!.pos)?.number || 1;
    }
    const from = editor && !editor.isDestroyed ? editor.state.selection.from : Infinity;
    return existingNotes.filter(n => n.type === noteType && n.pos < from).length + 1;
  }, [existingNotes, noteType, isEditing, editingFootnote, editor]);

  useEffect(() => {
    if (isOpen) {
      if (editingFootnote) {
        setContent(editingFootnote.content || '');
        setNoteType(editingFootnote.noteType === 'endnote' ? 'endnote' : 'footnote');
      }
    } else {
      setContent('');
      setNoteType('footnote');
    }
  }, [isOpen, editingFootnote]);

  const handleClose = () => {
    setEditingFootnote(null);
    onClose();
  };

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
    if (!content.trim()) return;
    if (editingFootnote) {
      handleUpdateFootnote(editingFootnote.pos, content.trim());
    } else {
      onInsert({ type: noteType, content: content.trim() });
    }
    handleClose();
  };

  const handleDelete = () => {
    if (editingFootnote) handleUpdateFootnote(editingFootnote.pos, '');
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="footnote-dialog-title">
      <div ref={dialogRef} className={`
        max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 text-white relative">
          <button
            onClick={handleClose}
            aria-label={t(uiLanguage, 'close')}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 id="footnote-dialog-title" className="text-xl font-bold">{isEditing ? (noteType === 'footnote' ? t(uiLanguage, 'editFootnote') : t(uiLanguage, 'editEndnote')) : (noteType === 'footnote' ? t(uiLanguage, 'insertFootnote') : t(uiLanguage, 'insertEndnote'))}</h2>
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
                  disabled={isEditing}
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
                  disabled={isEditing}
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
            <span>{t(uiLanguage, 'thisWillBe')} {t(uiLanguage, noteType)} <strong>#{noteLabel(noteType, nextNumber)}</strong></span>
          </div>

          {/* Content Input */}
          <div className="mb-6">
            <label htmlFor="footnote-content" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'noteContent')}
            </label>
            <textarea
              id="footnote-content"
              data-autofocus
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
                {existingNotes.map(note => (
                  <div key={note.pos} className={`mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <strong>{note.type === 'footnote' ? t(uiLanguage, 'footnoteAbbr') : t(uiLanguage, 'endnoteAbbr')} #{noteLabel(note.type, note.number)}:</strong> {note.content.substring(0, 50)}{note.content.length > 50 ? '...' : ''}
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
          {isEditing && (
            <button
              onClick={handleDelete}
              className={`mr-auto px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                darkMode ? 'hover:bg-red-600/20 text-red-400' : 'hover:bg-red-50 text-red-600'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {t(uiLanguage, 'deleteNote')}
            </button>
          )}
          <button
            onClick={handleClose}
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
            {isEditing ? t(uiLanguage, 'saveNote') : (noteType === 'footnote' ? t(uiLanguage, 'insertFootnote') : t(uiLanguage, 'insertEndnote'))}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FootnoteDialog;
