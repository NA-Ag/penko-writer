import React from 'react';
import { AppProvider, useApp } from './AppContext';
import { Ribbon } from './components/Ribbon';
import { Editor } from './components/Editor';
import { MarkdownEditor } from './components/MarkdownEditor';
import { StatusBar } from './components/StatusBar';
import { Sidebar } from './components/Sidebar';
import { Ruler } from './components/Ruler';
import { DialogsContainer } from './components/DialogsContainer';
import { PenkoAssistant } from './components/PenkoAssistant';
import { MobileChatEditor } from './components/MobileChatEditor';
import { FocusMode } from './components/FocusMode';
import { Minimize2 } from 'lucide-react';
import { saveToStorage } from './utils/storage';

const MainLayout: React.FC = () => {
  const {
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
    showHeaderFooter, setShowHeaderFooter,
    showLinkDialog,
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
    currentUser,
    darkMode, setDarkMode,
    wordCount,
    zenMode, setZenMode,
    pasteAsPlainText, setPasteAsPlainText,
    uiLanguage,
    isRibbonCollapsed, setIsRibbonCollapsed,
    showFocusMode, setShowFocusMode,
    typewriterMode, setTypewriterMode,
    wordGoal, setWordGoal,
    selectionContext,
    editorRef,
    isMobile,
    toast,

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
    handleContextChange,
    handleOpenLinkDialog,
    handleCreateCommentFromSelection,
    handleToggleTracking,
    handleToggleScreenplay,
    handleToggleMarkdown
  } = useApp();

  if (isMobile) {
    return (
      <div className={`h-screen w-full overflow-hidden ${darkMode ? 'bg-zinc-950 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
        <MobileChatEditor />
        <PenkoAssistant />
        <DialogsContainer />
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full overflow-hidden text-sm transition-colors duration-200 ${darkMode ? 'bg-[#0f0f0f] text-gray-200' : 'bg-[#f8fafc] text-gray-900'}`}>
      
      {!zenMode && (
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          documents={documents}
          currentDoc={currentDoc}
          onSelectDoc={handleOpenDoc}
          onNewDoc={handleNewDoc}
          onNewFromTemplate={() => setShowTemplates(true)}
          onImportDoc={() => setShowImportDialog(true)}
          onSave={() => {
            if (currentDoc) {
              saveToStorage(currentDoc);
              toast.success('Document saved!');
            }
          }}
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
          className={`flex-1 overflow-auto flex flex-col items-center relative transition-all duration-300 ${zenMode ? 'pt-10' : ''}`}
          onClick={() => setIsSidebarOpen(false)}
        >
           {!zenMode && showRuler && (
              <div className="sticky top-0 z-20 mt-2 mb-4 drop-shadow-sm">
                 <Ruler darkMode={darkMode} />
              </div>
           )}
           
           <div className={`flex-1 flex justify-center w-full px-4 pb-32 transition-transform duration-300 ${zenMode ? 'scale-105' : ''}`}>
              {currentDoc?.isMarkdownMode ? (
                <MarkdownEditor
                  content={currentDoc?.content || ''}
                  onChange={handleContentChange}
                  darkMode={darkMode}
                  language={currentDoc?.language || 'en-US'}
                />
              ) : (
                <Editor
                  content={currentDoc?.content || ''}
                  onChange={handleContentChange}
                  zoom={zoom}
                  pageConfig={currentDoc?.pageConfig}
                  darkMode={darkMode}
                  ref={editorRef}
                  pasteAsPlainText={pasteAsPlainText}
                  language={currentDoc?.language || 'en-US'}
                  onContextChange={handleContextChange}
                  header={currentDoc?.header}
                  footer={currentDoc?.footer}
                  showPageNumbers={currentDoc?.showPageNumbers}
                  pageNumberPosition={currentDoc?.pageNumberPosition}
                  isScreenplay={currentDoc?.isScreenplay}
                />
              )}
           </div>
        </div>

        {/* Right Columns formatting blades */}
        {!zenMode && !isMobile && (
          <div className="z-30 shrink-0 h-full flex">
             <Ribbon
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
              onToggleFocusMode={() => setShowFocusMode(true)}
              selectionContext={selectionContext}
              onTableAction={handleTableAction}
              onImageAction={handleImageAction}
              onPresent={() => setShowPresentation(true)}
              onShowHeaderFooter={() => setShowHeaderFooter(true)}
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

        {!zenMode && (
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
             />
          </div>
        )}

        {zenMode && (
           <button 
             onClick={() => setZenMode(false)}
             className="fixed bottom-8 right-8 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur transition-all shadow-lg z-50 group flex items-center gap-2"
           >
              <Minimize2 size={24} />
              <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-sm font-medium">Exit Focus</span>
           </button>
        )}
        <PenkoAssistant />
      </div>

      <DialogsContainer />

      {showFocusMode && (
        <FocusMode
          content={currentDoc?.content || ''}
          onChange={handleContentChange}
          onExit={() => setShowFocusMode(false)}
          darkMode={darkMode}
          uiLanguage={uiLanguage}
          typewriterMode={typewriterMode}
          onToggleTypewriter={() => setTypewriterMode(!typewriterMode)}
          wordGoal={wordGoal}
          onSetWordGoal={setWordGoal}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
};

export default App;