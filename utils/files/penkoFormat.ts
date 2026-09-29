/**
 * The native `.penko` file format.
 *
 * A `.penko` file is a ZIP package (like .docx / .odt):
 *
 *   mimetype        "application/vnd.penko.document" — first entry, stored
 *                   uncompressed, so the type can be sniffed from the bytes
 *   manifest.json   { format: "penko", version, minReaderVersion, generator, savedAt }
 *   document.json   every DocumentData field except `content`
 *   content.html    the document body (editor HTML); pictures are referenced
 *                   as `media/<name>` instead of inline base64
 *   media/*         the pictures, as binary files
 *
 * Why a ZIP rather than one JSON file: pictures are stored as real binary
 * files (base64 costs a third more), text is DEFLATE-compressed, and the
 * content stays readable with any unzip tool even if the JSON is damaged.
 *
 * Versioning: `version` is the format the file was written with; readers
 * run `MIGRATIONS` to bring older packages up to date. A newer writer sets
 * `minReaderVersion` to the oldest reader that can still open the file
 * (additive changes keep it at 1), so older app versions open newer files
 * best-effort and only refuse when the writer says they must.
 *
 * Everything read from a file is validated field by field; unknown fields are
 * dropped and the HTML goes through the editor's sanitizer.
 */
import JSZip from 'jszip';
import type { Citation, Comment, CommentReply, DocumentData, PageConfig, ParagraphStyle } from '../../types';
import { normalizeStyle } from '../paragraphStyles';
import { prepareHtmlForEditor, sanitizeHtml } from '../../editor/sanitize';
import { base64ToBytes, bytesToBase64 } from '../base64';

export { DOCUMENT_FILE_FIELDS } from './documentFields';

export const PENKO_EXTENSION = '.penko';
export const PENKO_MIME = 'application/vnd.penko.document';
/** Format version written by this build. */
export const PENKO_VERSION = 1;
export const PENKO_GENERATOR = 'Penko Writer';

/** Hard limits against damaged or hostile files (zip bombs). */
export const PENKO_LIMITS = {
  entries: 5000,
  /** Total uncompressed size of all entries. */
  totalBytes: 300 * 1024 * 1024,
};

export interface PenkoManifest {
  format: 'penko';
  version: number;
  minReaderVersion: number;
  generator: string;
  savedAt: number;
}

/** The raw package, before validation (what migrations operate on). */
export interface PenkoPackage {
  manifest: PenkoManifest;
  document: Record<string, unknown>;
  /** content.html with `media/…` references already resolved to data URLs. */
  content: string;
}

export type PenkoMigration = (pkg: PenkoPackage) => PenkoPackage;

/**
 * `MIGRATIONS[n]` upgrades a version-n package to version n+1. Add one
 * whenever PENKO_VERSION is bumped for a change that needs rewriting old data.
 */
export const MIGRATIONS: Record<number, PenkoMigration> = {};

export type PenkoErrorCode = 'notPenko' | 'wordFile' | 'damaged' | 'tooNew' | 'tooLarge';

export class PenkoFormatError extends Error {
  code: PenkoErrorCode;
  constructor(code: PenkoErrorCode, message = code) {
    super(message);
    this.name = 'PenkoFormatError';
    this.code = code;
  }
}

export interface ParsedPenko {
  /** Validated document, including its original `id`. */
  doc: DocumentData;
  manifest: PenkoManifest;
  /** Written by a newer version of the app (opened best-effort). */
  newerVersion: boolean;
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

/** Fields that describe this device rather than the document; never written to files. */
export const LOCAL_ONLY_FIELDS = new Set<string>(['currentUser', 'footnotes', 'trackChanges']);

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};
const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' };

const DATA_IMG_RE = /(<img\b[^>]*?\ssrc=")data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)"/gi;
const MEDIA_REF_RE = /(<img\b[^>]*?\ssrc=")media\/([A-Za-z0-9._-]+)"/gi;

/** Moves inline base64 pictures out of the HTML into `media/` files (identical pictures are stored once). */
export const extractMedia = (html: string): { html: string; media: Map<string, Uint8Array> } => {
  const media = new Map<string, Uint8Array>();
  const byData = new Map<string, string>();
  const out = html.replace(DATA_IMG_RE, (whole, prefix: string, mime: string, b64: string) => {
    const ext = EXT_BY_MIME[mime.toLowerCase()];
    if (!ext) return whole;
    const clean = b64.replace(/\s+/g, '');
    let name = byData.get(clean);
    if (!name) {
      let bytes: Uint8Array;
      try {
        bytes = base64ToBytes(clean);
      } catch {
        return whole;
      }
      name = `image${media.size + 1}.${ext}`;
      media.set(name, bytes);
      byData.set(clean, name);
    }
    return `${prefix}media/${name}"`;
  });
  return { html: out, media };
};

/** Inverse of `extractMedia`: `media/x` references become data URLs again (unknown ones lose their src). */
export const resolveMedia = (html: string, media: Map<string, Uint8Array>): string =>
  html.replace(MEDIA_REF_RE, (_whole, prefix: string, name: string) => {
    const bytes = media.get(name);
    const mime = MIME_BY_EXT[(name.split('.').pop() || '').toLowerCase()];
    if (!bytes || !mime) return `${prefix}"`;
    return `${prefix}data:${mime};base64,${bytesToBase64(bytes)}"`;
  });

/** Builds the `.penko` package for a document. */
export const serializePenko = async (doc: DocumentData, opts: { generatorVersion?: string; now?: number } = {}): Promise<Blob> => {
  const zip = new JSZip();
  zip.file('mimetype', PENKO_MIME, { compression: 'STORE' });
  const manifest: PenkoManifest = {
    format: 'penko',
    version: PENKO_VERSION,
    minReaderVersion: 1,
    generator: opts.generatorVersion ? `${PENKO_GENERATOR} ${opts.generatorVersion}` : PENKO_GENERATOR,
    savedAt: opts.now ?? Date.now(),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === 'content' || LOCAL_ONLY_FIELDS.has(key) || value === undefined) continue;
    fields[key] = value;
  }
  zip.file('document.json', JSON.stringify(fields, null, 2));

  const { html, media } = extractMedia(doc.content || '');
  zip.file('content.html', html);
  media.forEach((bytes, name) => zip.file(`media/${name}`, bytes, { compression: 'STORE' }));

  return zip.generateAsync({ type: 'blob', mimeType: PENKO_MIME, compression: 'DEFLATE', compressionOptions: { level: 6 } });
};

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 10_000): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const oneOf = <T extends string>(v: unknown, values: readonly T[]): T | undefined => (values.includes(v as T) ? (v as T) : undefined);

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,20})$/i;
const LANG_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const readPageConfig = (v: unknown): PageConfig | undefined => {
  if (!isRecord(v)) return undefined;
  const cfg: PageConfig = {
    size: oneOf(v.size, ['A4', 'Letter'] as const) || 'A4',
    orientation: oneOf(v.orientation, ['portrait', 'landscape'] as const) || 'portrait',
    margins: oneOf(v.margins, ['normal', 'narrow', 'wide', 'none'] as const) || 'normal',
  };
  const cols = num(v.cols);
  if (cols === 1 || cols === 2 || cols === 3) cfg.cols = cols;
  const bg = str(v.backgroundColor, 64);
  if (bg && COLOR_RE.test(bg.trim())) cfg.backgroundColor = bg.trim();
  return cfg;
};

const readReply = (v: unknown): CommentReply | null => {
  if (!isRecord(v)) return null;
  const id = str(v.id, 200);
  if (!id) return null;
  return { id, author: str(v.author, 200) || '', text: str(v.text, 100_000) || '', timestamp: num(v.timestamp) ?? 0 };
};

const readComment = (v: unknown): Comment | null => {
  if (!isRecord(v)) return null;
  const id = str(v.id, 200);
  if (!id) return null;
  return {
    id,
    rangeId: str(v.rangeId, 200) || id,
    author: str(v.author, 200) || '',
    text: str(v.text, 100_000) || '',
    timestamp: num(v.timestamp) ?? 0,
    resolved: bool(v.resolved) ?? false,
    replies: Array.isArray(v.replies) ? v.replies.map(readReply).filter((r): r is CommentReply => !!r) : [],
  };
};

const CITATION_TYPES = ['book', 'journal', 'website', 'article'] as const;
const readCitation = (v: unknown): Citation | null => {
  if (!isRecord(v)) return null;
  const id = str(v.id, 200);
  if (!id) return null;
  const c: Citation = {
    id,
    type: oneOf(v.type, CITATION_TYPES) || 'book',
    author: str(v.author, 1000) || '',
    title: str(v.title, 2000) || '',
    year: str(v.year, 50) || '',
  };
  for (const key of ['publisher', 'journal', 'volume', 'pages', 'url', 'accessDate'] as const) {
    const s = str(v[key], 2000);
    if (s) c[key] = s;
  }
  return c;
};

/**
 * Turns untrusted document fields (from a file) into a safe DocumentData.
 * Unknown fields are dropped; HTML is sanitized.
 */
export const sanitizeDocumentFields = (raw: Record<string, unknown>, content: string): DocumentData => {
  const now = Date.now();
  const doc: DocumentData = {
    id: (str(raw.id, 200) || '').trim(),
    title: str(raw.title, 500) ?? '',
    content: prepareHtmlForEditor(content) || '<p></p>',
    createdAt: num(raw.createdAt) ?? now,
    lastModified: num(raw.lastModified) ?? now,
  };
  const pageConfig = readPageConfig(raw.pageConfig);
  if (pageConfig) doc.pageConfig = pageConfig;
  const language = str(raw.language, 40);
  if (language && LANG_RE.test(language)) doc.language = language;
  for (const key of ['header', 'footer'] as const) {
    const h = str(raw[key], 5_000_000);
    if (h !== undefined) doc[key] = sanitizeHtml(h);
  }
  for (const key of ['showPageNumbers', 'differentFirstPage', 'trackingEnabled', 'isScreenplay', 'isMarkdownMode'] as const) {
    const b = bool(raw[key]);
    if (b !== undefined) doc[key] = b;
  }
  const format = oneOf(raw.pageNumberFormat, ['decimal', 'roman', 'page-of'] as const);
  if (format) doc.pageNumberFormat = format;
  const position = oneOf(raw.pageNumberPosition, ['header-left', 'header-center', 'header-right', 'footer-left', 'footer-center', 'footer-right'] as const);
  if (position) doc.pageNumberPosition = position;
  if (Array.isArray(raw.comments)) doc.comments = raw.comments.map(readComment).filter((c): c is Comment => !!c);
  if (Array.isArray(raw.citations)) doc.citations = raw.citations.map(readCitation).filter((c): c is Citation => !!c);
  if (Array.isArray(raw.styles))
    doc.styles = raw.styles.map(s => (isRecord(s) && typeof s.id === 'string' ? normalizeStyle(s as Partial<ParagraphStyle> & { id: string }) : null)).filter((s): s is ParagraphStyle => !!s);
  const md = str(raw.markdownSource, 50_000_000);
  if (md !== undefined) doc.markdownSource = md;
  return doc;
};

/** Upgrades an older package step by step (`migrations[n]`: n → n+1). */
export const migratePackage = (pkg: PenkoPackage, migrations: Record<number, PenkoMigration> = MIGRATIONS, target = PENKO_VERSION): PenkoPackage => {
  let current = pkg;
  for (let v = current.manifest.version; v < target; v++) {
    const step = migrations[v];
    if (step) current = step(current);
    current = { ...current, manifest: { ...current.manifest, version: v + 1 } };
  }
  return current;
};

const readManifest = (raw: unknown): PenkoManifest => {
  if (!isRecord(raw) || raw.format !== 'penko') throw new PenkoFormatError('notPenko');
  const version = num(raw.version);
  if (!version || version < 1 || !Number.isInteger(version)) throw new PenkoFormatError('damaged');
  const minReader = num(raw.minReaderVersion);
  return {
    format: 'penko',
    version,
    minReaderVersion: minReader && Number.isInteger(minReader) && minReader >= 1 ? minReader : version,
    generator: str(raw.generator, 200) || '',
    savedAt: num(raw.savedAt) ?? 0,
  };
};

const uncompressedSize = (file: JSZip.JSZipObject): number => {
  const size = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  return typeof size === 'number' ? size : 0;
};

/** Reads a `.penko` package. Throws `PenkoFormatError` with a code the UI turns into a friendly message. */
export const parsePenko = async (
  data: ArrayBuffer | Uint8Array | Blob,
  opts: { migrations?: Record<number, PenkoMigration>; readerVersion?: number } = {},
): Promise<ParsedPenko> => {
  const readerVersion = opts.readerVersion ?? PENKO_VERSION;
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data instanceof Uint8Array ? data : new Uint8Array(data);
  // "PK" — every ZIP starts with it
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new PenkoFormatError('notPenko');

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new PenkoFormatError('damaged');
  }
  const entries = Object.values(zip.files).filter(f => !f.dir);
  if (entries.length > PENKO_LIMITS.entries) throw new PenkoFormatError('tooLarge');
  if (entries.reduce((sum, f) => sum + uncompressedSize(f), 0) > PENKO_LIMITS.totalBytes) throw new PenkoFormatError('tooLarge');

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    if (zip.file('word/document.xml')) throw new PenkoFormatError('wordFile');
    throw new PenkoFormatError('notPenko');
  }

  let manifest: PenkoManifest;
  let document: unknown;
  let content: string;
  const media = new Map<string, Uint8Array>();
  try {
    manifest = readManifest(JSON.parse(await manifestFile.async('text')));
  } catch (e) {
    if (e instanceof PenkoFormatError) throw e;
    throw new PenkoFormatError('damaged');
  }
  if (manifest.minReaderVersion > readerVersion) throw new PenkoFormatError('tooNew');
  try {
    document = JSON.parse((await zip.file('document.json')?.async('text')) ?? 'null');
    content = (await zip.file('content.html')?.async('text')) ?? '';
    for (const f of entries) {
      const m = /^media\/([A-Za-z0-9._-]+)$/.exec(f.name);
      if (m) media.set(m[1], await f.async('uint8array'));
    }
  } catch {
    throw new PenkoFormatError('damaged');
  }
  if (!isRecord(document)) throw new PenkoFormatError('damaged');

  const pkg = migratePackage({ manifest, document, content: resolveMedia(content, media) }, opts.migrations, readerVersion);
  const doc = sanitizeDocumentFields(pkg.document, pkg.content);
  return { doc, manifest, newerVersion: manifest.version > readerVersion };
};

export const isPenkoFileName = (name: string) => name.toLowerCase().endsWith(PENKO_EXTENSION);
