import React, { useEffect, useState } from 'react';
import { X, FileDown, Info } from 'lucide-react';
import { useApp } from '../../AppContext';
import { useFiles } from '../../state/FilesContext';
import { useFocusTrap } from '../../utils/hooks';
import { safeName, withExtension, type DiskFormat } from '../../utils/files/fileAccess';
import { t } from '../../utils/translations';

/**
 * "Save to file" for browsers without the File System Access API (Firefox,
 * Safari): pick a name and format, and the file is downloaded. Explains once
 * that the browser can't write back to the original file.
 */
export const SaveAsDialog: React.FC = () => {
  const { darkMode, uiLanguage, currentDoc } = useApp();
  const { showSaveAsDialog: isOpen, setShowSaveAsDialog, currentLink, downloadAs, downloadExplained } = useFiles();
  const [name, setName] = useState('');
  const [format, setFormat] = useState<DiskFormat>('penko');
  const [busy, setBusy] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const f = currentLink?.format || 'penko';
    setFormat(f);
    setName((currentLink?.name || safeName(currentDoc?.title, t(uiLanguage, 'untitledDocument'))).replace(/\.(penko|docx)$/i, ''));
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const close = () => setShowSaveAsDialog(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!isOpen) return null;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadAs(safeName(name, t(uiLanguage, 'untitledDocument')), format);
    } finally {
      setBusy(false);
      close();
    }
  };

  const inputClass = `w-full px-4 py-2 rounded-lg border-2 outline-none transition-colors ${
    darkMode ? 'bg-[#0f0f0f] border-gray-700 text-gray-200 focus:border-blue-500' : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
  }`;
  const labelClass = `block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;
  const formats: { id: DiskFormat; label: string; hint: string }[] = [
    { id: 'penko', label: t(uiLanguage, 'formatPenko'), hint: t(uiLanguage, 'formatPenkoHint') },
    { id: 'docx', label: t(uiLanguage, 'formatDocx'), hint: t(uiLanguage, 'formatDocxHint') },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="save-file-dialog-title">
      <div ref={dialogRef} className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <FileDown size={20} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
            <h2 id="save-file-dialog-title" className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {t(uiLanguage, 'saveToFile')}
            </h2>
          </div>
          <button onClick={close} aria-label={t(uiLanguage, 'close')} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
            <X size={20} />
          </button>
        </div>

        <form
          className="p-6 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            void save();
          }}
        >
          {!downloadExplained && (
            <div className={`flex gap-3 p-3 rounded-lg border text-sm ${darkMode ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'}`} role="note">
              <Info size={18} className="shrink-0 mt-0.5" />
              <p>{t(uiLanguage, 'downloadSaveExplanation')}</p>
            </div>
          )}

          <div>
            <label htmlFor="save-file-name" className={labelClass}>
              {t(uiLanguage, 'fileNameLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="save-file-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                data-autofocus
                spellCheck={false}
                className={inputClass}
              />
              <span className={`text-sm shrink-0 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>.{format}</span>
            </div>
          </div>

          <fieldset>
            <legend className={labelClass}>{t(uiLanguage, 'fileFormatLabel')}</legend>
            <div className="space-y-2">
              {formats.map(f => (
                <label
                  key={f.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    format === f.id
                      ? 'border-blue-500 ' + (darkMode ? 'bg-blue-900/20' : 'bg-blue-50')
                      : darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input type="radio" name="save-file-format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="mt-1" />
                  <span>
                    <span className={`block text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>{f.label}</span>
                    <span className={`block text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{withExtension(safeName(name, t(uiLanguage, 'untitledDocument')), format)}</p>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className={`px-4 py-2 rounded-lg transition-colors ${darkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'}`}>
              {t(uiLanguage, 'cancel')}
            </button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition-colors font-medium">
              {t(uiLanguage, 'download')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
