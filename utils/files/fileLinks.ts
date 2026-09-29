/**
 * Device-local file bookkeeping, kept in its own IndexedDB database (never in
 * DocumentData, so it isn't synced or written into files):
 *
 * - links: which file on disk a document was opened from / saved to
 *   (Chromium keeps the FileSystemFileHandle; Firefox only the file name).
 * - recent: recently opened / saved files for the Files drawer.
 *
 * Handles are structured-cloneable, so IndexedDB stores them directly. If a
 * value can't be stored (no IndexedDB, or a handle that can't be cloned) it
 * is stored without handles; the caller keeps the live handle in memory.
 */
import { createStore, get, set, del, type UseStore } from 'idb-keyval';
import type { DiskFormat, FsaFileHandle } from './fileAccess';

export interface FileLink {
  docId: string;
  /** File name (with extension). */
  name: string;
  format: DiskFormat;
  /** Chromium: the file itself; absent when the file was downloaded (Firefox / Safari). */
  handle?: FsaFileHandle;
  /** Write to the file automatically after edits (handles only). */
  autoSave: boolean;
  /** When the file was last written / downloaded. */
  savedAt?: number;
  /** The document's `lastModified` at that time (newer = unsaved changes). */
  savedModified?: number;
}

export interface RecentFile {
  id: string;
  name: string;
  handle?: FsaFileHandle;
  /** The in-app document it was opened into / saved from. */
  docId?: string;
  at: number;
  action: 'opened' | 'saved';
}

export const MAX_RECENT = 12;

let store: UseStore | null | undefined;
const getStore = (): UseStore | null => {
  if (store !== undefined) return store;
  try {
    store = typeof indexedDB === 'undefined' ? null : createStore('penko-writer-files', 'kv');
  } catch {
    store = null;
  }
  return store;
};

const LINKS_KEY = 'links';
const RECENT_KEY = 'recent';

const withoutHandle = <T extends { handle?: FsaFileHandle }>(v: T): T => {
  const { handle: _drop, ...rest } = v;
  return rest as T;
};

/** Stores a value; retries without file handles if they can't be cloned. */
const put = async <T extends { handle?: FsaFileHandle }>(key: string, values: T[]) => {
  const s = getStore();
  if (!s) return;
  try {
    await set(key, values, s);
  } catch {
    try {
      await set(key, values.map(withoutHandle), s);
    } catch (e) {
      console.warn('[Files] could not store', key, e);
    }
  }
};

const read = async <T,>(key: string): Promise<T[]> => {
  const s = getStore();
  if (!s) return [];
  try {
    const v = await get(key, s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

const isLink = (v: unknown): v is FileLink => {
  const l = v as FileLink;
  return !!l && typeof l.docId === 'string' && typeof l.name === 'string' && (l.format === 'penko' || l.format === 'docx');
};
const isRecent = (v: unknown): v is RecentFile => {
  const r = v as RecentFile;
  return !!r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.at === 'number';
};

export const loadFileLinks = async (): Promise<Record<string, FileLink>> => {
  const out: Record<string, FileLink> = {};
  (await read<FileLink>(LINKS_KEY)).filter(isLink).forEach(l => (out[l.docId] = { ...l, autoSave: !!l.autoSave && !!l.handle }));
  return out;
};
export const saveFileLinks = (links: Record<string, FileLink>) => put(LINKS_KEY, Object.values(links));

export const loadRecentFiles = async (): Promise<RecentFile[]> => (await read<RecentFile>(RECENT_KEY)).filter(isRecent).sort((a, b) => b.at - a.at).slice(0, MAX_RECENT);
export const saveRecentFiles = (list: RecentFile[]) => put(RECENT_KEY, list);

/** Test helper: forget everything. */
export const clearFileBookkeeping = async () => {
  const s = getStore();
  if (!s) return;
  await Promise.all([del(LINKS_KEY, s), del(RECENT_KEY, s)]);
};

/**
 * Adds an entry at the top of the recent list, replacing an older entry for
 * the same file (same handle, or same name + document when there's no handle).
 */
export const addRecent = async (list: RecentFile[], entry: RecentFile): Promise<RecentFile[]> => {
  const same = async (r: RecentFile) => {
    if (entry.handle && r.handle) {
      try {
        if (entry.handle.isSameEntry) return await entry.handle.isSameEntry(r.handle);
      } catch {
        /* fall through to the name check */
      }
      return entry.handle === r.handle;
    }
    return r.name === entry.name && (r.docId === entry.docId || !r.docId || !entry.docId);
  };
  const keep: RecentFile[] = [];
  for (const r of list) if (!(await same(r))) keep.push(r);
  return [entry, ...keep].slice(0, MAX_RECENT);
};

/** True when the document changed after it was last written to its file. */
export const hasUnsavedFileChanges = (link: FileLink | undefined, lastModified: number | undefined) =>
  !!link && (link.savedModified === undefined || (lastModified ?? 0) > link.savedModified);
