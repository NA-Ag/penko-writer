import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, RotateCw, MoveVertical, Maximize, Square, Trash2 } from 'lucide-react';
import { t } from '../../utils/translations';
import { Dropdown, RibbonBtn, RibbonGroup, RibbonIconBtn } from './primitives';
import type { RibbonProps } from './types';

const BORDERS = [
  { id: 'none', key: 'borderNone' },
  { id: 'thin', key: 'borderThin' },
  { id: 'medium', key: 'borderMedium' },
  { id: 'thick', key: 'borderThick' },
  { id: 'rounded', key: 'borderRounded' },
];

export const ImageTab: React.FC<RibbonProps> = ({ onImageAction, darkMode, uiLanguage }) => (
  <>
    <RibbonGroup label={t(uiLanguage, 'imageWrapping')} darkMode={darkMode}>
      <div className="flex flex-col space-y-2.5 w-full">
        <Dropdown
          icon={<MoveVertical size={18} />}
          label={t(uiLanguage, 'layoutStyle')}
          items={[
            { label: t(uiLanguage, 'layoutInline'), onClick: () => onImageAction('layout', 'inline') },
            { label: t(uiLanguage, 'layoutBreakText'), onClick: () => onImageAction('layout', 'break') },
          ]}
          darkMode={darkMode}
        />
        <Dropdown
          icon={<Maximize size={18} />}
          label={t(uiLanguage, 'imgSize')}
          items={[25, 50, 75, 100].map(p => ({ label: `${p}%`, onClick: () => onImageAction('resize', p) }))}
          darkMode={darkMode}
        />

        <div className="grid grid-cols-4 gap-1 w-full pt-1">
          <RibbonIconBtn icon={<AlignLeft size={16} />} onClick={() => onImageAction('align', 'left')} title={t(uiLanguage, 'alignLeft')} darkMode={darkMode} />
          <RibbonIconBtn icon={<AlignCenter size={16} />} onClick={() => onImageAction('align', 'center')} title={t(uiLanguage, 'alignCenter')} darkMode={darkMode} />
          <RibbonIconBtn icon={<AlignRight size={16} />} onClick={() => onImageAction('align', 'right')} title={t(uiLanguage, 'alignRight')} darkMode={darkMode} />
          <RibbonIconBtn icon={<RotateCw size={16} />} onClick={() => onImageAction('rotate', 90)} title={t(uiLanguage, 'imgRotate')} darkMode={darkMode} />
        </div>
      </div>
    </RibbonGroup>

    <RibbonGroup label={t(uiLanguage, 'imageBorderStyle')} darkMode={darkMode}>
      <div className="grid grid-cols-2 gap-2 w-full">
        {BORDERS.map(b => (
          <RibbonBtn key={b.id} icon={<Square size={16} />} label={t(uiLanguage, b.key)} onClick={() => onImageAction('border', b.id)} darkMode={darkMode} />
        ))}
        <RibbonBtn icon={<Trash2 size={16} className="text-red-500" />} label={t(uiLanguage, 'delete')} onClick={() => onImageAction('delete')} darkMode={darkMode} />
      </div>
    </RibbonGroup>
  </>
);
