// PWA utilities for service worker registration and install prompt

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Register the service worker for offline functionality
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[PWA] Service Worker registered successfully:', registration.scope);

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60000); // Check every minute

      // Listen for service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('[PWA] New version available! Refresh to update.');

              // Notify user (you can implement a custom notification UI)
              if (confirm('A new version of Penko Writer is available. Refresh to update?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        }
      });

      return registration;
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
      return null;
    }
  } else {
    console.warn('[PWA] Service Workers are not supported in this browser');
    return null;
  }
}

/**
 * Set up the beforeinstallprompt event listener
 */
export function setupInstallPrompt(onPromptReady?: () => void): void {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Prevent the default mini-infobar
    e.preventDefault();

    // Store the event for later use
    deferredPrompt = e as BeforeInstallPromptEvent;

    console.log('[PWA] Install prompt ready');

    // Notify the app that install prompt is available
    if (onPromptReady) {
      onPromptReady();
    }
  });
}

/**
 * Show the install prompt to the user
 */
export async function showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    console.warn('[PWA] Install prompt not available');
    return 'unavailable';
  }

  try {
    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    console.log('[PWA] User choice:', outcome);

    // Clear the deferred prompt
    deferredPrompt = null;

    return outcome;
  } catch (error) {
    console.error('[PWA] Error showing install prompt:', error);
    return 'unavailable';
  }
}

/**
 * Check if the app is running in standalone mode (installed as PWA)
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true || // iOS Safari
    document.referrer.includes('android-app://') // Android
  );
}

/**
 * Check if install prompt is available
 */
export function isInstallPromptAvailable(): boolean {
  return deferredPrompt !== null;
}

/**
 * Check if the browser supports PWA features
 */
export function isPWASupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'caches' in window &&
    'PushManager' in window
  );
}

/**
 * Clear all service worker caches (useful for debugging)
 */
export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[PWA] All caches cleared');
  }
}

/**
 * Unregister all service workers (useful for debugging)
 */
export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    console.log('[PWA] Service worker unregistered');
  }
}
