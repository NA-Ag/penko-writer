import React, { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { useApp } from '../../AppContext';
import { useFiles } from '../../state/FilesContext';
import { isOpenableName, type FsaFileHandle } from '../../utils/files/fileAccess';
import { t } from '../../utils/translations';

/** A drag that carries files, none of them pictures (pictures are dropped into the document by the editor). */
const isDocumentDrag = (dt: DataTransfer | null) => {
  if (!dt || !Array.from(dt.types).includes('Files')) return false;
  const items = Array.from(dt.items || []);
  return !items.some(i => i.kind === 'file' && i.type.startsWith('image/'));
};

/**
 * Dropping a document anywhere on the window opens it (through the Open
 * dialog). While a file is dragged over the window a hint is shown. Runs in
 * the capture phase so the editor doesn't treat the file as content; picture
 * drops are left to the editor.
 */
export const FileDropOverlay: React.FC = () => {
  const { uiLanguage, darkMode, toast } = useApp();
  const { requestOpen } = useFiles();
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const requestOpenRef = useRef(requestOpen);
  requestOpenRef.current = requestOpen;
  const langRef = useRef(uiLanguage);
  langRef.current = uiLanguage;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    const reset = () => {
      depth.current = 0;
      setActive(false);
    };
    const onEnter = (e: DragEvent) => {
      if (!isDocumentDrag(e.dataTransfer)) return;
      depth.current++;
      setActive(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!isDocumentDrag(e.dataTransfer)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0 || !e.relatedTarget) reset();
    };
    const onOver = (e: DragEvent) => {
      // Files dropped outside the editor would otherwise make the browser navigate to them
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        if (isDocumentDrag(e.dataTransfer)) e.dataTransfer.dropEffect = 'copy';
      }
    };
    const onDrop = (e: DragEvent) => {
      const dt = e.dataTransfer;
      if (!dt || !Array.from(dt.types).includes('Files')) return;
      const files = Array.from(dt.files);
      const doc = files.find(f => !f.type.startsWith('image/'));
      if (!doc) {
        reset();
        return; // pictures: the editor inserts them
      }
      e.preventDefault();
      e.stopPropagation();
      reset();
      if (!isOpenableName(doc.name)) {
        const ext = doc.name.includes('.') ? `.${doc.name.split('.').pop()}` : doc.name;
        toastRef.current.error(t(langRef.current, 'importUnsupportedFormat').replace('{ext}', ext));
        return;
      }
      // Chromium: a handle keeps the document linked to the dropped file
      const item = Array.from(dt.items || []).find(i => i.kind === 'file' && i.getAsFile()?.name === doc.name) as
        | (DataTransferItem & { getAsFileSystemHandle?: () => Promise<FsaFileHandle | null> })
        | undefined;
      const handlePromise = item?.getAsFileSystemHandle?.();
      if (!handlePromise) {
        requestOpenRef.current(doc);
        return;
      }
      void handlePromise.then(
        h => requestOpenRef.current(doc, h && h.kind === 'file' ? h : undefined),
        () => requestOpenRef.current(doc),
      );
    };
    window.addEventListener('dragenter', onEnter, true);
    window.addEventListener('dragleave', onLeave, true);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop, true);
    window.addEventListener('dragend', reset, true);
    return () => {
      window.removeEventListener('dragenter', onEnter, true);
      window.removeEventListener('dragleave', onLeave, true);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop, true);
      window.removeEventListener('dragend', reset, true);
    };
  }, []);

  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center bg-blue-500/10 border-4 border-dashed border-blue-500 rounded-xl" aria-hidden="true" data-testid="file-drop-overlay">
      <div className={`flex flex-col items-center gap-3 px-8 py-6 rounded-2xl shadow-2xl ${darkMode ? 'bg-[#1e1e1e] text-white' : 'bg-white text-gray-900'}`}>
        <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <FileText className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-lg font-semibold">{t(uiLanguage, 'dropToOpen')}</p>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t(uiLanguage, 'dropToOpenHint')}</p>
      </div>
    </div>
  );
};
