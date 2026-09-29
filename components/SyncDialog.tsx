import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, RefreshCw, ShieldCheck, Server, Smartphone, CheckCircle, AlertTriangle, CloudOff, QrCode, Keyboard, Pencil, Trash2, Camera, Info, Loader2,
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { LanguageCode, t } from '../utils/translations';
import { useApp } from '../AppContext';
import { useEscapeKey, useFocusTrap } from '../utils/hooks';
import { formatRelativeTime } from '../utils/relativeTime';
import { useSyncStatus, type SyncErrorKind, type SyncStatus } from '../utils/sync/status';
import { loadConfig, saveConfig, type SyncConfig } from '../utils/sync/store';
import { ensureSyncEngine, getSyncEngine, stopSyncIfIdle, syncErrorKind, type SyncEngine } from '../utils/sync/engine';
import { isInsecureUrl, normalizeDavUrl } from '../utils/sync/webdav';
import { formatPairingCode, pairingQrPayload, parsePairingCode } from '../utils/sync/p2p';

interface SyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

type Tab = 'server' | 'devices';

const ERROR_KEYS: Record<SyncErrorKind, string> = {
  auth: 'syncErrAuth',
  forbidden: 'syncErrForbidden',
  notFound: 'syncErrNotFound',
  cors: 'syncErrCors',
  network: 'syncErrNetwork',
  offline: 'syncErrOffline',
  passphrase: 'syncErrPassphrase',
  http: 'syncErrHttp',
  storage: 'syncErrStorage',
  unknown: 'syncErrUnknown',
};

const MIN_PASSPHRASE = 8;

/** Shared look for inputs / secondary buttons (matches the collaboration dialog). */
const useStyles = (darkMode: boolean) => ({
  input: `w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500/50 ${
    darkMode ? 'bg-zinc-800 border-zinc-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'
  }`,
  label: 'block text-xs font-semibold mb-1 opacity-80',
  hint: 'text-[11px] opacity-60 mt-1 leading-snug',
  secondary: `px-3 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50 ${
    darkMode ? 'border-zinc-700 hover:bg-zinc-800' : 'border-gray-200 hover:bg-gray-50'
  }`,
  primary: 'px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2',
  card: `p-4 rounded-2xl border ${darkMode ? 'bg-zinc-800/40 border-zinc-700' : 'bg-gray-50 border-gray-100'}`,
});

const ErrorBox: React.FC<{ kind: SyncErrorKind; uiLanguage: LanguageCode; darkMode: boolean }> = ({ kind, uiLanguage, darkMode }) => (
  <div role="alert" className={`p-3 rounded-xl text-xs leading-relaxed border ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-100 text-red-700'}`}>
    <div className="font-semibold flex items-center gap-1.5">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {t(uiLanguage, ERROR_KEYS[kind])}
    </div>
    {kind === 'cors' && <p className="mt-1.5">{t(uiLanguage, 'syncCorsHelp').replace('{origin}', window.location.origin)}</p>}
  </div>
);

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

const statusText = (s: SyncStatus, lang: LanguageCode) => {
  const w = s.webdav;
  if (w.state === 'syncing') return t(lang, 'syncStatusSyncing');
  if (w.state === 'offline') return t(lang, 'syncStatusOffline');
  if (w.state === 'error' || w.state === 'needsKey') return t(lang, w.error ? ERROR_KEYS[w.error] : 'syncStatusError');
  if (w.state === 'idle') return w.lastSync ? t(lang, 'syncLastSynced').replace('{time}', formatRelativeTime(w.lastSync, lang, t(lang, 'syncJustNow'))) : t(lang, 'syncNever');
  return '';
};

const StatusPanel: React.FC<{ status: SyncStatus; cfg: SyncConfig; uiLanguage: LanguageCode; darkMode: boolean; onRename: (name: string) => void }> = ({
  status, cfg, uiLanguage, darkMode, onRename,
}) => {
  const s = useStyles(darkMode);
  const [name, setName] = useState(cfg.deviceName);
  useEffect(() => setName(cfg.deviceName), [cfg.deviceName]);
  const commit = () => {
    const clean = name.trim();
    if (clean && clean !== cfg.deviceName) onRename(clean);
    else setName(cfg.deviceName);
  };
  const connected = status.p2p.peers.filter(p => p.connected).length;
  const webdavLine = cfg.webdav ? statusText(status, uiLanguage) : '';
  const bad = status.webdav.state === 'error' || status.webdav.state === 'needsKey';
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="sync-device-name" className={s.label}>{t(uiLanguage, 'syncDeviceName')}</label>
        <input
          id="sync-device-name"
          className={s.input}
          value={name}
          maxLength={60}
          onChange={e => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
        />
      </div>
      {status.otherTab && !status.running && (
        <div className={`${s.card} text-xs flex items-center gap-2`}>
          <Info className="w-4 h-4 text-blue-500 shrink-0" /> {t(uiLanguage, 'syncOtherTab')}
        </div>
      )}
      {(cfg.webdav || cfg.peers.length > 0) && (
        <div className={`${s.card} text-xs space-y-1.5`} data-testid="sync-status" aria-live="polite">
          {cfg.webdav && (
            <div className={`flex items-center gap-2 ${bad ? 'text-red-500' : ''}`}>
              {status.webdav.state === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
              ) : status.webdav.state === 'offline' ? (
                <CloudOff className="w-3.5 h-3.5 shrink-0" />
              ) : bad ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              <span>{webdavLine}</span>
            </div>
          )}
          {status.pending > 0 && <div className="opacity-70">{t(uiLanguage, 'syncPending').replace('{count}', String(status.pending))}</div>}
          {cfg.peers.length > 0 && (
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              {t(uiLanguage, 'syncDevicesConnected').replace('{count}', String(connected)).replace('{total}', String(cfg.peers.length))}
            </div>
          )}
          {status.incompatible > 0 && (
            <div className="text-amber-600 dark:text-amber-400">{t(uiLanguage, 'syncIncompatible').replace('{count}', String(status.incompatible))}</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* WebDAV                                                              */
/* ------------------------------------------------------------------ */

const ServerPanel: React.FC<{
  cfg: SyncConfig;
  status: SyncStatus;
  uiLanguage: LanguageCode;
  darkMode: boolean;
  engine: () => Promise<SyncEngine>;
  refresh: () => void;
}> = ({ cfg, status, uiLanguage, darkMode, engine, refresh }) => {
  const s = useStyles(darkMode);
  const { toast } = useApp();
  const tr = (k: string) => t(uiLanguage, k);
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [folder, setFolder] = useState('Penko');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState<'test' | 'connect' | 'unlock' | 'disconnect' | null>(null);
  const [error, setError] = useState<SyncErrorKind | 'url' | 'short' | null>(null);
  const [testOk, setTestOk] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setTestOk(false);
    try {
      await fn();
    } catch (e) {
      setError(syncErrorKind(e));
    } finally {
      setBusy(null);
    }
  };

  const creds = () => {
    const normalized = normalizeDavUrl(url);
    if (!normalized) {
      setError('url');
      return null;
    }
    return { url: normalized, username: username.trim(), password };
  };

  const test = () => {
    const c = creds();
    if (!c) return;
    void run('test', async () => {
      await (await import('../utils/sync/webdavSync')).testWebDav(c);
      setTestOk(true);
    });
  };

  const connect = () => {
    const c = creds();
    if (!c) return;
    if (passphrase.length < MIN_PASSPHRASE) {
      setError('short');
      return;
    }
    void run('connect', async () => {
      await (await engine()).enableWebDav({ ...c, folder, passphrase });
      setPassword('');
      setPassphrase('');
      refresh();
      toast.success(tr('syncConnected'));
    });
  };

  const unlock = () =>
    void run('unlock', async () => {
      await (await engine()).unlockWebDav(passphrase);
      setPassphrase('');
      refresh();
    });

  const disconnect = () =>
    void run('disconnect', async () => {
      await (await engine()).disableWebDav();
      setConfirmDisconnect(false);
      refresh();
      await stopSyncIfIdle();
    });

  const errorView = error === 'url' ? (
    <p role="alert" className="text-xs text-red-500">{tr('syncErrUrl')}</p>
  ) : error === 'short' ? (
    <p role="alert" className="text-xs text-red-500">{tr('syncPassphraseTooShort')}</p>
  ) : error ? (
    <ErrorBox kind={error} uiLanguage={uiLanguage} darkMode={darkMode} />
  ) : null;

  if (cfg.webdav) {
    const needsKey = status.webdav.state === 'needsKey';
    return (
      <div className="space-y-4">
        <div className={`${s.card} text-xs space-y-1 break-all`}>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Server className="w-4 h-4 text-blue-500 shrink-0" /> <span data-testid="sync-server-url">{cfg.webdav.url}</span>
          </div>
          <div className="opacity-70">{cfg.webdav.username} · /{cfg.webdav.folder}</div>
        </div>
        {needsKey ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{tr('syncUnlockTitle')}</p>
            <p className={s.hint}>{tr('syncUnlockDesc')}</p>
            <label htmlFor="sync-unlock-passphrase" className="sr-only">{tr('syncPassphrase')}</label>
            <input id="sync-unlock-passphrase" type="password" className={s.input} value={passphrase} onChange={e => setPassphrase(e.target.value)} onKeyDown={e => e.key === 'Enter' && passphrase && unlock()} autoComplete="off" />
            <button className={`${s.primary} w-full`} disabled={!passphrase || !!busy} onClick={unlock}>
              {busy === 'unlock' && <Loader2 className="w-4 h-4 animate-spin" />} {tr('syncUnlock')}
            </button>
          </div>
        ) : (
          status.webdav.error && status.webdav.state !== 'offline' && <ErrorBox kind={status.webdav.error} uiLanguage={uiLanguage} darkMode={darkMode} />
        )}
        {errorView}
        <div className="flex gap-2">
          <button
            className={`${s.primary} flex-1`}
            disabled={!!busy || needsKey || status.webdav.state === 'syncing' || !status.running}
            onClick={() => void getSyncEngine()?.syncWebDav()}
          >
            <RefreshCw className={`w-4 h-4 ${status.webdav.state === 'syncing' ? 'animate-spin' : ''}`} /> {tr('syncNow')}
          </button>
          {!confirmDisconnect && (
            <button className={s.secondary} disabled={!!busy} onClick={() => setConfirmDisconnect(true)}>
              {tr('syncDisconnect')}
            </button>
          )}
        </div>
        {confirmDisconnect && (
          <div className={`${s.card} text-xs space-y-2`}>
            <p>{tr('syncDisconnectConfirm')}</p>
            <div className="flex gap-2 justify-end">
              <button className={s.secondary} onClick={() => setConfirmDisconnect(false)}>{tr('cancel')}</button>
              <button className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white" disabled={!!busy} onClick={disconnect}>
                {tr('syncDisconnect')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const field = (id: string, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={id} className={s.label}>{label}</label>
      {input}
      {hint && <p className={s.hint}>{hint}</p>}
    </div>
  );
  const normalized = normalizeDavUrl(url);
  return (
    <form
      className="space-y-3"
      onSubmit={e => {
        e.preventDefault();
        connect();
      }}
    >
      {field(
        'sync-url',
        tr('syncServerUrl'),
        <input id="sync-url" type="url" inputMode="url" className={s.input} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://cloud.example.com/remote.php/dav/files/me/" autoComplete="url" />,
        tr('syncServerUrlHint'),
      )}
      {normalized && isInsecureUrl(normalized) && <p className="text-[11px] text-amber-600 dark:text-amber-400">{tr('syncInsecureWarning')}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('sync-user', tr('syncUsername'), <input id="sync-user" className={s.input} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />)}
        {field('sync-folder', tr('syncFolder'), <input id="sync-folder" className={s.input} value={folder} onChange={e => setFolder(e.target.value)} />)}
      </div>
      {field(
        'sync-password',
        tr('syncAppPassword'),
        <input id="sync-password" type="password" className={s.input} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />,
        tr('syncAppPasswordHint'),
      )}
      {field(
        'sync-passphrase',
        tr('syncPassphrase'),
        <input id="sync-passphrase" type="password" className={s.input} value={passphrase} onChange={e => setPassphrase(e.target.value)} autoComplete="new-password" />,
        tr('syncPassphraseHint'),
      )}
      {errorView}
      {testOk && (
        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" /> {tr('syncTestOk')}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className={s.secondary} disabled={!url || !!busy} onClick={test}>
          {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : tr('syncTestConnection')}
        </button>
        <button type="submit" className={`${s.primary} flex-1`} disabled={!url || !username || !password || !passphrase || !!busy}>
          {busy === 'connect' && <Loader2 className="w-4 h-4 animate-spin" />} {tr(busy === 'connect' ? 'syncConnecting' : 'syncConnect')}
        </button>
      </div>
    </form>
  );
};

/* ------------------------------------------------------------------ */
/* Devices                                                             */
/* ------------------------------------------------------------------ */

type PairView = 'list' | 'show' | 'enter';
type PairPhase = 'waiting' | 'connecting';

const DevicesPanel: React.FC<{
  cfg: SyncConfig;
  status: SyncStatus;
  uiLanguage: LanguageCode;
  darkMode: boolean;
  engine: () => Promise<SyncEngine>;
  refresh: () => void;
  isOpen: boolean;
}> = ({ cfg, status, uiLanguage, darkMode, engine, refresh, isOpen }) => {
  const s = useStyles(darkMode);
  const { toast } = useApp();
  const tr = (k: string) => t(uiLanguage, k);
  const [view, setView] = useState<PairView>('list');
  const [phase, setPhase] = useState<PairPhase>('waiting');
  const [qr, setQr] = useState('');
  const [codeText, setCodeText] = useState('');
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmUnpair, setConfirmUnpair] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mounted = useRef(true);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(tk => tk.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const backToList = useCallback(() => {
    stopCamera();
    void getSyncEngine()?.cancelPairing();
    setView('list');
    setError('');
    setManual('');
    setQr('');
  }, [stopCamera]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopCamera();
      void getSyncEngine()?.cancelPairing();
    };
  }, [stopCamera]);

  // closing the dialog cancels a pairing in progress
  useEffect(() => {
    if (!isOpen && view !== 'list') backToList();
  }, [isOpen, view, backToList]);

  const onPaired = (name: string) => {
    if (!mounted.current) return;
    toast.success(tr('syncPaired').replace('{name}', name));
    refresh();
    stopCamera();
    setView('list');
  };

  const showCode = async () => {
    setError('');
    setPhase('waiting');
    setView('show');
    try {
      const e = await engine();
      const code = await e.startPairingHost({ onPeerJoined: () => mounted.current && setPhase('connecting'), onPaired });
      setCodeText(formatPairingCode(code));
      setQr(await QRCode.toDataURL(pairingQrPayload(code), { margin: 2, scale: 6 }));
    } catch (err) {
      console.error('[sync] pairing failed', err);
      setError(tr('syncErrUnknown'));
    }
  };

  const join = async (raw: string) => {
    const code = parsePairingCode(raw);
    if (!code) {
      setError(tr('syncInvalidPairingCode'));
      return;
    }
    stopCamera();
    setError('');
    setPhase('waiting');
    try {
      const e = await engine();
      await e.joinPairing(code, { onConnected: () => mounted.current && setPhase('connecting'), onPaired });
      setPhase('connecting');
    } catch (err) {
      console.error('[sync] pairing failed', err);
      setError(tr('syncErrUnknown'));
    }
  };

  const scan = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (!mounted.current) {
        stream.getTracks().forEach(tk => tk.stop());
        return;
      }
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(async function tick() {
        const video = videoRef.current;
        if (!streamRef.current || !video) return;
        if (!video.srcObject) {
          video.srcObject = streamRef.current;
          await video.play().catch(() => {});
        }
        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
            if (found?.data && parsePairingCode(found.data)) {
              setManual(found.data);
              void join(found.data);
              return;
            }
          }
        }
        requestAnimationFrame(tick);
      });
    } catch {
      stopCamera();
      setError(tr('syncCameraError'));
    }
  };

  const commitRename = async () => {
    if (!renaming) return;
    const { id, name } = renaming;
    setRenaming(null);
    if (name.trim()) {
      await (await engine()).renamePeer(id, name);
      refresh();
    }
  };

  const unpair = async (id: string) => {
    setConfirmUnpair(null);
    await (await engine()).removePeer(id);
    refresh();
    await stopSyncIfIdle();
  };

  if (view === 'show') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-xs opacity-80 leading-relaxed">{tr('syncPairingShowCode')}</p>
        <div className="flex justify-center">
          {qr ? (
            <img src={qr} alt={tr('syncPairingCodeLabel')} className="w-48 h-48 rounded-xl bg-white p-1" />
          ) : (
            <div className="w-48 h-48 rounded-xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin opacity-60" />
            </div>
          )}
        </div>
        {codeText && (
          <div>
            <div className="text-[11px] opacity-60">{tr('syncPairingCodeLabel')}</div>
            <div className="font-mono font-bold tracking-wider text-lg select-all break-all" data-testid="sync-pairing-code">{codeText}</div>
          </div>
        )}
        <p className="text-xs flex items-center justify-center gap-2" role="status">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {tr(phase === 'waiting' ? 'syncPairingWaiting' : 'syncPairingConnecting')}
        </p>
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        <button className={`${s.secondary} w-full`} onClick={backToList}>{tr('cancel')}</button>
      </div>
    );
  }

  if (view === 'enter') {
    const pending = phase === 'connecting';
    return (
      <div className="space-y-3">
        <label htmlFor="sync-pair-code" className={s.label}>{tr('syncPairingCodeLabel')}</label>
        <input
          id="sync-pair-code"
          className={`${s.input} font-mono uppercase`}
          value={manual}
          onChange={e => setManual(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && manual && void join(manual)}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
        />
        {scanning && <video ref={videoRef} className="w-full rounded-xl bg-black aspect-video object-cover" muted playsInline />}
        {pending && (
          <p className="text-xs flex items-center gap-2" role="status">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {tr('syncPairingWaiting')}
          </p>
        )}
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button className={s.secondary} onClick={backToList}>{tr('cancel')}</button>
          {!scanning && !pending && (
            <button className={`${s.secondary} flex items-center gap-1.5`} onClick={() => void scan()}>
              <Camera className="w-4 h-4" /> {tr('syncScanQr')}
            </button>
          )}
          <button className={`${s.primary} flex-1`} disabled={!manual || pending} onClick={() => void join(manual)}>
            {tr('syncPairAction')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold opacity-80 mb-2">{tr('syncPairedDevices')}</h3>
        {cfg.peers.length === 0 ? (
          <p className="text-xs opacity-60">{tr('syncNoDevices')}</p>
        ) : (
          <ul className="space-y-2" data-testid="sync-devices">
            {cfg.peers.map(p => {
              const live = status.p2p.peers.find(x => x.deviceId === p.deviceId);
              const connected = !!live?.connected;
              const lastSeen = live?.lastSeen ?? p.lastSeen;
              return (
                <li key={p.deviceId} className={`${s.card} !p-3 text-sm`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-emerald-500' : 'bg-gray-400'}`} aria-hidden="true" />
                    {renaming?.id === p.deviceId ? (
                      <input
                        className={`${s.input} !py-1`}
                        value={renaming.name}
                        aria-label={tr('syncRename')}
                        autoFocus
                        maxLength={60}
                        onChange={e => setRenaming({ id: p.deviceId, name: e.target.value })}
                        onBlur={() => void commitRename()}
                        onKeyDown={e => {
                          if (e.key === 'Enter') void commitRename();
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setRenaming(null);
                          }
                        }}
                      />
                    ) : (
                      <span className="font-medium truncate flex-1">{p.name}</span>
                    )}
                    <button className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10" title={tr('syncRename')} aria-label={`${tr('syncRename')}: ${p.name}`} onClick={() => setRenaming({ id: p.deviceId, name: p.name })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-500/10 text-red-500" title={tr('syncUnpair')} aria-label={`${tr('syncUnpair')}: ${p.name}`} onClick={() => setConfirmUnpair(p.deviceId)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] opacity-60 mt-0.5 ml-4">
                    {connected ? tr('syncDeviceConnected') : lastSeen ? tr('syncLastSeen').replace('{time}', formatRelativeTime(lastSeen, uiLanguage, tr('syncJustNow'))) : tr('syncDeviceOffline')}
                  </div>
                  {confirmUnpair === p.deviceId && (
                    <div className="mt-2 text-xs space-y-2">
                      <p>{tr('syncUnpairConfirm').replace('{name}', p.name)}</p>
                      <div className="flex gap-2 justify-end">
                        <button className={s.secondary} onClick={() => setConfirmUnpair(null)}>{tr('cancel')}</button>
                        <button className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white" onClick={() => void unpair(p.deviceId)}>
                          {tr('syncUnpair')}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        <button onClick={() => void showCode()} className="w-full p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-95 shadow-md flex items-center justify-between text-left">
          <div>
            <div className="font-bold text-sm">{tr('syncPairNew')}</div>
            <div className="text-[11px] text-blue-100 mt-0.5">{tr('syncPairNewDesc')}</div>
          </div>
          <QrCode className="w-5 h-5 opacity-80 shrink-0" />
        </button>
        <button
          onClick={() => {
            setError('');
            setPhase('waiting');
            setView('enter');
          }}
          className={`w-full p-4 rounded-2xl transition-all text-left flex items-center justify-between border ${
            darkMode ? 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
          }`}
        >
          <div>
            <div className="font-bold text-sm">{tr('syncEnterCode')}</div>
            <div className="text-[11px] opacity-60 mt-0.5">{tr('syncEnterCodeDesc')}</div>
          </div>
          <Keyboard className="w-5 h-5 opacity-80 shrink-0" />
        </button>
      </div>
      <p className={s.hint}>{tr('syncP2PNote')}</p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export const SyncDialog: React.FC<SyncDialogProps> = ({ isOpen, onClose, darkMode, uiLanguage }) => {
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen);
  const status = useSyncStatus();
  const [cfg, setCfg] = useState<SyncConfig | null>(null);
  const [tab, setTab] = useState<Tab>('server');
  const [loadError, setLoadError] = useState(false);
  const tr = (k: string) => t(uiLanguage, k);

  const refresh = useCallback(async () => {
    try {
      const e = getSyncEngine();
      setCfg(e ? e.getConfig() : await loadConfig());
      setLoadError(false);
    } catch (err) {
      console.error('[sync] could not load settings', err);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh, status.running, status.p2p.peers.length]);

  const engine = useCallback(() => ensureSyncEngine(), []);

  const rename = async (name: string) => {
    const e = getSyncEngine();
    if (e) await e.setDeviceName(name);
    else {
      const c = await loadConfig();
      await saveConfig({ ...c, deviceName: name.trim().slice(0, 60) });
    }
    void refresh();
  };

  // Opened but nothing set up: don't leave an idle engine running
  const close = () => {
    void stopSyncIfIdle();
    onClose();
  };
  useEscapeKey(isOpen, close);

  if (!isOpen) return null;

  const tabClass = (active: boolean) =>
    `flex-1 py-3 text-center border-b-2 transition-all ${active ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-md p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="sync-dialog-title">
      <div
        ref={panelRef}
        className={`max-w-md w-full max-h-full overflow-y-auto rounded-3xl shadow-2xl border ${darkMode ? 'bg-zinc-900 border-zinc-800 text-gray-100' : 'bg-white border-gray-100 text-gray-800'}`}
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <button onClick={close} title={tr('close')} aria-label={tr('close')} className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shrink-0">
              <RefreshCw className={`w-6 h-6 ${status.webdav.state === 'syncing' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 id="sync-dialog-title" className="text-xl font-bold tracking-tight">{tr('syncTitle')}</h2>
              <p className="text-blue-100 text-xs flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {tr('syncSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="p-6">
            <ErrorBox kind="storage" uiLanguage={uiLanguage} darkMode={darkMode} />
          </div>
        ) : !cfg ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin opacity-60" />
          </div>
        ) : (
          <>
            <div className="p-6 pb-2">
              <StatusPanel status={status} cfg={cfg} uiLanguage={uiLanguage} darkMode={darkMode} onRename={name => void rename(name)} />
            </div>
            <div role="tablist" className={`flex border-b text-xs font-semibold mt-2 ${darkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
              <button role="tab" aria-selected={tab === 'server'} className={tabClass(tab === 'server')} onClick={() => setTab('server')}>
                <span className="flex items-center justify-center gap-1.5">
                  <Server className="w-4 h-4" /> {tr('syncTabServer')}
                </span>
              </button>
              <button role="tab" aria-selected={tab === 'devices'} className={tabClass(tab === 'devices')} onClick={() => setTab('devices')}>
                <span className="flex items-center justify-center gap-1.5">
                  <Smartphone className="w-4 h-4" /> {tr('syncTabDevices')}
                </span>
              </button>
            </div>
            <div className="p-6" role="tabpanel">
              {tab === 'server' ? (
                <ServerPanel cfg={cfg} status={status} uiLanguage={uiLanguage} darkMode={darkMode} engine={engine} refresh={() => void refresh()} />
              ) : (
                <DevicesPanel cfg={cfg} status={status} uiLanguage={uiLanguage} darkMode={darkMode} engine={engine} refresh={() => void refresh()} isOpen={isOpen} />
              )}
              <div className={`mt-6 p-4 rounded-2xl text-[11px] leading-relaxed border ${darkMode ? 'bg-zinc-950/40 border-zinc-800 text-gray-400' : 'bg-blue-50/50 border-blue-100 text-gray-600'}`}>
                <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> {tr('syncPrivacyTitle')}
                </div>
                {tr('syncSecurityNote')}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SyncDialog;
