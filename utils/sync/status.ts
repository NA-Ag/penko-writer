import { useSyncExternalStore } from 'react';

/** Observable sync status (dependency-free so the status bar can show it without loading the engine). */

export type WebDavState = 'off' | 'idle' | 'syncing' | 'error' | 'offline' | 'needsKey';
export type SyncErrorKind = 'auth' | 'forbidden' | 'notFound' | 'cors' | 'network' | 'offline' | 'passphrase' | 'http' | 'storage' | 'unknown';

export interface PeerStatus {
  deviceId: string;
  name: string;
  connected: boolean;
  lastSeen: number | null;
}

export interface SyncStatus {
  /** Engine loaded and running in this tab. */
  running: boolean;
  /** Another tab of this browser is doing the syncing. */
  otherTab: boolean;
  deviceName: string;
  webdav: { state: WebDavState; lastSync: number | null; error: SyncErrorKind | null; server: string | null };
  p2p: { peers: PeerStatus[]; signalingConnected: boolean };
  /** Documents with local changes not uploaded yet. */
  pending: number;
  /** Documents written by a newer app version (left untouched). */
  incompatible: number;
}

const INITIAL: SyncStatus = {
  running: false,
  otherTab: false,
  deviceName: '',
  webdav: { state: 'off', lastSync: null, error: null, server: null },
  p2p: { peers: [], signalingConnected: false },
  pending: 0,
  incompatible: 0,
};

let status = INITIAL;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export const getSyncStatus = () => status;
export const setSyncStatus = (patch: Partial<SyncStatus> | ((s: SyncStatus) => Partial<SyncStatus>)) => {
  status = { ...status, ...(typeof patch === 'function' ? patch(status) : patch) };
  notify();
};
export const resetSyncStatus = () => {
  status = INITIAL;
  notify();
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
export const useSyncStatus = () => useSyncExternalStore(subscribe, getSyncStatus, getSyncStatus);

/* The sync dialog's open state (opened from the sidebar, settings and the status bar). */
let dialogOpen = false;
const dialogListeners = new Set<() => void>();
export const setSyncDialogOpen = (open: boolean) => {
  if (dialogOpen === open) return;
  dialogOpen = open;
  dialogListeners.forEach(l => l());
};
const subscribeDialog = (cb: () => void) => {
  dialogListeners.add(cb);
  return () => void dialogListeners.delete(cb);
};
const getDialogOpen = () => dialogOpen;
export const useSyncDialogOpen = () => useSyncExternalStore(subscribeDialog, getDialogOpen, getDialogOpen);
