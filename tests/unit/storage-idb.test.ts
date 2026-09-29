import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

// storage.ts caches whether IndexedDB works, so each test loads a fresh copy.
const load = async () => {
  vi.resetModules();
  return import('../../utils/storage');
};

const doc = (id: string, lastModified = 100, content = `<p>${id}</p>`) => ({ id, title: id, content, createdAt: 0, lastModified });

describe('storage with IndexedDB', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('saves, loads (newest first) and deletes documents', async () => {
    const s = await load();
    await s.saveDocument(doc('a', 100));
    await s.saveDocument(doc('b', 200));
    expect((await s.loadAllDocuments()).docs.map(d => d.id)).toEqual(['b', 'a']);
    await s.deleteDocument('a');
    const { docs, error } = await s.loadAllDocuments();
    expect(docs.map(d => d.id)).toEqual(['b']);
    expect(error).toBeNull();
  });

  it('skips a malformed record and reports it instead of failing', async () => {
    const s = await load();
    await s.saveDocument(doc('good'));
    const { docStore } = await s.getStores();
    const { set } = await import('idb-keyval');
    await set('broken', { id: 'broken', content: null }, docStore!);
    const { docs, error } = await s.loadAllDocuments();
    expect(docs.map(d => d.id)).toEqual(['good']);
    expect(error).toBeTruthy();
  });

  it('surfaces a quota error as StorageError.quota', async () => {
    const s = await load();
    await s.saveDocument(doc('warmup'));
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    const err = await s.saveDocument(doc('big')).catch(e => e);
    expect(err).toBeInstanceOf(s.StorageError);
    expect(err.quota).toBe(true);
  });

  it('never rejects when the store cannot be read', async () => {
    const s = await load();
    await s.saveDocument(doc('a'));
    vi.spyOn(IDBObjectStore.prototype, 'openCursor').mockImplementation(() => {
      throw new DOMException('broken', 'UnknownError');
    });
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(() => {
      throw new DOMException('broken', 'UnknownError');
    });
    const result = await s.loadAllDocuments();
    expect(result.docs).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it('merges a newer emergency backup into IndexedDB and prunes it', async () => {
    const s = await load();
    await s.saveDocument(doc('a', 100, '<p>old</p>'));
    s.writeEmergencyBackup([doc('a', 200, '<p>new</p>'), doc('unsaved', 300)]);
    const { docs } = await s.loadAllDocuments();
    expect(docs.find(d => d.id === 'a')?.content).toBe('<p>new</p>');
    expect(docs.some(d => d.id === 'unsaved')).toBe(true);
    expect(s.readEmergencyBackup()).toEqual([]);
    // written back: a fresh module instance sees it without the backup
    const again = await load();
    expect((await again.loadAllDocuments()).docs.find(d => d.id === 'a')?.content).toBe('<p>new</p>');
  });

  it('an older emergency backup does not overwrite the stored copy', async () => {
    const s = await load();
    await s.saveDocument(doc('a', 300, '<p>stored</p>'));
    s.writeEmergencyBackup([doc('a', 200, '<p>stale</p>')]);
    const { docs } = await s.loadAllDocuments();
    expect(docs[0].content).toBe('<p>stored</p>');
    expect(s.readEmergencyBackup()).toEqual([]);
  });

  it('deleting a document also drops its emergency copy (no resurrection)', async () => {
    const s = await load();
    await s.saveDocument(doc('a'));
    s.writeEmergencyBackup([doc('a', 500)]);
    await s.deleteDocument('a');
    expect((await s.loadAllDocuments()).docs).toEqual([]);
  });

  it('migrates the old single-key localStorage format once', async () => {
    localStorage.setItem('penko_writer_docs', JSON.stringify([doc('legacy')]));
    const s = await load();
    expect((await s.loadAllDocuments()).docs.map(d => d.id)).toEqual(['legacy']);
    expect(localStorage.getItem('penko_writer_idb_migrated')).toBeTruthy();
    // the original key is kept as a backup
    expect(localStorage.getItem('penko_writer_docs')).toBeTruthy();
  });
});

describe('storage without IndexedDB', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to localStorage when opening IndexedDB fails', async () => {
    const failing = { open: () => { throw new DOMException('denied', 'InvalidStateError'); } };
    globalThis.indexedDB = failing as unknown as IDBFactory;
    const s = await load();
    await s.saveDocument(doc('a'));
    expect(localStorage.getItem('penko_writer_doc_a')).toContain('<p>a</p>');
    expect((await s.loadAllDocuments()).docs.map(d => d.id)).toEqual(['a']);
    localStorage.setItem('penko_writer_history_a', '[]');
    await s.deleteDocument('a');
    expect(localStorage.getItem('penko_writer_doc_a')).toBeNull();
    expect(localStorage.getItem('penko_writer_history_a')).toBeNull();
  });

  it('keeps earlier backed-up documents when the backup outgrows localStorage', async () => {
    globalThis.indexedDB = new IDBFactory();
    const s = await load();
    s.writeEmergencyBackup([doc('first', 100)]);
    const realSet = Storage.prototype.setItem;
    // fail only the attempt that includes both new documents
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (value.includes('"second"') && value.includes('"third"')) throw new DOMException('full', 'QuotaExceededError');
      return realSet.call(this, key, value);
    });
    s.writeEmergencyBackup([doc('second', 200), doc('third', 300)]);
    vi.restoreAllMocks();
    expect(s.readEmergencyBackup().map(d => d.id).sort()).toEqual(['first', 'third']);
  });
});
