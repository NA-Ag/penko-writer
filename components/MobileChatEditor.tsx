import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { FileText, MoreVertical, X, Plus, LayoutTemplate, Upload, Trash2, Download } from 'lucide-react';
import { Editor } from './Editor';
import MobileToolbar from './MobileToolbar';
import { t } from '../utils/translations';
import { useEscapeKey } from '../utils/hooks';
import type { Editor as TiptapEditor } from '@tiptap/core';
import { useExportDocument, type ExportFormat } from '../utils/useExportDocument';
import { useFiles } from '../state/FilesContext';
import { setSyncDialogOpen } from '../utils/sync/status';

// Markdown mode (marked, turndown…) is code-split like on desktop.
const MarkdownEditor = React.lazy(() => import('./MarkdownEditor').then(m => ({ default: m.MarkdownEditor })));

const EXPORTS: Array<[ExportFormat, string, string]> = [
  ['docx', 'DOCX', 'exportAsDocx'],
  ['pdf', 'PDF', 'exportAsPdf'],
  ['html', 'HTML', 'exportAsHtml'],
  ['txt', 'TXT', 'exportAsTxt'],
  ['md', 'MD', 'exportAsMarkdown'],
];

/**
 * Tracks the visual viewport so the layout (and the bottom toolbar) stays
 * above the virtual keyboard.
 */
const useVisualViewport = () => {
  const read = () => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    return vv ? { height: vv.height, top: vv.offsetTop } : { height: typeof window !== 'undefined' ? window.innerHeight : 0, top: 0 };
  };
  const [state, setState] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = read();
        setState(prev => (prev.height === next.height && prev.top === next.top ? prev : next));
      });
    };
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return state;
};

/** Non-empty text blocks (paragraphs, headings, list items…) in the document. */
const countParagraphs = (editor: TiptapEditor) => {
  let count = 0;
  editor.state.doc.descendants(node => {
    if (!node.isTextblock) return true;
    if (node.textContent.trim()) count++;
    return false;
  });
  return count;
};

const menuItemClass = 'w-full text-left p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-xs';

export const MobileChatEditor: React.FC = () => {
  const {
    contentRevision,
    documents,
    currentDoc,
    editor,
    darkMode,
    setDarkMode,
    uiLanguage,
    stats,
    executeCommand,
    handleTableAction,
    handleOpenLinkDialog,
    handleTitleChange,
    handleNewDoc,
    handleToggleMarkdown,
    handleOpenDoc,
    handleDeleteDocument,
    setShowStats,
    setShowSpellCheck,
    setShowTemplates,
    setShowImportDialog,
    setShowSearch,
    setShowHistory,
    setShowSettings,
    setShowFocusMode,
    setShowPresentation,
    setShowCollaborationDialog,
  } = useApp();

  const [showDocMenu, setShowDocMenu] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const viewport = useVisualViewport();
  // Latest document for async handlers (read after pending edits were flushed)

  const words = stats.words || 0;
  // Recomputed when the (debounced) stats change. Counts from the editor's
  // document so the lazily computed full text is never built for it.
  const paragraphs = useMemo(() => {
    if (!currentDoc?.isMarkdownMode && editor && !editor.isDestroyed) return countParagraphs(editor);
    return (stats.text || '').split('\n').filter(line => line.trim()).length;
  }, [stats, editor, currentDoc?.isMarkdownMode]);

  const sortedDocs = useMemo(() => [...documents].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0)), [documents]);

  // Close sheets with Escape
  useEscapeKey(showDocMenu || showDrawer, () => {
    setShowDocMenu(false);
    setShowDrawer(false);
  });

  useEffect(() => {
    if (!showDrawer) setConfirmDelete(null);
  }, [showDrawer]);

  const titleInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  if (!currentDoc) return null;

  const startTitleEdit = () => {
    setTitleDraft(currentDoc.title || '');
    setEditingTitle(true);
  };
  const commitTitle = () => {
    const next = titleDraft.trim();
    if (next && next !== currentDoc.title) handleTitleChange(next);
    setEditingTitle(false);
  };

  /** Same behaviour as the desktop sidebar's export menu. */
  const exportDocument = useExportDocument();
  const files = useFiles();
  const runExport = (format: ExportFormat) => {
    setShowDrawer(false);
    setShowDocMenu(false);
    void exportDocument(format);
  };


  const menu = (action: () => void) => () => {
    setShowDocMenu(false);
    action();
  };

  const formatDate = (ts?: number) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString(uiLanguage === 'en-US' ? undefined : uiLanguage, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return new Date(ts).toLocaleString();
    }
  };

  return (
    <div
      className={`fixed left-0 right-0 flex flex-col w-full ${darkMode ? 'bg-zinc-950 text-gray-100' : 'bg-gray-100 text-gray-900'}`}
      style={{ top: viewport.top, height: viewport.height || '100%' }}
    >
      {/* Header bar */}
      <div className={`p-4 border-b flex justify-between items-center z-10 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setShowDrawer(true)}
            className="w-10 h-10 shrink-0 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 active:scale-95 transition-transform"
            title={t(uiLanguage, 'documents')}
            aria-label={t(uiLanguage, 'documents')}
          >
            <FileText size={20} />
          </button>
          <div className="min-w-0">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') commitTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                aria-label={t(uiLanguage, 'title')}
                className={`font-bold text-sm max-w-[180px] w-full rounded px-1 -mx-1 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-zinc-950 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}
              />
            ) : (
              <h1 className="font-bold text-sm truncate max-w-[180px]">
                <button type="button" onClick={startTitleEdit} className="truncate max-w-full text-left" title={t(uiLanguage, 'renameDocument')}>
                  {currentDoc.title || t(uiLanguage, 'untitledDocument')}
                </button>
              </h1>
            )}
            <p className="text-[10px] opacity-60 font-medium uppercase tracking-wider">
              {paragraphs} {t(uiLanguage, 'paragraphs')} • {words} {t(uiLanguage, 'words')}
            </p>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDocMenu(!showDocMenu)}
            className="p-1 hover:opacity-80"
            aria-label={t(uiLanguage, 'more')}
            aria-haspopup="menu"
            aria-expanded={showDocMenu}
          >
            <MoreVertical size={20} />
          </button>
          {showDocMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDocMenu(false)} aria-hidden="true" />
              <div
                role="menu"
                className={`absolute right-0 mt-2 w-48 max-h-[70vh] overflow-y-auto rounded-xl shadow-xl border p-2 z-20 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'}`}
              >
                <button role="menuitem" onClick={menu(() => setShowDrawer(true))} className={menuItemClass}>📄 {t(uiLanguage, 'documents')}</button>
                <button role="menuitem" onClick={menu(handleNewDoc)} className={menuItemClass}>➕ {t(uiLanguage, 'newDocument')}</button>
                <button role="menuitem" onClick={menu(() => setShowTemplates(true))} className={menuItemClass}>🗂️ {t(uiLanguage, 'templates')}</button>
                <button role="menuitem" onClick={menu(() => setShowImportDialog(true))} className={menuItemClass}>📥 {t(uiLanguage, 'importDocument')}</button>
                <button role="menuitem" onClick={menu(() => void files.saveToFile())} className={menuItemClass}>💾 {t(uiLanguage, 'saveToFile')}</button>
                <button role="menuitem" onClick={menu(() => setShowSearch(true))} className={menuItemClass}>🔎 {t(uiLanguage, 'findReplace')}</button>
                <button role="menuitem" onClick={menu(() => setShowStats(true))} className={menuItemClass}>📊 {t(uiLanguage, 'showStats')}</button>
                <button role="menuitem" onClick={menu(() => setShowSpellCheck(true))} className={menuItemClass}>🔍 {t(uiLanguage, 'spellCheck')}</button>
                <button role="menuitem" onClick={menu(() => setShowFocusMode(true))} className={menuItemClass}>🧘 {t(uiLanguage, 'focusMode')}</button>
                <button role="menuitem" onClick={menu(() => setShowPresentation(true))} className={menuItemClass}>▶️ {t(uiLanguage, 'present')}</button>
                <button role="menuitem" onClick={menu(() => setShowHistory(true))} className={menuItemClass}>🕘 {t(uiLanguage, 'history')}</button>
                <button role="menuitemcheckbox" aria-checked={!!currentDoc.isMarkdownMode} onClick={menu(handleToggleMarkdown)} className={menuItemClass}>
                  {currentDoc.isMarkdownMode ? '✅' : '⬜'} {t(uiLanguage, 'markdownMode')}
                </button>
                <button role="menuitem" onClick={menu(() => setShowCollaborationDialog(true))} className={menuItemClass}>👥 {t(uiLanguage, 'collaborate')}</button>
                <button role="menuitem" onClick={menu(() => setSyncDialogOpen(true))} className={menuItemClass}>🔄 {t(uiLanguage, 'syncTitle')}</button>
                <button role="menuitem" onClick={menu(() => setDarkMode(!darkMode))} className={menuItemClass}>{darkMode ? '☀️' : '🌙'} {t(uiLanguage, darkMode ? 'lightMode' : 'darkMode')}</button>
                <button role="menuitem" onClick={menu(() => setShowSettings(true))} className={menuItemClass}>⚙️ {t(uiLanguage, 'settings')}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Document: the real editor, fitted to the screen width */}
      <div id="editor-scroll-container" className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-3">
        {currentDoc.isMarkdownMode ? (
          <React.Suspense fallback={null}>
            <MarkdownEditor
              key={`${currentDoc.id}:${contentRevision}`}
              content={currentDoc.content || ''}
              markdownSource={currentDoc.markdownSource}
              darkMode={darkMode}
              language={currentDoc.language || 'en-US'}
            />
          </React.Suspense>
        ) : (
          <Editor key={currentDoc.id} doc={currentDoc} fitWidth />
        )}
      </div>

      {/* Formatting bar (stays above the virtual keyboard) */}
      {!currentDoc.isMarkdownMode && (
        <MobileToolbar
          onCommand={executeCommand}
          darkMode={darkMode}
          onShowLinkDialog={handleOpenLinkDialog}
          onTableAction={handleTableAction}
          uiLanguage={uiLanguage}
        />
      )}

      {/* Documents drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-label={t(uiLanguage, 'documents')}>
          <div
            className={`w-[85%] max-w-sm h-full flex flex-col shadow-xl border-r ${darkMode ? 'bg-zinc-900 border-zinc-800 text-gray-100' : 'bg-white border-gray-100 text-gray-900'}`}
          >
            <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
              <h2 className="font-bold text-sm">{t(uiLanguage, 'documents')}</h2>
              <button type="button" onClick={() => setShowDrawer(false)} className="p-1 hover:opacity-80" aria-label={t(uiLanguage, 'close')}>
                <X size={20} />
              </button>
            </div>

            <div className="p-2 grid grid-cols-3 gap-2">
              {[
                { icon: <Plus size={18} />, label: t(uiLanguage, 'new'), onClick: () => { setShowDrawer(false); handleNewDoc(); } },
                { icon: <LayoutTemplate size={18} />, label: t(uiLanguage, 'templates'), onClick: () => { setShowDrawer(false); setShowTemplates(true); } },
                { icon: <Upload size={18} />, label: t(uiLanguage, 'importLabel'), onClick: () => { setShowDrawer(false); setShowImportDialog(true); } },
              ].map(a => (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs font-semibold bg-blue-600/10 text-blue-500 active:scale-95 transition-transform"
                >
                  {a.icon}
                  <span className="truncate max-w-full">{a.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sortedDocs.map(doc => {
                const active = doc.id === currentDoc.id;
                return (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-2 rounded-lg ${active ? 'bg-blue-600/10 text-blue-500' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                  >
                    {confirmDelete === doc.id ? (
                      <div className="flex-1 flex items-center justify-between gap-2 p-2.5 text-xs">
                        <span className="font-semibold truncate">{t(uiLanguage, 'deleteDocumentQuestion')}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setConfirmDelete(null); handleDeleteDocument(doc.id); }}
                            className="px-2 py-1 rounded-lg bg-red-500 text-white font-semibold"
                          >
                            {t(uiLanguage, 'delete')}
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10 font-semibold">
                            {t(uiLanguage, 'cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => { handleOpenDoc(doc.id); setShowDrawer(false); }}
                          className="flex-1 min-w-0 text-left p-2.5"
                          aria-current={active ? 'true' : undefined}
                        >
                          <div className="text-xs font-semibold truncate">{doc.title || t(uiLanguage, 'untitledDocument')}</div>
                          <div className="text-[10px] opacity-60">{formatDate(doc.lastModified)}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(doc.id)}
                          className="p-2.5 rounded-full text-red-500 hover:bg-red-500/10 shrink-0"
                          title={t(uiLanguage, 'delete')}
                          aria-label={`${t(uiLanguage, 'delete')}: ${doc.title || t(uiLanguage, 'untitledDocument')}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={`p-2 border-t ${darkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 px-2 pb-1.5 text-[10px] opacity-60 font-medium uppercase tracking-wider">
                <Download size={12} /> {t(uiLanguage, 'exportLabel')}
              </div>
              <div className="grid grid-cols-5 gap-1">
                {EXPORTS.map(([format, short, labelKey]) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => void runExport(format)}
                    className="p-2 rounded-lg text-[10px] font-bold hover:bg-black/5 dark:hover:bg-white/5 border border-black/5 dark:border-white/10"
                    title={t(uiLanguage, labelKey)}
                    aria-label={t(uiLanguage, labelKey)}
                  >
                    {short}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button type="button" className="flex-1 bg-black/40" onClick={() => setShowDrawer(false)} aria-label={t(uiLanguage, 'close')} />
        </div>
      )}
    </div>
  );
};
