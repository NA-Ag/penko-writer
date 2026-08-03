import React from 'react';
import { X, Settings, Check, Globe } from 'lucide-react';
import { LanguageCode, t } from '../utils/translations';
import { useFocusTrap } from '../utils/hooks';

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

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#222] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const itemBg = darkMode ? 'bg-[#333]' : 'bg-gray-50';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title">
      <div ref={dialogRef} className={`w-96 rounded-lg shadow-2xl border p-6 relative ${bg}`}>
        <button onClick={onClose} aria-label={t(uiLanguage, 'close')} className="absolute top-4 right-4 opacity-50 hover:opacity-100">
          <X size={20} />
        </button>

        <h2 id="settings-dialog-title" className="text-xl font-bold mb-6 flex items-center gap-2">
          <Settings className="text-gray-500" />
          {t(uiLanguage, 'settingsTitle')}
        </h2>

        <div className="space-y-4">
           {/* Interface Language */}
           <div className={`p-3 rounded flex flex-col gap-2 ${itemBg}`}>
              <div className="flex items-center gap-2 mb-1">
                 <Globe size={16} className="text-blue-500" />
                 <span className="font-medium text-sm">{t(uiLanguage, 'interfaceLang')}</span>
              </div>
              <select
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
        </div>

        <button onClick={onClose} className="mt-8 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors">
          {t(uiLanguage, 'done')}
        </button>
      </div>
    </div>
  );
};