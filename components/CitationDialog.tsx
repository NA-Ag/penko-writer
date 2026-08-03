import React, { useState, useEffect } from 'react';
import { X, Check, BookMarked, Plus, Trash2, FileText } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';

interface Citation {
  id: string;
  type: 'book' | 'journal' | 'website' | 'article';
  author: string;
  title: string;
  year: string;
  publisher?: string;
  journal?: string;
  volume?: string;
  pages?: string;
  url?: string;
  accessDate?: string;
}

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

type CitationStyle = 'apa' | 'mla' | 'chicago' | 'bibtex';

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
  const [mode, setMode] = useState<'insert' | 'add' | 'bibliography'>('insert');
  const [style, setStyle] = useState<CitationStyle>('apa');
  const [selectedCitation, setSelectedCitation] = useState<string>('');

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
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
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
    if (!author || !title || !year) {
      alert(t(uiLanguage, 'fillRequiredFields'));
      return;
    }

    const newCitation: Citation = {
      id: crypto.randomUUID(),
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

    onAddCitation(newCitation);
    resetForm();
    setMode('insert');
  };

  const handleInsertCitation = () => {
    if (selectedCitation) {
      onInsertCitation(selectedCitation, style);
      onClose();
    }
  };

  const handleInsertBibliography = () => {
    onInsertBibliography(style);
    onClose();
  };

  const formatPreview = (citation: Citation, previewStyle: CitationStyle): string => {
    const { author, title, year, publisher, journal, volume, pages } = citation;

    switch (previewStyle) {
      case 'apa':
        if (citation.type === 'book') {
          return `${author} (${year}). ${title}. ${publisher || 'Publisher'}.`;
        } else if (citation.type === 'journal') {
          return `${author} (${year}). ${title}. ${journal}, ${volume}${pages ? `, ${pages}` : ''}.`;
        }
        return `${author} (${year}). ${title}.`;

      case 'mla':
        if (citation.type === 'book') {
          return `${author}. ${title}. ${publisher || 'Publisher'}, ${year}.`;
        } else if (citation.type === 'journal') {
          return `${author}. "${title}." ${journal} ${volume} (${year})${pages ? `: ${pages}` : ''}.`;
        }
        return `${author}. ${title}. ${year}.`;

      case 'chicago':
        if (citation.type === 'book') {
          return `${author}. ${title}. ${publisher ? `${publisher}, ` : ''}${year}.`;
        } else if (citation.type === 'journal') {
          return `${author}. "${title}." ${journal} ${volume}${pages ? ` (${year}): ${pages}` : ` (${year})`}.`;
        }
        return `${author}. ${title}. ${year}.`;

      case 'bibtex':
        const bibType = citation.type === 'journal' ? 'article' : citation.type;
        return `@${bibType}{${author.split(' ')[0].toLowerCase()}${year},\n  author = {${author}},\n  title = {${title}},\n  year = {${year}}\n}`;

      default:
        return `${author} (${year}). ${title}.`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className={`
        max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <BookMarked className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t(uiLanguage, 'citationsAndBibliography')}</h2>
              <p className="text-orange-100 text-sm">{t(uiLanguage, 'manageReferences')}</p>
            </div>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className={`flex border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <button
            onClick={() => setMode('insert')}
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
            {t(uiLanguage, 'addNewSource')}
          </button>
          <button
            onClick={() => setMode('bibliography')}
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
                      onClick={() => setSelectedCitation(citation.id)}
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
                          <p className={`text-xs font-mono ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            {formatPreview(citation, style)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCitation(citation.id);
                          }}
                          className={`ml-4 p-2 rounded transition-colors ${
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
                {t(uiLanguage, 'addNewSource')}
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
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(uiLanguage, 'authors')} *
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Last, First"
                    className={`w-full px-3 py-2 rounded-lg ${
                      darkMode
                        ? 'bg-gray-800 text-white border-gray-700'
                        : 'bg-gray-50 text-gray-900 border-gray-300'
                    } border focus:border-orange-500 outline-none`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(uiLanguage, 'year')} *
                  </label>
                  <input
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
                  <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(uiLanguage, 'title')} *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title of the work"
                    className={`w-full px-3 py-2 rounded-lg ${
                      darkMode
                        ? 'bg-gray-800 text-white border-gray-700'
                        : 'bg-gray-50 text-gray-900 border-gray-300'
                    } border focus:border-orange-500 outline-none`}
                  />
                </div>

                {(citationType === 'book' || citationType === 'article') && (
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Publisher
                    </label>
                    <input
                      type="text"
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      placeholder="Publisher name"
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
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Journal
                      </label>
                      <input
                        type="text"
                        value={journal}
                        onChange={(e) => setJournal(e.target.value)}
                        placeholder="Journal name"
                        className={`w-full px-3 py-2 rounded-lg ${
                          darkMode
                            ? 'bg-gray-800 text-white border-gray-700'
                            : 'bg-gray-50 text-gray-900 border-gray-300'
                        } border focus:border-orange-500 outline-none`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Volume
                      </label>
                      <input
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
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Pages
                      </label>
                      <input
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
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        URL
                      </label>
                      <input
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
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Access Date
                      </label>
                      <input
                        type="text"
                        value={accessDate}
                        onChange={(e) => setAccessDate(e.target.value)}
                        placeholder="January 15, 2024"
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
                      <div key={citation.id} className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {formatPreview(citation, style)}
                      </div>
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
              <Plus className="w-5 h-5" />
              {t(uiLanguage, 'addSource')}
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
              {t(uiLanguage, 'insertCitation')}
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
