// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { JSDOM } from 'jsdom';
import { startWebDavServer } from '../e2e/fixtures/webdav-server.mjs';
import { WebDavClient, WebDavError, normalizeDavUrl, parsePropfind } from '../../utils/sync/webdav';
import { deriveKey, encryptBytes, decryptBytes, randomBytes, SyncCryptoError } from '../../utils/sync/crypto';
import { WebDavSync, connectWebDav, PassphraseError, parseFileName, type SyncChannel, type WebDavHost } from '../../utils/sync/webdavSync';
import { emptyMeta } from '../../utils/sync/store';
import { resolveIndex, setIndexEntry, writeLocalFields, resolveFields } from '../../utils/sync/model';
import type { DocumentData } from '../../types';

// PROPFIND parsing needs a DOMParser (the browser has one)
(globalThis as any).DOMParser ??= new JSDOM('').window.DOMParser;

const ITER = 1000; // fast key derivation for tests
let server: Awaited<ReturnType<typeof startWebDavServer>>;
const creds = () => ({ url: server.url, username: 'penko', password: 'secret' });

beforeAll(async () => {
  server = await startWebDavServer();
});
afterAll(() => server.close());
beforeEach(() => {
  server.files.clear();
  server.dirs.clear();
  server.dirs.add('/');
  server.setOffline(false);
});

describe('sync crypto', () => {
  it('round-trips and authenticates', async () => {
    const salt = randomBytes(16);
    const key = await deriveKey('correct horse', salt, ITER);
    const data = new TextEncoder().encode('hello, penko');
    const blob = await encryptBytes(key, data, 'file-a');
    expect(new TextDecoder().decode(await decryptBytes(key, blob, 'file-a'))).toBe('hello, penko');
    // fresh IV every time
    expect(Buffer.from(await encryptBytes(key, data, 'file-a')).equals(Buffer.from(blob))).toBe(false);
    // bound to its name
    await expect(decryptBytes(key, blob, 'file-b')).rejects.toBeInstanceOf(SyncCryptoError);
    // wrong passphrase
    const other = await deriveKey('wrong horse', salt, ITER);
    await expect(decryptBytes(other, blob, 'file-a')).rejects.toBeInstanceOf(SyncCryptoError);
    // tampering
    blob[blob.length - 1] ^= 1;
    await expect(decryptBytes(key, blob, 'file-a')).rejects.toBeInstanceOf(SyncCryptoError);
  });

  it('derives the same key from the same passphrase and salt', async () => {
    const salt = randomBytes(16);
    const a = await deriveKey('pass', salt, ITER);
    const b = await deriveKey('pass', salt, ITER);
    const blob = await encryptBytes(a, new Uint8Array([1, 2, 3]), 'x');
    expect(Array.from(await decryptBytes(b, blob, 'x'))).toEqual([1, 2, 3]);
  });
});

describe('WebDAV client', () => {
  it('normalises URLs', () => {
    expect(normalizeDavUrl('cloud.example.com/remote.php/dav/files/me')).toBe('https://cloud.example.com/remote.php/dav/files/me/');
    expect(normalizeDavUrl('ftp://x')).toBeNull();
    expect(normalizeDavUrl('https://user:pw@x.com')).toBeNull();
    expect(normalizeDavUrl('')).toBeNull();
  });

  it('parses multistatus responses', () => {
    const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
      <d:response><d:href>/dav/Penko/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
      <d:response><d:href>/dav/Penko/a%20b.upd</d:href><d:propstat><d:prop><d:resourcetype/><d:getetag>"e1"</d:getetag><d:getcontentlength>12</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
    </d:multistatus>`;
    const out = parsePropfind(xml);
    expect(out.map(e => [e.name, e.isDir, e.etag, e.size])).toEqual([
      ['Penko', true, null, 0],
      ['a b.upd', false, '"e1"', 12],
    ]);
  });

  it('creates folders, writes, lists, reads and deletes', async () => {
    const dav = new WebDavClient(creds());
    await dav.ensureDir('Penko/data');
    await dav.put('Penko/data/x.state', new Uint8Array([1, 2, 3]));
    const list = await dav.propfind('Penko/data', 1);
    expect(list.map(e => e.name)).toEqual(['x.state']);
    expect((await dav.get('Penko/data/x.state'))!.data).toEqual(new Uint8Array([1, 2, 3]));
    expect(await dav.get('Penko/data/missing')).toBeNull();
    await dav.delete('Penko/data/x.state');
    await dav.delete('Penko/data/x.state'); // already gone: fine
    expect(await dav.propfind('Penko/data', 1)).toEqual([]);
  });

  it('honours conditional writes', async () => {
    const dav = new WebDavClient(creds());
    await dav.ensureDir('p');
    const { etag } = await dav.put('p/f', 'one', { ifNoneMatch: true });
    await expect(dav.put('p/f', 'two', { ifNoneMatch: true })).rejects.toMatchObject({ kind: 'precondition' });
    await dav.put('p/f', 'three', { ifMatch: etag });
    await expect(dav.put('p/f', 'four', { ifMatch: etag })).rejects.toMatchObject({ kind: 'precondition' });
  });

  it('reports wrong credentials and unreachable servers', async () => {
    await expect(new WebDavClient({ ...creds(), password: 'nope' }).propfind('', 0)).rejects.toMatchObject({ kind: 'auth' });
    const dead = new WebDavClient({ url: 'http://127.0.0.1:9/', username: 'a', password: 'b' });
    const err = await dead.propfind('', 0).catch(e => e);
    expect(err).toBeInstanceOf(WebDavError);
    expect(['network', 'offline']).toContain(err.kind);
  });

  it('classifies a reachable server without CORS as a CORS problem', async () => {
    // fetch that fails like a CORS rejection for normal requests but lets no-cors probes through
    const fakeFetch = (async (_url: any, init: any) => {
      if (init?.mode === 'no-cors') return new Response(null, { status: 200 });
      throw new TypeError('NetworkError when attempting to fetch resource.');
    }) as typeof fetch;
    const err = await new WebDavClient(creds(), fakeFetch).propfind('', 0).catch(e => e);
    expect(err.kind).toBe('cors');
  });
});

/* ------------------------------------------------------------------ */
/* Sync rounds between simulated devices                               */
/* ------------------------------------------------------------------ */

class Device {
  channels = new Map<string, SyncChannel>();
  seq = 0;
  sync: WebDavSync;
  constructor(public deviceId: string, key: CryptoKey) {
    this.sync = new WebDavSync(creds(), 'Penko', key, this.host());
  }
  ch(id: string) {
    let ch = this.channels.get(id);
    if (!ch) {
      const c: SyncChannel = { id, ydoc: new Y.Doc(), meta: emptyMeta() };
      c.ydoc.on('update', (_u: Uint8Array, origin: unknown) => origin !== 'webdav' && (c.meta.dirty = true));
      this.channels.set(id, (ch = c));
    }
    return ch;
  }
  isDeleted(id: string) {
    return resolveIndex(this.ch('index').ydoc).get(id)?.alive === false;
  }
  host(): WebDavHost {
    return {
      deviceId: this.deviceId,
      channels: () => Array.from(this.channels.values()),
      channelFor: id => (id !== 'index' && this.isDeleted(id) ? null : this.ch(id)),
      applyRemote: async (id, updates) => updates.forEach(u => Y.applyUpdate(this.ch(id).ydoc, u, 'webdav')),
      isDeleted: id => this.isDeleted(id),
      afterDownload: () => {},
      nextSeq: () => ++this.seq,
      persistMeta: () => {},
    };
  }
  text(id: string) {
    return this.ch(id).ydoc.getText('t').toString();
  }
  type(id: string, at: number, s: string) {
    this.ch(id).ydoc.getText('t').insert(at, s);
  }
}

const dataFiles = () => [...server.files.keys()].filter((p: string) => p.startsWith('/Penko/data/')).map((p: string) => p.slice('/Penko/data/'.length));

describe('WebDAV sync rounds', () => {
  it('sets up the key file once and rejects a wrong passphrase', async () => {
    const first = await connectWebDav(creds(), 'Penko', 'pass phrase', { iterations: ITER });
    expect(first.created).toBe(true);
    const again = await connectWebDav(creds(), 'Penko', 'pass phrase');
    expect(again.created).toBe(false);
    await expect(connectWebDav(creds(), 'Penko', 'other')).rejects.toBeInstanceOf(PassphraseError);
    const kf = JSON.parse(server.files.get('/Penko/penko-sync.json').data.toString());
    expect(kf.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: ITER });
  });

  it('stores only ciphertext on the server', async () => {
    const { key } = await connectWebDav(creds(), 'Penko', 'pw', { iterations: ITER });
    const a = new Device('devA', key);
    a.type('doc1', 0, 'TOP SECRET PLAN');
    writeLocalFields(a.ch('doc1').ydoc, { id: 'doc1', title: 'My secret title', content: '', createdAt: 1, lastModified: 1 } as DocumentData, 'devA', 1);
    await a.sync.sync();
    const all = Buffer.concat([...server.files.values()].map((f: any) => f.data)).toString('latin1');
    expect(all).not.toContain('TOP SECRET');
    expect(all).not.toContain('secret title');
    expect(dataFiles().every(n => parseFileName(n, null))).toBe(true);
  });

  it('merges concurrent offline edits from two devices', async () => {
    const { key } = await connectWebDav(creds(), 'Penko', 'pw', { iterations: ITER });
    const a = new Device('devA', key);
    const b = new Device('devB', key);
    a.type('doc1', 0, 'hello world');
    setIndexEntry(a.ch('index').ydoc, 'doc1', 'devA', true, 1);
    await a.sync.sync();
    await b.sync.sync();
    expect(b.text('doc1')).toBe('hello world');
    expect(resolveIndex(b.ch('index').ydoc).get('doc1')?.alive).toBe(true);
    // both offline, both edit
    a.type('doc1', 0, 'A: ');
    b.type('doc1', 11, ' (B)');
    await a.sync.sync();
    await b.sync.sync();
    await a.sync.sync();
    expect(a.text('doc1')).toBe('A: hello world (B)');
    expect(b.text('doc1')).toBe(a.text('doc1'));
    // nothing new: no uploads
    const before = dataFiles().length;
    await a.sync.sync();
    await b.sync.sync();
    expect(dataFiles().length).toBe(before);
  });

  it('compacts long update logs; a new device still gets everything', async () => {
    const { key } = await connectWebDav(creds(), 'Penko', 'pw', { iterations: ITER });
    const a = new Device('devA', key);
    const b = new Device('devB', key);
    for (let i = 0; i < 14; i++) {
      (i % 2 ? b : a).type('doc1', 0, String(i % 10));
      await (i % 2 ? b : a).sync.sync();
    }
    await a.sync.sync();
    await b.sync.sync();
    const files = dataFiles().filter(n => n.startsWith('doc1.'));
    expect(files).toContain('doc1.state');
    expect(files.filter(n => n.endsWith('.upd')).length).toBeLessThan(12);
    const c = new Device('devC', key);
    await c.sync.sync();
    expect(c.text('doc1')).toBe(a.text('doc1'));
    expect(c.text('doc1')).toHaveLength(14);
    expect(b.text('doc1')).toBe(a.text('doc1'));
  });

  it('deletions propagate as tombstones and remove the files', async () => {
    const { key } = await connectWebDav(creds(), 'Penko', 'pw', { iterations: ITER });
    const a = new Device('devA', key);
    const b = new Device('devB', key);
    a.type('doc1', 0, 'x');
    a.type('doc2', 0, 'y');
    setIndexEntry(a.ch('index').ydoc, 'doc1', 'devA', true, 1);
    setIndexEntry(a.ch('index').ydoc, 'doc2', 'devA', true, 1);
    await a.sync.sync();
    await b.sync.sync();
    setIndexEntry(b.ch('index').ydoc, 'doc1', 'devB', false, 5);
    await b.sync.sync();
    await b.sync.sync(); // the next round removes the files of deleted documents
    expect(dataFiles().some(n => n.startsWith('doc1.'))).toBe(false);
    expect(dataFiles().some(n => n.startsWith('doc2.'))).toBe(true);
    await a.sync.sync();
    expect(a.isDeleted('doc1')).toBe(true);
    expect(a.isDeleted('doc2')).toBe(false);
  });

  it('stops with a passphrase error when the server key changed', async () => {
    const { key } = await connectWebDav(creds(), 'Penko', 'pw', { iterations: ITER });
    const a = new Device('devA', key);
    await a.sync.sync();
    server.files.delete('/Penko/penko-sync.json');
    await connectWebDav(creds(), 'Penko', 'a different one', { iterations: ITER });
    await expect(a.sync.sync()).rejects.toBeInstanceOf(PassphraseError);
  });

  it('keeps local changes queued while the server is unreachable', async () => {
    const { key } = await connectWebDav(creds(), 'Penko', 'pw', { iterations: ITER });
    const a = new Device('devA', key);
    const b = new Device('devB', key);
    a.type('doc1', 0, 'offline text');
    server.setOffline(true);
    await expect(a.sync.sync()).rejects.toBeInstanceOf(WebDavError);
    expect(a.ch('doc1').meta.dirty).toBe(true);
    server.setOffline(false);
    await a.sync.sync();
    expect(a.ch('doc1').meta.dirty).toBe(false);
    await b.sync.sync();
    expect(b.text('doc1')).toBe('offline text');
  });

  it('keeps LWW fields consistent across devices', async () => {
    const { key } = await connectWebDav(creds(), 'Penko', 'pw', { iterations: ITER });
    const a = new Device('devA', key);
    const b = new Device('devB', key);
    const base = { id: 'd', content: '', createdAt: 1, lastModified: 1 } as DocumentData;
    writeLocalFields(a.ch('d').ydoc, { ...base, title: 'first' }, 'devA', 10);
    await a.sync.sync();
    await b.sync.sync();
    writeLocalFields(a.ch('d').ydoc, { ...base, title: 'older rename' }, 'devA', 20);
    writeLocalFields(b.ch('d').ydoc, { ...base, title: 'newer rename' }, 'devB', 30);
    await a.sync.sync();
    await b.sync.sync();
    await a.sync.sync();
    expect(resolveFields(a.ch('d').ydoc).fields.title).toBe('newer rename');
    expect(resolveFields(b.ch('d').ydoc).fields.title).toBe('newer rename');
  });
});
