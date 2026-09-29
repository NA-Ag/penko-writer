import React, { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Image as ImageIcon,
  Link as LinkIcon, MoreVertical, X, Type, Table
} from 'lucide-react';
import { COLORS } from '../constants';
import { useApp, useSelectionContext } from '../AppContext';
import { LanguageCode, t } from '../utils/translations';
import type { Editor as TiptapEditor } from '@tiptap/core';

interface MobileToolbarProps {
  onCommand: (cmd: string, val?: string | null) => void;
  darkMode: boolean;
  onShowLinkDialog: () => void;
  onTableAction: (action: string, value?: any) => void;
  uiLanguage: LanguageCode;
}

/**
 * Bullet / numbered list state of the selection. Not part of the shared
 * selection context, so follow the editor directly (re-renders only when it
 * changes).
 */
const useListState = (editor: TiptapEditor | null) => {
  const [state, setState] = useState({ bullet: false, ordered: false });
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      if (editor.isDestroyed) return;
      const bullet = editor.isActive('bulletList');
      const ordered = editor.isActive('orderedList');
      setState(prev => (prev.bullet === bullet && prev.ordered === ordered ? prev : { bullet, ordered }));
    };
    update();
    editor.on('transaction', update);
    return () => {
      editor.off('transaction', update);
    };
  }, [editor]);
  return state;
};

/** Keeps the editor focused (and the keyboard open) when a button is tapped. */
const keepFocus = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault();

const MobileToolbar: React.FC<MobileToolbarProps> = ({
  onCommand,
  darkMode,
  onShowLinkDialog,
  onTableAction,
  uiLanguage,
}) => {
  const [showMore, setShowMore] = useState(false);
  const { editor, handleInsertImageFiles } = useApp();
  const { selectionContext } = useSelectionContext();
  const lists = useListState(editor);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Escape closes the sheet. The editor keeps focus while the sheet is open, so
  // listen on window, and ignore defaultPrevented: the editor's keymap handles
  // (and prevents) Escape, which is why useEscapeKey can't be used here.
  useEffect(() => {
    if (!showMore) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMore(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showMore]);

  const buttonClass = `
    p-3 rounded-lg active:bg-gray-200 dark:active:bg-gray-700
    transition-colors touch-manipulation
    ${darkMode ? 'text-gray-300' : 'text-gray-700'}
  `;
  const activeClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-600';

  const insertTable = () => {
    onTableAction('insert', { rows: 2, cols: 3, header: false });
    setShowMore(false);
  };

  const block = selectionContext.formatBlock || 'p';

  const btn = (cmd: string, label: string, icon: React.ReactNode, active?: boolean) => (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={() => onCommand(cmd)}
      className={`${buttonClass} ${active ? activeClass : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
    >
      {icon}
    </button>
  );

  return (
    <>
      {/* Main Toolbar - Sticky at bottom on mobile */}
      <div className={`
        sticky bottom-0 left-0 right-0 z-40
        border-t ${darkMode ? 'border-gray-700 bg-[#1e1e1e]' : 'border-gray-200 bg-white'}
        px-2 py-2 shadow-lg
      `}>
        <div className="flex items-center justify-around max-w-screen-lg mx-auto">
          {/* Undo/Redo */}
          {btn('undo', t(uiLanguage, 'undo'), <Undo className="w-5 h-5" />)}
          {btn('redo', t(uiLanguage, 'redo'), <Redo className="w-5 h-5" />)}

          {/* Divider */}
          <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* Text Formatting */}
          {btn('bold', t(uiLanguage, 'bold'), <Bold className="w-5 h-5" />, !!selectionContext.bold)}
          {btn('italic', t(uiLanguage, 'italic'), <Italic className="w-5 h-5" />, !!selectionContext.italic)}
          {btn('underline', t(uiLanguage, 'underline'), <Underline className="w-5 h-5" />, !!selectionContext.underline)}

          {/* Divider */}
          <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* Lists */}
          {btn('insertUnorderedList', t(uiLanguage, 'bulletList'), <List className="w-5 h-5" />, lists.bullet)}
          {btn('insertOrderedList', t(uiLanguage, 'numberedList'), <ListOrdered className="w-5 h-5" />, lists.ordered)}

          {/* Divider */}
          <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

          {/* More options */}
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => setShowMore(!showMore)}
            className={`${buttonClass} ${showMore ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
            title={t(uiLanguage, 'more')}
            aria-label={t(uiLanguage, 'more')}
            aria-expanded={showMore}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hidden image picker */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const files = e.target.files;
          if (files?.length) void handleInsertImageFiles(Array.from(files));
          e.target.value = '';
        }}
      />

      {/* Extended Toolbar (when More is clicked) */}
      {showMore && (
        <div
          className={`
          fixed inset-0 z-50 flex flex-col
          ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
        `}
          role="dialog"
          aria-modal="true"
          aria-label={t(uiLanguage, 'moreTools')}
        >
          {/* Header */}
          <div className={`
            flex items-center justify-between p-4 border-b
            ${darkMode ? 'border-gray-700' : 'border-gray-200'}
          `}>
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {t(uiLanguage, 'moreTools')}
            </h3>
            <button
              type="button"
              onClick={() => setShowMore(false)}
              className={buttonClass}
              aria-label={t(uiLanguage, 'close')}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6 max-w-screen-lg mx-auto">
              {/* Paragraph styles */}
              <Section title={t(uiLanguage, 'paragraphStyle')} darkMode={darkMode}>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    ['p', t(uiLanguage, 'normal')],
                    ['h1', t(uiLanguage, 'heading1')],
                    ['h2', t(uiLanguage, 'heading2')],
                    ['h3', t(uiLanguage, 'heading3')],
                  ] as const).map(([tag, label]) => (
                    <ToolButton
                      key={tag}
                      icon={<Type />}
                      label={label}
                      active={block === tag}
                      onClick={() => { onCommand('formatBlock', tag); setShowMore(false); }}
                      darkMode={darkMode}
                    />
                  ))}
                </div>
              </Section>

              {/* Alignment Section */}
              <Section title={t(uiLanguage, 'alignment')} darkMode={darkMode}>
                <div className="grid grid-cols-4 gap-2">
                  <ToolButton
                    icon={<AlignLeft />}
                    label={t(uiLanguage, 'left')}
                    active={selectionContext.align === 'left'}
                    onClick={() => { onCommand('justifyLeft'); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<AlignCenter />}
                    label={t(uiLanguage, 'center')}
                    active={selectionContext.align === 'center'}
                    onClick={() => { onCommand('justifyCenter'); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<AlignRight />}
                    label={t(uiLanguage, 'right')}
                    active={selectionContext.align === 'right'}
                    onClick={() => { onCommand('justifyRight'); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<AlignJustify />}
                    label={t(uiLanguage, 'justify')}
                    active={selectionContext.align === 'justify'}
                    onClick={() => { onCommand('justifyFull'); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                </div>
              </Section>

              {/* Insert Section */}
              <Section title={t(uiLanguage, 'tabInsert')} darkMode={darkMode}>
                <div className="grid grid-cols-3 gap-2">
                  <ToolButton
                    icon={<LinkIcon />}
                    label={t(uiLanguage, 'link')}
                    onClick={() => { onShowLinkDialog(); setShowMore(false); }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<ImageIcon />}
                    label={t(uiLanguage, 'image')}
                    onClick={() => {
                      imageInputRef.current?.click();
                      setShowMore(false);
                    }}
                    darkMode={darkMode}
                  />
                  <ToolButton
                    icon={<Table />}
                    label={t(uiLanguage, 'table')}
                    onClick={() => { insertTable(); }}
                    darkMode={darkMode}
                  />
                </div>
              </Section>

              {/* Colors Section */}
              <Section title={t(uiLanguage, 'textColor')} darkMode={darkMode}>
                <div className="grid grid-cols-8 gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => { onCommand('foreColor', color); setShowMore(false); }}
                      className="w-10 h-10 max-w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 active:scale-95 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                      aria-label={color}
                    />
                  ))}
                </div>
              </Section>

              {/* Highlight Section */}
              <Section title={t(uiLanguage, 'highlightColor')} darkMode={darkMode}>
                <div className="grid grid-cols-8 gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => { onCommand('hiliteColor', color); setShowMore(false); }}
                      className="w-10 h-10 max-w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 active:scale-95 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                      aria-label={color}
                    />
                  ))}
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Section component
const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  darkMode: boolean;
}> = ({ title, children, darkMode }) => (
  <div>
    <h4 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
      {title}
    </h4>
    {children}
  </div>
);

// Tool Button component
const ToolButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  darkMode: boolean;
  active?: boolean;
}> = ({ icon, label, onClick, darkMode, active }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active === undefined ? undefined : active}
    className={`
      flex flex-col items-center gap-2 p-4 rounded-xl
      active:scale-95 transition-transform
      ${active
        ? 'bg-blue-600 text-white'
        : darkMode
        ? 'bg-gray-800 hover:bg-gray-700 text-white'
        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
      }
    `}
  >
    <div className="w-6 h-6">{icon}</div>
    <span className="text-xs font-medium text-center leading-tight">{label}</span>
  </button>
);

export default MobileToolbar;
