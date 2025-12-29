import React, { useState, useRef, useEffect } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List as ListIcon, ListOrdered, Undo, Redo, Image as ImageIcon,
  Type, Strikethrough, Subscript, Superscript,
  Indent, Outdent, Link as LinkIcon, Table, Minus, FileText, Eye, Check,
  Search, Layout, MoveVertical, RectangleVertical,
  Maximize, Clipboard, Info, Trash2, Columns, Rows, MonitorPlay, Volume2, Grid3X3,
  ChevronUp, ChevronDown, Printer, StickyNote, Merge, Split, Palette, RotateCw, Square,
  Users, MessageSquare, Sigma, BookOpen, BookMarked, Code2, Keyboard, Target, Network
} from 'lucide-react';
import { COLORS, FONTS, FONT_SIZES } from '../constants';
import { DocumentData, PageConfig, SelectionContext } from '../types';
import { LanguageCode, t } from '../utils/translations';

interface RibbonProps {
  onCommand: (cmd: string, val?: string | null) => void;
  currentDoc: DocumentData | null;
  onTitleChange: (t: string) => void;
  showRuler: boolean;
  setShowRuler: (v: boolean) => void;
  onUpdatePageConfig: (config: Partial<PageConfig>) => void;
  onFind: () => void;
  darkMode: boolean;
  pasteAsPlainText: boolean;
  togglePasteAsPlainText: () => void;
  onShowStats: () => void;
  onToggleZenMode: () => void;
  onToggleFocusMode: () => void;
  selectionContext: SelectionContext;
  onTableAction: (action: string) => void;
  onImageAction: (action: string, value?: any) => void;
  onPresent: () => void;
  onShowHeaderFooter: () => void;
  onShowLinkDialog: () => void;
  onShowCommentsPanel: () => void;
  onCreateComment: () => void;
  onShowCollaboration: () => void;
  onShowTrackChangesPanel: () => void;
  onToggleTracking: () => void;
  trackingEnabled: boolean;
  onShowEquationDialog: () => void;
  onShowTOCDialog: () => void;
  onShowFootnoteDialog: () => void;
  onShowCitationDialog: () => void;
  onShowCodeBlockDialog: () => void;
  uiLanguage: LanguageCode;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  isScreenplay: boolean;
  onToggleScreenplay: () => void;
  isMarkdownMode: boolean;
  onToggleMarkdown: () => void;
  onShowKeyboardShortcuts: () => void;
  showOutline: boolean;
  onToggleOutline: () => void;
  onShowDiagramEditor: () => void;
  onShowSpellCheck: () => void;
}

export const Ribbon: React.FC<RibbonProps> = ({
  onCommand, currentDoc, onTitleChange, showRuler, setShowRuler, onUpdatePageConfig, onFind,
  darkMode, pasteAsPlainText, togglePasteAsPlainText, onShowStats, onToggleZenMode, onToggleFocusMode,
  selectionContext, onTableAction, onImageAction, onPresent, onShowHeaderFooter, onShowLinkDialog, onShowCommentsPanel, onCreateComment, onShowCollaboration, onShowTrackChangesPanel, onToggleTracking, trackingEnabled, onShowEquationDialog, onShowTOCDialog, onShowFootnoteDialog, onShowCitationDialog, onShowCodeBlockDialog, uiLanguage, isCollapsed, setIsCollapsed, isScreenplay, onToggleScreenplay, isMarkdownMode, onToggleMarkdown, onShowKeyboardShortcuts, showOutline, onToggleOutline, onShowDiagramEditor, onShowSpellCheck
}) => {
  const [activeTab, setActiveTab] = useState('Home');
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'highlight' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectionContext.type === 'table') setActiveTab('Table Design');
    if (selectionContext.type === 'image') setActiveTab('Image Format');
  }, [selectionContext.type]);

  const tabs = [
    { id: 'Home', label: t(uiLanguage, 'tabHome') },
    { id: 'Insert', label: t(uiLanguage, 'tabInsert') },
    { id: 'Layout', label: t(uiLanguage, 'tabLayout') },
    { id: 'Review', label: t(uiLanguage, 'tabReview') },
    { id: 'View', label: t(uiLanguage, 'tabView') }
  ];

  if (selectionContext.type === 'table') tabs.push({ id: 'Table Design', label: t(uiLanguage, 'tabTable') });
  if (selectionContext.type === 'image') tabs.push({ id: 'Image Format', label: t(uiLanguage, 'tabImage') });

  const handleColor = (type: 'text' | 'highlight', color: string) => {
    onCommand(type === 'text' ? 'foreColor' : 'hiliteColor', color);
    setShowColorPicker(null);
  };

  const insertTable = () => {
    const html = `
      <table style="width:100%; border-collapse: collapse; margin: 10px 0;">
        <tbody>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        </tbody>
      </table>
    `;
    onCommand('insertHTML', html);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onCommand('insertImage', event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReadAloud = () => {
     if ('speechSynthesis' in window) {
         if (window.speechSynthesis.speaking) {
             window.speechSynthesis.cancel();
         } else {
             const text = currentDoc?.content.replace(/<[^>]+>/g, ' ') || '';
             const utterance = new SpeechSynthesisUtterance(text);
             if (currentDoc?.language) utterance.lang = currentDoc.language;
             window.speechSynthesis.speak(utterance);
         }
     } else {
         alert('Text-to-speech is not supported in this browser.');
     }
  };

  const ribbonBg = darkMode ? 'bg-[#1e1e1e] border-gray-700' : 'bg-white border-white/50';
  const shadowClass = darkMode ? 'shadow-xl shadow-black/40' : 'shadow-xl shadow-gray-200/50';
  
  return (
    <div className={`rounded-2xl border backdrop-blur-xl transition-colors ${ribbonBg} ${shadowClass}`}>
      
      {/* Header: Title + Tabs */}
      <div className={`flex items-center justify-between px-6 py-2 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
         
         {/* Document Title Input */}
         <div className="flex-shrink-0 mr-8">
            <input
              value={currentDoc?.title || ''}
              onChange={(e) => onTitleChange(e.target.value)}
              className={`bg-transparent text-lg font-bold outline-none border-b border-transparent focus:border-blue-500 w-48 transition-colors
                ${darkMode ? 'text-white placeholder-gray-600' : 'text-gray-800 placeholder-gray-400'}
              `}
              placeholder="Untitled Document"
            />
         </div>

         {/* Tabs Pill Switcher */}
         <div role="tablist" aria-label="Ribbon tabs" className="flex space-x-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            {tabs.map((tab, index) => {
                let isActive = activeTab === tab.id;
                let activeClass = darkMode ? 'bg-gray-700 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm';
                let inactiveClass = darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900';

                // Contextual colors
                if(tab.id === 'Table Design' && isActive) activeClass = 'bg-purple-600 text-white';
                if(tab.id === 'Image Format' && isActive) activeClass = 'bg-pink-600 text-white';

                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`${tab.id}-panel`}
                    id={`${tab.id}-tab`}
                    tabIndex={isActive ? 0 : -1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        const nextIndex = (index + 1) % tabs.length;
                        setActiveTab(tabs[nextIndex].id);
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const prevIndex = (index - 1 + tabs.length) % tabs.length;
                        setActiveTab(tabs[prevIndex].id);
                      } else if (e.key === 'Home') {
                        e.preventDefault();
                        setActiveTab(tabs[0].id);
                      } else if (e.key === 'End') {
                        e.preventDefault();
                        setActiveTab(tabs[tabs.length - 1].id);
                      }
                    }}
                    className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${isActive ? activeClass : inactiveClass}`}
                  >
                    {tab.label}
                  </button>
                )
            })}
         </div>

         {/* Right Side: Collapse Button */}
         <button
           onClick={() => setIsCollapsed(!isCollapsed)}
           aria-label={isCollapsed ? 'Expand Ribbon' : 'Collapse Ribbon'}
           aria-expanded={!isCollapsed}
           className={`p-2 rounded-lg transition-all ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
         >
           {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
         </button>
      </div>

      {/* Toolbar Content - Centered */}
      {!isCollapsed && (<div role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`} className={`h-24 flex items-center justify-center px-6 py-2 space-x-6 overflow-x-auto`}>

        {activeTab === 'Home' && (
          <>
            <RibbonGroup label={t(uiLanguage, 'grpClipboard')} darkMode={darkMode}>
                 <div className="flex space-x-1">
                   <RibbonBtn icon={<Undo size={20} />} label={t(uiLanguage, 'undo')} onClick={() => onCommand('undo')} darkMode={darkMode} tooltip="Undo (Ctrl+Z)" />
                   <RibbonBtn icon={<Redo size={20} />} label={t(uiLanguage, 'redo')} onClick={() => onCommand('redo')} darkMode={darkMode} tooltip="Redo (Ctrl+Y)" />
                 </div>
                 <div className="flex items-center space-x-2 bg-black/5 dark:bg-white/5 px-2 py-1 rounded ml-2" title={t(uiLanguage, 'pastePlainDesc')}>
                    <input type="checkbox" checked={pasteAsPlainText} onChange={togglePasteAsPlainText} className="w-3.5 h-3.5 cursor-pointer accent-blue-600" />
                    <span className="text-[10px] opacity-80 whitespace-nowrap">{t(uiLanguage, 'pastePlain')}</span>
                 </div>
            </RibbonGroup>

            <Divider darkMode={darkMode} />

            <RibbonGroup label={t(uiLanguage, 'grpTypography')} darkMode={darkMode}>
              <div className="flex flex-col space-y-2 h-full justify-center">
                <div className="flex space-x-2 items-center">
                  <select 
                    className={`border text-sm px-2 py-1 w-32 rounded-lg outline-none focus:ring-2 ring-blue-500/20 transition-all ${darkMode ? 'bg-[#333] border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                    onChange={(e) => onCommand('fontName', e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {FONTS.map(f => <option key={f} value={f} style={{fontFamily: f}}>{f}</option>)}
                  </select>
                  <select 
                    className={`border text-sm px-2 py-1 w-16 rounded-lg outline-none focus:ring-2 ring-blue-500/20 transition-all ${darkMode ? 'bg-[#333] border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                    onChange={(e) => onCommand('fontSize', e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                     {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex space-x-1 items-center">
                    <RibbonIconBtn icon={<Bold size={16} />} active={document.queryCommandState?.('bold')} onClick={() => onCommand('bold')} darkMode={darkMode} title="Bold (Ctrl+B)" />
                    <RibbonIconBtn icon={<Italic size={16} />} active={document.queryCommandState?.('italic')} onClick={() => onCommand('italic')} darkMode={darkMode} title="Italic (Ctrl+I)" />
                    <RibbonIconBtn icon={<Underline size={16} />} active={document.queryCommandState?.('underline')} onClick={() => onCommand('underline')} darkMode={darkMode} title="Underline (Ctrl+U)" />
                    <RibbonIconBtn icon={<Strikethrough size={16} />} active={document.queryCommandState?.('strikethrough')} onClick={() => onCommand('strikethrough')} darkMode={darkMode} title="Strikethrough" />
                    
                    <div className="w-2"></div>

                    <RibbonIconBtn icon={<Subscript size={16} />} active={document.queryCommandState?.('subscript')} onClick={() => onCommand('subscript')} darkMode={darkMode} />
                    <RibbonIconBtn icon={<Superscript size={16} />} active={document.queryCommandState?.('superscript')} onClick={() => onCommand('superscript')} darkMode={darkMode} />

                    <div className="w-2"></div>
                    
                    <button className={`p-1 rounded relative ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}>
                      <div className="flex flex-col items-center">
                          <span className="font-bold font-serif text-sm leading-none">A</span>
                          <div className="h-0.5 w-3 bg-red-600 mt-0.5"></div>
                      </div>
                      {showColorPicker === 'text' && (
                        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 shadow-xl rounded-lg p-2 grid grid-cols-6 gap-1 z-50 w-48 animate-in fade-in zoom-in-95 duration-100">
                          {COLORS.map(c => (
                            <button key={c} onMouseDown={(e) => e.preventDefault()} className="w-6 h-6 rounded-full border border-gray-100 hover:scale-110 transition-transform" style={{backgroundColor: c}} onClick={() => handleColor('text', c)} />
                          ))}
                        </div>
                      )}
                    </button>
                    
                     <button className={`p-1 rounded relative ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setShowColorPicker(showColorPicker === 'highlight' ? null : 'highlight')}>
                      <div className="flex flex-col items-center">
                         <span className="font-bold font-serif text-sm leading-none bg-yellow-300 px-0.5 text-black rounded-sm">ab</span>
                         <div className="h-0.5 w-3 bg-yellow-300 mt-0.5"></div>
                      </div>
                       {showColorPicker === 'highlight' && (
                        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 shadow-xl rounded-lg p-2 grid grid-cols-6 gap-1 z-50 w-48 animate-in fade-in zoom-in-95 duration-100">
                          {COLORS.map(c => (
                            <button key={c} onMouseDown={(e) => e.preventDefault()} className="w-6 h-6 rounded-full border border-gray-100 hover:scale-110 transition-transform" style={{backgroundColor: c}} onClick={() => handleColor('highlight', c)} />
                          ))}
                        </div>
                      )}
                    </button>
                </div>
              </div>
            </RibbonGroup>

            <Divider darkMode={darkMode} />

            <RibbonGroup label={t(uiLanguage, 'grpParagraph')} darkMode={darkMode}>
              <div className="flex flex-col space-y-2 h-full justify-center">
                 <div className="flex space-x-1 items-center">
                    <RibbonIconBtn icon={<AlignLeft size={16} />} onClick={() => onCommand('justifyLeft')} darkMode={darkMode} />
                    <RibbonIconBtn icon={<AlignCenter size={16} />} onClick={() => onCommand('justifyCenter')} darkMode={darkMode} />
                    <RibbonIconBtn icon={<AlignRight size={16} />} onClick={() => onCommand('justifyRight')} darkMode={darkMode} />
                    <RibbonIconBtn icon={<AlignJustify size={16} />} onClick={() => onCommand('justifyFull')} darkMode={darkMode} />
                 </div>
                 <div className="flex space-x-1 items-center">
                    <RibbonIconBtn icon={<ListOrdered size={16} />} onClick={() => onCommand('insertOrderedList')} darkMode={darkMode} />
                    <RibbonIconBtn icon={<ListIcon size={16} />} onClick={() => onCommand('insertUnorderedList')} darkMode={darkMode} />
                    <div className="w-2"></div>
                    <RibbonIconBtn icon={<Outdent size={16} />} onClick={() => onCommand('outdent')} darkMode={darkMode} />
                    <RibbonIconBtn icon={<Indent size={16} />} onClick={() => onCommand('indent')} darkMode={darkMode} />
                 </div>
              </div>
            </RibbonGroup>

            <Divider darkMode={darkMode} />

            <RibbonGroup label={t(uiLanguage, 'grpTools')} darkMode={darkMode}>
               <div className="flex space-x-1">
                 <RibbonBtn icon={<Search size={20} />} label={t(uiLanguage, 'find')} onClick={onFind} darkMode={darkMode} tooltip="Find (Ctrl+F)" />
                 <RibbonBtn icon={<Type size={20} />} label={t(uiLanguage, 'clean')} onClick={() => onCommand('removeFormat')} darkMode={darkMode} tooltip="Remove Formatting" />
               </div>
            </RibbonGroup>
          </>
        )}

        {activeTab === 'Insert' && (
          <>
             <RibbonGroup label={t(uiLanguage, 'grpContent')} darkMode={darkMode}>
                <div className="flex space-x-1">
                  <RibbonBtn icon={<Table size={20} />} label={t(uiLanguage, 'table')} onClick={insertTable} darkMode={darkMode} tooltip="Insert Table" />

                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  <RibbonBtn icon={<ImageIcon size={20} />} label={t(uiLanguage, 'image')} onClick={() => fileInputRef.current?.click()} darkMode={darkMode} tooltip="Insert Image" />

                  <RibbonBtn icon={<LinkIcon size={20} />} label={t(uiLanguage, 'link')} onClick={onShowLinkDialog} darkMode={darkMode} tooltip="Insert Link (Ctrl+K)" />

                  <RibbonBtn icon={<Sigma size={20} />} label={t(uiLanguage, 'equation')} onClick={onShowEquationDialog} darkMode={darkMode} />

                  <RibbonBtn icon={<BookOpen size={20} />} label={t(uiLanguage, 'tableOfContents')} onClick={onShowTOCDialog} darkMode={darkMode} />

                  <RibbonBtn icon={<FileText size={20} />} label={t(uiLanguage, 'footnote')} onClick={onShowFootnoteDialog} darkMode={darkMode} />

                  <RibbonBtn icon={<BookMarked size={20} />} label={t(uiLanguage, 'citation')} onClick={onShowCitationDialog} darkMode={darkMode} />

                  <RibbonBtn icon={<Code2 size={20} />} label={t(uiLanguage, 'codeBlock')} onClick={onShowCodeBlockDialog} darkMode={darkMode} />

                  <RibbonBtn icon={<Network size={20} />} label={t(uiLanguage, 'diagramEditor')} onClick={onShowDiagramEditor} darkMode={darkMode} tooltip="Insert Diagram" />
                </div>
             </RibbonGroup>
             <Divider darkMode={darkMode} />
             <RibbonGroup label={t(uiLanguage, 'grpLayout')} darkMode={darkMode}>
                <RibbonBtn icon={<Minus size={20} />} label={t(uiLanguage, 'break')} onClick={() => {
                  const html = '<div style="page-break-after: always; height: 1px; background: #ccc; margin: 20px 0;"></div>';
                  onCommand('insertHTML', html);
                }} darkMode={darkMode} />
             </RibbonGroup>
          </>
        )}

        {activeTab === 'Table Design' && (
            <>
            <RibbonGroup label={t(uiLanguage, 'grpRowsCols')} darkMode={darkMode}>
                <div className="flex space-x-2">
                    <RibbonBtn icon={<Rows size={20} />} label={t(uiLanguage, 'addRow')} onClick={() => onTableAction('addRow')} darkMode={darkMode} />
                    <RibbonBtn icon={<Columns size={20} />} label={t(uiLanguage, 'addCol')} onClick={() => onTableAction('addCol')} darkMode={darkMode} />
                    <RibbonBtn icon={<Trash2 size={20} className="text-red-500" />} label={t(uiLanguage, 'delRow')} onClick={() => onTableAction('delRow')} darkMode={darkMode} />
                    <RibbonBtn icon={<Trash2 size={20} className="text-red-500" />} label={t(uiLanguage, 'delCol')} onClick={() => onTableAction('delCol')} darkMode={darkMode} />
                </div>
            </RibbonGroup>
            <Divider darkMode={darkMode} />
            <RibbonGroup label="Merge" darkMode={darkMode}>
                <div className="flex space-x-2">
                    <RibbonBtn icon={<Merge size={20} />} label="Merge Cells" onClick={() => onTableAction('mergeCells')} darkMode={darkMode} />
                    <RibbonBtn icon={<Split size={20} />} label="Split Cell" onClick={() => onTableAction('splitCell')} darkMode={darkMode} />
                </div>
            </RibbonGroup>
            <Divider darkMode={darkMode} />
            <RibbonGroup label="Table Style" darkMode={darkMode}>
                <div className="flex space-x-1">
                    <RibbonBtn icon={<Palette size={18} />} label="Default" onClick={() => onTableAction('setStyle', 'default')} darkMode={darkMode} />
                    <RibbonBtn icon={<Palette size={18} />} label="Bordered" onClick={() => onTableAction('setStyle', 'bordered')} darkMode={darkMode} />
                    <RibbonBtn icon={<Palette size={18} />} label="Striped" onClick={() => onTableAction('setStyle', 'striped')} darkMode={darkMode} />
                    <RibbonBtn icon={<Palette size={18} />} label="Minimal" onClick={() => onTableAction('setStyle', 'minimal')} darkMode={darkMode} />
                </div>
            </RibbonGroup>
            <Divider darkMode={darkMode} />
            <RibbonGroup label="Column Width" darkMode={darkMode}>
                <div className="flex space-x-1">
                    <RibbonBtn icon={<MoveVertical size={18} />} label="Auto" onClick={() => onTableAction('setWidth', 'auto')} darkMode={darkMode} />
                    <RibbonBtn icon={<MoveVertical size={18} />} label="25%" onClick={() => onTableAction('setWidth', '25%')} darkMode={darkMode} />
                    <RibbonBtn icon={<MoveVertical size={18} />} label="50%" onClick={() => onTableAction('setWidth', '50%')} darkMode={darkMode} />
                    <RibbonBtn icon={<MoveVertical size={18} />} label="75%" onClick={() => onTableAction('setWidth', '75%')} darkMode={darkMode} />
                </div>
            </RibbonGroup>
            </>
        )}

        {activeTab === 'Image Format' && (
            <>
              <RibbonGroup label={t(uiLanguage, 'grpSizing')} darkMode={darkMode}>
                 <div className="flex space-x-2">
                    <RibbonBtn icon={<Minus size={20} />} label="25%" onClick={() => onImageAction('resize', 25)} darkMode={darkMode} />
                    <RibbonBtn icon={<Minus size={20} />} label="50%" onClick={() => onImageAction('resize', 50)} darkMode={darkMode} />
                    <RibbonBtn icon={<Maximize size={20} />} label="100%" onClick={() => onImageAction('resize', 100)} darkMode={darkMode} />
                 </div>
              </RibbonGroup>
              <Divider darkMode={darkMode} />
              <RibbonGroup label={t(uiLanguage, 'grpAlign')} darkMode={darkMode}>
                 <div className="flex space-x-2">
                    <RibbonIconBtn icon={<AlignLeft size={20} />} onClick={() => onImageAction('align', 'left')} darkMode={darkMode} />
                    <RibbonIconBtn icon={<AlignCenter size={20} />} onClick={() => onImageAction('align', 'center')} darkMode={darkMode} />
                    <RibbonIconBtn icon={<AlignRight size={20} />} onClick={() => onImageAction('align', 'right')} darkMode={darkMode} />
                 </div>
              </RibbonGroup>
              <Divider darkMode={darkMode} />
              <RibbonGroup label="Rotate" darkMode={darkMode}>
                 <div className="flex space-x-2">
                    <RibbonBtn icon={<RotateCw size={18} />} label="90°" onClick={() => onImageAction('rotate', 90)} darkMode={darkMode} />
                    <RibbonBtn icon={<RotateCw size={18} />} label="180°" onClick={() => onImageAction('rotate', 180)} darkMode={darkMode} />
                    <RibbonBtn icon={<RotateCw size={18} />} label="-90°" onClick={() => onImageAction('rotate', -90)} darkMode={darkMode} />
                 </div>
              </RibbonGroup>
              <Divider darkMode={darkMode} />
              <RibbonGroup label="Border" darkMode={darkMode}>
                 <div className="flex space-x-1">
                    <RibbonBtn icon={<Square size={18} />} label="None" onClick={() => onImageAction('border', 'none')} darkMode={darkMode} />
                    <RibbonBtn icon={<Square size={18} />} label="Thin" onClick={() => onImageAction('border', 'thin')} darkMode={darkMode} />
                    <RibbonBtn icon={<Square size={18} />} label="Medium" onClick={() => onImageAction('border', 'medium')} darkMode={darkMode} />
                    <RibbonBtn icon={<Square size={18} />} label="Thick" onClick={() => onImageAction('border', 'thick')} darkMode={darkMode} />
                    <RibbonBtn icon={<Square size={18} />} label="Rounded" onClick={() => onImageAction('border', 'rounded')} darkMode={darkMode} />
                 </div>
              </RibbonGroup>
            </>
        )}

        {activeTab === 'Layout' && (
           <>
           <RibbonGroup label={t(uiLanguage, 'grpPageSetup')} darkMode={darkMode}>
              <div className="flex space-x-2">
                 <Dropdown
                    icon={<Layout size={20} />}
                    label={t(uiLanguage, 'margins')}
                    items={[
                      {label: 'Normal', onClick: () => onUpdatePageConfig({margins: 'normal'})},
                      {label: 'Narrow', onClick: () => onUpdatePageConfig({margins: 'narrow'})},
                      {label: 'Wide', onClick: () => onUpdatePageConfig({margins: 'wide'})},
                    ]}
                    darkMode={darkMode}
                 />
                 <Dropdown
                    icon={<RectangleVertical size={20} />}
                    label={t(uiLanguage, 'orientation')}
                    items={[
                      {label: 'Portrait', onClick: () => onUpdatePageConfig({orientation: 'portrait'})},
                      {label: 'Landscape', onClick: () => onUpdatePageConfig({orientation: 'landscape'})},
                    ]}
                    darkMode={darkMode}
                 />
                  <Dropdown
                    icon={<FileText size={20} />}
                    label={t(uiLanguage, 'size')}
                    items={[
                      {label: 'A4', onClick: () => onUpdatePageConfig({size: 'A4'})},
                      {label: 'Letter', onClick: () => onUpdatePageConfig({size: 'Letter'})},
                    ]}
                    darkMode={darkMode}
                 />
                 <Dropdown
                    icon={<Grid3X3 size={20} />}
                    label={t(uiLanguage, 'columns')}
                    items={[
                      {label: 'One', onClick: () => onUpdatePageConfig({cols: 1})},
                      {label: 'Two', onClick: () => onUpdatePageConfig({cols: 2})},
                      {label: 'Three', onClick: () => onUpdatePageConfig({cols: 3})},
                    ]}
                    darkMode={darkMode}
                 />
              </div>
           </RibbonGroup>
           <Divider darkMode={darkMode} />
           <RibbonGroup label="Header & Footer" darkMode={darkMode}>
              <div className="flex space-x-1">
                 <RibbonBtn icon={<StickyNote size={20} />} label="Header & Footer" onClick={onShowHeaderFooter} darkMode={darkMode} />
              </div>
           </RibbonGroup>
           </>
        )}

        {activeTab === 'Review' && (
          <>
            <RibbonGroup label={t(uiLanguage, 'grpTools')} darkMode={darkMode}>
              <div className="flex space-x-2">
                <RibbonBtn icon={<Check size={20} />} label={t(uiLanguage, 'spellCheck')} onClick={onShowSpellCheck} darkMode={darkMode} />
              </div>
            </RibbonGroup>
            <Divider darkMode={darkMode} />
            <RibbonGroup label={t(uiLanguage, 'collaboration')} darkMode={darkMode}>
              <div className="flex space-x-2">
                <RibbonBtn icon={<Users size={20} />} label={t(uiLanguage, 'collaborate')} onClick={onShowCollaboration} darkMode={darkMode} />
              </div>
            </RibbonGroup>
            <Divider darkMode={darkMode} />
            <RibbonGroup label={t(uiLanguage, 'comments')} darkMode={darkMode}>
              <div className="flex space-x-2">
                <RibbonBtn icon={<MessageSquare size={20} />} label={t(uiLanguage, 'newComment')} onClick={onCreateComment} darkMode={darkMode} />
                <RibbonBtn icon={<MessageSquare size={20} />} label={t(uiLanguage, 'showComments')} onClick={onShowCommentsPanel} darkMode={darkMode} />
              </div>
            </RibbonGroup>
            <Divider darkMode={darkMode} />
            <RibbonGroup label={t(uiLanguage, 'tracking')} darkMode={darkMode}>
              <div className="flex space-x-2">
                <RibbonBtn
                  icon={<Eye size={20} />}
                  label={trackingEnabled ? t(uiLanguage, 'stopTracking') : t(uiLanguage, 'trackChanges')}
                  onClick={onToggleTracking}
                  darkMode={darkMode}
                  active={trackingEnabled}
                />
                <RibbonBtn icon={<FileText size={20} />} label={t(uiLanguage, 'showChanges')} onClick={onShowTrackChangesPanel} darkMode={darkMode} />
              </div>
            </RibbonGroup>
          </>
        )}

        {activeTab === 'View' && (
          <>
            <RibbonGroup label={t(uiLanguage, 'grpMode')} darkMode={darkMode}>
               <div className="flex space-x-1">
                  <RibbonBtn icon={<Target size={20} />} label={t(uiLanguage, 'focusMode')} onClick={onToggleFocusMode} darkMode={darkMode} tooltip="Focus Mode - Distraction-free writing" />
                  <RibbonBtn icon={<Maximize size={20} />} label="Zen" onClick={onToggleZenMode} darkMode={darkMode} tooltip="Zen Mode - Minimal UI" />
                  <RibbonBtn icon={<MonitorPlay size={20} />} label={t(uiLanguage, 'present')} onClick={onPresent} darkMode={darkMode} tooltip="Presentation Mode" />
                  <RibbonBtn icon={<Volume2 size={20} />} label={t(uiLanguage, 'read')} onClick={handleReadAloud} darkMode={darkMode} tooltip="Read Aloud" />
                  <RibbonBtn icon={<Printer size={20} />} label="Print" onClick={() => window.print()} darkMode={darkMode} tooltip="Print (Ctrl+P)" />
               </div>
            </RibbonGroup>
            <Divider darkMode={darkMode} />
            <RibbonGroup label={t(uiLanguage, 'grpTools')} darkMode={darkMode}>
               <div className="flex space-x-1">
                 <RibbonBtn icon={<Info size={20} />} label={t(uiLanguage, 'stats')} onClick={onShowStats} darkMode={darkMode} tooltip="Word Count & Statistics" />
                 <RibbonBtn icon={<Keyboard size={20} />} label={t(uiLanguage, 'shortcuts')} onClick={onShowKeyboardShortcuts} darkMode={darkMode} tooltip="Keyboard Shortcuts" />
                 <div className="flex flex-col justify-center space-y-1 ml-2">
                    <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={showRuler} onChange={(e) => setShowRuler(e.target.checked)} className="accent-blue-600" />
                        <span>{t(uiLanguage, 'ruler')}</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={isScreenplay} onChange={onToggleScreenplay} className="accent-blue-600" />
                        <span>{t(uiLanguage, 'screenplayMode')}</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={isMarkdownMode} onChange={onToggleMarkdown} className="accent-blue-600" />
                        <span>{t(uiLanguage, 'markdownMode')}</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={showOutline} onChange={onToggleOutline} className="accent-blue-600" />
                        <span>{t(uiLanguage, 'documentOutline')}</span>
                    </label>
                 </div>
               </div>
            </RibbonGroup>
          </>
        )}

      </div>
      )}
    </div>
  );
};

// --- Subcomponents ---

const RibbonGroup: React.FC<{ label: string; children: React.ReactNode; darkMode: boolean }> = ({ label, children, darkMode }) => (
  <div className="flex flex-col items-center h-full px-2">
    <div className="flex items-center space-x-2 flex-1 justify-center">
      {children}
    </div>
    <span className={`text-[10px] mt-1 font-medium tracking-wide uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
  </div>
);

const RibbonBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; darkMode: boolean; className?: string; active?: boolean; tooltip?: string }> = ({ icon, label, onClick, darkMode, className, active, tooltip }) => (
  <button
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    title={tooltip}
    className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg transition-all ${className}
      ${active
        ? (darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
        : (darkMode
          ? 'hover:bg-white/10 text-gray-300'
          : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
        )
      }
    `}
  >
    <div className="mb-0.5 opacity-80">{icon}</div>
    <span className="text-[10px] leading-tight font-medium">{label}</span>
  </button>
);

const RibbonIconBtn: React.FC<{ icon: React.ReactNode; active?: boolean; onClick: () => void; title?: string; darkMode: boolean }> = ({ icon, active, onClick, title, darkMode }) => (
  <button
    onMouseDown={(e) => e.preventDefault()}
    aria-label={title}
    aria-pressed={active !== undefined ? active : undefined}
    onClick={onClick}
    className={`p-1.5 rounded-md transition-all
      ${active
         ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700')
         : (darkMode ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-700')
      }
    `}
  >
    {icon}
  </button>
);

const Divider = ({ darkMode }: { darkMode: boolean }) => <div className={`h-12 w-[1px] mx-2 my-auto shrink-0 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>;

const Dropdown: React.FC<{ icon: React.ReactNode; label: string; items: {label: string, onClick: () => void}[]; darkMode: boolean }> = ({ icon, label, items, darkMode }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
        <button
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg transition-all
            ${darkMode
              ? 'hover:bg-white/10 text-gray-300'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }
          `}
        >
          <div className="mb-0.5 opacity-80">{icon}</div>
          <span className="text-[10px] leading-tight font-medium">{label}</span>
        </button>
        {isOpen && (
          <div role="menu" className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 border shadow-xl rounded-xl z-50 w-32 p-1 animate-in fade-in zoom-in-95 duration-100
               ${darkMode ? 'bg-[#252525] border-gray-700' : 'bg-white border-gray-100'}
          `}>
              {items.map((item, i) => (
                  <button
                     key={i}
                     role="menuitem"
                     onMouseDown={(e) => e.preventDefault()}
                     onClick={() => { item.onClick(); setIsOpen(false); }}
                     className={`block w-full text-left px-4 py-2 text-xs rounded-lg transition-colors
                       ${darkMode ? 'hover:bg-white/10 text-gray-200' : 'hover:bg-gray-50 text-gray-800'}
                     `}
                  >
                      {item.label}
                  </button>
              ))}
          </div>
        )}
    </div>
  );
};