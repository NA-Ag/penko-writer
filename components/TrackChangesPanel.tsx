import React, { useEffect, useState } from 'react';
import { X, FileText, Check, XCircle, CheckCheck, XOctagon } from 'lucide-react';
import { useApp } from '../AppContext';
import { collectTrackedChanges, TrackedChange } from '../editor/extensions/review';
import { t, LanguageCode } from '../utils/translations';
import { formatRelativeTime } from '../utils/relativeTime';

interface TrackChangesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onHighlightChange: (changeId: string) => void;
  trackingEnabled: boolean;
  onToggleTracking: () => void;
}

export const TrackChangesPanel: React.FC<TrackChangesPanelProps> = ({
  isOpen,
  onClose,
  darkMode,
  uiLanguage,
  onAcceptChange,
  onRejectChange,
  onAcceptAll,
  onRejectAll,
  onHighlightChange,
  trackingEnabled,
  onToggleTracking
}) => {
  const { editor } = useApp();
  const [filterType, setFilterType] = useState<'all' | 'insert' | 'delete'>('all');
  const [changes, setChanges] = useState<TrackedChange[]>([]);

  // The list is derived live from the document's insertion/deletion marks.
  useEffect(() => {
    if (!isOpen || !editor || editor.isDestroyed) {
      setChanges([]);
      return;
    }
    let timer = 0;
    const compute = () => {
      if (!editor.isDestroyed) setChanges(collectTrackedChanges(editor.state.doc));
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(compute, 200);
    };
    compute();
    editor.on('update', schedule);
    return () => {
      window.clearTimeout(timer);
      editor.off('update', schedule);
    };
  }, [isOpen, editor]);

  const formatTimestamp = (timestamp: number) => (timestamp ? formatRelativeTime(timestamp, uiLanguage, t(uiLanguage, 'rvJustNow')) : '');

  const getChangeIcon = (type: 'insert' | 'delete') =>
    type === 'insert' ? <FileText size={16} className="text-green-500" /> : <XCircle size={16} className="text-red-500" />;

  const snippet = (text: string) => {
    const clean = text.replace(/\uFFFC/g, '▫').replace(/\s+/g, ' ');
    return `${clean.substring(0, 30)}${clean.length > 30 ? '...' : ''}`;
  };

  const getChangeLabel = (change: TrackedChange) =>
    t(uiLanguage, change.type === 'insert' ? 'rvAddedText' : 'rvDeletedText').replace('{text}', snippet(change.content));

  if (!isOpen) return null;

  const filteredChanges = filterType === 'all' ? changes : changes.filter(c => c.type === filterType);

  return (
    <div
      role="complementary"
      aria-labelledby="track-changes-panel-title"
      data-track-changes-panel=""
      // Esc closes the panel while focus is inside it
      onKeyDown={e => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault();
          onClose();
        }
      }}
      className={`fixed right-0 top-0 h-full w-full sm:w-96 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        darkMode ? 'bg-[#1a1a1a] border-l border-gray-800' : 'bg-white border-l border-gray-200'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <FileText size={20} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
          <h2 id="track-changes-panel-title" className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {t(uiLanguage, 'trackChanges')} ({changes.length})
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label={t(uiLanguage, 'rvCloseTrackChanges')}
          className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
        >
          <X size={20} />
        </button>
      </div>

      {/* Tracking Toggle */}
      <div className={`px-6 py-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={trackingEnabled}
            onChange={onToggleTracking}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {t(uiLanguage, 'trackChanges')}
          </span>
        </label>
      </div>

      {/* Filter Buttons */}
      <div role="group" aria-label={t(uiLanguage, 'rvFilterChanges')} className={`px-6 py-3 flex gap-2 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <button
          onClick={() => setFilterType('all')}
          aria-pressed={filterType === 'all'}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            filterType === 'all'
              ? 'bg-blue-600 text-white'
              : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t(uiLanguage, 'rvAll')}
        </button>
        <button
          onClick={() => setFilterType('insert')}
          aria-pressed={filterType === 'insert'}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            filterType === 'insert'
              ? 'bg-green-600 text-white'
              : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t(uiLanguage, 'rvInsertions')}
        </button>
        <button
          onClick={() => setFilterType('delete')}
          aria-pressed={filterType === 'delete'}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            filterType === 'delete'
              ? 'bg-red-600 text-white'
              : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t(uiLanguage, 'rvDeletions')}
        </button>
      </div>

      {/* Actions Bar */}
      {changes.length > 0 && (
        <div className={`px-6 py-3 flex gap-2 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <button
            onClick={onAcceptAll}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            <CheckCheck size={16} />
            {t(uiLanguage, 'rvAcceptAll')}
          </button>
          <button
            onClick={onRejectAll}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            <XOctagon size={16} />
            {t(uiLanguage, 'rvRejectAll')}
          </button>
        </div>
      )}

      {/* Changes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!trackingEnabled && changes.length === 0 && (
          <div className={`text-center py-12 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>{t(uiLanguage, 'rvTrackingDisabled')}</p>
            <p className="text-sm mt-2">{t(uiLanguage, 'rvTrackingDisabledHint')}</p>
          </div>
        )}

        {(trackingEnabled || changes.length > 0) && filteredChanges.length === 0 && (
          <div className={`text-center py-12 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>{t(uiLanguage, 'rvNoPendingChanges')}</p>
            <p className="text-sm mt-2">{t(uiLanguage, 'rvNoPendingChangesHint')}</p>
          </div>
        )}

        {filteredChanges.map(change => (
          <div
            key={change.id}
            role="button"
            tabIndex={0}
            aria-label={getChangeLabel(change)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onHighlightChange(change.id);
              }
            }}
            className={`rounded-lg p-4 cursor-pointer transition-all ${
              darkMode ? 'bg-[#0f0f0f] hover:bg-[#2a2a2a]' : 'bg-gray-50 hover:bg-gray-100'
            }`}
            onClick={() => onHighlightChange(change.id)}
          >
            {/* Change Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getChangeIcon(change.type)}
                <div>
                  <div className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {change.author || t(uiLanguage, 'rvUnknownAuthor')}
                  </div>
                  <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {formatTimestamp(change.timestamp)}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onAcceptChange(change.id); }}
                  className={`p-1.5 rounded transition-colors ${
                    darkMode ? 'hover:bg-green-600/20 text-green-400' : 'hover:bg-green-50 text-green-600'
                  }`}
                  title={t(uiLanguage, 'rvAccept')}
                  aria-label={t(uiLanguage, 'rvAccept')}
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRejectChange(change.id); }}
                  className={`p-1.5 rounded transition-colors ${
                    darkMode ? 'hover:bg-red-600/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                  }`}
                  title={t(uiLanguage, 'rvReject')}
                  aria-label={t(uiLanguage, 'rvReject')}
                >
                  <XCircle size={14} />
                </button>
              </div>
            </div>

            {/* Change Description */}
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {getChangeLabel(change)}
            </p>

            {/* Change Preview */}
            {change.type === 'insert' && change.content && (
              <div className={`mt-2 p-2 rounded text-xs font-mono ${
                darkMode ? 'bg-green-900/20 text-green-300 border border-green-700/30' : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                + {change.content.length > 400 ? `${change.content.slice(0, 400)}...` : change.content}
              </div>
            )}
            {change.type === 'delete' && change.content && (
              <div className={`mt-2 p-2 rounded text-xs font-mono ${
                darkMode ? 'bg-red-900/20 text-red-300 border border-red-700/30' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                - {change.content.length > 400 ? `${change.content.slice(0, 400)}...` : change.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
