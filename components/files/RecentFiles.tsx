import React from 'react';
import { FileText, HardDrive, X } from 'lucide-react';
import { useFiles } from '../../state/FilesContext';
import { LanguageCode, t } from '../../utils/translations';
import { formatRelativeTime } from '../../utils/relativeTime';

/**
 * Files drawer section: recently opened / saved files. Chromium entries keep
 * the file handle and reopen the file itself; elsewhere an entry opens the
 * document's copy in the app.
 */
export const RecentFiles: React.FC<{ darkMode: boolean; uiLanguage: LanguageCode; documentIds: Set<string> }> = ({ darkMode, uiLanguage, documentIds }) => {
  const { recent, openRecent, removeRecent } = useFiles();
  if (!recent.length) return null;

  return (
    <div className={`px-2 pt-2 pb-1 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
      <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide opacity-50" id="recent-files-heading">
        {t(uiLanguage, 'recentFiles')}
      </h3>
      <ul className="max-h-40 overflow-y-auto" aria-labelledby="recent-files-heading">
        {recent.map(entry => {
          const reopenable = !!entry.handle || (!!entry.docId && documentIds.has(entry.docId));
          const hint = entry.handle ? t(uiLanguage, 'recentOpenFile') : reopenable ? t(uiLanguage, 'recentOpenAppCopy') : t(uiLanguage, 'recentNotAvailable');
          return (
            <li key={entry.id} className="relative group">
              <button
                type="button"
                onClick={() => void openRecent(entry)}
                title={`${entry.name} — ${hint}`}
                className={`w-full text-left pl-2 pr-7 py-1.5 rounded-md flex items-center gap-2 text-xs transition-colors
                  ${reopenable ? '' : 'opacity-60'}
                  ${darkMode ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                `}
              >
                {entry.handle ? <HardDrive size={14} className="shrink-0" /> : <FileText size={14} className="shrink-0" />}
                <span className="truncate flex-1">{entry.name}</span>
                <span className="text-[10px] opacity-60 shrink-0">{formatRelativeTime(entry.at, uiLanguage, t(uiLanguage, 'rvJustNow'))}</span>
              </button>
              <button
                type="button"
                onClick={() => removeRecent(entry.id)}
                className={`absolute top-1/2 -translate-y-1/2 right-1 p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
                  ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}
                `}
                title={t(uiLanguage, 'removeFromRecent')}
                aria-label={`${t(uiLanguage, 'removeFromRecent')}: ${entry.name}`}
              >
                <X size={12} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
