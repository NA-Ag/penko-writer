// Document import utilities for various file formats.
// Every importer returns HTML that has been through `prepareHtmlForEditor`.
import mammoth from 'mammoth';
import JSZip from 'jszip';
import type { DocumentData, ParagraphStyle } from '../types';
import { normalizeStyle } from './paragraphStyles';
import { escapeHtml, prepareHtmlForEditor } from '../editor/sanitize';
import { markdownToHtml } from './markdownConverter';
import { parseRtf } from './rtfParser';
import { parseOdtContent } from './odtParser';
import { CfbReader, extractWordText, wordTextToHtml, WordBinaryError } from './wordBinary';
import { bytesToBase64 } from './base64';
import { DOCX_STYLE_MAP, finishDocxHtml, markDocxSections, readDocxLayout, readDocxStyles } from './docxImport';
import { markDocxMath, restoreDocxMath } from './docxMath';
import { t, type LanguageCode } from './translations';
import { parsePenko, PenkoFormatError, type ParsedPenko } from './files/penkoFormat';

export interface ImportResult {
  success: boolean;
  title: string;
  content: string;
  error?: string;
  /** shown as an info toast after a successful import (e.g. "formatting was lost") */
  warning?: string;
  /** extra document fields (e.g. markdown source) */
  extra?: Partial<DocumentData>;
  /** A native .penko file: the complete document, including its id. */
  penko?: ParsedPenko;
}

const titleOf = (file: File) => file.name.replace(/\.[^.]+$/, '') || file.name;

/**
 * Numbers footnotes / endnotes in document order. The editor renumbers on the
 * first edit only, so without this every imported note would show "1".
 */
export const numberNotes = (html: string): string => {
  if (!html.includes('data-type="footnote"')) return html;
  const body = new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, 'text/html').body;
  const counters = { footnote: 0, endnote: 0 };
  body.querySelectorAll('sup[data-type="footnote"]').forEach(sup => {
    const kind = sup.getAttribute('data-note-type') === 'endnote' ? 'endnote' : 'footnote';
    sup.setAttribute('data-number', String(++counters[kind]));
  });
  return body.innerHTML;
};

const ok = (file: File, html: string, more: Partial<ImportResult> = {}): ImportResult => ({
  success: true,
  title: titleOf(file),
  content: numberNotes(prepareHtmlForEditor(html)) || '<p></p>',
  ...more,
});

const fail = (file: File, error: string): ImportResult => ({ success: false, title: file.name, content: '', error });

const errMsg = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };

/**
 * Import a .docx file via mammoth (body, images inlined as base64) plus what
 * mammoth ignores: alignment, page setup, header / footer and page numbers,
 * footnotes as real notes, page breaks and screenplay styles (docxImport.ts).
 */
export async function importDocx(file: File, lang: LanguageCode = 'en-US'): Promise<ImportResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer).catch(() => null);
    const [layout, named] = zip ? await Promise.all([readDocxLayout(zip), readDocxStyles(zip)]) : [{ aligns: null, extra: {}, sections: [] }, { styleMap: [], styles: [] }];
    // section breaks are marked in the XML last (it rewrites document.xml)
    const marked = zip ? await markDocxSections(zip, await markDocxMath(zip, arrayBuffer)) : arrayBuffer;
    const result = await mammoth.convertToHtml(
      { arrayBuffer: marked },
      {
        // custom Word styles first: mammoth uses the first matching rule
        styleMap: [...named.styleMap, ...DOCX_STYLE_MAP],
        convertImage: mammoth.images.imgElement(async image => {
          const base64 = await image.read('base64');
          return { src: `data:${image.contentType || 'image/png'};base64,${base64}` };
        }),
      },
    );
    const { html, screenplay } = finishDocxHtml(restoreDocxMath(result.value), layout.aligns, layout.sections);
    const extra: Partial<DocumentData> = { ...layout.extra, ...(screenplay ? { isScreenplay: true } : named.styles.length ? { styles: named.styles } : {}) };
    return ok(file, html, Object.keys(extra).length ? { extra } : {});
  } catch (error) {
    console.error('[Import] Docx import error:', error);
    return fail(file, errMsg(error, t(lang, 'importDocxFailed')));
  }
}

/**
 * Import a legacy binary .doc (Word 97-2003 / Word 6-95). Text only: the
 * text is read from the WordDocument stream via the piece table.
 * Many ".doc" files are really RTF or HTML — those are imported with formatting.
 */
export async function importDoc(file: File, lang: LanguageCode = 'en-US'): Promise<ImportResult> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 512)).trimStart();
    if (head.startsWith('{\\rtf')) return importRtf(file, lang);
    if (/^(<!doctype html|<html|mime-version:)/i.test(head) || /<html[\s>]/i.test(head)) {
      const res = await importHtml(file, lang);
      return { ...res, title: titleOf(file) };
    }
    if (!CfbReader.isCfb(bytes)) return fail(file, t(lang, 'importDocUnreadable'));
    const raw = extractWordText(bytes);
    const html = wordTextToHtml(raw, escapeHtml);
    if (!html.replace(/<[^>]+>/g, '').trim()) return fail(file, t(lang, 'importDocUnreadable'));
    return ok(file, html, { warning: t(lang, 'importDocFormattingLost') });
  } catch (error) {
    console.error('[Import] Doc import error:', error);
    if (error instanceof WordBinaryError && error.code === 'encrypted') return fail(file, t(lang, 'importDocEncrypted'));
    return fail(file, t(lang, 'importDocUnreadable'));
  }
}

/** Plain text: blank lines separate paragraphs, single newlines become <br>. */
export const plainTextToHtml = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(p => `<p>${p.split('\n').map(escapeHtml).join('<br>')}</p>`)
    .join('');

export async function importTxt(file: File, lang: LanguageCode = 'en-US'): Promise<ImportResult> {
  try {
    return ok(file, plainTextToHtml(await file.text()));
  } catch (error) {
    return fail(file, errMsg(error, t(lang, 'importFailed')));
  }
}

/** Page breaks written by Word / our .doc export as `<br style="page-break-before:always">`. */
const convertHtmlPageBreaks = (root: Element) =>
  root.querySelectorAll('br[style*="page-break-before"], br[style*="break-before"]').forEach(br => {
    const pb = root.ownerDocument.createElement('div');
    pb.setAttribute('data-type', 'page-break');
    br.replaceWith(pb);
  });

/**
 * HTML: body contents, sanitized (scripts, handlers, unsafe URLs removed).
 * Files exported by Penko Writer (HTML / .doc) give back just the document
 * content — the rendered header / footer band and note list are dropped
 * (the notes live on in the footnote markers).
 */
export async function importHtml(file: File, lang: LanguageCode = 'en-US'): Promise<ImportResult> {
  try {
    const html = await file.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = doc.querySelector('title')?.textContent?.trim();
    const fromPenko = Array.from(doc.querySelectorAll('meta')).some(m => m.getAttribute('name')?.toLowerCase() === 'generator' && m.getAttribute('content') === 'Penko Writer');
    const root = (fromPenko && doc.querySelector('.penko-doc > .ProseMirror, .WordSection1')) || doc.body;
    const extra: Partial<DocumentData> = {};
    if (fromPenko) {
      root.querySelectorAll('.penko-notes, .penko-hf').forEach(el => el.remove());
      if (doc.querySelector('.penko-doc.screenplay-mode') || root.querySelector('[data-screenplay-type]')) extra.isScreenplay = true;
      const docLang = doc.documentElement.getAttribute('lang') || doc.body.getAttribute('lang');
      if (docLang && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(docLang)) extra.language = docLang;
      // named paragraph styles written by our HTML export
      try {
        const raw = JSON.parse(doc.querySelector('meta[name="penko-styles"]')?.getAttribute('content') || 'null');
        const styles = Array.isArray(raw) ? raw.map(normalizeStyle).filter((s): s is ParagraphStyle => !!s) : [];
        if (styles.length) extra.styles = styles;
      } catch {
        /* not ours / malformed */
      }
    }
    if (root) convertHtmlPageBreaks(root);
    return { ...ok(file, root ? root.innerHTML : html, Object.keys(extra).length ? { extra } : {}), title: title || titleOf(file) };
  } catch (error) {
    return fail(file, errMsg(error, t(lang, 'importFailed')));
  }
}

/** OpenDocument Text via a real XML walk (see odtParser.ts). */
export async function importOdt(file: File, lang: LanguageCode = 'en-US'): Promise<ImportResult> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const contentXml = await zip.file('content.xml')?.async('text');
    if (!contentXml) throw new Error(t(lang, 'importOdtInvalid'));
    const stylesXml = await zip.file('styles.xml')?.async('text');
    const images: Record<string, string> = {};
    const pictures = Object.keys(zip.files).filter(name => /^Pictures\//.test(name) && !zip.files[name].dir);
    for (const name of pictures) {
      const ext = (name.split('.').pop() || '').toLowerCase();
      const mime = MIME_BY_EXT[ext];
      if (!mime) continue;
      const data = await zip.file(name)!.async('uint8array');
      images[name] = `data:${mime};base64,${bytesToBase64(data)}`;
    }
    return ok(file, parseOdtContent(contentXml, { stylesXml, images }));
  } catch (error) {
    console.error('[Import] ODT import error:', error);
    return fail(file, t(lang, 'importOdtInvalid'));
  }
}

/** RTF via a real tokenizer (see rtfParser.ts). */
export async function importRtf(file: File, lang: LanguageCode = 'en-US'): Promise<ImportResult> {
  try {
    // RTF is 7-bit; decode as latin1 so stray 8-bit bytes don't become U+FFFD
    const text = new TextDecoder('latin1').decode(await file.arrayBuffer());
    if (!text.trimStart().startsWith('{\\rtf')) throw new Error(t(lang, 'importRtfInvalid'));
    return ok(file, parseRtf(text).html);
  } catch (error) {
    console.error('[Import] RTF import error:', error);
    return fail(file, errMsg(error, t(lang, 'importRtfInvalid')));
  }
}

/** Markdown (GFM) via marked. */
export async function importMarkdown(file: File, lang: LanguageCode = 'en-US'): Promise<ImportResult> {
  try {
    return ok(file, markdownToHtml(await file.text()));
  } catch (error) {
    return fail(file, errMsg(error, t(lang, 'importFailed')));
  }
}

const PENKO_ERRORS: Record<string, string> = {
  notPenko: 'penkoErrorNotPenko',
  wordFile: 'penkoErrorWordFile',
  damaged: 'penkoErrorDamaged',
  tooNew: 'penkoErrorTooNew',
  tooLarge: 'penkoErrorTooLarge',
};

/** Native .penko file: the whole document with every setting (see files/penkoFormat.ts). */
export async function importPenko(file: File, lang: LanguageCode = 'en-US'): Promise<ImportResult> {
  try {
    const penko = await parsePenko(await file.arrayBuffer());
    return {
      success: true,
      title: penko.doc.title || titleOf(file),
      content: penko.doc.content,
      penko,
      ...(penko.newerVersion ? { warning: t(lang, 'penkoNewerVersion') } : {}),
    };
  } catch (error) {
    console.error('[Import] .penko import error:', error);
    const key = error instanceof PenkoFormatError ? PENKO_ERRORS[error.code] : 'penkoErrorDamaged';
    return fail(file, t(lang, key || 'penkoErrorDamaged'));
  }
}

/** Main import function - detects file type and routes to the right importer. */
export async function importDocument(file: File, lang: LanguageCode = 'en-US'): Promise<ImportResult> {
  const extension = (file.name.toLowerCase().split('.').pop() || '').trim();
  switch (extension) {
    case 'penko':
      return importPenko(file, lang);
    case 'docx':
      return importDocx(file, lang);
    case 'doc':
      return importDoc(file, lang);
    case 'txt':
      return importTxt(file, lang);
    case 'html':
    case 'htm':
      return importHtml(file, lang);
    case 'odt':
      return importOdt(file, lang);
    case 'rtf':
      return importRtf(file, lang);
    case 'md':
    case 'markdown':
      return importMarkdown(file, lang);
    default:
      return fail(file, t(lang, 'importUnsupportedFormat').replace('{ext}', extension ? `.${extension}` : file.name));
  }
}

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

/** Validate file size (max 50MB) */
export function validateFileSize(file: File, lang: LanguageCode = 'en-US'): { valid: boolean; error?: string } {
  if (file.size > MAX_IMPORT_BYTES) {
    return { valid: false, error: t(lang, 'importFileTooLarge').replace('{size}', (file.size / 1024 / 1024).toFixed(2)) };
  }
  return { valid: true };
}

export function getSupportedExtensions(): string[] {
  return ['penko', 'docx', 'doc', 'txt', 'html', 'htm', 'odt', 'rtf', 'md'];
}

export function getFileAcceptString(): string {
  return '.penko,.docx,.doc,.txt,.html,.htm,.odt,.rtf,.md,.markdown';
}

/* ------------------------------------------------------------------ */
/* Archive (backup ZIP) restore                                        */
/* ------------------------------------------------------------------ */

const ARCHIVE_FIELDS: (keyof DocumentData)[] = [
  'title', 'content', 'createdAt', 'lastModified', 'pageConfig', 'language', 'header', 'footer', 'showPageNumbers',
  'pageNumberPosition', 'differentFirstPage', 'pageNumberFormat', 'comments', 'trackingEnabled', 'currentUser', 'citations', 'isScreenplay', 'isMarkdownMode', 'markdownSource',
];

/**
 * Reads documents from a backup ZIP made by "Export All as ZIP".
 * Returns partial documents (no ids — the caller creates fresh documents).
 */
export async function importArchive(file: File, lang: LanguageCode = 'en-US'): Promise<{
  success: boolean;
  documents: Partial<DocumentData>[];
  error?: string;
  skipped: number;
}> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const jsonFiles = Object.keys(zip.files).filter(name => {
      const base = name.split('/').pop() || '';
      return !zip.files[name].dir && base.endsWith('.json') && base !== 'metadata.json' && !name.startsWith('__MACOSX') && !base.startsWith('._');
    });
    if (!jsonFiles.length) return { success: false, documents: [], error: t(lang, 'archiveNoDocuments'), skipped: 0 };

    const documents: Partial<DocumentData>[] = [];
    let skipped = 0;
    for (const name of jsonFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
      try {
        const data = JSON.parse((await zip.file(name)!.async('text')) || 'null');
        if (!data || typeof data !== 'object' || typeof data.content !== 'string') {
          skipped++;
          continue;
        }
        const doc: Partial<DocumentData> = {};
        for (const key of ARCHIVE_FIELDS) if (data[key] !== undefined) (doc as any)[key] = data[key];
        doc.title = typeof data.title === 'string' && data.title.trim() ? data.title : t(lang, 'untitledDocument');
        doc.content = prepareHtmlForEditor(data.content);
        if (!Array.isArray(doc.comments)) delete doc.comments;
        // Paragraph styles: validated like in .penko files
        if (Array.isArray(data.styles)) {
          doc.styles = data.styles
            .map((st: unknown) => (st && typeof st === 'object' && typeof (st as any).id === 'string' ? normalizeStyle(st as any) : null))
            .filter((st: ParagraphStyle | null): st is ParagraphStyle => !!st);
        }
        if (!Array.isArray(doc.citations)) delete doc.citations;
        documents.push(doc);
      } catch {
        skipped++;
      }
    }
    if (!documents.length) return { success: false, documents: [], error: t(lang, 'archiveNoDocuments'), skipped };
    return { success: true, documents, skipped };
  } catch (error) {
    console.error('[Import] Archive import error:', error);
    return { success: false, documents: [], error: t(lang, 'archiveInvalid'), skipped: 0 };
  }
}
