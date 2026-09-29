/**
 * Named paragraph styles (Normal, Title, Heading 1…, custom styles).
 *
 * Model: paragraphs / headings carry a `styleId` attribute (`data-style` in
 * HTML) — built-ins that map to a node type (Normal = <p>, Heading N = <hN>,
 * Quote = <blockquote>, Code = code block) need none. A document stores only
 * the styles it changed plus its custom styles in `DocumentData.styles`.
 *
 * Rendering: `generateStyleCss` produces one stylesheet for the document
 * (injected by DocumentStyleSheet, also embedded in HTML exports), so editing
 * a style restyles every paragraph at once. Built-ins whose look already
 * lives in editor.css (Normal, headings, Quote) only emit what the user
 * changed, so an untouched document renders exactly as before — including
 * template content that scales headings with its container's font size.
 * Inline `style` attributes (direct formatting) always win over the sheet.
 */
import type { ParagraphStyle, StyleAlign } from '../types';
import { readLS, writeLS } from './localPrefs';

export type StyleProps = Pick<ParagraphStyle, 'fontFamily' | 'fontSize' | 'bold' | 'italic' | 'underline' | 'color' | 'align' | 'lineHeight' | 'spaceBefore' | 'spaceAfter' | 'indent'>;

export const STYLE_PROPS: (keyof StyleProps)[] = ['fontFamily', 'fontSize', 'bold', 'italic', 'underline', 'color', 'align', 'lineHeight', 'spaceBefore', 'spaceAfter', 'indent'];

const BASE: Required<StyleProps> = {
  fontFamily: 'Calibri',
  fontSize: 11,
  bold: false,
  italic: false,
  underline: false,
  color: null,
  align: 'left',
  lineHeight: 1.15,
  spaceBefore: 0,
  spaceAfter: 0,
  indent: 0,
};

const r2 = (n: number) => Math.round(n * 1000) / 1000;

/** Heading N as editor.css draws it: [em, line-height, margin-top em, margin-bottom em, weight≥600]. */
const HEADING_CSS: [number, number, number, number][] = [
  [2, 1.2, 0.67, 0.4],
  [1.5, 1.25, 0.6, 0.35],
  [1.25, 1.3, 0.5, 0.3],
  [1.1, 1.15, 0.5, 0.25],
  [1, 1.15, 0.5, 0.25],
  [0.9, 1.15, 0.5, 0.25],
];

const heading = (level: number): ParagraphStyle => {
  const [em, lh, before, after] = HEADING_CSS[level - 1];
  const size = 11 * em;
  return { ...BASE, id: `heading${level}`, name: `Heading ${level}`, kind: 'heading', level, fontSize: r2(size), bold: true, lineHeight: lh, spaceBefore: r2(size * before), spaceAfter: r2(size * after) };
};

/** Built-in styles in gallery order. Their defaults reproduce editor.css. */
export const BUILTIN_STYLES: ParagraphStyle[] = [
  { ...BASE, id: 'normal', name: 'Normal', kind: 'paragraph' },
  { ...BASE, id: 'title', name: 'Title', kind: 'paragraph', fontSize: 26, spaceAfter: 3 },
  { ...BASE, id: 'subtitle', name: 'Subtitle', kind: 'paragraph', fontSize: 15, color: '#666666', spaceAfter: 16 },
  ...[1, 2, 3, 4, 5, 6].map(heading),
  { ...BASE, id: 'quote', name: 'Quote', kind: 'quote', italic: true, spaceBefore: 8.25, spaceAfter: 8.25 },
  { ...BASE, id: 'code', name: 'Code', kind: 'code', fontFamily: 'Courier New', fontSize: 10.5 },
];

const BUILTIN_BY_ID = new Map(BUILTIN_STYLES.map(s => [s.id, s]));

/** Translation keys of the built-in style names. */
export const BUILTIN_NAME_KEYS: Record<string, string> = {
  normal: 'styleNormal',
  title: 'styleTitle',
  subtitle: 'styleSubtitle',
  heading1: 'heading1',
  heading2: 'heading2',
  heading3: 'heading3',
  heading4: 'heading4',
  heading5: 'heading5',
  heading6: 'heading6',
  quote: 'quote',
  code: 'codeBlock',
};

export const isBuiltInStyle = (id: string) => BUILTIN_BY_ID.has(id);
export const builtInStyle = (id: string) => BUILTIN_BY_ID.get(id);

/** Built-ins whose look is already in editor.css: only changes are emitted. */
const CSS_BASELINE = new Set(['normal', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', 'quote']);
/** The code block's look comes from its node view (inline styles): apply-only. */
export const isStyleEditable = (id: string) => id !== 'code';

export const STYLE_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;

/* ------------------------------------------------------------------ */
/* Values                                                              */
/* ------------------------------------------------------------------ */

const ALIGNS: StyleAlign[] = ['left', 'center', 'right', 'justify'];
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i;

const num = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, r2(n))) : null;
};

/** Validates / clamps one style (storage and imports are untrusted). */
export const normalizeStyle = (raw: Partial<ParagraphStyle> & { id: string }): ParagraphStyle | null => {
  if (!raw || typeof raw.id !== 'string' || !STYLE_ID_RE.test(raw.id)) return null;
  const builtin = BUILTIN_BY_ID.get(raw.id);
  const kind = builtin ? builtin.kind : raw.kind === 'heading' ? 'heading' : 'paragraph';
  const level = builtin ? builtin.level : kind === 'heading' ? Math.min(6, Math.max(1, Math.round(Number(raw.level) || 1))) : undefined;
  const font = typeof raw.fontFamily === 'string' ? raw.fontFamily.replace(/["\\;{}<>]/g, '').trim().slice(0, 64) : '';
  const color = typeof raw.color === 'string' && COLOR_RE.test(raw.color.trim()) ? raw.color.trim() : null;
  const base = builtin || BASE;
  return {
    id: raw.id,
    name: (typeof raw.name === 'string' && raw.name.trim().slice(0, 60)) || builtin?.name || raw.id,
    kind,
    ...(level ? { level } : {}),
    fontFamily: font || base.fontFamily || BASE.fontFamily,
    fontSize: num(raw.fontSize, 1, 400) ?? base.fontSize ?? 11,
    bold: typeof raw.bold === 'boolean' ? raw.bold : !!base.bold,
    italic: typeof raw.italic === 'boolean' ? raw.italic : !!base.italic,
    underline: typeof raw.underline === 'boolean' ? raw.underline : !!base.underline,
    color,
    align: ALIGNS.includes(raw.align as StyleAlign) ? raw.align : base.align || 'left',
    lineHeight: num(raw.lineHeight, 0.5, 5) ?? base.lineHeight ?? 1.15,
    spaceBefore: num(raw.spaceBefore, 0, 400) ?? base.spaceBefore ?? 0,
    spaceAfter: num(raw.spaceAfter, 0, 400) ?? base.spaceAfter ?? 0,
    indent: num(raw.indent, 0, 400) ?? base.indent ?? 0,
  };
};

const sameValue = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.02 : (a ?? null) === (b ?? null) || (typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase());

/** Style properties that differ between two styles. */
export const changedProps = (style: StyleProps, base: StyleProps): Partial<StyleProps> => {
  const out: Partial<StyleProps> = {};
  STYLE_PROPS.forEach(k => {
    if (!sameValue(style[k], base[k])) (out as any)[k] = style[k];
  });
  return out;
};

export const isDefaultStyle = (style: ParagraphStyle) => {
  const b = BUILTIN_BY_ID.get(style.id);
  return !!b && style.name === b.name && !Object.keys(changedProps(style, b)).length;
};

/* ------------------------------------------------------------------ */
/* Stored list <-> resolved list                                       */
/* ------------------------------------------------------------------ */

/** Every style of a document: built-ins (with the document's changes) then custom styles. */
export const resolveStyles = (stored?: ParagraphStyle[] | null): ParagraphStyle[] => {
  const byId = new Map<string, ParagraphStyle>();
  (Array.isArray(stored) ? stored : []).forEach(s => {
    const n = s && normalizeStyle(s);
    if (n) byId.set(n.id, n);
  });
  const out = BUILTIN_STYLES.map(b => byId.get(b.id) || b);
  byId.forEach((s, id) => {
    if (!BUILTIN_BY_ID.has(id)) out.push(s);
  });
  return out;
};

export const findStyle = (styles: ParagraphStyle[], id: string | null | undefined) => (id ? styles.find(s => s.id === id) : undefined);

/** Stored list after saving `style` (an untouched built-in is dropped again). */
export const upsertStyle = (stored: ParagraphStyle[] | undefined, style: ParagraphStyle): ParagraphStyle[] => {
  const n = normalizeStyle(style);
  const rest = (stored || []).filter(s => s && s.id !== style.id);
  if (!n || isDefaultStyle(n)) return rest;
  const idx = (stored || []).findIndex(s => s && s.id === style.id);
  if (idx === -1) return [...rest, n];
  const out = [...(stored || [])];
  out[idx] = n;
  return out.filter(s => s);
};

/** Stored list without `id` (resets a built-in, deletes a custom style). */
export const removeStyle = (stored: ParagraphStyle[] | undefined, id: string) => (stored || []).filter(s => s && s.id !== id);

const slug = (name: string) =>
  name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** A new, unused id for a custom style called `name`. */
export const newStyleId = (name: string, styles: ParagraphStyle[]) => {
  const base = `u-${slug(name) || 'style'}`;
  const taken = new Set(styles.map(s => s.id));
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
};

/** Which style a block uses. */
export const styleIdOf = (block: { type: string; level?: number; styleId?: string | null; inQuote?: boolean }): string => {
  if (block.type === 'codeBlock') return 'code';
  if (block.styleId) return block.styleId;
  if (block.type === 'heading') return `heading${block.level || 1}`;
  return block.inQuote ? 'quote' : 'normal';
};

/** Only these properties apply for a style (all of them for styles without a CSS baseline). */
export const effectiveProps = (style: ParagraphStyle): Partial<StyleProps> => {
  if (style.kind === 'code') return {};
  if (CSS_BASELINE.has(style.id)) return changedProps(style, BUILTIN_BY_ID.get(style.id)!);
  const out: Partial<StyleProps> = {};
  STYLE_PROPS.forEach(k => {
    if (style[k] !== undefined && style[k] !== null) (out as any)[k] = style[k];
  });
  return out;
};

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */

const SERIF_RE = /georgia|times|garamond|merriweather|playfair|lora|cambria|palatino|baskerville|book antiqua|\bserif\b/i;

/** CSS font-family value for a font name (with a generic fallback). */
export const fontStack = (name: string) => {
  const clean = name.replace(/["\\;{}<>]/g, '').trim();
  if (/^calibri$/i.test(clean)) return '"Calibri", "Arial", sans-serif';
  const generic = /mono|courier|consolas|\bcode\b/i.test(clean) ? 'monospace' : /sans/i.test(clean) ? 'sans-serif' : SERIF_RE.test(clean) ? 'serif' : 'sans-serif';
  return `"${clean}", ${generic}`;
};

const fmt = (n: number) => String(Math.round(n * 100) / 100);

const textDecls = (p: Partial<StyleProps>): string[] => {
  const d: string[] = [];
  if (p.fontFamily) d.push(`font-family: ${fontStack(p.fontFamily)}`);
  if (p.fontSize != null) d.push(`font-size: ${fmt(p.fontSize)}pt`);
  if (p.bold !== undefined) d.push(`font-weight: ${p.bold ? 700 : 400}`);
  if (p.italic !== undefined) d.push(`font-style: ${p.italic ? 'italic' : 'normal'}`);
  if (p.underline !== undefined) d.push(`text-decoration: ${p.underline ? 'underline' : 'none'}`);
  if ('color' in p) d.push(`color: ${p.color || 'inherit'}`);
  if (p.align) d.push(`text-align: ${p.align}`);
  if (p.lineHeight != null) d.push(`line-height: ${fmt(p.lineHeight)}`);
  return d;
};

const boxDecls = (p: Partial<StyleProps>): string[] => {
  const d: string[] = [];
  if (p.spaceBefore != null) d.push(`margin-top: ${fmt(p.spaceBefore)}pt`);
  if (p.spaceAfter != null) d.push(`margin-bottom: ${fmt(p.spaceAfter)}pt`);
  if (p.indent != null) d.push(`margin-left: ${fmt(p.indent)}pt`);
  return d;
};

/** Where document styles apply: the editor, focus mode, prints and HTML exports (not screenplays). */
export const STYLE_SCOPE = '.penko-doc:not(.screenplay-mode) .ProseMirror';
/** Page header/footer zones and atom node views are not document paragraphs. */
const OUTSIDE = ':not(.penko-page-boundary *):not([contenteditable="false"] *)';

const rule = (selectors: string[], decls: string[]) => (decls.length ? `${selectors.join(',\n')} { ${decls.join('; ')}; }` : '');

/** The document stylesheet (empty for a document without style changes). */
export const generateStyleCss = (stored?: ParagraphStyle[] | null, scope = STYLE_SCOPE): string => {
  const styles = resolveStyles(stored);
  const named = styles.filter(s => !CSS_BASELINE.has(s.id) && s.kind !== 'code').map(s => `[data-style="${s.id}"]`);
  const plain = named.length ? `:not(:is(${named.join(', ')}))` : '';
  const out: string[] = [];
  for (const style of styles) {
    const p = effectiveProps(style);
    if (!Object.keys(p).length) continue;
    const text = textDecls(p);
    const box = boxDecls(p);
    if (style.id === 'normal') {
      out.push(rule([`${scope} p${plain}${OUTSIDE}`], text));
      // list items and table cells keep their tight spacing (Word's contextual spacing)
      out.push(rule([`${scope} p${plain}${OUTSIDE}:not(li > p):not(td > p):not(th > p)`], box));
    } else if (style.id === 'quote') {
      out.push(rule([`${scope} blockquote${OUTSIDE}`], [...text, ...box]));
      out.push(rule([`${scope} blockquote${OUTSIDE} > p${plain}`], text));
    } else if (CSS_BASELINE.has(style.id)) {
      out.push(rule([`${scope} h${style.level}${plain}${OUTSIDE}`], [...text, ...box]));
    } else {
      out.push(rule([`${scope} [data-style="${style.id}"]${OUTSIDE}`], [...text, ...box]));
    }
  }
  return out.filter(Boolean).join('\n');
};

/* ------------------------------------------------------------------ */
/* Word                                                                */
/* ------------------------------------------------------------------ */

const WORD_IDS: Record<string, string> = {
  normal: 'Normal',
  title: 'Title',
  subtitle: 'Subtitle',
  heading1: 'Heading1',
  heading2: 'Heading2',
  heading3: 'Heading3',
  heading4: 'Heading4',
  heading5: 'Heading5',
  heading6: 'Heading6',
  quote: 'Quote',
  code: 'Code',
};

/** Word style ids (w:styleId) for every style of a document, unique. */
export const wordStyleIds = (styles: ParagraphStyle[]): Map<string, string> => {
  const map = new Map<string, string>();
  const used = new Set(Object.values(WORD_IDS));
  styles.forEach(s => {
    if (WORD_IDS[s.id]) {
      map.set(s.id, WORD_IDS[s.id]);
      return;
    }
    const base = s.name.replace(/[^A-Za-z0-9]/g, '') || 'Style';
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}${i}`;
    used.add(id);
    map.set(s.id, id);
  });
  return map;
};

/** Built-in style for a Word style name ("heading 1", "Title"…). */
export const builtInForWordName = (name: string): string | undefined => {
  const n = name.trim().toLowerCase();
  if (n === 'normal') return 'normal';
  if (n === 'title') return 'title';
  if (n === 'subtitle') return 'subtitle';
  if (n === 'quote') return 'quote';
  const m = /^heading ([1-6])$/.exec(n);
  return m ? `heading${m[1]}` : undefined;
};

/* ------------------------------------------------------------------ */
/* User default set (applied to new blank documents)                   */
/* ------------------------------------------------------------------ */

const DEFAULTS_KEY = 'penko_writer_default_styles';

export const readDefaultStyles = (): ParagraphStyle[] | null => {
  try {
    const raw = JSON.parse(readLS(DEFAULTS_KEY) || 'null');
    if (!Array.isArray(raw)) return null;
    const list = raw.map(normalizeStyle).filter((s): s is ParagraphStyle => !!s);
    return list.length ? list : null;
  } catch {
    return null;
  }
};

export const saveDefaultStyles = (stored: ParagraphStyle[] | undefined) => writeLS(DEFAULTS_KEY, JSON.stringify(stored || []));

/** What the Styles dialog opens on. */
export type StylesDialogRequest = { mode: 'manage' } | { mode: 'modify'; styleId: string } | { mode: 'new' };
