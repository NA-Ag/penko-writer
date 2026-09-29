/** Small localStorage helpers that never throw (private mode, quota, disabled storage). */

export const readLS = (key: string, legacyKey?: string) => {
  try {
    const v = localStorage.getItem(key);
    if (v !== null || !legacyKey) return v;
    const old = localStorage.getItem(legacyKey);
    if (old !== null) localStorage.setItem(key, old);
    return old;
  } catch {
    return null;
  }
};
export const writeLS = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};
