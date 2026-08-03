import React from 'react';
import { useApp } from '../AppContext';
import { AdvancedFindReplace } from './AdvancedFindReplace';
import { SpellChecker } from './SpellChecker';
import { StatsDialog } from './StatsDialog';
import { HistoryDialog } from './HistoryDialog';
import { DocumentOutline } from './DocumentOutline';
import { DiagramEditor } from './DiagramEditor';
import { TemplateDialog } from './TemplateDialog';
import ImportDialog from './ImportDialog';
import { SettingsDialog } from './SettingsDialog';
import { PresentationView } from './PresentationView';
import { HeaderFooterDialog } from './HeaderFooterDialog';
import { LinkDialog } from './LinkDialog';
import CollaborationDialog from './CollaborationDialog';
import EquationDialog from './EquationDialog';
import TableOfContentsDialog from './TableOfContentsDialog';
import FootnoteDialog from './FootnoteDialog';
import CitationDialog from './CitationDialog';
import CodeBlockDialog from './CodeBlockDialog';
import { CommentsPanel } from './CommentsPanel';
import { ImageToolbar } from './ImageToolbar';
import { ImageGallery } from './ImageGallery';
import InstallPrompt from './InstallPrompt';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';
import { ToastContainer } from './Toast';
import { FocusMode } from './FocusMode';

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
    showTrackChangesPanel,
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
    currentUser,
    darkMode,
    rawText,
    pasteAsPlainText, setPasteAsPlainText,
    showRuler, setShowRuler,
    uiLanguage, setUiLanguage,
    currentDoc,
    editorRef,
    toast,
    showFocusMode, setShowFocusMode,
    typewriterMode, setTypewriterMode,
    wordGoal, setWordGoal,

    handleContentChange,
    handleApplyCorrection,
    handleRestoreVersion,
    handleTemplateSelect,
    handleImportDocument,
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
    handleAddComment,
    handleReplyToComment,
    handleResolveComment,
    handleDeleteComment,
    handleHighlightComment,
    handleImageAction
  } = useApp();

  return (
    <>
      <AdvancedFindReplace isOpen={showSearch} onClose={() => setShowSearch(false)} darkMode={darkMode} uiLanguage={uiLanguage} editorRef={editorRef} />
      <SpellChecker
        isOpen={showSpellCheck}
        onClose={() => setShowSpellCheck(false)}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
        content={currentDoc?.content || ''}
        documentLanguage={currentDoc?.language || 'en-US'}
        onApplyCorrection={handleApplyCorrection}
      />
      <StatsDialog isOpen={showStats} onClose={() => setShowStats(false)} text={rawText} darkMode={darkMode} uiLanguage={uiLanguage} />
      <HistoryDialog isOpen={showHistory} onClose={() => setShowHistory(false)} docId={currentDoc?.id || ''} onRestore={handleRestoreVersion} darkMode={darkMode} uiLanguage={uiLanguage} currentContent={currentDoc?.content || ''} />
      <DocumentOutline isOpen={showOutline} onClose={() => setShowOutline(false)} darkMode={darkMode} uiLanguage={uiLanguage} editorRef={editorRef} />
      <DiagramEditor isOpen={showDiagramEditor} onClose={() => setShowDiagramEditor(false)} darkMode={darkMode} uiLanguage={uiLanguage} />
      <TemplateDialog isOpen={showTemplates} onClose={() => setShowTemplates(false)} onSelect={handleTemplateSelect} darkMode={darkMode} uiLanguage={uiLanguage} />
      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImport={handleImportDocument}
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
             darkMode={darkMode}
          />
      )}
      <HeaderFooterDialog
        isOpen={showHeaderFooter}
        onClose={() => setShowHeaderFooter(false)}
        darkMode={darkMode}
        headerContent={currentDoc?.header || ''}
        footerContent={currentDoc?.footer || ''}
        showPageNumbers={currentDoc?.showPageNumbers || false}
        pageNumberPosition={currentDoc?.pageNumberPosition || 'footer-center'}
        onSave={handleHeaderFooterSave}
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
        currentContent={currentDoc?.content || ''}
        onContentChange={handleContentChange}
        userName={currentUser}
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
        currentContent={currentDoc?.content || ''}
        uiLanguage={uiLanguage}
      />
      <FootnoteDialog
        isOpen={showFootnoteDialog}
        onClose={() => setShowFootnoteDialog(false)}
        onInsert={handleInsertFootnote}
        darkMode={darkMode}
        existingNotes={currentDoc?.footnotes || []}
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
        onDeleteComment={handleDeleteComment}
        onHighlightComment={handleHighlightComment}
      />

      {/* Image Toolbar - shows when image selected */}
      {selectedImage && (
        <ImageToolbar
          image={selectedImage}
          onPositionChange={(mode) => {
            import('../utils/imageUtils').then(({ applyImagePosition }) => {
              applyImagePosition(selectedImage, mode);
            });
          }}
          onResize={(percent) => editorRef.current?.resizeImage(percent)}
          onRotate={(degrees) => {
            import('../utils/imageUtils').then(({ rotateImage }) => {
              rotateImage(selectedImage, degrees);
            });
          }}
          onEffect={(effect, value) => {
            import('../utils/imageUtils').then(({ applyImageEffect }) => {
              applyImageEffect(selectedImage, effect, value);
            });
          }}
          onAltText={() => {
            const currentAlt = selectedImage.alt || '';
            const newAlt = prompt('Enter alt text for accessibility:', currentAlt);
            if (newAlt !== null) {
              import('../utils/imageUtils').then(({ setImageAltText }) => {
                setImageAltText(selectedImage, newAlt);
              });
            }
          }}
          onReplace={() => handleImageAction('replace')}
          onDelete={() => {
            if (confirm('Delete this image?')) {
              selectedImage.remove();
              setSelectedImage(null);
              toast.success('Image deleted');
            }
          }}
          darkMode={darkMode}
          language={uiLanguage}
        />
      )}

      {/* Image Gallery */}
      {showImageGallery && (
        <ImageGallery
          editorElement={editorRef.current?.getInnerHtml() ? document.getElementById('editor-content') : null}
          onClose={() => setShowImageGallery(false)}
          onImageSelect={(img) => {
            img.scrollIntoView({ behavior: 'smooth', block: 'center' });
            img.click();
          }}
          onImageDelete={(img) => {
            if (confirm('Delete this image?')) {
              img.remove();
              toast.success('Image deleted');
            }
          }}
          darkMode={darkMode}
          language={uiLanguage}
        />
      )}

      {/* PWA Install Prompt */}
      <InstallPrompt darkMode={darkMode} />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
        darkMode={darkMode}
        uiLanguage={uiLanguage}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onClose={toast.closeToast} darkMode={darkMode} />

      {/* Focus Mode */}
      {showFocusMode && currentDoc && (
        <FocusMode
          content={currentDoc.content}
          onChange={(html) => {
            const div = document.createElement('div');
            div.innerHTML = html;
            const text = div.textContent || '';
            handleContentChange(html, text);
          }}
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
