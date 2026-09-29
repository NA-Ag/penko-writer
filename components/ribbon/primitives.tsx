import React, { useEffect, useRef, useState } from 'react';
import { Ban, Check, ChevronDown } from 'lucide-react';
import { COLORS } from '../../constants';
import { LanguageCode, t } from '../../utils/translations';

/** Keeps the editor selection when a ribbon control is pressed. */
export const keepSelection = (e: React.MouseEvent) => e.preventDefault();

/** Wrapper for a trigger + popover: closes on outside pointer-down or Escape. */
export const Popover: React.FC<{ open: boolean; onClose: () => void; className?: string; children: React.ReactNode }> = ({ open, onClose, className, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        (ref.current?.querySelector('button') as HTMLButtonElement | null)?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return <div ref={ref} className={className}>{children}</div>;
};

export const RibbonGroup: React.FC<{ label: string; children: React.ReactNode; darkMode: boolean }> = ({ label, children, darkMode }) => (
  <div className={`flex flex-col border-b pb-4 mb-4 last:border-b-0 w-full ${darkMode ? 'border-zinc-800' : 'border-gray-150'}`}>
    <span className={`text-[10px] mb-3 font-semibold tracking-wider uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
    <div className="flex flex-wrap gap-2 items-center justify-start">
      {children}
    </div>
  </div>
);

export const RibbonBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; darkMode: boolean; className?: string; active?: boolean; tooltip?: string; disabled?: boolean; expanded?: boolean }> = ({ icon, label, onClick, darkMode, className, active, tooltip, disabled, expanded }) => (
  <button
    onMouseDown={keepSelection}
    onClick={onClick}
    disabled={disabled}
    title={tooltip || label}
    aria-label={tooltip && tooltip !== label ? `${label} – ${tooltip}` : undefined}
    aria-pressed={active !== undefined ? active : undefined}
    aria-expanded={expanded}
    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed ${className || 'w-full'}
      ${active
        ? (darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600')
        : (darkMode
          ? 'hover:bg-white/5 text-gray-300'
          : 'hover:bg-gray-100 text-gray-700'
        )
      }
    `}
  >
    <div className="opacity-80 shrink-0">{icon}</div>
    <span className="text-xs leading-none font-medium truncate">{label}</span>
  </button>
);

export const RibbonIconBtn: React.FC<{ icon: React.ReactNode; active?: boolean; onClick: () => void; title?: string; darkMode: boolean; expanded?: boolean }> = ({ icon, active, onClick, title, darkMode, expanded }) => (
  <button
    onMouseDown={keepSelection}
    aria-label={title}
    aria-pressed={active !== undefined ? active : undefined}
    aria-expanded={expanded}
    onClick={onClick}
    title={title}
    className={`p-2 rounded-md transition-all flex items-center justify-center w-full
      ${active
         ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700')
         : (darkMode ? 'hover:bg-white/10 text-gray-300 border border-zinc-800' : 'hover:bg-gray-100 text-gray-700 border border-gray-200')
      }
    `}
  >
    {icon}
  </button>
);

/** Full-width outlined button used for the Home "editing tools" group. */
export const RibbonToolBtn: React.FC<{ icon: React.ReactNode; label: string; title: string; onClick: () => void; darkMode: boolean }> = ({ icon, label, title, onClick, darkMode }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2.5 p-2 rounded-lg border w-full text-xs font-semibold transition-all ${
      darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-white' : 'border-gray-250 hover:bg-gray-50 text-gray-700'
    }`}
    title={title}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export interface DropdownItem {
  label: string;
  onClick: () => void;
  /** Marks the option that is currently in effect (e.g. the page's margins). */
  selected?: boolean;
}

export const Dropdown: React.FC<{ icon: React.ReactNode; label: string; items: DropdownItem[]; darkMode: boolean }> = ({ icon, label, items, darkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasSelection = items.some(item => item.selected !== undefined);

  return (
    <Popover open={isOpen} onClose={() => setIsOpen(false)} className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`}>
        <button
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={label}
          onMouseDown={keepSelection}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all w-full border
            ${darkMode
              ? 'hover:bg-white/5 border-zinc-800 text-gray-300'
              : 'hover:bg-gray-100 border-gray-250 text-gray-700'
            }
          `}
        >
          <div className="flex items-center space-x-2.5">
            <div className="opacity-85">{icon}</div>
            <span className="text-xs font-semibold">{label}</span>
          </div>
          <ChevronDown size={14} className="opacity-60" />
        </button>
        {isOpen && (
          <div
            role="menu"
            className={`absolute top-full left-0 w-full mt-1 border rounded-lg shadow-xl z-50 p-1
              ${darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-gray-200 text-gray-800'}
            `}
          >
            {items.map(item => (
              <button
                key={item.label}
                role={hasSelection ? 'menuitemradio' : 'menuitem'}
                aria-checked={hasSelection ? !!item.selected : undefined}
                onMouseDown={keepSelection}
                onClick={() => { item.onClick(); setIsOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors flex items-center justify-between ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              >
                {item.label}
                {item.selected && <Check size={12} className="opacity-70" />}
              </button>
            ))}
          </div>
        )}
    </Popover>
  );
};

/**
 * Swatch grid shown under a colour button. The first entry resets the colour
 * ("No Color"): text / highlight / shading / page / cell colours all accept ''.
 */
export const ColorSwatches: React.FC<{ value?: string; onPick: (color: string) => void; darkMode: boolean; uiLanguage: LanguageCode }> = ({ value, onPick, darkMode, uiLanguage }) => {
  const current = (value || '').toLowerCase();
  return (
    <div className={`absolute top-full left-0 mt-1 border border-gray-300 dark:border-zinc-700 shadow-xl rounded-lg p-2 grid grid-cols-6 gap-1 z-50 w-44 ${darkMode ? 'bg-zinc-900' : 'bg-white'}`} role="listbox" aria-label={t(uiLanguage, 'colorPalette')}>
      <button
        role="option"
        aria-selected={!current}
        onMouseDown={keepSelection}
        onClick={() => onPick('')}
        className={`col-span-6 flex items-center gap-1.5 px-1 py-1 mb-0.5 rounded text-[10px] font-semibold ${darkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'}`}
      >
        <Ban size={14} className="opacity-60" />
        {t(uiLanguage, 'noColor')}
      </button>
      {COLORS.map(c => (
        <button
          key={c}
          role="option"
          aria-selected={current === c.toLowerCase()}
          aria-label={c}
          title={c}
          onMouseDown={keepSelection}
          className="w-5 h-5 rounded-full border border-zinc-100"
          style={{ backgroundColor: c }}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
};
