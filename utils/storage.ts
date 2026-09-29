import { createStore, get, set, del, entries, UseStore } from 'idb-keyval';
import { DocumentData } from '../types';

/**
 * Document persistence.
 *
 * Documents live in IndexedDB (one record per document), which has a far
 * larger quota than localStorage and doesn't require re-serialising every
 * document on each save. Data from the old localStorage format is migrated on
 * first run and the original key is left untouched as a backup.
 *
 * If IndexedDB is unavailable (some private-browsing modes) we fall back to
 * per-document localStorage keys.
 */

const LEGACY_KEY = 'penko_writer_docs';
const OLDER_LEGACY_KEY = 'cloudword_docs';
const MIGRATION_FLAG = 'penko_writer_idb_migrated';
const FALLBACK_PREFIX = 'penko_writer_doc_';
/** Version history in localStorage (fallback / legacy format), see history.ts. */
export const HISTORY_FALLBACK_PREFIX = 'penko_writer_history_';

export class StorageError extends Error {
  quota: boolean;
  constructor(message: string, quota = false) {
    super(message);
    this.name = 'StorageError';
    this.quota = quota;
  }
}

const isQuotaError = (e: any) =>
  !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message)));

let docStore: UseStore | null = null;
let historyStore: UseStore | null = null;
let blobStore: UseStore | null = null;
let idbAvailable: boolean | null = null;

const openStores = async (): Promise<boolean> => {
  if (idbAvailable !== null) return idbAvailable;
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
    docStore = createStore('penko-writer-docs', 'docs');
    historyStore = createStore('penko-writer-history', 'history');
    blobStore = createStore('penko-writer-blobs', 'blobs');
    // Probe: some browsers expose indexedDB but reject opens (private mode)
    await get('__probe__', docStore);
    idbAvailable = true;
  } catch (e) {
    console.warn('[Storage] IndexedDB unavailable, falling back to localStorage', e);
    idbAvailable = false;
  }
  return idbAvailable;
};

export const getStores = async () => {
  await openStores();
  return { available: !!idbAvailable, docStore, historyStore, blobStore };
};

const isValidDoc = (d: any): d is DocumentData => !!d && typeof d === 'object' && typeof d.id === 'string' && typeof d.content === 'string';

export interface LoadResult {
  docs: DocumentData[];
  /** Set when some stored data could not be read. It is never overwritten. */
  error: string | null;
}

/** localStorage can throw on access (storage disabled, Safari private mode). */
const ls = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  keys: (): string[] => {
    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  },
};

const UNREADABLE = 'Some saved documents could not be read.';

const readLegacy = (): { docs: DocumentData[]; error: string | null } => {
  const raw = ls.get(LEGACY_KEY) ?? ls.get(OLDER_LEGACY_KEY);
  if (!raw) return { docs: [], error: null };
  try {
    const parsed = JSON.parse(raw);
    return { docs: Array.isArray(parsed) ? parsed.filter(isValidDoc) : [], error: null };
  } catch (e) {
    // Keep the unreadable data so it can be recovered manually.
    ls.set(`${LEGACY_KEY}_unreadable_backup`, raw);
    return { docs: [], error: 'Some previously saved documents could not be read. A backup of the raw data was kept.' };
  }
};

const loadAllDocumentsRaw = async (): Promise<LoadResult> => {
  const ok = await openStores();
  let error: string | null = null;

  if (!ok) {
    const docs: DocumentData[] = [];
    for (const k of ls.keys()) {
      if (!k.startsWith(FALLBACK_PREFIX)) continue;
      try {
        const d = JSON.parse(ls.get(k) || 'null');
        if (isValidDoc(d)) docs.push(d);
        else error = UNREADABLE;
      } catch {
        error = UNREADABLE;
      }
    }
    if (docs.length === 0) {
      const legacy = readLegacy();
      return { docs: sortDocs(legacy.docs), error: legacy.error ?? error };
    }
    return { docs: sortDocs(docs), error };
  }

  // One-time migration from the old single-key localStorage format. Documents
  // that can't be copied (quota) are still returned from memory, and the
  // migration is retried on the next start.
  const migrated: DocumentData[] = [];
  if (!ls.get(MIGRATION_FLAG)) {
    const legacy = readLegacy();
    error = legacy.error;
    let complete = !legacy.error;
    for (const doc of legacy.docs) {
      try {
        if (!(await get(doc.id, docStore!))) await set(doc.id, doc, docStore!);
      } catch (e) {
        console.warn('[Storage] could not migrate a document', e);
        migrated.push(doc);
        complete = false;
      }
    }
    if (complete) ls.set(MIGRATION_FLAG, String(Date.now()));
  }

  const all = await entries<string, unknown>(docStore!);
  const docs: DocumentData[] = [];
  // A malformed record is skipped (and reported) instead of breaking the load.
  for (const [, d] of all) {
    if (isValidDoc(d)) docs.push(d);
    else error = error ?? UNREADABLE;
  }
  const ids = new Set(docs.map(d => d.id));
  migrated.forEach(d => !ids.has(d.id) && docs.push(d));
  return { docs: sortDocs(docs), error };
};

const sortDocs = (docs: DocumentData[]) => [...docs].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

export const saveDocument = async (doc: DocumentData): Promise<void> => {
  const ok = await openStores();
  try {
    if (ok) await set(doc.id, doc, docStore!);
    else localStorage.setItem(FALLBACK_PREFIX + doc.id, JSON.stringify(doc)); // throws on quota
  } catch (e: any) {
    throw new StorageError(e?.message || 'Could not save document', isQuotaError(e));
  }
};

export const deleteDocument = async (docId: string): Promise<void> => {
  // an unsaved copy in the emergency backup would bring the document back on the next start
  dropFromEmergencyBackup(docId);
  const ok = await openStores();
  if (ok) {
    await del(docId, docStore!);
    await del(docId, historyStore!);
  } else {
    ls.remove(FALLBACK_PREFIX + docId);
    ls.remove(HISTORY_FALLBACK_PREFIX + docId);
  }
};

export const getStorageEstimate = async (): Promise<{ usage: number; quota: number } | null> => {
  try {
    const est = await navigator.storage?.estimate?.();
    if (est && est.quota) return { usage: est.usage || 0, quota: est.quota };
  } catch {
    /* ignore */
  }
  return null;
};

/** Ask the browser not to evict our data under storage pressure. */
export const requestPersistentStorage = async () => {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    /* ignore */
  }
};

export const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const createNewDocument = (): DocumentData => ({
  id: generateId(),
  title: '',
  content: '<p></p>',
  createdAt: Date.now(),
  lastModified: Date.now(),
  pageConfig: {
    size: 'A4',
    orientation: 'portrait',
    margins: 'normal',
    cols: 1,
  },
  language: 'en-US',
});

/* Small binary store (focus-mode audio tracks, etc.) */
export const putBlob = async (key: string, blob: Blob) => {
  const ok = await openStores();
  if (!ok) throw new StorageError('Binary storage unavailable');
  try {
    await set(key, blob, blobStore!);
  } catch (e: any) {
    throw new StorageError(e?.message || 'Could not store file', isQuotaError(e));
  }
};
export const getBlob = async (key: string): Promise<Blob | undefined> => {
  const ok = await openStores();
  return ok ? get(key, blobStore!) : undefined;
};
export const deleteBlob = async (key: string) => {
  const ok = await openStores();
  if (ok) await del(key, blobStore!);
};

/*
 * Emergency backup. IndexedDB writes started while the page is unloading can
 * be aborted, so on pagehide/beforeunload the unsaved documents are also
 * written synchronously to localStorage. On the next load, any backup newer
 * than the IndexedDB copy wins and is written back to IndexedDB.
 */
const EMERGENCY_KEY = 'penko_writer_unsaved_backup';

export const writeEmergencyBackup = (docs: DocumentData[]) => {
  if (!docs.length) return;
  const existing = readEmergencyBackup();
  const map: Record<string, DocumentData> = {};
  existing.forEach(d => (map[d.id] = d));
  docs.forEach(d => (map[d.id] = d));
  if (ls.set(EMERGENCY_KEY, JSON.stringify(Object.values(map)))) return;
  // Quota exceeded (large images): keep what was already backed up (those
  // copies never reached IndexedDB) plus the most recently edited document.
  const latest = [...docs].sort((a, b) => b.lastModified - a.lastModified)[0];
  if (ls.set(EMERGENCY_KEY, JSON.stringify([...existing.filter(d => d.id !== latest.id), latest]))) return;
  ls.set(EMERGENCY_KEY, JSON.stringify([latest]));
};

export const readEmergencyBackup = (): DocumentData[] => {
  try {
    const raw = ls.get(EMERGENCY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidDoc) : [];
  } catch {
    return [];
  }
};

const writeBackupList = (list: DocumentData[]) => {
  if (list.length) ls.set(EMERGENCY_KEY, JSON.stringify(list));
  else ls.remove(EMERGENCY_KEY);
};

/** Drop backup entries that IndexedDB now has (same or newer version). */
export const pruneEmergencyBackup = (saved: DocumentData) => {
  const list = readEmergencyBackup();
  if (!list.length) return;
  const rest = list.filter(d => d.id !== saved.id || d.lastModified > saved.lastModified);
  if (rest.length !== list.length) writeBackupList(rest);
};

const dropFromEmergencyBackup = (docId: string) => {
  const list = readEmergencyBackup();
  if (list.some(d => d.id === docId)) writeBackupList(list.filter(d => d.id !== docId));
};

/**
 * Loads every document. Never rejects: when storage can't be read at all the
 * result is empty with an `error` (the app then starts with a fresh document
 * and the stored data stays untouched).
 */
export const loadAllDocuments = async (): Promise<LoadResult> => {
  let result: LoadResult;
  try {
    result = await loadAllDocumentsRaw();
  } catch (e) {
    console.error('[Storage] could not load documents', e);
    result = { docs: [], error: UNREADABLE };
  }
  const backup = readEmergencyBackup();
  if (!backup.length) return result;
  const byId = new Map(result.docs.map(d => [d.id, d]));
  for (const doc of backup) {
    const stored = byId.get(doc.id);
    if (!stored || doc.lastModified > stored.lastModified) {
      byId.set(doc.id, doc);
      try {
        await saveDocument(doc);
        pruneEmergencyBackup(doc);
      } catch {
        /* keep the backup until a save succeeds */
      }
    } else {
      pruneEmergencyBackup(stored);
    }
  }
  return { ...result, docs: sortDocs(Array.from(byId.values())) };
};
