import { createStore, get, set, del, keys, type UseStore } from 'idb-keyval';
import { bytesToBase64, base64ToBytes } from '../base64';
import { decryptString, encryptString, generateKey } from './crypto';

/**
 * Local sync state (IndexedDB database "penko-writer-sync"):
 *   config        SyncConfig (device, WebDAV settings, paired devices)
 *   key:device    non-extractable AES key wrapping the local secrets below
 *   key:webdav    non-extractable AES key derived from the sync passphrase
 *   y:<channel>   Yjs state of a document (or of the index)
 *   m:<channel>   per-channel bookkeeping (what the server has, pending upload…)
 */

export interface PairedDevice {
  deviceId: string;
  name: string;
  /** Pairing secret, encrypted with the device key (base64). */
  secretEnc: string;
  pairedAt: number;
  lastSeen: number | null;
}

export interface WebDavSettings {
  url: string;
  username: string;
  /** App password, encrypted with the device key (base64). */
  passwordEnc: string;
  folder: string;
  enabled: boolean;
}

export interface SyncConfig {
  deviceId: string;
  deviceName: string;
  webdav: WebDavSettings | null;
  peers: PairedDevice[];
  /** Sequence number for this device's update files. */
  seq: number;
}

export interface ChannelMeta {
  /** Local changes not uploaded to WebDAV yet. */
  dirty: boolean;
  /** Per-client clocks the WebDAV server is known to have. */
  server: Record<string, number>;
  /** Server files already merged: name -> etag. */
  applied: Record<string, string>;
  /**
   * Yjs state the local copy of the document was last derived from, kept
   * while merged remote changes could not be shown yet (open in a live
   * collaboration session): local edits are diffed against it, not against
   * the merged state, so they don't undo the remote changes.
   */
  base?: Uint8Array;
  /**
   * The document existed locally before sync knew it: its Yjs state is only
   * created once the other side was asked (seeding it independently on two
   * devices would duplicate the text on the first merge).
   */
  unseeded?: boolean;
  /** When this device last recorded a local change (a deletion elsewhere doesn't win over a later edit). */
  localEditAt?: number;
  /** `lastModified` of the local document when it was last recorded or merged. */
  seenModified?: number;
}

export const emptyMeta = (): ChannelMeta => ({ dirty: false, server: {}, applied: {} });

let store: UseStore | null = null;
const db = () => (store ??= createStore('penko-writer-sync', 'kv'));

export const ENABLED_FLAG = 'penko_writer_sync_enabled';

/** Cheap synchronous check used at startup (avoids loading the engine when sync was never set up). */
export const isSyncEnabledFlag = () => {
  try {
    return localStorage.getItem(ENABLED_FLAG) === '1';
  } catch {
    return false;
  }
};
export const setSyncEnabledFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(ENABLED_FLAG, '1');
    else localStorage.removeItem(ENABLED_FLAG);
  } catch {
    /* ignore */
  }
};

const defaultDeviceName = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
};

export const newDeviceId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : Math.random().toString(36).slice(2, 18);

export const loadConfig = async (): Promise<SyncConfig> => {
  const cfg = await get<SyncConfig>('config', db());
  if (cfg && typeof cfg.deviceId === 'string') return { webdav: null, peers: [], seq: 0, ...cfg };
  const fresh: SyncConfig = { deviceId: newDeviceId(), deviceName: defaultDeviceName(), webdav: null, peers: [], seq: 0 };
  await set('config', fresh, db());
  return fresh;
};

export const saveConfig = (cfg: SyncConfig) => set('config', cfg, db());

/* Keys */

const deviceKey = async (): Promise<CryptoKey> => {
  let key = await get<CryptoKey>('key:device', db());
  if (!key) {
    key = await generateKey();
    await set('key:device', key, db());
  }
  return key;
};

export const sealSecret = async (secret: string, purpose: string) => bytesToBase64(await encryptString(await deviceKey(), secret, purpose));
export const openSecret = async (sealed: string, purpose: string) => decryptString(await deviceKey(), base64ToBytes(sealed), purpose);

export const loadWebDavKey = () => get<CryptoKey>('key:webdav', db());
export const saveWebDavKey = (key: CryptoKey | null) => (key ? set('key:webdav', key, db()) : del('key:webdav', db()));

/* Channels */

export const loadChannel = async (id: string): Promise<{ state: Uint8Array | undefined; meta: ChannelMeta }> => {
  const [state, meta] = await Promise.all([get<Uint8Array>(`y:${id}`, db()), get<ChannelMeta>(`m:${id}`, db())]);
  return { state, meta: { ...emptyMeta(), ...(meta || {}) } };
};

export const saveChannel = (id: string, state: Uint8Array, meta: ChannelMeta) =>
  Promise.all([set(`y:${id}`, state, db()), set(`m:${id}`, meta, db())]);

export const saveMeta = (id: string, meta: ChannelMeta) => set(`m:${id}`, meta, db());

export const deleteChannel = (id: string) => Promise.all([del(`y:${id}`, db()), del(`m:${id}`, db())]);

export const listChannelIds = async (): Promise<string[]> =>
  (await keys(db())).map(String).filter(k => k.startsWith('y:')).map(k => k.slice(2));

/** Forgets everything WebDAV-related for every channel (switching servers / turning WebDAV off). */
export const resetServerState = async () => {
  const ids = await listChannelIds();
  await Promise.all(
    ids.map(async id => {
      const meta = { ...emptyMeta(), ...((await get<ChannelMeta>(`m:${id}`, db())) || {}) };
      await saveMeta(id, { ...meta, dirty: true, server: {}, applied: {} });
    }),
  );
};

/** Removes all local sync data (the documents themselves stay). */
export const clearAllSyncData = async () => {
  const all = await keys(db());
  await Promise.all(all.map(k => del(k, db())));
  setSyncEnabledFlag(false);
};
