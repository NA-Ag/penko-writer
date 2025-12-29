
import React, { useEffect, useState } from 'react';
import { X, RotateCcw, Clock, Eye, GitCompare, Check, XCircle, GitMerge } from 'lucide-react';
import { HistorySnapshot } from '../types';
import { loadHistory } from '../utils/history';
import { useFocusTrap } from '../utils/hooks';
import { t, LanguageCode } from '../utils/translations';

interface HistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  onRestore: (content: string) => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
  currentContent: string;
}

export const HistoryDialog: React.FC<HistoryDialogProps> = ({ isOpen, onClose, docId, onRestore, darkMode, uiLanguage, currentContent }) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<HistorySnapshot | null>(null);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [mergedContent, setMergedContent] = useState<string>('');
  const [acceptedChanges, setAcceptedChanges] = useState<Set<number>>(new Set());
  const [rejectedChanges, setRejectedChanges] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen && docId) {
      setHistory(loadHistory(docId));
      setPreviewSnapshot(null);
      setAcceptedChanges(new Set());
      setRejectedChanges(new Set());
      setViewMode('unified');
    }
  }, [isOpen, docId]);

  // Accept a specific change
  const acceptChange = (idx: number) => {
    const newAccepted = new Set(acceptedChanges);
    newAccepted.add(idx);
    setAcceptedChanges(newAccepted);

    // Remove from rejected if it was there
    const newRejected = new Set(rejectedChanges);
    newRejected.delete(idx);
    setRejectedChanges(newRejected);
  };

  // Reject a specific change
  const rejectChange = (idx: number) => {
    const newRejected = new Set(rejectedChanges);
    newRejected.add(idx);
    setRejectedChanges(newRejected);

    // Remove from accepted if it was there
    const newAccepted = new Set(acceptedChanges);
    newAccepted.delete(idx);
    setAcceptedChanges(newAccepted);
  };

  // Apply accepted/rejected changes to create merged content
  const applyMerge = () => {
    if (!previewSnapshot) return;

    const diff = generateDiff(previewSnapshot.content, currentContent);
    const stripHTML = (html: string) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || '';
    };

    const oldLines = stripHTML(previewSnapshot.content).split('\n');
    const newLines = stripHTML(currentContent).split('\n');
    const resultLines: string[] = [];

    let changeIdx = 0;
    diff.forEach((line, idx) => {
      if (line.type === 'unchanged') {
        resultLines.push(line.text);
      } else if (line.type === 'removed') {
        // If rejected or not decided, keep the removed line
        if (rejectedChanges.has(changeIdx) || !acceptedChanges.has(changeIdx)) {
          resultLines.push(line.text);
        }
        changeIdx++;
      } else if (line.type === 'added') {
        // If accepted or not decided, keep the added line
        if (acceptedChanges.has(changeIdx) || !rejectedChanges.has(changeIdx)) {
          resultLines.push(line.text);
        }
        changeIdx++;
      }
    });

    const merged = resultLines.join('\n');
    setMergedContent(merged);
    onRestore(merged);
    onClose();
  };

  // Simple text diff function
  const generateDiff = (oldText: string, newText: string) => {
    // Strip HTML tags for comparison
    const stripHTML = (html: string) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || '';
    };

    const oldLines = stripHTML(oldText).split('\n');
    const newLines = stripHTML(newText).split('\n');
    const diff: Array<{ type: 'removed' | 'added' | 'unchanged'; text: string }> = [];

    // Simple line-by-line diff
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (oldLine === newLine && oldLine) {
        diff.push({ type: 'unchanged', text: oldLine });
      } else {
        if (oldLine && !newLines.includes(oldLine)) {
          diff.push({ type: 'removed', text: oldLine });
        }
        if (newLine && !oldLines.includes(newLine)) {
          diff.push({ type: 'added', text: newLine });
        }
      }
    }

    return diff;
  };

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#222] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const itemHover = darkMode ? 'hover:bg-[#333]' : 'hover:bg-gray-50';
  const border = darkMode ? 'border-gray-700' : 'border-gray-200';

  // If preview mode, show diff view
  if (previewSnapshot) {
    const diff = generateDiff(previewSnapshot.content, currentContent);
    const hasChanges = diff.some(line => line.type !== 'unchanged');

    const stripHTML = (html: string) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.textContent || '';
    };

    const oldLines = stripHTML(previewSnapshot.content).split('\n');
    const newLines = stripHTML(currentContent).split('\n');

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
        <div ref={dialogRef} className={`w-[95vw] max-w-[1400px] h-[90vh] rounded-lg shadow-2xl border flex flex-col relative ${bg}`}>
          <div className={`p-4 border-b flex justify-between items-center ${border}`}>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Eye size={20} className="text-blue-500" />
              {t(uiLanguage, 'versionComparison')}
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 border rounded p-1">
                <button
                  onClick={() => setViewMode('unified')}
                  className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${viewMode === 'unified' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  title={t(uiLanguage, 'unifiedView')}
                >
                  <Eye size={12} /> {t(uiLanguage, 'unified')}
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${viewMode === 'split' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  title={t(uiLanguage, 'sideBySideView')}
                >
                  <GitCompare size={12} /> {t(uiLanguage, 'sideBySide')}
                </button>
              </div>
              <button onClick={() => setPreviewSnapshot(null)} className="opacity-50 hover:opacity-100"><X size={20} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!hasChanges ? (
              <div className="text-center opacity-50 mt-20">
                <p className="text-lg mb-2">{t(uiLanguage, 'noChanges')}</p>
                <p className="text-sm">{t(uiLanguage, 'versionsIdentical')}</p>
              </div>
            ) : viewMode === 'unified' ? (
              <div className="font-mono text-sm space-y-1">
                <div className="mb-4 text-xs opacity-60 flex gap-4">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-red-500/20 border border-red-500/50"></span>
                    {t(uiLanguage, 'removedLines')}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-green-500/20 border border-green-500/50"></span>
                    {t(uiLanguage, 'addedLines')}
                  </span>
                </div>
                {diff.map((line, idx) => {
                  const isChange = line.type !== 'unchanged';
                  const isAccepted = acceptedChanges.has(idx);
                  const isRejected = rejectedChanges.has(idx);

                  return (
                    <div
                      key={idx}
                      className={`flex items-center group ${
                        line.type === 'removed'
                          ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-l-2 border-red-500'
                          : line.type === 'added'
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-l-2 border-green-500'
                          : 'opacity-50'
                      } ${isAccepted ? 'ring-2 ring-green-500' : ''} ${isRejected ? 'ring-2 ring-red-500 opacity-40' : ''}`}
                    >
                      <span className="px-3 py-1 mr-3 select-none font-bold">
                        {line.type === 'removed' ? '−' : line.type === 'added' ? '+' : ' '}
                      </span>
                      <span className="flex-1">{line.text || '\u00A0'}</span>
                      {isChange && (
                        <div className="flex gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => acceptChange(idx)}
                            className={`p-1 rounded hover:bg-green-500 hover:text-white ${isAccepted ? 'bg-green-500 text-white' : ''}`}
                            title={t(uiLanguage, 'acceptChange')}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => rejectChange(idx)}
                            className={`p-1 rounded hover:bg-red-500 hover:text-white ${isRejected ? 'bg-red-500 text-white' : ''}`}
                            title={t(uiLanguage, 'rejectChange')}
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 h-full">
                <div className="flex flex-col">
                  <div className="text-xs font-bold mb-2 opacity-60 flex items-center gap-2">
                    <Clock size={14} /> {t(uiLanguage, 'oldVersion')}
                  </div>
                  <div className={`flex-1 font-mono text-sm space-y-1 border rounded p-4 overflow-y-auto ${border}`}>
                    {oldLines.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">
                        {line || '\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="text-xs font-bold mb-2 opacity-60 flex items-center gap-2">
                    <Eye size={14} /> {t(uiLanguage, 'currentVersion')}
                  </div>
                  <div className={`flex-1 font-mono text-sm space-y-1 border rounded p-4 overflow-y-auto ${border}`}>
                    {newLines.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">
                        {line || '\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`p-4 border-t flex justify-between items-center ${border}`}>
            <div className="text-xs opacity-60">
              {t(uiLanguage, 'snapshotFrom')}: {new Date(previewSnapshot.timestamp).toLocaleDateString()} {new Date(previewSnapshot.timestamp).toLocaleTimeString()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewSnapshot(null)}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {t(uiLanguage, 'cancel')}
              </button>
              {(acceptedChanges.size > 0 || rejectedChanges.size > 0) && (
                <button
                  onClick={applyMerge}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <GitMerge size={14} /> {t(uiLanguage, 'applyMerge')}
                </button>
              )}
              <button
                onClick={() => {
                  onRestore(previewSnapshot.content);
                  onClose();
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <RotateCcw size={14} /> {t(uiLanguage, 'restore')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="history-dialog-title">
      <div ref={dialogRef} className={`w-[600px] h-[80vh] rounded-lg shadow-2xl border flex flex-col relative ${bg}`}>
        <div className={`p-4 border-b flex justify-between items-center ${border}`}>
           <h2 id="history-dialog-title" className="text-lg font-bold flex items-center gap-2">
             <Clock size={20} className="text-orange-500" />
             {t(uiLanguage, 'versionHistory')}
           </h2>
           <button onClick={onClose} className="opacity-50 hover:opacity-100" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
           {history.length === 0 ? (
             <div className="text-center opacity-50 mt-20">{t(uiLanguage, 'noHistoryYet')}</div>
           ) : (
             history.map((snap, idx) => (
               <div key={idx} className={`p-4 border rounded group flex justify-between items-center transition-colors ${border} ${itemHover}`}>
                  <div>
                    <div className="font-medium text-sm">
                      {new Date(snap.timestamp).toLocaleDateString()} {t(uiLanguage, 'at')} {new Date(snap.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-xs opacity-50 mt-1">
                      {snap.title} • {snap.content.length} {t(uiLanguage, 'chars')}
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewSnapshot(snap)}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 hover:bg-blue-700"
                  >
                    <Eye size={12} /> Preview
                  </button>
               </div>
             ))
           )}
        </div>

        <div className={`p-3 text-xs text-center opacity-50 border-t ${border}`}>
           Snapshots saved on document changes
        </div>
      </div>
    </div>
  );
};
