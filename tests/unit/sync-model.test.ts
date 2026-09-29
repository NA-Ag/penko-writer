import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { htmlToNode, nodeToHtml, syncSchema } from '../../utils/sync/codec';
import {
  writeLocalContent, readContent, writeLocalFields, resolveFields, setIndexEntry, resolveIndex, unknownTypes,
  isPristine, updateClocks, mergeClocks, clocksOf, stableStringify,
} from '../../utils/sync/model';
import type { DocumentData } from '../../types';

const doc = (over: Partial<DocumentData> = {}): DocumentData => ({
  id: 'd1', title: 'T', content: '<p>x</p>', createdAt: 1, lastModified: 1, ...over,
});

const html = (y: Y.Doc) => nodeToHtml(readContent(y, syncSchema())!);
const edit = (y: Y.Doc, h: string) => writeLocalContent(y, htmlToNode(h));
const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
};
/** Two replicas that share a common starting state. */
const replicas = (start: string) => {
  const a = new Y.Doc();
  edit(a, start);
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  return [a, b];
};

describe('sync model: content merges', () => {
  it('round-trips document HTML', () => {
    const y = new Y.Doc();
    const h = '<h1>Title</h1><p>Some <strong>bold</strong> and <em>italic</em> text</p><ul><li><p>item</p></li></ul>';
    edit(y, h);
    expect(html(y)).toBe(nodeToHtml(htmlToNode(h)));
  });

  it('keeps offline edits to different paragraphs from both devices', () => {
    const [a, b] = replicas('<p>one</p><p>two</p><p>three</p>');
    edit(a, '<p>one (A)</p><p>two</p><p>three</p>');
    edit(b, '<p>one</p><p>two</p><p>three (B)</p><p>four (B)</p>');
    sync(a, b);
    expect(html(a)).toBe('<p>one (A)</p><p>two</p><p>three (B)</p><p>four (B)</p>');
    expect(html(b)).toBe(html(a));
  });

  it('keeps both texts when the same paragraph is edited on both devices', () => {
    const [a, b] = replicas('<p>The cat sat.</p>');
    edit(a, '<p>The black cat sat.</p>');
    edit(b, '<p>The cat sat down.</p>');
    sync(a, b);
    expect(html(a)).toBe('<p>The black cat sat down.</p>');
    expect(html(b)).toBe(html(a));
  });

  it('concurrent inserts at the same spot keep both (deterministic order)', () => {
    const [a, b] = replicas('<p>ab</p>');
    edit(a, '<p>aXb</p>');
    edit(b, '<p>aYb</p>');
    sync(a, b);
    const merged = html(a);
    expect(['<p>aXYb</p>', '<p>aYXb</p>']).toContain(merged);
    expect(html(b)).toBe(merged);
  });

  it('delete vs edit: the deleted paragraph goes, every other edit survives', () => {
    const [a, b] = replicas('<p>keep</p><p>remove me</p><p>tail</p>');
    edit(a, '<p>keep</p><p>tail</p>');
    edit(b, '<p>keep!</p><p>remove me, edited</p><p>tail</p>');
    sync(a, b);
    expect(html(a)).toBe(html(b));
    expect(html(a)).toContain('keep!');
    expect(html(a)).toContain('tail');
    expect(html(a)).not.toContain('remove me<');
  });

  it('formatting on one side and typing on the other both survive', () => {
    const [a, b] = replicas('<p>hello world</p>');
    edit(a, '<p><strong>hello</strong> world</p>');
    edit(b, '<p>hello world again</p>');
    sync(a, b);
    expect(html(a)).toBe('<p><strong>hello</strong> world again</p>');
    expect(html(b)).toBe(html(a));
  });

  it('a no-op edit produces no update', () => {
    const [a] = replicas('<p>same</p><p>text</p>');
    let updates = 0;
    a.on('update', () => updates++);
    edit(a, '<p>same</p><p>text</p>');
    expect(updates).toBe(0);
  });

  it('reports node types it does not know', () => {
    const y = new Y.Doc();
    edit(y, '<p>x</p>');
    expect(unknownTypes(y, syncSchema())).toEqual([]);
    y.getXmlFragment('default').insert(0, [new Y.XmlElement('futureWidget')]);
    expect(unknownTypes(y, syncSchema())).toEqual(['futureWidget']);
  });
});

describe('sync model: fields', () => {
  it('last writer wins per field (by timestamp, not by device order)', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    writeLocalFields(a, doc({ title: 'Base', language: 'en-US' }), 'devA', 100);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    writeLocalFields(a, doc({ title: 'From A', language: 'en-US' }), 'devA', 300);
    writeLocalFields(b, doc({ title: 'From B', language: 'de' }), 'devZ', 200);
    sync(a, b);
    for (const y of [a, b]) {
      const { fields } = resolveFields(y);
      expect(fields.title).toBe('From A'); // newer, although devZ > devA
      expect(fields.language).toBe('de'); // only B changed it
    }
  });

  it('only writes fields that changed', () => {
    const y = new Y.Doc();
    expect(writeLocalFields(y, doc({ title: 'A', pageConfig: { size: 'A4', orientation: 'portrait', margins: 'normal', cols: 1 } }), 'd', 1)).toBe(true);
    expect(writeLocalFields(y, doc({ title: 'A', pageConfig: { orientation: 'portrait', size: 'A4', margins: 'normal', cols: 1 } }), 'd', 2)).toBe(false);
    expect(writeLocalFields(y, doc({ title: 'B', pageConfig: { orientation: 'portrait', size: 'A4', margins: 'normal', cols: 1 } }), 'd', 3)).toBe(true);
  });

  it('unset fields propagate', () => {
    const y = new Y.Doc();
    writeLocalFields(y, doc({ header: '<p>h</p>' }), 'd', 1);
    writeLocalFields(y, doc({ header: undefined }), 'd', 2);
    expect(resolveFields(y).fields.header).toBeUndefined();
    expect('header' in resolveFields(y).fields).toBe(true);
  });

  it('merges comments per item and propagates deletions', () => {
    const c = (id: string, text: string) => ({ id, rangeId: id, author: 'u', text, timestamp: 1, resolved: false, replies: [] });
    const a = new Y.Doc();
    const b = new Y.Doc();
    writeLocalFields(a, doc({ comments: [c('c1', 'first'), c('c2', 'second')] }), 'devA', 10);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    writeLocalFields(a, doc({ comments: [c('c1', 'first'), c('c2', 'second'), c('c3', 'from A')] }), 'devA', 20);
    writeLocalFields(b, doc({ comments: [c('c1', 'first, edited'), c('c4', 'from B')] }), 'devB', 21); // deleted c2
    sync(a, b);
    for (const y of [a, b]) {
      const texts = (resolveFields(y).fields.comments || []).map(x => x.text);
      expect(texts.sort()).toEqual(['first, edited', 'from A', 'from B']);
    }
  });
});

describe('sync model: index & tombstones', () => {
  it('newest entry wins; deletion after creation removes the document', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    setIndexEntry(a, 'doc1', 'devA', true, 10);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    setIndexEntry(b, 'doc1', 'devB', false, 20);
    setIndexEntry(a, 'doc2', 'devA', true, 15);
    sync(a, b);
    const idx = resolveIndex(a);
    expect(idx.get('doc1')).toEqual({ alive: false, t: 20 });
    expect(idx.get('doc2')).toEqual({ alive: true, t: 15 });
    // a later resurrection (edited after the deletion) wins again
    setIndexEntry(a, 'doc1', 'devA', true, 30);
    sync(a, b);
    expect(resolveIndex(b).get('doc1')?.alive).toBe(true);
  });
});

describe('sync model: helpers', () => {
  it('detects pristine documents', () => {
    expect(isPristine(doc({ title: '', content: '<p></p>' }))).toBe(true);
    expect(isPristine(doc({ title: '', content: '<p>x</p>' }))).toBe(false);
    expect(isPristine(doc({ title: 'x', content: '<p></p>' }))).toBe(false);
  });

  it('tracks what an update tells a receiver', () => {
    const y = new Y.Doc();
    edit(y, '<p>hello</p>');
    const full = Y.encodeStateAsUpdate(y);
    const clocks = updateClocks(full);
    expect(clocks).toEqual(clocksOf(y));
    edit(y, '<p>hello world</p>');
    expect(clocksOf(y)).not.toEqual(clocks);
    const diff = Y.encodeStateAsUpdate(y, Y.encodeStateVector(new Map(Object.entries(clocks).map(([k, v]) => [Number(k), v]))));
    expect(mergeClocks(clocks, updateClocks(diff))).toEqual(clocksOf(y));
  });

  it('stable stringify ignores key order and undefined', () => {
    expect(stableStringify({ b: 1, a: [1, { d: undefined, c: 2 }] })).toBe(stableStringify({ a: [1, { c: 2 }], b: 1 }));
  });
});
