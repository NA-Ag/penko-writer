import React from 'react';
import { Check, Users, MessageSquare, Eye, RotateCw } from 'lucide-react';
import { t } from '../../utils/translations';
import { RibbonBtn, RibbonGroup } from './primitives';
import type { RibbonProps } from './types';

export const ReviewTab: React.FC<RibbonProps> = ({
  darkMode, uiLanguage, onShowSpellCheck, onShowCollaboration, onCreateComment, onShowCommentsPanel, onShowTrackChangesPanel, trackingEnabled, onToggleTracking,
}) => (
  <>
    <RibbonGroup label={t(uiLanguage, 'grpTools')} darkMode={darkMode}>
      <RibbonBtn icon={<Check size={18} />} label={t(uiLanguage, 'spellCheck')} onClick={onShowSpellCheck} darkMode={darkMode} className="w-full" />
    </RibbonGroup>

    <RibbonGroup label={t(uiLanguage, 'collaboration')} darkMode={darkMode}>
      <RibbonBtn icon={<Users size={18} />} label={t(uiLanguage, 'collaborate')} onClick={onShowCollaboration} darkMode={darkMode} className="w-full" />
    </RibbonGroup>

    <RibbonGroup label={t(uiLanguage, 'comments')} darkMode={darkMode}>
      <RibbonBtn icon={<MessageSquare size={18} />} label={t(uiLanguage, 'newComment')} onClick={onCreateComment} darkMode={darkMode} className="w-full" />
      <RibbonBtn icon={<Eye size={18} />} label={t(uiLanguage, 'showComments')} onClick={onShowCommentsPanel} darkMode={darkMode} className="w-full" />
    </RibbonGroup>

    <RibbonGroup label={t(uiLanguage, 'changesTracking')} darkMode={darkMode}>
      <div className="flex flex-col space-y-2 w-full">
        <RibbonBtn icon={<RotateCw size={18} />} label={t(uiLanguage, 'trackChanges')} onClick={onShowTrackChangesPanel} darkMode={darkMode} className="w-full" />
        <div className="flex items-center space-x-2 bg-black/5 dark:bg-white/5 px-2 py-1 rounded w-full justify-center">
          <input type="checkbox" checked={trackingEnabled} onChange={onToggleTracking} className="w-3.5 h-3.5 cursor-pointer accent-blue-600" id="tracking-box" />
          <label htmlFor="tracking-box" className="text-[10px] cursor-pointer select-none">{t(uiLanguage, 'enableTracking')}</label>
        </div>
      </div>
    </RibbonGroup>
  </>
);
