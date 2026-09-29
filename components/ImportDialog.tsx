import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { importDocument, validateFileSize, getFileAcceptString, getSupportedExtensions, ImportResult } from '../utils/import';
import { LanguageCode, t } from '../utils/translations';
import { useFocusTrap, useEscapeKey } from '../utils/hooks';
import { useApp } from '../AppContext';
import type { DocumentData } from '../types';
import { useFiles, type OpenSource } from '../state/FilesContext';
import type { FsaFileHandle } from '../utils/files/fileAccess';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Unused: the dialog follows the `dark` class on <html>. */
  darkMode?: boolean;
  uiLanguage?: LanguageCode;
}

/**
 * "Open File": the single entry point for opening documents — .penko files
 * (linked to the file on Chromium) and every importable format. Drag & drop
 * onto the window, recent files and the OS file handler also land here.
 */
const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, uiLanguage = 'en-US' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  /** A .penko file whose document is already in the app: replace, keep both or cancel. */
  const [conflict, setConflict] = useState<{ result: ImportResult; source: OpenSource } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const { documents } = useApp();
  const files = useFiles();
  const { completeOpen, takePendingOpen, pendingOpen } = files;
  const autoImportTimer = useRef<number | null>(null);
  // bumps on close so an import that finishes after the dialog closed is ignored
  const session = useRef(0);

  const cancelAutoImport = useCallback(() => {
    if (autoImportTimer.current !== null) {
      window.clearTimeout(autoImportTimer.current);
      autoImportTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      // closed from outside (e.g. after importing): start fresh next time
      cancelAutoImport();
      session.current++;
      setResult(null);
      setConflict(null);
      setIsProcessing(false);
      setIsDragging(false);
    }
  }, [isOpen, cancelAutoImport]);
  useEffect(() => cancelAutoImport, [cancelAutoImport]);

  // A file handed over by drag & drop / recent files / the OS
  useEffect(() => {
    if (!isOpen || !pendingOpen) return;
    const p = takePendingOpen();
    if (p) void handleFileSelect(p.file, p.handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pendingOpen]);

  const handleFileSelect = async (file: File, handle?: FsaFileHandle) => {
    cancelAutoImport();
    const mySession = session.current;
    setResult(null);
    setConflict(null);
    setIsDragging(false);
    setIsProcessing(true);

    // Validate file size
    const sizeValidation = validateFileSize(file, uiLanguage);
    if (!sizeValidation.valid) {
      setResult({
        success: false,
        title: file.name,
        content: '',
        error: sizeValidation.error,
      });
      setIsProcessing(false);
      return;
    }

    let importResult: ImportResult;
    try {
      importResult = await importDocument(file, uiLanguage);
    } catch (error) {
      console.error('[Import] failed:', error);
      importResult = { success: false, title: file.name, content: '', error: t(uiLanguage, 'importFailed') };
    }
    if (mySession !== session.current) return; // dialog was closed meanwhile
    setResult(importResult);
    setIsProcessing(false);

    const source: OpenSource = { name: file.name, handle };
    // The same document (by id) is already in the app: ask instead of opening
    if (importResult.success && importResult.penko && documents.some(d => d.id === importResult.penko!.doc.id)) {
      setResult(null);
      setConflict({ result: importResult, source });
      return;
    }

    // If successful, auto-import after a brief moment (cancelled if the dialog closes)
    if (importResult.success) {
      autoImportTimer.current = window.setTimeout(() => {
        autoImportTimer.current = null;
        finishOpen(importResult, source, 'new');
      }, 1000);
    }
  };

  const finishOpen = (res: ImportResult, source: OpenSource, mode: 'new' | 'replace' | 'copy') => {
    cancelAutoImport();
    session.current++;
    setResult(null);
    setConflict(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // closes the dialog
    completeOpen(res, source, mode);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /** Chromium: the native picker, so the document stays linked to its file. */
  const browse = async () => {
    if (!files.canOpenInPlace) {
      fileInputRef.current?.click();
      return;
    }
    const picked = await files.pickFile();
    if (picked) void handleFileSelect(picked.file, picked.handle);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // moving over a child element also fires dragleave on the zone
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClose = () => {
    cancelAutoImport();
    session.current++;
    setResult(null);
    setConflict(null);
    setIsProcessing(false);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  useEscapeKey(isOpen, handleClose);

  if (!isOpen) return null;

  const supportedExtensions = getSupportedExtensions();

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
    >
      <div ref={dialogRef} className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 id="import-dialog-title" className="text-xl font-semibold text-gray-900 dark:text-white">
                {t(uiLanguage, 'openFileTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(uiLanguage, 'openFileSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label={t(uiLanguage, 'close')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {conflict ? (
            <ConflictPanel
              uiLanguage={uiLanguage}
              appDoc={documents.find(d => d.id === conflict.result.penko!.doc.id)}
              fileDoc={conflict.result.penko!.doc}
              onReplace={() => finishOpen(conflict.result, conflict.source, 'replace')}
              onKeepBoth={() => finishOpen(conflict.result, conflict.source, 'copy')}
              onCancel={handleClose}
            />
          ) : (
          <>
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && void browse()}
            role="button"
            tabIndex={0}
            aria-label={t(uiLanguage, 'dragDropFile')}
            onKeyDown={(e) => {
              // only when the zone itself has focus (not the "Try again" button inside it)
              if (e.target === e.currentTarget && !isProcessing && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                void browse();
              }
            }}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
              transition-all duration-200
              ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={getFileAcceptString()}
              onChange={handleFileInputChange}
              aria-label={t(uiLanguage, 'chooseFile')}
              className="hidden"
            />

            {isProcessing ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  {t(uiLanguage, 'importing')}
                </p>
              </div>
            ) : result ? (
              <div className="flex flex-col items-center gap-4">
                {result.success ? (
                  <>
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">
                        {t(uiLanguage, 'importSuccessful')}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t(uiLanguage, 'opening')} "{result.title}"...
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-red-600 dark:text-red-400">
                        {t(uiLanguage, 'importFailed')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-md">
                        {result.error}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setResult(null);
                      }}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      {t(uiLanguage, 'tryAgain')}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {isDragging ? t(uiLanguage, 'dropFileHere') : t(uiLanguage, 'dragDropFile')}
                </p>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{t(uiLanguage, 'orClickBrowse')}</p>
                <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
                  {t(uiLanguage, 'chooseFile')}
                </button>
              </>
            )}
          </div>

          {/* Supported Formats */}
          {!isProcessing && !result && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t(uiLanguage, 'supportedFormats')}
              </p>
              <div className="flex flex-wrap gap-2">
                {supportedExtensions.map((ext) => (
                  <span
                    key={ext}
                    className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300"
                  >
                    .{ext}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                {t(uiLanguage, 'maxFileSize')}
              </p>
            </div>
          )}

          {/* Tips */}
          {!isProcessing && !result && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-300 font-medium mb-2">
                💡 {t(uiLanguage, 'tipsForBest')}
              </p>
              <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>{t(uiLanguage, 'useDocxFormat')}</li>
                <li>{t(uiLanguage, 'complexFormatting')}</li>
                <li>{t(uiLanguage, 'imagesEmbedded')}</li>
                <li>{t(uiLanguage, 'tablesPreserved')}</li>
              </ul>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

const ConflictPanel: React.FC<{
  uiLanguage: LanguageCode;
  appDoc: DocumentData | undefined;
  fileDoc: DocumentData;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}> = ({ uiLanguage, appDoc, fileDoc, onReplace, onKeepBoth, onCancel }) => {
  const when = (ms: number | undefined) => (ms ? new Date(ms).toLocaleString(uiLanguage) : '—');
  return (
    <div className="flex flex-col items-center gap-4 text-center py-4" role="alertdialog" aria-labelledby="import-conflict-title" aria-describedby="import-conflict-body">
      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
        <Copy className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <p id="import-conflict-title" className="text-lg font-medium text-gray-900 dark:text-white">
          {t(uiLanguage, 'penkoConflictTitle')}
        </p>
        <p id="import-conflict-body" className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-md">
          {t(uiLanguage, 'penkoConflictBody')
            .replace('{title}', fileDoc.title || appDoc?.title || t(uiLanguage, 'untitledDocument'))
            .replace('{appDate}', when(appDoc?.lastModified))
            .replace('{fileDate}', when(fileDoc.lastModified))}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        <button type="button" onClick={onReplace} data-autofocus className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
          {t(uiLanguage, 'replaceAppCopy')}
        </button>
        <button type="button" onClick={onKeepBoth} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg transition-colors font-medium">
          {t(uiLanguage, 'keepBoth')}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg transition-colors">
          {t(uiLanguage, 'cancel')}
        </button>
      </div>
    </div>
  );
};

export default ImportDialog;
