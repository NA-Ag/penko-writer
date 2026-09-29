/**
 * Format-neutral document model used by the DOCX / PDF / TXT exporters.
 *
 * Exports work from the DOCUMENT DATA, never from the live editor DOM:
 * `normalizeDocumentHtml` loads `doc.content` into a headless Tiptap editor
 * (so citations, bibliography and the TOC are freshly rendered and the HTML
 * is schema-normalised), then `buildExportModel` walks that HTML into
 * paragraphs / runs / tables with resolved formatting.
 */
import { Editor } from '@tiptap/core';
import { createExtensions } from '../editor/extensions';
import { noteLabel } from '../editor/extensions/references';
import { parseStyle } from '../editor/extensions/styleUtils';
import { prepareHtmlForEditor, safeUrl, sanitizeHtml } from '../editor/sanitize';
import type { DocumentData, PageConfig, ParagraphStyle } from '../types';
import { effectiveProps, findStyle, resolveStyles, type StyleProps } from './paragraphStyles';
import { base64ToBytes } from './base64';
import { DEFAULT_SECTION, type SectionSettings } from '../editor/extensions/sections';
import { latexToUnicode } from './latexLite';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  sub?: boolean;
  sup?: boolean;
  /** hex without '#' */
  color?: string;
  /** hex without '#' */
  highlight?: string;
  sizePt?: number;
  font?: string;
  link?: string;
  code?: boolean;
  uppercase?: boolean;
}

export type Run =
  | { type: 'text'; text: string; style: RunStyle }
  | { type: 'break' }
  | { type: 'tab' }
  | { type: 'image'; src: string; widthPx?: number; heightPx?: number; widthPct?: number; alt?: string }
  | { type: 'note'; noteType: 'footnote' | 'endnote'; number: number; label: string; content: string; style: RunStyle }
  /** equation (LaTeX source); `display` equations are centred on their own line */
  | { type: 'math'; latex: string; display: boolean; style: RunStyle };

export type Align = 'left' | 'center' | 'right' | 'justify';

export interface ListInfo {
  ordered: boolean;
  /** 0-based nesting level */
  level: number;
  /** unique id of the list this item belongs to */
  listId: number;
  /** 1-based position in its list (for numbering) */
  index: number;
  start: number;
  /** false for 2nd+ paragraphs inside the same list item */
  marker: boolean;
}

export interface ParaBlock {
  type: 'para';
  runs: Run[];
  heading?: number;
  align?: Align;
  /** extra left indent in pt (margins, padding, block indents) */
  indentPt: number;
  rightIndentPt?: number;
  /** maximum text width in pt (screenplay dialogue) */
  maxWidthPt?: number;
  firstLinePt?: number;
  /** line-height multiplier */
  lineHeight?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  list?: ListInfo;
  quote?: number;
  code?: boolean;
  language?: string;
  screenplay?: string;
  background?: string;
  /** right-to-left paragraph (dir="rtl" or the text starts in an RTL script) */
  rtl?: boolean;
  /** base style applied to every run (already merged into runs) */
  baseStyle: RunStyle;
  /** named paragraph style (see utils/paragraphStyles.ts) */
  styleId?: string;
}

export interface CellModel {
  blocks: Block[];
  header: boolean;
  colspan: number;
  rowspan: number;
  background?: string;
}

export interface TableBlock {
  type: 'table';
  rows: CellModel[][];
  /** number of logical columns (after colspans) */
  cols: number;
  style: 'default' | 'bordered' | 'striped' | 'minimal';
  indentPt: number;
}

export type Block = ParaBlock | TableBlock | { type: 'hr' } | { type: 'pageBreak' } | { type: 'sectionBreak'; settings: SectionSettings };

export interface NoteItem {
  noteType: 'footnote' | 'endnote';
  number: number;
  label: string;
  content: string;
}

export interface PageGeometry {
  widthPt: number;
  heightPt: number;
  marginPt: number;
  landscape: boolean;
  size: 'A4' | 'Letter';
}

export interface ExportModel {
  title: string;
  blocks: Block[];
  notes: NoteItem[];
  page: PageGeometry;
  baseFont: string;
  baseSizePt: number;
  baseLineHeight: number;
  header: string;
  footer: string;
  headerBlocks: Block[];
  footerBlocks: Block[];
  showPageNumbers: boolean;
  pageNumberPosition: NonNullable<DocumentData['pageNumberPosition']>;
  /** No header/footer on the first page. */
  differentFirstPage: boolean;
  pageNumberFormat: NonNullable<DocumentData['pageNumberFormat']>;
  /** Document-level header/footer settings (first section) for resolving later sections. */
  sectionSource: Pick<DocumentData, 'header' | 'footer' | 'showPageNumbers' | 'pageNumberPosition' | 'differentFirstPage' | 'pageNumberFormat'>;
  isScreenplay: boolean;
  language: string;
  /** the document's named paragraph styles, resolved (empty for screenplays) */
  styles: ParagraphStyle[];
}

/* ------------------------------------------------------------------ */
/* Document normalisation                                              */
/* ------------------------------------------------------------------ */

/**
 * Loads the document into a headless editor (no DOM view) with its citations
 * and returns the schema-normalised, sanitized HTML.
 */
export const normalizeDocumentHtml = (doc: Pick<DocumentData, 'content' | 'citations'>): string => {
  const prepared = prepareHtmlForEditor(doc.content || '');
  let editor: Editor | null = null;
  try {
    editor = new Editor({ extensions: createExtensions({ paginate: false }), content: prepared });
    (editor.commands as any).setReferenceData?.({ citations: doc.citations || [] });
    return sanitizeHtml(editor.getHTML());
  } catch (err) {
    console.warn('[Export] headless normalisation failed, using stored HTML', err);
    return prepared;
  } finally {
    editor?.destroy();
  }
};

/* ------------------------------------------------------------------ */
/* CSS helpers                                                         */
/* ------------------------------------------------------------------ */

export const PAGE_SIZES_PT: Record<'A4' | 'Letter', [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
};

export const MARGINS_PT: Record<PageConfig['margins'], number> = { normal: 72, narrow: 36, wide: 144, none: 0 };

export const pageGeometry = (config?: PageConfig): PageGeometry => {
  const size = config?.size === 'Letter' ? 'Letter' : 'A4';
  const [w, h] = PAGE_SIZES_PT[size];
  const landscape = config?.orientation === 'landscape';
  return {
    size,
    widthPt: landscape ? h : w,
    heightPt: landscape ? w : h,
    marginPt: MARGINS_PT[config?.margins || 'normal'] ?? 72,
    landscape,
  };
};

/** CSS length -> pt. `em`/`%` are relative to `emPt`. Returns null when unknown. */
export const cssLengthToPt = (value: string | undefined | null, emPt = 11): number | null => {
  if (!value) return null;
  const m = /^(-?\d*\.?\d+)\s*(px|pt|em|rem|in|cm|mm|pc|%)?$/i.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch ((m[2] || 'px').toLowerCase()) {
    case 'px': return n * 0.75;
    case 'pt': return n;
    case 'em': return n * emPt;
    case 'rem': return n * 11;
    case 'in': return n * 72;
    case 'cm': return n * 28.3465;
    case 'mm': return n * 2.83465;
    case 'pc': return n * 12;
    case '%': return (n / 100) * emPt;
    default: return null;
  }
};

const NAMED_COLORS: Record<string, string> = {
  black: '000000', white: 'ffffff', red: 'ff0000', green: '008000', blue: '0000ff', yellow: 'ffff00', orange: 'ffa500',
  purple: '800080', gray: '808080', grey: '808080', silver: 'c0c0c0', maroon: '800000', navy: '000080', teal: '008080',
  olive: '808000', lime: '00ff00', aqua: '00ffff', cyan: '00ffff', fuchsia: 'ff00ff', magenta: 'ff00ff', pink: 'ffc0cb',
  brown: 'a52a2a', gold: 'ffd700', lightgray: 'd3d3d3', lightgrey: 'd3d3d3', darkgray: 'a9a9a9', darkgrey: 'a9a9a9',
  lightyellow: 'ffffe0', lightblue: 'add8e6', lightgreen: '90ee90', darkblue: '00008b', darkred: '8b0000', darkgreen: '006400',
};

/** CSS colour -> 6-digit hex (no '#'); null for transparent / unknown. Alpha is blended onto white. */
export const cssColorToHex = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v || v === 'transparent' || v === 'inherit' || v === 'initial' || v === 'currentcolor' || v === 'none') return null;
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split('').map(c => c + c).join('');
    return hex.length >= 6 ? hex.slice(0, 6) : null;
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (a <= 0.01) return null;
    a = Math.min(1, a);
    return [m[1], m[2], m[3]]
      .map(c => Math.round(parseFloat(c) * a + 255 * (1 - a)))
      .map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
      .join('');
  }
  return null;
};

const firstFont = (family: string | undefined): string | undefined => {
  if (!family) return undefined;
  const f = family.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return f || undefined;
};

/** True when the first strongly directional character is Hebrew / Arabic / Syriac / Thaana / N'Ko…. */
export const startsRtl = (text: string): boolean => {
  const m = /[\p{L}]/u.exec(text);
  return !!m && /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(m[0]);
};

const isBoldWeight = (w?: string) => !!w && (/^bold(er)?$/i.test(w) || (/^\d+$/.test(w) && parseInt(w, 10) >= 600));

/* ------------------------------------------------------------------ */
/* Model builder                                                       */
/* ------------------------------------------------------------------ */

const HEADING_EM: Record<number, number> = { 1: 2, 2: 1.5, 3: 1.25, 4: 1.1, 5: 1, 6: 0.9 };
const HEADING_SPACE_EM: Record<number, [number, number]> = { 1: [0.67, 0.4], 2: [0.6, 0.35], 3: [0.5, 0.3], 4: [0.5, 0.25], 5: [0.5, 0.25], 6: [0.5, 0.25] };

/** Screenplay layout, mirroring editor.css (indents are from the content edge). */
export const SCREENPLAY_LAYOUT: Record<string, { indentIn: number; widthIn?: number; before: number; after: number; upper?: boolean; bold?: boolean; align?: Align }> = {
  'scene-heading': { indentIn: 0, before: 18, after: 9, upper: true, bold: true },
  action: { indentIn: 0, before: 0, after: 9 },
  character: { indentIn: 3.7, before: 9, after: 0, upper: true },
  parenthetical: { indentIn: 3.1, before: 0, after: 0 },
  dialogue: { indentIn: 2.5, widthIn: 3.5, before: 0, after: 9 },
  transition: { indentIn: 0, before: 9, after: 9, upper: true, align: 'right' },
};

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'FIGCAPTION', 'ASIDE', 'NAV', 'MAIN', 'DL', 'DT', 'DD', 'ADDRESS']);

interface BlockCtx {
  indentPt: number;
  quote: number;
  listLevel: number;
  inherited: RunStyle;
  align?: Align;
  emPt: number;
  /** list items and table cells keep tight spacing (like the editor) */
  tight?: boolean;
}

export interface BuildOptions {
  baseSizePt?: number;
  baseFont?: string;
  isScreenplay?: boolean;
  /** named paragraph styles (stored list); omitted for headers / footers */
  styles?: ParagraphStyle[] | null;
}

/** Run formatting a named style contributes. */
export const styleRunProps = (p: Partial<StyleProps>): RunStyle => {
  const run: RunStyle = {};
  if (p.fontFamily) run.font = p.fontFamily;
  if (p.fontSize) run.sizePt = p.fontSize;
  if (p.bold !== undefined) run.bold = p.bold;
  if (p.italic !== undefined) run.italic = p.italic;
  if (p.underline !== undefined) run.underline = p.underline;
  if ('color' in p) run.color = cssColorToHex(p.color) || undefined;
  return run;
};

class ModelBuilder {
  notes: NoteItem[] = [];
  private listCounter = 0;
  private styles: ParagraphStyle[] | null;
  constructor(private opts: Required<BuildOptions>) {
    this.styles = opts.styles && !opts.isScreenplay ? resolveStyles(opts.styles) : null;
  }

  /** Named style of a paragraph element (null without styles). */
  private styleOf(el: HTMLElement | null, heading?: number): ParagraphStyle | null {
    if (!this.styles) return null;
    const named = findStyle(this.styles, el?.getAttribute('data-style'));
    if (named && named.kind !== 'quote' && named.kind !== 'code' && !/^(normal|heading[1-6])$/.test(named.id)) return named;
    return findStyle(this.styles, heading ? `heading${heading}` : 'normal') || null;
  }

  build(root: Element): Block[] {
    return this.blocks(root, { indentPt: 0, quote: 0, listLevel: -1, inherited: {}, emPt: this.opts.baseSizePt });
  }

  /* ----- inline ----- */

  private inlineStyleFrom(el: HTMLElement, base: RunStyle, emPt: number): RunStyle {
    const s: RunStyle = { ...base };
    const css = parseStyle(el.getAttribute('style'));
    const tag = el.tagName;
    if (tag === 'STRONG' || tag === 'B') s.bold = true;
    if (tag === 'EM' || tag === 'I' || tag === 'CITE') s.italic = true;
    if (tag === 'U') s.underline = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.strike = true;
    if (tag === 'SUB') { s.sub = true; s.sup = false; }
    if (tag === 'SUP') { s.sup = true; s.sub = false; }
    if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP' || tag === 'TT') { s.code = true; s.font = 'Courier New'; }
    if (tag === 'INS' && el.classList.contains('track-insert')) { s.underline = true; s.color = '15803d'; }
    if (tag === 'DEL' && el.classList.contains('track-delete')) s.color = 'b91c1c';
    if (tag === 'MARK') s.highlight = cssColorToHex(el.getAttribute('data-color')) || cssColorToHex(css['background-color']) || 'ffff00';
    if (tag === 'A') {
      const href = el.getAttribute('href') || '';
      const url = href && !href.startsWith('#') ? safeUrl(href) : null;
      if (url) {
        s.link = url;
        s.underline = true;
        if (!css.color) s.color = '2563eb';
      }
    }
    if (css['font-weight']) s.bold = isBoldWeight(css['font-weight']);
    if (css['font-style']) s.italic = css['font-style'] === 'italic' || css['font-style'] === 'oblique';
    const deco = `${css['text-decoration'] || ''} ${css['text-decoration-line'] || ''}`;
    if (/underline/.test(deco)) s.underline = true;
    if (/line-through/.test(deco)) s.strike = true;
    const color = cssColorToHex(css.color);
    if (color) s.color = color;
    const bg = cssColorToHex(css['background-color'] || css.background);
    if (bg && tag !== 'MARK') s.highlight = bg;
    const size = cssLengthToPt(css['font-size'], s.sizePt || emPt);
    if (size && size > 0) s.sizePt = Math.round(size * 2) / 2;
    const font = firstFont(css['font-family']);
    if (font) s.font = font;
    if (css['text-transform'] === 'uppercase') s.uppercase = true;
    if (css['vertical-align'] === 'super') s.sup = true;
    if (css['vertical-align'] === 'sub') s.sub = true;
    return s;
  }

  private inline(node: Node, style: RunStyle, runs: Run[], emPt: number, pre = false) {
    if (node.nodeType === 3) {
      let text = node.nodeValue || '';
      if (!pre) text = text.replace(/[\t\n\r ]+/g, ' ');
      if (!text) return;
      if (pre) {
        text.split('\n').forEach((line, i) => {
          if (i > 0) runs.push({ type: 'break' });
          if (line) runs.push({ type: 'text', text: line, style });
        });
      } else {
        runs.push({ type: 'text', text: style.uppercase ? text.toUpperCase() : text, style });
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    const dataType = el.getAttribute('data-type');
    if (tag === 'BR') { runs.push({ type: 'break' }); return; }
    if (tag === 'IMG') {
      const src = el.getAttribute('src') || '';
      if (!src) return;
      const css = parseStyle(el.getAttribute('style'));
      const w = parseFloat(el.getAttribute('width') || '') || (css.width && /px$/.test(css.width) ? parseFloat(css.width) : undefined);
      const h = parseFloat(el.getAttribute('height') || '') || (css.height && /px$/.test(css.height) ? parseFloat(css.height) : undefined);
      const pct = css.width && /%$/.test(css.width) ? parseFloat(css.width) : undefined;
      runs.push({ type: 'image', src, widthPx: w || undefined, heightPx: h || undefined, widthPct: pct, alt: el.getAttribute('alt') || undefined });
      return;
    }
    if (dataType === 'footnote') {
      const noteType = el.getAttribute('data-note-type') === 'endnote' ? 'endnote' : 'footnote';
      const number = parseInt(el.getAttribute('data-number') || '0', 10) || this.notes.filter(n => n.noteType === noteType).length + 1;
      const item: NoteItem = { noteType, number, label: noteLabel(noteType, number), content: el.getAttribute('data-content') || '' };
      this.notes.push(item);
      runs.push({ type: 'note', ...item, style });
      return;
    }
    if (dataType === 'equation') {
      const latex = el.getAttribute('data-latex') || '';
      if (latex.trim()) runs.push({ type: 'math', latex, display: el.getAttribute('data-display') === 'true', style });
      return;
    }
    if (dataType === 'citation') {
      const text = (el.textContent || '').replace(/\s+/g, ' ');
      if (text) runs.push({ type: 'text', text, style });
      return;
    }
    if (el.classList.contains('katex') || tag === 'SCRIPT' || tag === 'STYLE') return;
    const next = this.inlineStyleFrom(el, style, style.sizePt || emPt);
    el.childNodes.forEach(child => this.inline(child, next, runs, emPt, pre));
  }

  /* ----- blocks ----- */

  private blockStyle(el: HTMLElement, ctx: BlockCtx, baseStyle: RunStyle, emPt: number) {
    const css = parseStyle(el.getAttribute('style'));
    const ml = cssLengthToPt(css['margin-left'], emPt) || 0;
    const pl = cssLengthToPt(css['padding-left'], emPt) || 0;
    const mr = cssLengthToPt(css['margin-right'], emPt) || 0;
    const align = (['left', 'center', 'right', 'justify'].includes(css['text-align']) ? css['text-align'] : undefined) as Align | undefined;
    let lineHeight: number | undefined;
    const lh = css['line-height'];
    if (lh) {
      if (/^\d*\.?\d+$/.test(lh)) lineHeight = parseFloat(lh);
      else if (/%$/.test(lh)) lineHeight = parseFloat(lh) / 100;
      else {
        const pt = cssLengthToPt(lh, emPt);
        if (pt) lineHeight = pt / (baseStyle.sizePt || emPt);
      }
    }
    return {
      indent: Math.max(0, ml + pl),
      right: Math.max(0, mr),
      align,
      lineHeight,
      firstLine: cssLengthToPt(css['text-indent'], emPt) ?? undefined,
      before: cssLengthToPt(css['margin-top'], emPt) ?? undefined,
      after: cssLengthToPt(css['margin-bottom'], emPt) ?? undefined,
      background: cssColorToHex(css['background-color'] || css.background) || undefined,
      css,
    };
  }

  private para(el: HTMLElement | null, ctx: BlockCtx, extra: Partial<ParaBlock> = {}, nodes?: Node[]): ParaBlock {
    let emPt = ctx.emPt;
    let baseStyle: RunStyle = { ...ctx.inherited };
    const heading = extra.heading;
    if (heading) {
      emPt = this.opts.baseSizePt * HEADING_EM[heading];
      baseStyle = { ...baseStyle, bold: true, sizePt: Math.round(emPt * 2) / 2 };
    }
    // Named style: only what differs from the built-in look (all of it for Title / custom styles), then direct formatting
    const named = extra.code ? null : this.styleOf(el, heading);
    let sp: Partial<StyleProps> = named ? effectiveProps(named) : {};
    if (named?.id === 'normal' && ctx.quote && this.styles) {
      // the quote's own text formatting wins over Normal's (its spacing / indent apply to the whole quote)
      const { spaceBefore, spaceAfter, indent, ...quoteText } = effectiveProps(findStyle(this.styles, 'quote')!);
      sp = { ...sp, ...quoteText };
    }
    if (named?.id === 'normal' && ctx.tight) sp = { ...sp, spaceBefore: undefined, spaceAfter: undefined };
    baseStyle = { ...baseStyle, ...styleRunProps(sp) };
    if (sp.fontSize) emPt = sp.fontSize;
    let bs = el ? this.blockStyle(el, ctx, baseStyle, emPt) : null;
    if (el) baseStyle = this.inlineStyleFrom(el, baseStyle, emPt);
    // block-level colour/background shouldn't become run highlights
    if (el && bs?.background) baseStyle.highlight = ctx.inherited.highlight;
    const screenplay = el?.getAttribute('data-screenplay-type') || (el?.className.match(/screenplay-([\w-]+)/) || [])[1];
    const block: ParaBlock = {
      type: 'para',
      runs: [],
      indentPt: ctx.indentPt + (bs?.indent || sp.indent || 0),
      rightIndentPt: bs?.right || undefined,
      align: bs?.align || sp.align || ctx.align,
      lineHeight: bs?.lineHeight ?? sp.lineHeight ?? undefined,
      firstLinePt: bs?.firstLine,
      spaceBeforePt: bs?.before ?? sp.spaceBefore ?? (heading ? HEADING_SPACE_EM[heading][0] * emPt : undefined),
      spaceAfterPt: bs?.after ?? sp.spaceAfter ?? (heading ? HEADING_SPACE_EM[heading][1] * emPt : undefined),
      quote: ctx.quote || undefined,
      background: bs?.background,
      baseStyle,
      ...(named ? { styleId: ctx.quote && named.id === 'normal' ? 'quote' : named.id } : {}),
      ...extra,
    };
    if (this.opts.isScreenplay || screenplay) {
      const layout = screenplay ? SCREENPLAY_LAYOUT[screenplay] : undefined;
      block.baseStyle = baseStyle = { ...baseStyle, font: 'Courier New', sizePt: 12 };
      block.lineHeight = block.lineHeight ?? 1.5;
      if (layout) {
        block.screenplay = screenplay;
        block.indentPt = ctx.indentPt + layout.indentIn * 72;
        if (layout.upper) baseStyle.uppercase = true;
        if (layout.bold) baseStyle.bold = true;
        if (layout.align) block.align = layout.align;
        block.spaceBeforePt = bs?.before ?? layout.before;
        block.spaceAfterPt = bs?.after ?? layout.after;
        if (layout.widthIn) block.maxWidthPt = layout.widthIn * 72;
      }
    }
    const runs: Run[] = [];
    const pre = !!extra.code;
    (nodes || (el ? Array.from(el.childNodes) : [])).forEach(n => this.inline(n, baseStyle, runs, emPt, pre));
    // trim leading/trailing whitespace of the paragraph
    if (!pre) {
      const first = runs[0];
      if (first?.type === 'text') first.text = first.text.replace(/^ +/, '');
      const last = runs[runs.length - 1];
      if (last?.type === 'text') last.text = last.text.replace(/ +$/, '');
    }
    block.runs = runs.filter(r => r.type !== 'text' || r.text);
    // a paragraph holding just a display equation is centred (like KaTeX's display mode on screen)
    if (!block.align && block.runs.some(r => r.type === 'math' && r.display) && block.runs.every(r => r.type === 'math' || (r.type === 'text' && !r.text.trim()))) block.align = 'center';
    const dir = el?.getAttribute('dir');
    if (dir === 'rtl' || (dir !== 'ltr' && startsRtl(runsToText(block.runs)))) block.rtl = true;
    return block;
  }

  private blocks(root: Element, ctx: BlockCtx): Block[] {
    const out: Block[] = [];
    let pending: Node[] = [];
    const flush = () => {
      if (pending.some(n => n.nodeType === 1 || (n.nodeValue || '').trim())) out.push(this.para(null, ctx, {}, pending));
      pending = [];
    };
    root.childNodes.forEach(node => {
      if (node.nodeType !== 1) {
        if (node.nodeType === 3) pending.push(node);
        return;
      }
      const el = node as HTMLElement;
      const tag = el.tagName;
      if (!BLOCK_TAGS.has(tag)) {
        pending.push(el);
        return;
      }
      flush();
      out.push(...this.block(el, ctx));
    });
    flush();
    return out;
  }

  private block(el: HTMLElement, ctx: BlockCtx): Block[] {
    const tag = el.tagName;
    const dataType = el.getAttribute('data-type');
    if (dataType === 'page-break') return [{ type: 'pageBreak' }];
    if (dataType === 'section-break') {
      let settings: SectionSettings = { ...DEFAULT_SECTION };
      try {
        settings = { ...DEFAULT_SECTION, ...JSON.parse(el.getAttribute('data-section') || '{}') };
      } catch {
        /* keep defaults */
      }
      return [{ type: 'sectionBreak', settings }];
    }
    if (tag === 'HR') return [{ type: 'hr' }];
    if (/^H[1-6]$/.test(tag)) return [this.para(el, ctx, { heading: parseInt(tag[1], 10) })];
    if (tag === 'P' || tag === 'DT' || tag === 'FIGCAPTION' || tag === 'ADDRESS') return [this.para(el, ctx)];
    if (tag === 'PRE') {
      const code = el.querySelector('code');
      const lang = el.getAttribute('data-language') || ((code?.className || '').match(/language-([\w-]+)/) || [])[1];
      const block = this.para(el, { ...ctx, inherited: { ...ctx.inherited, font: 'Courier New', code: true, sizePt: Math.round(ctx.emPt * 0.9 * 2) / 2 } }, { code: true, language: lang }, [code || el].flatMap(n => Array.from(n.childNodes)));
      block.background = block.background || 'f3f4f6';
      block.lineHeight = block.lineHeight ?? 1.3;
      return [block];
    }
    if (tag === 'UL' || tag === 'OL') return this.list(el, ctx);
    if (tag === 'BLOCKQUOTE') {
      const bs = this.blockStyle(el, ctx, ctx.inherited, ctx.emPt);
      const qp = this.styles ? effectiveProps(findStyle(this.styles, 'quote')!) : {};
      const children = this.blocks(el, {
        ...ctx,
        quote: ctx.quote + 1,
        indentPt: ctx.indentPt + 14 + bs.indent + (qp.indent || 0),
        inherited: { ...this.inlineStyleFrom(el, ctx.inherited, ctx.emPt), italic: true, color: cssColorToHex(bs.css.color) || '4b5563', ...styleRunProps(qp) },
      });
      const paras = children.filter(b => b.type === 'para') as ParaBlock[];
      if (paras.length && qp.spaceBefore !== undefined) paras[0].spaceBeforePt = paras[0].spaceBeforePt ?? qp.spaceBefore ?? undefined;
      if (paras.length && qp.spaceAfter !== undefined) paras[paras.length - 1].spaceAfterPt = paras[paras.length - 1].spaceAfterPt ?? qp.spaceAfter ?? undefined;
      return children;
    }
    if (tag === 'TABLE') return [this.table(el as HTMLTableElement, ctx)];
    // generic containers (div, section, TOC, bibliography, templates, li fallback)
    const bs = this.blockStyle(el, ctx, ctx.inherited, ctx.emPt);
    const inherited = this.inlineStyleFrom(el, ctx.inherited, ctx.emPt);
    delete inherited.highlight;
    if (bs.background) inherited.highlight = undefined;
    const emPt = inherited.sizePt || ctx.emPt;
    const children = this.blocks(el, { ...ctx, indentPt: ctx.indentPt + bs.indent, inherited, align: bs.align || ctx.align, emPt });
    if (bs.background) children.forEach(b => { if (b.type === 'para' && !b.background) b.background = bs.background; });
    const first = children.find(b => b.type === 'para') as ParaBlock | undefined;
    if (first && bs.before && first.spaceBeforePt === undefined) first.spaceBeforePt = bs.before;
    const last = [...children].reverse().find(b => b.type === 'para') as ParaBlock | undefined;
    if (last && bs.after && last.spaceAfterPt === undefined) last.spaceAfterPt = bs.after;
    return children;
  }

  private list(el: HTMLElement, ctx: BlockCtx): Block[] {
    const ordered = el.tagName === 'OL';
    const listId = ++this.listCounter;
    const start = parseInt(el.getAttribute('start') || '1', 10) || 1;
    const level = ctx.listLevel + 1;
    const out: Block[] = [];
    let index = 0;
    Array.from(el.children).forEach(child => {
      if (child.tagName !== 'LI') {
        out.push(...this.block(child as HTMLElement, ctx));
        return;
      }
      index++;
      const itemCtx: BlockCtx = { ...ctx, listLevel: level, indentPt: ctx.indentPt, tight: true };
      const blocks = this.blocks(child, itemCtx);
      let marked = false;
      for (const b of blocks) {
        if (b.type !== 'para') continue;
        if (b.list) continue; // nested list items keep their own info
        b.list = { ordered, level, listId, index, start, marker: !marked };
        marked = true;
      }
      if (!marked) {
        const p = this.para(null, itemCtx);
        p.list = { ordered, level, listId, index, start, marker: true };
        blocks.unshift(p);
      }
      out.push(...blocks);
    });
    return out;
  }

  private table(el: HTMLTableElement, ctx: BlockCtx): TableBlock {
    const rows: CellModel[][] = [];
    let cols = 0;
    Array.from(el.rows).forEach(tr => {
      const cells: CellModel[] = [];
      let span = 0;
      Array.from(tr.cells).forEach(td => {
        const css = parseStyle(td.getAttribute('style'));
        const colspan = Math.max(1, parseInt(td.getAttribute('colspan') || '1', 10) || 1);
        span += colspan;
        const header = td.tagName === 'TH';
        const cellCtx: BlockCtx = { indentPt: 0, quote: 0, listLevel: -1, inherited: header ? { ...ctx.inherited, bold: true } : { ...ctx.inherited }, emPt: ctx.emPt, tight: true };
        const blocks = this.blocks(td, cellCtx);
        cells.push({
          blocks: blocks.length ? blocks : [this.para(null, cellCtx)],
          header,
          colspan,
          rowspan: Math.max(1, parseInt(td.getAttribute('rowspan') || '1', 10) || 1),
          background: cssColorToHex(css['background-color'] || css.background) || cssColorToHex(parseStyle(tr.getAttribute('style'))['background-color']) || undefined,
        });
      });
      cols = Math.max(cols, span);
      rows.push(cells);
    });
    const cls = el.className || '';
    const style = /table-style-(bordered|striped|minimal)/.exec(cls)?.[1] as TableBlock['style'] | undefined;
    return { type: 'table', rows, cols: Math.max(1, cols), style: style || 'default', indentPt: ctx.indentPt };
  }
}

const parseBody = (html: string): HTMLElement => new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, 'text/html').body;

/** Build blocks from an HTML fragment (used for header/footer text too). */
export const htmlToBlocks = (html: string, opts: BuildOptions = {}): { blocks: Block[]; notes: NoteItem[] } => {
  const builder = new ModelBuilder({ baseSizePt: opts.baseSizePt ?? 11, baseFont: opts.baseFont ?? 'Calibri', isScreenplay: !!opts.isScreenplay, styles: opts.styles ?? null });
  const blocks = builder.build(parseBody(html));
  return { blocks, notes: builder.notes };
};

/** Header/footer HTML -> plain text ({PAGE} placeholders kept). */
export const htmlToPlainText = (html: string): string => {
  if (!html) return '';
  const body = parseBody(sanitizeHtml(html));
  body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  body.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6').forEach(el => el.append('\n'));
  return (body.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
};

export const buildExportModel = (doc: DocumentData, normalizedHtml?: string): ExportModel => {
  const html = normalizedHtml ?? normalizeDocumentHtml(doc);
  const isScreenplay = !!doc.isScreenplay;
  const baseSizePt = isScreenplay ? 12 : 11;
  const { blocks, notes } = htmlToBlocks(html, { baseSizePt, isScreenplay, styles: doc.styles || [] });
  const header = sanitizeHtml(doc.header || '');
  const footer = sanitizeHtml(doc.footer || '');
  return {
    title: doc.title || 'Document',
    blocks,
    notes,
    page: pageGeometry(doc.pageConfig),
    baseFont: isScreenplay ? 'Courier New' : 'Calibri',
    baseSizePt,
    baseLineHeight: isScreenplay ? 1.5 : 1.15,
    header,
    footer,
    headerBlocks: header ? htmlToBlocks(header, { baseSizePt: 10 }).blocks : [],
    footerBlocks: footer ? htmlToBlocks(footer, { baseSizePt: 10 }).blocks : [],
    showPageNumbers: !!doc.showPageNumbers,
    pageNumberPosition: doc.pageNumberPosition || 'footer-center',
    differentFirstPage: !!doc.differentFirstPage,
    pageNumberFormat: doc.pageNumberFormat || 'decimal',
    sectionSource: { header: doc.header, footer: doc.footer, showPageNumbers: doc.showPageNumbers, pageNumberPosition: doc.pageNumberPosition, differentFirstPage: doc.differentFirstPage, pageNumberFormat: doc.pageNumberFormat },
    isScreenplay,
    language: doc.language || 'en-US',
    styles: isScreenplay ? [] : resolveStyles(doc.styles),
  };
};

/* ------------------------------------------------------------------ */
/* Shared helpers for renderers                                        */
/* ------------------------------------------------------------------ */

const toRoman = (num: number): string => {
  const map: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, s] of map) while (num >= v) { out += s; num -= v; }
  return out;
};

const toAlpha = (num: number): string => {
  let s = '';
  while (num > 0) {
    num--;
    s = String.fromCharCode(97 + (num % 26)) + s;
    num = Math.floor(num / 26);
  }
  return s;
};

const BULLETS = ['•', '◦', '▪'];
/** Bullets that render with the standard PDF fonts (WinAnsi). */
const PLAIN_BULLETS = ['•', '-', '·'];

/** Marker text of a list item ('1.', 'a.', 'iv.', '•'). */
export const listMarker = (list: ListInfo, plain = false): string => {
  if (!list.ordered) return (plain ? PLAIN_BULLETS : BULLETS)[list.level % 3];
  const n = list.start + list.index - 1;
  const kind = list.level % 3;
  return `${kind === 0 ? n : kind === 1 ? toAlpha(n) : toRoman(n)}.`;
};

/** Text of an equation in plain-text output (default: readable Unicode, "E = mc²"). */
export type MathText = (latex: string, display: boolean) => string;
const unicodeMath: MathText = latex => latexToUnicode(latex);

/** Plain text of a run list (images as [alt], notes as their label, equations as Unicode). */
export const runsToText = (runs: Run[], math: MathText = unicodeMath): string =>
  runs
    .map(r => {
      if (r.type === 'text') return r.text;
      if (r.type === 'break') return '\n';
      if (r.type === 'tab') return '\t';
      if (r.type === 'note') return `[${r.label}]`;
      if (r.type === 'math') return math(r.latex, r.display);
      return r.alt ? `[${r.alt}]` : '[image]';
    })
    .join('');

/** Plain-text rendering of blocks (TXT export, table cells in PDF). */
export const blocksToText = (blocks: Block[], opts: { tableCells?: boolean; math?: MathText } = {}): string => {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === 'hr') lines.push('----------------------------------------');
    else if (b.type === 'pageBreak' || b.type === 'sectionBreak') lines.push('');
    else if (b.type === 'table') {
      if (opts.tableCells) {
        lines.push(b.rows.map(r => r.map(c => blocksToText(c.blocks, opts).replace(/\n/g, ' ')).join(' | ')).join('\n'));
      } else {
        b.rows.forEach(r => lines.push(r.map(c => blocksToText(c.blocks, { ...opts, tableCells: true }).replace(/\n+/g, ' ')).join('\t')));
        lines.push('');
      }
    } else {
      let text = runsToText(b.runs, opts.math);
      if (b.list) {
        const pad = '    '.repeat(b.list.level);
        text = b.list.marker ? `${pad}${listMarker(b.list)} ${text}` : `${pad}   ${text}`;
      } else if (b.quote) text = text.split('\n').map(l => `${'> '.repeat(b.quote!)}${l}`).join('\n');
      lines.push(text);
      if (!opts.tableCells && (b.heading || (!b.list && !b.code && !b.screenplay))) lines.push('');
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
};

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

export interface ResolvedImage {
  /** raw bytes */
  data: Uint8Array;
  /** jpg | png | gif | bmp */
  type: 'jpg' | 'png' | 'gif' | 'bmp';
  dataUrl: string;
  width: number;
  height: number;
}

/** Reads pixel dimensions from PNG / JPEG / GIF / BMP headers. */
export const imageSize = (bytes: Uint8Array): { width: number; height: number; type: ResolvedImage['type'] } | null => {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) return { type: 'png', width: dv.getUint32(16), height: dv.getUint32(20) };
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49) return { type: 'gif', width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
  if (bytes.length > 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) return { type: 'bmp', width: dv.getInt32(18, true), height: Math.abs(dv.getInt32(22, true)) };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      const len = dv.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: 'jpg', height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
      }
      i += 2 + len;
    }
    return { type: 'jpg', width: 0, height: 0 };
  }
  return null;
};

const rasterize = (src: string): Promise<string | null> =>
  new Promise(resolve => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 150;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null); // tainted canvas (cross-origin)
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });

const fromDataUrl = (url: string): ResolvedImage | null => {
  const m = /^data:image\/([\w.+-]+);base64,(.*)$/i.exec(url.trim());
  if (!m) return null;
  const data = base64ToBytes(m[2].replace(/\s/g, ''));
  const info = imageSize(data);
  if (!info) return null;
  return { data, type: info.type, dataUrl: url, width: info.width, height: info.height };
};

/** Collects every image src in the blocks. */
export const collectImageSources = (blocks: Block[], out = new Set<string>()): Set<string> => {
  for (const b of blocks) {
    if (b.type === 'para') b.runs.forEach(r => r.type === 'image' && out.add(r.src));
    else if (b.type === 'table') b.rows.forEach(r => r.forEach(c => collectImageSources(c.blocks, out)));
  }
  return out;
};

/**
 * Turns every image into embeddable bytes. Base64 PNG/JPEG/GIF/BMP are used
 * directly; SVG / WebP / remote images are rasterised to PNG in the browser
 * (remote images only when CORS allows). Unresolvable images are skipped.
 */
export const resolveImages = async (blocks: Block[]): Promise<Map<string, ResolvedImage>> => {
  const map = new Map<string, ResolvedImage>();
  for (const src of collectImageSources(blocks)) {
    let resolved = fromDataUrl(src);
    if (!resolved || !resolved.width) {
      const png = await rasterize(src);
      resolved = png ? fromDataUrl(png) : resolved;
    }
    if (resolved && resolved.width && resolved.height) map.set(src, resolved);
  }
  return map;
};

/** Display size of an image run in pt, fitted into `maxWidthPt`. */
export const imageDisplaySize = (run: Extract<Run, { type: 'image' }>, img: ResolvedImage, maxWidthPt: number): { w: number; h: number } => {
  const ratio = img.height / img.width;
  let w: number;
  if (run.widthPx) w = run.widthPx * 0.75;
  else if (run.widthPct) w = (maxWidthPt * run.widthPct) / 100;
  else w = img.width * 0.75;
  let h = run.heightPx && run.widthPx ? run.heightPx * 0.75 : w * ratio;
  if (w > maxWidthPt) {
    h = h * (maxWidthPt / w);
    w = maxWidthPt;
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
};
