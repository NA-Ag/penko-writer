/**
 * Settings for the optional online grammar check (LanguageTool).
 * Nothing is sent anywhere until the user has explicitly agreed.
 */
const CONSENT_KEY = 'penko_writer_languagetool_consent';
const SERVER_KEY = 'penko_writer_languagetool_server';
export const DEFAULT_LANGUAGETOOL_SERVER = 'https://api.languagetool.org';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

/** Consent is remembered per server URL. */
export const hasLanguageToolConsent = () => read(CONSENT_KEY) === getLanguageToolServer();
export const setLanguageToolConsent = (granted: boolean) => write(CONSENT_KEY, granted ? getLanguageToolServer() : null);

export const getLanguageToolServer = () => read(SERVER_KEY) || DEFAULT_LANGUAGETOOL_SERVER;

/** Normalise and store a custom server URL ('' resets to the public server). Returns false if invalid. */
export const setLanguageToolServer = (url: string): boolean => {
  const trimmed = url.trim().replace(/\/+$/, '').replace(/\/v2(\/check)?$/, '');
  if (!trimmed || trimmed === DEFAULT_LANGUAGETOOL_SERVER) {
    write(SERVER_KEY, null);
    return true;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  } catch {
    return false;
  }
  write(SERVER_KEY, trimmed);
  return true;
};

export const languageToolCheckUrl = () => `${getLanguageToolServer()}/v2/check`;
