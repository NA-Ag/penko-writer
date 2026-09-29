import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Pencil, RefreshCw, Plus, Eraser, Settings2 } from 'lucide-react';
import type { ParagraphStyle } from '../../types';
import { useApp } from '../../AppContext';
import { t, type LanguageCode } from '../../utils/translations';
import { BUILTIN_NAME_KEYS, findStyle, fontStack, isStyleEditable, resolveStyles, upsertStyle } from '../../utils/paragraphStyles';
import { absorbDirectFormatting, applyParagraphStyle, captureStyleFromSelection, clearDirectFormatting, currentStyleId } from '../../editor/extensions/paragraphStyles';
import { keepSelection, Popover } from './primitives';

/** Display name of a style (built-ins are translated). */
export const styleLabel = (style: ParagraphStyle, uiLanguage: LanguageCode) => (BUILTIN_NAME_KEYS[style.id] ? t(uiLanguage, BUILTIN_NAME_KEYS[style.id]) : style.name);

/** Inline preview of a style in lists (sizes are capped so the menu stays compact). */
export const stylePreviewCss = (style: ParagraphStyle, maxPx = 20): React.CSSProperties => ({
  fontFamily: style.fontFamily ? fontStack(style.fontFamily) : undefined,
  fontSize: `${Math.min(maxPx, Math.max(11, ((style.fontSize || 11) * 4) / 3))}px`,
  fontWeight: style.bold ? (style.kind === 'heading' && (style.level || 1) > 2 ? 600 : 700) : 400,
  fontStyle: style.italic ? 'italic' : 'normal',
  textDecoration: style.underline ? 'underline' : undefined,
  color: style.color || undefined,
  lineHeight: 1.25,
});

const menuItemClass = (darkMode: boolean) => `w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`;

/**
 * Paragraph-style dropdown of the Home tab: previews every named style of the
 * document and offers modify / update-to-match / new / clear formatting.
 */
export const StyleGallery: React.FC<{ darkMode: boolean; uiLanguage: LanguageCode; selectClass: string }> = ({ darkMode, uiLanguage, selectClass }) => {
  const { editor, currentDoc, updateCurrentDoc, setStylesDialog, toast } = useApp();
  const [open, setOpen] = useState(false);
  // Open upwards when the ribbon button sits too low for the menu
  const [dropUp, setDropUp] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const stored = currentDoc?.styles;
  const styles = useMemo(() => resolveStyles(stored), [stored]);

  // The ribbon re-renders on every editor transaction, so this follows the cursor.
  const currentId = editor && !editor.isDestroyed ? currentStyleId(editor.state) : 'normal';
  const current = findStyle(styles, currentId) || styles[0];
  const currentLabel = findStyle(styles, currentId) ? styleLabel(current, uiLanguage) : currentId;
  const editable = isStyleEditable(current.id) && !!findStyle(styles, currentId);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const apply = (style: ParagraphStyle) => {
    if (editor) applyParagraphStyle(editor, style);
  };

  const updateToMatch = () => {
    if (!editor || editor.isDestroyed || !editable) return;
    const updated = captureStyleFromSelection(editor.state, current);
    updateCurrentDoc(d => ({ styles: upsertStyle(d.styles, updated) }));
    absorbDirectFormatting(editor);
    toast.success(t(uiLanguage, 'styleUpdated').replace('{name}', currentLabel));
  };

  return (
    <Popover open={open} onClose={() => setOpen(false)} className={`relative w-full ${open ? 'z-50' : ''}`}>
      <button
        onMouseDown={keepSelection}
        ref={buttonRef}
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          setDropUp(!!rect && window.innerHeight - rect.bottom < 420 && rect.top > window.innerHeight - rect.bottom);
          setOpen(!open);
        }}
        aria-label={t(uiLanguage, 'paragraphStyle')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${t(uiLanguage, 'paragraphStyle')}: ${currentLabel}`}
        data-style-current={currentId}
        className={`text-xs px-1.5 py-1.5 rounded border outline-none w-full flex items-center justify-between gap-1 ${selectClass}`}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={12} className="opacity-60 shrink-0" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t(uiLanguage, 'paragraphStyle')}
          className={`absolute ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} right-0 w-52 max-w-[calc(100vw-2rem)] border rounded-lg shadow-xl z-50 p-1 ${darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
        >
          <div className="max-h-60 overflow-y-auto">
            {styles.map(style => (
              <button
                key={style.id}
                role="menuitemradio"
                aria-checked={style.id === currentId}
                data-style-option={style.id}
                onMouseDown={keepSelection}
                onClick={run(() => apply(style))}
                className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between gap-2 ${style.id === currentId ? (darkMode ? 'bg-blue-500/20' : 'bg-blue-50') : ''} ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              >
                <span className="truncate" style={stylePreviewCss(style, 18)}>{styleLabel(style, uiLanguage)}</span>
                {style.id === currentId && <Check size={12} className="opacity-70 shrink-0" />}
              </button>
            ))}
          </div>
          <div className={`my-1 border-t ${darkMode ? 'border-zinc-800' : 'border-gray-200'}`} />
          <button role="menuitem" onMouseDown={keepSelection} disabled={!editable} onClick={run(() => setStylesDialog({ mode: 'modify', styleId: current.id }))} className={menuItemClass(darkMode)}>
            <Pencil size={13} className="opacity-70 shrink-0" />
            <span className="truncate">{t(uiLanguage, 'modifyStyle')}</span>
          </button>
          <button role="menuitem" onMouseDown={keepSelection} disabled={!editable} onClick={run(updateToMatch)} className={menuItemClass(darkMode)}>
            <RefreshCw size={13} className="opacity-70 shrink-0" />
            <span className="truncate" title={t(uiLanguage, 'updateStyleToMatch').replace('{name}', currentLabel)}>{t(uiLanguage, 'updateStyleToMatch').replace('{name}', currentLabel)}</span>
          </button>
          <button role="menuitem" onMouseDown={keepSelection} onClick={run(() => setStylesDialog({ mode: 'new' }))} className={menuItemClass(darkMode)}>
            <Plus size={13} className="opacity-70 shrink-0" />
            <span className="truncate">{t(uiLanguage, 'newStyle')}</span>
          </button>
          <button role="menuitem" onMouseDown={keepSelection} onClick={run(() => editor && clearDirectFormatting(editor))} className={menuItemClass(darkMode)}>
            <Eraser size={13} className="opacity-70 shrink-0" />
            <span className="truncate">{t(uiLanguage, 'clearFormatting')}</span>
          </button>
          <button role="menuitem" onMouseDown={keepSelection} onClick={run(() => setStylesDialog({ mode: 'manage' }))} className={menuItemClass(darkMode)}>
            <Settings2 size={13} className="opacity-70 shrink-0" />
            <span className="truncate">{t(uiLanguage, 'manageStyles')}</span>
          </button>
        </div>
      )}
    </Popover>
  );
};
