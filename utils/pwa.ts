// PWA utilities: service worker registration (vite-plugin-pwa / Workbox),
// update + install prompt state shared with components/InstallPrompt.tsx.

import { registerSW } from 'virtual:pwa-register';
import { isLegacyCacheName } from './pwaHelpers';

export * from './pwaHelpers';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  /** A new version has been installed and is waiting to activate. */
  needRefresh: boolean;
  /** The app has been cached for offline use for the first time. */
  offlineReady: boolean;
  /** The browser offered an install prompt (beforeinstallprompt). */
  canInstall: boolean;
}

let state: PwaState = { needRefresh: false, offlineReady: false, canInstall: false };
const listeners = new Set<() => void>();
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registered = false;
let installListenerAttached = false;

function setState(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribePwa(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaState(): PwaState {
  return state;
}

/**
 * One-time cleanup for users who had the old hand-written service worker:
 * drop its caches and unregister any registration that isn't the current SW.
 */
async function cleanupLegacyServiceWorker(currentScriptUrl?: string): Promise<void> {
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter(isLegacyCacheName).map((n) => caches.delete(n)));
    }
    if (currentScriptUrl && 'serviceWorker' in navigator) {
      const current = new URL(currentScriptUrl, location.href).href;
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs
          .filter((r) => {
            const url = (r.active || r.waiting || r.installing)?.scriptURL;
            return url && url !== current;
          })
          .map((r) => r.unregister()),
      );
    }
  } catch (e) {
    console.warn('[PWA] Legacy cleanup failed:', e);
  }
}

/**
 * Register the Workbox service worker (production only). New versions are not
 * activated automatically: `needRefresh` becomes true and the UI offers an update.
 */
export function registerServiceWorker(): void {
  if (registered || !('serviceWorker' in navigator)) return;
  registered = true;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      setState({ needRefresh: true });
    },
    onOfflineReady() {
      setState({ offlineReady: true });
    },
    onNeedReload: reloadOnce,
    onRegisteredSW(swUrl, registration) {
      void cleanupLegacyServiceWorker(swUrl);
      if (!registration) return;
      const check = () => {
        if (navigator.onLine && !registration.installing) registration.update().catch(() => {});
      };
      // Check for a new version hourly and whenever the tab becomes visible again.
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration failed:', error);
    },
  });
}

let reloading = false;
function reloadOnce() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

/** Activate the waiting service worker and reload once it has taken control. */
export async function applyUpdate(): Promise<void> {
  // workbox-window only reloads for updates it started itself; updates found by
  // the periodic registration.update() count as "external", so reload on the
  // controller change ourselves (guarded against a double reload).
  navigator.serviceWorker?.addEventListener('controllerchange', reloadOnce, { once: true });
  if (updateSW) await updateSW(true);
}

export function dismissUpdate(): void {
  setState({ needRefresh: false });
}

export function dismissOfflineReady(): void {
  setState({ offlineReady: false });
}

/** Listen for beforeinstallprompt. Safe to call more than once. */
export function setupInstallPrompt(): void {
  if (installListenerAttached) return;
  installListenerAttached = true;
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault(); // suppress the default mini-infobar
    deferredPrompt = e as BeforeInstallPromptEvent;
    setState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setState({ canInstall: false });
  });
}

export async function showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setState({ canInstall: false });
    return outcome;
  } catch (error) {
    console.error('[PWA] Error showing install prompt:', error);
    return 'unavailable';
  }
}

export function isInstallPromptAvailable(): boolean {
  return deferredPrompt !== null;
}

/** True when running as an installed app. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true || // iOS Safari
    document.referrer.includes('android-app://')
  );
}
