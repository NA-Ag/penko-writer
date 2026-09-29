import * as Y from 'yjs';
import type { Editor } from '@tiptap/core';
import type { DocumentData } from '../../types';
import { syncBridge, type SyncEvent, type SyncHost } from './bridge';
import { resetSyncStatus, setSyncStatus, type PeerStatus, type SyncErrorKind } from './status';
import * as store from './store';
import type { ChannelMeta, SyncConfig } from './store';
import { htmlToNode, nodeToHtml, syncSchema } from './codec';
import {
  LOCAL_ORIGIN, contentFragment, isPristine, readContent, resolveFields, resolveIndex, sameValue, setIndexEntry, unknownTypes,
  unknownTypesInUpdate, writeLocalContent, writeLocalFields, writeModified,
} from './model';
import { WebDavSync, PassphraseError, connectWebDav, testWebDav, type SyncChannel } from './webdavSync';
import { WebDavError, normalizeDavUrl, type WebDavCredentials } from './webdav';
import { PeerLink, generatePairingCode, hostPairing, joinPairing, encodeSV, type PairingCode, type PairingHandle, type PairingResult } from './p2p';

/**
 * The sync engine: keeps one Y.Doc per document (plus the index) in step with
 * the document store and exchanges Yjs updates over WebDAV and/or WebRTC.
 *
 * Local → CRDT: after the store saves a document, its HTML is diffed into the
 * Y.Doc (updateYFragment) and its other fields recorded as LWW registers.
 * CRDT → local: merged remote changes are written back to the store. When the
 * document is open, the change is applied to the live editor as one minimal
 * ProseMirror transaction (caret and undo history stay intact); otherwise the
 * store's external-content path makes the editor reload.
 *
 * Ordering rules that keep merges lossless:
 * - Before remote updates are merged into a document, pending editor edits are
 *   flushed and recorded, so the merge sees them.
 * - A Y.Doc is persisted before its changes are sent anywhere or shown in the
 *   store; otherwise a crash could make the next start re-record text that a
 *   peer already has, duplicating it.
 */

const INDEX = 'index';
const LOAD = 'penko-load';
const WEBDAV = 'penko-webdav';
const WEBDAV_INTERVAL_MS = 60_000;
const WEBDAV_AFTER_CHANGE_MS = 3_000;
const LOCAL_DEBOUNCE_MS = 250;
const LOCK_NAME = 'penko-writer-sync';

interface P2POrigin {
  p2p: string;
}

interface Channel extends SyncChannel {
  /** HTML the CRDT content was last recorded from / written to (skips re-parsing unchanged documents). */
  lastHtml?: string;
  incompatible?: boolean;
  saveTimer?: number;
  saving?: Promise<void>;
  /** Updates waiting for the Y.Doc to be persisted before they go to peers. */
  outbox: { update: Uint8Array; from: string | null }[];
}

export interface WebDavSetup {
  url: string;
  username: string;
  password: string;
  folder: string;
  passphrase: string;
}

/** Classifies an error from sync / setup for display. */
export const syncErrorKind = (e: unknown): SyncErrorKind => {
  if (e instanceof PassphraseError) return 'passphrase';
  if (e instanceof WebDavError) {
    if (e.kind === 'precondition' || e.kind === 'badUrl') return 'http';
    return e.kind;
  }
  if (e instanceof DOMException && e.name === 'QuotaExceededError') return 'storage';
  return 'unknown';
};

export class SyncEngine {
  private cfg!: SyncConfig;
  private host!: SyncHost;
  private channels = new Map<string, Channel>();
  private index!: Channel;
  private webdav: WebDavSync | null = null;
  private webdavKey: CryptoKey | null = null;
  private links = new Map<string, PeerLink>();
  private peerConnected = new Set<string>();
  private signalingUp = new Set<string>();
  private localTimers = new Map<string, number>();
  private p2pInbox = new Map<string, { updates: Uint8Array[]; from: string }>();
  private p2pTimer = 0;
  private cycleRunning: Promise<void> | null = null;
  private cycleAgain = false;
  private cycleTimer = 0;
  private interval = 0;
  private lastFocusSync = 0;
  private stopped = false;
  private cleanups: (() => void)[] = [];
  private releaseLock: (() => void) | null = null;
  private pairing: PairingHandle | null = null;

  /* ------------------------------------------------------------------ */
  /* Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  started = false;

  async start() {
    await this.acquireLock();
    if (this.stopped) {
      this.releaseLock?.();
      return;
    }
    this.host = await waitForHost();
    this.cfg = await store.loadConfig();
    this.webdavKey = (await store.loadWebDavKey()) || null;

    this.index = await this.openChannel(INDEX);
    for (const id of await store.listChannelIds()) if (id !== INDEX && !this.channels.has(id)) await this.openChannel(id);

    // Documents sync doesn't know yet: seeded once the other side was consulted.
    const idx = resolveIndex(this.index.ydoc);
    for (const doc of this.host.getDocs()) {
      const ch = this.channels.get(doc.id);
      if (ch) {
        if (ch.meta.seenModified !== doc.lastModified) this.recordLocal(doc.id);
        continue;
      }
      if (isPristine(doc) || idx.get(doc.id)?.alive === false) continue;
      this.createChannel(doc.id, { unseeded: true });
    }
    this.reconcileIndex();

    this.cleanups.push(syncBridge.subscribe(e => this.onLocalEvent(e)));
    const onFocus = () => {
      if (document.visibilityState === 'hidden') {
        void this.flushSaves();
        return;
      }
      if (Date.now() - this.lastFocusSync > 10_000) {
        this.lastFocusSync = Date.now();
        this.syncWebDav();
      }
    };
    const onOnline = () => this.syncWebDav();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', onOnline);
    this.cleanups.push(() => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', onOnline);
    });
    this.interval = window.setInterval(() => this.syncWebDav(), WEBDAV_INTERVAL_MS);

    setSyncStatus({ running: true, otherTab: false, deviceName: this.cfg.deviceName });
    await this.setupWebDav();
    await Promise.all(this.cfg.peers.map(p => this.startLink(p)));
    this.started = true;
    this.refreshStatus();
    this.syncWebDav();
  }

  async stop() {
    this.stopped = true;
    window.clearInterval(this.interval);
    window.clearTimeout(this.cycleTimer);
    window.clearTimeout(this.p2pTimer);
    this.localTimers.forEach(t => window.clearTimeout(t));
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
    await this.pairing?.cancel();
    await Promise.all(Array.from(this.links.values()).map(l => l.destroy()));
    this.links.clear();
    await this.cycleRunning?.catch(() => {});
    if (this.channels.size) await this.flushSaves();
    this.channels.forEach(ch => ch.ydoc.destroy());
    this.channels.clear();
    this.releaseLock?.();
    resetSyncStatus();
  }

  /** Only one tab syncs at a time (they share the same IndexedDB). */
  private async acquireLock() {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks?.request) return;
    await new Promise<void>(acquired => {
      let first = true;
      const request = (opts: LockOptions) =>
        locks.request(LOCK_NAME, opts, lock => {
          if (!lock) {
            // held by another tab: say so and queue up to take over when it closes
            setSyncStatus({ otherTab: true });
            if (first) {
              first = false;
              void request({});
            }
            return undefined;
          }
          acquired();
          return new Promise<void>(release => (this.releaseLock = release));
        });
      void request({ ifAvailable: true });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Channels                                                            */
  /* ------------------------------------------------------------------ */

  private async openChannel(id: string): Promise<Channel> {
    const { state, meta } = await store.loadChannel(id);
    const ydoc = new Y.Doc();
    if (state) Y.applyUpdate(ydoc, state, LOAD);
    const ch: Channel = { id, ydoc, meta, outbox: [] };
    this.channels.set(id, ch);
    this.attach(ch);
    return ch;
  }

  private createChannel(id: string, extra: Partial<ChannelMeta> = {}): Channel {
    const ch: Channel = { id, ydoc: new Y.Doc(), meta: { ...store.emptyMeta(), ...extra }, outbox: [] };
    this.channels.set(id, ch);
    this.attach(ch);
    this.scheduleSave(ch);
    return ch;
  }

  private attach(ch: Channel) {
    ch.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === LOAD) return;
      if (origin !== WEBDAV) {
        ch.meta.dirty = true;
        this.scheduleWebDav(WEBDAV_AFTER_CHANGE_MS);
      }
      const from = typeof origin === 'object' && origin && 'p2p' in origin ? (origin as P2POrigin).p2p : null;
      if (this.links.size) ch.outbox.push({ update, from });
      this.scheduleSave(ch, 50);
    });
  }

  private scheduleSave(ch: Channel, delay = 500) {
    window.clearTimeout(ch.saveTimer);
    ch.saveTimer = window.setTimeout(() => void this.saveNow(ch), delay);
  }

  /** Persists the channel, then releases its queued updates to peers. */
  private async saveNow(ch: Channel): Promise<void> {
    window.clearTimeout(ch.saveTimer);
    ch.saveTimer = undefined;
    const run = (ch.saving || Promise.resolve()).then(async () => {
      if (!this.channels.has(ch.id)) return;
      try {
        await store.saveChannel(ch.id, Y.encodeStateAsUpdate(ch.ydoc), ch.meta);
      } catch (e) {
        console.error('[sync] could not persist sync state', e);
        return; // keep the outbox: sending unpersisted changes could duplicate text later
      }
      this.flushOutbox(ch);
    });
    ch.saving = run;
    await run;
    if (ch.saving === run) ch.saving = undefined;
    this.refreshStatus();
  }

  private flushOutbox(ch: Channel) {
    if (!ch.outbox.length || ch.meta.unseeded) return;
    const items = ch.outbox.splice(0);
    this.links.forEach((link, deviceId) => {
      const updates = items.filter(i => i.from !== deviceId).map(i => i.update);
      if (updates.length) link.sendUpdate(ch.id, updates.length === 1 ? updates[0] : Y.mergeUpdates(updates));
    });
  }

  private async flushSaves() {
    await Promise.all(Array.from(this.channels.values()).filter(ch => ch.saveTimer !== undefined || ch.saving).map(ch => this.saveNow(ch)));
  }

  private dropChannel(id: string) {
    const ch = this.channels.get(id);
    if (!ch || id === INDEX) return;
    window.clearTimeout(ch.saveTimer);
    this.channels.delete(id);
    ch.ydoc.destroy();
    void store.deleteChannel(id);
  }

  private isDeleted(id: string) {
    return resolveIndex(this.index.ydoc).get(id)?.alive === false;
  }

  /* ------------------------------------------------------------------ */
  /* Local changes                                                       */
  /* ------------------------------------------------------------------ */

  private onLocalEvent(e: SyncEvent) {
    if (e.type === 'deleted') {
      window.clearTimeout(this.localTimers.get(e.id));
      this.localTimers.delete(e.id);
      if (this.channels.has(e.id) || resolveIndex(this.index.ydoc).has(e.id)) {
        setIndexEntry(this.index.ydoc, e.id, this.cfg.deviceId, false, Date.now());
        this.dropChannel(e.id);
      }
      return;
    }
    if (e.type === 'collabEnded') {
      // after the editor was rebuilt without the session: merged remote changes can be shown now
      window.setTimeout(() => {
        if (this.stopped || !this.channels.get(e.id)?.meta.base) return;
        this.host.flushEditor();
        this.recordLocal(e.id);
        this.materialize(e.id);
      }, 300);
      return;
    }
    window.clearTimeout(this.localTimers.get(e.id));
    this.localTimers.set(
      e.id,
      window.setTimeout(() => {
        this.localTimers.delete(e.id);
        this.recordLocal(e.id);
      }, LOCAL_DEBOUNCE_MS),
    );
  }

  /** Records every local change right away (including edits the store hasn't saved yet). */
  private flushLocal() {
    this.localTimers.forEach(timer => window.clearTimeout(timer));
    this.localTimers.clear();
    for (const doc of this.host.getDocs()) {
      const ch = this.channels.get(doc.id);
      if (ch ? ch.lastHtml !== doc.content || ch.meta.seenModified !== doc.lastModified : !isPristine(doc)) this.recordLocal(doc.id);
    }
  }

  /** Diffs the store's version of a document into its CRDT. */
  private recordLocal(id: string) {
    if (this.stopped) return;
    const doc = this.host.getDoc(id);
    if (!doc) return;
    let ch = this.channels.get(id);
    if (!ch) {
      if (isPristine(doc) || this.isDeleted(id)) return;
      ch = this.createChannel(id);
    }
    if (ch.meta.unseeded || ch.incompatible) return;
    if (ch.lastHtml === doc.content && ch.meta.seenModified === doc.lastModified) return;

    const now = Date.now();
    const device = this.cfg.deviceId;
    // With merged remote changes not shown locally yet, diff against what the local copy was derived from.
    const target = ch.meta.base ? new Y.Doc() : ch.ydoc;
    if (ch.meta.base) Y.applyUpdate(target, ch.meta.base);
    const before = target === ch.ydoc ? null : Y.encodeStateVector(target);
    let changed = false;
    const onUpdate = () => (changed = true);
    target.on('update', onUpdate);
    try {
      if (doc.content !== ch.lastHtml) writeLocalContent(target, htmlToNode(doc.content));
      writeLocalFields(target, doc, device, now);
      if (changed) writeModified(target, device, doc.lastModified);
    } finally {
      target.off('update', onUpdate);
    }
    if (before) {
      if (changed) Y.applyUpdate(ch.ydoc, Y.encodeStateAsUpdate(target, before), LOCAL_ORIGIN);
      ch.meta.base = Y.encodeStateAsUpdate(target);
      target.destroy();
    }
    ch.lastHtml = doc.content;
    ch.meta.seenModified = doc.lastModified;
    if (changed) {
      ch.meta.localEditAt = now;
      if (!resolveIndex(this.index.ydoc).get(id)?.alive) setIndexEntry(this.index.ydoc, id, device, true, now);
    }
    this.scheduleSave(ch);
  }

  /* ------------------------------------------------------------------ */
  /* Remote changes                                                      */
  /* ------------------------------------------------------------------ */

  /** Merges remote updates into a channel and shows the result. */
  private async applyRemote(id: string, updates: Uint8Array[], origin: unknown) {
    if (this.stopped || !updates.length) return;
    if (id === INDEX) {
      this.host.flushEditor();
      this.flushLocal();
      updates.forEach(u => Y.applyUpdate(this.index.ydoc, u, origin));
      await this.saveNow(this.index);
      this.flushLocal();
      this.reconcileIndex();
      return;
    }
    let ch = this.channels.get(id);
    if (!ch) {
      if (this.isDeleted(id)) return;
      ch = this.createChannel(id);
    }
    if (ch.meta.unseeded) {
      updates.forEach(u => Y.applyUpdate(ch!.ydoc, u, origin));
      await this.saveNow(ch);
      this.seed(id);
      return;
    }
    // the merge must see every local edit made so far
    this.host.flushEditor();
    window.clearTimeout(this.localTimers.get(id));
    this.localTimers.delete(id);
    this.recordLocal(id);
    const schema = syncSchema();
    if (!ch.meta.base && (this.mustDefer(id) || ch.incompatible || updates.some(u => unknownTypesInUpdate(u, schema).length))) {
      ch.meta.base = Y.encodeStateAsUpdate(ch.ydoc);
    }
    updates.forEach(u => Y.applyUpdate(ch!.ydoc, u, origin));
    await this.saveNow(ch);
    if (this.stopped || !this.channels.has(id)) return;
    // edits typed while persisting become local changes on top of the merge
    this.host.flushEditor();
    this.recordLocal(id);
    this.materialize(id);
  }

  private mustDefer(id: string) {
    return syncBridge.collabDocId() === id;
  }

  /** Writes the merged state of a document to the store (and the open editor). */
  private materialize(id: string) {
    const ch = this.channels.get(id);
    if (!ch || ch.meta.unseeded || this.isDeleted(id) || this.mustDefer(id)) return;
    const schema = syncSchema();
    const unknown = unknownTypes(ch.ydoc, schema);
    const incompatible = unknown.length > 0;
    if (incompatible !== !!ch.incompatible) {
      ch.incompatible = incompatible;
      this.refreshStatus();
    }
    if (incompatible) {
      console.warn('[sync] document uses features of a newer version, not updated here:', id, unknown);
      return;
    }
    const { fields, modified, empty } = resolveFields(ch.ydoc);
    const node = readContent(ch.ydoc, schema);
    const local = this.host.getDoc(id);
    const done = (html: string, lastModified: number) => {
      ch.lastHtml = html;
      ch.meta.seenModified = lastModified;
      ch.meta.base = undefined;
      this.scheduleSave(ch);
    };

    if (!local) {
      if (!node && empty) return;
      const html = node ? nodeToHtml(node, schema) : '<p></p>';
      const lastModified = modified || Date.now();
      const doc = { title: '', createdAt: lastModified, ...fields, id, content: html, lastModified } as DocumentData;
      this.host.addRemote(doc);
      done(html, lastModified);
      return;
    }

    const record = local as unknown as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (!empty) Object.entries(fields).forEach(([k, v]) => !sameValue(record[k], v) && (patch[k] = v));
    let html = node ? nodeToHtml(node, schema) : null;
    const contentChanged = html !== null && html !== local.content;
    // markdown mode shows `markdownSource`: regenerate it from the merged content
    if (contentChanged && (fields.isMarkdownMode ?? local.isMarkdownMode) && local.markdownSource !== undefined) patch.markdownSource = undefined;
    if (!contentChanged && !Object.keys(patch).length) {
      done(local.content, local.lastModified);
      return;
    }
    const lastModified = Math.max(local.lastModified, modified);
    const editor = contentChanged ? syncBridge.liveEditor(id) : null;
    if (editor && applyToEditor(editor, ch.ydoc)) {
      html = editor.getHTML();
      this.host.applyRemote(id, { ...patch, content: html, lastModified }, { reload: false });
    } else {
      this.host.applyRemote(id, { ...patch, ...(contentChanged ? { content: html! } : {}), lastModified }, { reload: contentChanged });
    }
    done(contentChanged ? html! : local.content, lastModified);
  }

  /** Applies the index: removes deleted documents, adds new ones. */
  private reconcileIndex() {
    const idx = resolveIndex(this.index.ydoc);
    const missing: string[] = [];
    idx.forEach((entry, id) => {
      const local = this.host.getDoc(id);
      const ch = this.channels.get(id);
      if (!entry.alive) {
        if (local && ch && !ch.meta.unseeded && (ch.meta.localEditAt || 0) > entry.t) {
          // edited here after it was deleted elsewhere: keep it (and re-upload it everywhere)
          setIndexEntry(this.index.ydoc, id, this.cfg.deviceId, true, Date.now());
          ch.meta.server = {};
          ch.meta.applied = {};
          ch.meta.dirty = true;
          this.scheduleSave(ch);
          return;
        }
        if (local) this.host.removeRemote(id);
        if (ch) this.dropChannel(id);
      } else if (!local) {
        if (ch && !ch.meta.unseeded) this.materialize(id);
        else if (!ch) missing.push(id);
      }
    });
    if (missing.length) this.links.forEach(l => l.want(missing));
  }

  /**
   * First sync of a document that existed before sync knew it. If another
   * device already has it, the newer copy wins as a whole (there is no common
   * history to merge against); otherwise the local copy seeds the CRDT.
   */
  private seed(id: string) {
    const ch = this.channels.get(id);
    if (!ch?.meta.unseeded) return;
    ch.meta.unseeded = false;
    const local = this.host.getDoc(id);
    const fields = resolveFields(ch.ydoc);
    const hasRemote = contentFragment(ch.ydoc).length > 0 || !fields.empty;
    if (!local || (hasRemote && local.lastModified <= fields.modified)) this.materialize(id);
    else {
      this.host.flushEditor();
      this.recordLocal(id);
    }
    this.scheduleSave(ch, 0);
  }

  private seedAll(except: Set<string> = new Set()) {
    this.channels.forEach(ch => ch.meta.unseeded && !except.has(ch.id) && this.seed(ch.id));
  }

  /* ------------------------------------------------------------------ */
  /* WebDAV                                                              */
  /* ------------------------------------------------------------------ */

  private async webdavCreds(): Promise<WebDavCredentials | null> {
    const w = this.cfg.webdav;
    if (!w?.enabled) return null;
    try {
      return { url: w.url, username: w.username, password: await store.openSecret(w.passwordEnc, 'webdav-password') };
    } catch {
      return null;
    }
  }

  private async setupWebDav() {
    this.webdav = null;
    const creds = await this.webdavCreds();
    if (!creds) {
      setSyncStatus(s => ({ webdav: { ...s.webdav, state: this.cfg.webdav?.enabled ? 'error' : 'off', server: this.cfg.webdav?.url || null } }));
      return;
    }
    if (!this.webdavKey) {
      setSyncStatus(s => ({ webdav: { ...s.webdav, state: 'needsKey', error: 'passphrase', server: creds.url } }));
      return;
    }
    this.webdav = new WebDavSync(creds, this.cfg.webdav!.folder, this.webdavKey, this.webdavHost());
    setSyncStatus(s => ({ webdav: { ...s.webdav, state: 'idle', error: null, server: creds.url } }));
  }

  private webdavHost() {
    return {
      deviceId: this.cfg.deviceId,
      channels: () => Array.from(this.channels.values()),
      channelFor: (id: string) => {
        const ch = this.channels.get(id);
        if (ch) return ch;
        if (id !== INDEX && this.isDeleted(id)) return null;
        return this.createChannel(id);
      },
      applyRemote: (id: string, updates: Uint8Array[]) => this.applyRemote(id, updates, WEBDAV),
      isDeleted: (id: string) => this.isDeleted(id),
      afterDownload: () => this.seedAll(),
      nextSeq: () => {
        this.cfg.seq += 1;
        void store.saveConfig(this.cfg);
        return this.cfg.seq;
      },
      persistMeta: (ch: SyncChannel) => this.scheduleSave(ch as Channel),
    };
  }

  private scheduleWebDav(delay: number) {
    if (!this.webdav) return;
    window.clearTimeout(this.cycleTimer);
    this.cycleTimer = window.setTimeout(() => this.syncWebDav(), delay);
  }

  /** Starts a WebDAV round (or queues one after the running round). */
  syncWebDav(): Promise<void> {
    if (!this.webdav || this.stopped) return Promise.resolve();
    window.clearTimeout(this.cycleTimer);
    if (this.cycleRunning) {
      this.cycleAgain = true;
      return this.cycleRunning;
    }
    const run = async () => {
      do {
        this.cycleAgain = false;
        const client = this.webdav;
        if (!client) break;
        setSyncStatus(s => ({ webdav: { ...s.webdav, state: 'syncing' } }));
        try {
          this.host.flushEditor();
          this.flushLocal();
          await this.flushSaves();
          await client.sync();
          await this.flushSaves();
          setSyncStatus(s => ({ webdav: { ...s.webdav, state: 'idle', error: null, lastSync: Date.now() } }));
        } catch (e) {
          const kind = syncErrorKind(e);
          if (kind === 'unknown') console.error('[sync] WebDAV sync failed', e);
          const offline = kind === 'offline' || kind === 'network';
          setSyncStatus(s => ({ webdav: { ...s.webdav, state: kind === 'passphrase' ? 'needsKey' : offline ? 'offline' : 'error', error: kind } }));
          break;
        }
      } while (this.cycleAgain && !this.stopped);
      this.refreshStatus();
    };
    this.cycleRunning = run().finally(() => (this.cycleRunning = null));
    return this.cycleRunning;
  }

  /** Checks a server + credentials without saving anything. */
  async testWebDav(creds: WebDavCredentials) {
    await testWebDav(creds);
  }

  async enableWebDav(setup: WebDavSetup, opts: { iterations?: number } = {}) {
    const url = normalizeDavUrl(setup.url);
    if (!url) throw new WebDavError('badUrl', 'Invalid server URL');
    const folder = setup.folder.split('/').filter(Boolean).join('/') || 'Penko';
    const creds = { url, username: setup.username, password: setup.password };
    const { key } = await connectWebDav(creds, folder, setup.passphrase, opts);
    const prev = this.cfg.webdav;
    const sameServer = prev && prev.url === url && prev.username === setup.username && prev.folder === folder;
    this.cfg.webdav = { url, username: setup.username, folder, enabled: true, passwordEnc: await store.sealSecret(setup.password, 'webdav-password') };
    await store.saveConfig(this.cfg);
    await store.saveWebDavKey(key);
    this.webdavKey = key;
    if (!sameServer) this.forgetServerState();
    store.setSyncEnabledFlag(true);
    await this.setupWebDav();
    await this.syncWebDav();
  }

  /** Re-enters the passphrase for the configured server (key missing or changed on another device). */
  async unlockWebDav(passphrase: string) {
    const creds = await this.webdavCreds();
    if (!creds || !this.cfg.webdav) throw new WebDavError('auth', 'No server configured');
    const { key } = await connectWebDav(creds, this.cfg.webdav.folder, passphrase);
    await store.saveWebDavKey(key);
    this.webdavKey = key;
    await this.setupWebDav();
    await this.syncWebDav();
  }

  async disableWebDav() {
    this.cfg.webdav = null;
    this.webdav = null;
    this.webdavKey = null;
    await store.saveConfig(this.cfg);
    await store.saveWebDavKey(null);
    this.forgetServerState();
    setSyncStatus({ webdav: { state: 'off', lastSync: null, error: null, server: null } });
    this.refreshStatus();
  }

  private forgetServerState() {
    this.channels.forEach(ch => {
      ch.meta.server = {};
      ch.meta.applied = {};
      ch.meta.dirty = true;
      this.scheduleSave(ch);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Device-to-device                                                    */
  /* ------------------------------------------------------------------ */

  private p2pHandlers(deviceId: string) {
    return {
      announce: () => {
        const out: Record<string, string> = {};
        this.channels.forEach(ch => {
          if (!ch.meta.unseeded && (ch.id === INDEX || !this.isDeleted(ch.id))) out[ch.id] = encodeSV(Y.encodeStateVector(ch.ydoc));
        });
        return out;
      },
      diff: (id: string, sv: Uint8Array | null) => {
        const ch = this.channels.get(id);
        if (!ch || ch.meta.unseeded || (id !== INDEX && this.isDeleted(id))) return null;
        return Y.encodeStateAsUpdate(ch.ydoc, sv || undefined);
      },
      peerChannels: (ids: string[]) => {
        // documents the peer doesn't have can be seeded from the local copy now; the others wait for its data
        this.seedAll(new Set(ids));
      },
      receive: (id: string, update: Uint8Array, from: string) => this.receiveP2P(id, update, from),
      status: (id: string, connected: boolean) => {
        if (connected) this.peerConnected.add(id);
        else this.peerConnected.delete(id);
        const peer = this.cfg.peers.find(p => p.deviceId === id);
        if (peer) {
          peer.lastSeen = Date.now();
          void store.saveConfig(this.cfg);
        }
        this.refreshStatus();
      },
      signaling: (connected: boolean) => {
        if (connected) this.signalingUp.add(deviceId);
        else this.signalingUp.delete(deviceId);
        this.refreshStatus();
      },
      unpaired: (id: string) => void this.removePeer(id, false),
    };
  }

  private async startLink(peer: store.PairedDevice) {
    if (this.links.has(peer.deviceId)) return;
    let secret: string;
    try {
      secret = await store.openSecret(peer.secretEnc, `peer:${peer.deviceId}`);
    } catch {
      console.warn('[sync] cannot read the pairing secret of', peer.name);
      return;
    }
    const link = new PeerLink(peer.deviceId, { id: this.cfg.deviceId, name: this.cfg.deviceName }, this.p2pHandlers(peer.deviceId));
    this.links.set(peer.deviceId, link);
    await link.start(secret);
  }

  private receiveP2P(id: string, update: Uint8Array, from: string) {
    const key = `${from}\u0000${id}`;
    const entry = this.p2pInbox.get(key);
    if (entry) entry.updates.push(update);
    else this.p2pInbox.set(key, { updates: [update], from });
    window.clearTimeout(this.p2pTimer);
    this.p2pTimer = window.setTimeout(() => void this.drainP2P(), 30);
  }

  private async drainP2P() {
    const batch = Array.from(this.p2pInbox.entries());
    this.p2pInbox.clear();
    // the index first: it decides which documents exist
    batch.sort(([a], [b]) => (a.endsWith(`\u0000${INDEX}`) ? -1 : b.endsWith(`\u0000${INDEX}`) ? 1 : 0));
    for (const [key, { updates, from }] of batch) {
      const id = key.slice(key.indexOf('\u0000') + 1);
      if (id !== INDEX && !this.channels.has(id) && this.isDeleted(id)) continue;
      await this.applyRemote(id, updates, { p2p: from } satisfies P2POrigin);
    }
  }

  /** Shows a pairing code on this device; `onPaired` fires once the other device joined. */
  async startPairingHost(handlers: { onPeerJoined: () => void; onPaired: (name: string) => void }): Promise<PairingCode> {
    await this.pairing?.cancel();
    const code = generatePairingCode();
    this.pairing = hostPairing(code, { id: this.cfg.deviceId, name: this.cfg.deviceName }, {
      onPeerJoined: handlers.onPeerJoined,
      onPaired: r => void this.finishPairing(r, 0).then(() => handlers.onPaired(r.peer.name)),
    });
    return code;
  }

  async joinPairing(code: PairingCode, handlers: { onConnected: () => void; onPaired: (name: string) => void }) {
    await this.pairing?.cancel();
    this.pairing = joinPairing(code, { id: this.cfg.deviceId, name: this.cfg.deviceName }, {
      onConnected: handlers.onConnected,
      // join the sync room a moment after the other device, so they don't both dial at once
      onPaired: r => void this.finishPairing(r, 2500).then(() => handlers.onPaired(r.peer.name)),
    });
  }

  async cancelPairing() {
    const p = this.pairing;
    this.pairing = null;
    await p?.cancel();
  }

  private async finishPairing(r: PairingResult, linkDelay: number) {
    const handle = this.pairing;
    this.pairing = null;
    // let the confirmation reach the other device before leaving the room
    window.setTimeout(() => void handle?.cancel(), 1500);
    await this.removePeer(r.peer.id, false);
    const peer: store.PairedDevice = {
      deviceId: r.peer.id,
      name: r.peer.name,
      secretEnc: await store.sealSecret(r.secret, `peer:${r.peer.id}`),
      pairedAt: Date.now(),
      lastSeen: null,
    };
    this.cfg.peers.push(peer);
    await store.saveConfig(this.cfg);
    store.setSyncEnabledFlag(true);
    this.refreshStatus();
    window.setTimeout(() => {
      if (!this.stopped && this.cfg.peers.some(p => p.deviceId === peer.deviceId)) void this.startLink(peer);
    }, linkDelay);
  }

  async renamePeer(deviceId: string, name: string) {
    const peer = this.cfg.peers.find(p => p.deviceId === deviceId);
    const clean = name.trim().slice(0, 60);
    if (!peer || !clean) return;
    peer.name = clean;
    await store.saveConfig(this.cfg);
    this.refreshStatus();
  }

  /** Forgets a paired device (and tells it, if it's online). */
  async removePeer(deviceId: string, notify = true) {
    const link = this.links.get(deviceId);
    this.links.delete(deviceId);
    this.peerConnected.delete(deviceId);
    this.signalingUp.delete(deviceId);
    if (link) await (notify ? link.unpair() : link.destroy());
    const before = this.cfg.peers.length;
    this.cfg.peers = this.cfg.peers.filter(p => p.deviceId !== deviceId);
    if (this.cfg.peers.length !== before) await store.saveConfig(this.cfg);
    this.refreshStatus();
  }

  async setDeviceName(name: string) {
    const clean = name.trim().slice(0, 60);
    if (!clean) return;
    this.cfg.deviceName = clean;
    await store.saveConfig(this.cfg);
    setSyncStatus({ deviceName: clean });
  }

  /* ------------------------------------------------------------------ */
  /* Status                                                              */
  /* ------------------------------------------------------------------ */

  getConfig(): SyncConfig {
    return JSON.parse(JSON.stringify(this.cfg));
  }

  /** Nothing configured any more: the engine can be shut down. */
  isIdle() {
    return !this.cfg.webdav && this.cfg.peers.length === 0;
  }

  private refreshStatus() {
    if (this.stopped || !this.cfg) return;
    let pending = 0;
    let incompatible = 0;
    this.channels.forEach(ch => {
      if (ch.id !== INDEX && ch.meta.dirty && this.webdav) pending++;
      if (ch.incompatible) incompatible++;
    });
    const peers: PeerStatus[] = this.cfg.peers.map(p => ({ deviceId: p.deviceId, name: p.name, connected: this.peerConnected.has(p.deviceId), lastSeen: p.lastSeen }));
    setSyncStatus({ pending, incompatible, p2p: { peers, signalingConnected: this.signalingUp.size > 0 }, deviceName: this.cfg.deviceName });
  }
}

/** Applies the merged content to an open editor as one minimal transaction. */
const applyToEditor = (editor: Editor, ydoc: Y.Doc): boolean => {
  if (editor.isDestroyed) return false;
  try {
    const next = readContent(ydoc, editor.schema);
    if (!next) return false;
    const cur = editor.state.doc;
    const start = cur.content.findDiffStart(next.content);
    if (start == null) return true;
    const end = cur.content.findDiffEnd(next.content);
    if (!end) return true;
    let { a: endA, b: endB } = end;
    const overlap = start - Math.min(endA, endB);
    if (overlap > 0) {
      endA += overlap;
      endB += overlap;
    }
    const tr = editor.state.tr.replace(start, endA, next.slice(start, endB));
    tr.setMeta('addToHistory', false).setMeta('preventTrack', true).setMeta('penkoRemoteSync', true);
    editor.view.dispatch(tr);
    return true;
  } catch (e) {
    console.warn('[sync] could not apply the merge to the open editor, reloading it instead', e);
    return false;
  }
};

const waitForHost = () =>
  new Promise<SyncHost>(resolve => {
    const h = syncBridge.getHost();
    if (h) return resolve(h);
    const off = syncBridge.onHost(() => {
      const next = syncBridge.getHost();
      if (next) {
        off();
        resolve(next);
      }
    });
  });

/* ------------------------------------------------------------------ */
/* Singleton                                                           */
/* ------------------------------------------------------------------ */

let instance: SyncEngine | null = null;
let starting: Promise<SyncEngine> | null = null;

// Handy for debugging and end-to-end tests (dev builds only)
if (import.meta.env.DEV && typeof window !== 'undefined') (window as any).__penkoSync = () => instance;

/** The running engine (null while not started). */
export const getSyncEngine = () => (instance?.started ? instance : null);

/** Starts the engine (once). */
export const ensureSyncEngine = (): Promise<SyncEngine> => {
  if (!starting) {
    const e = new SyncEngine();
    instance = e;
    starting = e.start().then(
      () => e,
      err => {
        if (instance === e) {
          instance = null;
          starting = null;
        }
        throw err;
      },
    );
  }
  return starting;
};

/** Shuts the engine down when nothing is configured any more (it isn't started at the next launch either). */
export const stopSyncIfIdle = async () => {
  if (!instance?.started || !instance.isIdle()) return;
  store.setSyncEnabledFlag(false);
  await shutdownSyncEngine();
};

/** Stops syncing; with `forget`, deletes all local sync data (documents stay). */
export const shutdownSyncEngine = async (forget = false) => {
  const e = instance;
  instance = null;
  starting = null;
  await e?.stop();
  if (forget) await store.clearAllSyncData();
};

export type { PairingCode };
