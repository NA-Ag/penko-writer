import React, { useState } from 'react';
import { Columns, Rows, Trash2, Merge, Split, Palette, Table, PaintBucket } from 'lucide-react';
import { t } from '../../utils/translations';
import { ColorSwatches, Popover, RibbonBtn, RibbonGroup } from './primitives';
import type { RibbonProps } from './types';

const TABLE_STYLES = [
  { id: 'default', key: 'tableStyleDefault' },
  { id: 'bordered', key: 'tableStyleBordered' },
  { id: 'striped', key: 'tableStyleStriped' },
  { id: 'minimal', key: 'tableStyleMinimal' },
];

export const TableTab: React.FC<RibbonProps> = ({ onTableAction, darkMode, uiLanguage }) => {
  const [showCellColor, setShowCellColor] = useState(false);
  return (
    <>
      <RibbonGroup label={t(uiLanguage, 'grpRowsCols')} darkMode={darkMode}>
        <div className="grid grid-cols-2 gap-2 w-full">
          <RibbonBtn icon={<Rows size={18} />} label={t(uiLanguage, 'addRow')} tooltip={t(uiLanguage, 'addRowBelow')} onClick={() => onTableAction('addRow')} darkMode={darkMode} />
          <RibbonBtn icon={<Columns size={18} />} label={t(uiLanguage, 'addCol')} tooltip={t(uiLanguage, 'addColRight')} onClick={() => onTableAction('addCol')} darkMode={darkMode} />
          <RibbonBtn icon={<Rows size={18} />} label={t(uiLanguage, 'addRowAbove')} onClick={() => onTableAction('addRowBefore')} darkMode={darkMode} />
          <RibbonBtn icon={<Columns size={18} />} label={t(uiLanguage, 'addColLeft')} onClick={() => onTableAction('addColBefore')} darkMode={darkMode} />
          <RibbonBtn icon={<Trash2 size={18} className="text-red-500" />} label={t(uiLanguage, 'delRow')} onClick={() => onTableAction('delRow')} darkMode={darkMode} />
          <RibbonBtn icon={<Trash2 size={18} className="text-red-500" />} label={t(uiLanguage, 'delCol')} onClick={() => onTableAction('delCol')} darkMode={darkMode} />
        </div>
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'mergeCells')} darkMode={darkMode}>
        <div className="grid grid-cols-2 gap-2 w-full">
          <RibbonBtn icon={<Merge size={18} />} label={t(uiLanguage, 'merge')} onClick={() => onTableAction('mergeCells')} darkMode={darkMode} />
          <RibbonBtn icon={<Split size={18} />} label={t(uiLanguage, 'split')} onClick={() => onTableAction('splitCell')} darkMode={darkMode} />
        </div>
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'tableStyle')} darkMode={darkMode}>
        <div className="grid grid-cols-2 gap-2 w-full">
          {TABLE_STYLES.map(s => (
            <RibbonBtn key={s.id} icon={<Palette size={16} />} label={t(uiLanguage, s.key)} onClick={() => onTableAction('setStyle', s.id)} darkMode={darkMode} />
          ))}
        </div>
      </RibbonGroup>

      <RibbonGroup label={t(uiLanguage, 'tableTools')} darkMode={darkMode}>
        <div className="grid grid-cols-2 gap-2 w-full">
          <RibbonBtn icon={<Table size={16} />} label={t(uiLanguage, 'headerRow')} onClick={() => onTableAction('toggleHeader')} darkMode={darkMode} />
          <Popover open={showCellColor} onClose={() => setShowCellColor(false)} className="relative w-full">
            <RibbonBtn icon={<PaintBucket size={16} />} label={t(uiLanguage, 'cellShading')} onClick={() => setShowCellColor(!showCellColor)} darkMode={darkMode} expanded={showCellColor} />
            {showCellColor && (
              <ColorSwatches onPick={c => { onTableAction('cellBackground', c); setShowCellColor(false); }} darkMode={darkMode} uiLanguage={uiLanguage} />
            )}
          </Popover>
          <RibbonBtn icon={<Trash2 size={16} className="text-red-500" />} label={t(uiLanguage, 'deleteTable')} onClick={() => onTableAction('delTable')} darkMode={darkMode} />
        </div>
      </RibbonGroup>
    </>
  );
};
