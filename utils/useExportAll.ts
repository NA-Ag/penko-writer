import { useCallback, useRef } from 'react';
import { useApp } from '../AppContext';
import { t } from './translations';

/**
 * "Back up all documents" (ZIP of every document). Pending editor changes are
 * flushed first so the archive contains the latest text. Shared by the
 * sidebar's export menu and the settings dialog.
 */
export const useExportAll = () => {
  const { documents, flushPendingEdits, toast, uiLanguage } = useApp();
  const latest = useRef(documents);
  latest.current = documents;
  return useCallback(async () => {
    try {
      flushPendingEdits();
      // let the flushed edit re-render so `latest` holds it
      await new Promise(r => setTimeout(r, 0));
      const docs = latest.current;
      const { exportAllDocuments } = await import('./export');
      if (!(await exportAllDocuments(docs))) {
        toast.info(t(uiLanguage, 'exportNothing'));
        return;
      }
      toast.success(t(uiLanguage, 'exportedAll').replace('{count}', String(docs.length)));
    } catch (error) {
      console.error('[Export] Failed to export all documents:', error);
      toast.error(t(uiLanguage, 'rvBackupFailed'));
    }
  }, [flushPendingEdits, toast, uiLanguage]);
};
