import React, { useState } from 'react';
import { X, FileText, Check, XCircle, CheckCheck, XOctagon, User, Clock } from 'lucide-react';
import { TrackChange } from '../types';

interface TrackChangesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  changes: TrackChange[];
  currentUser: string;
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
  changes,
  currentUser,
  onAcceptChange,
  onRejectChange,
  onAcceptAll,
  onRejectAll,
  onHighlightChange,
  trackingEnabled,
  onToggleTracking
}) => {
  const [filterType, setFilterType] = useState<'all' | 'insert' | 'delete' | 'format'>('all');

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getChangeIcon = (type: 'insert' | 'delete' | 'format') => {
    switch (type) {
      case 'insert':
        return <FileText size={16} className="text-green-500" />;
      case 'delete':
        return <XCircle size={16} className="text-red-500" />;
      case 'format':
        return <Clock size={16} className="text-blue-500" />;
    }
  };

  const getChangeLabel = (change: TrackChange) => {
    switch (change.type) {
      case 'insert':
        return `Added "${change.content?.substring(0, 30)}${(change.content?.length || 0) > 30 ? '...' : ''}"`;
      case 'delete':
        return `Deleted "${change.oldContent?.substring(0, 30)}${(change.oldContent?.length || 0) > 30 ? '...' : ''}"`;
      case 'format':
        return `Formatted text`;
    }
  };

  if (!isOpen) return null;

  const pendingChanges = changes.filter(c => !c.accepted && !c.rejected);
  const filteredChanges = filterType === 'all'
    ? pendingChanges
    : pendingChanges.filter(c => c.type === filterType);

  return (
    <div
      className={`fixed right-0 top-0 h-full w-96 shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        darkMode ? 'bg-[#1a1a1a] border-l border-gray-800' : 'bg-white border-l border-gray-200'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <FileText size={20} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
          <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Track Changes ({pendingChanges.length})
          </h2>
        </div>
        <button
          onClick={onClose}
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
            Track Changes
          </span>
        </label>
      </div>

      {/* Filter Buttons */}
      <div className={`px-6 py-3 flex gap-2 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            filterType === 'all'
              ? 'bg-blue-600 text-white'
              : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterType('insert')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            filterType === 'insert'
              ? 'bg-green-600 text-white'
              : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Insertions
        </button>
        <button
          onClick={() => setFilterType('delete')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            filterType === 'delete'
              ? 'bg-red-600 text-white'
              : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Deletions
        </button>
      </div>

      {/* Actions Bar */}
      {pendingChanges.length > 0 && (
        <div className={`px-6 py-3 flex gap-2 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <button
            onClick={onAcceptAll}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            <CheckCheck size={16} />
            Accept All
          </button>
          <button
            onClick={onRejectAll}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            <XOctagon size={16} />
            Reject All
          </button>
        </div>
      )}

      {/* Changes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!trackingEnabled && (
          <div className={`text-center py-12 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>Track Changes is disabled</p>
            <p className="text-sm mt-2">Enable it above to start tracking edits</p>
          </div>
        )}

        {trackingEnabled && filteredChanges.length === 0 && (
          <div className={`text-center py-12 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>No pending changes</p>
            <p className="text-sm mt-2">Your edits will appear here when tracking is on</p>
          </div>
        )}

        {filteredChanges.map(change => (
          <div
            key={change.id}
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
                    {change.author}
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
                  title="Accept"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRejectChange(change.id); }}
                  className={`p-1.5 rounded transition-colors ${
                    darkMode ? 'hover:bg-red-600/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                  }`}
                  title="Reject"
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
                + {change.content}
              </div>
            )}
            {change.type === 'delete' && change.oldContent && (
              <div className={`mt-2 p-2 rounded text-xs font-mono ${
                darkMode ? 'bg-red-900/20 text-red-300 border border-red-700/30' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                - {change.oldContent}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
