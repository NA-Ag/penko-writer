import React, { useState } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List as ListIcon, ListOrdered, Undo, Redo, Type, Strikethrough, Subscript, Superscript,
  CaseSensitive, PaintBucket, Indent, Outdent, FileText, Search, Maximize, Paintbrush,
} from 'lucide-react';
import { FONTS, FONT_SIZES } from '../../constants';
import { t } from '../../utils/translations';
import { useApp } from '../../AppContext';
import { fontOptionsWith, sizeOptionsWith, lineSpacingFromStyle, LINE_SPACINGS } from '../../utils/ribbonHelpers';
import { ColorSwatches, keepSelection, Popover, RibbonBtn, RibbonGroup, RibbonIconBtn, RibbonToolBtn } from './primitives';
import type { RibbonProps } from './types';
import { StyleGallery } from './StyleGallery';

type HomeColor = 'text' | 'highlight' | 'shading';

const CASES = [
  { id: 'uppercase', key: 'caseUpper' },
  { id: 'lowercase', key: 'caseLower' },
  { id: 'capitalize', key: 'caseTitle' },
  { id: 'sentence', key: 'caseSentence' },
];

export const HomeTab: React.FC<RibbonProps> = ({
  onCommand, darkMode, uiLanguage, selectionContext, pasteAsPlainText, togglePasteAsPlainText, onFind, onShowStats, onToggleZenMode,
}) => {
  const { editor, copiedFormatting, isPaintingFormat, setIsPaintingFormat, startPaintFormat, toast } = useApp();
  const [colorPicker, setColorPicker] = useState<HomeColor | null>(null);
  const [showCasingDropdown, setShowCasingDropdown] = useState(false);

  const pickColor = (type: HomeColor, color: string) => {
    if (type === 'text') onCommand('foreColor', color);
    else if (type === 'highlight') onCommand('hiliteColor', color);
    else onCommand('paragraphBackground', color);
    setColorPicker(null);
  };
  const toggleColor = (type: HomeColor) => setColorPicker(colorPicker === type ? null : type);

  const handlePaintFormat = () => {
    if (isPaintingFormat) {
      setIsPaintingFormat(false);
    } else {
      startPaintFormat();
      toast.info(t(uiLanguage, 'formatCopied'));
    }
  };

  // Undo / redo availability (the ribbon re-renders on every selection/transaction update)
  let canUndo = true;
  let canRedo = true;
  // Line height of the block at the cursor (inline style), default 1.15
  let lineSpacingValue = '1.15';
  if (editor && !editor.isDestroyed) {
    try {
      canUndo = editor.can().undo();
      canRedo = editor.can().redo();
    } catch {
      /* history not available (e.g. collaboration) */
    }
    const $from = editor.state.selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      const v = lineSpacingFromStyle($from.node(d).attrs.style);
      if (v) {
        lineSpacingValue = v;
        break;
      }
    }
  }

  const { options: fontOptions, value: fontValue } = fontOptionsWith(FONTS, selectionContext.fontName || 'Arial');
  const currentSize = selectionContext.fontSize || '11';
  const sizeOptions = sizeOptionsWith(FONT_SIZES, currentSize);
  const selectClass = darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-850';
  const growShrinkClass = `p-1.5 rounded border ${darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-white' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`;

  return (
    <>
      <RibbonGroup label={t(uiLanguage, 'grpClipboard')} darkMode={darkMode}>
        <div className="flex space-x-2 w-full">
          <RibbonBtn icon={<Undo size={18} />} label={t(uiLanguage, 'undo')} onClick={() => onCommand('undo')} darkMode={darkMode} disabled={!canUndo} />
          <RibbonBtn icon={<Redo size={18} />} label={t(uiLanguage, 'redo')} onClick={() => onCommand('redo')} darkMode={darkMode} disabled={!canRedo} />
        </div>

        <button
          onMouseDown={keepSelection}
          onClick={handlePaintFormat}
          aria-pressed={isPaintingFormat}
          className={`flex items-center justify-between p-2 rounded-lg border w-full text-xs font-semibold transition-all mt-2
            ${isPaintingFormat
              ? 'bg-amber-500/10 text-amber-500 border-amber-500 font-bold'
              : (darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-white' : 'border-gray-250 hover:bg-gray-50 text-gray-700')
            }
          `}
          title={t(uiLanguage, 'paintFormatTip')}
        >
          <div className="flex items-center gap-2">
            <Paintbrush size={16} className={isPaintingFormat ? 'animate-pulse' : ''} />
            <span>{t(uiLanguage, 'paintFormat')}</span>
          </div>
          {isPaintingFormat && copiedFormatting && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        <div className="flex items-center space-x-2 bg-black/5 dark:bg-white/5 px-2 py-1.5 rounded-lg w-full mt-2 justify-center">
          <input type="checkbox" checked={pasteAsPlainText} onChange={togglePasteAsPlainText} className="w-3.5 h-3.5 cursor-pointer accent-blue-600" id="plain-paste-box" />
          <label htmlFor="plain-paste-box" className="text-[10px] opacity-80 cursor-pointer select-none">{t(uiLanguage, 'pastePlain')}</label>
        </div>
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'grpTypography')} darkMode={darkMode}>
        <div className="flex flex-col space-y-2 w-full">
          <select
            onChange={(e) => onCommand('fontName', e.target.value)}
            aria-label={t(uiLanguage, 'fontFamily')}
            className={`text-xs px-2 py-1.5 rounded-md border w-full outline-none ${selectClass}`}
            value={fontValue}
          >
            {fontOptions.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <div className="flex space-x-2 items-center w-full">
            <select
              onChange={(e) => onCommand('fontSize', e.target.value)}
              aria-label={t(uiLanguage, 'fontSize')}
              className={`text-xs px-2 py-1.5 rounded-md border w-24 outline-none ${selectClass}`}
              value={currentSize}
            >
              {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <div className="flex space-x-1">
              <button onMouseDown={keepSelection} onClick={() => onCommand('fontSize', 'grow')} title={t(uiLanguage, 'increaseFontSize')} aria-label={t(uiLanguage, 'increaseFontSize')} className={growShrinkClass}>
                A+
              </button>
              <button onMouseDown={keepSelection} onClick={() => onCommand('fontSize', 'shrink')} title={t(uiLanguage, 'decreaseFontSize')} aria-label={t(uiLanguage, 'decreaseFontSize')} className={growShrinkClass}>
                A-
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 w-full pt-1">
            <RibbonIconBtn icon={<Bold size={16} />} active={selectionContext.bold} onClick={() => onCommand('bold')} title={`${t(uiLanguage, 'bold')} (Ctrl+B)`} darkMode={darkMode} />
            <RibbonIconBtn icon={<Italic size={16} />} active={selectionContext.italic} onClick={() => onCommand('italic')} title={`${t(uiLanguage, 'italic')} (Ctrl+I)`} darkMode={darkMode} />
            <RibbonIconBtn icon={<Underline size={16} />} active={selectionContext.underline} onClick={() => onCommand('underline')} title={`${t(uiLanguage, 'underline')} (Ctrl+U)`} darkMode={darkMode} />
            <RibbonIconBtn icon={<Strikethrough size={16} />} active={selectionContext.strikeThrough} onClick={() => onCommand('strikeThrough')} title={`${t(uiLanguage, 'strikethrough')} (Ctrl+Shift+S)`} darkMode={darkMode} />
          </div>

          <div className="grid grid-cols-4 gap-1 w-full">
            <RibbonIconBtn icon={<Subscript size={16} />} active={selectionContext.subscript} onClick={() => onCommand('subscript')} title={t(uiLanguage, 'subscript')} darkMode={darkMode} />
            <RibbonIconBtn icon={<Superscript size={16} />} active={selectionContext.superscript} onClick={() => onCommand('superscript')} title={t(uiLanguage, 'superscript')} darkMode={darkMode} />

            <Popover open={showCasingDropdown} onClose={() => setShowCasingDropdown(false)} className="relative">
              <RibbonIconBtn icon={<CaseSensitive size={16} />} onClick={() => setShowCasingDropdown(!showCasingDropdown)} title={t(uiLanguage, 'changeCase')} darkMode={darkMode} expanded={showCasingDropdown} />
              {showCasingDropdown && (
                <div role="menu" className={`absolute top-full right-0 mt-1 border border-gray-300 dark:border-gray-700 shadow-xl rounded-md z-50 p-1 w-32 flex flex-col
                     ${darkMode ? 'bg-zinc-900 text-white' : 'bg-white text-gray-800'}
                `}>
                  {CASES.map(c => (
                    <button key={c.id} role="menuitem" onMouseDown={keepSelection} onClick={() => { onCommand('textCase', c.id); setShowCasingDropdown(false); }} className="px-2 py-1.5 text-left text-xs rounded hover:bg-blue-50 dark:hover:bg-white/10">
                      {t(uiLanguage, c.key)}
                    </button>
                  ))}
                </div>
              )}
            </Popover>
            <RibbonIconBtn icon={<Type size={16} />} onClick={() => onCommand('removeFormat')} title={t(uiLanguage, 'clearFormatting')} darkMode={darkMode} />
          </div>

          <div className="grid grid-cols-3 gap-1.5 w-full pt-1">
            <Popover open={colorPicker === 'text'} onClose={() => setColorPicker(null)} className="relative flex flex-col items-center">
              <button onMouseDown={keepSelection} title={t(uiLanguage, 'textColor')} aria-label={t(uiLanguage, 'textColor')} aria-expanded={colorPicker === 'text'} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 w-full border dark:border-zinc-700 flex flex-col items-center" onClick={() => toggleColor('text')}>
                <span className="text-[10px] font-bold">{t(uiLanguage, 'colorShortText')}</span>
                <div className="w-5 h-1.5 rounded mt-0.5" style={{ backgroundColor: selectionContext.foreColor || (darkMode ? '#e5e7eb' : '#000') }} />
              </button>
              {colorPicker === 'text' && <ColorSwatches value={selectionContext.foreColor} onPick={c => pickColor('text', c)} darkMode={darkMode} uiLanguage={uiLanguage} />}
            </Popover>

            <Popover open={colorPicker === 'highlight'} onClose={() => setColorPicker(null)} className="relative flex flex-col items-center">
              <button onMouseDown={keepSelection} title={t(uiLanguage, 'highlightColor')} aria-label={t(uiLanguage, 'highlightColor')} aria-expanded={colorPicker === 'highlight'} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 w-full border dark:border-zinc-700 flex flex-col items-center" onClick={() => toggleColor('highlight')}>
                <span className="text-[10px] font-bold">{t(uiLanguage, 'colorShortHighlight')}</span>
                <div className="w-5 h-1.5 rounded mt-0.5" style={{ backgroundColor: selectionContext.hiliteColor || 'transparent' }} />
              </button>
              {colorPicker === 'highlight' && <ColorSwatches value={selectionContext.hiliteColor} onPick={c => pickColor('highlight', c)} darkMode={darkMode} uiLanguage={uiLanguage} />}
            </Popover>

            <StyleGallery darkMode={darkMode} uiLanguage={uiLanguage} selectClass={selectClass} />
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'grpParagraph')} darkMode={darkMode}>
        <div className="flex flex-col space-y-2 w-full">
          <div className="grid grid-cols-4 gap-1 w-full">
            <RibbonIconBtn icon={<AlignLeft size={16} />} active={selectionContext.align === 'left'} onClick={() => onCommand('justifyLeft')} title={t(uiLanguage, 'alignLeft')} darkMode={darkMode} />
            <RibbonIconBtn icon={<AlignCenter size={16} />} active={selectionContext.align === 'center'} onClick={() => onCommand('justifyCenter')} title={t(uiLanguage, 'alignCenter')} darkMode={darkMode} />
            <RibbonIconBtn icon={<AlignRight size={16} />} active={selectionContext.align === 'right'} onClick={() => onCommand('justifyRight')} title={t(uiLanguage, 'alignRight')} darkMode={darkMode} />
            <RibbonIconBtn icon={<AlignJustify size={16} />} active={selectionContext.align === 'justify'} onClick={() => onCommand('justifyFull')} title={t(uiLanguage, 'justify')} darkMode={darkMode} />
          </div>

          <div className="grid grid-cols-4 gap-1 w-full">
            <RibbonIconBtn icon={<ListIcon size={16} />} active={!!editor?.isActive('bulletList')} onClick={() => onCommand('insertUnorderedList')} title={t(uiLanguage, 'bulletList')} darkMode={darkMode} />
            <RibbonIconBtn icon={<ListOrdered size={16} />} active={!!editor?.isActive('orderedList')} onClick={() => onCommand('insertOrderedList')} title={t(uiLanguage, 'numberedList')} darkMode={darkMode} />
            <RibbonIconBtn icon={<Outdent size={16} />} onClick={() => onCommand('outdent')} title={t(uiLanguage, 'decreaseIndent')} darkMode={darkMode} />
            <RibbonIconBtn icon={<Indent size={16} />} onClick={() => onCommand('indent')} title={t(uiLanguage, 'increaseIndent')} darkMode={darkMode} />
          </div>

          <Popover open={colorPicker === 'shading'} onClose={() => setColorPicker(null)} className="relative flex flex-col w-full">
            <button onMouseDown={keepSelection} aria-expanded={colorPicker === 'shading'} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 border dark:border-zinc-700 flex items-center justify-center gap-2 w-full" onClick={() => toggleColor('shading')}>
              <PaintBucket size={16} />
              <span className="text-[10px] font-bold">{t(uiLanguage, 'paragraphShading')}</span>
            </button>
            {colorPicker === 'shading' && <ColorSwatches value={selectionContext.paragraphBackground} onPick={c => pickColor('shading', c)} darkMode={darkMode} uiLanguage={uiLanguage} />}
          </Popover>

          {/* Line Spacing Selection */}
          <div className="flex items-center justify-between gap-2 w-full pt-1">
            <label htmlFor="ribbon-line-spacing" className="text-[10px] font-bold opacity-75">{t(uiLanguage, 'lineSpacing')}</label>
            <select
              id="ribbon-line-spacing"
              onChange={(e) => onCommand('lineHeight', e.target.value)}
              className={`text-xs px-2 py-1.5 rounded border outline-none w-28 ${selectClass}`}
              value={lineSpacingValue}
            >
              {!LINE_SPACINGS.includes(lineSpacingValue) && <option value={lineSpacingValue}>{lineSpacingValue}</option>}
              <option value="1.0">{t(uiLanguage, 'spacingSingle')} (1.0)</option>
              <option value="1.15">1.15</option>
              <option value="1.5">1.5</option>
              <option value="2.0">{t(uiLanguage, 'spacingDouble')} (2.0)</option>
              <option value="2.5">2.5</option>
              <option value="3.0">3.0</option>
            </select>
          </div>
        </div>
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'grpEditingTools')} darkMode={darkMode}>
        <div className="flex flex-col space-y-2 w-full">
          <RibbonToolBtn icon={<Search size={16} />} label={t(uiLanguage, 'findReplace')} title={t(uiLanguage, 'findReplaceTip')} onClick={onFind} darkMode={darkMode} />
          <RibbonToolBtn icon={<FileText size={16} />} label={t(uiLanguage, 'wordPageStats')} title={t(uiLanguage, 'statsTip')} onClick={onShowStats} darkMode={darkMode} />
          <RibbonToolBtn icon={<Maximize size={16} />} label={t(uiLanguage, 'zenFocusMode')} title={t(uiLanguage, 'zenTip')} onClick={onToggleZenMode} darkMode={darkMode} />
        </div>
      </RibbonGroup>
    </>
  );
};
