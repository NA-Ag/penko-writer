import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Link as LinkIcon, Table, Minus, Sigma, Code2, Network, Keyboard, StickyNote, SeparatorHorizontal } from 'lucide-react';
import { t } from '../../utils/translations';
import { useApp } from '../../AppContext';
import { keepSelection, Popover, RibbonBtn, RibbonGroup } from './primitives';
import type { RibbonProps } from './types';

const TABLE_GRID = 8;
const SYMBOLS = ['©', '®', '™', '§', '¶', '•', '—', '–', '°', '±', '≠', '≈', '≤', '≥', '×', '÷', '∞', 'π', 'Ω', 'μ', 'α', 'β', 'γ', '€'];

export const InsertTab: React.FC<RibbonProps> = ({
  onCommand, onTableAction, darkMode, uiLanguage, onShowLinkDialog, onShowEquationDialog, onShowCodeBlockDialog, onShowDiagramEditor, onShowHeaderFooter,
}) => {
  const { handleInsertPageBreak, handleInsertImageFiles, executeCommand } = useApp();
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover, setTableHover] = useState<{ rows: number; cols: number }>({ rows: 0, cols: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertTable = (rows: number, cols: number) => {
    onTableAction('insert', { rows, cols });
    setShowTablePicker(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length) void handleInsertImageFiles(Array.from(files));
    e.target.value = '';
  };

  return (
    <>
      <RibbonGroup label={t(uiLanguage, 'grpContent')} darkMode={darkMode}>
        <div className="grid grid-cols-2 gap-2 w-full">
          <Popover open={showTablePicker} onClose={() => setShowTablePicker(false)} className="relative w-full">
            <RibbonBtn icon={<Table size={18} />} label={t(uiLanguage, 'table')} onClick={() => { setTableHover({ rows: 0, cols: 0 }); setShowTablePicker(!showTablePicker); }} darkMode={darkMode} expanded={showTablePicker} />
            {showTablePicker && (
              <div
                role="grid"
                aria-label={t(uiLanguage, 'insertTable')}
                className={`absolute top-full left-0 mt-1 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl z-50 p-2 w-max
                     ${darkMode ? 'bg-zinc-800 text-white' : 'bg-white text-gray-800'}
                `}
                onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}
              >
                <div className="grid grid-cols-8 gap-0.5">
                  {Array.from({ length: TABLE_GRID * TABLE_GRID }, (_, i) => {
                    const r = Math.floor(i / TABLE_GRID) + 1;
                    const c = (i % TABLE_GRID) + 1;
                    const on = r <= tableHover.rows && c <= tableHover.cols;
                    return (
                      <button
                        key={i}
                        aria-label={`${r} × ${c}`}
                        onMouseDown={keepSelection}
                        onMouseEnter={() => setTableHover({ rows: r, cols: c })}
                        onFocus={() => setTableHover({ rows: r, cols: c })}
                        onClick={() => insertTable(r, c)}
                        className={`w-4 h-4 rounded-sm border ${on ? 'bg-blue-500/30 border-blue-500' : (darkMode ? 'border-zinc-600' : 'border-gray-300')}`}
                      />
                    );
                  })}
                </div>
                <div className="text-[10px] text-center mt-1.5 opacity-75">
                  {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols}` : t(uiLanguage, 'insertTable')}
                </div>
              </div>
            )}
          </Popover>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
          <RibbonBtn icon={<ImageIcon size={18} />} label={t(uiLanguage, 'image')} onClick={() => fileInputRef.current?.click()} darkMode={darkMode} />
          <RibbonBtn icon={<LinkIcon size={18} />} label={t(uiLanguage, 'link')} onClick={onShowLinkDialog} darkMode={darkMode} />
          <RibbonBtn icon={<Sigma size={18} />} label={t(uiLanguage, 'equation')} onClick={onShowEquationDialog} darkMode={darkMode} />
          <RibbonBtn icon={<Code2 size={18} />} label={t(uiLanguage, 'codeBlock')} onClick={onShowCodeBlockDialog} darkMode={darkMode} />
          <RibbonBtn icon={<Network size={18} />} label={t(uiLanguage, 'diagramEditor')} onClick={onShowDiagramEditor} darkMode={darkMode} />
        </div>
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'grpDividersSymbols')} darkMode={darkMode}>
        <div className="flex flex-col space-y-2 w-full">
          <RibbonBtn icon={<Minus size={18} />} label={t(uiLanguage, 'horizontalLine')} onClick={() => onCommand('insertHorizontalRule')} darkMode={darkMode} className="w-full" />

          <Popover open={showSymbolPicker} onClose={() => setShowSymbolPicker(false)} className="relative w-full">
            <button onMouseDown={keepSelection} aria-expanded={showSymbolPicker} className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border dark:border-zinc-700 text-xs font-semibold hover:bg-gray-150 dark:hover:bg-white/5" onClick={() => setShowSymbolPicker(!showSymbolPicker)}>
              <Keyboard size={16} />
              <span>{t(uiLanguage, 'specialSymbol')}</span>
            </button>
            {showSymbolPicker && (
              <div className={`absolute top-full left-0 mt-1 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl z-50 p-2 grid grid-cols-6 gap-1 w-full max-w-[260px]
                   ${darkMode ? 'bg-zinc-800 text-white' : 'bg-white text-gray-800'}
              `}>
                {SYMBOLS.map(sym => (
                  <button
                    key={sym}
                    onMouseDown={keepSelection}
                    onClick={() => { onCommand('insertSymbol', sym); setShowSymbolPicker(false); }}
                    aria-label={sym}
                    className="w-7 h-7 flex items-center justify-center text-xs font-bold rounded hover:bg-blue-50 dark:hover:bg-white/10"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            )}
          </Popover>
        </div>
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'grpHeaderPageBreak')} darkMode={darkMode}>
        <div className="flex flex-col space-y-2 w-full">
          <RibbonBtn icon={<Minus size={18} />} label={t(uiLanguage, 'break')} tooltip={`${t(uiLanguage, 'pageBreak')} (Ctrl+Enter)`} onClick={handleInsertPageBreak} darkMode={darkMode} className="w-full" />
          <RibbonBtn icon={<SeparatorHorizontal size={18} />} label={t(uiLanguage, 'sectionBreak')} tooltip={t(uiLanguage, 'sectionBreakTip')} onClick={() => executeCommand('insertSectionBreak')} darkMode={darkMode} className="w-full" />
          <RibbonBtn icon={<StickyNote size={18} />} label={t(uiLanguage, 'headerFooter')} onClick={onShowHeaderFooter} darkMode={darkMode} className="w-full" />
        </div>
      </RibbonGroup>
    </>
  );
};
