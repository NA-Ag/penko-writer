import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, List, RefreshCw } from 'lucide-react';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';
import { useFocusTrap } from '../utils/hooks';
import { collectHeadings, buildTocInnerHtml, tocContainerStyle, TocStyle } from '../editor/toc';
import { sanitizeHtml } from '../editor/sanitize';

interface TableOfContentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (opts: { style: TocStyle; levels: number[] }) => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

const TableOfContentsDialog: React.FC<TableOfContentsDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
  darkMode,
  uiLanguage,
}) => {
  const { editor } = useApp();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [style, setStyle] = useState<TocStyle>('default');
  const [includeH1, setIncludeH1] = useState(true);
  const [includeH2, setIncludeH2] = useState(true);
  const [includeH3, setIncludeH3] = useState(true);
  const [includeH4, setIncludeH4] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const levels = useMemo(
    () => [includeH1 && 1, includeH2 && 2, includeH3 && 3, includeH4 && 4].filter(Boolean) as number[],
    [includeH1, includeH2, includeH3, includeH4],
  );

  // Position of an existing TOC in the document (to update it instead of inserting a duplicate)
  const findExistingToc = (): { pos: number; attrs: Record<string, any> } | null => {
    if (!editor || editor.isDestroyed) return null;
    let found: { pos: number; attrs: Record<string, any> } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (node.type.name === 'tableOfContents') {
        found = { pos, attrs: node.attrs };
        return false;
      }
      return true;
    });
    return found;
  };
  const existingToc = isOpen ? findExistingToc() : null;

  // Pre-fill the options from an existing TOC when the dialog opens (defaults otherwise,
  // so options from another document don't carry over)
  useEffect(() => {
    if (!isOpen) return;
    const existing = findExistingToc();
    const lv: number[] = existing?.attrs.levels || [1, 2, 3];
    setStyle((existing?.attrs.tocStyle as TocStyle) || 'default');
    setIncludeH1(lv.includes(1));
    setIncludeH2(lv.includes(2));
    setIncludeH3(lv.includes(3));
    setIncludeH4(lv.includes(4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  const entries = useMemo(
    () => (isOpen && editor && !editor.isDestroyed ? collectHeadings(editor.state.doc, levels) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, editor, levels, refreshKey],
  );

  const previewHtml = useMemo(
    () =>
      sanitizeHtml(
        `<div style="${tocContainerStyle(style)}">${buildTocInnerHtml(entries, style, t(uiLanguage, 'tableOfContents'), t(uiLanguage, 'noHeadingsFoundInDoc'))}</div>`,
      ),
    [entries, style, uiLanguage],
  );

  const handleInsert = () => {
    if (levels.length === 0) return;
    const existing = findExistingToc();
    if (existing && editor) {
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(existing.pos, undefined, { ...existing.attrs, tocStyle: style, levels });
          return true;
        })
        .run();
    } else {
      onInsert({ style, levels });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="toc-dialog-title">
      <div ref={dialogRef} className={`
        max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white relative">
          <button
            onClick={onClose}
            aria-label={t(uiLanguage, 'close')}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <List className="w-6 h-6" />
            </div>
            <div>
              <h2 id="toc-dialog-title" className="text-xl font-bold">{t(uiLanguage, 'tableOfContents')}</h2>
              <p className="text-indigo-100 text-sm">{t(uiLanguage, 'autoGenerateFromHeadings')}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Include Levels */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'includeHeadings')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeH1}
                    onChange={(e) => setIncludeH1(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'heading1')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeH2}
                    onChange={(e) => setIncludeH2(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'heading2')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeH3}
                    onChange={(e) => setIncludeH3(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'heading3')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeH4}
                    onChange={(e) => setIncludeH4(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'heading4')}</span>
                </label>
              </div>
            </div>

            {/* Style */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'style')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="style"
                    checked={style === 'default'}
                    onChange={() => setStyle('default')}
                    className="w-4 h-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'styleDefaultBoxed')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="style"
                    checked={style === 'minimal'}
                    onChange={() => setStyle('minimal')}
                    className="w-4 h-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'styleMinimalSidebar')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="style"
                    checked={style === 'numbered'}
                    onChange={() => setStyle('numbered')}
                    className="w-4 h-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'styleNumbered')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'preview')} ({entries.length} {t(uiLanguage, 'headingsFound')})
              </label>
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                className={`
                  flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors
                  ${darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                `}
              >
                <RefreshCw className="w-4 h-4" />
                {t(uiLanguage, 'refresh')}
              </button>
            </div>
            <div
              className={`
                p-4 rounded-lg border max-h-60 overflow-y-auto
                ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}
              `}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>

          {/* Info */}
          <div className={`
            p-4 rounded-lg text-sm
            ${darkMode ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'}
            border
          `}>
            <p className={darkMode ? 'text-indigo-200' : 'text-indigo-900'}>
              💡 {t(uiLanguage, 'tocTip')}
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
            disabled={levels.length === 0}
            className={`
              px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2
              ${levels.length === 0
                ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
              }
            `}
          >
            <Check className="w-5 h-5" />
            {existingToc ? t(uiLanguage, 'updateTOC') : t(uiLanguage, 'insertTOC')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableOfContentsDialog;
