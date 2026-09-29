import React from 'react';
import { MonitorPlay, Volume2, Info, Keyboard } from 'lucide-react';
import { t } from '../../utils/translations';
import { RibbonBtn, RibbonGroup } from './primitives';
import type { ReadAloudState, RibbonProps } from './types';

export const ViewTab: React.FC<RibbonProps & { readAloud: ReadAloudState }> = ({
  darkMode, uiLanguage, onPresent, onShowStats, onShowKeyboardShortcuts, showRuler, setShowRuler, isScreenplay, onToggleScreenplay,
  isMarkdownMode, onToggleMarkdown, showOutline, onToggleOutline, readAloud,
}) => {
  const toggles = [
    { checked: showRuler, onChange: () => setShowRuler(!showRuler), key: 'ruler' },
    { checked: isScreenplay, onChange: onToggleScreenplay, key: 'screenplayMode' },
    { checked: isMarkdownMode, onChange: onToggleMarkdown, key: 'markdownMode' },
    { checked: showOutline, onChange: onToggleOutline, key: 'documentOutline' },
  ];
  return (
    <>
      <RibbonGroup label={t(uiLanguage, 'documentViews')} darkMode={darkMode}>
        <div className="grid grid-cols-2 gap-2 w-full">
          <RibbonBtn icon={<MonitorPlay size={18} />} label={t(uiLanguage, 'present')} onClick={onPresent} darkMode={darkMode} />
          <RibbonBtn icon={<Volume2 size={18} />} label={readAloud.isSpeaking ? t(uiLanguage, 'stopReading') : t(uiLanguage, 'readAloud')} onClick={readAloud.toggle} darkMode={darkMode} active={readAloud.isSpeaking} />
        </div>
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'grpTools')} darkMode={darkMode}>
        <div className="flex flex-col space-y-2.5 w-full">
          <RibbonBtn icon={<Info size={18} />} label={t(uiLanguage, 'stats')} onClick={onShowStats} darkMode={darkMode} className="w-full" />
          <RibbonBtn icon={<Keyboard size={18} />} label={t(uiLanguage, 'shortcuts')} onClick={onShowKeyboardShortcuts} darkMode={darkMode} className="w-full" />

          <div className="flex flex-col space-y-1.5 p-2 bg-black/5 dark:bg-white/5 rounded-lg w-full">
            {toggles.map(item => (
              <label key={item.key} className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={item.checked} onChange={item.onChange} className="accent-blue-600 w-3.5 h-3.5" />
                <span className="text-[11px]">{t(uiLanguage, item.key)}</span>
              </label>
            ))}
          </div>
        </div>
      </RibbonGroup>
    </>
  );
};
