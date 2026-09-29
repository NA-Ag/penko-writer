import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Smartphone } from 'lucide-react';
import { LanguageCode, t } from '../utils/translations';
import { setSyncDialogOpen, useSyncStatus } from '../utils/sync/status';

/** Compact sync state for the status bar (hidden when sync isn't set up). Opens the sync dialog. */
export const SyncIndicator: React.FC<{ uiLanguage: LanguageCode; darkMode: boolean }> = ({ uiLanguage, darkMode }) => {
  const s = useSyncStatus();
  if (!s.running) return null;
  const w = s.webdav.state;
  const peers = s.p2p.peers;
  if (w === 'off' && peers.length === 0) return null;
  const connected = peers.filter(p => p.connected).length;

  let icon: React.ReactNode;
  let key: string;
  let tone = '';
  if (w === 'syncing') {
    icon = <RefreshCw size={12} className="animate-spin" />;
    key = 'syncStatusSyncing';
  } else if (w === 'error' || w === 'needsKey' || s.incompatible > 0) {
    icon = <AlertTriangle size={12} />;
    key = 'syncStatusError';
    tone = 'text-amber-500';
  } else if (w === 'offline') {
    icon = <CloudOff size={12} />;
    key = 'syncStatusOfflineShort';
  } else if (w === 'off') {
    icon = <Smartphone size={12} />;
    key = connected ? 'syncDeviceConnected' : 'syncDeviceOffline';
  } else {
    icon = <Cloud size={12} />;
    key = s.pending > 0 ? 'syncStatusPendingShort' : 'syncStatusIdle';
  }
  const label = t(uiLanguage, key);
  return (
    <>
      <button
        type="button"
        onClick={() => setSyncDialogOpen(true)}
        className={`flex items-center gap-1.5 hover:text-blue-500 text-xs font-medium transition-colors ${tone}`}
        title={t(uiLanguage, 'syncTitle')}
        aria-label={`${t(uiLanguage, 'syncTitle')}: ${label}`}
        data-testid="sync-indicator"
      >
        {icon}
        <span className="hidden lg:inline">{label}</span>
        {peers.length > 0 && w !== 'off' && <span className="tabular-nums opacity-70">· {connected}/{peers.length}</span>}
      </button>
      <div className={`w-px h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
    </>
  );
};
