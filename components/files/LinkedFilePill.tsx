import React, { useEffect, useState } from 'react';
import { FileText, Save, SaveAll, Unlink } from 'lucide-react';
import { useFiles } from '../../state/FilesContext';
import { LanguageCode, t } from '../../utils/translations';

/**
 * Status-bar pill for a document linked to a file on disk: file name and
 * whether the file is up to date. Opens a small menu (save, save as,
 * auto-save, unlink). Renders nothing for documents without a file.
 */
export const LinkedFilePill: React.FC<{ darkMode: boolean; uiLanguage: LanguageCode }> = ({ darkMode, uiLanguage }) => {
  const { currentLink, currentDirty, status, saveToFile, saveAs, setAutoSave, unlink, canSaveInPlace } = useFiles();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => setOpen(false), [currentLink?.docId]);

  if (!currentLink) return null;
  const s = status[currentLink.docId];
  const label =
    s === 'saving' ? t(uiLanguage, 'fileSaving')
    : s === 'permission' ? t(uiLanguage, 'filePermissionNeeded')
    : s === 'error' ? t(uiLanguage, 'fileSaveError')
    : currentDirty ? t(uiLanguage, 'fileUnsaved')
    : t(uiLanguage, 'fileSavedToDisk');
  const dot = s === 'error' || s === 'permission' ? 'bg-red-500' : s === 'saving' ? 'bg-blue-500 animate-pulse' : currentDirty ? 'bg-amber-500' : 'bg-emerald-500';
  const itemClass = `w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'}`;
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => (s === 'permission' ? void saveToFile() : setOpen(!open))}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`${t(uiLanguage, 'linkedFile')}: ${currentLink.name} — ${label}`}
          title={`${currentLink.name} — ${label}`}
          data-testid="linked-file-pill"
          className="flex items-center gap-1.5 hover:text-blue-500 text-xs font-medium focus:outline-none transition-colors"
        >
          <FileText size={12} className="shrink-0" />
          <span className="truncate max-w-[8rem]">{currentLink.name}</span>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
          <span className="hidden xl:inline whitespace-nowrap opacity-70" aria-live="polite">{label}</span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}></div>
            <div
              role="menu"
              aria-label={currentLink.name}
              className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-60 py-1 shadow-xl rounded-xl border z-50 animate-in fade-in slide-in-from-bottom-2
                ${darkMode ? 'bg-[#252525] border-gray-700' : 'bg-white border-gray-100'}
              `}
            >
              <button role="menuitem" type="button" className={itemClass} onClick={act(() => void saveToFile())}>
                <Save size={14} /> {t(uiLanguage, 'saveToFile')}
              </button>
              <button role="menuitem" type="button" className={itemClass} onClick={act(() => void saveAs())}>
                <SaveAll size={14} /> {t(uiLanguage, 'saveAsFile')}
              </button>
              {canSaveInPlace && currentLink.handle && (
                <button
                  role="menuitemcheckbox"
                  type="button"
                  aria-checked={currentLink.autoSave}
                  className={itemClass}
                  onClick={act(() => setAutoSave(currentLink.docId, !currentLink.autoSave))}
                >
                  <span className="w-3.5 text-center">{currentLink.autoSave ? '✓' : ''}</span> {t(uiLanguage, 'autoSaveToFile')}
                </button>
              )}
              <div className={`my-1 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
              <button role="menuitem" type="button" className={itemClass} onClick={act(() => unlink(currentLink.docId))}>
                <Unlink size={14} /> {t(uiLanguage, 'unlinkFile')}
              </button>
            </div>
          </>
        )}
      </div>
      <div className={`w-px h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
    </>
  );
};
