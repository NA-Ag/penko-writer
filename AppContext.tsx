import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { DocumentData, PageConfig, EditorHandle, SelectionContext, Template, Comment, CommentReply, TrackChange, Citation } from './types';
import { saveToStorage, loadFromStorage, createNewDocument, deleteFromStorage } from './utils/storage';
import { saveSnapshot } from './utils/history';
import { LanguageCode } from './utils/translations';
import { useIsMobile } from './utils/hooks';
import { useToast } from './utils/useToast';

interface AppContextType {
  documents: DocumentData[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentData[]>>;
  currentDoc: DocumentData | null;
  setCurrentDoc: React.Dispatch<React.SetStateAction<DocumentData | null>>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  showRuler: boolean;
  setShowRuler: React.Dispatch<React.SetStateAction<boolean>>;
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  showSpellCheck: boolean;
  setShowSpellCheck: React.Dispatch<React.SetStateAction<boolean>>;
  showStats: boolean;
  setShowStats: React.Dispatch<React.SetStateAction<boolean>>;
  showHistory: boolean;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  showTemplates: boolean;
  setShowTemplates: React.Dispatch<React.SetStateAction<boolean>>;
  showPresentation: boolean;
  setShowPresentation: React.Dispatch<React.SetStateAction<boolean>>;
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  showOutline: boolean;
  setShowOutline: React.Dispatch<React.SetStateAction<boolean>>;
  showDiagramEditor: boolean;
  setShowDiagramEditor: React.Dispatch<React.SetStateAction<boolean>>;
  showHeaderFooter: boolean;
  setShowHeaderFooter: React.Dispatch<React.SetStateAction<boolean>>;
  showLinkDialog: boolean;
  setShowLinkDialog: React.Dispatch<React.SetStateAction<boolean>>;
  existingLink: { url: string; text: string } | null;
  setExistingLink: React.Dispatch<React.SetStateAction<{ url: string; text: string } | null>>;
  showCommentsPanel: boolean;
  setShowCommentsPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showTrackChangesPanel: boolean;
  setShowTrackChangesPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showImportDialog: boolean;
  setShowImportDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showCollaborationDialog: boolean;
  setShowCollaborationDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showEquationDialog: boolean;
  setShowEquationDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showTOCDialog: boolean;
  setShowTOCDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showFootnoteDialog: boolean;
  setShowFootnoteDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showCitationDialog: boolean;
  setShowCitationDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showCodeBlockDialog: boolean;
  setShowCodeBlockDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showImageGallery: boolean;
  setShowImageGallery: React.Dispatch<React.SetStateAction<boolean>>;
  showKeyboardShortcuts: boolean;
  setShowKeyboardShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  selectedImage: HTMLImageElement | null;
  setSelectedImage: React.Dispatch<React.SetStateAction<HTMLImageElement | null>>;
  currentUser: string;
  setCurrentUser: React.Dispatch<React.SetStateAction<string>>;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  wordCount: number;
  setWordCount: React.Dispatch<React.SetStateAction<number>>;
  rawText: string;
  setRawText: React.Dispatch<React.SetStateAction<string>>;
  zenMode: boolean;
  setZenMode: React.Dispatch<React.SetStateAction<boolean>>;
  pasteAsPlainText: boolean;
  setPasteAsPlainText: React.Dispatch<React.SetStateAction<boolean>>;
  uiLanguage: LanguageCode;
  setUiLanguage: React.Dispatch<React.SetStateAction<LanguageCode>>;
  isRibbonCollapsed: boolean;
  setIsRibbonCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  showFocusMode: boolean;
  setShowFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  typewriterMode: boolean;
  setTypewriterMode: React.Dispatch<React.SetStateAction<boolean>>;
  wordGoal: number | undefined;
  setWordGoal: React.Dispatch<React.SetStateAction<number | undefined>>;
  selectionContext: SelectionContext;
  setSelectionContext: React.Dispatch<React.SetStateAction<SelectionContext>>;
  editorRef: React.RefObject<EditorHandle | null>;
  isMobile: boolean;
  toast: ReturnType<typeof useToast>;

  // Actions
  handleNewDoc: () => void;
  handleRemoveFromHistory: (docId: string) => void;
  handleTemplateSelect: (template: Template) => void;
  handleImportDocument: (title: string, content: string) => void;
  handleOpenDoc: (id: string) => void;
  handleContentChange: (html: string, text: string) => void;
  handleTitleChange: (newTitle: string) => void;
  handlePageConfigChange: (config: Partial<PageConfig>) => void;
  handleLanguageChange: (lang: string) => void;
  executeCommand: (command: string, value?: string | null) => void;
  handleTableAction: (action: string, value?: any) => void;
  handleImageAction: (action: string, value?: any) => void;
  handleReplaceImage: () => void;
  handleContextChange: (ctx: SelectionContext) => void;
  handleRestoreVersion: (content: string) => void;
  handleApplyCorrection: (original: string, correction: string) => void;
  handleHeaderFooterSave: (data: {
    header: string;
    footer: string;
    showPageNumbers: boolean;
    pageNumberPosition: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right';
  }) => void;
  handleOpenLinkDialog: () => void;
  handleInsertLink: (url: string, text: string) => void;
  handleRemoveLink: () => void;
  handleInsertEquation: (latex: string) => void;
  handleInsertTOC: (tocHTML: string) => void;
  handleInsertFootnote: (noteData: { type: 'footnote' | 'endnote'; content: string; number: number }) => void;
  handleAddCitation: (citation: Citation) => void;
  handleDeleteCitation: (citationId: string) => void;
  handleInsertCitation: (citationId: string, style: 'apa' | 'mla' | 'chicago' | 'bibtex') => void;
  handleInsertBibliography: (style: 'apa' | 'mla' | 'chicago' | 'bibtex') => void;
  handleInsertCodeBlock: (code: string, language: string, theme: string) => void;
  handleAddComment: (text: string, rangeId: string) => void;
  handleReplyToComment: (commentId: string, text: string) => void;
  handleResolveComment: (commentId: string) => void;
  handleDeleteComment: (commentId: string) => void;
  handleHighlightComment: (commentId: string) => void;
  handleCreateCommentFromSelection: () => void;
  handleToggleTracking: () => void;
  handleToggleScreenplay: () => void;
  handleToggleMarkdown: () => void;
  handleAcceptChange: (changeId: string) => void;
  handleRejectChange: (changeId: string) => void;
  handleAcceptAllChanges: () => void;
  handleRejectAllChanges: () => void;
  handleHighlightChange: (changeId: string) => void;
  copiedFormatting: SelectionContext | null;
  setCopiedFormatting: (fmt: SelectionContext | null) => void;
  isPaintingFormat: boolean;
  setIsPaintingFormat: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocumentData | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showRuler, setShowRuler] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showSpellCheck, setShowSpellCheck] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [showDiagramEditor, setShowDiagramEditor] = useState(false);
  const [showHeaderFooter, setShowHeaderFooter] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [existingLink, setExistingLink] = useState<{ url: string; text: string } | null>(null);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [showTrackChangesPanel, setShowTrackChangesPanel] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCollaborationDialog, setShowCollaborationDialog] = useState(false);
  const [showEquationDialog, setShowEquationDialog] = useState(false);
  const [showTOCDialog, setShowTOCDialog] = useState(false);
  const [showFootnoteDialog, setShowFootnoteDialog] = useState(false);
  const [showCitationDialog, setShowCitationDialog] = useState(false);
  const [showCodeBlockDialog, setShowCodeBlockDialog] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [currentUser, setCurrentUser] = useState('User');
  const [darkMode, setDarkMode] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [rawText, setRawText] = useState('');
  const [zenMode, setZenMode] = useState(false);
  const [pasteAsPlainText, setPasteAsPlainText] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<LanguageCode>('en-US');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [wordGoal, setWordGoal] = useState<number | undefined>(undefined);

  const [selectionContext, setSelectionContext] = useState<SelectionContext>({ type: 'text' });
  const [copiedFormatting, setCopiedFormatting] = useState<SelectionContext | null>(null);
  const [isPaintingFormat, setIsPaintingFormat] = useState(false);
  const [pendingStyles, setPendingStyles] = useState<{ fontName?: string; fontSize?: string } | null>(null);
  const editorRef = useRef<EditorHandle | null>(null);

  const isMobile = useIsMobile(768);
  const toast = useToast();

  // Initialize
  useEffect(() => {
    const savedDocs = loadFromStorage();
    setDocuments(savedDocs);
    if (savedDocs.length > 0) {
      setCurrentDoc(savedDocs[0]);
    } else {
      handleNewDoc();
    }

    let savedTheme = localStorage.getItem('penko_writer_theme');
    if (!savedTheme) {
      const oldTheme = localStorage.getItem('cloudword_theme');
      if (oldTheme) {
        localStorage.setItem('penko_writer_theme', oldTheme);
        savedTheme = oldTheme;
      }
    }
    if (savedTheme === 'dark') setDarkMode(true);

    let savedUiLang = localStorage.getItem('penko_writer_ui_lang');
    if (!savedUiLang) {
      const oldUiLang = localStorage.getItem('cloudword_ui_lang');
      if (oldUiLang) {
        localStorage.setItem('penko_writer_ui_lang', oldUiLang);
        savedUiLang = oldUiLang;
      }
    }
    if (savedUiLang) setUiLanguage(savedUiLang as LanguageCode);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        executeCommand('bold');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        executeCommand('italic');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        executeCommand('underline');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentDoc) {
          saveToStorage(currentDoc);
          toast.success('Document saved!');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setShowImportDialog(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        executeCommand('undo');
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        executeCommand('redo');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleOpenLinkDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDoc]);

  // Persist Theme & Language
  useEffect(() => {
    localStorage.setItem('penko_writer_theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('penko_writer_ui_lang', uiLanguage);
  }, [uiLanguage]);

  // Auto-save
  useEffect(() => {
    if (!currentDoc) return;

    const timer = setTimeout(() => {
      saveToStorage(currentDoc);
      setDocuments(prev => prev.map(d => d.id === currentDoc.id ? currentDoc : d));
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [currentDoc]);

  // Smart snapshot system
  useEffect(() => {
    if (!currentDoc) return;

    const snapshotTimer = setTimeout(() => {
      saveSnapshot(currentDoc);
    }, 5000);

    return () => {
      clearTimeout(snapshotTimer);
    };
  }, [currentDoc]);

  const handleNewDoc = () => {
    const newDoc = createNewDocument();
    setDocuments(prev => [newDoc, ...prev]);
    setCurrentDoc(newDoc);
  };

  const handleRemoveFromHistory = (docId: string) => {
    deleteFromStorage(docId);
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
    if (currentDoc?.id === docId) {
      const remaining = documents.filter(doc => doc.id !== docId);
      if (remaining.length > 0) {
        setCurrentDoc(remaining[0]);
      } else {
        handleNewDoc();
      }
    }
  };

  const handleTemplateSelect = (template: Template) => {
    const newDoc = createNewDocument();
    newDoc.title = template.name;
    newDoc.content = template.content;
    if (template.pageConfig) {
      newDoc.pageConfig = template.pageConfig;
    }
    if (template.isScreenplay) {
      newDoc.isScreenplay = true;
    }
    setDocuments(prev => [newDoc, ...prev]);
    setCurrentDoc(newDoc);
    setShowTemplates(false);
    toast.success(`Template "${template.name}" loaded!`);
  };

  const handleImportDocument = (title: string, content: string) => {
    const newDoc = createNewDocument();
    newDoc.title = title;
    newDoc.content = content;
    setDocuments(prev => [newDoc, ...prev]);
    setCurrentDoc(newDoc);
    setShowImportDialog(false);
    toast.success('Document imported successfully!');
  };

  const handleOpenDoc = (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc) setCurrentDoc(doc);
    setIsSidebarOpen(false);
  };

  const handleContentChange = (html: string, text: string) => {
    if (pendingStyles) {
      setPendingStyles(null);
    }
    if (!currentDoc) return;
    const safeText = text || '';
    const count = safeText.trim() === '' ? 0 : safeText.trim().split(/\s+/).length;
    setWordCount(count);
    setRawText(safeText);
    setCurrentDoc(prev => prev ? { ...prev, content: html, lastModified: Date.now() } : null);
  };

  const handleTitleChange = (newTitle: string) => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? { ...prev, title: newTitle, lastModified: Date.now() } : null);
  };

  const handlePageConfigChange = (config: Partial<PageConfig>) => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? { 
        ...prev, 
        pageConfig: { ...(prev.pageConfig || { size: 'A4', orientation: 'portrait', margins: 'normal', cols: 1 }), ...config },
        lastModified: Date.now() 
    } : null);
  };

  const handleLanguageChange = (lang: string) => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? { ...prev, language: lang, lastModified: Date.now() } : null);
  };

  const executeCommand = (command: string, value: string | null = null) => {
    const selection = window.getSelection();

    if (command === 'zoom') {
       setZoom(parseInt(value || '100'));
       return;
    }

    if (command === 'fontName' && value) {
      if (selection && selection.isCollapsed && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontFamily = value;
        span.style.fontSize = (selectionContext.fontSize || '11') + 'pt';
        span.innerHTML = '&#8203;'; // Zero-width space
        range.insertNode(span);
        
        range.setStart(span.firstChild!, 1);
        range.setEnd(span.firstChild!, 1);
        selection.removeAllRanges();
        selection.addRange(range);
        
        setSelectionContext(prev => ({
          ...prev,
          fontName: value
        }));
        if (editorRef.current) editorRef.current.focus();
        return;
      } else if (selection && !selection.isCollapsed) {
        document.execCommand('fontName', false, value);
        setSelectionContext(prev => ({
          ...prev,
          fontName: value
        }));
        if (editorRef.current) editorRef.current.focus();
        return;
      }
    }

    if (command === 'fontSize' && value) {
      if (selection && selection.isCollapsed && selection.rangeCount > 0) {
        if (value !== 'grow' && value !== 'shrink') {
          const range = selection.getRangeAt(0);
          const span = document.createElement('span');
          span.style.fontFamily = selectionContext.fontName || 'Arial';
          span.style.fontSize = value + 'pt';
          span.innerHTML = '&#8203;'; // Zero-width space
          range.insertNode(span);
          
          range.setStart(span.firstChild!, 1);
          range.setEnd(span.firstChild!, 1);
          selection.removeAllRanges();
          selection.addRange(range);
          
          setSelectionContext(prev => ({
            ...prev,
            fontSize: value
          }));
          if (editorRef.current) editorRef.current.focus();
          return;
        }
      }
      
      if (selection && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          let size = 11;
          if (value === 'grow' || value === 'shrink') {
            let parent = range.commonAncestorContainer as HTMLElement;
            if (parent.nodeType === Node.TEXT_NODE) {
              parent = parent.parentElement as HTMLElement;
            }
            const closestSpan = parent.closest('span');
            if (closestSpan && closestSpan.style.fontSize) {
              size = parseFloat(closestSpan.style.fontSize) || 11;
            }
            size = value === 'grow' ? size + 1 : Math.max(6, size - 1);
          } else {
            size = parseFloat(value) || 11;
          }
          const span = document.createElement('span');
          span.style.fontSize = size + 'pt';
          const fragment = range.extractContents();
          span.appendChild(fragment);
          range.insertNode(span);
          
          setSelectionContext(prev => ({
            ...prev,
            fontSize: size.toString()
          }));
      }
      if (editorRef.current) editorRef.current.focus();
      return;
    }

    if (command === 'textCase' && value) {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        let text = selection.toString();
        if (value === 'uppercase') {
          text = text.toUpperCase();
        } else if (value === 'lowercase') {
          text = text.toLowerCase();
        } else if (value === 'capitalize') {
          text = text.replace(/\b\w/g, c => c.toUpperCase());
        }
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
      }
      if (editorRef.current) editorRef.current.focus();
      return;
    }

    if (command === 'paragraphBackground' && value) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let parent = range.commonAncestorContainer as HTMLElement;
        if (parent.nodeType === Node.TEXT_NODE) {
          parent = parent.parentElement as HTMLElement;
        }
        const block = parent.closest('p, div, li, td, h1, h2, h3, h4, h5, h6');
        if (block && block.setAttribute) {
          block.style.backgroundColor = value;
        } else {
          parent.style.backgroundColor = value;
        }
        
        if (editorRef.current) {
          const html = editorRef.current.getInnerHtml();
          const textContent = editorRef.current.getInnerText();
          handleContentChange(html, textContent);
        }
      }
      if (editorRef.current) editorRef.current.focus();
      return;
    }

    if (command === 'insertSymbol' && value) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(value));
      }
      if (editorRef.current) editorRef.current.focus();
      return;
    }

    if (command === 'lineHeight' && value) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let parent = range.commonAncestorContainer as HTMLElement;
        if (parent.nodeType === Node.TEXT_NODE) {
          parent = parent.parentElement as HTMLElement;
        }
        const block = parent.closest('p, div, li, td, h1, h2, h3, h4, h5, h6');
        if (block && block.setAttribute) {
          block.style.lineHeight = value;
        } else {
          parent.style.lineHeight = value;
        }
        
        if (editorRef.current) {
          const html = editorRef.current.getInnerHtml();
          const textContent = editorRef.current.getInnerText();
          handleContentChange(html, textContent);
        }
      }
      if (editorRef.current) editorRef.current.focus();
      return;
    }

    document.execCommand(command, false, value ?? undefined);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleTableAction = (action: string, value?: any) => {
      if(!editorRef.current) return;
      if (action === 'addRow') editorRef.current.addTableRow();
      if (action === 'delRow') editorRef.current.deleteTableRow();
      if (action === 'addCol') editorRef.current.addTableColumn();
      if (action === 'delCol') editorRef.current.deleteTableColumn();
      if (action === 'mergeCells') editorRef.current.mergeCells();
      if (action === 'splitCell') editorRef.current.splitCell();
      if (action === 'setStyle') editorRef.current.setTableStyle(value);
      if (action === 'setWidth') editorRef.current.setColumnWidth(value);
  };

  const handleImageAction = (action: string, value?: any) => {
      if(!editorRef.current) return;
      if (action === 'resize') editorRef.current.resizeImage(value);
      if (action === 'align') editorRef.current.alignImage(value);
      if (action === 'rotate') editorRef.current.rotateImage(value);
      if (action === 'border') editorRef.current.setImageBorder(value);
      if (action === 'replace') handleReplaceImage();
  };

  const handleReplaceImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && editorRef.current) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            let dataUrl = event.target.result as string;
            const { compressImage, shouldCompressImage } = await import('./utils/imageUtils');
            if (shouldCompressImage(dataUrl)) {
              dataUrl = await compressImage(dataUrl);
            }
            await editorRef.current?.replaceImage(dataUrl);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const applyFormatting = (format: SelectionContext) => {
    if (!format) return;
    if (format.bold !== undefined) {
      const isCurrentlyBold = document.queryCommandState('bold');
      if (!!format.bold !== isCurrentlyBold) executeCommand('bold');
    }
    if (format.italic !== undefined) {
      const isCurrentlyItalic = document.queryCommandState('italic');
      if (!!format.italic !== isCurrentlyItalic) executeCommand('italic');
    }
    if (format.underline !== undefined) {
      const isCurrentlyUnderline = document.queryCommandState('underline');
      if (!!format.underline !== isCurrentlyUnderline) executeCommand('underline');
    }
    if (format.strikeThrough !== undefined) {
      const isCurrentlyStrike = document.queryCommandState('strikeThrough') || document.queryCommandState('strikethrough');
      if (!!format.strikeThrough !== isCurrentlyStrike) executeCommand('strikeThrough');
    }
    if (format.fontName) {
      executeCommand('fontName', format.fontName);
    }
    if (format.fontSize) {
      executeCommand('fontSize', format.fontSize);
    }
    if (format.foreColor) {
      executeCommand('foreColor', format.foreColor);
    }
    if (format.hiliteColor) {
      executeCommand('hiliteColor', format.hiliteColor);
    }
    if (format.align) {
      if (format.align === 'center') executeCommand('justifyCenter');
      else if (format.align === 'right') executeCommand('justifyRight');
      else if (format.align === 'justify') executeCommand('justifyFull');
      else executeCommand('justifyLeft');
    }
    if (format.formatBlock) {
      executeCommand('formatBlock', format.formatBlock);
    }
    if (format.paragraphBackground) {
      executeCommand('paragraphBackground', format.paragraphBackground);
    }
  };

  const handleContextChange = (ctx: SelectionContext) => {
    const mergedCtx = pendingStyles ? { ...ctx, ...pendingStyles } : ctx;
    setSelectionContext(mergedCtx);
    if (ctx.type === 'image' && editorRef.current) {
      const img = editorRef.current.getSelectedImage();
      setSelectedImage(img);
    } else {
      setSelectedImage(null);
    }

    // Paint Format logic!
    if (isPaintingFormat && copiedFormatting && ctx.type === 'text') {
      applyFormatting(copiedFormatting);
      setIsPaintingFormat(false);
      toast.success('Format applied!');
    }
  };

  const handleRestoreVersion = (content: string) => {
      if (currentDoc) {
          saveSnapshot(currentDoc);
          setCurrentDoc({ ...currentDoc, content, lastModified: Date.now() });
      }
  };

  const handleApplyCorrection = (original: string, correction: string) => {
    if (!currentDoc || !editorRef.current) return;
    const currentContent = editorRef.current.getInnerHtml();
    const updatedContent = currentContent.replace(original, correction);
    setCurrentDoc(prev => prev ? { ...prev, content: updatedContent, lastModified: Date.now() } : null);
  };

  const handleHeaderFooterSave = (data: {
    header: string;
    footer: string;
    showPageNumbers: boolean;
    pageNumberPosition: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right';
  }) => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? {
      ...prev,
      header: data.header,
      footer: data.footer,
      showPageNumbers: data.showPageNumbers,
      pageNumberPosition: data.pageNumberPosition,
      lastModified: Date.now()
    } : null);
  };

  const handleOpenLinkDialog = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const parentElement = range.commonAncestorContainer.parentElement;
      const linkElement = parentElement?.closest('a');
      if (linkElement) {
        setExistingLink({
          url: linkElement.href,
          text: linkElement.textContent || ''
        });
      } else {
        setExistingLink(null);
      }
    }
    setShowLinkDialog(true);
  };

  const handleInsertLink = (url: string, text: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const parentElement = range.commonAncestorContainer.parentElement;
      const linkElement = parentElement?.closest('a');

      if (linkElement) {
        linkElement.href = url;
        linkElement.textContent = text;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = text;

        if (selection.toString()) {
          range.deleteContents();
        }
        range.insertNode(a);
      }

      if (editorRef.current) {
        const html = editorRef.current.getInnerHtml();
        const textContent = editorRef.current.getInnerText();
        handleContentChange(html, textContent);
      }
    }
  };

  const handleRemoveLink = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const parentElement = range.commonAncestorContainer.parentElement;
      const linkElement = parentElement?.closest('a');

      if (linkElement) {
        const textNode = document.createTextNode(linkElement.textContent || '');
        linkElement.parentNode?.replaceChild(textNode, linkElement);

        if (editorRef.current) {
          const html = editorRef.current.getInnerHtml();
          const textContent = editorRef.current.getInnerText();
          handleContentChange(html, textContent);
        }
      }
    }
  };

  const handleInsertEquation = (latex: string) => {
    const equationSpan = document.createElement('span');
    equationSpan.className = 'katex-equation';
    equationSpan.setAttribute('data-latex', latex);
    equationSpan.style.display = 'inline-block';
    equationSpan.style.margin = '0 4px';

    try {
      const katex = require('katex');
      katex.render(latex, equationSpan, {
        throwOnError: false,
        displayMode: false,
      });
    } catch (err) {
      equationSpan.textContent = `[Equation: ${latex}]`;
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(equationSpan);
      range.setStartAfter(equationSpan);
      range.setEndAfter(equationSpan);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleInsertTOC = (tocHTML: string) => {
    executeCommand('insertHTML', tocHTML);
    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleInsertFootnote = (noteData: { type: 'footnote' | 'endnote'; content: string; number: number }) => {
    const refSpan = document.createElement('sup');
    refSpan.className = `${noteData.type}-ref`;
    refSpan.setAttribute('data-note-id', `${noteData.type}-${noteData.number}`);
    refSpan.textContent = noteData.number.toString();
    refSpan.style.color = '#3b82f6';
    refSpan.style.cursor = 'pointer';
    refSpan.style.fontWeight = 'bold';

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(refSpan);
      range.setStartAfter(refSpan);
      range.setEndAfter(refSpan);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (currentDoc) {
      const notes = currentDoc.footnotes || [];
      notes.push(noteData);
      setCurrentDoc(prev => prev ? { ...prev, footnotes: notes, lastModified: Date.now() } : null);
    }

    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleAddCitation = (citation: Citation) => {
    if (!currentDoc) return;
    const citations = currentDoc.citations || [];
    citations.push(citation);
    setCurrentDoc(prev => prev ? { ...prev, citations, lastModified: Date.now() } : null);
  };

  const handleDeleteCitation = (citationId: string) => {
    if (!currentDoc) return;
    const citations = (currentDoc.citations || []).filter(c => c.id !== citationId);
    setCurrentDoc(prev => prev ? { ...prev, citations, lastModified: Date.now() } : null);
  };

  const handleInsertCitation = (citationId: string, style: 'apa' | 'mla' | 'chicago' | 'bibtex') => {
    const citation = currentDoc?.citations?.find(c => c.id === citationId);
    if (!citation) return;

    let citationText = '';
    const { author, year } = citation;

    switch (style) {
      case 'apa':
        citationText = `(${author}, ${year})`;
        break;
      case 'mla':
        citationText = `(${author})`;
        break;
      case 'chicago':
        citationText = `(${author} ${year})`;
        break;
      case 'bibtex':
        citationText = `\\cite{${author.split(' ')[0].toLowerCase()}${year}}`;
        break;
    }

    executeCommand('insertHTML', `<span class="citation" data-citation-id="${citationId}">${citationText}</span>`);

    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleInsertBibliography = (style: 'apa' | 'mla' | 'chicago' | 'bibtex') => {
    const citations = currentDoc?.citations || [];
    if (citations.length === 0) return;

    let bibliographyHTML = '<div class="bibliography" style="margin-top: 40px; page-break-before: always;">';
    const titleMap = { apa: 'References', mla: 'Works Cited', chicago: 'Bibliography', bibtex: 'References' };
    bibliographyHTML += `<h2 style="font-size: 1.5em; font-weight: bold; margin-bottom: 20px;">${titleMap[style]}</h2>`;
    bibliographyHTML += '<div style="padding-left: 40px; text-indent: -40px;">';

    citations.forEach(citation => {
      const { author, title, year, publisher, journal, volume, pages } = citation;
      let entry = '';

      switch (style) {
        case 'apa':
          if (citation.type === 'book') {
            entry = `${author} (${year}). <i>${title}</i>. ${publisher || 'Publisher'}.`;
          } else if (citation.type === 'journal') {
            entry = `${author} (${year}). ${title}. <i>${journal}</i>, ${volume}${pages ? `, ${pages}` : ''}.`;
          } else {
            entry = `${author} (${year}). ${title}.`;
          }
          break;
        case 'mla':
          if (citation.type === 'book') {
            entry = `${author}. <i>${title}</i>. ${publisher || 'Publisher'}, ${year}.`;
          } else if (citation.type === 'journal') {
            entry = `${author}. "${title}." <i>${journal}</i> ${volume} (${year})${pages ? `: ${pages}` : ''}.`;
          } else {
            entry = `${author}. <i>${title}</i>. ${year}.`;
          }
          break;
        case 'chicago':
          if (citation.type === 'book') {
            entry = `${author}. <i>${title}</i>. ${publisher ? `${publisher}, ` : ''}${year}.`;
          } else if (citation.type === 'journal') {
            entry = `${author}. "${title}." <i>${journal}</i> ${volume}${pages ? ` (${year}): ${pages}` : ` (${year})`}.`;
          } else {
            entry = `${author}. <i>${title}</i>. ${year}.`;
          }
          break;
        case 'bibtex':
          const bibType = citation.type === 'journal' ? 'article' : citation.type;
          entry = `<pre style="font-family: monospace; margin: 10px 0;">@${bibType}{${author.split(' ')[0].toLowerCase()}${year},
  author = {${author}},
  title = {${title}},
  year = {${year}}
}</pre>`;
          break;
      }
      bibliographyHTML += `<p style="margin: 8px 0;">${entry}</p>`;
    });

    bibliographyHTML += '</div></div>';
    executeCommand('insertHTML', bibliographyHTML);

    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleInsertCodeBlock = (code: string, language: string, theme: string) => {
    if (editorRef.current) editorRef.current.focus();

    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const lines = code.split('\n');
    const lineNumbersHTML = lines.map((_, i) => `<div style="line-height: 1.6; font-size: 14px;">${i + 1}</div>`).join('');

    const codeBlockHTML = `
      <div class="code-block-container" style="margin: 20px 0; border-radius: 8px; overflow: hidden; background: #2d2d2d; font-family: 'Courier New', monospace;">
        <div class="code-block-header" style="background: #1e1e1e; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #404040;">
          <span style="color: #888; font-size: 12px; text-transform: uppercase;">${language}</span>
          <button onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.querySelector('code').textContent); alert('Copied!');" style="background: #404040; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">Copy</button>
        </div>
        <div class="code-block-content" style="display: flex; overflow-x: auto;">
          <div class="line-numbers" style="background: #1e1e1e; padding: 12px 8px; text-align: right; color: #6e7681; user-select: none; min-width: 40px; border-right: 1px solid #404040; font-family: 'Courier New', monospace;">
            ${lineNumbersHTML}
          </div>
          <pre style="margin: 0; padding: 12px 16px; flex: 1; overflow-x: auto;"><code class="language-${language}" style="color: #d4d4d4; font-size: 14px; line-height: 1.6; white-space: pre; display: block;">${escapedCode}</code></pre>
        </div>
      </div>
    `;

    document.execCommand('insertHTML', false, codeBlockHTML);

    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleAddComment = (text: string, rangeId: string) => {
    if (!currentDoc) return;
    const newComment: Comment = {
      id: crypto.randomUUID(),
      rangeId,
      author: currentUser,
      text,
      timestamp: Date.now(),
      resolved: false,
      replies: []
    };
    const updatedComments = [...(currentDoc.comments || []), newComment];
    setCurrentDoc(prev => prev ? { ...prev, comments: updatedComments, lastModified: Date.now() } : null);
  };

  const handleReplyToComment = (commentId: string, text: string) => {
    if (!currentDoc) return;
    const reply: CommentReply = {
      id: crypto.randomUUID(),
      author: currentUser,
      text,
      timestamp: Date.now()
    };
    const updatedComments = currentDoc.comments?.map(comment =>
      comment.id === commentId ? { ...comment, replies: [...comment.replies, reply] } : comment
    );
    setCurrentDoc(prev => prev ? { ...prev, comments: updatedComments, lastModified: Date.now() } : null);
  };

  const handleResolveComment = (commentId: string) => {
    if (!currentDoc) return;
    const updatedComments = currentDoc.comments?.map(comment =>
      comment.id === commentId ? { ...comment, resolved: true } : comment
    );
    setCurrentDoc(prev => prev ? { ...prev, comments: updatedComments, lastModified: Date.now() } : null);
  };

  const handleDeleteComment = (commentId: string) => {
    if (!currentDoc) return;
    const updatedComments = currentDoc.comments?.filter(comment => comment.id !== commentId);
    setCurrentDoc(prev => prev ? { ...prev, comments: updatedComments, lastModified: Date.now() } : null);
  };

  const handleHighlightComment = (commentId: string) => {
    const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (commentElement) {
      commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      commentElement.classList.add('comment-flash');
      setTimeout(() => commentElement.classList.remove('comment-flash'), 1000);
    }
  };

  const handleCreateCommentFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      alert('Please select some text to comment on');
      return;
    }

    const range = selection.getRangeAt(0);
    const rangeId = crypto.randomUUID();
    const span = document.createElement('span');
    span.className = 'comment-highlight';
    span.setAttribute('data-comment-id', rangeId);
    span.style.cssText = 'background-color: rgba(255, 193, 7, 0.3); cursor: pointer;';

    try {
      range.surroundContents(span);
    } catch (e) {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }

    selection.removeAllRanges();
    const text = prompt('Enter your comment:');
    if (text) {
      handleAddComment(text, rangeId);
      setShowCommentsPanel(true);
    } else {
      span.replaceWith(...span.childNodes);
    }

    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleToggleTracking = () => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? {
      ...prev,
      trackingEnabled: !prev.trackingEnabled,
      lastModified: Date.now()
    } : null);
  };

  const handleToggleScreenplay = () => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? {
      ...prev,
      isScreenplay: !prev.isScreenplay,
      lastModified: Date.now()
    } : null);
  };

  const handleToggleMarkdown = () => {
    if (!currentDoc) return;
    setCurrentDoc(prev => prev ? {
      ...prev,
      isMarkdownMode: !prev.isMarkdownMode,
      lastModified: Date.now()
    } : null);
  };

  const handleAcceptChange = (changeId: string) => {
    if (!currentDoc) return;
    const change = currentDoc.trackChanges?.find(c => c.id === changeId);
    if (!change) return;

    if (change.type === 'insert') {
      const updatedChanges = currentDoc.trackChanges?.map(c =>
        c.id === changeId ? { ...c, accepted: true } : c
      );
      setCurrentDoc(prev => prev ? { ...prev, trackChanges: updatedChanges, lastModified: Date.now() } : null);

      const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
      if (changeElement) {
        const textContent = changeElement.textContent;
        const textNode = document.createTextNode(textContent || '');
        changeElement.parentNode?.replaceChild(textNode, changeElement);
      }
    } else if (change.type === 'delete') {
      const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
      if (changeElement) {
        changeElement.remove();
      }

      const updatedChanges = currentDoc.trackChanges?.map(c =>
        c.id === changeId ? { ...c, accepted: true } : c
      );
      setCurrentDoc(prev => prev ? { ...prev, trackChanges: updatedChanges, lastModified: Date.now() } : null);
    }

    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleRejectChange = (changeId: string) => {
    if (!currentDoc) return;
    const change = currentDoc.trackChanges?.find(c => c.id === changeId);
    if (!change) return;

    if (change.type === 'insert') {
      const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
      if (changeElement) changeElement.remove();
    } else if (change.type === 'delete') {
      const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
      if (changeElement && change.oldContent) {
        const textNode = document.createTextNode(change.oldContent);
        changeElement.parentNode?.replaceChild(textNode, changeElement);
      }
    }

    const updatedChanges = currentDoc.trackChanges?.map(c =>
      c.id === changeId ? { ...c, rejected: true } : c
    );
    setCurrentDoc(prev => prev ? { ...prev, trackChanges: updatedChanges, lastModified: Date.now() } : null);

    if (editorRef.current) {
      const html = editorRef.current.getInnerHtml();
      const textContent = editorRef.current.getInnerText();
      handleContentChange(html, textContent);
    }
  };

  const handleAcceptAllChanges = () => {
    if (!currentDoc) return;
    currentDoc.trackChanges?.forEach(change => {
      if (!change.accepted && !change.rejected) {
        handleAcceptChange(change.id);
      }
    });
  };

  const handleRejectAllChanges = () => {
    if (!currentDoc) return;
    currentDoc.trackChanges?.forEach(change => {
      if (!change.accepted && !change.rejected) {
        handleRejectChange(change.id);
      }
    });
  };

  const handleHighlightChange = (changeId: string) => {
    const changeElement = document.querySelector(`[data-change-id="${changeId}"]`);
    if (changeElement) {
      changeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      changeElement.classList.add('change-flash');
      setTimeout(() => changeElement.classList.remove('change-flash'), 1000);
    }
  };

  const contextValue: AppContextType = {
    documents, setDocuments,
    currentDoc, setCurrentDoc,
    isSidebarOpen, setIsSidebarOpen,
    zoom, setZoom,
    showRuler, setShowRuler,
    showSearch, setShowSearch,
    showSpellCheck, setShowSpellCheck,
    showStats, setShowStats,
    showHistory, setShowHistory,
    showTemplates, setShowTemplates,
    showPresentation, setShowPresentation,
    showSettings, setShowSettings,
    showOutline, setShowOutline,
    showDiagramEditor, setShowDiagramEditor,
    showHeaderFooter, setShowHeaderFooter,
    showLinkDialog, setShowLinkDialog,
    existingLink, setExistingLink,
    showCommentsPanel, setShowCommentsPanel,
    showTrackChangesPanel, setShowTrackChangesPanel,
    showImportDialog, setShowImportDialog,
    showCollaborationDialog, setShowCollaborationDialog,
    showEquationDialog, setShowEquationDialog,
    showTOCDialog, setShowTOCDialog,
    showFootnoteDialog, setShowFootnoteDialog,
    showCitationDialog, setShowCitationDialog,
    showCodeBlockDialog, setShowCodeBlockDialog,
    showImageGallery, setShowImageGallery,
    showKeyboardShortcuts, setShowKeyboardShortcuts,
    selectedImage, setSelectedImage,
    currentUser, setCurrentUser,
    darkMode, setDarkMode,
    wordCount, setWordCount,
    rawText, setRawText,
    zenMode, setZenMode,
    pasteAsPlainText, setPasteAsPlainText,
    uiLanguage, setUiLanguage,
    isRibbonCollapsed, setIsRibbonCollapsed,
    showFocusMode, setShowFocusMode,
    typewriterMode, setTypewriterMode,
    wordGoal, setWordGoal,
    selectionContext, setSelectionContext,
    editorRef, isMobile, toast,

    handleNewDoc,
    handleRemoveFromHistory,
    handleTemplateSelect,
    handleImportDocument,
    handleOpenDoc,
    handleContentChange,
    handleTitleChange,
    handlePageConfigChange,
    handleLanguageChange,
    executeCommand,
    handleTableAction,
    handleImageAction,
    handleReplaceImage,
    handleContextChange,
    handleRestoreVersion,
    handleApplyCorrection,
    handleHeaderFooterSave,
    handleOpenLinkDialog,
    handleInsertLink,
    handleRemoveLink,
    handleInsertEquation,
    handleInsertTOC,
    handleInsertFootnote,
    handleAddCitation,
    handleDeleteCitation,
    handleInsertCitation,
    handleInsertBibliography,
    handleInsertCodeBlock,
    handleAddComment,
    handleReplyToComment,
    handleResolveComment,
    handleDeleteComment,
    handleHighlightComment,
    handleCreateCommentFromSelection,
    handleToggleTracking,
    handleToggleScreenplay,
    handleToggleMarkdown,
    handleAcceptChange,
    handleRejectChange,
    handleAcceptAllChanges,
    handleRejectAllChanges,
    handleHighlightChange,
    copiedFormatting, setCopiedFormatting,
    isPaintingFormat, setIsPaintingFormat
  };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};
