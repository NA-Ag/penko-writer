import React, { useEffect, useMemo, useState } from 'react';
import { X, RotateCcw, Clock, Eye, GitCompare, Check, XCircle, GitMerge } from 'lucide-react';
import { HistorySnapshot } from '../types';
import { loadHistory } from '../utils/history';
import { useFocusTrap, useEscapeKey } from '../utils/hooks';
import { t, LanguageCode } from '../utils/translations';
import { useApp } from '../AppContext';
import { splitBlocks, diffBlocks, mergeBlocks, BlockDecision, BlockDiffOp } from '../utils/blockDiff';
import { formatDateTime } from '../utils/relativeTime';

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
  const { flushPendingEdits, toast } = useApp();
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<HistorySnapshot | null>(null);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [decisions, setDecisions] = useState<Record<number, BlockDecision>>({});

  useEffect(() => {
    if (!isOpen || !docId) return;
    // Make sure the comparison sees the latest edits.
    flushPendingEdits();
    let cancelled = false;
    setLoading(true);
    setPreviewSnapshot(null);
    setDecisions({});
    setViewMode('unified');
    loadHistory(docId)
      .then(list => !cancelled && setHistory(list))
      .catch(() => !cancelled && setHistory([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, docId]);

  useEffect(() => setDecisions({}), [previewSnapshot]);

  const diff = useMemo<BlockDiffOp[]>(
    () => (previewSnapshot ? diffBlocks(splitBlocks(previewSnapshot.content), splitBlocks(currentContent)) : []),
    [previewSnapshot, currentContent],
  );

  const setDecision = (idx: number, d: BlockDecision) => setDecisions(prev => ({ ...prev, [idx]: d }));

  const applyMerge = () => {
    if (!previewSnapshot) return;
    onRestore(mergeBlocks(diff, decisions));
    toast.success(t(uiLanguage, 'rvMergeApplied'));
    onClose();
  };

  const restore = () => {
    if (!previewSnapshot) return;
    onRestore(previewSnapshot.content);
    toast.success(t(uiLanguage, 'rvVersionRestored'));
    onClose();
  };

  // Esc: back to the list from a comparison, otherwise close
  useEscapeKey(isOpen, () => (previewSnapshot ? setPreviewSnapshot(null) : onClose()));

  if (!isOpen) return null;

  const bg = darkMode ? 'bg-[#222] border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900';
  const itemHover = darkMode ? 'hover:bg-[#333]' : 'hover:bg-gray-50';
  const border = darkMode ? 'border-gray-700' : 'border-gray-200';

  const hasChanges = diff.some(op => op.type !== 'equal');
  const hasDecisions = Object.keys(decisions).length > 0;

  const line = (type: 'removed' | 'added' | 'equal', text: string, key?: React.Key) => (
    <div
      key={key}
      className={`flex items-start ${
        type === 'removed'
          ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-l-2 border-red-500'
          : type === 'added'
          ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-l-2 border-green-500'
          : ''
      }`}
    >
      <span className="px-3 py-1 mr-3 select-none font-bold" aria-hidden="true">
        {type === 'removed' ? '−' : type === 'added' ? '+' : ' '}
      </span>
      <span className="flex-1 py-1 whitespace-pre-wrap break-words">
        <span className="sr-only">{type === 'removed' ? `${t(uiLanguage, 'removedLines')}: ` : type === 'added' ? `${t(uiLanguage, 'addedLines')}: ` : ''}</span>
        {text || ' '}
      </span>
    </div>
  );

  const renderUnified = () => (
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
      {diff.map((op, idx) => {
        if (op.type === 'equal') return <div key={idx} className="opacity-50">{line('equal', op.newBlock.text)}</div>;
        const isAccepted = decisions[idx] === 'accept';
        const isRejected = decisions[idx] === 'reject';
        return (
          <div key={idx} className={`flex items-center group ${isAccepted ? 'ring-2 ring-green-500' : ''} ${isRejected ? 'ring-2 ring-red-500 opacity-40' : ''}`}>
            <div className="flex-1 min-w-0">
              {(op.type === 'removed' || op.type === 'changed') && line('removed', op.oldBlock.text)}
              {(op.type === 'added' || op.type === 'changed') && line('added', op.newBlock.text)}
            </div>
            <div className="flex gap-1 mx-2 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                onClick={() => setDecision(idx, 'accept')}
                className={`p-1 rounded hover:bg-green-500 hover:text-white ${isAccepted ? 'bg-green-500 text-white' : ''}`}
                title={t(uiLanguage, 'rvKeepCurrent')}
                aria-label={t(uiLanguage, 'rvKeepCurrent')}
                aria-pressed={isAccepted}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setDecision(idx, 'reject')}
                className={`p-1 rounded hover:bg-red-500 hover:text-white ${isRejected ? 'bg-red-500 text-white' : ''}`}
                title={t(uiLanguage, 'rvUseSnapshot')}
                aria-label={t(uiLanguage, 'rvUseSnapshot')}
                aria-pressed={isRejected}
              >
                <XCircle size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSplit = () => {
    const oldSide: React.ReactNode[] = [];
    const newSide: React.ReactNode[] = [];
    diff.forEach((op, idx) => {
      if (op.type === 'equal') {
        oldSide.push(<div key={idx} className="whitespace-pre-wrap break-words">{op.oldBlock.text || ' '}</div>);
        newSide.push(<div key={idx} className="whitespace-pre-wrap break-words">{op.newBlock.text || ' '}</div>);
        return;
      }
      if (op.type !== 'added') oldSide.push(<div key={idx} className="whitespace-pre-wrap break-words bg-red-500/20">{op.oldBlock.text || ' '}</div>);
      if (op.type !== 'removed') newSide.push(<div key={idx} className="whitespace-pre-wrap break-words bg-green-500/20">{op.newBlock.text || ' '}</div>);
    });
    return (
      <div className="grid grid-cols-2 gap-4 h-full">
        <div className="flex flex-col">
          <div className="text-xs font-bold mb-2 opacity-60 flex items-center gap-2">
            <Clock size={14} /> {t(uiLanguage, 'oldVersion')}
          </div>
          <div className={`flex-1 font-mono text-sm space-y-1 border rounded p-4 overflow-y-auto ${border}`}>{oldSide}</div>
        </div>
        <div className="flex flex-col">
          <div className="text-xs font-bold mb-2 opacity-60 flex items-center gap-2">
            <Eye size={14} /> {t(uiLanguage, 'currentVersion')}
          </div>
          <div className={`flex-1 font-mono text-sm space-y-1 border rounded p-4 overflow-y-auto ${border}`}>{newSide}</div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={previewSnapshot ? 'history-compare-title' : 'history-dialog-title'}
    >
      <div
        ref={dialogRef}
        className={
          previewSnapshot
            ? `w-[95vw] max-w-[1400px] h-[90vh] rounded-lg shadow-2xl border flex flex-col relative ${bg}`
            : `w-[600px] max-w-[calc(100vw-2rem)] h-[80vh] rounded-lg shadow-2xl border flex flex-col relative ${bg}`
        }
      >
        {previewSnapshot ? (
          <>
            <div className={`p-4 border-b flex justify-between items-center ${border}`}>
              <h2 id="history-compare-title" className="text-lg font-bold flex items-center gap-2">
                <Eye size={20} className="text-blue-500" />
                {t(uiLanguage, 'versionComparison')}
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex gap-1 border rounded p-1" role="group" aria-label={t(uiLanguage, 'versionComparison')}>
                  <button
                    onClick={() => setViewMode('unified')}
                    aria-pressed={viewMode === 'unified'}
                    className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${viewMode === 'unified' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    title={t(uiLanguage, 'unifiedView')}
                  >
                    <Eye size={12} /> {t(uiLanguage, 'unified')}
                  </button>
                  <button
                    onClick={() => setViewMode('split')}
                    aria-pressed={viewMode === 'split'}
                    className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${viewMode === 'split' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    title={t(uiLanguage, 'sideBySideView')}
                  >
                    <GitCompare size={12} /> {t(uiLanguage, 'sideBySide')}
                  </button>
                </div>
                <button onClick={() => setPreviewSnapshot(null)} className="opacity-50 hover:opacity-100" aria-label={t(uiLanguage, 'rvBackToHistory')}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!hasChanges ? (
                <div className="text-center opacity-50 mt-20">
                  <p className="text-lg mb-2">{t(uiLanguage, 'noChanges')}</p>
                  <p className="text-sm">{t(uiLanguage, 'versionsIdentical')}</p>
                </div>
              ) : viewMode === 'unified' ? (
                renderUnified()
              ) : (
                renderSplit()
              )}
            </div>

            <div className={`p-4 border-t flex justify-between items-center ${border}`}>
              <div className="text-xs opacity-60">
                {t(uiLanguage, 'snapshotFrom')}: {formatDateTime(previewSnapshot.timestamp, uiLanguage)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewSnapshot(null)}
                  className="px-4 py-2 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {t(uiLanguage, 'cancel')}
                </button>
                {hasDecisions && (
                  <button
                    onClick={applyMerge}
                    className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-2"
                  >
                    <GitMerge size={14} /> {t(uiLanguage, 'applyMerge')}
                  </button>
                )}
                <button
                  onClick={restore}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <RotateCcw size={14} /> {t(uiLanguage, 'restore')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={`p-4 border-b flex justify-between items-center ${border}`}>
              <h2 id="history-dialog-title" className="text-lg font-bold flex items-center gap-2">
                <Clock size={20} className="text-orange-500" />
                {t(uiLanguage, 'versionHistory')}
              </h2>
              <button onClick={onClose} className="opacity-50 hover:opacity-100" aria-label={t(uiLanguage, 'close')}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? null : history.length === 0 ? (
                <div className="text-center opacity-50 mt-20">{t(uiLanguage, 'noHistoryYet')}</div>
              ) : (
                history.map(snap => (
                  <div key={snap.timestamp} className={`p-4 border rounded group flex justify-between items-center transition-colors ${border} ${itemHover}`}>
                    <div>
                      <div className="font-medium text-sm">{formatDateTime(snap.timestamp, uiLanguage)}</div>
                      <div className="text-xs opacity-50 mt-1">
                        {snap.title || t(uiLanguage, 'rvUntitled')} • {snap.content.length} {t(uiLanguage, 'chars')}
                      </div>
                    </div>
                    <button
                      onClick={() => setPreviewSnapshot(snap)}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center gap-1 hover:bg-blue-700"
                    >
                      <Eye size={12} /> {t(uiLanguage, 'preview')}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className={`p-3 text-xs text-center opacity-50 border-t ${border}`}>{t(uiLanguage, 'rvSnapshotsHint')}</div>
          </>
        )}
      </div>
    </div>
  );
};
