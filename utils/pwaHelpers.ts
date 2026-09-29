// Pure PWA helpers (no virtual modules) so they can be unit-tested.

/** Cache names used by the old hand-written public/sw.js (e.g. "penko-writer-v1.0.0"). */
export const isLegacyCacheName = (name: string): boolean => /^penko-writer-v/.test(name);

// ---- install-prompt dismissal (snooze) ----------------------------------

export const INSTALL_DISMISS_KEY = 'penko_writer_install_dismissed';
export const INSTALL_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** Whether a dismissal timestamp (ms, as stored in localStorage) is still active. */
export function isInstallSnoozed(stored: string | null, now: number = Date.now()): boolean {
  if (!stored) return false;
  const at = Number(stored);
  if (!Number.isFinite(at)) return false;
  return now - at < INSTALL_SNOOZE_MS && at <= now;
}

export function snoozeInstallPrompt(): void {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, Date.now().toString());
  } catch {
    /* storage unavailable */
  }
}

export function installPromptSnoozed(): boolean {
  try {
    return isInstallSnoozed(localStorage.getItem(INSTALL_DISMISS_KEY));
  } catch {
    return false;
  }
}
