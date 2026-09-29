/** Helpers for reading and editing inline `style` strings. */

export type StyleMap = Record<string, string>;

export const parseStyle = (style: string | null | undefined): StyleMap => {
  const out: StyleMap = {};
  if (!style) return out;
  // Split on ; that are not inside parentheses (e.g. url(data:...;base64,...))
  let depth = 0;
  let current = '';
  const parts: string[] = [];
  for (const ch of style) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
};

export const stringifyStyle = (map: StyleMap): string =>
  Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

/** Remove the given properties from a style string. Returns null when empty. */
export const omitStyle = (style: string | null | undefined, keys: string[]): string | null => {
  const map = parseStyle(style);
  keys.forEach(k => delete map[k]);
  const s = stringifyStyle(map);
  return s || null;
};

/** Set (or remove when value is empty) a property in a style string. */
export const setStyleProperty = (style: string | null | undefined, key: string, value: string | null | undefined): string | null => {
  const map = parseStyle(style);
  if (value === null || value === undefined || value === '') delete map[key];
  else map[key] = value;
  const s = stringifyStyle(map);
  return s || null;
};

export const getStyleProperty = (style: string | null | undefined, key: string): string | undefined => parseStyle(style)[key];
