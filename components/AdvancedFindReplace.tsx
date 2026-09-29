import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { getSearchState } from '../editor/extensions/search';
import type { Transaction } from '@tiptap/pm/state';
import { X, Search, Replace, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';
import { useEscapeKey } from '../utils/hooks';

interface AdvancedFindReplaceProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

export const AdvancedFindReplace: React.FC<AdvancedFindReplaceProps> = ({
  isOpen,
  onClose,
  darkMode,
  uiLanguage,
}) => {
  const { editor } = useApp();
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [findInSelection, setFindInSelection] = useState(false);
  const [, forceRender] = useState(0);
  // Selection captured when the dialog opens (the editor keeps it while the input has focus)
  const selectionRange = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !editor) return;
    const { from, to, empty } = editor.state.selection;
    selectionRange.current = empty ? null : { from, to };
    if (!empty && to - from < 200 && !findText) {
      const selected = editor.state.doc.textBetween(from, to, ' ');
      if (!selected.includes('\n')) setFindText(selected);
    }
    const rerender = ({ transaction }: { transaction: Transaction }) => {
      // keep the "find in selection" range on the same text through replacements
      const range = selectionRange.current;
      if (range && transaction.docChanged) {
        selectionRange.current = { from: transaction.mapping.map(range.from, -1), to: transaction.mapping.map(range.to, 1) };
      }
      forceRender(n => n + 1);
    };
    editor.on('transaction', rerender);
    return () => {
      editor.off('transaction', rerender);
      if (!editor.isDestroyed) editor.commands.clearSearch();
    };
  }, [isOpen, editor]);

  // Live search as options change
  useEffect(() => {
    if (!isOpen || !editor) return;
    editor.commands.setSearch({
      term: findText,
      regex: useRegex,
      caseSensitive,
      wholeWord,
      range: findInSelection ? selectionRange.current : null,
    });
  }, [isOpen, editor, findText, useRegex, caseSensitive, wholeWord, findInSelection]);

  const search = editor ? getSearchState(editor.state) : null;
  const matchCount = search?.matches.length || 0;
  const currentMatchIndex = matchCount ? search!.current : -1;
  const regexError = search?.error ? `${t(uiLanguage, 'invalidRegex')}: ${search.error}` : null;

  const nextMatch = () => editor && matchCount && editor.commands.goToMatch(currentMatchIndex + 1);
  const previousMatch = () => editor && matchCount && editor.commands.goToMatch(currentMatchIndex - 1);
  const findMatches = () => {
    if (!editor) return;
    if (matchCount) editor.commands.goToMatch(currentMatchIndex);
  };
  const replaceCurrent = () => {
    if (!editor || currentMatchIndex < 0) return;
    editor.commands.replaceMatch(replaceText);
  };
  const replaceAll = () => {
    if (!editor || !matchCount) return;
    editor.commands.replaceAllMatches(replaceText);
  };

  // Esc closes it from anywhere (also while typing in the document)
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#1e1e1e] border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-900';
  const inputBg = darkMode ? 'bg-[#2a2a2a] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const buttonBg = darkMode ? 'bg-[#2a2a2a] hover:bg-[#3a3a3a]' : 'bg-gray-100 hover:bg-gray-200';

  return (
    <div className="fixed top-16 right-4 sm:right-8 z-[70]">
      <div className={`w-[500px] max-w-[calc(100vw-2rem)] rounded-lg shadow-2xl border ${bg}`} role="dialog" aria-modal="false" aria-labelledby="find-replace-title">
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 id="find-replace-title" className="text-lg font-bold flex items-center gap-2">
            <Search size={20} />
            {t(uiLanguage, 'findReplace')}
          </h2>
          <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label={t(uiLanguage, 'close')}>
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Find Input */}
          <div>
            <label htmlFor="find-replace-find" className="text-xs opacity-60 block mb-1">{t(uiLanguage, 'findText')}</label>
            <div className="flex gap-2">
              <input
                id="find-replace-find"
                type="text"
                value={findText}
                aria-invalid={!!regexError}
                aria-describedby="find-replace-status"
                onChange={(e) => setFindText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) previousMatch();
                    else nextMatch();
                  }
                }}
                className={`flex-1 min-w-0 px-3 py-2 rounded border ${inputBg}`}
                placeholder={t(uiLanguage, 'enterSearchTerm')}
                autoFocus
              />
              <button
                onClick={findMatches}
                className={`px-4 py-2 rounded flex items-center gap-2 ${buttonBg}`}
              >
                <Search size={16} />
                {t(uiLanguage, 'find')}
              </button>
            </div>
          </div>

          {/* Replace Input */}
          <div>
            <label htmlFor="find-replace-replace" className="text-xs opacity-60 block mb-1">{t(uiLanguage, 'replaceWith')}</label>
            <div className="flex gap-2">
              <input
                id="find-replace-replace"
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className={`flex-1 min-w-0 px-3 py-2 rounded border ${inputBg}`}
                placeholder={t(uiLanguage, 'enterReplacementText')}
              />
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">{t(uiLanguage, 'useRegex')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">{t(uiLanguage, 'caseSensitive')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">{t(uiLanguage, 'wholeWord')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={findInSelection}
                onChange={(e) => {
                  // Use the editor's current selection if one was made after opening.
                  if (e.target.checked && editor && !editor.state.selection.empty) {
                    const { from, to } = editor.state.selection;
                    selectionRange.current = { from, to };
                  }
                  setFindInSelection(e.target.checked);
                }}
                className="w-4 h-4"
              />
              <span className="text-sm">{t(uiLanguage, 'findInSelection')}</span>
            </label>
          </div>

          {/* Error Message */}
          {regexError && (
            <div className={`p-3 rounded flex items-start gap-2 ${darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-sm">{regexError}</div>
            </div>
          )}

          {/* Match Counter */}
          {findText && !regexError && matchCount === 0 && (
            <div className="text-sm opacity-70">{t(uiLanguage, 'noMatchesFound')}</div>
          )}
          {matchCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">
                {currentMatchIndex + 1} {t(uiLanguage, 'of')} {matchCount} {t(uiLanguage, 'matches')}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={previousMatch}
                  className={`p-2 rounded ${buttonBg}`}
                  title={t(uiLanguage, 'previousMatch')}
                  aria-label={t(uiLanguage, 'previousMatch')}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={nextMatch}
                  className={`p-2 rounded ${buttonBg}`}
                  title={t(uiLanguage, 'nextMatch')}
                  aria-label={t(uiLanguage, 'nextMatch')}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Screen-reader status */}
          <div id="find-replace-status" className="sr-only" aria-live="polite">
            {regexError || (findText ? (matchCount ? `${currentMatchIndex + 1} ${t(uiLanguage, 'of')} ${matchCount} ${t(uiLanguage, 'matches')}` : t(uiLanguage, 'noMatchesFound')) : '')}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={replaceCurrent}
              disabled={currentMatchIndex < 0}
              className={`flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <Replace size={16} />
              {t(uiLanguage, 'replaceCurrent')}
            </button>
            <button
              onClick={replaceAll}
              disabled={matchCount === 0}
              className={`flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <Replace size={16} />
              {t(uiLanguage, 'replaceAll')}
            </button>
          </div>

          {/* Hint */}
          <p className="text-xs opacity-50 text-center">
            {t(uiLanguage, 'findReplaceHint')}
          </p>
        </div>
      </div>
    </div>
  );
};
