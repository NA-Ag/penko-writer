import { useCallback, useRef } from 'react';
import { useApp } from '../AppContext';
import { t } from './translations';

export type ExportFormat = 'doc' | 'docx' | 'pdf' | 'html' | 'txt' | 'md';

/**
 * Export the current document. Pending edits are flushed and the live editor
 * HTML is used, so the file matches what's on screen. The export code (jsPDF,
 * docx…) is code-split and loaded on first use. Shared by the desktop sidebar
 * and the mobile documents drawer.
 */
export const useExportDocument = () => {
  const { currentDoc, editor, flushPendingEdits, toast, uiLanguage } = useApp();
  const latestDoc = useRef(currentDoc);
  latestDoc.current = currentDoc;
  const busy = useRef(false);

  return useCallback(
    async (format: ExportFormat) => {
      if (busy.current || !latestDoc.current) return;
      busy.current = true;
      try {
        flushPendingEdits();
        // let the flushed edit re-render so `latestDoc` holds it
        await new Promise(r => setTimeout(r, 0));
        let doc = latestDoc.current;
        if (!doc) return;
        if (editor && !editor.isDestroyed && !doc.isMarkdownMode) doc = { ...doc, content: editor.getHTML() };
        const labels = { endnotes: t(uiLanguage, 'endnotes'), pageOf: t(uiLanguage, 'pageXofY') };
        const exporter = await import('./export');
        switch (format) {
          case 'doc':
            await exporter.exportToDoc(doc);
            break;
          case 'docx':
            await exporter.exportToDocx(doc, labels);
            break;
          case 'html':
            await exporter.exportToHtml(doc, labels);
            break;
          case 'txt':
            await exporter.exportToTxt(doc, labels);
            break;
          case 'md':
            await exporter.exportToMarkdown(doc);
            break;
          case 'pdf': {
            const result = await exporter.exportToPdf(doc, labels);
            if (result.method === 'print') toast.info(t(uiLanguage, 'pdfPrintFallback'), 8000);
            else if (result.droppedSymbols.length) toast.warning(t(uiLanguage, 'pdfSymbolsDropped').replace('{chars}', result.droppedSymbols.slice(0, 12).join(' ')), 8000);
            break;
          }
        }
      } catch (error) {
        console.error(`[Export] ${format} export failed:`, error);
        toast.error(t(uiLanguage, 'exportFailed'));
      } finally {
        busy.current = false;
      }
    },
    [editor, flushPendingEdits, toast, uiLanguage],
  );
};
