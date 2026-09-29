import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor as TiptapEditor } from '@tiptap/core';
import { DocumentData } from '../types';
import { PAGE_MARGINS, PAGE_SIZES } from '../constants';
import { useApp, useSetSelectionContext } from '../AppContext';
import { createExtensions } from '../editor/extensions';
import { computeSelectionContext } from '../editor/commands';
import { prepareHtmlForEditor, sanitizeHtml, parseOptionsFor } from '../editor/sanitize';
import { noteLabel } from '../editor/extensions/references';
import { pageAtPos, buildNotes, pageFrame, pageTops, type PageNote } from '../editor/extensions/pagination';
import { zoneHtml } from '../editor/pageChrome';
import { resolveSection, sectionOfPage, displayPageNumber, type SectionInfo } from '../editor/extensions/sections';
import { t } from '../utils/translations';
import '../editor/editor.css';

const COMMIT_DEBOUNCE_MS = 300;

const cssLengthToPx = (value: string) => {
  const n = parseFloat(value);
  if (value.endsWith('mm')) return n * 3.7795;
  if (value.endsWith('cm')) return (n * 96) / 2.54;
  if (value.endsWith('in')) return n * 96;
  return n;
};

/**
 * Word/character counts for the status bar. The plain text (only needed by the
 * stats dialog, assistant, etc.) is computed on first read, not on every save.
 */
const statsOf = (editor: TiptapEditor) => {
  let text: string | null = null;
  // A just-destroyed editor (React StrictMode remount) has no storage any more
  const counter = editor.isDestroyed ? undefined : (editor.storage as any).characterCount;
  return {
    words: counter ? counter.words() : 0,
    characters: counter ? counter.characters() : 0,
    get text() {
      if (text === null) text = editor.isDestroyed ? '' : editor.getText({ blockSeparator: '\n' });
      return text;
    },
  };
};

/** Copies the content of the old `doc.footnotes` array into footnote nodes. */
const migrateLegacyFootnotes = (editor: TiptapEditor, doc: DocumentData) => {
  if (!doc.footnotes?.length) return;
  const tr = editor.state.tr;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'footnote' || node.attrs.content) return true;
    const legacy = doc.footnotes!.find(f => f.type === node.attrs.noteType && String(f.number) === String(node.attrs.legacyNumber ?? node.attrs.number));
    if (legacy) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, content: legacy.content });
      changed = true;
    }
    return false;
  });
  if (changed) {
    tr.setMeta('addToHistory', false).setMeta('preventTrack', true);
    editor.view.dispatch(tr);
  }
};

interface NoteItem {
  pos: number;
  number: number;
  noteType: 'footnote' | 'endnote';
  content: string;
}

const collectNotes = (editor: TiptapEditor): NoteItem[] => {
  const notes: NoteItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'footnote') notes.push({ pos, number: node.attrs.number, noteType: node.attrs.noteType, content: node.attrs.content });
    return true;
  });
  return notes;
};

/** `fitWidth` (mobile): the page takes the container width with slim margins, unscaled and unpaginated, so text stays readable. */
export const Editor: React.FC<{ doc: DocumentData; fitWidth?: boolean }> = ({ doc, fitWidth = false }) => {
  const {
    zoom,
    darkMode,
    pasteAsPlainText,
    isPaintingFormat,
    applyPaintFormat,
    setActiveEditor,
    registerEditorFlush,
    updateCurrentDoc,
    setStats,
    setSelectedImage,
    contentRevision,
    handleInsertImageFiles,
    setEditingFootnote,
    setShowFootnoteDialog,
    setEditingEquation,
    setShowEquationDialog,
    collabSession,
    uiLanguage,
    setPageInfo,
    openHeaderFooter,
  } = useApp();
  const setSelectionContext = useSetSelectionContext();

  const collab = collabSession && collabSession.docId === doc.id ? collabSession : null;
  const pasteRef = useRef(pasteAsPlainText);
  pasteRef.current = pasteAsPlainText;
  const insertFilesRef = useRef(handleInsertImageFiles);
  insertFilesRef.current = handleInsertImageFiles;

  const dirty = useRef(false);
  const commitTimer = useRef<number>(0);
  const selectionFrame = useRef<number>(0);
  const [notes, setNotes] = useState<NoteItem[]>([]);

  const commitRef = useRef<() => void>(() => {});

  // Only used when the editor is (re)created — never recomputed while typing,
  // since sanitizing a long document is expensive.
  const initialContent = useMemo(
    () => (collab ? undefined : prepareHtmlForEditor(doc.content)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc.id, collab?.document],
  );
  const extensions = useMemo(() => createExtensions({ collaboration: collab }), [collab?.document]);

  const editor = useEditor(
    {
      extensions,
      content: initialContent,
      parseOptions: parseOptionsFor(initialContent || ''),
      shouldRerenderOnTransaction: false,
      immediatelyRender: true,
      editorProps: {
        attributes: {
          class: 'penko-prosemirror outline-none',
          role: 'textbox',
          'aria-label': t(uiLanguage, 'documentEditor'),
          'aria-multiline': 'true',
          // Document text direction follows its content, not the UI language (RTL UI for Arabic).
          dir: 'auto',
        },
        // Keep the caret clear of the sticky ruler / floating status bar when scrolling
        scrollMargin: { top: 56, bottom: 96, left: 0, right: 0 },
        scrollThreshold: { top: 56, bottom: 96, left: 0, right: 0 },
        transformPastedHTML: html => prepareHtmlForEditor(html),
        handlePaste: (view, event) => {
          const files = Array.from(event.clipboardData?.files || []).filter(f => f.type.startsWith('image/'));
          if (files.length) {
            void insertFilesRef.current(files);
            return true;
          }
          if (pasteRef.current) {
            const text = event.clipboardData?.getData('text/plain') || '';
            view.dispatch(view.state.tr.insertText(text));
            return true;
          }
          return false;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false;
          const files = Array.from(event.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
          if (!files.length) return false;
          event.preventDefault();
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (coords) view.dispatch(view.state.tr.setSelection((view.state.selection.constructor as any).near(view.state.doc.resolve(coords.pos))));
          void insertFilesRef.current(files);
          return true;
        },
      },
      onCreate: ({ editor: ed }) => {
        migrateLegacyFootnotes(ed, doc);
        ed.commands.setReferenceData({ citations: doc.citations || [], tocTitle: t(uiLanguage, 'tableOfContents'), tocEmpty: t(uiLanguage, 'noHeadingsFoundInDoc') });
      },
      onUpdate: () => {
        dirty.current = true;
        window.clearTimeout(commitTimer.current);
        // Serialising a long document is the expensive part of saving: do it when the browser is idle
        commitTimer.current = window.setTimeout(() => {
          if ('requestIdleCallback' in window) (window as any).requestIdleCallback(() => commitRef.current(), { timeout: 700 });
          else commitRef.current();
        }, COMMIT_DEBOUNCE_MS);
      },
      onSelectionUpdate: ({ editor: ed }) => scheduleSelection(ed),
      onTransaction: ({ editor: ed, transaction }) => {
        if (transaction.docChanged) scheduleSelection(ed);
      },
      onDestroy: () => {
        // flush happens through commitRef in the cleanup below
      },
    },
    [doc.id, collab?.document],
  );

  // Function declaration (hoisted): collaborative editors can emit transactions during construction
  function scheduleSelection(ed: TiptapEditor) {
    if (selectionFrame.current) cancelAnimationFrame(selectionFrame.current);
    selectionFrame.current = requestAnimationFrame(() => {
      selectionFrame.current = 0;
      if (ed.isDestroyed) return;
      const ctx = computeSelectionContext(ed);
      setSelectionContext(ctx);
      setPageInfo(info => {
        const current = pageAtPos(ed.state, ed.state.selection.from);
        return info.current === current ? info : { ...info, current };
      });
      const sel: any = ed.state.selection;
      if (sel.node?.type?.name === 'image') {
        setSelectedImage({ pos: sel.from, attrs: sel.node.attrs, dom: (ed.view.nodeDOM(sel.from) as HTMLElement) || null });
      } else {
        setSelectedImage(null);
      }
    });
  }

  // Commit editor content to the document store (debounced; flushed on switch/unload)
  commitRef.current = () => {
    window.clearTimeout(commitTimer.current);
    if (!editor || editor.isDestroyed || !dirty.current) return;
    dirty.current = false;
    const html = editor.getHTML();
    updateCurrentDoc(d => (d.id === doc.id ? { content: html } : {}));
    setNotes(collectNotes(editor));
    setStats(statsOf(editor));
  };

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    setActiveEditor(editor);
    registerEditorFlush(() => commitRef.current());
    setNotes(collectNotes(editor));
    setStats(statsOf(editor));
    // Handy for debugging and end-to-end tests (dev builds only)
    if (import.meta.env.DEV) (window as any).__penkoEditor = editor;
    const onFootnote = ({ pos, node }: any) => {
      if (typeof pos !== 'number') return;
      setEditingFootnote({ pos, content: node.attrs.content, noteType: node.attrs.noteType });
      setShowFootnoteDialog(true);
    };
    const onEquation = ({ pos, node }: any) => {
      if (typeof pos !== 'number') return;
      setEditingEquation({ pos, latex: node.attrs.latex, display: node.attrs.display });
      setShowEquationDialog(true);
    };
    editor.on('penko:editFootnote' as any, onFootnote);
    editor.on('penko:editEquation' as any, onEquation);
    return () => {
      commitRef.current();
      editor.off('penko:editFootnote' as any, onFootnote);
      editor.off('penko:editEquation' as any, onEquation);
      registerEditorFlush(null);
      setActiveEditor(null);
      if (selectionFrame.current) cancelAnimationFrame(selectionFrame.current);
    };
  }, [editor]);

  // Content replaced from outside the editor (restore version, markdown, focus mode…)
  const lastRevision = useRef(contentRevision);
  useEffect(() => {
    if (!editor || editor.isDestroyed || contentRevision === lastRevision.current) return;
    lastRevision.current = contentRevision;
    if (collab) return;
    dirty.current = false;
    const html = prepareHtmlForEditor(doc.content);
    editor.commands.setContent(html, { emitUpdate: false, parseOptions: parseOptionsFor(html) });
    migrateLegacyFootnotes(editor, doc);
    setNotes(collectNotes(editor));
    setStats(statsOf(editor));
  }, [contentRevision, editor]);

  // Screenplay mode + labels
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    (editor.storage as any).screenplay.enabled = !!doc.isScreenplay;
  }, [editor, doc.isScreenplay]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setReferenceData({ tocTitle: t(uiLanguage, 'tableOfContents'), tocEmpty: t(uiLanguage, 'noHeadingsFoundInDoc') });
  }, [editor, uiLanguage]);

  // Paint format: apply to the next selection made with the mouse
  const paintRef = useRef(isPaintingFormat);
  paintRef.current = isPaintingFormat;
  const handleMouseUp = () => {
    if (!paintRef.current || !editor) return;
    requestAnimationFrame(() => {
      if (!editor.state.selection.empty) applyPaintFormat();
    });
  };

  // --- Layout (unchanged look) ---
  const pageConfig = doc.pageConfig;
  const size = pageConfig?.size || 'A4';
  const orientation = pageConfig?.orientation || 'portrait';
  const margin = pageConfig?.margins || 'normal';
  const cols = pageConfig?.cols || 1;

  let width = PAGE_SIZES[size].width;
  let height = PAGE_SIZES[size].height;
  if (orientation === 'landscape') [width, height] = [height, width];
  const padding = PAGE_MARGINS[margin];

  const pageHeightPx = cssLengthToPx(height);
  const paddingPx = cssLengthToPx(padding);

  const paginated = cols === 1 && !fitWidth;
  const pageWidthPx = cssLengthToPx(width);
  const PAGE_GAP = 24;
  const [pageCount, setPageCount] = useState(1);
  const [lastPageNotes, setLastPageNotes] = useState<PageNote[]>([]);
  // Pages in the other orientation (sections), as a '0101…' string per page
  const [pageAltSig, setPageAltSig] = useState('');

  // Header/footer content for every page (also used by the page boundaries)
  const chromeDoc = useMemo(
    () => ({
      header: doc.header,
      footer: doc.footer,
      showPageNumbers: doc.showPageNumbers,
      pageNumberPosition: doc.pageNumberPosition,
      differentFirstPage: doc.differentFirstPage,
      pageNumberFormat: doc.pageNumberFormat,
    }),
    [doc.header, doc.footer, doc.showPageNumbers, doc.pageNumberPosition, doc.differentFirstPage, doc.pageNumberFormat],
  );
  const pageOfLabel = t(uiLanguage, 'pageXofY');
  // Set after each layout so the first header / last footer re-render when sections change
  const [, setSectionsSig] = useState('');

  /** Header/footer HTML for a page, using the settings of the section it belongs to. */
  const zoneFor = (kind: 'header' | 'footer', page: number, total: number) => {
    const sections: SectionInfo[] = (editor?.storage as any)?.pagination?.sections || [];
    const sec = sectionOfPage(page, sections);
    const settings = resolveSection(chromeDoc, sections.filter(x => x.index > 0).map(x => x.settings), sec?.index ?? 0);
    return zoneHtml(settings, kind, page, total, { pageOfLabel, displayPage: displayPageNumber(page, sections), firstOfSection: sec ? sec.firstPage === page : page === 1 });
  };
  const zoneForRef = useRef(zoneFor);
  zoneForRef.current = zoneFor;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setPagination({
      enabled: paginated,
      pageHeight: pageHeightPx,
      pageWidth: pageWidthPx,
      orientation,
      margin: paddingPx,
      gap: PAGE_GAP,
      renderZone: (kind, page, total) => {
        const html = zoneForRef.current(kind, page, total);
        if (!html) return null;
        const el = document.createElement('div');
        el.className = 'penko-zone';
        el.innerHTML = html;
        return el;
      },
      onLayout: (total, lastNotes) => {
        setPageCount(total);
        setSectionsSig((editor.storage as any).pagination?.sectionsSig || '');
        const alt: boolean[] = (editor.storage as any).pagination?.pageAlt || [];
        setPageAltSig(alt.some(Boolean) ? alt.map(a => (a ? 1 : 0)).join('') : '');
        setLastPageNotes(prev =>
          prev.length === lastNotes.length && prev.every((n, i) => n.pos === lastNotes[i].pos && n.label === lastNotes[i].label && n.content === lastNotes[i].content) ? prev : lastNotes,
        );
        setPageInfo(info => {
          const current = Math.min(pageAtPos(editor.state, editor.state.selection.from), total);
          return info.total === total && info.current === current ? info : { current, total };
        });
      },
    });
  }, [editor, paginated, pageHeightPx, pageWidthPx, orientation, paddingPx, chromeDoc, pageOfLabel]);

  // Non-paginated layouts (columns, mobile) keep the single header/footer band
  const header = useMemo(() => sanitizeHtml(doc.header || ''), [doc.header]);
  const footer = useMemo(() => sanitizeHtml(doc.footer || ''), [doc.footer]);
  const { showPageNumbers, pageNumberPosition } = doc;
  const renderHF = (html: string) => html.replace(/\{PAGE\}/g, '1').replace(/\{PAGES\}/g, '1');

  const firstHeader = paginated ? zoneFor('header', 1, pageCount) : '';
  const lastFooter = paginated ? zoneFor('footer', pageCount, pageCount) : '';
  const pageBg = pageConfig?.backgroundColor || (darkMode ? '#1f1f1f' : '#ffffff');
  const canvas = darkMode ? '#0f0f0f' : '#f8fafc';

  // Mixed orientations: page positions and the sheets drawn behind pages of the other orientation
  const geometry = { pageWidth: pageWidthPx, pageHeight: pageHeightPx, gap: PAGE_GAP };
  const pageAlt = paginated && pageAltSig.length === pageCount ? Array.from(pageAltSig, c => c === '1') : null;
  const layoutTops = pageAlt ? pageTops(geometry, pageAlt) : null;
  const firstFrame = pageFrame(geometry, !!pageAlt?.[0]);
  const lastFrame = pageFrame(geometry, !!pageAlt?.[pageCount - 1]);
  const frameStyle = (f: { left: number; width: number }) => ({ left: f.left, width: f.width });

  // Clicking a footnote in a page's notes area opens it for editing
  const onPageClick = (e: React.MouseEvent) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-note-pos]');
    if (!item || !editor) return;
    const pos = Number(item.dataset.notePos);
    const node = editor.state.doc.nodeAt(pos);
    if (node?.type.name !== 'footnote') return;
    setEditingFootnote({ pos, content: node.attrs.content, noteType: node.attrs.noteType });
    setShowFootnoteDialog(true);
  };
  const lastNotesHtml = useMemo(() => (lastPageNotes.length ? buildNotes('div', lastPageNotes).outerHTML : ''), [lastPageNotes]);

  // Double-clicking a page's header/footer area edits the header/footer of that page's section
  const onChromeDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const zone = target.closest<HTMLElement>('.penko-page-header-zone, .penko-page-footer-zone, .penko-first-header, .penko-last-footer');
    if (!zone) return;
    let page = 1;
    if (zone.classList.contains('penko-last-footer')) page = pageCount;
    else if (!zone.classList.contains('penko-first-header')) {
      const endsPage = Number(zone.closest<HTMLElement>('.penko-page-boundary')?.dataset.page || 1);
      page = zone.classList.contains('penko-page-header-zone') ? endsPage + 1 : endsPage;
    }
    openHeaderFooter({ page });
  };

  // Paginated: footnotes are drawn at the bottom of each page by the layout
  const footnotes = paginated ? [] : notes.filter(n => n.noteType === 'footnote');
  const endnotes = notes.filter(n => n.noteType === 'endnote');

  const openNote = (n: NoteItem) => {
    setEditingFootnote({ pos: n.pos, content: n.content, noteType: n.noteType });
    setShowFootnoteDialog(true);
  };

  return (
    <div
      className="transition-transform origin-top duration-200 ease-out flex flex-col items-center [align-items:safe_center] pb-20 print:transform-none print:pb-0 print:items-start"
      style={fitWidth ? { width: '100%' } : { transform: `scale(${zoom / 100})` }}
    >
      <div
        className={`penko-page page-shadow relative transition-all duration-200 flex flex-col
           ${darkMode ? 'text-gray-200' : 'text-black'}
           print:bg-white print:text-black print:shadow-none print:w-full print:h-auto
        `}
        data-paginated={paginated ? 'true' : 'false'}
        data-page-width={pageWidthPx.toFixed(2)}
        data-page-height={pageHeightPx.toFixed(2)}
        data-page-count={pageCount}
        data-page-margin={paddingPx.toFixed(2)}
        data-page-background={pageConfig?.backgroundColor || '#ffffff'}
        data-page-alt={pageAlt ? pageAltSig : undefined}
        onDoubleClick={paginated ? onChromeDoubleClick : undefined}
        onClick={paginated ? onPageClick : undefined}
        style={{
          width: fitWidth ? '100%' : width,
          minHeight: fitWidth ? '60vh' : layoutTops ? layoutTops.total : paginated ? pageCount * pageHeightPx + (pageCount - 1) * PAGE_GAP : height,
          isolation: 'isolate',
          backgroundColor: pageBg,
          ['--penko-page-bg' as any]: pageBg,
          ['--penko-page-margin' as any]: `${paddingPx}px`,
          ['--penko-canvas' as any]: canvas,
        }}
      >
        {pageAlt &&
          layoutTops &&
          pageAlt.map((alt, i) => {
            if (!alt) return null;
            const f = pageFrame(geometry, true);
            const top = layoutTops.tops[i];
            return (
              <React.Fragment key={i}>
                {/* narrower than the page element: hide its background beside the page */}
                {f.left > 0 && <div className="penko-alt-canvas" style={{ position: 'absolute', zIndex: -1, top, height: f.height, left: 0, right: 0, background: canvas }} />}
                <div className="penko-alt-sheet page-shadow" style={{ position: 'absolute', zIndex: -1, top, height: f.height, left: f.left, width: f.width, background: pageBg }} />
              </React.Fragment>
            );
          })}
        {paginated && (
          <div
            className="penko-first-header penko-page-header-zone-static"
            style={{ position: 'absolute', top: 0, ...frameStyle(firstFrame), height: paddingPx }}
            title={t(uiLanguage, 'doubleClickToEditHeader')}
            dangerouslySetInnerHTML={{ __html: firstHeader ? `<div class="penko-zone">${firstHeader}</div>` : '' }}
          />
        )}
        {paginated && lastNotesHtml && (
          <div
            className="penko-last-notes"
            style={{ position: 'absolute', bottom: paddingPx, ...frameStyle(lastFrame) }}
            dangerouslySetInnerHTML={{ __html: lastNotesHtml }}
          />
        )}
        {paginated && (
          <div
            className="penko-last-footer penko-page-footer-zone-static"
            style={{ position: 'absolute', bottom: 0, ...frameStyle(lastFrame), height: paddingPx }}
            title={t(uiLanguage, 'doubleClickToEditFooter')}
            dangerouslySetInnerHTML={{ __html: lastFooter ? `<div class="penko-zone">${lastFooter}</div>` : '' }}
          />
        )}
        {!paginated && (header || (showPageNumbers && pageNumberPosition?.startsWith('header'))) && (
          <div
            className={`print-header pt-4 pb-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} print:border-gray-300`}
            style={{ fontSize: '10pt', minHeight: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: padding, paddingRight: padding }}
          >
            <div style={{ flex: 1, textAlign: 'left' }}>{pageNumberPosition === 'header-left' && showPageNumbers ? '1' : ''}</div>
            <div
              style={{ flex: 1, textAlign: 'center' }}
              dangerouslySetInnerHTML={{ __html: renderHF(header || (pageNumberPosition === 'header-center' && showPageNumbers ? '{PAGE}' : '')) }}
            />
            <div style={{ flex: 1, textAlign: 'right' }}>{pageNumberPosition === 'header-right' && showPageNumbers ? '1' : ''}</div>
          </div>
        )}

        <EditorContent
          editor={editor}
          id="editor-content"
          spellCheck
          lang={doc.language || 'en-US'}
          onMouseUp={handleMouseUp}
          onClick={e => {
            if (e.target === e.currentTarget && editor) editor.commands.focus('end');
          }}
          className={`penko-doc outline-none flex-1 ${isPaintingFormat ? 'cursor-cell' : 'cursor-text'} ${doc.isScreenplay ? 'screenplay-mode' : ''} ${darkMode ? 'penko-doc-dark' : ''}`}
          style={{
            boxSizing: 'border-box',
            width: '100%',
            padding: fitWidth ? '20px 16px' : padding,
            fontSize: '11pt',
            lineHeight: '1.15',
            fontFamily: '"Calibri", "Arial", sans-serif',
            textAlign: 'left',
            columnCount: cols > 1 ? cols : undefined,
            columnGap: cols > 1 ? '40px' : undefined,
            columnRule: cols > 1 ? '1px solid #e5e7eb' : undefined,
            ['--penko-canvas' as any]: darkMode ? '#0f0f0f' : '#f8fafc',
            ['--penko-page-margin' as any]: `${paddingPx}px`,
          }}
        />

        {(footnotes.length > 0 || endnotes.length > 0) && (
          <div className="penko-notes" style={{ paddingLeft: padding, paddingRight: padding, paddingBottom: '24px', fontSize: '9pt' }}>
            {footnotes.length > 0 && (
              <div className={`pt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-300'}`} style={{ width: '40%' }} />
            )}
            {footnotes.length > 0 && (
              <ol className="penko-footnotes list-none p-0 m-0">
                {footnotes.map(n => (
                  <li key={`f-${n.pos}`} className="flex gap-1 cursor-pointer hover:underline" onClick={() => openNote(n)}>
                    <sup>{noteLabel('footnote', n.number)}</sup>
                    <span>{n.content}</span>
                  </li>
                ))}
              </ol>
            )}
            {endnotes.length > 0 && (
              <div className="mt-4">
                <div className="font-bold mb-1" style={{ fontSize: '10pt' }}>{t(uiLanguage, 'endnotes')}</div>
                <ol className="penko-endnotes list-none p-0 m-0">
                  {endnotes.map(n => (
                    <li key={`e-${n.pos}`} className="flex gap-1 cursor-pointer hover:underline" onClick={() => openNote(n)}>
                      <sup>{noteLabel('endnote', n.number)}</sup>
                      <span>{n.content}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {!paginated && (footer || (showPageNumbers && pageNumberPosition?.startsWith('footer'))) && (
          <div
            className={`print-footer pb-4 pt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} print:border-gray-300`}
            style={{ fontSize: '10pt', minHeight: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: padding, paddingRight: padding }}
          >
            <div style={{ flex: 1, textAlign: 'left' }}>{pageNumberPosition === 'footer-left' && showPageNumbers ? '1' : ''}</div>
            <div
              style={{ flex: 1, textAlign: 'center' }}
              dangerouslySetInnerHTML={{ __html: renderHF(footer || (pageNumberPosition === 'footer-center' && showPageNumbers ? '{PAGE}' : '')) }}
            />
            <div style={{ flex: 1, textAlign: 'right' }}>{pageNumberPosition === 'footer-right' && showPageNumbers ? '1' : ''}</div>
          </div>
        )}
      </div>

      <div className={`text-xs mt-2 select-none print:hidden ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{t(uiLanguage, 'endOfDocumentMarker')}</div>
    </div>
  );
};

Editor.displayName = 'Editor';
