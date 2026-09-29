import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import type { DocumentData } from '../../types';
import { normalizeStyle } from '../../utils/paragraphStyles';
import {
  DOCUMENT_FILE_FIELDS,
  PENKO_MIME,
  PENKO_VERSION,
  PenkoFormatError,
  extractMedia,
  migratePackage,
  parsePenko,
  resolveMedia,
  serializePenko,
  type PenkoPackage,
} from '../../utils/files/penkoFormat';
import { formatOfName, isOpenableName, withExtension } from '../../utils/files/fileAccess';
import { addRecent, hasUnsavedFileChanges, type RecentFile } from '../../utils/files/fileLinks';

// 1x1 transparent PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const FULL: DocumentData = {
  id: 'doc-123',
  title: 'Everything — «ünïcode» ✓',
  content:
    `<h1>Heading</h1><p>Text <strong>bold</strong> <span class="comment-highlight" data-comment-id="c1">commented</span></p>` +
    `<p><img src="data:image/png;base64,${PNG}" alt="pixel"><img src="data:image/png;base64,${PNG}" alt="again"></p>` +
    `<p>Note<sup data-type="footnote" data-note-type="footnote" data-content="A note" data-number="1">1</sup></p>`,
  createdAt: 1_700_000_000_000,
  lastModified: 1_700_000_500_000,
  pageConfig: { size: 'Letter', orientation: 'landscape', margins: 'narrow', cols: 2, backgroundColor: '#fef3c7' },
  language: 'fr-FR',
  header: '<p>Header {PAGE}</p>',
  footer: '<p>Footer</p>',
  showPageNumbers: true,
  differentFirstPage: true,
  pageNumberFormat: 'roman',
  pageNumberPosition: 'header-right',
  comments: [
    { id: 'c1', rangeId: 'c1', author: 'Ann', text: 'Check this', timestamp: 5, resolved: false, replies: [{ id: 'r1', author: 'Bob', text: 'Done', timestamp: 6 }] },
  ],
  citations: [{ id: 'cit1', type: 'journal', author: 'Doe, J.', title: 'On Things', year: '2020', journal: 'J. Stuff', volume: '3', pages: '1-9', url: 'https://example.com' }],
  trackingEnabled: true,
  isScreenplay: false,
  isMarkdownMode: true,
  markdownSource: '# Heading\n\nText **bold**',
  styles: [
    normalizeStyle({ id: 'heading1', color: '#1d4ed8', fontSize: 30 })!,
    normalizeStyle({ id: 'callout', name: 'Callout', kind: 'paragraph', italic: true, indent: 18, fontFamily: 'Georgia' })!,
  ],
};

const roundTrip = async (doc: DocumentData) => (await parsePenko(await serializePenko(doc))).doc;

describe('.penko serialize / parse', () => {
  it('round-trips every document field', async () => {
    const back = await roundTrip(FULL);
    expect(back).toEqual(FULL);
    // every field the format claims to carry is covered by the fixture
    for (const f of DOCUMENT_FILE_FIELDS) expect(FULL).toHaveProperty(f);
  });

  it('is a zip with a stored mimetype first and pictures as binary media (deduplicated)', async () => {
    const blob = await serializePenko(FULL, { now: 42, generatorVersion: '1.2.3' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // "mimetype" is the first entry, uncompressed, so the type can be sniffed
    expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(bytes.subarray(38, 38 + PENKO_MIME.length))).toBe(PENKO_MIME);
    const zip = await JSZip.loadAsync(bytes);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('text'));
    expect(manifest).toEqual({ format: 'penko', version: PENKO_VERSION, minReaderVersion: 1, generator: 'Penko Writer 1.2.3', savedAt: 42 });
    const html = await zip.file('content.html')!.async('text');
    expect(html).not.toContain('base64');
    expect(html.match(/src="media\/image1\.png"/g)).toHaveLength(2);
    expect(Object.keys(zip.files).filter(n => n.startsWith('media/') && !zip.files[n].dir)).toEqual(['media/image1.png']);
    const json = JSON.parse(await zip.file('document.json')!.async('text'));
    expect(json.content).toBeUndefined();
    expect(json.title).toBe(FULL.title);
  });

  it('never writes device-local fields', async () => {
    const zip = await JSZip.loadAsync(await serializePenko({ ...FULL, currentUser: 'me', footnotes: [], trackChanges: [] }));
    const json = JSON.parse(await zip.file('document.json')!.async('text'));
    expect(json).not.toHaveProperty('currentUser');
    expect(json).not.toHaveProperty('footnotes');
  });

  it('keeps a minimal document minimal', async () => {
    const back = await roundTrip({ id: 'x', title: '', content: '<p></p>', createdAt: 1, lastModified: 2 });
    expect(back).toEqual({ id: 'x', title: '', content: '<p></p>', createdAt: 1, lastModified: 2 });
  });

  it('extractMedia / resolveMedia are inverses and leave other images alone', () => {
    const src = `<p><img src="https://x.test/a.png"><img alt="z" src="data:image/jpeg;base64,${PNG}"></p>`;
    const { html, media } = extractMedia(src);
    expect(html).toContain('src="https://x.test/a.png"');
    expect(html).toContain('src="media/image1.jpg"');
    expect(resolveMedia(html, media)).toBe(src);
    // a reference to a missing picture loses its src instead of pointing anywhere
    expect(resolveMedia('<img src="media/nope.png">', new Map())).toBe('<img src="">');
  });
});

describe('.penko validation', () => {
  const pack = async (files: Record<string, string>) => {
    const zip = new JSZip();
    for (const [name, data] of Object.entries(files)) zip.file(name, data);
    return zip.generateAsync({ type: 'uint8array' });
  };
  const manifest = (m: Record<string, unknown> = {}) => JSON.stringify({ format: 'penko', version: 1, minReaderVersion: 1, ...m });
  const codeOf = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      expect(e).toBeInstanceOf(PenkoFormatError);
      return (e as PenkoFormatError).code;
    }
    return 'no error';
  };

  it('sanitizes HTML and drops invalid or unknown fields', async () => {
    const data = await pack({
      'manifest.json': manifest(),
      'document.json': JSON.stringify({
        id: 'evil',
        title: 42,
        header: '<p onclick="x()">H</p><script>alert(1)</script>',
        pageConfig: { size: 'Huge', orientation: 'portrait', margins: 'wide', cols: 7, backgroundColor: 'url(javascript:x)' },
        language: 'en"><script>',
        comments: [{ id: 'c', text: 'ok' }, 'junk', { text: 'no id' }],
        citations: [{ id: 'k', type: 'podcast', title: 'T' }],
        pageNumberFormat: 'hex',
        trackingEnabled: 'yes',
        somethingNew: { a: 1 },
        styles: [{ id: 'x', fontFamily: 'A;}body{color:red', color: 'url(x)' }, { id: 'BAD ID' }, 7],
      }),
      'content.html': '<p>Safe</p><img src=x onerror="alert(1)"><a href="javascript:alert(1)">l</a><script>alert(1)</script>',
    });
    const { doc } = await parsePenko(data);
    expect(doc.content).not.toMatch(/onerror|javascript:|<script/);
    expect(doc.content).toContain('Safe');
    expect(doc.header).toBe('<p>H</p>');
    expect(doc.title).toBe('');
    expect(doc.pageConfig).toEqual({ size: 'A4', orientation: 'portrait', margins: 'wide' });
    expect(doc.language).toBeUndefined();
    expect(doc.comments).toEqual([{ id: 'c', rangeId: 'c', author: '', text: 'ok', timestamp: 0, resolved: false, replies: [] }]);
    expect(doc.citations).toEqual([{ id: 'k', type: 'book', author: '', title: 'T', year: '' }]);
    expect(doc.pageNumberFormat).toBeUndefined();
    expect(doc.trackingEnabled).toBeUndefined();
    expect(doc).not.toHaveProperty('somethingNew');
    expect(doc.styles).toHaveLength(1);
    expect(doc.styles![0].fontFamily).not.toMatch(/[;{}]/);
    expect(doc.styles![0].color).toBeNull();
  });

  it('rejects corrupt input with specific codes', async () => {
    expect(await codeOf(parsePenko(new TextEncoder().encode('hello, not a zip')))).toBe('notPenko');
    expect(await codeOf(parsePenko(new Uint8Array(0)))).toBe('notPenko');
    expect(await codeOf(parsePenko(new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5])))).toBe('damaged');
    expect(await codeOf(parsePenko(await pack({ 'word/document.xml': '<w:document/>' })))).toBe('wordFile');
    expect(await codeOf(parsePenko(await pack({ 'readme.txt': 'x' })))).toBe('notPenko');
    expect(await codeOf(parsePenko(await pack({ 'manifest.json': '{not json' })))).toBe('damaged');
    expect(await codeOf(parsePenko(await pack({ 'manifest.json': JSON.stringify({ format: 'other', version: 1 }) })))).toBe('notPenko');
    expect(await codeOf(parsePenko(await pack({ 'manifest.json': manifest({ version: 'one' }) })))).toBe('damaged');
    expect(await codeOf(parsePenko(await pack({ 'manifest.json': manifest(), 'content.html': '<p>x</p>' })))).toBe('damaged');
    expect(await codeOf(parsePenko(await pack({ 'manifest.json': manifest(), 'document.json': '[1,2]' })))).toBe('damaged');
    // truncated file
    const good = new Uint8Array(await (await serializePenko(FULL)).arrayBuffer());
    expect(await codeOf(parsePenko(good.subarray(0, Math.floor(good.length / 2))))).toBe('damaged');
  });

  it('refuses files that need a newer reader, opens newer compatible ones', async () => {
    expect(await codeOf(parsePenko(await pack({ 'manifest.json': manifest({ version: 5, minReaderVersion: 3 }), 'document.json': '{}' })))).toBe('tooNew');
    const res = await parsePenko(await pack({ 'manifest.json': manifest({ version: 5, minReaderVersion: 1 }), 'document.json': '{"id":"n","title":"Future"}', 'content.html': '<p>x</p>' }));
    expect(res.newerVersion).toBe(true);
    expect(res.doc.title).toBe('Future');
  });

  it('runs migrations from the file version up to the reader version', async () => {
    const migrations = {
      1: (p: PenkoPackage) => ({ ...p, document: { ...p.document, title: `${p.document.title} (v2)` } }),
      2: (p: PenkoPackage) => ({ ...p, content: p.content.replace('old', 'new') }),
    };
    const data = await pack({ 'manifest.json': manifest(), 'document.json': '{"id":"m","title":"T"}', 'content.html': '<p>old</p>' });
    const res = await parsePenko(data, { migrations, readerVersion: 3 });
    expect(res.doc.title).toBe('T (v2)');
    expect(res.doc.content).toBe('<p>new</p>');
    // a v2 file only runs the 2 → 3 step
    const pkg: PenkoPackage = { manifest: { format: 'penko', version: 2, minReaderVersion: 1, generator: '', savedAt: 0 }, document: { title: 'A' }, content: 'old' };
    const out = migratePackage(pkg, migrations, 3);
    expect(out.document.title).toBe('A');
    expect(out.content).toBe('new');
    expect(out.manifest.version).toBe(3);
  });
});

describe('file helpers', () => {
  it('names and formats', () => {
    expect(formatOfName('A.PENKO')).toBe('penko');
    expect(formatOfName('a.docx')).toBe('docx');
    expect(formatOfName('a.odt')).toBeNull();
    expect(withExtension('Report.penko', 'docx')).toBe('Report.docx');
    expect(withExtension('  ', 'penko')).toBe('Document.penko');
    expect(withExtension('notes.v2', 'penko')).toBe('notes.v2.penko');
    expect(isOpenableName('x.Markdown')).toBe(true);
    expect(isOpenableName('x.exe')).toBe(false);
  });

  it('tracks unsaved changes against the last save', () => {
    const link = { docId: 'd', name: 'd.penko', format: 'penko' as const, autoSave: false, savedModified: 10 };
    expect(hasUnsavedFileChanges(link, 10)).toBe(false);
    expect(hasUnsavedFileChanges(link, 11)).toBe(true);
    expect(hasUnsavedFileChanges({ ...link, savedModified: undefined }, 1)).toBe(true);
    expect(hasUnsavedFileChanges(undefined, 1)).toBe(false);
  });

  it('keeps the recent list unique and bounded', async () => {
    let list: RecentFile[] = [];
    for (let i = 0; i < 20; i++) list = await addRecent(list, { id: String(i), name: `f${i}.penko`, docId: `d${i}`, at: i, action: 'saved' });
    expect(list).toHaveLength(12);
    expect(list[0].name).toBe('f19.penko');
    list = await addRecent(list, { id: 'again', name: 'f15.penko', docId: 'd15', at: 99, action: 'opened' });
    expect(list.filter(r => r.name === 'f15.penko')).toHaveLength(1);
    expect(list[0].id).toBe('again');
    // handles are compared with isSameEntry
    const h = (key: string) => ({ kind: 'file' as const, name: 'same.penko', getFile: async () => new File([], 'x'), isSameEntry: async (o: any) => o.key === key, key });
    list = await addRecent([], { id: 'a', name: 'same.penko', handle: h('1'), at: 1, action: 'opened' });
    list = await addRecent(list, { id: 'b', name: 'same.penko', handle: h('2'), at: 2, action: 'opened' });
    expect(list.map(r => r.id)).toEqual(['b', 'a']);
    list = await addRecent(list, { id: 'c', name: 'same.penko', handle: h('1'), at: 3, action: 'saved' });
    expect(list.map(r => r.id)).toEqual(['c', 'b']);
  });
});

describe('file bookkeeping store', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('persists links and recent files, dropping handles that cannot be stored', async () => {
    const { vi } = await import('vitest');
    vi.resetModules();
    const m = await import('../../utils/files/fileLinks');
    const unclonable = { kind: 'file', name: 'x.penko', getFile: async () => new File([], 'x') } as any;
    await m.saveFileLinks({ d: { docId: 'd', name: 'x.penko', format: 'penko', handle: unclonable, autoSave: true, savedModified: 3 } });
    await m.saveRecentFiles([{ id: 'r', name: 'x.penko', handle: unclonable, at: 1, action: 'saved' }]);
    const links = await m.loadFileLinks();
    // without a handle there is nothing to auto-save to
    expect(links.d).toEqual({ docId: 'd', name: 'x.penko', format: 'penko', autoSave: false, savedModified: 3 });
    expect(await m.loadRecentFiles()).toEqual([{ id: 'r', name: 'x.penko', at: 1, action: 'saved' }]);
  });
});
