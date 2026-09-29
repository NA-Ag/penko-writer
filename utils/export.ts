/**
 * Document export entry points (used by the Sidebar export menu).
 *
 * Every exporter works from the document DATA (`doc.content` etc.), never from
 * the editor DOM, so they also work in markdown mode, for documents that are
 * not open, and in tests. They throw on failure; the caller shows a toast.
 * The `export*` entry points first load KaTeX / Prism (lazy editor assets) so
 * equations are rendered; the DOCX and PDF writers are loaded on demand.
 */
import type { DocumentData } from '../types';
import JSZip from 'jszip';
import editorCss from '../editor/editor.css?raw';
import { escapeHtml } from '../editor/sanitize';
import { ensureRenderAssets } from '../editor/lazyAssets';
import { fillPlaceholders, zoneHtml } from '../editor/pageChrome';
import { htmlToMarkdown } from './markdownConverter';
import { generateStyleCss } from './paragraphStyles';
import { blocksToText, buildExportModel, htmlToPlainText, normalizeDocumentHtml, pageGeometry } from './exportModel';
import { latexToUnicode } from './latexLite';
import { PAGE_MARGINS } from '../constants';
import { noteLabel } from '../editor/extensions/references';

export interface ExportLabels {
  endnotes?: string;
  /** "Page {PAGE} of {PAGES}" in the UI language. */
  pageOf?: string;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export const safeFileName = (title: string | undefined, fallback = 'Document') =>
  (title || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || fallback;

/** Triggers a download; the object URL is revoked after the browser has picked it up. */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const pageCss = (doc: DocumentData) => {
  const geo = pageGeometry(doc.pageConfig);
  const margin = PAGE_MARGINS[doc.pageConfig?.margins || 'normal'] || '2.54cm';
  return { geo, margin, size: `${doc.pageConfig?.size === 'Letter' ? 'letter' : 'A4'} ${geo.landscape ? 'landscape' : 'portrait'}` };
};

const BASE_CONTENT_CSS = `
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: #f1f5f9; color: #111827; }
.penko-page { background: #fff; margin: 24px auto; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
.penko-doc { font-family: "Calibri", "Arial", sans-serif; font-size: 11pt; line-height: 1.15; color: #111827; }
.penko-doc p { margin: 0; }
.penko-doc img { cursor: default; }
.penko-doc pre { background: #1f2937; color: #f9fafb; padding: 12px 14px; border-radius: 6px; overflow-x: auto; font-family: 'Source Code Pro', 'Courier New', monospace; font-size: 0.9em; line-height: 1.45; white-space: pre-wrap; }
.penko-doc pre[data-theme="light"] { background: #f3f4f6; color: #111827; }
.penko-doc div[data-type='page-break'] { border: none; margin: 0; height: 0; break-after: page; }
.penko-doc div[data-type='page-break']::after { content: none; }
.penko-hf { font-family: "Calibri", "Arial", sans-serif; font-size: 10pt; color: #4b5563; }
.penko-hf p { margin: 0; }
/* "text + centred page number" on one line */
.penko-hf p:has(+ .penko-page-number) { display: inline; }
.penko-header { margin-bottom: 18px; }
.penko-footer { margin-top: 18px; }
/* Each paragraph takes its direction from its own text (Arabic, Hebrew…). */
.penko-doc :is(p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote) { unicode-bidi: plaintext; }
.penko-notes { font-size: 9pt; margin-top: 24px; border-top: 1px solid #d1d5db; padding-top: 8px; }
.penko-notes ol { list-style: none; padding: 0; margin: 0; }
.penko-notes h4 { font-size: 10pt; margin: 12px 0 4px; }
/* Equations: KaTeX also emits MathML, which browsers render natively, so the
   file needs no external CSS or math fonts (works offline). */
.katex-html { display: none; }
.katex-display, .katex-equation[data-display="true"] { display: block; text-align: center; margin: 0.5em 0; }
math { font-size: 1.1em; }
@media print {
  body { background: #fff; }
  .penko-page { margin: 0; box-shadow: none; padding: 0 !important; width: auto !important; min-height: 0 !important; }
}
`;

/** Parses HTML into an inert document (no image loads, no handlers). */
const parseInert = (html: string) => new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, 'text/html').body;

/**
 * Header / footer band, laid out like page 1 of the paginated view (same
 * placeholders, number format and "text + centred number" rule). A web page
 * has no "first page", so "different first page" doesn't hide it here.
 */
const headerFooterHtml = (doc: DocumentData, where: 'header' | 'footer', labels: ExportLabels) => {
  const zone = zoneHtml({ ...doc, differentFirstPage: false }, where, 1, 1, { pageOfLabel: labels.pageOf });
  return zone ? `<div class="penko-hf penko-${where}">${zone}</div>` : '';
};

const notesHtml = (content: Element, labels: ExportLabels) => {
  const notes = Array.from(content.querySelectorAll('sup[data-type="footnote"]')).map(el => ({
    type: el.getAttribute('data-note-type') === 'endnote' ? 'endnote' : 'footnote',
    number: parseInt(el.getAttribute('data-number') || '1', 10) || 1,
    content: el.getAttribute('data-content') || '',
  }));
  if (!notes.length) return '';
  const list = (type: string) =>
    notes
      .filter(n => n.type === type)
      .map(n => `<li><sup>${noteLabel(type, n.number)}</sup> ${escapeHtml(n.content)}</li>`)
      .join('');
  const fn = list('footnote');
  const en = list('endnote');
  return `<div class="penko-notes">${fn ? `<ol>${fn}</ol>` : ''}${en ? `<h4>${escapeHtml(labels.endnotes || 'Endnotes')}</h4><ol>${en}</ol>` : ''}</div>`;
};

/**
 * A standalone, sanitized HTML file with the editor's content CSS inlined.
 * Also used for the browser print-to-PDF fallback.
 */
export const buildStandaloneHtml = (doc: DocumentData, labels: ExportLabels = {}): string => {
  const content = normalizeDocumentHtml(doc);
  const { geo, margin, size } = pageCss(doc);
  const cls = `penko-doc${doc.isScreenplay ? ' screenplay-mode' : ''}`;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(doc.language || 'en')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="Penko Writer">
${doc.styles?.length ? `<meta name="penko-styles" content="${escapeHtml(JSON.stringify(doc.styles))}">\n` : ''}<title>${escapeHtml(doc.title || 'Document')}</title>
<style>
@page { size: ${size}; margin: ${margin}; }
${editorCss}
${BASE_CONTENT_CSS}
${doc.isScreenplay ? '' : generateStyleCss(doc.styles)}
.penko-page { width: ${geo.widthPt}pt; max-width: 100%; min-height: ${geo.heightPt}pt; padding: ${margin}; }
</style>
</head>
<body>
<div class="penko-page">
${headerFooterHtml(doc, 'header', labels)}
<div class="${cls}"><div class="ProseMirror">${content}</div></div>
${notesHtml(parseInert(content), labels)}
${headerFooterHtml(doc, 'footer', labels)}
</div>
</body>
</html>`;
};

/* ------------------------------------------------------------------ */
/* .doc (Word 97-2003 compatible single-file web page / MHTML)         */
/* ------------------------------------------------------------------ */

/**
 * Builds a Word-compatible `.doc`: a Word HTML document (Office namespaces,
 * print view, @page setup) that Word, LibreOffice and Pages open as a normal
 * document. Images stay embedded as data URIs (LibreOffice shows them; some
 * Word versions don't), header/footer are not included — DOCX is the
 * full-fidelity format.
 */
export const buildWordHtmlDoc = (doc: DocumentData): string => {
  const content = normalizeDocumentHtml(doc);
  const { geo, margin } = pageCss(doc);
  const container = parseInert(content);
  // equations: KaTeX markup doesn't survive Word, use the readable Unicode form (E = mc²)
  container.querySelectorAll('span[data-type="equation"]').forEach(el => {
    const i = container.ownerDocument.createElement('i');
    i.textContent = latexToUnicode(el.getAttribute('data-latex') || '');
    el.replaceWith(i);
  });
  container.querySelectorAll('[data-type="page-break"]').forEach(el => {
    const br = container.ownerDocument.createElement('br');
    br.setAttribute('clear', 'all');
    br.setAttribute('style', 'page-break-before:always');
    el.replaceWith(br);
  });
  const notes = notesHtml(container, {});
  const widthIn = (geo.landscape ? geo.heightPt : geo.widthPt) / 72;
  const heightIn = (geo.landscape ? geo.widthPt : geo.heightPt) / 72;
  const html = `<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Penko Writer">
<title>${escapeHtml(doc.title || 'Document')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
@page WordSection1 { size: ${geo.landscape ? heightIn : widthIn}in ${geo.landscape ? widthIn : heightIn}in; margin: ${margin}; mso-page-orientation: ${geo.landscape ? 'landscape' : 'portrait'}; }
div.WordSection1 { page: WordSection1; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 115%; }
p { margin: 0; }
h1 { font-size: 22pt; } h2 { font-size: 16.5pt; } h3 { font-size: 13.75pt; } h4 { font-size: 12pt; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #cccccc; padding: 4px; vertical-align: top; }
th { background: #f7f7f7; }
blockquote { border-left: 3pt solid #d1d5db; margin-left: 0; padding-left: 10pt; color: #4b5563; font-style: italic; }
pre { font-family: "Courier New", monospace; font-size: 10pt; background: #f3f4f6; padding: 6pt; }
.penko-notes { font-size: 9pt; border-top: 1px solid #cccccc; margin-top: 18pt; }
</style>
</head>
<body lang="${escapeHtml(doc.language || 'en-US')}">
<div class="WordSection1">
${container.innerHTML}
${notes}
</div>
</body>
</html>`;
  return html;
};

/* ------------------------------------------------------------------ */
/* Exporters                                                           */
/* ------------------------------------------------------------------ */

export const exportToDoc = async (doc: DocumentData) => {
  await ensureRenderAssets();
  const html = buildWordHtmlDoc(doc);
  downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword' }), `${safeFileName(doc.title)}.doc`);
};

export const exportToDocx = async (doc: DocumentData, labels: ExportLabels = {}) => {
  const [{ buildDocxBlob }] = await Promise.all([import('./docxExport'), ensureRenderAssets()]);
  const blob = await buildDocxBlob(doc, labels);
  downloadBlob(blob, `${safeFileName(doc.title)}.docx`);
};

/** Opens the browser print dialog for a print-styled rendering of the document. */
export const printDocumentHtml = async (doc: DocumentData, labels: ExportLabels = {}): Promise<void> => {
  await ensureRenderAssets();
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const idoc = iframe.contentDocument;
    if (!win || !idoc) {
      iframe.remove();
      reject(new Error('print unavailable'));
      return;
    }
    idoc.open();
    idoc.write(buildStandaloneHtml(doc, labels));
    idoc.close();
    const images = Array.from(idoc.images);
    const ready = Promise.all([
      ...images.map(img => (img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = () => r(null); }))),
      (idoc as any).fonts?.ready ?? Promise.resolve(),
    ]);
    const timeout = new Promise(r => setTimeout(r, 3000));
    Promise.race([ready, timeout]).then(() => {
      try {
        win.focus();
        win.print();
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        setTimeout(() => iframe.remove(), 1000);
      }
    });
  });
};

export type PdfExportResult = { method: 'pdf'; droppedSymbols: string[] } | { method: 'print'; chars: string[] };

/**
 * PDF export. Produces a real text PDF with jsPDF; when the document uses a
 * script the built-in PDF fonts can't render (CJK, Cyrillic, Arabic, emoji…)
 * it opens the browser's print dialog instead (Save as PDF), which renders
 * every script correctly with system fonts.
 */
export const exportToPdf = async (doc: DocumentData, labels: ExportLabels = {}): Promise<PdfExportResult> => {
  const [{ buildPdf }] = await Promise.all([import('./pdfExport'), ensureRenderAssets()]);
  const result = await buildPdf(doc, labels);
  if (result.kind === 'unsupported-script') {
    // Prefer printing the live paginated view (identical to the screen); fall back to a print-styled rendering
    if (document.querySelector('.penko-page[data-paginated="true"]')) {
      const { printCurrentDocument } = await import('./print');
      await printCurrentDocument();
    } else {
      await printDocumentHtml(doc, labels);
    }
    return { method: 'print', chars: result.chars };
  }
  downloadBlob(result.pdf.output('blob'), `${safeFileName(doc.title, doc.isScreenplay ? 'Screenplay' : 'Document')}.pdf`);
  return { method: 'pdf', droppedSymbols: result.droppedSymbols };
};

export const buildPlainText = (doc: DocumentData, labels: ExportLabels = {}): string => {
  const model = buildExportModel(doc);
  let text = blocksToText(model.blocks).trim();
  // one continuous "page": placeholders read as page 1 of 1
  const header = fillPlaceholders(htmlToPlainText(model.header), 1, 1, model.pageNumberFormat);
  const footer = fillPlaceholders(htmlToPlainText(model.footer), 1, 1, model.pageNumberFormat);
  const fns = model.notes.filter(n => n.noteType === 'footnote');
  const ens = model.notes.filter(n => n.noteType === 'endnote');
  if (fns.length) text += `\n\n----------\n${fns.map(n => `[${n.label}] ${n.content}`).join('\n')}`;
  if (ens.length) text += `\n\n${labels.endnotes || 'Endnotes'}\n${ens.map(n => `[${n.label}] ${n.content}`).join('\n')}`;
  if (header) text = `${header}\n\n${text}`;
  if (footer) text += `\n\n${footer}`;
  return `${text}\n`;
};

export const exportToTxt = async (doc: DocumentData, labels: ExportLabels = {}) => {
  await ensureRenderAssets();
  downloadBlob(new Blob([buildPlainText(doc, labels)], { type: 'text/plain;charset=utf-8' }), `${safeFileName(doc.title)}.txt`);
};

export const exportToHtml = async (doc: DocumentData, labels: ExportLabels = {}) => {
  await ensureRenderAssets();
  downloadBlob(new Blob([buildStandaloneHtml(doc, labels)], { type: 'text/html;charset=utf-8' }), `${safeFileName(doc.title)}.html`);
};

/** Markdown: the exact source for markdown-mode documents, otherwise converted. */
export const buildMarkdown = (doc: DocumentData): string =>
  doc.isMarkdownMode && doc.markdownSource != null ? doc.markdownSource : htmlToMarkdown(normalizeDocumentHtml(doc));

export const exportToMarkdown = async (doc: DocumentData) => {
  await ensureRenderAssets();
  downloadBlob(new Blob([buildMarkdown(doc)], { type: 'text/markdown;charset=utf-8' }), `${safeFileName(doc.title)}.md`);
};

export const ARCHIVE_FOLDER = 'penko-writer-documents';

/** Builds the backup ZIP (one JSON file per document + metadata.json). */
export const buildArchive = async (documents: DocumentData[]): Promise<Blob> => {
  const zip = new JSZip();
  const folder = zip.folder(ARCHIVE_FOLDER)!;
  const used = new Set<string>();
  documents.forEach((doc, index) => {
    let name = `${index + 1}_${(doc.title || 'untitled').replace(/[^a-z0-9]+/gi, '_').toLowerCase().slice(0, 60)}.json`;
    while (used.has(name)) name = name.replace(/\.json$/, '_.json');
    used.add(name);
    // everything the app persists (content, pageConfig, header/footer, comments,
    // citations, isScreenplay, isMarkdownMode, markdownSource, ...)
    folder.file(name, JSON.stringify(doc, null, 2));
  });
  folder.file(
    'metadata.json',
    JSON.stringify({ exportDate: new Date().toISOString(), version: '2.0.0', documentCount: documents.length, appName: 'Penko Writer' }, null, 2),
  );
  return zip.generateAsync({ type: 'blob' });
};

/** Export all documents as a ZIP archive. Returns false when there's nothing to export. */
export const exportAllDocuments = async (documents: DocumentData[]): Promise<boolean> => {
  if (!documents.length) return false;
  const blob = await buildArchive(documents);
  downloadBlob(blob, `penko-writer-backup-${new Date().toISOString().split('T')[0]}.zip`);
  return true;
};
