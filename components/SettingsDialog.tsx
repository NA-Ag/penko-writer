import React, { useEffect, useState } from 'react';
import { X, Settings, Check, Globe, User, SpellCheck, HardDrive, RefreshCw } from 'lucide-react';
import { setSyncDialogOpen } from '../utils/sync/status';
import { LanguageCode, t } from '../utils/translations';
import { useFocusTrap, useEscapeKey } from '../utils/hooks';
import { useApp } from '../AppContext';
import { useExportAll } from '../utils/useExportAll';
import { getStorageEstimate } from '../utils/storage';
import { formatBytes } from '../utils/imageUtils';
import {
  DEFAULT_LANGUAGETOOL_SERVER, getLanguageToolServer, setLanguageToolServer, hasLanguageToolConsent, setLanguageToolConsent,
} from '../utils/spellcheckSettings';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  pasteAsPlainText: boolean;
  setPasteAsPlainText: (val: boolean) => void;
  showRuler: boolean;
  setShowRuler: (val: boolean) => void;
  uiLanguage: LanguageCode;
  setUiLanguage: (lang: LanguageCode) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen, onClose, darkMode,
  pasteAsPlainText, setPasteAsPlainText,
  showRuler, setShowRuler,
  uiLanguage, setUiLanguage
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const { currentUser, setCurrentUser, toast } = useApp();
  const handleBackup = useExportAll();
  const [name, setName] = useState(currentUser);
  const [ltServer, setLtServer] = useState('');
  const [ltConsent, setLtConsent] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(currentUser);
    const server = getLanguageToolServer();
    setLtServer(server === DEFAULT_LANGUAGETOOL_SERVER ? '' : server);
    setLtConsent(hasLanguageToolConsent());
    let cancelled = false;
    getStorageEstimate().then(est => !cancelled && setStorage(est));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== currentUser) setCurrentUser(trimmed);
    else setName(currentUser);
  };

  const commitServer = () => {
    const previous = getLanguageToolServer();
    if (!setLanguageToolServer(ltServer)) {
      toast.error(t(uiLanguage, 'rvInvalidServerUrl'));
      return;
    }
    const next = getLanguageToolServer();
    setLtServer(next === DEFAULT_LANGUAGETOOL_SERVER ? '' : next);
    if (next !== previous) setLtConsent(hasLanguageToolConsent());
  };

  const handleDone = () => {
    commitName();
    // Escape / Done while the server field still has focus (no blur fires on unmount)
    const current = getLanguageToolServer();
    if (ltServer !== (current === DEFAULT_LANGUAGETOOL_SERVER ? '' : current)) commitServer();
    onClose();
  };

  useEscapeKey(isOpen, handleDone);

  if (!isOpen) return null;

  const inputClass = `w-full p-2 rounded border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${
    darkMode ? 'bg-[#444] border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-800'
  }`;
  const usagePct = storage && storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  const bg = darkMode ? 'bg-[#222] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const itemBg = darkMode ? 'bg-[#333]' : 'bg-gray-50';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div ref={dialogRef} className={`w-96 max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl border p-6 relative ${bg}`}>
        <button onClick={handleDone} aria-label={t(uiLanguage, 'close')} className="absolute top-4 right-4 opacity-50 hover:opacity-100">
          <X size={20} />
        </button>

        <h2 id="settings-dialog-title" className="text-xl font-bold mb-6 flex items-center gap-2">
          <Settings className="text-gray-500" />
          {t(uiLanguage, 'settingsTitle')}
        </h2>

        <div className="space-y-4">
           {/* Display name (used for comments, tracked changes and collaboration) */}
           <div className={`p-3 rounded flex flex-col gap-2 ${itemBg}`}>
              <label htmlFor="settings-display-name" className="flex items-center gap-2 mb-1">
                 <User size={16} className="text-blue-500" />
                 <span className="font-medium text-sm">{t(uiLanguage, 'rvDisplayName')}</span>
              </label>
              <input
                id="settings-display-name"
                type="text"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && commitName()}
                className={inputClass}
              />
              <span className="text-xs opacity-60">{t(uiLanguage, 'rvDisplayNameDesc')}</span>
           </div>

           {/* Interface Language */}
           <div className={`p-3 rounded flex flex-col gap-2 ${itemBg}`}>
              <div className="flex items-center gap-2 mb-1">
                 <Globe size={16} className="text-blue-500" />
                 <span className="font-medium text-sm" id="settings-ui-lang">{t(uiLanguage, 'interfaceLang')}</span>
              </div>
              <select
                aria-labelledby="settings-ui-lang"
                value={uiLanguage}
                onChange={(e) => setUiLanguage(e.target.value as LanguageCode)}
                className={`w-full p-2 rounded border text-sm outline-none focus:ring-2 focus:ring-blue-500/50
                   ${darkMode ? 'bg-[#444] border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-800'}
                `}
              >
                  <option value="en-US">English (US)</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="zh">中文</option>
                  <option value="ja">日本語</option>
                  <option value="ru">Русский</option>
                  <option value="uk">Українська</option>
                  <option value="pt">Português</option>
                  <option value="it">Italiano</option>
                  <option value="ko">한국어</option>
                  <option value="ar">العربية</option>
                  <option value="hi">हिन्दी</option>
              </select>
           </div>

           <div className={`p-3 rounded flex items-center justify-between ${itemBg}`}>
              <div className="flex flex-col">
                 <span className="font-medium text-sm">{t(uiLanguage, 'pastePlainTitle')}</span>
                 <span className="text-xs opacity-60">{t(uiLanguage, 'pastePlainDesc')}</span>
              </div>
              <button
                onClick={() => setPasteAsPlainText(!pasteAsPlainText)}
                role="switch"
                aria-checked={pasteAsPlainText}
                aria-label={t(uiLanguage, 'pastePlainTitle')}
                className={`w-10 h-6 rounded-full transition-colors relative ${pasteAsPlainText ? 'bg-blue-600' : 'bg-gray-400'}`}
              >
                  <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${pasteAsPlainText ? 'translate-x-4' : ''}`}></div>
              </button>
           </div>

           <div className={`p-3 rounded flex items-center justify-between ${itemBg}`}>
              <div className="flex flex-col">
                 <span className="font-medium text-sm">{t(uiLanguage, 'showRulerTitle')}</span>
                 <span className="text-xs opacity-60">{t(uiLanguage, 'showRulerDesc')}</span>
              </div>
               <button
                onClick={() => setShowRuler(!showRuler)}
                role="switch"
                aria-checked={showRuler}
                aria-label={t(uiLanguage, 'showRulerTitle')}
                className={`w-10 h-6 rounded-full transition-colors relative ${showRuler ? 'bg-blue-600' : 'bg-gray-400'}`}
              >
                  <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${showRuler ? 'translate-x-4' : ''}`}></div>
              </button>
           </div>
           
           <div className={`p-3 rounded flex items-center justify-between ${itemBg} opacity-50 cursor-not-allowed`}>
              <div className="flex flex-col">
                 <span className="font-medium text-sm">{t(uiLanguage, 'autoSaveTitle')}</span>
                 <span className="text-xs opacity-60">{t(uiLanguage, 'autoSaveDesc')}</span>
              </div>
              <Check size={16} />
           </div>

           {/* Online grammar check (LanguageTool) */}
           <div className={`p-3 rounded flex flex-col gap-2 ${itemBg}`}>
              <label htmlFor="settings-lt-server" className="flex items-center gap-2 mb-1">
                 <SpellCheck size={16} className="text-blue-500" />
                 <span className="font-medium text-sm">{t(uiLanguage, 'rvLtServer')}</span>
              </label>
              <input
                id="settings-lt-server"
                type="url"
                value={ltServer}
                placeholder={DEFAULT_LANGUAGETOOL_SERVER}
                onChange={(e) => setLtServer(e.target.value)}
                onBlur={commitServer}
                onKeyDown={(e) => e.key === 'Enter' && commitServer()}
                className={inputClass}
              />
              <span className="text-xs opacity-60">{t(uiLanguage, 'rvLtServerDesc')}</span>
              <div className="flex items-center justify-between gap-2">
                 <span className="text-xs opacity-80">{t(uiLanguage, ltConsent ? 'rvLtConsentGiven' : 'rvLtConsentNotGiven')}</span>
                 {ltConsent && (
                   <button
                     onClick={() => {
                       setLanguageToolConsent(false);
                       setLtConsent(false);
                     }}
                     className={`px-2 py-1 text-xs rounded border ${darkMode ? 'border-gray-600 hover:bg-[#444]' : 'border-gray-300 hover:bg-gray-100'}`}
                   >
                     {t(uiLanguage, 'rvLtRevoke')}
                   </button>
                 )}
              </div>
           </div>

           {/* Storage */}
           <div className={`p-3 rounded flex flex-col gap-2 ${itemBg}`}>
              <div className="flex items-center gap-2 mb-1">
                 <HardDrive size={16} className="text-blue-500" />
                 <span className="font-medium text-sm">{t(uiLanguage, 'rvStorage')}</span>
              </div>
              {storage ? (
                <>
                  <div
                    className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-[#444]' : 'bg-gray-200'}`}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(usagePct)}
                    aria-label={t(uiLanguage, 'rvStorage')}
                  >
                    <div className={`h-full ${usagePct > 80 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.max(usagePct, 1)}%` }} />
                  </div>
                  <span className="text-xs opacity-60">
                    {t(uiLanguage, 'rvStorageUsage').replace('{used}', formatBytes(storage.usage)).replace('{quota}', formatBytes(storage.quota))}
                  </span>
                </>
              ) : (
                <span className="text-xs opacity-60">{t(uiLanguage, 'rvStorageUnknown')}</span>
              )}
              <div className="flex items-center justify-between gap-2">
                 <span className="text-xs opacity-60">{t(uiLanguage, 'rvBackupHint')}</span>
                 <button
                   onClick={() => void handleBackup()}
                   className={`shrink-0 px-2 py-1 text-xs rounded border ${darkMode ? 'border-gray-600 hover:bg-[#444]' : 'border-gray-300 hover:bg-gray-100'}`}
                 >
                   {t(uiLanguage, 'rvBackupAll')}
                 </button>
              </div>
           </div>

           {/* Device sync */}
           <div className={`p-3 rounded flex items-center justify-between gap-2 ${itemBg}`}>
              <div className="flex flex-col">
                 <span className="font-medium text-sm flex items-center gap-2"><RefreshCw size={16} className="text-blue-500" />{t(uiLanguage, 'syncSettingsRow')}</span>
                 <span className="text-xs opacity-60">{t(uiLanguage, 'syncSettingsRowDesc')}</span>
              </div>
              <button
                onClick={() => {
                  handleDone();
                  setSyncDialogOpen(true);
                }}
                className={`shrink-0 px-2 py-1 text-xs rounded border ${darkMode ? 'border-gray-600 hover:bg-[#444]' : 'border-gray-300 hover:bg-gray-100'}`}
              >
                {t(uiLanguage, 'syncOpen')}
              </button>
           </div>

           {/* Slot: Penko assistant visibility (setting owned by the mobile/assistant area, if added) */}
        </div>

        <button onClick={handleDone} className="mt-8 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors">
          {t(uiLanguage, 'done')}
        </button>
      </div>
    </div>
  );
};