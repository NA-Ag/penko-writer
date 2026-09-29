import React, { useState } from 'react';
import { Layout, RectangleVertical, FileText, Grid3X3, PaintBucket } from 'lucide-react';
import { t } from '../../utils/translations';
import { ColorSwatches, Dropdown, keepSelection, Popover, RibbonGroup } from './primitives';
import type { RibbonProps } from './types';
import { useApp } from '../../AppContext';
import { sectionBreaks, sectionOrientations } from '../../editor/extensions/sections';

export const LayoutTab: React.FC<RibbonProps> = ({ currentDoc, onUpdatePageConfig, darkMode, uiLanguage }) => {
  const [showPageColor, setShowPageColor] = useState(false);
  const page = currentDoc?.pageConfig;
  const margins = page?.margins || 'normal';
  const { editor, handleSectionSettingsSave } = useApp();
  const docOrientation = page?.orientation || 'portrait';
  // With section breaks, orientation applies to the section at the cursor (like Word's "This section")
  const breaks = editor && !editor.isDestroyed ? sectionBreaks(editor.state.doc) : [];
  const cursor = editor && !editor.isDestroyed ? editor.state.selection.from : 0;
  const sectionIndex = breaks.filter(b => b.pos < cursor).length;
  const orientation = sectionOrientations(docOrientation, breaks.map(b => b.settings))[sectionIndex];
  const setOrientation = (o: 'portrait' | 'landscape') => {
    if (!editor || editor.isDestroyed) return;
    // Only this section changes: a following section that inherited the old orientation keeps it
    const resolved = sectionOrientations(docOrientation, breaks.map(b => b.settings));
    const next = breaks[sectionIndex];
    if (next && next.settings.orientation === null && resolved[sectionIndex + 1] !== o) handleSectionSettingsSave(next.pos, { ...next.settings, orientation: resolved[sectionIndex + 1] });
    if (sectionIndex === 0) onUpdatePageConfig({ orientation: o });
    else handleSectionSettingsSave(breaks[sectionIndex - 1].pos, { ...breaks[sectionIndex - 1].settings, orientation: o });
  };
  const size = page?.size || 'A4';
  const cols = page?.cols || 1;

  return (
    <RibbonGroup label={t(uiLanguage, 'grpPageSetup')} darkMode={darkMode}>
      <div className="flex flex-col space-y-3 w-full">
        <Dropdown
          icon={<Layout size={18} />}
          label={t(uiLanguage, 'margins')}
          items={[
            { label: t(uiLanguage, 'normal'), selected: margins === 'normal', onClick: () => onUpdatePageConfig({ margins: 'normal' }) },
            { label: t(uiLanguage, 'narrow'), selected: margins === 'narrow', onClick: () => onUpdatePageConfig({ margins: 'narrow' }) },
            { label: t(uiLanguage, 'wide'), selected: margins === 'wide', onClick: () => onUpdatePageConfig({ margins: 'wide' }) },
          ]}
          darkMode={darkMode}
        />
        <Dropdown
          icon={<RectangleVertical size={18} />}
          label={t(uiLanguage, 'orientation')}
          items={[
            { label: t(uiLanguage, 'portrait'), selected: orientation === 'portrait', onClick: () => setOrientation('portrait') },
            { label: t(uiLanguage, 'landscape'), selected: orientation === 'landscape', onClick: () => setOrientation('landscape') },
          ]}
          darkMode={darkMode}
        />
        <Dropdown
          icon={<FileText size={18} />}
          label={t(uiLanguage, 'size')}
          items={[
            { label: 'A4', selected: size === 'A4', onClick: () => onUpdatePageConfig({ size: 'A4' }) },
            { label: t(uiLanguage, 'paperLetter'), selected: size === 'Letter', onClick: () => onUpdatePageConfig({ size: 'Letter' }) },
          ]}
          darkMode={darkMode}
        />
        <Dropdown
          icon={<Grid3X3 size={18} />}
          label={t(uiLanguage, 'columns')}
          items={[
            { label: t(uiLanguage, 'colsOne'), selected: cols === 1, onClick: () => onUpdatePageConfig({ cols: 1 }) },
            { label: t(uiLanguage, 'colsTwo'), selected: cols === 2, onClick: () => onUpdatePageConfig({ cols: 2 }) },
            { label: t(uiLanguage, 'colsThree'), selected: cols === 3, onClick: () => onUpdatePageConfig({ cols: 3 }) },
          ]}
          darkMode={darkMode}
        />
        <Popover open={showPageColor} onClose={() => setShowPageColor(false)} className="relative w-full">
          <button onMouseDown={keepSelection} aria-expanded={showPageColor} className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border dark:border-zinc-700 text-xs font-semibold hover:bg-gray-150 dark:hover:bg-white/5" onClick={() => setShowPageColor(!showPageColor)}>
            <PaintBucket size={16} />
            <span>{t(uiLanguage, 'pageColor')}</span>
          </button>
          {showPageColor && (
            <ColorSwatches
              value={page?.backgroundColor}
              onPick={c => { onUpdatePageConfig({ backgroundColor: c || undefined }); setShowPageColor(false); }}
              darkMode={darkMode}
              uiLanguage={uiLanguage}
            />
          )}
        </Popover>
      </div>
    </RibbonGroup>
  );
};
