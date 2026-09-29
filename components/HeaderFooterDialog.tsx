import React, { useState, useEffect } from 'react';
import { X, AlignLeft, AlignCenter, AlignRight, Hash } from 'lucide-react';
import { useEditor, EditorContent, Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { useFocusTrap } from '../utils/hooks';
import { useApp } from '../AppContext';
import { t } from '../utils/translations';
import { sanitizeHtml } from '../editor/sanitize';

type PageNumberPosition = 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right';

interface HeaderFooterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  headerContent: string;
  footerContent: string;
  showPageNumbers: boolean;
  pageNumberPosition: PageNumberPosition;
  differentFirstPage?: boolean;
  pageNumberFormat?: PageNumberFormat;
  /** Editing a later section (index ≥ 1): shows "same as previous" and "restart numbering". */
  section?: SectionEditState;
  onSave: (data: {
    header: string;
    footer: string;
    showPageNumbers: boolean;
    pageNumberPosition: PageNumberPosition;
    differentFirstPage: boolean;
    pageNumberFormat: PageNumberFormat;
    section?: SectionEditState;
  }) => void;
}

export interface SectionEditState {
  index: number;
  linkHeader: boolean;
  linkFooter: boolean;
  restartNumbering: boolean;
  startAt: number;
}

type PageNumberFormat = 'decimal' | 'roman' | 'page-of';

const POSITIONS: PageNumberPosition[] = ['header-left', 'header-center', 'header-right', 'footer-left', 'footer-center', 'footer-right'];

/** Small rich-text editor for the header / footer (bold, italic, underline, alignment). */
const MiniEditor: React.FC<{
  initialHtml: string;
  onChange: (html: string) => void;
  onReady: (editor: TiptapEditor | null) => void;
  className: string;
  ariaLabel: string;
  id: string;
}> = ({ initialHtml, onChange, onReady, className, ariaLabel, id }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        code: false,
        link: false,
      }),
      TextAlign.configure({ types: ['paragraph'] }),
    ],
    // Initialised once per mount; the editor owns its content afterwards (no caret jumps).
    content: sanitizeHtml(initialHtml || ''),
    editorProps: {
      attributes: { class: 'outline-none min-h-[86px]', 'aria-label': ariaLabel, 'aria-multiline': 'true', role: 'textbox', id },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
  });

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return <EditorContent editor={editor} className={className} style={{ fontSize: '11pt', lineHeight: '1.5' }} />;
};

export const HeaderFooterDialog: React.FC<HeaderFooterDialogProps> = ({
  isOpen,
  onClose,
  darkMode,
  headerContent,
  footerContent,
  showPageNumbers,
  pageNumberPosition,
  differentFirstPage = false,
  pageNumberFormat = 'decimal',
  section,
  onSave
}) => {
  const { uiLanguage } = useApp();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [header, setHeader] = useState(headerContent);
  const [footer, setFooter] = useState(footerContent);
  const [showNumbers, setShowNumbers] = useState(showPageNumbers);
  const [numberPosition, setNumberPosition] = useState(pageNumberPosition);
  const [firstPageDifferent, setFirstPageDifferent] = useState(differentFirstPage);
  const [numberFormat, setNumberFormat] = useState<PageNumberFormat>(pageNumberFormat);
  const [sectionState, setSectionState] = useState<SectionEditState | undefined>(section);
  const [activeTab, setActiveTab] = useState<'header' | 'footer'>('header');
  const [activeEditor, setActiveEditor] = useState<TiptapEditor | null>(null);
  // Bumped on every open so the tab editors re-initialise from the saved document
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setHeader(headerContent);
      setFooter(footerContent);
      setShowNumbers(showPageNumbers);
      setNumberPosition(pageNumberPosition);
      setFirstPageDifferent(differentFirstPage);
      setNumberFormat(pageNumberFormat);
      setSectionState(section);
      setActiveTab('header');
      setSession(s => s + 1);
    }
    // Only when the dialog opens — not while the user is editing
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

  const handleSave = () => {
    // Both values live in state, so saving from either tab keeps the other one.
    onSave({
      header,
      footer,
      showPageNumbers: showNumbers,
      pageNumberPosition: numberPosition,
      differentFirstPage: firstPageDifferent,
      pageNumberFormat: numberFormat,
      section: sectionState,
    });
    onClose();
  };

  const executeCommand = (command: 'bold' | 'italic' | 'underline' | 'left' | 'center' | 'right') => {
    const ed = activeEditor;
    if (!ed || ed.isDestroyed) return;
    const chain = ed.chain().focus();
    if (command === 'bold') chain.toggleBold().run();
    else if (command === 'italic') chain.toggleItalic().run();
    else if (command === 'underline') chain.toggleUnderline().run();
    else chain.setTextAlign(command).run();
  };

  const insertPageNumber = () => {
    const ed = activeEditor;
    if (!ed || ed.isDestroyed) return;
    ed.chain().focus().insertContent({ type: 'text', text: '{PAGE}' }).run();
  };

  const positionLabels: Record<PageNumberPosition, string> = {
    'header-left': t(uiLanguage, 'posHeaderLeft'),
    'header-center': t(uiLanguage, 'posHeaderCenter'),
    'header-right': t(uiLanguage, 'posHeaderRight'),
    'footer-left': t(uiLanguage, 'posFooterLeft'),
    'footer-center': t(uiLanguage, 'posFooterCenter'),
    'footer-right': t(uiLanguage, 'posFooterRight'),
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="header-footer-dialog-title">
      <div ref={dialogRef} className={`w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <h2 id="header-footer-dialog-title" className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {t(uiLanguage, 'headerFooter')}
            {sectionState && sectionState.index > 0 && (
              <span className="ml-2 text-sm font-medium opacity-60">{t(uiLanguage, 'sectionN').replace('{n}', String(sectionState.index + 1))}</span>
            )}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
            aria-label={t(uiLanguage, 'close')}
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
              aria-pressed={activeTab === 'header'}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'header'
                  ? 'bg-blue-600 text-white'
                  : (darkMode ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-600')
              }`}
            >
              {t(uiLanguage, 'header')}
            </button>
            <button
              onClick={() => setActiveTab('footer')}
              aria-pressed={activeTab === 'footer'}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'footer'
                  ? 'bg-blue-600 text-white'
                  : (darkMode ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-600')
              }`}
            >
              {t(uiLanguage, 'footer')}
            </button>
          </div>

          {/* Formatting Toolbar */}
          <div className={`flex items-center space-x-2 p-3 rounded-lg mb-4 ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('bold')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title={t(uiLanguage, 'bold')}
              aria-label={t(uiLanguage, 'bold')}
            >
              <strong>B</strong>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('italic')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title={t(uiLanguage, 'italic')}
              aria-label={t(uiLanguage, 'italic')}
            >
              <em>I</em>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('underline')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title={t(uiLanguage, 'underline')}
              aria-label={t(uiLanguage, 'underline')}
            >
              <u>U</u>
            </button>
            <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('left')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title={t(uiLanguage, 'alignLeft')}
              aria-label={t(uiLanguage, 'alignLeft')}
            >
              <AlignLeft size={16} />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('center')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title={t(uiLanguage, 'alignCenter')}
              aria-label={t(uiLanguage, 'alignCenter')}
            >
              <AlignCenter size={16} />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand('right')}
              className={`p-2 rounded ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              title={t(uiLanguage, 'alignRight')}
              aria-label={t(uiLanguage, 'alignRight')}
            >
              <AlignRight size={16} />
            </button>
            <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertPageNumber}
              className={`px-3 py-2 rounded flex items-center space-x-2 ${darkMode ? 'hover:bg-white/10 bg-blue-600/20 text-blue-400' : 'hover:bg-gray-200 bg-blue-50 text-blue-600'}`}
              title={t(uiLanguage, 'insertPageNumber')}
            >
              <Hash size={16} />
              <span className="text-sm font-medium">{t(uiLanguage, 'pageNumberShort')}</span>
            </button>
          </div>

          {/* Header Editor */}
          {activeTab === 'header' && (
            <div>
              <label htmlFor="hf-header-editor" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'headerContent')}
              </label>
              {sectionState && sectionState.index > 0 && (
                <label className="flex items-center gap-2 mb-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600"
                    checked={sectionState.linkHeader}
                    onChange={e => setSectionState(st => (st ? { ...st, linkHeader: e.target.checked } : st))}
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'sameAsPreviousSection')}</span>
                </label>
              )}
              {sectionState && sectionState.index > 0 && sectionState.linkHeader ? (
                <div className={`min-h-[120px] p-4 rounded-lg border-2 border-dashed text-sm opacity-70 ${darkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                  {t(uiLanguage, 'linkedToPreviousHint')}
                </div>
              ) : (
              <MiniEditor
                key={`header-${session}`}
                id="hf-header-editor"
                ariaLabel={t(uiLanguage, 'headerContent')}
                initialHtml={header}
                onChange={setHeader}
                onReady={setActiveEditor}
                className={`min-h-[120px] p-4 rounded-lg border-2 outline-none transition-colors ${
                  darkMode
                    ? 'bg-[#0f0f0f] border-gray-700 text-gray-200 focus-within:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 focus-within:border-blue-500'
                }`}
              />
              )}
            </div>
          )}

          {/* Footer Editor */}
          {activeTab === 'footer' && (
            <div>
              <label htmlFor="hf-footer-editor" className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t(uiLanguage, 'footerContent')}
              </label>
              {sectionState && sectionState.index > 0 && (
                <label className="flex items-center gap-2 mb-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600"
                    checked={sectionState.linkFooter}
                    onChange={e => setSectionState(st => (st ? { ...st, linkFooter: e.target.checked } : st))}
                  />
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{t(uiLanguage, 'sameAsPreviousSection')}</span>
                </label>
              )}
              {sectionState && sectionState.index > 0 && sectionState.linkFooter ? (
                <div className={`min-h-[120px] p-4 rounded-lg border-2 border-dashed text-sm opacity-70 ${darkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                  {t(uiLanguage, 'linkedToPreviousHint')}
                </div>
              ) : (
              <MiniEditor
                key={`footer-${session}`}
                id="hf-footer-editor"
                ariaLabel={t(uiLanguage, 'footerContent')}
                initialHtml={footer}
                onChange={setFooter}
                onReady={setActiveEditor}
                className={`min-h-[120px] p-4 rounded-lg border-2 outline-none transition-colors ${
                  darkMode
                    ? 'bg-[#0f0f0f] border-gray-700 text-gray-200 focus-within:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 focus-within:border-blue-500'
                }`}
              />
              )}
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
                {t(uiLanguage, 'showPageNumbers')}
              </span>
            </label>

            {showNumbers && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {POSITIONS.map(position => (
                  <button
                    key={position}
                    onClick={() => setNumberPosition(position)}
                    className={`p-3 rounded-lg text-sm transition-all ${
                      numberPosition === position
                        ? 'bg-blue-600 text-white'
                        : (darkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-white text-gray-700 hover:bg-gray-100')
                    }`}
                    aria-pressed={numberPosition === position}
                  >
                    {positionLabels[position]}
                  </button>
                ))}
              </div>
            )}

            {showNumbers && (
              <label className="mt-4 flex items-center justify-between gap-3">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{t(uiLanguage, 'pageNumberFormat')}</span>
                <select
                  value={numberFormat}
                  onChange={e => setNumberFormat(e.target.value as PageNumberFormat)}
                  className={`text-sm px-2 py-1.5 rounded border outline-none ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
                >
                  <option value="decimal">1, 2, 3</option>
                  <option value="roman">i, ii, iii</option>
                  <option value="page-of">{t(uiLanguage, 'pageXofY').replace('{PAGE}', '1').replace('{PAGES}', 'N')}</option>
                </select>
              </label>
            )}

            <label className="mt-4 flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={firstPageDifferent}
                onChange={e => setFirstPageDifferent(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{t(uiLanguage, 'differentFirstPage')}</span>
            </label>
            {sectionState && sectionState.index > 0 && (
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sectionState.restartNumbering}
                    onChange={e => setSectionState(st => (st ? { ...st, restartNumbering: e.target.checked } : st))}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{t(uiLanguage, 'restartNumberingAt')}</span>
                </label>
                <input
                  type="number"
                  min={0}
                  aria-label={t(uiLanguage, 'restartNumberingAt')}
                  disabled={!sectionState.restartNumbering}
                  value={sectionState.startAt}
                  onChange={e => setSectionState(st => (st ? { ...st, startAt: Math.max(0, parseInt(e.target.value, 10) || 0) } : st))}
                  className={`w-20 text-sm px-2 py-1.5 rounded border outline-none disabled:opacity-40 ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
                />
              </div>
            )}
            <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{t(uiLanguage, 'headerFooterPlaceholdersHint')}</p>
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
            {t(uiLanguage, 'cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            {t(uiLanguage, 'save')}
          </button>
        </div>
      </div>
    </div>
  );
};
