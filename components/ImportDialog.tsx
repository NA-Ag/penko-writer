import React, { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { importDocument, validateFileSize, getFileAcceptString, getSupportedExtensions, ImportResult } from '../utils/import';
import { LanguageCode, t } from '../utils/translations';
import { useFocusTrap } from '../utils/hooks';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (title: string, content: string) => void;
  darkMode?: boolean;
  uiLanguage?: LanguageCode;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onImport, darkMode = false, uiLanguage = 'en-US' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    setResult(null);
    setIsProcessing(true);

    // Validate file size
    const sizeValidation = validateFileSize(file);
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

    // Import document
    const importResult = await importDocument(file);
    setResult(importResult);
    setIsProcessing(false);

    // If successful, auto-import after a brief moment
    if (importResult.success) {
      setTimeout(() => {
        onImport(importResult.title, importResult.content);
        handleClose();
      }, 1000);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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
    setResult(null);
    setIsProcessing(false);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const supportedExtensions = getSupportedExtensions();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
      <div ref={dialogRef} className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 id="import-dialog-title" className="text-xl font-semibold text-gray-900 dark:text-white">
                {t(uiLanguage, 'importDocument')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(uiLanguage, 'uploadDocument')}
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
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label={t(uiLanguage, 'dragDropFile')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
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
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
