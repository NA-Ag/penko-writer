import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { DocumentData, PageConfig, Template } from '../types';
import { loadAllDocuments, saveDocument, deleteDocument, createNewDocument, requestPersistentStorage, StorageError, generateId, writeEmergencyBackup, pruneEmergencyBackup } from '../utils/storage';
import { saveSnapshot } from '../utils/history';
import { LanguageCode, t } from '../utils/translations';
import { prepareHtmlForEditor } from '../editor/sanitize';
import { readLS, writeLS } from '../utils/localPrefs';
import { docReducer } from './documentStore';
import { syncBridge } from '../utils/sync/bridge';
import { readDefaultStyles } from '../utils/paragraphStyles';
import type { AppToast } from './types';

const SAVE_DEBOUNCE_MS = 400;
const SNAPSHOT_DEBOUNCE_MS = 15000;

export interface DocumentStoreDeps {
  /** Commits the active editor's pending changes (set by the Editor). */
  editorFlushRef: React.MutableRefObject<(() => void) | null>;
  toastRef: React.MutableRefObject<AppToast>;
  uiLangRef: React.MutableRefObject<LanguageCode>;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTemplates: React.Dispatch<React.SetStateAction<boolean>>;
  setShowImportDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * All documents, the current one, and everything that changes or persists
 * them: IndexedDB autosave (debounced, flushed on switch / hide / unload with a
 * synchronous emergency backup), version snapshots, create/open/delete.
 */
export const useDocumentStore = (deps: DocumentStoreDeps) => {
  const { editorFlushRef, toastRef, uiLangRef, setIsSidebarOpen, setShowTemplates, setShowImportDialog } = deps;
  const [docState, dispatch] = useReducer(docReducer, { loaded: false, docs: {}, currentId: null, revs: {} });
  const docStateRef = useRef(docState);
  docStateRef.current = docState;

  const currentDoc = docState.currentId ? docState.docs[docState.currentId] || null : null;
  const currentDocRef = useRef(currentDoc);
  currentDocRef.current = currentDoc;

  const documents = useMemo(() => Object.values(docState.docs).sort((a, b) => b.lastModified - a.lastModified), [docState.docs]);

  /* -------------------------- persistence -------------------------- */

  const persisted = useRef<Record<string, DocumentData>>({});
  const saveTimers = useRef<Record<string, number>>({});
  const snapshotTimers = useRef<Record<string, number>>({});
  const storageErrorShown = useRef(false);

  const writeDoc = useCallback(async (doc: DocumentData) => {
    try {
      await saveDocument(doc);
      persisted.current[doc.id] = doc;
      pruneEmergencyBackup(doc);
      storageErrorShown.current = false;
      syncBridge.emit({ type: 'changed', id: doc.id });
    } catch (e) {
      if (!storageErrorShown.current) {
        storageErrorShown.current = true;
        const quota = e instanceof StorageError && e.quota;
        toastRef.current.error(t(uiLangRef.current, quota ? 'storageFullError' : 'saveFailedError'), 8000);
      }
    }
  }, []);

  /**
   * Latest version of each document, updated synchronously on every change
   * (React state lags behind until the next render). Used when flushing on
   * page hide/unload, where there is no next render.
   */
  const liveDocs = useRef<Record<string, DocumentData>>({});

  const flushSaves = useCallback(
    (opts: { unloading?: boolean } = {}) => {
      editorFlushRef.current?.();
      const state = docStateRef.current;
      const ids = new Set([...Object.keys(saveTimers.current), ...Object.keys(liveDocs.current)]);
      const pending: DocumentData[] = [];
      ids.forEach(id => {
        window.clearTimeout(saveTimers.current[id]);
        delete saveTimers.current[id];
        const doc = liveDocs.current[id] || state.docs[id];
        if (doc && persisted.current[id] !== doc) pending.push(doc);
      });
      // IndexedDB writes may be cut off by unload: keep a synchronous copy too
      if (opts.unloading) writeEmergencyBackup(pending);
      pending.forEach(doc => void writeDoc(doc));
    },
    [writeDoc],
  );

  // Load once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { docs, error } = await loadAllDocuments();
      if (cancelled) return;
      docs.forEach(d => (persisted.current[d.id] = d));
      let list = docs;
      if (list.length === 0) {
        const fresh = createNewDocument();
        list = [fresh];
      }
      const lastOpen = readLS('penko_writer_last_doc');
      const currentId = list.find(d => d.id === lastOpen)?.id || list[0].id;
      dispatch({ type: 'load', docs: list, currentId });
      if (error) toastRef.current.warning(t(uiLangRef.current, /backup/.test(error) ? 'storageUnreadableBackup' : 'storageUnreadable'), 10000);
      void requestPersistentStorage();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced save of every changed document
  useEffect(() => {
    if (!docState.loaded) return;
    Object.values(docState.docs).forEach(doc => {
      const live = liveDocs.current[doc.id];
      if (live && doc.lastModified >= live.lastModified) delete liveDocs.current[doc.id];
      if (persisted.current[doc.id] === doc) return;
      window.clearTimeout(saveTimers.current[doc.id]);
      saveTimers.current[doc.id] = window.setTimeout(() => {
        delete saveTimers.current[doc.id];
        const latest = docStateRef.current.docs[doc.id];
        if (latest) void writeDoc(latest);
      }, SAVE_DEBOUNCE_MS);
      // Version snapshots on a slower cadence
      window.clearTimeout(snapshotTimers.current[doc.id]);
      snapshotTimers.current[doc.id] = window.setTimeout(() => {
        const latest = docStateRef.current.docs[doc.id];
        if (latest) void saveSnapshot(latest);
      }, SNAPSHOT_DEBOUNCE_MS);
    });
  }, [docState.docs, docState.loaded, writeDoc]);

  useEffect(() => {
    if (docState.currentId) writeLS('penko_writer_last_doc', docState.currentId);
  }, [docState.currentId]);

  // Never lose edits when the tab is hidden / closed
  useEffect(() => {
    const onHide = () => flushSaves({ unloading: true });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushSaves({ unloading: true });
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flushSaves]);


  /* --------------------------- documents --------------------------- */

  const flushPendingEdits = useCallback(() => {
    editorFlushRef.current?.();
  }, []);

  const updateDoc = useCallback((id: string, patch: Partial<DocumentData> | ((d: DocumentData) => Partial<DocumentData>), opts: { external?: boolean; touch?: boolean } = {}) => {
    const base = liveDocs.current[id] || docStateRef.current.docs[id];
    if (base) {
      const resolved = typeof patch === 'function' ? patch(base) : patch;
      liveDocs.current[id] = { ...base, ...resolved, ...(opts.touch === false ? {} : { lastModified: Date.now() }) };
    }
    dispatch({ type: 'update', id, patch, external: opts.external, touch: opts.touch });
  }, []);

  const updateCurrentDoc = useCallback(
    (patch: Partial<DocumentData> | ((d: DocumentData) => Partial<DocumentData>)) => {
      const id = docStateRef.current.currentId;
      if (id) updateDoc(id, patch);
    },
    [updateDoc],
  );

  const handleCreateDocument = useCallback(
    (data: Partial<DocumentData>, opts: { select?: boolean; keepIdentity?: boolean } = {}) => {
      flushPendingEdits();
      // keepIdentity: a document opened from a .penko file keeps its id and creation date (unless the id is taken)
      const keep = opts.keepIdentity && !!data.id && !docStateRef.current.docs[data.id];
      const doc: DocumentData = { ...createNewDocument(), ...data, id: keep ? data.id! : generateId(), createdAt: keep && data.createdAt ? data.createdAt : Date.now(), lastModified: Date.now() };
      if (doc.content) doc.content = prepareHtmlForEditor(doc.content);
      liveDocs.current[doc.id] = doc;
      dispatch({ type: 'add', doc, select: opts.select });
      setIsSidebarOpen(false);
      return doc;
    },
    [flushPendingEdits],
  );

  // Blank documents start with the user's saved default styles (Styles dialog)
  const handleNewDoc = useCallback(() => {
    const styles = readDefaultStyles();
    return handleCreateDocument(styles ? { styles } : {});
  }, [handleCreateDocument]);

  const removeDocument = useCallback((docId: string) => {
    window.clearTimeout(saveTimers.current[docId]);
    delete saveTimers.current[docId];
    delete persisted.current[docId];
    delete liveDocs.current[docId];
    void deleteDocument(docId);
    const remaining = Object.keys(docStateRef.current.docs).filter(id => id !== docId);
    dispatch({ type: 'delete', id: docId, fallback: remaining.length ? null : createNewDocument() });
  }, []);

  const handleDeleteDocument = useCallback(
    (docId: string) => {
      flushPendingEdits();
      removeDocument(docId);
      syncBridge.emit({ type: 'deleted', id: docId });
    },
    [flushPendingEdits, removeDocument],
  );

  // Device sync (utils/sync, loaded on demand) reads and updates documents through this bridge
  useEffect(() => {
    if (!docState.loaded) return;
    const latest = (id: string) => liveDocs.current[id] || docStateRef.current.docs[id] || null;
    syncBridge.setHost({
      getDocs: () => Array.from(new Set([...Object.keys(docStateRef.current.docs), ...Object.keys(liveDocs.current)])).map(latest).filter((d): d is DocumentData => !!d),
      getDoc: latest,
      flushEditor: () => editorFlushRef.current?.(),
      applyRemote: (id, patch, { reload }) => updateDoc(id, patch, { external: reload, touch: false }),
      addRemote: doc => {
        liveDocs.current[doc.id] = doc;
        dispatch({ type: 'add', doc, select: false });
      },
      removeRemote: removeDocument,
    });
    return () => syncBridge.setHost(null);
  }, [docState.loaded, updateDoc, removeDocument]);

  const handleTemplateSelect = useCallback(
    (template: Template) => {
      handleCreateDocument({
        title: template.name,
        content: template.content,
        ...(template.pageConfig ? { pageConfig: template.pageConfig } : {}),
        ...(template.isScreenplay ? { isScreenplay: true } : {}),
      });
      setShowTemplates(false);
      toastRef.current.success(t(uiLangRef.current, 'templateLoaded').replace('{name}', template.nameKey ? t(uiLangRef.current, template.nameKey) : template.name));
    },
    [handleCreateDocument],
  );

  const handleImportDocument = useCallback(
    (title: string, content: string, extra: Partial<DocumentData> = {}) => {
      handleCreateDocument({ ...extra, title, content });
      setShowImportDialog(false);
      toastRef.current.success(t(uiLangRef.current, 'documentImported'));
    },
    [handleCreateDocument],
  );

  const handleOpenDoc = useCallback(
    (id: string) => {
      if (id !== docStateRef.current.currentId) {
        flushPendingEdits();
        dispatch({ type: 'select', id });
      }
      setIsSidebarOpen(false);
    },
    [flushPendingEdits],
  );

  /**
   * Replaces a document wholesale with another version of it (a .penko file
   * with the same id) and shows it. `fields` lists the document fields the
   * file format carries: those missing from `doc` are cleared, other fields
   * (device / sync state) are kept.
   */
  const handleReplaceDocument = useCallback(
    (doc: DocumentData, fields: readonly string[]) => {
      if (!docStateRef.current.docs[doc.id]) return;
      flushPendingEdits();
      const { id, ...rest } = doc;
      updateDoc(
        id,
        prev => {
          const cleared: Record<string, undefined> = {};
          fields.forEach(k => {
            if (k !== 'id' && k in prev && !(k in rest)) cleared[k] = undefined;
          });
          return { ...cleared, ...rest, content: prepareHtmlForEditor(rest.content) };
        },
        { external: true },
      );
      if (id !== docStateRef.current.currentId) dispatch({ type: 'select', id });
      setIsSidebarOpen(false);
    },
    [flushPendingEdits, updateDoc],
  );

  const handleContentChange = useCallback(
    (html: string, docId?: string) => {
      const id = docId || docStateRef.current.currentId;
      if (!id) return;
      updateDoc(id, { content: prepareHtmlForEditor(html) }, { external: true });
    },
    [updateDoc],
  );

  const handleTitleChange = useCallback((title: string) => updateCurrentDoc({ title }), [updateCurrentDoc]);

  const handlePageConfigChange = useCallback(
    (config: Partial<PageConfig>) =>
      updateCurrentDoc(d => ({ pageConfig: { ...(d.pageConfig || { size: 'A4', orientation: 'portrait', margins: 'normal', cols: 1 }), ...config } })),
    [updateCurrentDoc],
  );

  const handleLanguageChange = useCallback((language: string) => updateCurrentDoc({ language }), [updateCurrentDoc]);

  const handleSaveNow = useCallback(async () => {
    // The flush updates `liveDocs` synchronously, so this is the latest content
    flushPendingEdits();
    const id = docStateRef.current.currentId;
    const doc = id ? liveDocs.current[id] || docStateRef.current.docs[id] : null;
    if (!doc) return;
    window.clearTimeout(saveTimers.current[doc.id]);
    delete saveTimers.current[doc.id];
    await writeDoc(doc);
    if (persisted.current[doc.id] === doc) toastRef.current.success(t(uiLangRef.current, 'documentSaved'));
  }, [flushPendingEdits, writeDoc]);


  return {
    docState,
    docStateRef,
    currentDoc,
    currentDocRef,
    documents,
    flushPendingEdits,
    updateDoc,
    updateCurrentDoc,
    handleCreateDocument,
    handleNewDoc,
    handleDeleteDocument,
    handleTemplateSelect,
    handleImportDocument,
    handleOpenDoc,
    handleReplaceDocument,
    handleContentChange,
    handleTitleChange,
    handlePageConfigChange,
    handleLanguageChange,
    handleSaveNow,
  };
};
