import React from 'react';
import { DocumentData } from '../types';
import {
  Plus, Download, Printer, Save, FolderOpen, History,
  FileDown, LayoutTemplate, Settings, Moon, Sun, Cloud, ChevronDown, Upload, X
} from 'lucide-react';
import { exportToDoc, exportToDocx, exportToPdf, exportToTxt, exportToHtml, exportToMarkdown, exportAllDocuments } from '../utils/export';
import { importArchive } from '../utils/import';
import { LanguageCode, t } from '../utils/translations';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  documents: DocumentData[];
  currentDoc: DocumentData | null;
  onSelectDoc: (id: string) => void;
  onNewDoc: () => void;
  onNewFromTemplate: () => void;
  onImportDoc: () => void;
  onSave: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onShowHistory: () => void;
  onShowSettings: () => void;
  onShowStats: () => void;
  onRemoveFromHistory: (id: string) => void;
  uiLanguage: LanguageCode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen, setIsOpen, documents, currentDoc, onSelectDoc, onNewDoc, onNewFromTemplate, onImportDoc,
  onSave, darkMode, toggleDarkMode, onShowHistory, onShowSettings, onShowStats, onRemoveFromHistory, uiLanguage
}) => {
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [confirmingRemove, setConfirmingRemove] = React.useState<string | null>(null);
  const archiveInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportAll = async () => {
    await exportAllDocuments(documents);
    setShowExportMenu(false);
  };

  const handleImportArchive = () => {
    archiveInputRef.current?.click();
  };

  const handleArchiveFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await importArchive(file);
    if (result.success && result.documents.length > 0) {
      // We need to pass this back to App.tsx to add to documents
      // For now, store in localStorage directly
      const existingDocs = JSON.parse(localStorage.getItem('penko_writer_docs') || '[]');
      const updatedDocs = [...existingDocs, ...result.documents];
      localStorage.setItem('penko_writer_docs', JSON.stringify(updatedDocs));

      alert(`Successfully imported ${result.documents.length} document(s). Please refresh the page to see them.`);
      window.location.reload();
    } else {
      alert(result.error || 'Failed to import archive');
    }

    // Reset input
    if (archiveInputRef.current) {
      archiveInputRef.current.value = '';
    }
  };
  const railBg = darkMode ? 'bg-[#1a1a1a] border-r border-gray-800' : 'bg-white border-r border-gray-200';
  const drawerBg = darkMode ? 'bg-[#111] border-r border-gray-800' : 'bg-white border-r border-gray-200';

  return (
    <div className="flex h-full z-50 shrink-0 relative">
        {/* Permanent Rail */}
        <div className={`w-16 flex flex-col items-center py-4 space-y-6 z-20 relative ${railBg}`}>
           <div className="mb-2">
              <button 
                 type="button"
                 onClick={onShowStats}
                 className="w-10 h-10 bg-blue-600 hover:bg-blue-700 transition-colors rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30"
                 title="About CloudWord"
              >
                 <Cloud size={20} strokeWidth={3} />
              </button>
           </div>

           <RailButton 
             icon={<FolderOpen size={24} />} 
             label={t(uiLanguage, 'files')}
             onClick={() => setIsOpen(!isOpen)} 
             active={isOpen}
             darkMode={darkMode}
           />
           
           <RailButton 
             icon={<Plus size={24} />} 
             label={t(uiLanguage, 'new')}
             onClick={onNewDoc} 
             darkMode={darkMode}
           />

           <RailButton
             icon={<LayoutTemplate size={24} />}
             label={t(uiLanguage, 'templates')}
             onClick={onNewFromTemplate}
             darkMode={darkMode}
           />

           <RailButton
             icon={<Upload size={24} />}
             label="Import"
             onClick={onImportDoc}
             darkMode={darkMode}
           />

           <div className="flex-1"></div>

           <RailButton 
             icon={darkMode ? <Sun size={24} /> : <Moon size={24} />} 
             label={darkMode ? t(uiLanguage, 'lightMode') : t(uiLanguage, 'darkMode')} 
             onClick={toggleDarkMode} 
             darkMode={darkMode}
           />
           
           <RailButton 
             icon={<Settings size={24} />} 
             label={t(uiLanguage, 'settings')}
             onClick={onShowSettings} 
             darkMode={darkMode}
           />
        </div>

        {/* Expandable Drawer */}
        <div 
          className={`flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${drawerBg}`}
          style={{ width: isOpen ? '16rem' : '0px', opacity: isOpen ? 1 : 0 }}
        >
            <div className="w-64 flex flex-col h-full"> {/* Inner container to prevent squishing */}
                <div className="p-5 border-b border-gray-200/10">
                   <div className="flex justify-between items-center mb-2">
                     <h2 className="text-lg font-bold">{t(uiLanguage, 'documents')}</h2>
                     <span className="text-xs opacity-50">{documents.length} {t(uiLanguage, 'items')}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className={`text-2xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>Penko Writer</span>
                     <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">ALPHA</span>
                   </div>
                   <p className="text-[10px] opacity-50 mt-1">v1.0.0-alpha.1 • Experimental Release</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="relative group mb-1">
                        <button
                          type="button"
                          onClick={() => onSelectDoc(doc.id)}
                          className={`w-full text-left px-4 py-3 rounded-lg flex flex-col gap-1 transition-all
                            ${doc.id === currentDoc?.id
                              ? (darkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-blue-50 text-blue-700 shadow-sm')
                              : (darkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-50 text-gray-700')
                            }
                          `}
                        >
                          <span className="font-medium truncate w-full pr-6">{doc.title || 'Untitled Document'}</span>
                          <span className="text-[10px] opacity-60">
                            {new Date(doc.lastModified).toLocaleDateString()}
                          </span>
                        </button>
                        {confirmingRemove === doc.id ? (
                          <div
                            className={`absolute top-2 right-2 flex gap-1 p-1 rounded shadow-lg z-10
                              ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}
                            `}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromHistory(doc.id);
                                setConfirmingRemove(null);
                              }}
                              className={`px-2 py-1 text-xs rounded transition-colors
                                ${darkMode ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100'}
                              `}
                              title={t(uiLanguage, 'delete')}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmingRemove(null);
                              }}
                              className={`px-2 py-1 text-xs rounded transition-colors
                                ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                              `}
                              title={t(uiLanguage, 'cancel')}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingRemove(doc.id);
                            }}
                            className={`absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity
                              ${darkMode ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-600'}
                            `}
                            title={t(uiLanguage, 'removeFromHistory')}
                            aria-label={t(uiLanguage, 'removeFromHistory')}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>

                <div className={`p-4 border-t space-y-1 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                    <DrawerAction icon={<Save size={18} />} label={t(uiLanguage, 'saveNow')} onClick={onSave} darkMode={darkMode} />
                    <DrawerAction icon={<History size={18} />} label={t(uiLanguage, 'history')} onClick={onShowHistory} darkMode={darkMode} />

                    {/* Export Menu */}
                    <div className="relative">
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        aria-haspopup="menu"
                        aria-expanded={showExportMenu}
                        className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all
                          ${darkMode ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}
                        `}
                      >
                        <Download size={18} />
                        <span className="flex-1 text-left text-sm">Export Document</span>
                        <ChevronDown size={16} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                      </button>

                      {showExportMenu && (
                        <div role="menu" className={`mt-1 ml-4 space-y-1 pl-4 border-l-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <button
                            role="menuitem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { if (currentDoc) exportToDoc(currentDoc); setShowExportMenu(false); }}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all
                              ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}
                            `}
                          >
                            Export as .DOC
                          </button>
                          <button
                            role="menuitem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { if (currentDoc) exportToDocx(currentDoc); setShowExportMenu(false); }}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all
                              ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}
                            `}
                          >
                            {t(uiLanguage, 'exportAsDocx')}
                          </button>
                          <button
                            role="menuitem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { if (currentDoc) exportToPdf(currentDoc); setShowExportMenu(false); }}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all
                              ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}
                            `}
                          >
                            {t(uiLanguage, 'exportAsPdf')}
                          </button>
                          <button
                            role="menuitem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { if (currentDoc) exportToHtml(currentDoc); setShowExportMenu(false); }}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all
                              ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}
                            `}
                          >
                            {t(uiLanguage, 'exportAsHtml')}
                          </button>
                          <button
                            role="menuitem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { if (currentDoc) exportToTxt(currentDoc); setShowExportMenu(false); }}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all
                              ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}
                            `}
                          >
                            {t(uiLanguage, 'exportAsTxt')}
                          </button>
                          <button
                            role="menuitem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { if (currentDoc) exportToMarkdown(currentDoc); setShowExportMenu(false); }}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all
                              ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}
                            `}
                          >
                            {t(uiLanguage, 'exportAsMarkdown')}
                          </button>

                          {/* Divider */}
                          <div className={`my-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} />

                          {/* Export All */}
                          <button
                            role="menuitem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleExportAll}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all font-medium
                              ${darkMode ? 'hover:bg-blue-600/20 text-blue-400' : 'hover:bg-blue-50 text-blue-600'}
                            `}
                          >
                            📦 {t(uiLanguage, 'exportAllAsZip')}
                          </button>

                          {/* Import Archive */}
                          <button
                            role="menuitem"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleImportArchive}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all font-medium
                              ${darkMode ? 'hover:bg-green-600/20 text-green-400' : 'hover:bg-green-50 text-green-600'}
                            `}
                          >
                            📥 Import Archive
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Hidden file input for archive import */}
                    <input
                      ref={archiveInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleArchiveFileChange}
                      className="hidden"
                    />
                </div>
            </div>
        </div>
    </div>
  );
};

const RailButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; darkMode: boolean }> = ({ icon, label, onClick, active, darkMode }) => (
    <button 
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`p-3 rounded-xl transition-all group relative
         ${active 
            ? 'bg-blue-600 text-white shadow-md' 
            : (darkMode ? 'text-gray-400 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-blue-600')
         }
      `}
    >
       {icon}
       <span className="absolute left-14 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
          {label}
       </span>
    </button>
);

const DrawerAction: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; darkMode: boolean }> = ({ icon, label, onClick, darkMode }) => (
    <button 
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
        ${darkMode ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
      `}
    >
       {icon}
       {label}
    </button>
);