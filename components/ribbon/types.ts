import { DocumentData, PageConfig, SelectionContext } from '../../types';
import { LanguageCode } from '../../utils/translations';

export interface RibbonProps {
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
  /** Legacy alias of `onToggleZenMode` (both open focus mode); not used by the ribbon. */
  selectionContext: SelectionContext;
  onTableAction: (action: string, value?: unknown) => void;
  onImageAction: (action: string, value?: unknown) => void;
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

export type RibbonTabId = 'Home' | 'Insert' | 'Layout' | 'References' | 'Review' | 'View' | 'Table Design' | 'Image Format';

/** Read-aloud state owned by the ribbon shell so speech survives tab switches. */
export interface ReadAloudState {
  isSpeaking: boolean;
  toggle: () => void;
}
