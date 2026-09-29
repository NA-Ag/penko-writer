import { describe, it, expect } from 'vitest';
import { isInstallSnoozed, isLegacyCacheName, INSTALL_SNOOZE_MS } from '../../utils/pwaHelpers';

describe('install prompt snooze', () => {
  const now = 1_800_000_000_000;

  it('is not snoozed without a stored dismissal', () => {
    expect(isInstallSnoozed(null, now)).toBe(false);
    expect(isInstallSnoozed('', now)).toBe(false);
    expect(isInstallSnoozed('garbage', now)).toBe(false);
  });

  it('is snoozed for 14 days after dismissal', () => {
    expect(INSTALL_SNOOZE_MS).toBe(14 * 24 * 60 * 60 * 1000);
    expect(isInstallSnoozed(String(now - 1000), now)).toBe(true);
    expect(isInstallSnoozed(String(now - 13 * 86_400_000), now)).toBe(true);
    expect(isInstallSnoozed(String(now - 15 * 86_400_000), now)).toBe(false);
  });

  it('ignores timestamps in the future (clock changes)', () => {
    expect(isInstallSnoozed(String(now + 86_400_000), now)).toBe(false);
  });
});

describe('legacy service worker caches', () => {
  it('matches only the old hand-written SW cache names', () => {
    expect(isLegacyCacheName('penko-writer-v1.0.0')).toBe(true);
    expect(isLegacyCacheName('workbox-precache-v2-http://localhost/')).toBe(false);
    expect(isLegacyCacheName('penko-runtime-assets')).toBe(false);
  });
});
