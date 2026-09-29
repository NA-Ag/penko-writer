import React, { useEffect, useMemo, useState } from 'react';
import { X, Type, Pencil, RotateCcw, Trash2, Plus, Save } from 'lucide-react';
import type { ParagraphStyle, StyleAlign } from '../types';
import { useApp } from '../AppContext';
import { useFocusTrap } from '../utils/hooks';
import { t, type LanguageCode } from '../utils/translations';
import { FONTS } from '../constants';
import {
  builtInStyle, findStyle, isBuiltInStyle, isDefaultStyle, isStyleEditable, newStyleId, removeStyle, resolveStyles, saveDefaultStyles, upsertStyle,
  type StylesDialogRequest,
} from '../utils/paragraphStyles';
import { absorbDirectFormatting, applyParagraphStyle, captureStyleFromSelection, currentStyleId } from '../editor/extensions/paragraphStyles';
import { styleLabel, stylePreviewCss } from './ribbon/StyleGallery';

const ALIGNS: { value: StyleAlign; key: string }[] = [
  { value: 'left', key: 'alignLeft' },
  { value: 'center', key: 'alignCenter' },
  { value: 'right', key: 'alignRight' },
  { value: 'justify', key: 'justify' },
];

type View = { mode: 'list' } | { mode: 'edit'; draft: ParagraphStyle; isNew: boolean; fromList: boolean };

interface Props {
  request: StylesDialogRequest | null;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

/**
 * Manage the document's named paragraph styles: modify (with live preview),
 * create from the selection, reset built-ins, delete custom styles, and save
 * the set as the default for new documents.
 */
export const StylesDialog: React.FC<Props> = ({ request, onClose, darkMode, uiLanguage }) => {
  const isOpen = !!request;
  const { editor, currentDoc, updateCurrentDoc, toast } = useApp();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const styles = useMemo(() => resolveStyles(currentDoc?.styles), [currentDoc?.styles]);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [error, setError] = useState('');

  const newDraft = (): ParagraphStyle => {
    const base = (editor && !editor.isDestroyed && findStyle(styles, currentStyleId(editor.state))) || styles[0];
    const from = isStyleEditable(base.id) ? base : styles[0];
    const captured = editor && !editor.isDestroyed ? captureStyleFromSelection(editor.state, from) : { ...from };
    const heading = from.kind === 'heading';
    return { ...captured, id: '', name: '', kind: heading ? 'heading' : 'paragraph', ...(heading ? { level: from.level } : { level: undefined }) };
  };

  // (Re)initialise whenever the dialog is opened with a new request
  useEffect(() => {
    setError('');
    if (!request) return;
    if (request.mode === 'manage') setView({ mode: 'list' });
    else if (request.mode === 'new') setView({ mode: 'edit', draft: newDraft(), isNew: true, fromList: false });
    else {
      const style = findStyle(styles, request.styleId);
      setView(style ? { mode: 'edit', draft: { ...style }, isNew: false, fromList: false } : { mode: 'list' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

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

  if (!isOpen) return null;

  const setStored = (fn: (stored: ParagraphStyle[] | undefined) => ParagraphStyle[]) => updateCurrentDoc(d => ({ styles: fn(d.styles) }));
  const backOrClose = (fromList: boolean) => (fromList ? setView({ mode: 'list' }) : onClose());

  const save = () => {
    if (view.mode !== 'edit') return;
    const { draft, isNew, fromList } = view;
    const name = draft.name.trim();
    const builtIn = !isNew && isBuiltInStyle(draft.id);
    if (!builtIn) {
      if (!name) return setError(t(uiLanguage, 'styleNameRequired'));
      const taken = styles.some(s => s.id !== draft.id && styleLabel(s, uiLanguage).toLowerCase() === name.toLowerCase());
      if (taken) return setError(t(uiLanguage, 'styleNameTaken'));
    }
    const style: ParagraphStyle = { ...draft, name: builtIn ? draft.name : name, id: isNew ? newStyleId(name, styles) : draft.id };
    setStored(stored => upsertStyle(stored, style));
    if (isNew && editor && !editor.isDestroyed) {
      applyParagraphStyle(editor, style);
      absorbDirectFormatting(editor);
    }
    toast.success(t(uiLanguage, isNew ? 'styleCreated' : 'styleUpdated').replace('{name}', styleLabel(style, uiLanguage)));
    backOrClose(fromList);
  };

  const resetStyle = (style: ParagraphStyle) => {
    setStored(stored => removeStyle(stored, style.id));
    toast.success(t(uiLanguage, 'styleUpdated').replace('{name}', styleLabel(style, uiLanguage)));
  };

  const deleteStyle = (style: ParagraphStyle) => {
    setStored(stored => removeStyle(stored, style.id));
    // its paragraphs fall back to Normal / their heading level
    if (editor && !editor.isDestroyed) {
      const tr = editor.state.tr;
      editor.state.doc.descendants((node, pos) => {
        if (node.attrs.styleId === style.id) tr.setNodeMarkup(pos, undefined, { ...node.attrs, styleId: null });
      });
      if (tr.docChanged) editor.view.dispatch(tr);
    }
    toast.success(t(uiLanguage, 'styleDeleted').replace('{name}', style.name));
  };

  const saveAsDefault = () => {
    saveDefaultStyles(currentDoc?.styles);
    toast.success(t(uiLanguage, 'styleDefaultsSaved'));
  };

  const resetAll = () => {
    setStored(stored => (stored || []).filter(s => s && !isBuiltInStyle(s.id)));
    toast.success(t(uiLanguage, 'stylesReset'));
  };

  const labelCls = `block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;
  const inputCls = `w-full text-sm px-2 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`;
  const secondaryBtn = `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`;
  const iconBtn = `p-1.5 rounded-md transition-colors ${darkMode ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`;

  const renderList = () => (
    <>
      <ul className={`divide-y rounded-lg border ${darkMode ? 'divide-zinc-800 border-zinc-800' : 'divide-gray-100 border-gray-200'}`}>
        {styles.map(style => {
          const builtIn = isBuiltInStyle(style.id);
          const modified = builtIn && !isDefaultStyle(style);
          return (
            <li key={style.id} className="flex items-center gap-2 px-3 py-2" data-style-row={style.id}>
              <span className="flex-1 min-w-0 truncate" style={stylePreviewCss(style, 18)}>{styleLabel(style, uiLanguage)}</span>
              {modified && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">{t(uiLanguage, 'styleModified')}</span>}
              {!builtIn && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">{t(uiLanguage, 'styleCustom')}</span>}
              {isStyleEditable(style.id) && (
                <button className={iconBtn} title={t(uiLanguage, 'modifyStyle')} aria-label={`${t(uiLanguage, 'modifyStyle')} ${styleLabel(style, uiLanguage)}`} onClick={() => setView({ mode: 'edit', draft: { ...style }, isNew: false, fromList: true })}>
                  <Pencil size={14} />
                </button>
              )}
              {modified && (
                <button className={iconBtn} title={t(uiLanguage, 'styleResetBuiltIn')} aria-label={`${t(uiLanguage, 'styleResetBuiltIn')} ${styleLabel(style, uiLanguage)}`} onClick={() => resetStyle(style)}>
                  <RotateCcw size={14} />
                </button>
              )}
              {!builtIn && (
                <button className={`${iconBtn} hover:text-red-500`} title={t(uiLanguage, 'delete')} aria-label={`${t(uiLanguage, 'delete')} ${style.name}`} onClick={() => deleteStyle(style)}>
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className={`text-xs mt-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t(uiLanguage, 'styleShortcutsHint')}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        <button className={secondaryBtn} onClick={() => setView({ mode: 'edit', draft: newDraft(), isNew: true, fromList: true })}>
          <span className="inline-flex items-center gap-1.5"><Plus size={14} />{t(uiLanguage, 'newStyle')}</span>
        </button>
        <button className={secondaryBtn} onClick={saveAsDefault}>
          <span className="inline-flex items-center gap-1.5"><Save size={14} />{t(uiLanguage, 'styleSaveAsDefault')}</span>
        </button>
        <button className={secondaryBtn} onClick={resetAll}>
          <span className="inline-flex items-center gap-1.5"><RotateCcw size={14} />{t(uiLanguage, 'resetAllStyles')}</span>
        </button>
      </div>
    </>
  );

  const renderEdit = (draft: ParagraphStyle, isNew: boolean, fromList: boolean) => {
    const set = (patch: Partial<ParagraphStyle>) => {
      setError('');
      setView({ mode: 'edit', draft: { ...draft, ...patch }, isNew, fromList });
    };
    const numberInput = (key: 'fontSize' | 'lineHeight' | 'spaceBefore' | 'spaceAfter' | 'indent', label: string, step: number, min: number, max: number) => (
      <div>
        <label className={labelCls} htmlFor={`style-${key}`}>{label}</label>
        <input
          id={`style-${key}`}
          type="number"
          step={step}
          min={min}
          max={max}
          className={inputCls}
          value={draft[key] ?? ''}
          onChange={e => {
            const n = parseFloat(e.target.value);
            set({ [key]: Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null } as Partial<ParagraphStyle>);
          }}
        />
      </div>
    );
    const builtIn = !isNew && isBuiltInStyle(draft.id);
    const fontOptions = draft.fontFamily && !FONTS.some(f => f.toLowerCase() === draft.fontFamily!.toLowerCase()) ? [draft.fontFamily, ...FONTS] : FONTS;
    const toggle = (key: 'bold' | 'italic' | 'underline', label: string) => (
      <label className={`flex items-center gap-2 text-sm cursor-pointer ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        <input type="checkbox" checked={!!draft[key]} onChange={e => set({ [key]: e.target.checked } as Partial<ParagraphStyle>)} className="w-4 h-4 rounded accent-blue-600" />
        {label}
      </label>
    );
    const kindValue = draft.kind === 'heading' ? `h${draft.level || 1}` : 'p';
    return (
      <form
        // built-in values such as 14.74pt aren't on the spin step
        noValidate
        onSubmit={e => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="style-name">{t(uiLanguage, 'styleName')}</label>
            <input
              id="style-name"
              className={inputCls}
              value={builtIn ? styleLabel(draft, uiLanguage) : draft.name}
              readOnly={builtIn}
              disabled={builtIn}
              maxLength={60}
              data-autofocus={isNew ? true : undefined}
              onChange={e => set({ name: e.target.value })}
              aria-invalid={!!error}
            />
            {error && <p role="alert" className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          {isNew && (
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="style-kind">{t(uiLanguage, 'styleType')}</label>
              <select
                id="style-kind"
                className={inputCls}
                value={kindValue}
                onChange={e => {
                  const v = e.target.value;
                  set(v === 'p' ? { kind: 'paragraph', level: undefined } : { kind: 'heading', level: Number(v.slice(1)) });
                }}
              >
                <option value="p">{t(uiLanguage, 'styleTypeParagraph')}</option>
                {[1, 2, 3, 4, 5, 6].map(l => (
                  <option key={l} value={`h${l}`}>{t(uiLanguage, `heading${l}`)}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls} htmlFor="style-font">{t(uiLanguage, 'fontFamily')}</label>
            <select id="style-font" className={inputCls} value={draft.fontFamily || 'Calibri'} onChange={e => set({ fontFamily: e.target.value })}>
              {!fontOptions.some(f => f.toLowerCase() === 'calibri') && <option value="Calibri">Calibri</option>}
              {fontOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {numberInput('fontSize', t(uiLanguage, 'fontSize'), 0.5, 1, 400)}
          <div className="sm:col-span-2 flex flex-wrap gap-4">
            {toggle('bold', t(uiLanguage, 'bold'))}
            {toggle('italic', t(uiLanguage, 'italic'))}
            {toggle('underline', t(uiLanguage, 'underline'))}
          </div>
          <div>
            <label className={labelCls} htmlFor="style-color">{t(uiLanguage, 'textColor')}</label>
            <div className="flex items-center gap-2">
              <input
                id="style-color"
                type="color"
                className={`h-9 w-12 rounded border cursor-pointer ${darkMode ? 'border-zinc-700 bg-zinc-800' : 'border-gray-300 bg-white'}`}
                value={draft.color && /^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : darkMode ? '#e5e7eb' : '#000000'}
                onChange={e => set({ color: e.target.value })}
              />
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <input type="checkbox" checked={!draft.color} onChange={e => set({ color: e.target.checked ? null : '#000000' })} className="w-4 h-4 rounded accent-blue-600" />
                {t(uiLanguage, 'styleColorAuto')}
              </label>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="style-align">{t(uiLanguage, 'styleAlignment')}</label>
            <select id="style-align" className={inputCls} value={draft.align || 'left'} onChange={e => set({ align: e.target.value as StyleAlign })}>
              {ALIGNS.map(a => <option key={a.value} value={a.value}>{t(uiLanguage, a.key)}</option>)}
            </select>
          </div>
          {numberInput('lineHeight', t(uiLanguage, 'lineSpacing'), 0.05, 0.5, 5)}
          {numberInput('indent', t(uiLanguage, 'styleIndent'), 1, 0, 400)}
          {numberInput('spaceBefore', t(uiLanguage, 'styleSpaceBefore'), 1, 0, 400)}
          {numberInput('spaceAfter', t(uiLanguage, 'styleSpaceAfter'), 1, 0, 400)}
        </div>

        <div className={`mt-4 p-3 rounded-lg border overflow-hidden ${darkMode ? 'bg-zinc-900 border-zinc-800 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t(uiLanguage, 'preview')}</p>
          <p
            data-testid="style-preview"
            style={{
              ...stylePreviewCss(draft, 40),
              textAlign: draft.align || 'left',
              lineHeight: draft.lineHeight || 1.15,
              marginLeft: `${draft.indent || 0}pt`,
              overflowWrap: 'anywhere',
            }}
          >
            {t(uiLanguage, 'stylePreviewText')}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-5">
          <div>
            {builtIn && !isDefaultStyle(draft) && (
              <button type="button" className={secondaryBtn} onClick={() => set({ ...builtInStyle(draft.id)! })}>
                <span className="inline-flex items-center gap-1.5"><RotateCcw size={14} />{t(uiLanguage, 'styleResetBuiltIn')}</span>
              </button>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <button type="button" className={secondaryBtn} onClick={() => backOrClose(fromList)}>{t(uiLanguage, 'cancel')}</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">{t(uiLanguage, 'save')}</button>
          </div>
        </div>
      </form>
    );
  };

  const title =
    view.mode === 'edit'
      ? view.isNew
        ? t(uiLanguage, 'newStyle').replace(/…$/, '')
        : `${t(uiLanguage, 'modifyStyle').replace(/…$/, '')}: ${styleLabel(view.draft, uiLanguage)}`
      : t(uiLanguage, 'stylesTitle');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="styles-dialog-title">
      <div ref={dialogRef} className={`max-w-xl w-full rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-[#1e1e1e] text-white' : 'bg-white text-gray-900'}`}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white relative">
          <button onClick={onClose} aria-label={t(uiLanguage, 'close')} className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shrink-0">
              <Type className="w-5 h-5" />
            </div>
            <h2 id="styles-dialog-title" className="text-lg font-bold truncate">{title}</h2>
          </div>
        </div>
        <div className="p-5 max-h-[75vh] overflow-y-auto">{view.mode === 'edit' ? renderEdit(view.draft, view.isNew, view.fromList) : renderList()}</div>
      </div>
    </div>
  );
};

export default StylesDialog;
