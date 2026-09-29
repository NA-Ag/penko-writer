import React from 'react';
import { BookOpen, BookMarked, FileText } from 'lucide-react';
import { t } from '../../utils/translations';
import { useApp } from '../../AppContext';
import { Dropdown, RibbonBtn, RibbonGroup } from './primitives';
import type { RibbonProps } from './types';

export const ReferencesTab: React.FC<RibbonProps> = ({ darkMode, uiLanguage, onShowTOCDialog, onShowFootnoteDialog, onShowCitationDialog }) => {
  const { handleInsertBibliography } = useApp();
  return (
    <>
      <RibbonGroup label={t(uiLanguage, 'tableOfContents')} darkMode={darkMode}>
        <RibbonBtn icon={<BookOpen size={18} />} label={t(uiLanguage, 'tableOfContents')} onClick={onShowTOCDialog} darkMode={darkMode} className="w-full" />
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'footnotes')} darkMode={darkMode}>
        <RibbonBtn icon={<FileText size={18} />} label={t(uiLanguage, 'footnote')} onClick={onShowFootnoteDialog} darkMode={darkMode} className="w-full" />
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'citationsAndBibliography')} darkMode={darkMode}>
        <div className="flex flex-col space-y-3 w-full">
          <RibbonBtn icon={<BookMarked size={18} />} label={t(uiLanguage, 'citation')} onClick={onShowCitationDialog} darkMode={darkMode} className="w-full" />
          <Dropdown
            icon={<BookMarked size={18} />}
            label={t(uiLanguage, 'insertBibliography')}
            items={[
              { label: t(uiLanguage, 'styleApa'), onClick: () => handleInsertBibliography('apa') },
              { label: t(uiLanguage, 'styleMla'), onClick: () => handleInsertBibliography('mla') },
              { label: t(uiLanguage, 'styleChicago'), onClick: () => handleInsertBibliography('chicago') },
              { label: t(uiLanguage, 'styleBibtex'), onClick: () => handleInsertBibliography('bibtex') },
            ]}
            darkMode={darkMode}
          />
        </div>
      </RibbonGroup>
    </>
  );
};
