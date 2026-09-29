import { borderPatch, type ImageBorderStyle } from '../utils/imageUtils';
import type { SectionSettings } from '../editor/extensions/sections';
import React, { useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { DocumentData, Citation } from '../types';
import { generateId } from '../utils/storage';
import { saveSnapshot } from '../utils/history';
import { LanguageCode, t } from '../utils/translations';
import { runEditorCommand } from '../editor/commands';
import { prepareHtmlForEditor, safeUrl } from '../editor/sanitize';
import { parseStyle, setStyleProperty, stringifyStyle } from '../editor/extensions/styleUtils';
import type { CitationStyle } from '../editor/citations';
import type { TocStyle } from '../editor/toc';
import { textblockSegments } from '../editor/extensions/search';

import type { AppToast, DocPatch, SelectedImageInfo, PageNumberPosition } from './types';

/** Editing actions exposed through the app context (ribbon commands, inserts, images, links…). */
export interface EditingDeps {
  editor: Editor | null;
  editorRef: React.MutableRefObject<Editor | null>;
  currentDoc: DocumentData | null;
  currentDocRef: React.MutableRefObject<DocumentData | null>;
  editingEquation: { pos: number; latex: string; display: boolean } | null;
  setEditingEquation: React.Dispatch<React.SetStateAction<{ pos: number; latex: string; display: boolean } | null>>;
  selectedImage: SelectedImageInfo | null;
  setSelectedImage: (img: SelectedImageInfo | null) => void;
  setExistingLink: React.Dispatch<React.SetStateAction<{ url: string; text: string } | null>>;
  setShowLinkDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHeaderFooter: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDiagramEditor: React.Dispatch<React.SetStateAction<boolean>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  toastRef: React.MutableRefObject<AppToast>;
  uiLangRef: React.MutableRefObject<LanguageCode>;
  updateCurrentDoc: (patch: DocPatch) => void;
  updateDoc: (id: string, patch: DocPatch, opts?: { external?: boolean; touch?: boolean }) => void;
  flushPendingEdits: () => void;
}

export const useEditingActions = (deps: EditingDeps) => {
  const {
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
  } = deps;


  const executeCommand = useCallback((command: string, value: string | null = null) => {
    if (command === 'zoom') {
      setZoom(parseInt(value || '100', 10) || 100);
      return;
    }
    runEditorCommand(editorRef.current, command, value);
  }, []);

  const handleTableAction = useCallback((action: string, value?: any) => {
    const ed = editorRef.current;
    if (!ed) return;
    const c = ed.chain().focus();
    switch (action) {
      case 'insert': {
        const rows = value?.rows || 3;
        const cols = value?.cols || 3;
        c.insertTable({ rows, cols, withHeaderRow: !!value?.header }).run();
        break;
      }
      case 'addRow':
        c.addRowAfter().run();
        break;
      case 'addRowBefore':
        c.addRowBefore().run();
        break;
      case 'delRow':
        c.deleteRow().run();
        break;
      case 'addCol':
        c.addColumnAfter().run();
        break;
      case 'addColBefore':
        c.addColumnBefore().run();
        break;
      case 'delCol':
        c.deleteColumn().run();
        break;
      case 'delTable':
        c.deleteTable().run();
        break;
      case 'mergeCells':
        if (!c.mergeCells().run()) ed.chain().focus().mergeOrSplit().run();
        break;
      case 'splitCell':
        c.splitCell().run();
        break;
      case 'toggleHeader':
        c.toggleHeaderRow().run();
        break;
      case 'cellBackground':
        // Only the background changes; other cell styles (padding, borders from templates) stay
        c.command(({ tr, state }) => {
          const sel = state.selection as any;
          const cells: { node: any; pos: number }[] = [];
          if (typeof sel.forEachCell === 'function') sel.forEachCell((node: any, pos: number) => cells.push({ node, pos }));
          else {
            const $from = state.selection.$from;
            for (let d = $from.depth; d > 0; d--) {
              const node = $from.node(d);
              if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                cells.push({ node, pos: $from.before(d) });
                break;
              }
            }
          }
          cells.forEach(({ node, pos }) =>
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: setStyleProperty(node.attrs.style, 'background-color', value ? String(value) : null) }),
          );
          return cells.length > 0;
        }).run();
        break;
      case 'setStyle': {
        // Table style lives in the table's class; CSS handles light/dark variants.
        const { state } = ed;
        const $from = state.selection.$from;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'table') {
            const cls = (node.attrs.class || '').split(/\s+/).filter((x: string) => x && !x.startsWith('table-style-'));
            if (value && value !== 'default') cls.push(`table-style-${value}`);
            ed.chain().focus().command(({ tr }) => {
              tr.setNodeMarkup($from.before(d), undefined, { ...node.attrs, class: cls.join(' ') || null });
              return true;
            }).run();
            break;
          }
        }
        break;
      }
      case 'setWidth': {
        const { state } = ed;
        const $from = state.selection.$from;
        let tableDepth = -1;
        let cellIndex = -1;
        for (let d = $from.depth; d > 0; d--) {
          const n = $from.node(d);
          if ((n.type.name === 'tableCell' || n.type.name === 'tableHeader') && cellIndex === -1) cellIndex = $from.index(d - 1);
          if (n.type.name === 'table') {
            tableDepth = d;
            break;
          }
        }
        if (tableDepth === -1 || cellIndex === -1) break;
        const tablePos = $from.before(tableDepth);
        const table = $from.node(tableDepth);
        ed.chain().focus().command(({ tr }) => {
          table.forEach((row, rowOffset) => {
            if (cellIndex >= row.childCount) return;
            let cellOffset = 0;
            for (let i = 0; i < cellIndex; i++) cellOffset += row.child(i).nodeSize;
            const cell = row.child(cellIndex);
            const pos = tablePos + 1 + rowOffset + 1 + cellOffset;
            tr.setNodeMarkup(pos, undefined, { ...cell.attrs, colwidth: null, style: setStyleProperty(cell.attrs.style, 'width', value || null) });
          });
          return true;
        }).run();
        break;
      }
    }
  }, []);

  const findImagePos = (ed: Editor): number | null => {
    const sel: any = ed.state.selection;
    if (sel.node?.type?.name === 'image') return sel.from;
    return null;
  };

  const updateSelectedImage = useCallback((patch: { attrs?: Record<string, any>; style?: Record<string, string | null> }) => {
    const ed = editorRef.current;
    if (!ed) return;
    const pos = findImagePos(ed) ?? selectedImageRef.current?.pos ?? null;
    if (pos === null) return;
    const node = ed.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'image') return;
    let style = node.attrs.style as string | null;
    if (patch.style) {
      const map = parseStyle(style);
      Object.entries(patch.style).forEach(([k, v]) => {
        if (v === null || v === '') delete map[k];
        else map[k] = v;
      });
      style = stringifyStyle(map) || null;
    }
    const attrs = { ...node.attrs, ...(patch.attrs || {}), style };
    ed.chain().command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, attrs);
      return true;
    }).setNodeSelection(pos).run();
  }, []);

  const selectedImageRef = useRef(selectedImage);
  selectedImageRef.current = selectedImage;

  const deleteSelectedImage = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const pos = findImagePos(ed) ?? selectedImageRef.current?.pos ?? null;
    if (pos === null) return;
    ed.chain().focus().setNodeSelection(pos).deleteSelection().run();
    setSelectedImage(null);
  }, []);

  const handleImageAction = useCallback(
    (action: string, value?: any) => {
      const ed = editorRef.current;
      if (!ed) return;
      const pos = findImagePos(ed) ?? selectedImageRef.current?.pos ?? null;
      if (pos === null) return;
      const node = ed.state.doc.nodeAt(pos);
      if (!node) return;
      switch (action) {
        case 'resize':
          updateSelectedImage({ attrs: { width: null, height: null }, style: { width: `${value}%`, height: 'auto' } });
          break;
        case 'align': {
          const $pos = ed.state.doc.resolve(pos);
          if ($pos.parent.type.name === 'paragraph' || $pos.parent.type.name === 'heading') {
            ed.chain().setNodeSelection(pos).setTextAlign(value).setNodeSelection(pos).run();
          }
          updateSelectedImage({ style: { float: null, display: null, margin: null } });
          break;
        }
        case 'layout':
          if (value === 'break') updateSelectedImage({ style: { display: 'block', float: null, margin: '0 auto' } });
          else updateSelectedImage({ style: { display: null, float: null, margin: null } });
          break;
        case 'rotate': {
          const current = parseInt((parseStyle(node.attrs.style).transform || '').match(/rotate\((-?\d+)deg\)/)?.[1] || '0', 10);
          const next = (((current + Number(value || 0)) % 360) + 360) % 360;
          updateSelectedImage({ style: { transform: next ? `rotate(${next}deg)` : null } });
          break;
        }
        case 'border':
          updateSelectedImage({ style: borderPatch(value as ImageBorderStyle) });
          break;
        case 'alt':
          updateSelectedImage({ attrs: { alt: value || null } });
          break;
        case 'replace':
          handleReplaceImageRef.current();
          break;
        case 'delete':
          deleteSelectedImage();
          break;
      }
    },
    [updateSelectedImage, deleteSelectedImage],
  );


  const readImageFile = async (file: File): Promise<string> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    try {
      const { compressImage, shouldCompressImage } = await import('../utils/imageUtils');
      if (shouldCompressImage(dataUrl)) return await compressImage(dataUrl);
    } catch (e) {
      console.error('Failed to compress image:', e);
    }
    return dataUrl;
  };

  const handleInsertImageFiles = useCallback(async (files: File[] | FileList) => {
    const ed = editorRef.current;
    if (!ed) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const src = await readImageFile(file);
      ed.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run();
    }
  }, []);

  const handleReplaceImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const src = await readImageFile(file);
      updateSelectedImage({ attrs: { src } });
    };
    input.click();
  }, [updateSelectedImage]);
  const handleReplaceImageRef = useRef(handleReplaceImage);
  handleReplaceImageRef.current = handleReplaceImage;

  const handleRestoreVersion = useCallback(
    (content: string) => {
      flushPendingEdits();
      const doc = currentDocRef.current;
      if (!doc) return;
      void saveSnapshot(doc, { force: true });
      updateDoc(doc.id, { content: prepareHtmlForEditor(content) }, { external: true });
    },
    [flushPendingEdits, updateDoc],
  );

  /**
   * Replace one occurrence of `original` in the document text. `textOffset` is
   * the character offset reported by the spell checker (in plain text with
   * blocks joined by "\n"), used to pick the right occurrence.
   */
  const handleApplyCorrection = useCallback((original: string, correction: string, textOffset?: number) => {
    const ed = editorRef.current;
    if (!ed || !original) return false;
    const segments = textblockSegments(ed.state.doc);
    let offset = 0;
    let best: { from: number; to: number; dist: number } | null = null;
    for (const seg of segments) {
      let idx = seg.text.indexOf(original);
      while (idx !== -1) {
        const dist = textOffset === undefined ? 0 : Math.abs(offset + idx - textOffset);
        if (!best || dist < best.dist) best = { from: seg.positions[idx], to: seg.positions[idx + original.length - 1] + 1, dist };
        idx = seg.text.indexOf(original, idx + 1);
      }
      offset += seg.text.length + 1;
    }
    if (!best) return false;
    ed.chain().focus().insertContentAt({ from: best.from, to: best.to }, { type: 'text', text: correction }).run();
    return true;
  }, []);

  const handleHeaderFooterSave = useCallback(
    (data: {
      header: string;
      footer: string;
      showPageNumbers: boolean;
      pageNumberPosition: PageNumberPosition;
      differentFirstPage?: boolean;
      pageNumberFormat?: 'decimal' | 'roman' | 'page-of';
    }) => {
      updateCurrentDoc({
        header: prepareHtmlForEditor(data.header),
        footer: prepareHtmlForEditor(data.footer),
        showPageNumbers: data.showPageNumbers,
        pageNumberPosition: data.pageNumberPosition,
        differentFirstPage: !!data.differentFirstPage,
        pageNumberFormat: data.pageNumberFormat || 'decimal',
      });
      setShowHeaderFooter(false);
    },
    [updateCurrentDoc],
  );

  const handleOpenLinkDialog = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) {
      setExistingLink(null);
      setShowLinkDialog(true);
      return;
    }
    const href = ed.getAttributes('link').href;
    if (href) {
      ed.chain().extendMarkRange('link').run();
      const { from, to } = ed.state.selection;
      setExistingLink({ url: href, text: ed.state.doc.textBetween(from, to, ' ') });
    } else {
      const { from, to } = ed.state.selection;
      setExistingLink(from !== to ? { url: '', text: ed.state.doc.textBetween(from, to, ' ') } : null);
    }
    setShowLinkDialog(true);
  }, []);

  const handleInsertLink = useCallback((url: string, text: string) => {
    const ed = editorRef.current;
    const href = safeUrl(url);
    if (!ed || !href) return;
    const { from, to } = ed.state.selection;
    const selected = ed.state.doc.textBetween(from, to, ' ');
    if (from !== to && (!text || text === selected)) {
      // keep the existing (possibly formatted) text
      ed.chain().focus().setLink({ href }).run();
    } else {
      const label = text || url;
      ed.chain()
        .focus()
        .insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] })
        .run();
    }
    setShowLinkDialog(false);
  }, []);

  const handleRemoveLink = useCallback(() => {
    editorRef.current?.chain().focus().extendMarkRange('link').unsetLink().run();
    setShowLinkDialog(false);
  }, []);

  const handleInsertEquation = useCallback((latex: string, display = false) => {
    const ed = editorRef.current;
    if (!ed || !latex.trim()) return;
    const editing = editingEquationRef.current;
    if (editing) {
      ed.chain()
        .focus()
        .command(({ tr }) => {
          const node = tr.doc.nodeAt(editing.pos);
          if (node?.type.name === 'equation') tr.setNodeMarkup(editing.pos, undefined, { latex, display });
          return true;
        })
        .run();
      setEditingEquation(null);
    } else {
      ed.chain().focus().insertContent({ type: 'equation', attrs: { latex, display } }).run();
    }
  }, []);
  const editingEquationRef = useRef(editingEquation);
  editingEquationRef.current = editingEquation;

  const handleInsertTOC = useCallback((opts: { style?: TocStyle; levels?: number[] } = {}) => {
    editorRef.current
      ?.chain()
      .focus()
      .insertContent({ type: 'tableOfContents', attrs: { tocStyle: opts.style || 'default', levels: opts.levels || [1, 2, 3] } })
      .run();
  }, []);

  const handleInsertFootnote = useCallback((noteData: { type: 'footnote' | 'endnote'; content: string }) => {
    editorRef.current
      ?.chain()
      .focus()
      .insertContent({ type: 'footnote', attrs: { id: generateId(), noteType: noteData.type, content: noteData.content } })
      .run();
  }, []);

  const handleUpdateFootnote = useCallback((pos: number, content: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.chain()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(pos);
        if (node?.type.name !== 'footnote') return false;
        if (content.trim()) tr.setNodeMarkup(pos, undefined, { ...node.attrs, content });
        else tr.delete(pos, pos + node.nodeSize);
        return true;
      })
      .run();
  }, []);

  // Keep citations available to the editor's citation / bibliography nodes
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setReferenceData({ citations: currentDoc?.citations || [] });
  }, [editor, currentDoc?.citations]);

  const handleAddCitation = useCallback((citation: Citation) => updateCurrentDoc(d => ({ citations: [...(d.citations || []), citation] })), [updateCurrentDoc]);
  const handleUpdateCitation = useCallback(
    (citation: Citation) => updateCurrentDoc(d => ({ citations: (d.citations || []).map(c => (c.id === citation.id ? citation : c)) })),
    [updateCurrentDoc],
  );
  const handleDeleteCitation = useCallback((id: string) => updateCurrentDoc(d => ({ citations: (d.citations || []).filter(c => c.id !== id) })), [updateCurrentDoc]);

  const handleInsertCitation = useCallback((citationId: string, style: CitationStyle) => {
    editorRef.current?.chain().focus().insertContent({ type: 'citation', attrs: { citationId, citationStyle: style } }).run();
  }, []);

  const handleInsertBibliography = useCallback((style: CitationStyle) => {
    const ed = editorRef.current;
    if (!ed) return;
    if (!(currentDocRef.current?.citations || []).length) {
      toastRef.current.warning(t(uiLangRef.current, 'addSourceFirst'));
      return;
    }
    ed.chain().focus().insertContent({ type: 'bibliography', attrs: { citationStyle: style } }).run();
  }, []);

  const handleInsertCodeBlock = useCallback((code: string, language: string, theme: string, lineNumbers = true) => {
    editorRef.current
      ?.chain()
      .focus()
      .insertContent({
        type: 'codeBlock',
        attrs: { language: language || 'plaintext', theme: /light|default|solarized|coy|github/i.test(theme) ? 'light' : 'dark', lineNumbers },
        content: code ? [{ type: 'text', text: code }] : [],
      })
      .run();
  }, []);

  const handleInsertDiagram = useCallback((dataUrl: string, alt = 'Diagram') => {
    editorRef.current?.chain().focus().setImage({ src: dataUrl, alt }).run();
    setShowDiagramEditor(false);
  }, []);

  const handleInsertPageBreak = useCallback(() => {
    editorRef.current?.chain().focus().setPageBreak().run();
  }, []);

  /** Save header/footer/numbering settings of a later section (its section-break node). */
  const handleSectionSettingsSave = useCallback((pos: number, settings: SectionSettings) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.chain()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(pos);
        if (node?.type.name !== 'sectionBreak') return false;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, settings });
        return true;
      })
      .run();
  }, []);

  return {
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
  };
};
