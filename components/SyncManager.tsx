import React, { useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { syncBridge } from '../utils/sync/bridge';
import { isSyncEnabledFlag } from '../utils/sync/store';

/**
 * Connects the app to the sync engine: tells it which editor shows which
 * document (so merged remote changes go into the open editor without moving
 * the caret) and which document is in a live collaboration session, and
 * starts the engine at startup when sync was set up on this device. The
 * engine itself (yjs, WebDAV, WebRTC) is only downloaded in that case.
 */
export const SyncManager: React.FC = () => {
  const { editor, currentDoc, collabSession, docsLoaded } = useApp();
  const state = useRef({ currentDoc, collabSession });
  state.current = { currentDoc, collabSession };
  // The document an editor instance was created for (the context briefly holds the old editor after a switch).
  const editorDoc = useRef<{ editor: typeof editor; docId: string | null }>({ editor: null, docId: null });
  useEffect(() => {
    editorDoc.current = { editor, docId: editor ? state.current.currentDoc?.id ?? null : null };
  }, [editor]);

  useEffect(() => {
    syncBridge.setLiveEditorLookup(docId => {
      const { editor: ed, docId: edDoc } = editorDoc.current;
      const { currentDoc: doc, collabSession: collab } = state.current;
      if (!ed || ed.isDestroyed || edDoc !== docId || doc?.id !== docId || doc.isMarkdownMode || collab?.docId === docId) return null;
      return ed;
    });
    return () => syncBridge.setLiveEditorLookup(() => null);
  }, []);

  const collabDocId = collabSession?.docId ?? null;
  const prevCollab = useRef<string | null>(null);
  useEffect(() => {
    syncBridge.setCollabDocId(collabDocId);
    const prev = prevCollab.current;
    prevCollab.current = collabDocId;
    if (prev && prev !== collabDocId) syncBridge.emit({ type: 'collabEnded', id: prev });
  }, [collabDocId]);

  useEffect(() => {
    if (!docsLoaded || !isSyncEnabledFlag()) return;
    import('../utils/sync/engine')
      .then(m => m.ensureSyncEngine())
      .catch(e => console.error('[sync] could not start', e));
  }, [docsLoaded]);

  return null;
};
