import type { Editor } from '@tiptap/core';
import type { DocumentData } from '../../types';

/**
 * The seam between the document store and the (lazily loaded) sync engine.
 * Kept tiny and dependency-free so the store can import it without pulling
 * yjs & co. into the main bundle.
 */

/** What the sync engine needs from the document store (registered by useDocumentStore). */
export interface SyncHost {
  /** Latest version of every document, including edits that are not rendered/saved yet. */
  getDocs(): DocumentData[];
  getDoc(id: string): DocumentData | null;
  /** Commits the active editor's pending changes to the store (synchronous). */
  flushEditor(): void;
  /**
   * Applies a merged remote version without marking it as a local edit.
   * `reload` bumps the content revision so an open editor reloads the content.
   */
  applyRemote(id: string, patch: Partial<DocumentData>, opts: { reload: boolean }): void;
  /** Adds a document that arrived from another device (not selected). */
  addRemote(doc: DocumentData): void;
  /** Removes a document that was deleted on another device. */
  removeRemote(id: string): void;
}

/**
 * Local changes: `changed` after a document was saved, `deleted` when the user
 * deletes one, `collabEnded` when a live collaboration session on it ended.
 */
export type SyncEvent = { type: 'changed'; id: string } | { type: 'deleted'; id: string } | { type: 'collabEnded'; id: string };

/** The editor currently showing `docId` (null when that document isn't open in a plain editor). */
export type LiveEditorLookup = (docId: string) => Editor | null;

let host: SyncHost | null = null;
let liveEditor: LiveEditorLookup = () => null;
/** Document ids whose editor is bound to a live collaboration session (content handled by that session). */
let collabDocId: string | null = null;
const listeners = new Set<(e: SyncEvent) => void>();
const hostListeners = new Set<() => void>();

export const syncBridge = {
  setHost(h: SyncHost | null) {
    host = h;
    hostListeners.forEach(l => l());
  },
  getHost: () => host,
  onHost(cb: () => void) {
    hostListeners.add(cb);
    return () => void hostListeners.delete(cb);
  },
  emit(e: SyncEvent) {
    listeners.forEach(l => {
      try {
        l(e);
      } catch (err) {
        console.error('[sync] listener failed', err);
      }
    });
  },
  subscribe(cb: (e: SyncEvent) => void) {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  },
  setLiveEditorLookup(fn: LiveEditorLookup) {
    liveEditor = fn;
  },
  liveEditor: (docId: string) => liveEditor(docId),
  setCollabDocId(id: string | null) {
    collabDocId = id;
  },
  collabDocId: () => collabDocId,
};
