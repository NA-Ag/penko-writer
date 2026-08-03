import React, { useState, useRef, useEffect } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List as ListIcon, ListOrdered, Undo, Redo, Image as ImageIcon,
  Type, Strikethrough, Subscript, Superscript, CaseSensitive, PaintBucket,
  Indent, Outdent, Link as LinkIcon, Table, Minus, FileText, Eye, Check,
  Search, Layout, MoveVertical, RectangleVertical,
  Maximize, Clipboard, Info, Trash2, Columns, Rows, MonitorPlay, Volume2, Grid3X3,
  ChevronUp, ChevronDown, Printer, StickyNote, Merge, Split, Palette, RotateCw, Square,
  Users, MessageSquare, Sigma, BookOpen, BookMarked, Code2, Keyboard, Target, Network,
  Home, PlusCircle, Sliders, ChevronLeft, ChevronRight, Minimize2, Settings, Globe, Paintbrush
} from 'lucide-react';
import { COLORS, FONTS, FONT_SIZES } from '../constants';
import { DocumentData, PageConfig, SelectionContext } from '../types';
import { LanguageCode, t } from '../utils/translations';
import { useApp } from '../AppContext';

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
  onShowEquationDialog: () => void;
  onShowTOCDialog: () => void;
  onShowFootnoteDialog: () => void;
  onShowCitationDialog: () => void;
  onShowCodeBlockDialog: () => void;
  onShowTrackChangesPanel: () => void;
  onToggleTracking: () => void;
  trackingEnabled: boolean;
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
  onCommand, currentDoc, onTitleChange, showRuler, setShowRuler, onUpdatePageConfig, onFind, darkMode,
  pasteAsPlainText, togglePasteAsPlainText, onShowStats, onToggleZenMode, onToggleFocusMode, selectionContext,
  onTableAction, onImageAction, onPresent, onShowHeaderFooter, onShowLinkDialog, onShowCommentsPanel, onCreateComment,
  onShowCollaboration, onShowEquationDialog, onShowTOCDialog, onShowFootnoteDialog, onShowCitationDialog,
  onShowCodeBlockDialog, onShowTrackChangesPanel, onToggleTracking, trackingEnabled, uiLanguage,
  isCollapsed, setIsCollapsed, isScreenplay, onToggleScreenplay, isMarkdownMode, onToggleMarkdown,
  onShowKeyboardShortcuts, showOutline, onToggleOutline, onShowDiagramEditor, onShowSpellCheck
}) => {
  const [activeTab, setActiveTab] = useState('Home');
  const { copiedFormatting, setCopiedFormatting, isPaintingFormat, setIsPaintingFormat, toast, handleInsertBibliography } = useApp();
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'highlight' | 'shading' | 'pageBackground' | null>(null);
  const [showCasingDropdown, setShowCasingDropdown] = useState(false);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectionContext.type === 'table') setActiveTab('Table Design');
    if (selectionContext.type === 'image') setActiveTab('Image Format');
  }, [selectionContext.type]);

  const tabs = [
    { id: 'Home', label: t(uiLanguage, 'tabHome') },
    { id: 'Insert', label: t(uiLanguage, 'tabInsert') },
    { id: 'Layout', label: t(uiLanguage, 'tabLayout') },
    { id: 'References', label: t(uiLanguage, 'tabReferences') || 'References' },
    { id: 'Review', label: t(uiLanguage, 'tabReview') },
    { id: 'View', label: t(uiLanguage, 'tabView') }
  ];

  if (selectionContext.type === 'table') tabs.push({ id: 'Table Design', label: t(uiLanguage, 'tabTable') });
  if (selectionContext.type === 'image') tabs.push({ id: 'Image Format', label: t(uiLanguage, 'tabImage') });

  const handleColor = (type: 'text' | 'highlight' | 'shading' | 'pageBackground', color: string) => {
    if (type === 'text') onCommand('foreColor', color);
    else if (type === 'highlight') onCommand('hiliteColor', color);
    else if (type === 'shading') onCommand('paragraphBackground', color);
    else if (type === 'pageBackground') onUpdatePageConfig({ backgroundColor: color });
    setShowColorPicker(null);
  };

  const insertTable = () => {
    const html = `
      <table style="width:100%; border-collapse: collapse; margin: 10px 0;">
        <tbody>
          <tr><td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td><td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td><td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td></tr>
          <tr><td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td><td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td><td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td></tr>
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
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const ribbonBg = darkMode ? 'bg-[#18181b] border-gray-800' : 'bg-white border-gray-200';
  const shadowClass = darkMode ? 'shadow-2xl shadow-black/60' : 'shadow-lg shadow-gray-150/40';
  const widthClass = isCollapsed ? 'w-20' : 'w-80';

  return (
    <div className={`h-full border-l flex flex-row transition-all duration-300 ${widthClass} ${ribbonBg} ${shadowClass} select-none overflow-hidden relative`}>
      
      {/* Left Blade Tab Rail */}
      <div className={`w-20 shrink-0 flex flex-col items-center py-6 border-r ${darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-gray-250 bg-gray-50/50'} justify-between h-full`}>
        <div className="flex flex-col space-y-3.5 w-full px-1.5">
          {tabs.map((tab, idx) => {
            const isActive = activeTab === tab.id && !isCollapsed;

            const getBladeIcon = (tabId: string) => {
              switch (tabId) {
                case 'Home': return <Home size={22} />;
                case 'Insert': return <PlusCircle size={22} />;
                case 'Layout': return <Sliders size={22} />;
                case 'References': return <BookOpen size={22} />;
                case 'Review': return <Eye size={22} />;
                case 'View': return <MonitorPlay size={22} />;
                case 'Table Design': return <Table size={22} />;
                case 'Image Format': return <ImageIcon size={22} />;
                default: return <Home size={22} />;
              }
            };

            const getBladeColor = (tabId: string) => {
              switch (tabId) {
                case 'Home': return { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500' };
                case 'Insert': return { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500' };
                case 'Layout': return { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500' };
                case 'References': return { text: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500' };
                case 'Review': return { text: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500' };
                case 'View': return { text: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500' };
                case 'Table Design': return { text: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500' };
                case 'Image Format': return { text: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500' };
                default: return { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500' };
              }
            };

            const theme = getBladeColor(tab.id);

            return (
              <button
                key={tab.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (activeTab === tab.id) {
                    setIsCollapsed(!isCollapsed);
                  } else {
                    setActiveTab(tab.id);
                    setIsCollapsed(false);
                  }
                }}
                title={tab.label}
                className={`w-16 h-16 flex flex-col items-center justify-center rounded-xl transition-all relative group
                  ${isActive 
                    ? `${theme.bg} ${theme.text} border-l-4 ${theme.border} font-bold` 
                    : (darkMode ? 'text-gray-400 hover:text-white hover:bg-zinc-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100')
                  }
                `}
              >
                {getBladeIcon(tab.id)}
                <span className="text-xs leading-tight font-semibold mt-0.5 max-w-full overflow-hidden truncate px-0.5">
                  {tab.id === 'References' ? 'References' : tab.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2 rounded-xl transition-all ${darkMode ? 'hover:bg-zinc-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
          title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
        >
          {isCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Right Content panel */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col h-full overflow-y-auto px-4 py-6">
          
          {/* Document Title header */}
          <div className="mb-6 flex flex-col space-y-1 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-400">Document Title</span>
            <input
              value={currentDoc?.title || ''}
              onChange={(e) => onTitleChange(e.target.value)}
              className={`bg-transparent text-sm font-bold outline-none border-b border-transparent focus:border-blue-500 w-full transition-colors
                ${darkMode ? 'text-white placeholder-zinc-700' : 'text-zinc-800 placeholder-zinc-400'}
              `}
              placeholder="Untitled Document"
            />
          </div>

          {/* Group contents depending on active tab */}
          <div className="flex-1 flex flex-col space-y-1">
            
            {activeTab === 'Home' && (
              <>
                 <RibbonGroup label={t(uiLanguage, 'grpClipboard')} darkMode={darkMode}>
                   <div className="flex space-x-2 w-full">
                     <RibbonBtn icon={<Undo size={18} />} label={t(uiLanguage, 'undo')} onClick={() => onCommand('undo')} darkMode={darkMode} />
                     <RibbonBtn icon={<Redo size={18} />} label={t(uiLanguage, 'redo')} onClick={() => onCommand('redo')} darkMode={darkMode} />
                   </div>
                   
                   <button
                     onClick={() => {
                       if (isPaintingFormat) {
                         setIsPaintingFormat(false);
                         setCopiedFormatting(null);
                       } else {
                         setCopiedFormatting(selectionContext);
                         setIsPaintingFormat(true);
                         toast.info('Format copied! Select text to apply.');
                       }
                     }}
                     className={`flex items-center justify-between p-2 rounded-lg border w-full text-xs font-semibold transition-all mt-2
                       ${isPaintingFormat 
                         ? 'bg-amber-500/10 text-amber-500 border-amber-500 font-bold' 
                         : (darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-white' : 'border-gray-250 hover:bg-gray-50 text-gray-700')
                       }
                     `}
                     title="Format Painter (Copy styles from current text and select other text to apply)"
                   >
                     <div className="flex items-center gap-2">
                       <Paintbrush size={16} className={isPaintingFormat ? 'animate-pulse' : ''} />
                       <span>{t(uiLanguage, 'paintFormat')}</span>
                     </div>
                     {copiedFormatting && (
                       <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                     )}
                   </button>

                   <div className="flex items-center space-x-2 bg-black/5 dark:bg-white/5 px-2 py-1.5 rounded-lg w-full mt-2 justify-center">
                     <input type="checkbox" checked={pasteAsPlainText} onChange={togglePasteAsPlainText} className="w-3.5 h-3.5 cursor-pointer accent-blue-600" id="plain-paste-box" />
                     <label htmlFor="plain-paste-box" className="text-[10px] opacity-80 cursor-pointer select-none">{t(uiLanguage, 'pastePlain')}</label>
                   </div>
                 </RibbonGroup>

                <RibbonGroup label={t(uiLanguage, 'grpTypography')} darkMode={darkMode}>
                  <div className="flex flex-col space-y-2 w-full">
                    <select 
                      onChange={(e) => onCommand('fontName', e.target.value)}
                      className={`text-xs px-2 py-1.5 rounded-md border w-full outline-none ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-850'}`}
                      value={selectionContext.fontName || 'Arial'}
                    >
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>

                    <div className="flex space-x-2 items-center w-full">
                      <select 
                        onChange={(e) => onCommand('fontSize', e.target.value)}
                        className={`text-xs px-2 py-1.5 rounded-md border w-24 outline-none ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-850'}`}
                        value={selectionContext.fontSize || '11'}
                      >
                        {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>

                      <div className="flex space-x-1">
                        <button onClick={() => onCommand('fontSize', 'grow')} title="Increase Size" className={`p-1.5 rounded border ${darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-white' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                          A+
                        </button>
                        <button onClick={() => onCommand('fontSize', 'shrink')} title="Decrease Size" className={`p-1.5 rounded border ${darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-white' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                          A-
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1 w-full pt-1">
                      <RibbonIconBtn icon={<Bold size={16} />} active={selectionContext.bold} onClick={() => onCommand('bold')} title="Bold (Ctrl+B)" darkMode={darkMode} />
                      <RibbonIconBtn icon={<Italic size={16} />} active={selectionContext.italic} onClick={() => onCommand('italic')} title="Italic (Ctrl+I)" darkMode={darkMode} />
                      <RibbonIconBtn icon={<Underline size={16} />} active={selectionContext.underline} onClick={() => onCommand('underline')} title="Underline (Ctrl+U)" darkMode={darkMode} />
                      <RibbonIconBtn icon={<Strikethrough size={16} />} active={selectionContext.strikeThrough} onClick={() => onCommand('strikeThrough')} title="Strikethrough" darkMode={darkMode} />
                    </div>

                    <div className="grid grid-cols-4 gap-1 w-full">
                      <RibbonIconBtn icon={<Subscript size={16} />} active={selectionContext.subscript} onClick={() => onCommand('subscript')} title="Subscript" darkMode={darkMode} />
                      <RibbonIconBtn icon={<Superscript size={16} />} active={selectionContext.superscript} onClick={() => onCommand('superscript')} title="Superscript" darkMode={darkMode} />
                      
                      <div className="relative">
                        <RibbonIconBtn icon={<CaseSensitive size={16} />} onClick={() => setShowCasingDropdown(!showCasingDropdown)} title="Change Case" darkMode={darkMode} />
                        {showCasingDropdown && (
                          <div className={`absolute top-full right-0 mt-1 border border-gray-300 dark:border-gray-700 shadow-xl rounded-md z-50 p-1 w-32 flex flex-col
                               ${darkMode ? 'bg-zinc-900 text-white' : 'bg-white text-gray-800'}
                          `}>
                            {['uppercase', 'lowercase', 'capitalize'].map(c => (
                              <button key={c} onClick={() => { onCommand('textCase', c); setShowCasingDropdown(false); }} className={`px-2 py-1.5 text-left text-xs rounded hover:bg-blue-50 dark:hover:bg-white/10 capitalize`}>
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <RibbonIconBtn icon={<Type size={16} />} onClick={() => onCommand('removeFormat')} title="Clear Formatting" darkMode={darkMode} />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 w-full pt-1">
                      <div className="relative flex flex-col items-center">
                        <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 w-full border dark:border-zinc-700 flex flex-col items-center" onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}>
                          <span className="text-[10px] font-bold">Text</span>
                          <div className="w-5 h-1.5 rounded mt-0.5" style={{backgroundColor: selectionContext.foreColor || '#000'}} />
                        </button>
                        {showColorPicker === 'text' && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 dark:border-zinc-700 shadow-xl rounded-lg p-2 grid grid-cols-6 gap-1 z-50 w-44">
                            {COLORS.map(c => <button key={c} className="w-5 h-5 rounded-full border border-zinc-100" style={{backgroundColor: c}} onClick={() => handleColor('text', c)} />)}
                          </div>
                        )}
                      </div>

                      <div className="relative flex flex-col items-center">
                        <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 w-full border dark:border-zinc-700 flex flex-col items-center" onClick={() => setShowColorPicker(showColorPicker === 'highlight' ? null : 'highlight')}>
                          <span className="text-[10px] font-bold">High</span>
                          <div className="w-5 h-1.5 rounded mt-0.5" style={{backgroundColor: selectionContext.hiliteColor || 'transparent'}} />
                        </button>
                        {showColorPicker === 'highlight' && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 dark:border-zinc-700 shadow-xl rounded-lg p-2 grid grid-cols-6 gap-1 z-50 w-44">
                            {COLORS.map(c => <button key={c} className="w-5 h-5 rounded-full border border-zinc-100" style={{backgroundColor: c}} onClick={() => handleColor('highlight', c)} />)}
                          </div>
                        )}
                      </div>

                      <select
                        onChange={(e) => onCommand('formatBlock', e.target.value)}
                        className={`text-xs px-1.5 py-1.5 rounded border outline-none w-full ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-850'}`}
                        value={selectionContext.formatBlock || 'div'}
                      >
                        <option value="div">Normal Text</option>
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                        <option value="blockquote">Quote</option>
                        <option value="pre">Code Block</option>
                      </select>
                    </div>
                  </div>
                </RibbonGroup>

                <RibbonGroup label={t(uiLanguage, 'grpParagraph')} darkMode={darkMode}>
                  <div className="flex flex-col space-y-2 w-full">
                    <div className="grid grid-cols-4 gap-1 w-full">
                      <RibbonIconBtn icon={<AlignLeft size={16} />} active={selectionContext.align === 'left'} onClick={() => onCommand('justifyLeft')} title="Align Left" darkMode={darkMode} />
                      <RibbonIconBtn icon={<AlignCenter size={16} />} active={selectionContext.align === 'center'} onClick={() => onCommand('justifyCenter')} title="Align Center" darkMode={darkMode} />
                      <RibbonIconBtn icon={<AlignRight size={16} />} active={selectionContext.align === 'right'} onClick={() => onCommand('justifyRight')} title="Align Right" darkMode={darkMode} />
                      <RibbonIconBtn icon={<AlignJustify size={16} />} active={selectionContext.align === 'justify'} onClick={() => onCommand('justifyFull')} title="Justify" darkMode={darkMode} />
                    </div>

                    <div className="grid grid-cols-4 gap-1 w-full">
                      <RibbonIconBtn icon={<ListIcon size={16} />} onClick={() => onCommand('insertUnorderedList')} title="Bullet List" darkMode={darkMode} />
                      <RibbonIconBtn icon={<ListOrdered size={16} />} onClick={() => onCommand('insertOrderedList')} title="Numbered List" darkMode={darkMode} />
                      <RibbonIconBtn icon={<Outdent size={16} />} onClick={() => onCommand('outdent')} title="Decrease Indent" darkMode={darkMode} />
                      <RibbonIconBtn icon={<Indent size={16} />} onClick={() => onCommand('indent')} title="Increase Indent" darkMode={darkMode} />
                    </div>

                    <div className="relative flex flex-col w-full">
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 border dark:border-zinc-700 flex items-center justify-center gap-2 w-full" onClick={() => setShowColorPicker(showColorPicker === 'shading' ? null : 'shading')}>
                        <PaintBucket size={16} />
                        <span className="text-[10px] font-bold">Paragraph Shading</span>
                      </button>
                      {showColorPicker === 'shading' && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 dark:border-zinc-700 shadow-xl rounded-lg p-2 grid grid-cols-6 gap-1 z-50 w-44">
                          {COLORS.map(c => <button key={c} className="w-5 h-5 rounded-full border border-zinc-100" style={{backgroundColor: c}} onClick={() => handleColor('shading', c)} />)}
                        </div>
                      )}
                    </div>

                    {/* Line Spacing Selection */}
                    <div className="flex items-center justify-between gap-2 w-full pt-1">
                      <span className="text-[10px] font-bold opacity-75">{t(uiLanguage, 'lineSpacing')}</span>
                      <select
                        onChange={(e) => onCommand('lineHeight', e.target.value)}
                        className={`text-xs px-2 py-1.5 rounded border outline-none w-28 ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-200 text-gray-850'}`}
                        defaultValue="1.15"
                      >
                        <option value="1.0">Single (1.0)</option>
                        <option value="1.15">1.15</option>
                        <option value="1.5">1.5</option>
                        <option value="2.0">Double (2.0)</option>
                        <option value="2.5">2.5</option>
                        <option value="3.0">3.0</option>
                      </select>
                    </div>
                  </div>
                </RibbonGroup>

                <RibbonGroup label={t(uiLanguage, 'grpEditingTools')} darkMode={darkMode}>
                  <div className="flex flex-col space-y-2 w-full">
                    <button
                      onClick={onFind}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border w-full text-xs font-semibold transition-all ${
                        darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-white' : 'border-gray-250 hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Find and Replace text in the document"
                    >
                      <Search size={16} />
                      <span>{t(uiLanguage, 'findReplace')}</span>
                    </button>

                    <button
                      onClick={onShowStats}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border w-full text-xs font-semibold transition-all ${
                        darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-white' : 'border-gray-250 hover:bg-gray-50 text-gray-700'
                      }`}
                      title="View detailed document statistics (word count, char count)"
                    >
                      <FileText size={16} />
                      <span>{t(uiLanguage, 'wordPageStats')}</span>
                    </button>

                    <button
                      onClick={onToggleZenMode}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border w-full text-xs font-semibold transition-all ${
                        darkMode ? 'border-zinc-700 hover:bg-zinc-800 text-white' : 'border-gray-250 hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Switch to Zen distraction-free writing environment"
                    >
                      <Maximize size={16} />
                      <span>{t(uiLanguage, 'zenFocusMode')}</span>
                    </button>
                  </div>
                </RibbonGroup>
              </>
            )}

            {activeTab === 'Insert' && (
              <>
                <RibbonGroup label={t(uiLanguage, 'grpContent')} darkMode={darkMode}>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <RibbonBtn icon={<Table size={18} />} label={t(uiLanguage, 'table')} onClick={insertTable} darkMode={darkMode} />
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    <RibbonBtn icon={<ImageIcon size={18} />} label={t(uiLanguage, 'image')} onClick={() => fileInputRef.current?.click()} darkMode={darkMode} />
                    <RibbonBtn icon={<LinkIcon size={18} />} label={t(uiLanguage, 'link')} onClick={onShowLinkDialog} darkMode={darkMode} />
                    <RibbonBtn icon={<Sigma size={18} />} label={t(uiLanguage, 'equation')} onClick={onShowEquationDialog} darkMode={darkMode} />
                    <RibbonBtn icon={<Code2 size={18} />} label={t(uiLanguage, 'codeBlock')} onClick={onShowCodeBlockDialog} darkMode={darkMode} />
                    <RibbonBtn icon={<Network size={18} />} label={t(uiLanguage, 'diagramEditor')} onClick={onShowDiagramEditor} darkMode={darkMode} />
                  </div>
                </RibbonGroup>

                <RibbonGroup label={t(uiLanguage, 'grpDividersSymbols')} darkMode={darkMode}>
                  <div className="flex flex-col space-y-2 w-full">
                    <RibbonBtn icon={<Minus size={18} />} label={t(uiLanguage, 'horizontalLine')} onClick={() => onCommand('insertHorizontalRule')} darkMode={darkMode} className="w-full" />
                    
                    <div className="relative w-full">
                      <button className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border dark:border-zinc-700 text-xs font-semibold hover:bg-gray-150 dark:hover:bg-white/5" onClick={() => setShowSymbolPicker(!showSymbolPicker)}>
                        <Keyboard size={16} />
                        <span>{t(uiLanguage, 'specialSymbol')}</span>
                      </button>
                      {showSymbolPicker && (
                        <div className={`absolute top-full left-0 mt-1 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl z-50 p-2 grid grid-cols-6 gap-1 w-full max-w-[260px]
                             ${darkMode ? 'bg-zinc-800 text-white' : 'bg-white text-gray-800'}
                        `}>
                          {['©', '®', '™', '§', '¶', '•', '—', '–', '°', '±', '≠', '≈', '≤', '≥', '×', '÷', '∞', 'π', 'Ω', 'μ', 'α', 'β', 'γ', '€'].map(sym => (
                            <button 
                              key={sym} 
                              onMouseDown={(e) => e.preventDefault()} 
                              onClick={() => { onCommand('insertSymbol', sym); setShowSymbolPicker(false); }} 
                              className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded hover:bg-blue-50 dark:hover:bg-white/10`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </RibbonGroup>

                <RibbonGroup label={t(uiLanguage, 'grpHeaderPageBreak')} darkMode={darkMode}>
                  <div className="flex flex-col space-y-2 w-full">
                    <RibbonBtn icon={<Minus size={18} />} label={t(uiLanguage, 'break')} onClick={() => {
                      const html = '<div style="page-break-after: always; height: 1px; background: #ccc; margin: 20px 0;"></div>';
                      onCommand('insertHTML', html);
                    }} darkMode={darkMode} className="w-full" />
                    <RibbonBtn icon={<StickyNote size={18} />} label={t(uiLanguage, 'headerFooter')} onClick={onShowHeaderFooter} darkMode={darkMode} className="w-full" />
                  </div>
                </RibbonGroup>
              </>
            )}

            {activeTab === 'Layout' && (
              <>
                <RibbonGroup label={t(uiLanguage, 'grpPageSetup')} darkMode={darkMode}>
                  <div className="flex flex-col space-y-3 w-full">
                    <Dropdown
                       icon={<Layout size={18} />}
                       label={t(uiLanguage, 'margins')}
                       items={[
                         {label: t(uiLanguage, 'normal'), onClick: () => onUpdatePageConfig({margins: 'normal'})},
                         {label: t(uiLanguage, 'narrow'), onClick: () => onUpdatePageConfig({margins: 'narrow'})},
                         {label: t(uiLanguage, 'wide'), onClick: () => onUpdatePageConfig({margins: 'wide'})},
                       ]}
                       darkMode={darkMode}
                    />
                    <Dropdown
                       icon={<RectangleVertical size={18} />}
                       label={t(uiLanguage, 'orientation')}
                       items={[
                         {label: t(uiLanguage, 'portrait'), onClick: () => onUpdatePageConfig({orientation: 'portrait'})},
                         {label: t(uiLanguage, 'landscape'), onClick: () => onUpdatePageConfig({orientation: 'landscape'})},
                       ]}
                       darkMode={darkMode}
                    />
                     <Dropdown
                       icon={<FileText size={18} />}
                       label={t(uiLanguage, 'size')}
                       items={[
                         {label: 'A4', onClick: () => onUpdatePageConfig({size: 'A4'})},
                         {label: 'Letter', onClick: () => onUpdatePageConfig({size: 'Letter'})},
                       ]}
                       darkMode={darkMode}
                    />
                    <Dropdown
                       icon={<Grid3X3 size={18} />}
                       label={t(uiLanguage, 'columns')}
                       items={[
                         {label: t(uiLanguage, 'colsOne'), onClick: () => onUpdatePageConfig({cols: 1})},
                         {label: t(uiLanguage, 'colsTwo'), onClick: () => onUpdatePageConfig({cols: 2})},
                         {label: t(uiLanguage, 'colsThree'), onClick: () => onUpdatePageConfig({cols: 3})},
                       ]}
                       darkMode={darkMode}
                    />
                    <div className="relative w-full">
                      <button className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border dark:border-zinc-700 text-xs font-semibold hover:bg-gray-150 dark:hover:bg-white/5" onClick={() => setShowColorPicker(showColorPicker === 'pageBackground' ? null : 'pageBackground')}>
                        <PaintBucket size={16} />
                        <span>{t(uiLanguage, 'pageColor')}</span>
                      </button>
                      {showColorPicker === 'pageBackground' && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 dark:border-zinc-700 shadow-xl rounded-lg p-2 grid grid-cols-6 gap-1 z-50 w-44">
                          {COLORS.map(c => <button key={c} className="w-5 h-5 rounded-full border border-zinc-100" style={{backgroundColor: c}} onClick={() => handleColor('pageBackground', c)} />)}
                        </div>
                      )}
                    </div>
                  </div>
                </RibbonGroup>
              </>
            )}

            {activeTab === 'References' && (
              <>
                <RibbonGroup label={t(uiLanguage, 'tableOfContents') || 'Table of Contents'} darkMode={darkMode}>
                   <RibbonBtn icon={<BookOpen size={18} />} label={t(uiLanguage, 'tableOfContents') || 'TOC'} onClick={onShowTOCDialog} darkMode={darkMode} className="w-full" />
                </RibbonGroup>

                <RibbonGroup label={t(uiLanguage, 'footnote') || 'Footnotes'} darkMode={darkMode}>
                   <RibbonBtn icon={<FileText size={18} />} label={t(uiLanguage, 'footnote') || 'Footnote'} onClick={onShowFootnoteDialog} darkMode={darkMode} className="w-full" />
                </RibbonGroup>

                <RibbonGroup label={t(uiLanguage, 'citationsAndBibliography') || 'Citations'} darkMode={darkMode}>
                  <div className="flex flex-col space-y-3 w-full">
                     <RibbonBtn icon={<BookMarked size={18} />} label={t(uiLanguage, 'citation') || 'Citation'} onClick={onShowCitationDialog} darkMode={darkMode} className="w-full" />
                     <Dropdown
                       icon={<BookMarked size={18} />}
                       label={t(uiLanguage, 'insertBibliography') || 'Bibliography'}
                       items={[
                         {label: 'APA Style', onClick: () => handleInsertBibliography('apa')},
                         {label: 'MLA Style', onClick: () => handleInsertBibliography('mla')},
                         {label: 'Chicago Style', onClick: () => handleInsertBibliography('chicago')},
                         {label: 'BibTeX Style', onClick: () => handleInsertBibliography('bibtex')},
                       ]}
                       darkMode={darkMode}
                     />
                  </div>
                </RibbonGroup>
              </>
            )}

            {activeTab === 'Review' && (
              <>
                <RibbonGroup label={t(uiLanguage, 'grpTools')} darkMode={darkMode}>
                  <RibbonBtn icon={<Check size={18} />} label={t(uiLanguage, 'spellCheck')} onClick={onShowSpellCheck} darkMode={darkMode} className="w-full" />
                </RibbonGroup>
                
                <RibbonGroup label={t(uiLanguage, 'collaboration')} darkMode={darkMode}>
                  <RibbonBtn icon={<Users size={18} />} label={t(uiLanguage, 'collaborate')} onClick={onShowCollaboration} darkMode={darkMode} className="w-full" />
                </RibbonGroup>

                <RibbonGroup label={t(uiLanguage, 'comments')} darkMode={darkMode}>
                  <RibbonBtn icon={<MessageSquare size={18} />} label={t(uiLanguage, 'newComment')} onClick={onCreateComment} darkMode={darkMode} className="w-full" />
                  <RibbonBtn icon={<Eye size={18} />} label="Show Comments" onClick={onShowCommentsPanel} darkMode={darkMode} className="w-full" />
                </RibbonGroup>

                <RibbonGroup label="Changes Tracking" darkMode={darkMode}>
                  <div className="flex flex-col space-y-2 w-full">
                    <RibbonBtn icon={<RotateCw size={18} />} label="Track Changes" onClick={onShowTrackChangesPanel} darkMode={darkMode} className="w-full" />
                    <div className="flex items-center space-x-2 bg-black/5 dark:bg-white/5 px-2 py-1 rounded w-full justify-center">
                      <input type="checkbox" checked={trackingEnabled} onChange={onToggleTracking} className="w-3.5 h-3.5 cursor-pointer accent-blue-600" id="tracking-box" />
                      <label htmlFor="tracking-box" className="text-[10px] cursor-pointer select-none">Enable Tracking</label>
                    </div>
                  </div>
                </RibbonGroup>
              </>
            )}

            {activeTab === 'View' && (
              <>
                <RibbonGroup label="Document Views" darkMode={darkMode}>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <RibbonBtn icon={<MonitorPlay size={18} />} label="Present" onClick={onPresent} darkMode={darkMode} />
                    <RibbonBtn icon={<Volume2 size={18} />} label="Read Aloud" onClick={handleReadAloud} darkMode={darkMode} />
                  </div>
                </RibbonGroup>

                <RibbonGroup label={t(uiLanguage, 'grpTools')} darkMode={darkMode}>
                  <div className="flex flex-col space-y-2.5 w-full">
                    <RibbonBtn icon={<Info size={18} />} label={t(uiLanguage, 'stats')} onClick={onShowStats} darkMode={darkMode} className="w-full" />
                    <RibbonBtn icon={<Keyboard size={18} />} label={t(uiLanguage, 'shortcuts')} onClick={onShowKeyboardShortcuts} darkMode={darkMode} className="w-full" />
                    
                    <div className="flex flex-col space-y-1.5 p-2 bg-black/5 dark:bg-white/5 rounded-lg w-full">
                      <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={showRuler} onChange={(e) => setShowRuler(e.target.checked)} className="accent-blue-600 w-3.5 h-3.5" />
                        <span className="text-[11px]">{t(uiLanguage, 'ruler')}</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={isScreenplay} onChange={onToggleScreenplay} className="accent-blue-600 w-3.5 h-3.5" />
                        <span className="text-[11px]">{t(uiLanguage, 'screenplayMode')}</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={isMarkdownMode} onChange={onToggleMarkdown} className="accent-blue-600 w-3.5 h-3.5" />
                        <span className="text-[11px]">{t(uiLanguage, 'markdownMode')}</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={showOutline} onChange={onToggleOutline} className="accent-blue-600 w-3.5 h-3.5" />
                        <span className="text-[11px]">{t(uiLanguage, 'documentOutline')}</span>
                      </label>
                    </div>
                  </div>
                </RibbonGroup>
              </>
            )}

            {activeTab === 'Table Design' && (
              <>
                <RibbonGroup label={t(uiLanguage, 'grpRowsCols')} darkMode={darkMode}>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <RibbonBtn icon={<Rows size={18} />} label="Add Row" onClick={() => onTableAction('addRow')} darkMode={darkMode} />
                    <RibbonBtn icon={<Columns size={18} />} label="Add Col" onClick={() => onTableAction('addCol')} darkMode={darkMode} />
                    <RibbonBtn icon={<Trash2 size={18} className="text-red-500" />} label="Del Row" onClick={() => onTableAction('delRow')} darkMode={darkMode} />
                    <RibbonBtn icon={<Trash2 size={18} className="text-red-500" />} label="Del Col" onClick={() => onTableAction('delCol')} darkMode={darkMode} />
                  </div>
                </RibbonGroup>

                <RibbonGroup label="Merge Cells" darkMode={darkMode}>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <RibbonBtn icon={<Merge size={18} />} label="Merge" onClick={() => onTableAction('mergeCells')} darkMode={darkMode} />
                    <RibbonBtn icon={<Split size={18} />} label="Split" onClick={() => onTableAction('splitCell')} darkMode={darkMode} />
                  </div>
                </RibbonGroup>

                <RibbonGroup label="Table Style" darkMode={darkMode}>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <RibbonBtn icon={<Palette size={16} />} label="Default" onClick={() => onTableAction('setStyle', 'default')} darkMode={darkMode} />
                    <RibbonBtn icon={<Palette size={16} />} label="Bordered" onClick={() => onTableAction('setStyle', 'bordered')} darkMode={darkMode} />
                    <RibbonBtn icon={<Palette size={16} />} label="Striped" onClick={() => onTableAction('setStyle', 'striped')} darkMode={darkMode} />
                    <RibbonBtn icon={<Palette size={16} />} label="Minimal" onClick={() => onTableAction('setStyle', 'minimal')} darkMode={darkMode} />
                  </div>
                </RibbonGroup>
              </>
            )}

            {activeTab === 'Image Format' && (
              <>
                <RibbonGroup label="Image Wrapping" darkMode={darkMode}>
                  <div className="flex flex-col space-y-2.5 w-full">
                    <Dropdown
                      icon={<MoveVertical size={18} />}
                      label="Layout Style"
                      items={[
                        {label: 'Inline', onClick: () => onImageAction('layout', 'inline')},
                        {label: 'Break Text', onClick: () => onImageAction('layout', 'break')},
                      ]}
                      darkMode={darkMode}
                    />
                    
                    <div className="grid grid-cols-3 gap-1 w-full pt-1">
                      <RibbonIconBtn icon={<AlignLeft size={16} />} onClick={() => onImageAction('align', 'left')} title="Align Left" darkMode={darkMode} />
                      <RibbonIconBtn icon={<AlignCenter size={16} />} onClick={() => onImageAction('align', 'center')} title="Align Center" darkMode={darkMode} />
                      <RibbonIconBtn icon={<AlignRight size={16} />} onClick={() => onImageAction('align', 'right')} title="Align Right" darkMode={darkMode} />
                    </div>
                  </div>
                </RibbonGroup>

                <RibbonGroup label="Image Border Style" darkMode={darkMode}>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <RibbonBtn icon={<Square size={16} />} label="None" onClick={() => onImageAction('border', 'none')} darkMode={darkMode} />
                    <RibbonBtn icon={<Square size={16} />} label="Thin" onClick={() => onImageAction('border', 'thin')} darkMode={darkMode} />
                    <RibbonBtn icon={<Square size={16} />} label="Medium" onClick={() => onImageAction('border', 'medium')} darkMode={darkMode} />
                    <RibbonBtn icon={<Square size={16} />} label="Thick" onClick={() => onImageAction('border', 'thick')} darkMode={darkMode} />
                    <RibbonBtn icon={<Square size={16} />} label="Rounded" onClick={() => onImageAction('border', 'rounded')} darkMode={darkMode} />
                  </div>
                </RibbonGroup>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

// --- Subcomponents ---

const RibbonGroup: React.FC<{ label: string; children: React.ReactNode; darkMode: boolean }> = ({ label, children, darkMode }) => (
  <div className={`flex flex-col border-b pb-4 mb-4 last:border-b-0 w-full ${darkMode ? 'border-zinc-800' : 'border-gray-150'}`}>
    <span className={`text-[10px] mb-3 font-semibold tracking-wider uppercase ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
    <div className="flex flex-wrap gap-2 items-center justify-start">
      {children}
    </div>
  </div>
);

const RibbonBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; darkMode: boolean; className?: string; active?: boolean; tooltip?: string }> = ({ icon, label, onClick, darkMode, className, active, tooltip }) => (
  <button
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    title={tooltip || label}
    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all text-left ${className || 'w-full'}
      ${active
        ? (darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600')
        : (darkMode
          ? 'hover:bg-white/5 text-gray-300'
          : 'hover:bg-gray-100 text-gray-700'
        )
      }
    `}
  >
    <div className="opacity-80 shrink-0">{icon}</div>
    <span className="text-xs leading-none font-medium truncate">{label}</span>
  </button>
);

const RibbonIconBtn: React.FC<{ icon: React.ReactNode; active?: boolean; onClick: () => void; title?: string; darkMode: boolean }> = ({ icon, active, onClick, title, darkMode }) => (
  <button
    onMouseDown={(e) => e.preventDefault()}
    aria-label={title}
    aria-pressed={active !== undefined ? active : undefined}
    onClick={onClick}
    title={title}
    className={`p-2 rounded-md transition-all flex items-center justify-center w-full
      ${active
         ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700')
         : (darkMode ? 'hover:bg-white/10 text-gray-300 border border-zinc-800' : 'hover:bg-gray-100 text-gray-700 border border-gray-200')
      }
    `}
  >
    {icon}
  </button>
);

const Divider = ({ darkMode }: { darkMode: boolean }) => <div className={`w-full h-[1px] my-4 shrink-0 ${darkMode ? 'bg-zinc-800' : 'bg-gray-150'}`}></div>;

const Dropdown: React.FC<{ icon: React.ReactNode; label: string; items: {label: string, onClick: () => void}[]; darkMode: boolean }> = ({ icon, label, items, darkMode }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`} onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
        <button
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all w-full border
            ${darkMode
              ? 'hover:bg-white/5 border-zinc-800 text-gray-300'
              : 'hover:bg-gray-100 border-gray-250 text-gray-700'
            }
          `}
        >
          <div className="flex items-center space-x-2.5">
            <div className="opacity-85">{icon}</div>
            <span className="text-xs font-semibold">{label}</span>
          </div>
          <ChevronDown size={14} className="opacity-60" />
        </button>
        {isOpen && (
          <div 
            role="menu"
            className={`absolute top-full left-0 w-full mt-1 border rounded-lg shadow-xl z-50 p-1
              ${darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-gray-200 text-gray-800'}
            `}
          >
            {items.map((item, idx) => (
              <button
                key={idx}
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { item.onClick(); setIsOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
    </div>
  );
};