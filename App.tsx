import React from 'react';
import { AppProvider, useApp, useSelectionContext } from './AppContext';
import { FilesProvider } from './state/FilesContext';
import type { ComponentProps } from 'react';
import { Ribbon } from './components/Ribbon';
import { Editor } from './components/Editor';
import { StatusBar } from './components/StatusBar';
import { Sidebar } from './components/Sidebar';
import { Ruler } from './components/Ruler';
import { DialogsContainer } from './components/DialogsContainer';
import { PenkoAssistant } from './components/PenkoAssistant';

// Loaded on demand: the mobile layout only on phones, the markdown editor only in markdown mode
const MobileChatEditor = React.lazy(() => import('./components/MobileChatEditor').then(m => ({ default: m.MobileChatEditor })));
const MarkdownEditor = React.lazy(() => import('./components/MarkdownEditor').then(m => ({ default: m.MarkdownEditor })));

/** Only the ribbon follows the selection; the rest of the layout doesn't re-render as the caret moves. */
const SelectionAwareRibbon: React.FC<Omit<ComponentProps<typeof Ribbon>, 'selectionContext'>> = props => {
  const { selectionContext } = useSelectionContext();
  return <Ribbon {...props} selectionContext={selectionContext} />;
};

const MainLayout: React.FC = () => {
  const {
    contentRevision,
    pageInfo,
    documents,
    currentDoc,
    isSidebarOpen,
    setIsSidebarOpen,
    zoom, setZoom,
    showRuler, setShowRuler,
    setShowSearch,
    setShowSpellCheck,
    setShowStats,
    setShowHistory,
    setShowTemplates,
    setShowPresentation,
    setShowSettings,
    showOutline,
    setShowOutline,
    setShowDiagramEditor,
    openHeaderFooter,
    setShowCommentsPanel,
    setShowTrackChangesPanel,
    setShowImportDialog,
    setShowCollaborationDialog,
    setShowEquationDialog,
    setShowTOCDialog,
    setShowFootnoteDialog,
    setShowCitationDialog,
    setShowCodeBlockDialog,
    setShowKeyboardShortcuts,
    darkMode, setDarkMode,
    wordCount,
    pasteAsPlainText, setPasteAsPlainText,
    uiLanguage,
    isRibbonCollapsed, setIsRibbonCollapsed,
    setShowFocusMode,
    isMobile,
    docsLoaded,
    handleSaveNow,

    handleNewDoc,
    handleRemoveFromHistory,
    handleOpenDoc,
    handleContentChange,
    handleTitleChange,
    handlePageConfigChange,
    handleLanguageChange,
    executeCommand,
    handleTableAction,
    handleImageAction,
    handleOpenLinkDialog,
    handleCreateCommentFromSelection,
    handleToggleTracking,
    handleToggleScreenplay,
    handleToggleMarkdown
  } = useApp();

  if (!docsLoaded) {
    return <div className={`h-screen w-full ${darkMode ? 'bg-[#0f0f0f]' : 'bg-[#f8fafc]'}`} />;
  }

  if (isMobile) {
    return (
      <div className={`h-screen w-full overflow-hidden ${darkMode ? 'bg-zinc-950 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
        <React.Suspense fallback={null}>
          <MobileChatEditor />
        </React.Suspense>
        <PenkoAssistant />
        <DialogsContainer />
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full overflow-hidden text-sm transition-colors duration-200 ${darkMode ? 'bg-[#0f0f0f] text-gray-200' : 'bg-[#f8fafc] text-gray-900'}`}>
      
      {(
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          documents={documents}
          currentDoc={currentDoc}
          onSelectDoc={handleOpenDoc}
          onNewDoc={handleNewDoc}
          onNewFromTemplate={() => setShowTemplates(true)}
          onImportDoc={() => setShowImportDialog(true)}
          onSave={() => void handleSaveNow()}
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode(!darkMode)}
          onShowHistory={() => setShowHistory(true)}
          onShowSettings={() => setShowSettings(true)}
          onShowStats={() => setShowStats(true)}
          onRemoveFromHistory={handleRemoveFromHistory}
          uiLanguage={uiLanguage}
          onShowCollaboration={() => setShowCollaborationDialog(true)}
        />
      )}

      <div className="flex-1 flex flex-row relative h-full overflow-hidden">
        <div 
          id="editor-scroll-container"
          className="flex-1 overflow-auto flex flex-col items-center [align-items:safe_center] relative transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        >
           {showRuler && (
              <div className="sticky top-0 z-20 mt-2 mb-4 drop-shadow-sm">
                 <Ruler darkMode={darkMode} />
              </div>
           )}
           
           <div className="flex-1 flex justify-center [justify-content:safe_center] w-full px-4 pb-32 transition-transform duration-300">
              {currentDoc?.isMarkdownMode ? (
                <React.Suspense fallback={null}>
                <MarkdownEditor
                  key={`${currentDoc.id}:${contentRevision}`}
                  content={currentDoc?.content || ''}
                  markdownSource={currentDoc?.markdownSource}
                  onChange={handleContentChange}
                  darkMode={darkMode}
                  language={currentDoc?.language || 'en-US'}
                />
                </React.Suspense>
              ) : currentDoc ? (
                <Editor key={currentDoc.id} doc={currentDoc} />
              ) : null}
           </div>
        </div>

        {/* Right Columns formatting blades */}
        {!isMobile && (
          <div className="z-30 shrink-0 h-full flex">
             <SelectionAwareRibbon
              onCommand={executeCommand}
              currentDoc={currentDoc}
              onTitleChange={handleTitleChange}
              showRuler={showRuler}
              setShowRuler={setShowRuler}
              onUpdatePageConfig={handlePageConfigChange}
              onFind={() => setShowSearch(true)}
              darkMode={darkMode}
              pasteAsPlainText={pasteAsPlainText}
              togglePasteAsPlainText={() => setPasteAsPlainText(!pasteAsPlainText)}
              onShowStats={() => setShowStats(true)}
              onToggleZenMode={() => setShowFocusMode(true)}
              onTableAction={handleTableAction}
              onImageAction={handleImageAction}
              onPresent={() => setShowPresentation(true)}
              onShowHeaderFooter={() => openHeaderFooter()}
              onShowLinkDialog={handleOpenLinkDialog}
              onShowCommentsPanel={() => setShowCommentsPanel(true)}
              onCreateComment={handleCreateCommentFromSelection}
              onShowCollaboration={() => setShowCollaborationDialog(true)}
              onShowEquationDialog={() => setShowEquationDialog(true)}
              onShowTOCDialog={() => setShowTOCDialog(true)}
              onShowFootnoteDialog={() => setShowFootnoteDialog(true)}
              onShowCitationDialog={() => setShowCitationDialog(true)}
              onShowCodeBlockDialog={() => setShowCodeBlockDialog(true)}
              onShowTrackChangesPanel={() => setShowTrackChangesPanel(true)}
              onToggleTracking={handleToggleTracking}
              trackingEnabled={currentDoc?.trackingEnabled || false}
              uiLanguage={uiLanguage}
              isCollapsed={isRibbonCollapsed}
              setIsCollapsed={setIsRibbonCollapsed}
              isScreenplay={currentDoc?.isScreenplay || false}
              onToggleScreenplay={handleToggleScreenplay}
              isMarkdownMode={currentDoc?.isMarkdownMode || false}
              onToggleMarkdown={handleToggleMarkdown}
              onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
              showOutline={showOutline}
              onToggleOutline={() => setShowOutline(!showOutline)}
              onShowDiagramEditor={() => setShowDiagramEditor(true)}
              onShowSpellCheck={() => setShowSpellCheck(true)}
            />
          </div>
        )}

        {(
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40">
             <StatusBar 
               wordCount={wordCount} 
               zoom={zoom} 
               setZoom={setZoom} 
               darkMode={darkMode} 
               onShowStats={() => setShowStats(true)}
               language={currentDoc?.language || 'en-US'}
               onChangeLanguage={handleLanguageChange}
               uiLanguage={uiLanguage}
               pageInfo={currentDoc && !currentDoc.isMarkdownMode && (currentDoc.pageConfig?.cols || 1) === 1 ? pageInfo : undefined}
             />
          </div>
        )}

        <PenkoAssistant />
      </div>

      <DialogsContainer />

    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <FilesProvider>
        <MainLayout />
      </FilesProvider>
    </AppProvider>
  );
};

export default App;