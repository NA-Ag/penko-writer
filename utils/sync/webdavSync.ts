import * as Y from 'yjs';
import { WebDavClient, WebDavError, type WebDavCredentials } from './webdav';
import { decryptBytes, decryptString, deriveKey, encryptBytes, encryptString, PBKDF2_ITERATIONS, randomBytes, SyncCryptoError } from './crypto';
import { bytesToBase64, base64ToBytes } from '../base64';
import { clocksOf, encodeClocks, mergeClocks, updateClocks } from './model';
import type { ChannelMeta } from './store';

/**
 * WebDAV transport. Server layout (everything but penko-sync.json is encrypted):
 *
 *   <folder>/penko-sync.json            KDF parameters + an encrypted check value
 *   <folder>/data/<channel>.state       compacted full Yjs state of a channel
 *   <folder>/data/<channel>.<device>.<n>.upd
 *                                       incremental updates, one file per upload
 *
 * Channels are the index ("index") and one per document (its id). Every
 * device only ever creates new update files (unique names), so concurrent
 * uploads never overwrite each other; merging is left to Yjs. When a channel
 * collects many update files, one device folds them into `.state` with a
 * conditional PUT (If-Match) and deletes the files it folded in.
 */

export const KEYFILE = 'penko-sync.json';
const DATA = 'data';
const CHECK_TEXT = 'penko-sync-check-v1';
const COMPACT_AFTER = 12;

export interface KeyFile {
  format: 'penko-sync';
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  check: string;
}

const FILE_RE = /^([A-Za-z0-9_-]+)\.(?:state|([A-Za-z0-9]+)\.(\d+)\.upd)$/;

export interface ParsedFile {
  name: string;
  channel: string;
  kind: 'state' | 'upd';
  device: string | null;
  etag: string;
}

export const parseFileName = (name: string, etag: string | null): ParsedFile | null => {
  const m = FILE_RE.exec(name);
  if (!m) return null;
  return { name, channel: m[1], kind: m[2] ? 'upd' : 'state', device: m[2] || null, etag: etag || '' };
};

const folderPath = (folder: string) => folder.split('/').filter(Boolean).join('/');

export interface SyncChannel {
  id: string;
  ydoc: Y.Doc;
  meta: ChannelMeta;
}

/** What the transport needs from the engine. */
export interface WebDavHost {
  deviceId: string;
  channels(): SyncChannel[];
  /** Existing channel, or a new empty one for a document that only exists remotely (null if it was deleted here). */
  channelFor(id: string): SyncChannel | null;
  /** Merges downloaded updates (and shows the result). */
  applyRemote(id: string, updates: Uint8Array[]): Promise<void>;
  /** Documents whose index entry says deleted (their files are removed from the server). */
  isDeleted(id: string): boolean;
  /** Called once the server copy of every channel was merged (seeds documents that existed before sync). */
  afterDownload(): void;
  nextSeq(): number;
  persistMeta(ch: SyncChannel): void;
}

/* ------------------------------------------------------------------ */
/* Setup: key file                                                     */
/* ------------------------------------------------------------------ */

const readKeyFile = async (client: WebDavClient, folder: string): Promise<KeyFile | null> => {
  const res = await client.get(`${folderPath(folder)}/${KEYFILE}`);
  if (!res) return null;
  try {
    const kf = JSON.parse(new TextDecoder().decode(res.data));
    if (kf?.format !== 'penko-sync' || typeof kf?.kdf?.salt !== 'string' || typeof kf?.check !== 'string') throw new Error('bad');
    return kf;
  } catch {
    throw new WebDavError('http', 'penko-sync.json is not a Penko sync file');
  }
};

const verifyKey = async (key: CryptoKey, kf: KeyFile) => {
  try {
    return (await decryptString(key, base64ToBytes(kf.check), KEYFILE)) === CHECK_TEXT;
  } catch (e) {
    if (e instanceof SyncCryptoError) return false;
    throw e;
  }
};

export class PassphraseError extends Error {
  constructor() {
    super('Wrong sync passphrase');
    this.name = 'PassphraseError';
  }
}

/**
 * Connects to the server: creates the folder and key file on first use,
 * otherwise derives the key from the stored salt and checks the passphrase.
 */
export const connectWebDav = async (
  creds: WebDavCredentials,
  folder: string,
  passphrase: string,
  opts: { iterations?: number } = {},
): Promise<{ key: CryptoKey; created: boolean }> => {
  const client = new WebDavClient(creds);
  const base = folderPath(folder);
  await client.ensureDir(`${base}/${DATA}`);
  const existing = await readKeyFile(client, base);
  if (existing) {
    const key = await deriveKey(passphrase, base64ToBytes(existing.kdf.salt), existing.kdf.iterations);
    if (!(await verifyKey(key, existing))) throw new PassphraseError();
    return { key, created: false };
  }
  const iterations = opts.iterations || PBKDF2_ITERATIONS;
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt, iterations);
  const kf: KeyFile = {
    format: 'penko-sync',
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: bytesToBase64(salt) },
    check: bytesToBase64(await encryptString(key, CHECK_TEXT, KEYFILE)),
  };
  try {
    await client.put(`${base}/${KEYFILE}`, JSON.stringify(kf, null, 2), { ifNoneMatch: true, contentType: 'application/json' });
  } catch (e) {
    // another device created it at the same moment: use theirs
    if (e instanceof WebDavError && e.kind === 'precondition') return connectWebDav(creds, folder, passphrase, opts);
    throw e;
  }
  return { key, created: true };
};

/** Checks that the server is reachable with these credentials (PROPFIND on the base URL). */
export const testWebDav = async (creds: WebDavCredentials) => {
  await new WebDavClient(creds).propfind('', 0);
};

/* ------------------------------------------------------------------ */
/* Sync cycle                                                          */
/* ------------------------------------------------------------------ */

export class WebDavSync {
  private client: WebDavClient;
  private base: string;
  private key: CryptoKey;
  private host: WebDavHost;

  constructor(creds: WebDavCredentials, folder: string, key: CryptoKey, host: WebDavHost, fetchImpl?: typeof fetch) {
    this.client = new WebDavClient(creds, fetchImpl);
    this.base = folderPath(folder);
    this.key = key;
    this.host = host;
  }

  private path(name: string) {
    return `${this.base}/${DATA}/${name}`;
  }

  /** One full round: check the key, download what's new, upload local changes, tidy up. */
  async sync(): Promise<void> {
    const kf = await readKeyFile(this.client, this.base);
    if (!kf || !(await verifyKey(this.key, kf))) throw new PassphraseError();

    let listing: ParsedFile[];
    try {
      listing = (await this.client.propfind(`${this.base}/${DATA}`, 1)).filter(e => !e.isDir).map(e => parseFileName(e.name, e.etag)).filter((f): f is ParsedFile => !!f);
    } catch (e) {
      if (!(e instanceof WebDavError && e.kind === 'notFound')) throw e;
      await this.client.ensureDir(`${this.base}/${DATA}`);
      listing = [];
    }
    const byChannel = new Map<string, ParsedFile[]>();
    listing.forEach(f => {
      const list = byChannel.get(f.channel) || [];
      list.push(f);
      byChannel.set(f.channel, list);
    });

    // 1. download (the index first: it decides which documents exist)
    const ids = Array.from(byChannel.keys()).sort((a, b) => (a === 'index' ? -1 : b === 'index' ? 1 : 0));
    for (const id of ids) {
      if (id !== 'index' && this.host.isDeleted(id)) continue;
      await this.download(id, byChannel.get(id)!);
    }
    this.host.afterDownload();

    // 2. upload local changes
    for (const ch of this.host.channels()) {
      if (ch.id !== 'index' && this.host.isDeleted(ch.id)) continue;
      if (ch.meta.dirty) await this.upload(ch, byChannel);
    }

    // 3. tidy: remove deleted documents, compact long update logs
    for (const [id, files] of byChannel) {
      if (id !== 'index' && this.host.isDeleted(id)) {
        for (const f of files) await this.client.delete(this.path(f.name));
        continue;
      }
      if (files.filter(f => f.kind === 'upd').length >= COMPACT_AFTER) {
        const ch = this.host.channelFor(id);
        if (ch) await this.compact(ch, files);
      }
    }
  }

  private async download(id: string, files: ParsedFile[]) {
    const ch = this.host.channelFor(id);
    if (!ch) return;
    const listed = new Set(files.map(f => f.name));
    // forget files that are gone (folded into .state by someone)
    Object.keys(ch.meta.applied).forEach(name => !listed.has(name) && delete ch.meta.applied[name]);
    const applied = ch.meta.applied;
    const fresh = files.filter(f => {
      if (!(f.name in applied)) return true;
      if (f.kind === 'upd' && f.device === this.host.deviceId) return false; // our own upload
      // update files are never rewritten; a new etag on .state means someone compacted again
      return !!f.etag && applied[f.name] !== f.etag;
    });
    const results = await mapLimit(fresh, 4, async f => {
      const res = await this.client.get(this.path(f.name));
      if (!res) return null;
      try {
        return { f, etag: f.etag || res.etag || '', update: await decryptBytes(this.key, res.data, f.name) };
      } catch (e) {
        if (!(e instanceof SyncCryptoError)) throw e;
        console.warn('[sync] skipping unreadable file', f.name);
        return { f, etag: f.etag, update: null };
      }
    });
    const updates: Uint8Array[] = [];
    let clocks = ch.meta.server;
    results.forEach(r => {
      if (!r) return;
      applied[r.f.name] = r.etag;
      if (!r.update) return;
      updates.push(r.update);
      clocks = mergeClocks(clocks, updateClocks(r.update));
    });
    if (updates.length) await this.host.applyRemote(id, updates);
    ch.meta.server = clocks;
    this.host.persistMeta(ch);
  }

  private async upload(ch: SyncChannel, byChannel: Map<string, ParsedFile[]>) {
    const update = Y.encodeStateAsUpdate(ch.ydoc, encodeClocks(ch.meta.server));
    const clocks = clocksOf(ch.ydoc);
    const name = `${ch.id}.${this.host.deviceId}.${this.host.nextSeq()}.upd`;
    ch.meta.dirty = false; // changes made while uploading set it again
    try {
      const blob = await encryptBytes(this.key, update, name);
      const { etag } = await this.client.put(this.path(name), blob, { ifNoneMatch: true });
      ch.meta.applied[name] = etag || '';
      ch.meta.server = mergeClocks(ch.meta.server, clocks);
      const list = byChannel.get(ch.id) || [];
      list.push({ name, channel: ch.id, kind: 'upd', device: this.host.deviceId, etag: etag || '' });
      byChannel.set(ch.id, list);
    } catch (e) {
      ch.meta.dirty = true;
      throw e;
    } finally {
      this.host.persistMeta(ch);
    }
  }

  private async compact(ch: SyncChannel, files: ParsedFile[]) {
    const state = files.find(f => f.kind === 'state');
    const name = `${ch.id}.state`;
    const blob = await encryptBytes(this.key, Y.encodeStateAsUpdate(ch.ydoc), name);
    let etag: string | null;
    try {
      ({ etag } = await this.client.put(this.path(name), blob, state?.etag ? { ifMatch: state.etag } : { ifNoneMatch: true }));
    } catch (e) {
      if (e instanceof WebDavError && e.kind === 'precondition') return; // another device compacted first
      throw e;
    }
    // Everything listed was merged locally before this state was written: those files are redundant now.
    for (const f of files) {
      if (f.kind !== 'upd') continue;
      await this.client.delete(this.path(f.name));
      delete ch.meta.applied[f.name];
    }
    ch.meta.applied[name] = etag || '';
    this.host.persistMeta(ch);
  }
}

/** Runs `fn` over `items` with at most `limit` in flight; results keep the input order. */
const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};
