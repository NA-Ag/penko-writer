import { get, set } from 'idb-keyval';
import { DocumentData, HistorySnapshot } from '../types';
import { getStores, HISTORY_FALLBACK_PREFIX } from './storage';

/**
 * Version history snapshots, stored per document in IndexedDB.
 * Legacy snapshots in localStorage are read (and migrated) on first access.
 */

const LEGACY_PREFIX = HISTORY_FALLBACK_PREFIX;
const OLDER_LEGACY_PREFIX = 'cloudword_history_';
const MAX_SNAPSHOTS = 50;
const MAX_BYTES_PER_DOC = 25 * 1024 * 1024;
const MIN_INTERVAL_MS = 5 * 60 * 1000;
const MIN_CHAR_DIFF = 20;

// Inert parse: no image loads for the document's pictures
const htmlToText = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent || '';

const readLegacy = (docId: string): HistorySnapshot[] => {
  try {
    const raw = localStorage.getItem(LEGACY_PREFIX + docId) ?? localStorage.getItem(OLDER_LEGACY_PREFIX + docId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const loadHistory = async (docId: string): Promise<HistorySnapshot[]> => {
  const { available, historyStore } = await getStores();
  if (!available) return readLegacy(docId);
  try {
    const stored = await get<HistorySnapshot[]>(docId, historyStore!);
    if (stored) return stored;
    const legacy = readLegacy(docId);
    if (legacy.length) await set(docId, legacy, historyStore!);
    return legacy;
  } catch {
    return [];
  }
};

/**
 * Save a snapshot when the document changed meaningfully since the last one:
 * at least MIN_CHAR_DIFF characters of text changed, or any change at all
 * after MIN_INTERVAL_MS. `force` always saves (used before restoring).
 */
/** Snapshot writes per document, run one after another (read-modify-write). */
const queues = new Map<string, Promise<unknown>>();

export const saveSnapshot = (doc: DocumentData, opts: { force?: boolean } = {}): Promise<boolean> => {
  const run = (queues.get(doc.id) || Promise.resolve()).then(() => writeSnapshot(doc, opts));
  const tail = run.catch(() => undefined);
  queues.set(doc.id, tail);
  void tail.then(() => queues.get(doc.id) === tail && queues.delete(doc.id));
  return run;
};

const writeSnapshot = async (doc: DocumentData, opts: { force?: boolean }): Promise<boolean> => {
  const { available, historyStore } = await getStores();
  try {
    let history = await loadHistory(doc.id);
    const last = history[0];
    if (last && last.content === doc.content) return false;
    if (last && !opts.force) {
      const oldText = htmlToText(last.content);
      const newText = htmlToText(doc.content);
      if (oldText === newText && Date.now() - last.timestamp < MIN_INTERVAL_MS) return false;
      const diff = textDiffSize(oldText, newText);
      if (diff < MIN_CHAR_DIFF && Date.now() - last.timestamp < MIN_INTERVAL_MS) return false;
    }
    const snapshot: HistorySnapshot = { timestamp: Date.now(), content: doc.content, title: doc.title };
    history = [snapshot, ...history].slice(0, MAX_SNAPSHOTS);
    // Keep total size bounded (large embedded images)
    let bytes = 0;
    history = history.filter((s, i) => {
      bytes += s.content.length * 2;
      return i === 0 || bytes <= MAX_BYTES_PER_DOC;
    });
    if (available) await set(doc.id, history, historyStore!);
    else localStorage.setItem(LEGACY_PREFIX + doc.id, JSON.stringify(history.slice(0, 10)));
    return true;
  } catch (e) {
    console.error('Failed to save snapshot', e);
    return false;
  }
};

/** Number of characters that differ, ignoring the common prefix/suffix. */
export const textDiffSize = (a: string, b: string): number => {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  return Math.max(endA - start, endB - start);
};
