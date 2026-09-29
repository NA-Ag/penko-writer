import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import type { DocumentData } from '../types';
import { t } from '../utils/translations';
import { readLS, writeLS } from '../utils/localPrefs';
import {
  canOpenInPlace,
  canSaveInPlace,
  ensureReadPermission,
  ensureWritePermission,
  formatOfName,
  pickFileToOpen,
  pickFileToSave,
  safeName,
  withExtension,
  writeToHandle,
  type DiskFormat,
  type FsaFileHandle,
} from '../utils/files/fileAccess';
import { addRecent, hasUnsavedFileChanges, loadFileLinks, loadRecentFiles, saveFileLinks, saveRecentFiles, type FileLink, type RecentFile } from '../utils/files/fileLinks';
import type { ParsedPenko } from '../utils/files/penkoFormat';
import { DOCUMENT_FILE_FIELDS } from '../utils/files/documentFields';
import type { ImportResult } from '../utils/import';
import { FileDropOverlay } from '../components/files/FileDropOverlay';
import { SaveAsDialog } from '../components/files/SaveAsDialog';

/**
 * Files on disk: opening (.penko + every importable format), saving to a
 * file (in place on Chromium, as a download elsewhere), the link between a
 * document and its file, auto-save to that file and the recent-files list.
 *
 * Opening always goes through the Import dialog (the single entry point that
 * shows progress, errors and the "already in the app" choice); drag & drop,
 * recent files and the installed-app file handler hand it the file via
 * `requestOpen`.
 */

const AUTOSAVE_DEBOUNCE_MS = 1500;
const DOWNLOAD_EXPLAINED_KEY = 'penko_writer_download_save_explained';

export type FileStatus = 'saving' | 'permission' | 'error';

export interface OpenSource {
  name: string;
  handle?: FsaFileHandle;
}

export interface PendingOpen extends OpenSource {
  id: number;
  file: File;
}

interface FilesContextValue {
  /** Chromium: files are written in place through handles. */
  canSaveInPlace: boolean;
  canOpenInPlace: boolean;
  links: Record<string, FileLink>;
  currentLink: FileLink | null;
  /** Whether the current document changed since it was last written to its file. */
  currentDirty: boolean;
  status: Record<string, FileStatus | undefined>;
  recent: RecentFile[];
  /** Shows the Open dialog. */
  openFile: () => void;
  /** Native open picker (Chromium); null when cancelled or unsupported. */
  pickFile: () => Promise<{ file: File; handle: FsaFileHandle } | null>;
  /** Opens a file through the Open dialog (drag & drop, recent files, OS file handler). */
  requestOpen: (file: File, handle?: FsaFileHandle) => void;
  pendingOpen: PendingOpen | null;
  takePendingOpen: () => PendingOpen | null;
  /** Adds a successfully read file to the app. Returns the new / replaced document id. */
  completeOpen: (result: ImportResult, source: OpenSource, mode?: 'new' | 'replace' | 'copy') => string | null;
  /** Save to the linked file (asks where the first time). */
  saveToFile: () => Promise<void>;
  /** Always asks for a location / name. */
  saveAs: () => Promise<void>;
  /** Firefox / Safari: download with this name and format (the Save As dialog). */
  downloadAs: (name: string, format: DiskFormat) => Promise<void>;
  showSaveAsDialog: boolean;
  setShowSaveAsDialog: (v: boolean) => void;
  /** Whether the "can't write files in place" note still needs showing. */
  downloadExplained: boolean;
  setAutoSave: (docId: string, on: boolean) => void;
  unlink: (docId: string) => void;
  openRecent: (entry: RecentFile) => Promise<void>;
  removeRecent: (id: string) => void;
}

const FilesContext = createContext<FilesContextValue | undefined>(undefined);

export const useFiles = () => {
  const ctx = useContext(FilesContext);
  if (!ctx) throw new Error('useFiles must be used within a FilesProvider');
  return ctx;
};

const recentId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const FilesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = useApp();
  const { documents, docsLoaded, currentDoc, editor, flushPendingEdits, toast, uiLanguage, setShowImportDialog, handleCreateDocument, handleReplaceDocument, handleOpenDoc, showFocusMode } = app;

  const [links, setLinks] = useState<Record<string, FileLink>>({});
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [status, setStatus] = useState<Record<string, FileStatus | undefined>>({});
  const [pendingOpen, setPendingOpen] = useState<PendingOpen | null>(null);
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [downloadExplained, setDownloadExplained] = useState(() => readLS(DOWNLOAD_EXPLAINED_KEY) === 'true');
  const inPlace = canSaveInPlace();

  // Refs so async work (auto-save timers, pickers) always sees the latest state
  const linksRef = useRef(links);
  linksRef.current = links;
  const recentRef = useRef(recent);
  recentRef.current = recent;
  const docsRef = useRef(documents);
  docsRef.current = documents;
  const currentDocRef = useRef(currentDoc);
  currentDocRef.current = currentDoc;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const langRef = useRef(uiLanguage);
  langRef.current = uiLanguage;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const loaded = useRef(false);
  const pendingId = useRef(0);

  /* ------------------------- bookkeeping ------------------------- */

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadFileLinks(), loadRecentFiles()]).then(([l, r]) => {
      if (cancelled) return;
      loaded.current = true;
      // merge with anything recorded before loading finished
      setLinks(prev => ({ ...l, ...prev }));
      setRecent(prev => [...prev, ...r.filter(e => !prev.some(p => p.id === e.id))]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateLinks = useCallback((fn: (prev: Record<string, FileLink>) => Record<string, FileLink>) => {
    const next = fn(linksRef.current);
    linksRef.current = next;
    setLinks(next);
    void saveFileLinks(next);
  }, []);

  const setLink = useCallback((link: FileLink) => updateLinks(prev => ({ ...prev, [link.docId]: link })), [updateLinks]);

  const remember = useCallback(async (entry: Omit<RecentFile, 'id' | 'at'>) => {
    const next = await addRecent(recentRef.current, { ...entry, id: recentId(), at: Date.now() });
    recentRef.current = next;
    setRecent(next);
    void saveRecentFiles(next);
  }, []);

  const removeRecent = useCallback((id: string) => {
    const next = recentRef.current.filter(r => r.id !== id);
    recentRef.current = next;
    setRecent(next);
    void saveRecentFiles(next);
  }, []);

  // Deleted documents lose their link (the file itself is untouched)
  useEffect(() => {
    if (!loaded.current || !docsLoaded) return;
    const ids = new Set(documents.map(d => d.id));
    const stale = Object.keys(linksRef.current).filter(id => !ids.has(id));
    if (stale.length)
      updateLinks(prev => {
        const next = { ...prev };
        stale.forEach(id => delete next[id]);
        return next;
      });
  }, [documents, docsLoaded, updateLinks]);

  const setDocStatus = useCallback((docId: string, s: FileStatus | undefined) => setStatus(prev => (prev[docId] === s ? prev : { ...prev, [docId]: s })), []);

  /* ---------------------------- opening ---------------------------- */

  const openFile = useCallback(() => setShowImportDialog(true), [setShowImportDialog]);

  const pickFile = useCallback(async () => {
    try {
      return await pickFileToOpen();
    } catch (e) {
      console.error('[Files] open picker failed', e);
      toastRef.current.error(t(langRef.current, 'importFailed'));
      return null;
    }
  }, []);

  const requestOpen = useCallback(
    (file: File, handle?: FsaFileHandle) => {
      setPendingOpen({ id: ++pendingId.current, file, handle, name: file.name });
      setShowImportDialog(true);
    },
    [setShowImportDialog],
  );

  const pendingOpenRef = useRef(pendingOpen);
  pendingOpenRef.current = pendingOpen;
  const takePendingOpen = useCallback(() => {
    const p = pendingOpenRef.current;
    if (p) setPendingOpen(null);
    pendingOpenRef.current = null;
    return p;
  }, []);

  /** Documents just opened from a file, waiting for their "saved" baseline (see below). */
  const settleRef = useRef(new Set<string>());

  const completeOpen = useCallback(
    (result: ImportResult, source: OpenSource, mode: 'new' | 'replace' | 'copy' = 'new'): string | null => {
      const lang = langRef.current;
      const penko: ParsedPenko | undefined = result.penko;
      let docId: string;
      if (penko) {
        if (mode === 'replace') {
          handleReplaceDocument(penko.doc, DOCUMENT_FILE_FIELDS);
          docId = penko.doc.id;
        } else {
          docId = handleCreateDocument(penko.doc, { keepIdentity: mode === 'new' }).id;
        }
      } else {
        docId = handleCreateDocument({ ...result.extra, title: result.title, content: result.content }).id;
      }
      setShowImportDialog(false);
      toastRef.current.success(penko ? t(lang, 'fileOpened').replace('{name}', source.name) : t(lang, 'documentImported'));
      if (result.warning) toastRef.current.warning(result.warning, 8000);

      // Link the document to its file so "Save to file" goes back there
      const format = formatOfName(source.name);
      if (format) {
        const previous = linksRef.current[docId];
        setLink({
          docId,
          name: source.name,
          format,
          handle: source.handle,
          autoSave: !!source.handle && !!previous?.autoSave && previous.handle === source.handle,
          savedAt: Date.now(),
          // the new copy matches the file until it is edited
          savedModified: Number.MAX_SAFE_INTEGER,
        });
        settleRef.current.add(docId);
      }
      void remember({ name: source.name, handle: source.handle, docId, action: 'opened' });
      return docId;
    },
    [handleCreateDocument, handleReplaceDocument, remember, setLink, setShowImportDialog],
  );

  /**
   * A freshly opened document is "saved" until the user edits it. The editor
   * may normalise the content once when it loads it (which bumps
   * lastModified), so the baseline is taken once the document has settled.
   */
  useEffect(() => {
    if (!settleRef.current.size) return;
    const timer = window.setTimeout(() => {
      settleRef.current.forEach(docId => {
        const doc = docsRef.current.find(d => d.id === docId);
        const link = linksRef.current[docId];
        if (doc && link && link.savedModified === Number.MAX_SAFE_INTEGER) setLink({ ...link, savedModified: doc.lastModified });
      });
      settleRef.current.clear();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [documents, setLink]);

  // Installed app (Chromium): .penko files opened from the OS
  useEffect(() => {
    const lq = (window as unknown as { launchQueue?: { setConsumer: (fn: (p: { files?: FsaFileHandle[] }) => void) => void } }).launchQueue;
    if (!lq) return;
    lq.setConsumer(async params => {
      const handle = params.files?.[0];
      if (!handle) return;
      try {
        requestOpen(await handle.getFile(), handle);
      } catch (e) {
        console.error('[Files] launch file unreadable', e);
      }
    });
  }, [requestOpen]);

  /* ---------------------------- saving ---------------------------- */

  /** The current document with the editor's latest content. */
  const latestCurrentDoc = useCallback(async (): Promise<DocumentData | null> => {
    flushPendingEdits();
    await new Promise(r => setTimeout(r, 0));
    const doc = currentDocRef.current;
    if (!doc) return null;
    const ed = editorRef.current;
    return ed && !ed.isDestroyed && !doc.isMarkdownMode ? { ...doc, content: ed.getHTML() } : doc;
  }, [flushPendingEdits]);

  const buildBlob = useCallback(async (doc: DocumentData, format: DiskFormat): Promise<Blob> => {
    if (format === 'penko') {
      const { serializePenko } = await import('../utils/files/penkoFormat');
      return serializePenko(doc);
    }
    const { buildDocxBlob } = await import('../utils/docxExport');
    const lang = langRef.current;
    return buildDocxBlob(doc, { endnotes: t(lang, 'endnotes'), pageOf: t(lang, 'pageXofY') });
  }, []);

  /** Writes are serialised per document (auto-save and a manual save can overlap). */
  const writing = useRef<Record<string, Promise<unknown>>>({});

  /** Writes `doc` to its linked handle. `interactive`: inside a user gesture (may ask for permission, shows toasts). */
  const writeLinked = useCallback(
    (doc: DocumentData, link: FileLink & { handle: FsaFileHandle }, interactive: boolean, savedModified: number): Promise<boolean> => {
      const run = async () => {
        const lang = langRef.current;
        if (!(await ensureWritePermission(link.handle, interactive))) {
          setDocStatus(doc.id, 'permission');
          if (interactive) toastRef.current.error(t(lang, 'fileSaveFailed').replace('{name}', link.name));
          return false;
        }
        setDocStatus(doc.id, 'saving');
        try {
          await writeToHandle(link.handle, await buildBlob(doc, link.format));
        } catch (e) {
          console.error('[Files] save failed', e);
          setDocStatus(doc.id, 'error');
          toastRef.current.error(t(lang, 'fileSaveFailed').replace('{name}', link.name));
          return false;
        }
        const latest = linksRef.current[doc.id];
        // unlinked or re-linked meanwhile: don't resurrect the old link
        if (latest && latest.handle === link.handle) setLink({ ...latest, savedAt: Date.now(), savedModified });
        setDocStatus(doc.id, undefined);
        if (interactive) toastRef.current.success(t(lang, 'fileSavedToast').replace('{name}', link.name));
        return true;
      };
      const prev = writing.current[doc.id] || Promise.resolve();
      const next = prev.then(run, run);
      writing.current[doc.id] = next;
      return next;
    },
    [buildBlob, setDocStatus, setLink],
  );

  const downloadAs = useCallback(
    async (name: string, format: DiskFormat) => {
      const doc = await latestCurrentDoc();
      if (!doc) return;
      const lang = langRef.current;
      const fileName = withExtension(name, format);
      const savedModified = Date.now();
      try {
        const [{ downloadBlob }, blob] = await Promise.all([import('../utils/export'), buildBlob(doc, format)]);
        downloadBlob(blob, fileName);
      } catch (e) {
        console.error('[Files] download failed', e);
        toastRef.current.error(t(lang, 'exportFailed'));
        return;
      }
      setLink({ docId: doc.id, name: fileName, format, autoSave: false, savedAt: Date.now(), savedModified });
      void remember({ name: fileName, docId: doc.id, action: 'saved' });
      toastRef.current.success(t(lang, 'fileDownloadedToast').replace('{name}', fileName));
      if (!downloadExplained) {
        setDownloadExplained(true);
        writeLS(DOWNLOAD_EXPLAINED_KEY, 'true');
      }
    },
    [buildBlob, downloadExplained, latestCurrentDoc, remember, setLink],
  );

  const saveAs = useCallback(async () => {
    const doc = currentDocRef.current;
    if (!doc) return;
    if (!inPlace) {
      setShowSaveAsDialog(true);
      return;
    }
    const link = linksRef.current[doc.id];
    const suggested = link?.name || withExtension(safeName(doc.title, t(langRef.current, 'untitledDocument')), link?.format || 'penko');
    let handle: FsaFileHandle | null;
    try {
      handle = await pickFileToSave(suggested, link?.format || 'penko');
    } catch (e) {
      console.error('[Files] save picker failed', e);
      toastRef.current.error(t(langRef.current, 'fileSaveFailed').replace('{name}', suggested));
      return;
    }
    if (!handle) return;
    const format = formatOfName(handle.name) || 'penko';
    const latest = await latestCurrentDoc();
    if (!latest) return;
    const savedModified = Date.now();
    const newLink = { docId: latest.id, name: handle.name, format, handle, autoSave: false, savedAt: link?.savedAt, savedModified: link?.savedModified };
    setLink(newLink);
    if (await writeLinked(latest, newLink, true, savedModified)) void remember({ name: handle.name, handle, docId: latest.id, action: 'saved' });
  }, [inPlace, latestCurrentDoc, remember, setLink, writeLinked]);

  const saveToFile = useCallback(async () => {
    const doc = currentDocRef.current;
    if (!doc) return;
    const link = linksRef.current[doc.id];
    if (link?.handle && inPlace) {
      const latest = await latestCurrentDoc();
      if (!latest) return;
      const savedModified = Date.now();
      if (await writeLinked(latest, { ...link, handle: link.handle }, true, savedModified)) void remember({ name: link.name, handle: link.handle, docId: doc.id, action: 'saved' });
      return;
    }
    // Downloads: once a name was chosen, "Save" downloads again under it
    if (link && !inPlace && downloadExplained) return downloadAs(link.name, link.format);
    return saveAs();
  }, [downloadAs, downloadExplained, inPlace, latestCurrentDoc, remember, saveAs, writeLinked]);

  const setAutoSave = useCallback(
    (docId: string, on: boolean) => {
      const link = linksRef.current[docId];
      if (!link?.handle) return;
      setLink({ ...link, autoSave: on });
      // turning it on is a user gesture: ask for permission now, not in the background
      if (on) void ensureWritePermission(link.handle, true).then(ok => setDocStatus(docId, ok ? undefined : 'permission'));
    },
    [setDocStatus, setLink],
  );

  const unlink = useCallback(
    (docId: string) => {
      updateLinks(prev => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
      setDocStatus(docId, undefined);
    },
    [setDocStatus, updateLinks],
  );

  // Auto-save: write linked documents a moment after they change
  const autoTimers = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!inPlace) return;
    for (const doc of documents) {
      const link = links[doc.id];
      if (!link?.autoSave || !link.handle || !hasUnsavedFileChanges(link, doc.lastModified) || status[doc.id] === 'permission') continue;
      window.clearTimeout(autoTimers.current[doc.id]);
      autoTimers.current[doc.id] = window.setTimeout(() => {
        delete autoTimers.current[doc.id];
        const latest = docsRef.current.find(d => d.id === doc.id);
        const l = linksRef.current[doc.id];
        if (latest && l?.autoSave && l.handle) void writeLinked(latest, { ...l, handle: l.handle }, false, latest.lastModified);
      }, AUTOSAVE_DEBOUNCE_MS);
    }
  }, [documents, links, inPlace, status, writeLinked]);
  useEffect(() => () => Object.values(autoTimers.current).forEach(id => window.clearTimeout(id)), []);

  /* ------------------------- recent files ------------------------- */

  const openRecent = useCallback(
    async (entry: RecentFile) => {
      const lang = langRef.current;
      if (entry.handle) {
        try {
          if (await ensureReadPermission(entry.handle)) {
            requestOpen(await entry.handle.getFile(), entry.handle);
            return;
          }
        } catch (e) {
          console.warn('[Files] recent file unavailable', e);
        }
        // moved / deleted / permission refused: fall back to the in-app copy
      }
      if (entry.docId && docsRef.current.some(d => d.id === entry.docId)) {
        handleOpenDoc(entry.docId);
        return;
      }
      toastRef.current.info(t(lang, 'recentFileUnavailable').replace('{name}', entry.name), 6000);
    },
    [handleOpenDoc, requestOpen],
  );

  /* ------------------------ keyboard shortcuts ------------------------ */

  const saveToFileRef = useRef(saveToFile);
  saveToFileRef.current = saveToFile;
  const saveAsRef = useRef(saveAs);
  saveAsRef.current = saveAs;
  const showFocusModeRef = useRef(showFocusMode);
  showFocusModeRef.current = showFocusMode;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Alt+S / ⌘⌥S: save to file, with Shift: save as. (Ctrl+Shift+S is strikethrough.)
      // e.code on macOS, where ⌥ changes e.key; e.key elsewhere so AltGr+S (ś…) isn't caught.
      const isS = e.metaKey ? e.code === 'KeyS' : e.key.toLowerCase() === 's';
      if (!(e.ctrlKey || e.metaKey) || !e.altKey || !isS || e.repeat) return;
      e.preventDefault();
      if (showFocusModeRef.current) return;
      void (e.shiftKey ? saveAsRef.current() : saveToFileRef.current());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentLink = currentDoc ? links[currentDoc.id] || null : null;
  const value = useMemo<FilesContextValue>(
    () => ({
      canSaveInPlace: inPlace,
      canOpenInPlace: canOpenInPlace(),
      links,
      currentLink,
      currentDirty: hasUnsavedFileChanges(currentLink || undefined, currentDoc?.lastModified),
      status,
      recent,
      openFile,
      pickFile,
      requestOpen,
      pendingOpen,
      takePendingOpen,
      completeOpen,
      saveToFile,
      saveAs,
      downloadAs,
      showSaveAsDialog,
      setShowSaveAsDialog,
      downloadExplained,
      setAutoSave,
      unlink,
      openRecent,
      removeRecent,
    }),
    [inPlace, links, currentLink, currentDoc?.lastModified, status, recent, openFile, pickFile, requestOpen, pendingOpen, takePendingOpen, completeOpen, saveToFile, saveAs, downloadAs, showSaveAsDialog, downloadExplained, setAutoSave, unlink, openRecent, removeRecent],
  );

  return (
    <FilesContext.Provider value={value}>
      {children}
      <FileDropOverlay />
      <SaveAsDialog />
    </FilesContext.Provider>
  );
};
