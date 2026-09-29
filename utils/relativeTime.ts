/** Localized "5 min ago" style timestamps (falls back to a date after a week). */
export const formatRelativeTime = (timestamp: number, locale: string, justNow = 'Just now', now = Date.now()): string => {
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return justNow;
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    if (days < 7) return rtf.format(-days, 'day');
  } catch {
    /* unsupported locale */
  }
  return formatDateTime(timestamp, locale, false);
};

/** Localized date (and time) string. */
export const formatDateTime = (timestamp: number, locale: string, withTime = true): string => {
  try {
    return new Intl.DateTimeFormat(locale, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(timestamp);
  } catch {
    return new Date(timestamp).toLocaleString();
  }
};
