import React, { useEffect, useRef, useState } from 'react';
import { Eye, Table, Image as ImageIcon, MonitorPlay, BookOpen, Home, PlusCircle, Sliders, ChevronLeft, ChevronRight } from 'lucide-react';
import { t } from '../utils/translations';
import { useApp } from '../AppContext';
import { keepSelection } from './ribbon/primitives';
import { useReadAloud } from './ribbon/useReadAloud';
import { HomeTab } from './ribbon/HomeTab';
import { InsertTab } from './ribbon/InsertTab';
import { LayoutTab } from './ribbon/LayoutTab';
import { ReferencesTab } from './ribbon/ReferencesTab';
import { ReviewTab } from './ribbon/ReviewTab';
import { ViewTab } from './ribbon/ViewTab';
import { TableTab } from './ribbon/TableTab';
import { ImageTab } from './ribbon/ImageTab';
import type { RibbonProps, RibbonTabId } from './ribbon/types';

export type { RibbonProps } from './ribbon/types';

const TAB_ICONS: Record<RibbonTabId, React.ReactNode> = {
  'Home': <Home size={22} />,
  'Insert': <PlusCircle size={22} />,
  'Layout': <Sliders size={22} />,
  'References': <BookOpen size={22} />,
  'Review': <Eye size={22} />,
  'View': <MonitorPlay size={22} />,
  'Table Design': <Table size={22} />,
  'Image Format': <ImageIcon size={22} />,
};

const TAB_THEMES: Record<RibbonTabId, { text: string; bg: string; border: string }> = {
  'Home': { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500' },
  'Insert': { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500' },
  'Layout': { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500' },
  'References': { text: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500' },
  'Review': { text: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500' },
  'View': { text: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500' },
  'Table Design': { text: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500' },
  'Image Format': { text: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500' },
};

const isContextual = (id: RibbonTabId) => id === 'Table Design' || id === 'Image Format';

export const Ribbon: React.FC<RibbonProps> = (props) => {
  const { currentDoc, onTitleChange, darkMode, selectionContext, uiLanguage, isCollapsed, setIsCollapsed } = props;
  const { editor, toast } = useApp();
  const [activeTab, setActiveTab] = useState<RibbonTabId>('Home');
  // The regular tab to return to when a contextual (table / image) tab goes away
  const lastRegularTab = useRef<RibbonTabId>('Home');
  const readAloud = useReadAloud(editor, currentDoc?.id, currentDoc?.language, uiLanguage, toast);

  useEffect(() => {
    if (selectionContext.type === 'table') setActiveTab('Table Design');
    else if (selectionContext.type === 'image') setActiveTab('Image Format');
    else setActiveTab(tab => (isContextual(tab) ? lastRegularTab.current : tab));
  }, [selectionContext.type]);

  const tabs: { id: RibbonTabId; label: string; short?: string }[] = [
    { id: 'Home', label: t(uiLanguage, 'tabHome') },
    { id: 'Insert', label: t(uiLanguage, 'tabInsert') },
    { id: 'Layout', label: t(uiLanguage, 'tabLayout') },
    { id: 'References', label: t(uiLanguage, 'tabReferences') },
    { id: 'Review', label: t(uiLanguage, 'tabReview') },
    { id: 'View', label: t(uiLanguage, 'tabView') },
  ];
  if (selectionContext.type === 'table') tabs.push({ id: 'Table Design', label: t(uiLanguage, 'tabTable'), short: t(uiLanguage, 'table') });
  if (selectionContext.type === 'image') tabs.push({ id: 'Image Format', label: t(uiLanguage, 'tabImage'), short: t(uiLanguage, 'image') });

  // Until the effect above catches up, never show the panel of a tab that is gone
  const shownTab = tabs.some(tab => tab.id === activeTab) ? activeTab : lastRegularTab.current;

  const selectTab = (id: RibbonTabId) => {
    if (shownTab === id) {
      setIsCollapsed(!isCollapsed);
      return;
    }
    if (!isContextual(id)) lastRegularTab.current = id;
    setActiveTab(id);
    setIsCollapsed(false);
  };

  const ribbonBg = darkMode ? 'bg-[#18181b] border-gray-800' : 'bg-white border-gray-200';
  const shadowClass = darkMode ? 'shadow-2xl shadow-black/60' : 'shadow-lg shadow-gray-150/40';
  const widthClass = isCollapsed ? 'w-20' : 'w-80';

  return (
    <div className={`h-full border-l flex flex-row transition-all duration-300 ${widthClass} ${ribbonBg} ${shadowClass} select-none overflow-hidden relative`}>

      {/* Left Blade Tab Rail */}
      <div className={`w-20 shrink-0 flex flex-col items-center py-6 border-r ${darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-gray-250 bg-gray-50/50'} justify-between h-full`}>
        <div className="flex flex-col space-y-3.5 w-full px-1.5">
          {tabs.map(tab => {
            const isActive = shownTab === tab.id && !isCollapsed;
            const theme = TAB_THEMES[tab.id];
            return (
              <button
                key={tab.id}
                onMouseDown={keepSelection}
                onClick={() => selectTab(tab.id)}
                title={tab.label}
                aria-label={tab.label}
                aria-pressed={isActive}
                className={`w-16 h-16 flex flex-col items-center justify-center rounded-xl transition-all relative group
                  ${isActive
                    ? `${theme.bg} ${theme.text} border-l-4 ${theme.border} font-bold`
                    : (darkMode ? 'text-gray-400 hover:text-white hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100')
                  }
                `}
              >
                {TAB_ICONS[tab.id]}
                <span className="text-xs leading-tight font-semibold mt-0.5 max-w-full overflow-hidden truncate px-0.5">
                  {tab.short || tab.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2 rounded-xl transition-all ${darkMode ? 'hover:bg-zinc-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
          title={isCollapsed ? t(uiLanguage, 'expandPanel') : t(uiLanguage, 'collapsePanel')}
          aria-label={isCollapsed ? t(uiLanguage, 'expandPanel') : t(uiLanguage, 'collapsePanel')}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Right Content panel */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col h-full overflow-y-auto px-4 py-6">

          {/* Document Title header */}
          <div className="mb-6 flex flex-col space-y-1 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <label htmlFor="ribbon-doc-title" className="text-[9px] uppercase font-bold tracking-widest text-zinc-400">{t(uiLanguage, 'documentTitle')}</label>
            <input
              id="ribbon-doc-title"
              value={currentDoc?.title || ''}
              onChange={(e) => onTitleChange(e.target.value)}
              className={`bg-transparent text-sm font-bold outline-none border-b border-transparent focus:border-blue-500 w-full transition-colors
                ${darkMode ? 'text-white placeholder-zinc-700' : 'text-zinc-800 placeholder-zinc-400'}
              `}
              placeholder={t(uiLanguage, 'untitledDocument')}
            />
          </div>

          {/* Group contents depending on active tab */}
          <div className="flex-1 flex flex-col space-y-1" data-ribbon-panel="">
            {shownTab === 'Home' && <HomeTab {...props} />}
            {shownTab === 'Insert' && <InsertTab {...props} />}
            {shownTab === 'Layout' && <LayoutTab {...props} />}
            {shownTab === 'References' && <ReferencesTab {...props} />}
            {shownTab === 'Review' && <ReviewTab {...props} />}
            {shownTab === 'View' && <ViewTab {...props} readAloud={readAloud} />}
            {shownTab === 'Table Design' && <TableTab {...props} />}
            {shownTab === 'Image Format' && <ImageTab {...props} />}
          </div>
        </div>
      )}
    </div>
  );
};
