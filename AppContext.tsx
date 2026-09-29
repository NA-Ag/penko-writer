import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { DocumentData, PageConfig, SelectionContext, Template, Citation } from './types';
import { LanguageCode, t, loadLanguage, isLanguageLoaded } from './utils/translations';
import { useIsMobile } from './utils/hooks';
import { useToast } from './utils/useToast';
import { useDocumentStore } from './state/useDocumentStore';
import { readLS, writeLS } from './utils/localPrefs';
import { useEditingActions } from './state/useEditingActions';
import { sectionBreaks, sectionOfPage, type SectionInfo, type SectionSettings } from './editor/extensions/sections';
import { useReviewActions } from './state/useReviewActions';
import { captureFormatting, applyFormatting, CopiedFormat } from './editor/commands';
import type { CitationStyle } from './editor/citations';
import type { TocStyle } from './editor/toc';
import type { CollaborationConfig } from './editor/extensions';
import type { StylesDialogRequest } from './utils/paragraphStyles';

/* ------------------------------------------------------------------ */
/* Context types                                                       */
/* ------------------------------------------------------------------ */

export type { PageNumberPosition, EditorStats, SelectedImageInfo } from './state/types';
import type { PageNumberPosition, EditorStats, SelectedImageInfo } from './state/types';

interface AppContextType {
  // documents
  documents: DocumentData[];
  currentDoc: DocumentData | null;
  docsLoaded: boolean;
  contentRevision: number;
  updateCurrentDoc: (patch: Partial<DocumentData> | ((d: DocumentData) => Partial<DocumentData>)) => void;
  flushPendingEdits: () => void;

  // editor
  editor: Editor | null;
  setActiveEditor: (editor: Editor | null) => void;
  registerEditorFlush: (fn: (() => void) | null) => void;
  stats: EditorStats;
  setStats: (s: EditorStats) => void;
  /** Page containing the cursor and total pages (paginated layout). */
  pageInfo: { current: number; total: number };
  setPageInfo: React.Dispatch<React.SetStateAction<{ current: number; total: number }>>;
  wordCount: number;
  rawText: string;
  selectedImage: SelectedImageInfo | null;
  setSelectedImage: (img: SelectedImageInfo | null) => void;
  collabSession: (CollaborationConfig & { docId: string }) | null;
  setCollabSession: (s: (CollaborationConfig & { docId: string }) | null) => void;

  // ui state
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
  /** Section being edited in the header/footer dialog: section-break position, or null for the first section. */
  headerFooterSectionPos: number | null;
  /** Open the header/footer dialog for the section of `page` (default: the section at the cursor). */
  openHeaderFooter: (target?: { page?: number }) => void;
  handleSectionSettingsSave: (pos: number, settings: SectionSettings) => void;
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
  editingEquation: { pos: number; latex: string; display: boolean } | null;
  setEditingEquation: React.Dispatch<React.SetStateAction<{ pos: number; latex: string; display: boolean } | null>>;
  showTOCDialog: boolean;
  setShowTOCDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showFootnoteDialog: boolean;
  setShowFootnoteDialog: React.Dispatch<React.SetStateAction<boolean>>;
  editingFootnote: { pos: number; content: string; noteType: 'footnote' | 'endnote' } | null;
  setEditingFootnote: React.Dispatch<React.SetStateAction<{ pos: number; content: string; noteType: 'footnote' | 'endnote' } | null>>;
  showCitationDialog: boolean;
  setShowCitationDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showCodeBlockDialog: boolean;
  setShowCodeBlockDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showImageGallery: boolean;
  setShowImageGallery: React.Dispatch<React.SetStateAction<boolean>>;
  showKeyboardShortcuts: boolean;
  setShowKeyboardShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  /** Styles dialog (manage / modify / new named paragraph style), null when closed. */
  stylesDialog: StylesDialogRequest | null;
  setStylesDialog: (request: StylesDialogRequest | null) => void;
  showFocusMode: boolean;
  setShowFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  pendingCommentId: string | null;
  setPendingCommentId: React.Dispatch<React.SetStateAction<string | null>>;
  currentUser: string;
  setCurrentUser: (name: string) => void;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  pasteAsPlainText: boolean;
  setPasteAsPlainText: React.Dispatch<React.SetStateAction<boolean>>;
  uiLanguage: LanguageCode;
  setUiLanguage: React.Dispatch<React.SetStateAction<LanguageCode>>;
  isRibbonCollapsed: boolean;
  setIsRibbonCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  typewriterMode: boolean;
  setTypewriterMode: React.Dispatch<React.SetStateAction<boolean>>;
  wordGoal: number | undefined;
  setWordGoal: React.Dispatch<React.SetStateAction<number | undefined>>;
  isMobile: boolean;
  toast: ReturnType<typeof useToast>;

  // document actions
  handleNewDoc: () => DocumentData;
  handleCreateDocument: (data: Partial<DocumentData>, opts?: { select?: boolean; keepIdentity?: boolean }) => DocumentData;
  /** Replace a document with another version of it (same id, e.g. from a .penko file) and show it. */
  handleReplaceDocument: (doc: DocumentData, fields: readonly string[]) => void;
  handleRemoveFromHistory: (docId: string) => void;
  handleDeleteDocument: (docId: string) => void;
  handleTemplateSelect: (template: Template) => void;
  handleImportDocument: (title: string, content: string, extra?: Partial<DocumentData>) => void;
  handleOpenDoc: (id: string) => void;
  /** Replace the current document's HTML from outside the main editor. */
  /** Replace a document's HTML from outside the editor (defaults to the current document). */
  handleContentChange: (html: string, docId?: string) => void;
  handleTitleChange: (newTitle: string) => void;
  handlePageConfigChange: (config: Partial<PageConfig>) => void;
  handleLanguageChange: (lang: string) => void;
  handleSaveNow: () => Promise<void>;

  // editing actions
  executeCommand: (command: string, value?: string | null) => void;
  handleTableAction: (action: string, value?: any) => void;
  handleImageAction: (action: string, value?: any) => void;
  updateSelectedImage: (patch: { attrs?: Record<string, any>; style?: Record<string, string | null> }) => void;
  deleteSelectedImage: () => void;
  handleReplaceImage: () => void;
  handleInsertImageFiles: (files: File[] | FileList) => Promise<void>;
  handleRestoreVersion: (content: string) => void;
  handleApplyCorrection: (original: string, correction: string, textOffset?: number) => boolean;
  handleHeaderFooterSave: (data: {
    header: string;
    footer: string;
    showPageNumbers: boolean;
    pageNumberPosition: PageNumberPosition;
    differentFirstPage?: boolean;
    pageNumberFormat?: 'decimal' | 'roman' | 'page-of';
  }) => void;
  handleOpenLinkDialog: () => void;
  handleInsertLink: (url: string, text: string) => void;
  handleRemoveLink: () => void;
  handleInsertEquation: (latex: string, display?: boolean) => void;
  handleInsertTOC: (opts?: { style?: TocStyle; levels?: number[] }) => void;
  handleInsertFootnote: (noteData: { type: 'footnote' | 'endnote'; content: string; number?: number }) => void;
  handleUpdateFootnote: (pos: number, content: string) => void;
  handleAddCitation: (citation: Citation) => void;
  handleUpdateCitation: (citation: Citation) => void;
  handleDeleteCitation: (citationId: string) => void;
  handleInsertCitation: (citationId: string, style: CitationStyle) => void;
  handleInsertBibliography: (style: CitationStyle) => void;
  handleInsertCodeBlock: (code: string, language: string, theme: string, lineNumbers?: boolean) => void;
  handleInsertDiagram: (dataUrl: string, alt?: string) => void;
  handleInsertPageBreak: () => void;

  // comments / review
  handleAddComment: (text: string, rangeId: string) => void;
  handleReplyToComment: (commentId: string, text: string) => void;
  handleResolveComment: (commentId: string) => void;
  handleReopenComment: (commentId: string) => void;
  handleDeleteComment: (commentId: string) => void;
  handleHighlightComment: (commentId: string) => void;
  handleCreateCommentFromSelection: () => void;
  handleCancelPendingComment: () => void;
  handleToggleTracking: () => void;
  handleToggleScreenplay: () => void;
  handleToggleMarkdown: () => void;
  handleAcceptChange: (changeId: string) => void;
  handleRejectChange: (changeId: string) => void;
  handleAcceptAllChanges: () => void;
  handleRejectAllChanges: () => void;
  handleHighlightChange: (changeId: string) => void;

  // paint format
  copiedFormatting: CopiedFormat | null;
  setCopiedFormatting: (fmt: CopiedFormat | null) => void;
  isPaintingFormat: boolean;
  setIsPaintingFormat: (v: boolean) => void;
  startPaintFormat: () => void;
  applyPaintFormat: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

/** Selection-driven toolbar state lives in its own context so typing doesn't re-render the app. */
const SelectionCtx = createContext<SelectionContext | undefined>(undefined);
const SelectionSetterCtx = createContext<((c: SelectionContext) => void) | undefined>(undefined);
export const useSelectionContext = () => {
  const selectionContext = useContext(SelectionCtx);
  const setSelectionContext = useContext(SelectionSetterCtx);
  if (!selectionContext || !setSelectionContext) throw new Error('useSelectionContext must be used within an AppProvider');
  return { selectionContext, setSelectionContext };
};
/** Setter only — components that report selection changes don't re-render on them. */
export const useSetSelectionContext = () => {
  const set = useContext(SelectionSetterCtx);
  if (!set) throw new Error('useSetSelectionContext must be used within an AppProvider');
  return set;
};

const shallowEqual = (a: Record<string, any>, b: Record<string, any>) => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every(k => a[k] === b[k] || (typeof a[k] === 'object' && a[k] && b[k] && JSON.stringify(a[k]) === JSON.stringify(b[k])));
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;
  const editorFlushRef = useRef<(() => void) | null>(null);
  const [stats, setStats] = useState<EditorStats>({ words: 0, characters: 0, text: '' });
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number }>({ current: 1, total: 1 });
  const [selectedImage, setSelectedImage] = useState<SelectedImageInfo | null>(null);
  const [collabSession, setCollabSession] = useState<(CollaborationConfig & { docId: string }) | null>(null);
  const [selectionContext, setSelectionContextState] = useState<SelectionContext>({ type: 'text' });
  // Skip identical updates: moving the caret within same-formatted text shouldn't re-render the toolbar
  const setSelectionContext = useCallback((next: SelectionContext) => setSelectionContextState(prev => (shallowEqual(prev, next) ? prev : next)), []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showRuler, setShowRuler] = useState(() => readLS('penko_writer_show_ruler') !== 'false');
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
  const [headerFooterSectionPos, setHeaderFooterSectionPos] = useState<number | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [existingLink, setExistingLink] = useState<{ url: string; text: string } | null>(null);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [showTrackChangesPanel, setShowTrackChangesPanel] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCollaborationDialog, setShowCollaborationDialog] = useState(false);
  const [showEquationDialog, setShowEquationDialog] = useState(false);
  const [editingEquation, setEditingEquation] = useState<{ pos: number; latex: string; display: boolean } | null>(null);
  const [showTOCDialog, setShowTOCDialog] = useState(false);
  const [showFootnoteDialog, setShowFootnoteDialog] = useState(false);
  const [editingFootnote, setEditingFootnote] = useState<{ pos: number; content: string; noteType: 'footnote' | 'endnote' } | null>(null);
  const [showCitationDialog, setShowCitationDialog] = useState(false);
  const [showCodeBlockDialog, setShowCodeBlockDialog] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [stylesDialog, setStylesDialog] = useState<StylesDialogRequest | null>(null);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);
  const [currentUser, setCurrentUserState] = useState(() => readLS('penko_writer_user_name') || 'User');
  const [darkMode, setDarkMode] = useState(() => readLS('penko_writer_theme', 'cloudword_theme') === 'dark');
  const [pasteAsPlainText, setPasteAsPlainText] = useState(() => readLS('penko_writer_paste_plain') === 'true');
  const [uiLanguage, setUiLanguage] = useState<LanguageCode>(() => (readLS('penko_writer_ui_lang', 'cloudword_ui_lang') as LanguageCode) || 'en-US');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [, setLanguageTick] = useState(0);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [wordGoal, setWordGoal] = useState<number | undefined>(undefined);
  const [copiedFormatting, setCopiedFormatting] = useState<CopiedFormat | null>(null);
  const [isPaintingFormat, setIsPaintingFormat] = useState(false);

  // Switching layouts remounts the editor: commit pending edits first
  const isMobile = useIsMobile(768, () => editorFlushRef.current?.());
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const uiLangRef = useRef(uiLanguage);
  uiLangRef.current = uiLanguage;

  const {
    docState,
    currentDoc,
    currentDocRef,
    documents,
    flushPendingEdits,
    updateDoc,
    updateCurrentDoc,
    handleCreateDocument,
    handleNewDoc,
    handleDeleteDocument,
    handleTemplateSelect,
    handleImportDocument,
    handleOpenDoc,
    handleReplaceDocument,
    handleContentChange,
    handleTitleChange,
    handlePageConfigChange,
    handleLanguageChange,
    handleSaveNow,
  } = useDocumentStore({ editorFlushRef, toastRef, uiLangRef, setIsSidebarOpen, setShowTemplates, setShowImportDialog });


  /* ---------------------------- settings --------------------------- */

  useEffect(() => {
    writeLS('penko_writer_theme', darkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  useEffect(() => writeLS('penko_writer_show_ruler', String(showRuler)), [showRuler]);
  useEffect(() => writeLS('penko_writer_paste_plain', String(pasteAsPlainText)), [pasteAsPlainText]);

  useEffect(() => {
    writeLS('penko_writer_ui_lang', uiLanguage);
    // Non-English strings are code-split; re-render once they arrive
    if (!isLanguageLoaded(uiLanguage)) void loadLanguage(uiLanguage).then(() => setLanguageTick(n => n + 1));
    document.documentElement.lang = uiLanguage;
    document.documentElement.dir = uiLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.style.setProperty('--penko-page-break-label', JSON.stringify(t(uiLanguage, 'pageBreak')));
    document.documentElement.style.setProperty('--penko-section-break-label', JSON.stringify(t(uiLanguage, 'sectionBreakNextPage')));
  }, [uiLanguage]);

  const setCurrentUser = useCallback((name: string) => {
    const clean = name.trim() || 'User';
    setCurrentUserState(clean);
    writeLS('penko_writer_user_name', clean);
  }, []);

  // An unfinished comment belongs to the document it was started in: when the
  // user switches away, drop its highlight from that document instead of
  // leaving an empty comment mark behind.
  const pendingCommentRef = useRef<{ id: string | null; docId: string | null }>({ id: null, docId: null });
  useEffect(() => {
    const prev = pendingCommentRef.current;
    if (prev.id && prev.docId && prev.docId !== currentDoc?.id) {
      const { id, docId } = prev;
      updateDoc(
        docId,
        d => {
          const body = new DOMParser().parseFromString(`<body>${d.content}</body>`, 'text/html').body;
          body.querySelectorAll(`[data-comment-id="${CSS.escape(id)}"]`).forEach(el => el.replaceWith(...Array.from(el.childNodes)));
          return { content: body.innerHTML };
        },
        { touch: false },
      );
      setPendingCommentId(null);
      pendingCommentRef.current = { id: null, docId: null };
      return;
    }
    pendingCommentRef.current = pendingCommentId
      ? { id: pendingCommentId, docId: prev.id === pendingCommentId ? prev.docId : currentDoc?.id ?? null }
      : { id: null, docId: null };
  }, [currentDoc?.id, pendingCommentId, updateDoc]);

  // Track-changes author follows the user name
  useEffect(() => {
    if (editor && currentDoc) editor.commands.setTrackChanges(!!currentDoc.trackingEnabled, currentUser);
  }, [editor, currentDoc?.trackingEnabled, currentUser]);

  /* ---------------------------- editing ---------------------------- */

  const editing = useEditingActions({
    editor,
    editorRef,
    currentDoc,
    currentDocRef,
    editingEquation,
    setEditingEquation,
    selectedImage,
    setSelectedImage,
    setExistingLink,
    setShowLinkDialog,
    setShowHeaderFooter,
    setShowDiagramEditor,
    setZoom,
    toastRef,
    uiLangRef,
    updateCurrentDoc,
    updateDoc,
    flushPendingEdits,
  });
  const {
    executeCommand,
    handleTableAction,
    updateSelectedImage,
    deleteSelectedImage,
    handleImageAction,
    handleInsertImageFiles,
    handleReplaceImage,
    handleRestoreVersion,
    handleApplyCorrection,
    handleHeaderFooterSave,
    handleOpenLinkDialog,
    handleInsertLink,
    handleRemoveLink,
    handleInsertEquation,
    handleInsertTOC,
    handleInsertFootnote,
    handleUpdateFootnote,
    handleAddCitation,
    handleUpdateCitation,
    handleDeleteCitation,
    handleInsertCitation,
    handleInsertBibliography,
    handleInsertCodeBlock,
    handleInsertDiagram,
    handleInsertPageBreak,
    handleSectionSettingsSave,
  } = editing;

  const openHeaderFooter = useCallback((target: { page?: number } = {}) => {
    const ed = editorRef.current;
    let pos: number | null = null;
    if (ed && !ed.isDestroyed) {
      if (target.page) {
        const sections: SectionInfo[] = (ed.storage as any).pagination?.sections || [];
        pos = sectionOfPage(target.page, sections)?.pos ?? null;
      } else {
        const at = ed.state.selection.from;
        for (const sb of sectionBreaks(ed.state.doc)) if (sb.pos < at) pos = sb.pos;
      }
    }
    setHeaderFooterSectionPos(pos);
    setShowHeaderFooter(true);
  }, []);

  /* ------------------------ comments / review ----------------------- */

  const {
    handleAddComment,
    handleReplyToComment,
    handleResolveComment,
    handleReopenComment,
    handleDeleteComment,
    handleHighlightComment,
    handleCreateCommentFromSelection,
    handleCancelPendingComment,
    handleToggleTracking,
    handleToggleScreenplay,
    handleToggleMarkdown,
    handleAcceptChange,
    handleRejectChange,
    handleAcceptAllChanges,
    handleRejectAllChanges,
    handleHighlightChange,
  } = useReviewActions({ editorRef, currentDocRef, currentUser, setPendingCommentId, setShowCommentsPanel, toastRef, uiLangRef, updateCurrentDoc, flushPendingEdits });

  /* --------------------------- paint format ------------------------- */

  const startPaintFormat = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    setCopiedFormatting(captureFormatting(ed));
    setIsPaintingFormat(true);
  }, []);

  const applyPaintFormat = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || !copiedFormattingRef.current) return;
    applyFormatting(ed, copiedFormattingRef.current);
    setIsPaintingFormat(false);
    toastRef.current.success(t(uiLangRef.current, 'formatApplied'));
  }, []);
  const copiedFormattingRef = useRef(copiedFormatting);
  copiedFormattingRef.current = copiedFormatting;

  /* ------------------------ keyboard shortcuts ---------------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      const inEditor = !!target && !!editorRef.current && editorRef.current.view.dom.contains(target);
      if (key === 's' && !e.shiftKey) { // Ctrl+Shift+S is strikethrough
        e.preventDefault();
        void handleSaveNowRef.current();
      } else if (key === 'p' && !e.shiftKey) {
        e.preventDefault();
        flushPendingEdits();
        void import('./utils/print').then(m => m.printCurrentDocument());
      } else if (key === 'f' && !inField) {
        e.preventDefault();
        setShowSearch(true);
      } else if (key === 'h' && !e.shiftKey && !inField) { // Ctrl+Shift+H is highlight
        e.preventDefault();
        setShowSearch(true);
      } else if (key === 'o' && !inField) {
        e.preventDefault();
        setShowImportDialog(true);
      } else if (key === 'k' && inEditor) {
        e.preventDefault();
        handleOpenLinkDialog();
      } else if (key === '/' && !inField) {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flushPendingEdits, handleOpenLinkDialog]);
  const handleSaveNowRef = useRef(handleSaveNow);
  handleSaveNowRef.current = handleSaveNow;

  /* ------------------------------ value ----------------------------- */

  const registerEditorFlush = useCallback((fn: (() => void) | null) => {
    editorFlushRef.current = fn;
  }, []);

  const setActiveEditor = useCallback((ed: Editor | null) => setEditor(ed), []);

  const value: AppContextType = {
    documents,
    currentDoc,
    docsLoaded: docState.loaded,
    contentRevision: currentDoc ? docState.revs[currentDoc.id] || 0 : 0,
    updateCurrentDoc,
    flushPendingEdits,
    editor,
    setActiveEditor,
    registerEditorFlush,
    stats,
    setStats,
    pageInfo,
    setPageInfo,
    wordCount: stats.words,
    rawText: stats.text,
    selectedImage,
    setSelectedImage,
    collabSession,
    setCollabSession,
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
    headerFooterSectionPos,
    openHeaderFooter,
    showLinkDialog, setShowLinkDialog,
    existingLink, setExistingLink,
    showCommentsPanel, setShowCommentsPanel,
    showTrackChangesPanel, setShowTrackChangesPanel,
    showImportDialog, setShowImportDialog,
    showCollaborationDialog, setShowCollaborationDialog,
    showEquationDialog, setShowEquationDialog,
    editingEquation, setEditingEquation,
    showTOCDialog, setShowTOCDialog,
    showFootnoteDialog, setShowFootnoteDialog,
    editingFootnote, setEditingFootnote,
    showCitationDialog, setShowCitationDialog,
    showCodeBlockDialog, setShowCodeBlockDialog,
    showImageGallery, setShowImageGallery,
    showKeyboardShortcuts, setShowKeyboardShortcuts,
    stylesDialog, setStylesDialog,
    showFocusMode, setShowFocusMode,
    pendingCommentId, setPendingCommentId,
    currentUser, setCurrentUser,
    darkMode, setDarkMode,
    pasteAsPlainText, setPasteAsPlainText,
    uiLanguage, setUiLanguage,
    isRibbonCollapsed, setIsRibbonCollapsed,
    typewriterMode, setTypewriterMode,
    wordGoal, setWordGoal,
    isMobile,
    toast,
    handleNewDoc,
    handleCreateDocument,
    handleRemoveFromHistory: handleDeleteDocument,
    handleDeleteDocument,
    handleTemplateSelect,
    handleImportDocument,
    handleOpenDoc,
    handleReplaceDocument,
    handleContentChange,
    handleTitleChange,
    handlePageConfigChange,
    handleLanguageChange,
    handleSaveNow,
    executeCommand,
    handleTableAction,
    handleImageAction,
    updateSelectedImage,
    deleteSelectedImage,
    handleReplaceImage,
    handleInsertImageFiles,
    handleRestoreVersion,
    handleApplyCorrection,
    handleHeaderFooterSave,
    handleOpenLinkDialog,
    handleInsertLink,
    handleRemoveLink,
    handleInsertEquation,
    handleInsertTOC,
    handleInsertFootnote,
    handleUpdateFootnote,
    handleAddCitation,
    handleUpdateCitation,
    handleDeleteCitation,
    handleInsertCitation,
    handleInsertBibliography,
    handleInsertCodeBlock,
    handleInsertDiagram,
    handleInsertPageBreak,
    handleSectionSettingsSave,
    handleAddComment,
    handleReplyToComment,
    handleResolveComment,
    handleReopenComment,
    handleDeleteComment,
    handleHighlightComment,
    handleCreateCommentFromSelection,
    handleCancelPendingComment,
    handleToggleTracking,
    handleToggleScreenplay,
    handleToggleMarkdown,
    handleAcceptChange,
    handleRejectChange,
    handleAcceptAllChanges,
    handleRejectAllChanges,
    handleHighlightChange,
    copiedFormatting,
    setCopiedFormatting,
    isPaintingFormat,
    setIsPaintingFormat,
    startPaintFormat,
    applyPaintFormat,
  };


  return (
    <AppContext.Provider value={value}>
      <SelectionSetterCtx.Provider value={setSelectionContext}>
        <SelectionCtx.Provider value={selectionContext}>{children}</SelectionCtx.Provider>
      </SelectionSetterCtx.Provider>
    </AppContext.Provider>
  );
};
