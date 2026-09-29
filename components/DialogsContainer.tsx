import React, { useMemo, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { lazyDialog, always } from './lazyDialog';
import { CommentsPanel, ResolvedCommentStyles } from './CommentsPanel';
import InstallPrompt from './InstallPrompt';
import { ToastContainer } from './Toast';
import { DocumentStyleSheet } from './DocumentStyleSheet';
import { t } from '../utils/translations';
import { SyncManager } from './SyncManager';
import { setSyncDialogOpen, useSyncDialogOpen } from '../utils/sync/status';
import { sectionBreaks, resolveSection } from '../editor/extensions/sections';
import { prepareHtmlForEditor } from '../editor/sanitize';
import type { SectionEditState } from './HeaderFooterDialog';

// Dialogs/panels are code-split: each chunk is fetched the first time it opens.
const AdvancedFindReplace = lazyDialog(() => import('./AdvancedFindReplace').then((m) => m.AdvancedFindReplace));
const SpellChecker = lazyDialog(() => import('./SpellChecker').then((m) => m.SpellChecker));
const StatsDialog = lazyDialog(() => import('./StatsDialog').then((m) => m.StatsDialog));
const HistoryDialog = lazyDialog(() => import('./HistoryDialog').then((m) => m.HistoryDialog));
const DocumentOutline = lazyDialog(() => import('./DocumentOutline').then((m) => m.DocumentOutline));
const DiagramEditor = lazyDialog(() => import('./DiagramEditor').then((m) => m.DiagramEditor));
const TemplateDialog = lazyDialog(() => import('./TemplateDialog').then((m) => m.TemplateDialog));
const ImportDialog = lazyDialog(() => import('./ImportDialog').then((m) => m.default));
const SettingsDialog = lazyDialog(() => import('./SettingsDialog').then((m) => m.SettingsDialog));
const PresentationView = lazyDialog(() => import('./PresentationView').then((m) => m.PresentationView), always);
const HeaderFooterDialog = lazyDialog(() => import('./HeaderFooterDialog').then((m) => m.HeaderFooterDialog));
const LinkDialog = lazyDialog(() => import('./LinkDialog').then((m) => m.LinkDialog));
const CollaborationDialog = lazyDialog(() => import('./CollaborationDialog').then((m) => m.default));
const EquationDialog = lazyDialog(() => import('./EquationDialog').then((m) => m.default));
const TableOfContentsDialog = lazyDialog(() => import('./TableOfContentsDialog').then((m) => m.default));
const FootnoteDialog = lazyDialog(() => import('./FootnoteDialog').then((m) => m.default));
const CitationDialog = lazyDialog(() => import('./CitationDialog').then((m) => m.default));
const CodeBlockDialog = lazyDialog(() => import('./CodeBlockDialog').then((m) => m.default));
const TrackChangesPanel = lazyDialog(() => import('./TrackChangesPanel').then((m) => m.TrackChangesPanel));
const ImageToolbar = lazyDialog(() => import('./ImageToolbar').then((m) => m.ImageToolbar), always);
const ImageGallery = lazyDialog(() => import('./ImageGallery').then((m) => m.ImageGallery), always);
const KeyboardShortcutsDialog = lazyDialog(() => import('./KeyboardShortcutsDialog').then((m) => m.default));
const FocusMode = lazyDialog(() => import('./FocusMode').then((m) => m.FocusMode), always);
const SyncDialog = lazyDialog(() => import('./SyncDialog').then((m) => m.SyncDialog));
const StylesDialog = lazyDialog(() => import('./StylesDialog').then((m) => m.StylesDialog), (p) => !!p.request);

/**
 * The comments, track-changes and outline panels occupy the same spot on the
 * right: opening one closes the others (otherwise it would open hidden
 * underneath a panel that is already open).
 */
const useExclusiveRightPanels = (open: boolean[], setters: ((open: boolean) => void)[]) => {
  const prev = useRef(open);
  useEffect(() => {
    const opened = open.findIndex((isOpen, i) => isOpen && !prev.current[i]);
    prev.current = open;
    if (opened === -1) return;
    open.forEach((isOpen, i) => {
      if (isOpen && i !== opened) setters[i](false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, open);
};

export const DialogsContainer: React.FC = () => {
  const {
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
    existingLink,
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
    stylesDialog, setStylesDialog,
    selectedImage,
    currentUser,
    darkMode,
    stats,
    pasteAsPlainText, setPasteAsPlainText,
    showRuler, setShowRuler,
    uiLanguage, setUiLanguage,
    currentDoc,
    toast,
    showFocusMode, setShowFocusMode,
    typewriterMode, setTypewriterMode,
    wordGoal, setWordGoal,

    handleApplyCorrection,
    handleRestoreVersion,
    handleTemplateSelect,
    handleHeaderFooterSave,
    handleInsertLink,
    handleRemoveLink,
    handleInsertEquation,
    handleInsertTOC,
    handleInsertFootnote,
    handleInsertCitation,
    handleInsertBibliography,
    handleAddCitation,
    handleDeleteCitation,
    handleInsertCodeBlock,
    handleInsertDiagram,
    handleAddComment,
    handleReplyToComment,
    handleResolveComment,
    handleReopenComment,
    handleDeleteComment,
    handleHighlightComment,
    pendingCommentId,
    handleCancelPendingComment,
    handleToggleTracking,
    handleAcceptChange,
    handleRejectChange,
    handleAcceptAllChanges,
    handleRejectAllChanges,
    handleHighlightChange,
    headerFooterSectionPos,
    handleSectionSettingsSave,
    editor,
  } = useApp();

  // Header/footer dialog edits either the document (first section) or a later section's break node
  const headerFooterProps = useMemo(() => {
    const docProps = {
      headerContent: currentDoc?.header || '',
      footerContent: currentDoc?.footer || '',
      showPageNumbers: currentDoc?.showPageNumbers || false,
      pageNumberPosition: currentDoc?.pageNumberPosition || ('footer-center' as const),
      differentFirstPage: currentDoc?.differentFirstPage || false,
      pageNumberFormat: currentDoc?.pageNumberFormat || ('decimal' as const),
      onSave: handleHeaderFooterSave,
    };
    if (!showHeaderFooter || headerFooterSectionPos === null || !editor || editor.isDestroyed || !currentDoc) return docProps;
    const breaks = sectionBreaks(editor.state.doc);
    const index = breaks.findIndex(b => b.pos === headerFooterSectionPos) + 1;
    if (index < 1) return docProps;
    const own = breaks[index - 1].settings;
    const inherited = resolveSection(currentDoc, breaks.map(b => b.settings), index - 1);
    const pos = headerFooterSectionPos;
    return {
      headerContent: own.header ?? inherited.header,
      footerContent: own.footer ?? inherited.footer,
      showPageNumbers: own.showPageNumbers ?? inherited.showPageNumbers,
      pageNumberPosition: own.pageNumberPosition || inherited.pageNumberPosition,
      differentFirstPage: own.differentFirstPage,
      pageNumberFormat: own.pageNumberFormat || inherited.pageNumberFormat,
      section: { index, linkHeader: own.header === null, linkFooter: own.footer === null, restartNumbering: own.restartNumbering, startAt: own.startAt },
      onSave: (data: Parameters<typeof handleHeaderFooterSave>[0] & { section?: SectionEditState }) =>
        handleSectionSettingsSave(pos, {
          header: data.section?.linkHeader ? null : prepareHtmlForEditor(data.header),
          footer: data.section?.linkFooter ? null : prepareHtmlForEditor(data.footer),
          showPageNumbers: data.showPageNumbers,
          pageNumberPosition: data.pageNumberPosition,
          pageNumberFormat: data.pageNumberFormat,
          differentFirstPage: !!data.differentFirstPage,
          restartNumbering: !!data.section?.restartNumbering,
          startAt: data.section?.startAt ?? 1,
          orientation: own.orientation,
        }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHeaderFooter, headerFooterSectionPos, currentDoc?.header, currentDoc?.footer, currentDoc?.showPageNumbers, currentDoc?.pageNumberPosition, currentDoc?.differentFirstPage, currentDoc?.pageNumberFormat, editor]);

  const showSync = useSyncDialogOpen();

  useExclusiveRightPanels(
    [showCommentsPanel, showTrackChangesPanel, showOutline],
    [
      (open: boolean) => {
        // closing the comments panel mid-composition drops the pending highlight
        if (!open && pendingCommentId) handleCancelPendingComment();
        setShowCommentsPanel(open);
      },
      setShowTrackChangesPanel,
      setShowOutline,
    ],
  );

  return (
    <>
      <DocumentStyleSheet />
      <StylesDialog request={stylesDialog} onClose={() => setStylesDialog(null)} darkMode={darkMode} uiLanguage={uiLanguage} />
      <AdvancedFindReplace isOpen={showSearch} onClose={() => setShowSearch(false)} darkMode={darkMode} uiLanguage={uiLanguage} />
      <SpellChecker
        isOpen={showSpellCheck}
        onClose={() => setShowSpellCheck(false)}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
        documentLanguage={currentDoc?.language || 'en-US'}
        onApplyCorrection={handleApplyCorrection}
      />
      <StatsDialog isOpen={showStats} onClose={() => setShowStats(false)} text={showStats ? stats.text : ''} words={stats.words} darkMode={darkMode} uiLanguage={uiLanguage} />
      <HistoryDialog isOpen={showHistory} onClose={() => setShowHistory(false)} docId={currentDoc?.id || ''} onRestore={handleRestoreVersion} darkMode={darkMode} uiLanguage={uiLanguage} currentContent={currentDoc?.content || ''} />
      <DocumentOutline isOpen={showOutline} onClose={() => setShowOutline(false)} darkMode={darkMode} uiLanguage={uiLanguage} />
      <DiagramEditor isOpen={showDiagramEditor} onClose={() => setShowDiagramEditor(false)} onInsert={(dataUrl) => handleInsertDiagram(dataUrl, t(uiLanguage, 'diagram'))} darkMode={darkMode} uiLanguage={uiLanguage} />
      <TemplateDialog isOpen={showTemplates} onClose={() => setShowTemplates(false)} onSelect={handleTemplateSelect} darkMode={darkMode} uiLanguage={uiLanguage} />
      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <SettingsDialog 
         isOpen={showSettings} 
         onClose={() => setShowSettings(false)} 
         darkMode={darkMode}
         pasteAsPlainText={pasteAsPlainText}
         setPasteAsPlainText={setPasteAsPlainText}
         showRuler={showRuler}
         setShowRuler={setShowRuler}
         uiLanguage={uiLanguage}
         setUiLanguage={setUiLanguage}
      />
      {showPresentation && currentDoc && (
          <PresentationView
             content={currentDoc.content}
             onClose={() => setShowPresentation(false)}
          />
      )}
      <HeaderFooterDialog
        isOpen={showHeaderFooter}
        onClose={() => setShowHeaderFooter(false)}
        darkMode={darkMode}
        {...headerFooterProps}
      />
      <LinkDialog
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        darkMode={darkMode}
        onInsert={handleInsertLink}
        onRemove={handleRemoveLink}
        existingLink={existingLink}
      />
      <CollaborationDialog
        isOpen={showCollaborationDialog}
        onClose={() => setShowCollaborationDialog(false)}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <EquationDialog
        isOpen={showEquationDialog}
        onClose={() => setShowEquationDialog(false)}
        onInsert={handleInsertEquation}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <TableOfContentsDialog
        isOpen={showTOCDialog}
        onClose={() => setShowTOCDialog(false)}
        onInsert={handleInsertTOC}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <FootnoteDialog
        isOpen={showFootnoteDialog}
        onClose={() => setShowFootnoteDialog(false)}
        onInsert={handleInsertFootnote}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <CitationDialog
        isOpen={showCitationDialog}
        onClose={() => setShowCitationDialog(false)}
        onInsertCitation={handleInsertCitation}
        onInsertBibliography={handleInsertBibliography}
        darkMode={darkMode}
        existingCitations={currentDoc?.citations || []}
        onAddCitation={handleAddCitation}
        onDeleteCitation={handleDeleteCitation}
        uiLanguage={uiLanguage}
      />
      <CodeBlockDialog
        isOpen={showCodeBlockDialog}
        onClose={() => setShowCodeBlockDialog(false)}
        onInsert={handleInsertCodeBlock}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />
      <CommentsPanel
        isOpen={showCommentsPanel}
        onClose={() => setShowCommentsPanel(false)}
        darkMode={darkMode}
        comments={currentDoc?.comments || []}
        currentUser={currentUser}
        onAddComment={handleAddComment}
        onReplyToComment={handleReplyToComment}
        onResolveComment={handleResolveComment}
        onReopenComment={handleReopenComment}
        onDeleteComment={handleDeleteComment}
        onHighlightComment={handleHighlightComment}
        pendingCommentId={pendingCommentId}
        onCancelPendingComment={handleCancelPendingComment}
        uiLanguage={uiLanguage}
      />
      <ResolvedCommentStyles comments={currentDoc?.comments || []} darkMode={darkMode} />
      <TrackChangesPanel
        isOpen={showTrackChangesPanel}
        onClose={() => setShowTrackChangesPanel(false)}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
        onAcceptChange={handleAcceptChange}
        onRejectChange={handleRejectChange}
        onAcceptAll={handleAcceptAllChanges}
        onRejectAll={handleRejectAllChanges}
        onHighlightChange={handleHighlightChange}
        trackingEnabled={!!currentDoc?.trackingEnabled}
        onToggleTracking={handleToggleTracking}
      />

      {/* Image Toolbar - shows when image selected */}
      {selectedImage && <ImageToolbar darkMode={darkMode} language={uiLanguage} />}

      {/* Image Gallery */}
      {showImageGallery && <ImageGallery onClose={() => setShowImageGallery(false)} darkMode={darkMode} language={uiLanguage} />}

      {/* PWA Install Prompt */}
      <InstallPrompt darkMode={darkMode} />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />

      {/* Device sync (WebDAV / paired devices) */}
      <SyncManager />
      <SyncDialog isOpen={showSync} onClose={() => setSyncDialogOpen(false)} darkMode={darkMode} uiLanguage={uiLanguage} />

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onClose={toast.closeToast} darkMode={darkMode} />

      {/* Focus Mode */}
      {showFocusMode && currentDoc && (
        <FocusMode
          key={currentDoc.id}
          onExit={() => setShowFocusMode(false)}
          darkMode={darkMode}
          uiLanguage={uiLanguage}
          typewriterMode={typewriterMode}
          onToggleTypewriter={() => setTypewriterMode(!typewriterMode)}
          wordGoal={wordGoal}
          onSetWordGoal={setWordGoal}
        />
      )}
    </>
  );
};
