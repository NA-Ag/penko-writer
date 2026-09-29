import React, { useState, useEffect } from 'react';
import { X, Check, BookMarked, Plus, Trash2, FileText, Pencil } from 'lucide-react';
import { NodeSelection } from '@tiptap/pm/state';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';
import { useFocusTrap } from '../utils/hooks';
import { Citation } from '../types';
import { CitationStyle, formatBibliographyEntry } from '../editor/citations';
import { sanitizeHtml } from '../editor/sanitize';

/** Same text as the bibliography entry in the document (escaped HTML with <i>). */
const previewHtml = (citation: Citation, style: CitationStyle) => ({ __html: sanitizeHtml(formatBibliographyEntry(citation, style)) });

interface CitationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCitation: (citationId: string, style: CitationStyle) => void;
  onInsertBibliography: (style: CitationStyle) => void;
  darkMode: boolean;
  existingCitations: Citation[];
  onAddCitation: (citation: Citation) => void;
  onDeleteCitation: (id: string) => void;
  uiLanguage: LanguageCode;
}

const CitationDialog: React.FC<CitationDialogProps> = ({
  isOpen,
  onClose,
  onInsertCitation,
  onInsertBibliography,
  darkMode,
  existingCitations,
  onAddCitation,
  onDeleteCitation,
  uiLanguage,
}) => {
  const { handleUpdateCitation, toast, editor } = useApp();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [mode, setMode] = useState<'insert' | 'add' | 'bibliography'>('insert');
  const [style, setStyle] = useState<CitationStyle>('apa');
  const [selectedCitation, setSelectedCitation] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  // Position of a citation selected in the document: "Insert" then updates it in place
  const [citationPos, setCitationPos] = useState<number | null>(null);

  // New citation form
  const [citationType, setCitationType] = useState<'book' | 'journal' | 'website' | 'article'>('book');
  const [author, setAuthor] = useState('');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [publisher, setPublisher] = useState('');
  const [journal, setJournal] = useState('');
  const [volume, setVolume] = useState('');
  const [pages, setPages] = useState('');
  const [url, setUrl] = useState('');
  const [accessDate, setAccessDate] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setMode('insert');
      setCitationPos(null);
      resetForm();
      return;
    }
    const sel = editor && !editor.isDestroyed ? editor.state.selection : null;
    if (sel instanceof NodeSelection && sel.node.type.name === 'citation') {
      setCitationPos(sel.from);
      setSelectedCitation(sel.node.attrs.citationId || '');
      setStyle((sel.node.attrs.citationStyle as CitationStyle) || 'apa');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Never keep a selection pointing at a deleted source
  useEffect(() => {
    if (selectedCitation && !existingCitations.some(c => c.id === selectedCitation)) setSelectedCitation('');
    if (editingId && !existingCitations.some(c => c.id === editingId)) {
      setEditingId(null);
      resetForm();
    }
  }, [existingCitations, selectedCitation, editingId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const startEdit = (citation: Citation) => {
    setEditingId(citation.id);
    setCitationType(citation.type);
    setAuthor(citation.author || '');
    setTitle(citation.title || '');
    setYear(citation.year || '');
    setPublisher(citation.publisher || '');
    setJournal(citation.journal || '');
    setVolume(citation.volume || '');
    setPages(citation.pages || '');
    setUrl(citation.url || '');
    setAccessDate(citation.accessDate || '');
    setMode('add');
  };

  const handleDelete = (id: string) => {
    onDeleteCitation(id);
    if (selectedCitation === id) setSelectedCitation('');
    if (editingId === id) resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setCitationType('book');
    setAuthor('');
    setTitle('');
    setYear('');
    setPublisher('');
    setJournal('');
    setVolume('');
    setPages('');
    setUrl('');
    setAccessDate('');
  };

  const handleAddCitation = () => {
    if (!author.trim() || !title.trim() || !year.trim()) {
      toast.warning(t(uiLanguage, 'fillRequiredFields'));
      return;
    }

    const newCitation: Citation = {
      id: editingId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `cit-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      type: citationType,
      author,
      title,
      year,
      publisher,
      journal,
      volume,
      pages,
      url,
      accessDate,
    };

    if (editingId) handleUpdateCitation(newCitation);
    else onAddCitation(newCitation);
    setSelectedCitation(newCitation.id);
    resetForm();
    setMode('insert');
  };

  const handleInsertCitation = () => {
    if (!selectedCitation) return;
    const node = citationPos !== null && editor && !editor.isDestroyed ? editor.state.doc.nodeAt(citationPos) : null;
    if (node?.type.name === 'citation' && editor) {
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(citationPos!, undefined, { ...node.attrs, citationId: selectedCitation, citationStyle: style });
          return true;
        })
        .run();
    } else {
      onInsertCitation(selectedCitation, style);
    }
    onClose();
  };

  const handleInsertBibliography = () => {
    onInsertBibliography(style);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="citation-dialog-title">
      <div ref={dialogRef} className={`
        max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            aria-label={t(uiLanguage, 'close')}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <h2 id="citation-dialog-title" className="text-xl font-bold">{t(uiLanguage, 'citationsAndBibliography')}</h2>
              <p className="text-orange-100 text-sm">{t(uiLanguage, 'manageReferences')}</p>
            </div>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className={`flex border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <button
            onClick={() => { setMode('insert'); if (editingId) resetForm(); }}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              mode === 'insert'
                ? darkMode
                  ? 'bg-orange-900/30 text-orange-400 border-b-2 border-orange-500'
                  : 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                : darkMode
                ? 'text-gray-400 hover:bg-gray-800'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t(uiLanguage, 'insertCitation')}
          </button>
          <button
            onClick={() => setMode('add')}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              mode === 'add'
                ? darkMode
                  ? 'bg-orange-900/30 text-orange-400 border-b-2 border-orange-500'
                  : 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                : darkMode
                ? 'text-gray-400 hover:bg-gray-800'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {editingId ? t(uiLanguage, 'editSource') : t(uiLanguage, 'addNewSource')}
          </button>
          <button
            onClick={() => { setMode('bibliography'); if (editingId) resetForm(); }}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              mode === 'bibliography'
                ? darkMode
                  ? 'bg-orange-900/30 text-orange-400 border-b-2 border-orange-500'
                  : 'bg-orange-50 text-orange-600 border-b-2 border-orange-500'
                : darkMode
                ? 'text-gray-400 hover:bg-gray-800'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t(uiLanguage, 'generateBibliography')}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Citation Style Selector */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t(uiLanguage, 'citationStyle')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['apa', 'mla', 'chicago', 'bibtex'] as CitationStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`
                    px-4 py-2 rounded-lg font-medium transition-colors
                    ${style === s
                      ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
                      : darkMode
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }
                  `}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Insert Citation Mode */}
          {mode === 'insert' && (
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {t(uiLanguage, 'selectCitation')} ({existingCitations.length} {t(uiLanguage, 'sources')})
              </h3>

              {existingCitations.length === 0 ? (
                <div className={`p-8 text-center rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <BookMarked className={`w-12 h-12 mx-auto mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                    {t(uiLanguage, 'noCitationsYet')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {existingCitations.map((citation) => (
                    <div
                      key={citation.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedCitation === citation.id}
                      onClick={() => setSelectedCitation(citation.id)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                          e.preventDefault();
                          setSelectedCitation(citation.id);
                        }
                      }}
                      className={`
                        p-4 rounded-lg cursor-pointer transition-all border-2
                        ${selectedCitation === citation.id
                          ? darkMode
                            ? 'bg-orange-900/30 border-orange-500'
                            : 'bg-orange-50 border-orange-500'
                          : darkMode
                          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className={`font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                            {citation.author} ({citation.year})
                          </p>
                          <p className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {citation.title}
                          </p>
                          <p className="text-xs font-mono text-gray-500" dangerouslySetInnerHTML={previewHtml(citation, style)} />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(citation);
                          }}
                          aria-label={t(uiLanguage, 'editSource')}
                          title={t(uiLanguage, 'editSource')}
                          className={`ml-4 p-2 rounded transition-colors ${
                            darkMode
                              ? 'hover:bg-gray-700 text-gray-400'
                              : 'hover:bg-gray-200 text-gray-600'
                          }`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(citation.id);
                          }}
                          aria-label={t(uiLanguage, 'delete')}
                          title={t(uiLanguage, 'delete')}
                          className={`ml-1 p-2 rounded transition-colors ${
                            darkMode
                              ? 'hover:bg-red-900/30 text-red-400'
                              : 'hover:bg-red-100 text-red-600'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add New Source Mode */}
          {mode === 'add' && (
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {editingId ? t(uiLanguage, 'editSource') : t(uiLanguage, 'addNewSource')}
              </h3>

              {/* Source Type */}
              <div className="mb-4">
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t(uiLanguage, 'sourceType')}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['book', 'journal', 'website', 'article'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setCitationType(type)}
                      className={`
                        px-4 py-2 rounded-lg font-medium capitalize transition-colors
                        ${citationType === type
                          ? 'bg-orange-600 text-white'
                          : darkMode
                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }
                      `}
                    >
                      {t(uiLanguage, type)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="citation-author" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(uiLanguage, 'authors')} *
                  </label>
                  <input
                    id="citation-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder={t(uiLanguage, 'phAuthor')}
                    className={`w-full px-3 py-2 rounded-lg ${
                      darkMode
                        ? 'bg-gray-800 text-white border-gray-700'
                        : 'bg-gray-50 text-gray-900 border-gray-300'
                    } border focus:border-orange-500 outline-none`}
                  />
                </div>

                <div>
                  <label htmlFor="citation-year" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(uiLanguage, 'year')} *
                  </label>
                  <input
                    id="citation-year"
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2024"
                    className={`w-full px-3 py-2 rounded-lg ${
                      darkMode
                        ? 'bg-gray-800 text-white border-gray-700'
                        : 'bg-gray-50 text-gray-900 border-gray-300'
                    } border focus:border-orange-500 outline-none`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="citation-title" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(uiLanguage, 'title')} *
                  </label>
                  <input
                    id="citation-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t(uiLanguage, 'phTitle')}
                    className={`w-full px-3 py-2 rounded-lg ${
                      darkMode
                        ? 'bg-gray-800 text-white border-gray-700'
                        : 'bg-gray-50 text-gray-900 border-gray-300'
                    } border focus:border-orange-500 outline-none`}
                  />
                </div>

                {(citationType === 'book' || citationType === 'article') && (
                  <div className="md:col-span-2">
                    <label htmlFor="citation-publisher" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t(uiLanguage, 'publisher')}
                    </label>
                    <input
                    id="citation-publisher"
                      type="text"
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      placeholder={t(uiLanguage, 'phPublisher')}
                      className={`w-full px-3 py-2 rounded-lg ${
                        darkMode
                          ? 'bg-gray-800 text-white border-gray-700'
                          : 'bg-gray-50 text-gray-900 border-gray-300'
                      } border focus:border-orange-500 outline-none`}
                    />
                  </div>
                )}

                {citationType === 'journal' && (
                  <>
                    <div>
                      <label htmlFor="citation-journal" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t(uiLanguage, 'journal')}
                      </label>
                      <input
                    id="citation-journal"
                        type="text"
                        value={journal}
                        onChange={(e) => setJournal(e.target.value)}
                        placeholder={t(uiLanguage, 'phJournal')}
                        className={`w-full px-3 py-2 rounded-lg ${
                          darkMode
                            ? 'bg-gray-800 text-white border-gray-700'
                            : 'bg-gray-50 text-gray-900 border-gray-300'
                        } border focus:border-orange-500 outline-none`}
                      />
                    </div>

                    <div>
                      <label htmlFor="citation-volume" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t(uiLanguage, 'volume')}
                      </label>
                      <input
                    id="citation-volume"
                        type="text"
                        value={volume}
                        onChange={(e) => setVolume(e.target.value)}
                        placeholder="12"
                        className={`w-full px-3 py-2 rounded-lg ${
                          darkMode
                            ? 'bg-gray-800 text-white border-gray-700'
                            : 'bg-gray-50 text-gray-900 border-gray-300'
                        } border focus:border-orange-500 outline-none`}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="citation-pages" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t(uiLanguage, 'pages')}
                      </label>
                      <input
                    id="citation-pages"
                        type="text"
                        value={pages}
                        onChange={(e) => setPages(e.target.value)}
                        placeholder="123-145"
                        className={`w-full px-3 py-2 rounded-lg ${
                          darkMode
                            ? 'bg-gray-800 text-white border-gray-700'
                            : 'bg-gray-50 text-gray-900 border-gray-300'
                        } border focus:border-orange-500 outline-none`}
                      />
                    </div>
                  </>
                )}

                {citationType === 'website' && (
                  <>
                    <div className="md:col-span-2">
                      <label htmlFor="citation-url" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t(uiLanguage, 'url')}
                      </label>
                      <input
                    id="citation-url"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        className={`w-full px-3 py-2 rounded-lg ${
                          darkMode
                            ? 'bg-gray-800 text-white border-gray-700'
                            : 'bg-gray-50 text-gray-900 border-gray-300'
                        } border focus:border-orange-500 outline-none`}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="citation-access-date" className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t(uiLanguage, 'accessDate')}
                      </label>
                      <input
                    id="citation-access-date"
                        type="text"
                        value={accessDate}
                        onChange={(e) => setAccessDate(e.target.value)}
                        placeholder={t(uiLanguage, 'phAccessDate')}
                        className={`w-full px-3 py-2 rounded-lg ${
                          darkMode
                            ? 'bg-gray-800 text-white border-gray-700'
                            : 'bg-gray-50 text-gray-900 border-gray-300'
                        } border focus:border-orange-500 outline-none`}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bibliography Mode */}
          {mode === 'bibliography' && (
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {t(uiLanguage, 'generateBibliography')}
              </h3>

              <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-orange-900/20 border-orange-700' : 'bg-orange-50 border-orange-200'} border`}>
                <p className={darkMode ? 'text-orange-200' : 'text-orange-900'}>
                  {t(uiLanguage, 'bibliographyInfo').replace('{count}', String(existingCitations.length)).replace('{style}', style.toUpperCase())}
                </p>
              </div>

              {existingCitations.length > 0 && (
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} max-h-96 overflow-y-auto`}>
                  <h4 className={`font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(uiLanguage, 'previewStyle')} ({style.toUpperCase()})
                  </h4>
                  <div className="space-y-2 text-sm font-mono">
                    {existingCitations.map((citation) => (
                      <div key={citation.id} className={darkMode ? 'text-gray-400' : 'text-gray-600'} dangerouslySetInnerHTML={previewHtml(citation, style)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`
          p-6 border-t flex justify-end gap-3 flex-shrink-0
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

          {mode === 'add' && (
            <button
              onClick={handleAddCitation}
              disabled={!author || !title || !year}
              className={`
                px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
                ${!author || !title || !year
                  ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                  : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white'
                }
              `}
            >
              {editingId ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingId ? t(uiLanguage, 'saveSource') : t(uiLanguage, 'addSource')}
            </button>
          )}

          {mode === 'insert' && (
            <button
              onClick={handleInsertCitation}
              disabled={!selectedCitation}
              className={`
                px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
                ${!selectedCitation
                  ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                  : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white'
                }
              `}
            >
              <Check className="w-5 h-5" />
              {citationPos !== null ? t(uiLanguage, 'update') : t(uiLanguage, 'insertCitation')}
            </button>
          )}

          {mode === 'bibliography' && (
            <button
              onClick={handleInsertBibliography}
              disabled={existingCitations.length === 0}
              className={`
                px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
                ${existingCitations.length === 0
                  ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                  : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white'
                }
              `}
            >
              <FileText className="w-5 h-5" />
              {t(uiLanguage, 'insertBibliography')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CitationDialog;
