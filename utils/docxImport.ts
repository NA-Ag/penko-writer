/**
 * DOCX import helpers around mammoth (which converts the body only):
 * - `DOCX_STYLE_MAP`: Word styles -> HTML (headings, quotes, code, screenplay
 *   elements, page breaks).
 * - `finishDocxHtml`: turns mammoth's footnote links / page-break markers /
 *   screenplay classes into the editor's own nodes.
 * - `readDocxLayout`: what mammoth ignores — paragraph alignment, page size /
 *   orientation / margins, header / footer text with PAGE / NUMPAGES fields,
 *   "different first page" and roman page numbers, and section breaks
 *   (`markDocxSections` tags where each section ends so the breaks survive mammoth).
 */
import type JSZip from 'jszip';
import type { DocumentData, PageConfig, ParagraphStyle } from '../types';
import { builtInForWordName, builtInStyle, changedProps, newStyleId, normalizeStyle, STYLE_PROPS, type StyleProps } from './paragraphStyles';
import { escapeHtml } from '../editor/sanitize';
import { SCREENPLAY_STYLE_NAMES } from './screenplayFormatter';
import { DEFAULT_SECTION, type SectionSettings } from '../editor/extensions/sections';

/** Text placed at the end of the paragraph that closes section `i` (removed again in finishDocxHtml). */
const SECTION_MARK = (i: number) => `\u27E6penko-section-${i}\u27E7`;
const SECTION_MARK_RE = /\u27E6penko-section-(\d+)\u27E7/g;

export const DOCX_STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Title'] => p.penko-style-title:fresh",
  "p[style-name='Subtitle'] => p.penko-style-subtitle:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "p[style-name='Code'] => pre:separator('\\n')",
  ...Object.entries(SCREENPLAY_STYLE_NAMES).map(([type, name]) => `p[style-name='${name}'] => p.screenplay-${type}:fresh`),
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
  "r[style-name='Code'] => code",
  "br[type='page'] => hr.penko-page-break",
  'u => u',
  'strike => s',
  'comment-reference => !',
];

const parseBody = (html: string) => new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, 'text/html').body;

/**
 * Post-processes mammoth's HTML. Returns the HTML and whether the document
 * used screenplay styles.
 */
export const finishDocxHtml = (html: string, aligns: string[] | null, sections: SectionSettings[] = []): { html: string; screenplay: boolean } => {
  const body = parseBody(html);
  const doc = body.ownerDocument;

  // Footnotes / endnotes: <sup><a href="#footnote-1">[1]</a></sup> + <ol><li id="footnote-1">…</li></ol>
  body.querySelectorAll('a[href^="#footnote-"], a[href^="#endnote-"]').forEach(a => {
    const id = a.getAttribute('href')!.slice(1);
    const item = doc.getElementById(id);
    if (item?.tagName !== 'LI' || !/^(footnote|endnote)-ref-/.test(a.id)) return;
    item.querySelectorAll('a[href^="#footnote-ref-"], a[href^="#endnote-ref-"]').forEach(back => back.remove());
    const sup = doc.createElement('sup');
    sup.setAttribute('data-type', 'footnote');
    sup.setAttribute('data-note-type', id.startsWith('endnote') ? 'endnote' : 'footnote');
    sup.setAttribute('data-content', (item.textContent || '').replace(/\s+/g, ' ').trim());
    const target = a.parentElement?.tagName === 'SUP' ? a.parentElement : a;
    target.replaceWith(sup);
    const list = item.parentElement;
    item.remove();
    if (list && !list.children.length) list.remove();
  });

  // Page breaks: mammoth writes the marker inside the paragraph that held it.
  body.querySelectorAll('hr.penko-page-break').forEach(hr => {
    const pb = doc.createElement('div');
    pb.setAttribute('data-type', 'page-break');
    let block: Element = hr;
    while (block.parentElement && block.parentElement !== body) block = block.parentElement;
    if (block === hr) {
      hr.replaceWith(pb);
      return;
    }
    hr.remove();
    block.after(pb);
    if (!block.textContent?.trim() && !block.querySelector('img')) block.remove();
  });

  // Alignment from document.xml (only when paragraphs map 1:1 to the output blocks)
  if (aligns) {
    const blocks = Array.from(body.children);
    if (blocks.length === aligns.length && blocks.every(el => /^(P|H[1-6])$/.test(el.tagName))) {
      blocks.forEach((el, i) => {
        if (aligns[i]) (el as HTMLElement).style.textAlign = aligns[i];
      });
    }
  }

  // Section breaks: the marker ends the last paragraph of each section but the last
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const marked: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue && SECTION_MARK_RE.test(n.nodeValue)) marked.push(n as Text);
  SECTION_MARK_RE.lastIndex = 0;
  marked.forEach(text => {
    const indexes = Array.from(text.nodeValue!.matchAll(SECTION_MARK_RE), m => Number(m[1]));
    text.nodeValue = text.nodeValue!.replace(SECTION_MARK_RE, '');
    let block: Element | null = text.parentElement;
    while (block && block.parentElement !== body) block = block.parentElement;
    if (!block) return;
    let at: Element = block;
    indexes.forEach(i => {
      const div = doc.createElement('div');
      div.setAttribute('data-type', 'section-break');
      div.setAttribute('data-section', JSON.stringify(sections[i] || DEFAULT_SECTION));
      at.after(div);
      at = div;
    });
    if (!block.textContent?.trim() && !block.querySelector('img')) block.remove();
  });

  // Named styles mapped by readDocxStyles: class "penko-style-<id>" -> data-style
  body.querySelectorAll('[class*="penko-style-"]').forEach(el => {
    const cls = Array.from(el.classList).find(c => c.startsWith('penko-style-'))!;
    const id = cls.slice('penko-style-'.length);
    el.classList.remove(cls);
    if (!el.classList.length) el.removeAttribute('class');
    if (!/^(normal|heading[1-6])$/.test(id)) el.setAttribute('data-style', id);
  });

  let screenplay = false;
  body.querySelectorAll('p[class^="screenplay-"]').forEach(p => {
    const type = p.className.slice('screenplay-'.length);
    if (!(type in SCREENPLAY_STYLE_NAMES)) return;
    p.setAttribute('data-screenplay-type', type);
    screenplay = true;
  });
  return { html: body.innerHTML, screenplay };
};

/* ------------------------------------------------------------------ */
/* Layout (document.xml sectPr, headers, footers)                      */
/* ------------------------------------------------------------------ */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const wAttr = (el: Element | null | undefined, name: string) => el?.getAttributeNS(W_NS, name) ?? el?.getAttribute(`w:${name}`) ?? null;
const wChildren = (el: Element, local: string) => Array.from(el.children).filter(c => c.localName === local);
const wFirst = (el: Element | null | undefined, local: string) => (el ? (Array.from(el.getElementsByTagNameNS(W_NS, local))[0] ?? null) : null);
const isOn = (el: Element | null) => !!el && !/^(0|false|off)$/i.test(wAttr(el, 'val') || '');

const fieldPlaceholder = (instr: string) => (/\bNUMPAGES\b|\bSECTIONPAGES\b/i.test(instr) ? '{PAGES}' : /\bPAGE\b/i.test(instr) ? '{PAGE}' : null);

/** Text of a header / footer paragraph; PAGE / NUMPAGES fields become {PAGE} / {PAGES}, tabs stay '\t'. */
export const paragraphText = (p: Element): string => {
  let out = '';
  // complex fields: begin -> instrText… -> separate -> result… -> end
  const fields: { instr: string; inResult: boolean; placeholder: string | null }[] = [];
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const name = child.localName;
      if (name === 'fldSimple') {
        const ph = fieldPlaceholder(wAttr(child, 'instr') || '');
        if (ph) out += ph;
        else walk(child);
        continue;
      }
      if (name === 'fldChar') {
        const type = wAttr(child, 'fldCharType');
        if (type === 'begin') fields.push({ instr: '', inResult: false, placeholder: null });
        else if (type === 'separate' && fields.length) {
          const f = fields[fields.length - 1];
          f.inResult = true;
          f.placeholder = fieldPlaceholder(f.instr);
          if (f.placeholder) out += f.placeholder;
        } else if (type === 'end' && fields.length) {
          const f = fields.pop()!;
          if (!f.inResult && fieldPlaceholder(f.instr)) out += fieldPlaceholder(f.instr);
        }
        continue;
      }
      const field = fields[fields.length - 1];
      if (name === 'instrText') {
        if (field) field.instr += child.textContent || '';
        continue;
      }
      // hide the cached result of fields we replaced, and field instructions
      if (field && (!field.inResult || field.placeholder)) {
        if (name === 'r' || name === 'hyperlink' || name === 'smartTag') walk(child);
        continue;
      }
      if (name === 't') out += child.textContent || '';
      else if (name === 'tab') out += '\t';
      else if (name === 'br' || name === 'cr') out += ' ';
      else if (name === 'r' || name === 'hyperlink' || name === 'smartTag' || name === 'ins' || name === 'sdt' || name === 'sdtContent') walk(child);
    }
  };
  walk(p);
  return out;
};

type Where = 'header' | 'footer';

interface Zone {
  html: string;
  /** a bare page number cell found in the zone */
  number?: { position: 'left' | 'center' | 'right'; pageOf: boolean };
}

const PAGE_OF_RE = /^\S+(?:\s\S+)?\s\{PAGE\}\s\S+\s\{PAGES\}$|^\{PAGE\}\s*(?:\/|of|de|von|di|из)\s*\{PAGES\}$/i;
const numberCell = (cell: string): { pageOf: boolean } | null => {
  const c = cell.trim();
  if (c === '{PAGE}') return { pageOf: false };
  return PAGE_OF_RE.test(c) ? { pageOf: true } : null;
};

/** Header / footer paragraphs -> HTML, pulling out a lone page number as the page-number setting. */
export const zoneFromParagraphs = (texts: string[]): Zone => {
  let number: Zone['number'];
  const lines: string[] = [];
  texts.forEach((text, i) => {
    if (i === 0) {
      const parts = text.split('\t');
      // "left \t center \t right" (Word's default header tab stops, and our own export)
      if (parts.length === 3) {
        const cells = parts.map(p => p.trim());
        // a "Page X of Y" style number only counts at the sides; centred text with {PAGE} stays text
        const found = (['left', 'center', 'right'] as const).find((_, k) => numberCell(cells[k]) && (k !== 1 || cells[1] === '{PAGE}'));
        if (found) {
          const k = ['left', 'center', 'right'].indexOf(found);
          number = { position: found, pageOf: numberCell(cells[k])!.pageOf };
          cells[k] = '';
        }
        const rest = cells.filter(Boolean).join(' ');
        if (rest) lines.push(rest);
        return;
      }
      if (text.trim() === '{PAGE}' && texts.length === 1) {
        number = { position: 'center', pageOf: false };
        return;
      }
    }
    const line = text.replace(/\t+/g, ' ').trim();
    if (line) lines.push(line);
  });
  return { html: lines.map(l => `<p>${escapeHtml(l)}</p>`).join(''), number };
};

const A4 = [11906, 16838];
const LETTER = [12240, 15840];
const MARGIN_PRESETS: [PageConfig['margins'], number][] = [['none', 0], ['narrow', 720], ['normal', 1440], ['wide', 2880]];

/** Page size / orientation / margins from <w:sectPr>, snapped to the app's presets. */
export const pageConfigFromSectPr = (sectPr: Element): PageConfig | null => {
  const pgSz = wChildren(sectPr, 'pgSz')[0];
  if (!pgSz) return null;
  const w = parseInt(wAttr(pgSz, 'w') || '0', 10);
  const h = parseInt(wAttr(pgSz, 'h') || '0', 10);
  if (!w || !h) return null;
  const landscape = wAttr(pgSz, 'orient') === 'landscape' || w > h;
  const [short, long] = w < h ? [w, h] : [h, w];
  const dist = (size: number[]) => Math.abs(size[0] - short) + Math.abs(size[1] - long);
  const pgMar = wChildren(sectPr, 'pgMar')[0];
  const side = pgMar ? (parseInt(wAttr(pgMar, 'left') || '1440', 10) + parseInt(wAttr(pgMar, 'right') || '1440', 10)) / 2 : 1440;
  const margins = MARGIN_PRESETS.reduce((best, cur) => (Math.abs(cur[1] - side) < Math.abs(best[1] - side) ? cur : best))[0];
  return { size: dist(LETTER) < dist(A4) ? 'Letter' : 'A4', orientation: landscape ? 'landscape' : 'portrait', margins, cols: 1 };
};

export interface DocxLayout {
  /** per top-level body paragraph: '' | center | right | justify */
  aligns: string[] | null;
  extra: Partial<DocumentData>;
  /** Settings of every section after the first (one section break each). */
  sections: SectionSettings[];
}

/** Top-level body paragraphs that end a section (they hold a <w:sectPr> in their properties). */
const sectionEndParagraphs = (body: Element) => wChildren(body, 'p').filter(p => wChildren(wChildren(p, 'pPr')[0] || p, 'sectPr').length > 0 && wChildren(p, 'pPr').length > 0);

/**
 * Tags the paragraph that closes each section (all but the last) with a text
 * marker, so the section breaks survive mammoth. Returns the DOCX to convert
 * (unchanged when there is only one section).
 */
export const markDocxSections = async (zip: JSZip, original: ArrayBuffer): Promise<ArrayBuffer> => {
  try {
    const xml = await zip.file('word/document.xml')?.async('string');
    // a single section has only the body's own sectPr
    if (!xml || xml.split('sectPr').length <= 3) return original;
    const dom = parseXml(xml);
    const body = wFirst(dom.documentElement, 'body');
    const ends = body ? sectionEndParagraphs(body) : [];
    if (!ends.length) return original;
    ends.forEach((p, i) => {
      const r = dom.createElementNS(W_NS, 'w:r');
      const t = dom.createElementNS(W_NS, 'w:t');
      t.textContent = SECTION_MARK(i);
      r.appendChild(t);
      p.appendChild(r);
    });
    // run after the other readers: this replaces document.xml in `zip`
    zip.file('word/document.xml', new XMLSerializer().serializeToString(dom));
    return await zip.generateAsync({ type: 'arraybuffer' });
  } catch (err) {
    console.warn('[Import] DOCX sections not marked', err);
    return original;
  }
};

interface SectionLayout {
  pageConfig: PageConfig | null;
  zones: Partial<Record<Where, Zone>>;
  /** Does the section have its own header / footer part (else Word links it to the previous one)? */
  own: Record<Where, boolean>;
  roman: boolean;
  titlePg: boolean;
  startAt: number | null;
}

const readSection = async (zip: JSZip, sectPr: Element, rels: Map<string, string>): Promise<SectionLayout> => {
  const zones: Partial<Record<Where, Zone>> = {};
  const own = { header: false, footer: false };
  for (const where of ['header', 'footer'] as Where[]) {
    const ref = wChildren(sectPr, `${where}Reference`).find(r => (wAttr(r, 'type') || 'default') === 'default');
    if (!ref) continue;
    own[where] = true;
    const rid = ref.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? ref.getAttribute('r:id');
    const target = rid ? rels.get(rid) : undefined;
    if (!target) continue;
    const partXml = await zip.file(`word/${target.replace(/^\/?word\//, '').replace(/^\//, '')}`)?.async('string');
    if (!partXml) continue;
    const paras = Array.from(parseXml(partXml).getElementsByTagNameNS(W_NS, 'p'));
    const zone = zoneFromParagraphs(paras.map(paragraphText).filter(t => t.trim()));
    if (zone.html || zone.number) zones[where] = zone;
  }
  const pgNumType = wChildren(sectPr, 'pgNumType')[0];
  const start = wAttr(pgNumType, 'start');
  return {
    pageConfig: pageConfigFromSectPr(sectPr),
    zones,
    own,
    roman: /roman/i.test(wAttr(pgNumType, 'fmt') || ''),
    titlePg: isOn(wChildren(sectPr, 'titlePg')[0]),
    startAt: start !== null && start !== '' && Number.isFinite(+start) ? Math.max(0, +start) : null,
  };
};

/** Header / footer / page-number settings of one section, in the document's terms. */
const zoneSettings = (sec: SectionLayout) => {
  const out: Pick<DocumentData, 'header' | 'footer' | 'showPageNumbers' | 'pageNumberPosition' | 'pageNumberFormat'> = {};
  const { zones } = sec;
  // One page-number setting per section: prefer the footer's, keep any other as {PAGE} text
  const withNumber = (['footer', 'header'] as Where[]).find(w => zones[w]?.number);
  (['header', 'footer'] as Where[]).forEach(where => {
    const zone = zones[where];
    if (!zone) return;
    let html = zone.html;
    if (zone.number && where !== withNumber) html += `<p>${zone.number.pageOf ? '{PAGE} / {PAGES}' : '{PAGE}'}</p>`;
    if (html) out[where] = html;
  });
  if (withNumber) {
    const n = zones[withNumber]!.number!;
    out.showPageNumbers = true;
    out.pageNumberPosition = `${withNumber}-${n.position}`;
    if (n.pageOf) out.pageNumberFormat = 'page-of';
  }
  if (sec.roman && (withNumber || /\{PAGE\}/.test(`${out.header || ''}${out.footer || ''}`))) out.pageNumberFormat = 'roman';
  return out;
};

/** Reads what mammoth ignores. Never throws; missing parts are simply left out. */
export const readDocxLayout = async (zip: JSZip): Promise<DocxLayout> => {
  const extra: Partial<DocumentData> = {};
  let aligns: string[] | null = null;
  const sections: SectionSettings[] = [];
  try {
    const xml = await zip.file('word/document.xml')?.async('string');
    const body = xml ? wFirst(parseXml(xml).documentElement, 'body') : null;
    if (!body) return { aligns, extra, sections };

    aligns = wChildren(body, 'p').map(p => {
      const jc = wAttr(wFirst(wChildren(p, 'pPr')[0], 'jc'), 'val') || '';
      return jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' || jc === 'distribute' ? 'justify' : '';
    });
    if (aligns.every(a => !a)) aligns = null;

    // Sections in order: each one's <w:sectPr> closes it; the body's own is the last section
    const sectPrs = [...sectionEndParagraphs(body).map(p => wChildren(wChildren(p, 'pPr')[0], 'sectPr')[0]), wChildren(body, 'sectPr')[0]].filter(Boolean);
    if (!sectPrs.length) return { aligns, extra, sections };

    const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
    const rels = new Map<string, string>();
    if (relsXml) Array.from(parseXml(relsXml).getElementsByTagName('Relationship')).forEach(r => rels.set(r.getAttribute('Id') || '', r.getAttribute('Target') || ''));
    const layouts = await Promise.all(sectPrs.map(sp => readSection(zip, sp, rels)));

    // The first section's settings are the document's
    const first = layouts[0];
    if (first.pageConfig) extra.pageConfig = first.pageConfig;
    Object.assign(extra, zoneSettings(first));
    if (first.titlePg && (extra.header || extra.footer || extra.showPageNumbers)) extra.differentFirstPage = true;

    let orientation = first.pageConfig?.orientation || 'portrait';
    layouts.slice(1).forEach(sec => {
      const z = zoneSettings(sec);
      const ownZones = sec.own.header || sec.own.footer;
      const o = sec.pageConfig?.orientation || orientation;
      sections.push({
        ...DEFAULT_SECTION,
        header: sec.own.header ? z.header || '' : null,
        footer: sec.own.footer ? z.footer || '' : null,
        showPageNumbers: ownZones ? !!z.showPageNumbers : null,
        pageNumberPosition: ownZones && z.pageNumberPosition ? z.pageNumberPosition : null,
        pageNumberFormat: z.pageNumberFormat || (sec.roman ? 'roman' : null),
        differentFirstPage: sec.titlePg,
        restartNumbering: sec.startAt !== null,
        startAt: sec.startAt ?? 1,
        orientation: o !== orientation ? o : null,
      });
      orientation = o;
    });
  } catch (err) {
    console.warn('[Import] DOCX layout not read', err);
  }
  return { aligns, extra, sections };
};

/* ------------------------------------------------------------------ */
/* Named paragraph styles (styles.xml)                                 */
/* ------------------------------------------------------------------ */

/** Word styles that already have a mapping (or are structural) and don't become custom styles. */
const SKIP_STYLE_NAMES = /^(intense quote|code|list paragraph|toc .*|toc heading|footnote text|endnote text|header|footer|caption|bibliography|balloon text|annotation text|comment text|hyperlink|no list|normal \(web\)|table .*)$/i;

type RawProps = Partial<StyleProps> & { outline?: number };

const propsOf = (style: Element | null): RawProps => {
  const out: RawProps = {};
  if (!style) return out;
  const pPr = wChildren(style, 'pPr')[0];
  const rPr = wChildren(style, 'rPr')[0];
  if (rPr) {
    const fonts = wChildren(rPr, 'rFonts')[0];
    const font = wAttr(fonts, 'ascii') || wAttr(fonts, 'hAnsi');
    if (font) out.fontFamily = font;
    const sz = wAttr(wChildren(rPr, 'sz')[0], 'val');
    if (sz && +sz) out.fontSize = +sz / 2;
    const b = wChildren(rPr, 'b')[0];
    if (b) out.bold = isOn(b);
    const i = wChildren(rPr, 'i')[0];
    if (i) out.italic = isOn(i);
    const u = wChildren(rPr, 'u')[0];
    if (u) out.underline = (wAttr(u, 'val') || 'single') !== 'none';
    const color = wAttr(wChildren(rPr, 'color')[0], 'val');
    if (color) out.color = /^[0-9a-f]{6}$/i.test(color) && !/^0{6}$/.test(color) ? `#${color.toLowerCase()}` : null;
  }
  if (pPr) {
    const jc = wAttr(wChildren(pPr, 'jc')[0], 'val');
    if (jc) out.align = jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' || jc === 'distribute' ? 'justify' : 'left';
    const spacing = wChildren(pPr, 'spacing')[0];
    if (spacing) {
      const before = wAttr(spacing, 'before');
      const after = wAttr(spacing, 'after');
      const line = wAttr(spacing, 'line');
      const rule = wAttr(spacing, 'lineRule') || 'auto';
      if (before !== null) out.spaceBefore = +before / 20;
      if (after !== null) out.spaceAfter = +after / 20;
      if (line !== null && rule === 'auto' && +line) out.lineHeight = Math.round((+line / 240) * 100) / 100;
    }
    const ind = wChildren(pPr, 'ind')[0];
    const left = wAttr(ind, 'left') ?? wAttr(ind, 'start');
    if (left !== null && left !== undefined) out.indent = Math.max(0, +left / 20);
    const outline = wAttr(wChildren(pPr, 'outlineLvl')[0], 'val');
    if (outline !== null && +outline < 6) out.outline = +outline;
  }
  return out;
};

/** Our value when an imported one is within rounding of it (Word stores half-points and twips). */
const snap = (style: ParagraphStyle, base: ParagraphStyle): ParagraphStyle => {
  const out = { ...style };
  STYLE_PROPS.forEach(k => {
    const a = style[k];
    const b = base[k];
    if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.3) (out as any)[k] = b;
  });
  return out;
};

export interface DocxStyles {
  /** extra mammoth style-map lines (custom styles) */
  styleMap: string[];
  /** document styles to store (changed built-ins + custom styles in use) */
  styles: ParagraphStyle[];
}

/**
 * Reads word/styles.xml: Normal / Title / Subtitle / Heading 1–6 / Quote
 * become the document's versions of the built-in styles, other paragraph
 * styles used in the body become custom styles (headings when they have an
 * outline level or are based on a heading). Never throws.
 */
export const readDocxStyles = async (zip: JSZip): Promise<DocxStyles> => {
  const out: DocxStyles = { styleMap: [], styles: [] };
  try {
    const xml = await zip.file('word/styles.xml')?.async('string');
    if (!xml) return out;
    const root = parseXml(xml).documentElement;
    const byId = new Map<string, Element>();
    Array.from(root.getElementsByTagNameNS(W_NS, 'style')).forEach(el => {
      if (wAttr(el, 'type') === 'paragraph') byId.set(wAttr(el, 'styleId') || '', el);
    });
    const defaults = wFirst(root, 'docDefaults');
    const docDefaults: RawProps = defaults
      ? { ...propsOf(wFirst(defaults, 'pPrDefault')), ...propsOf(wFirst(defaults, 'rPrDefault')) }
      : {};
    const nameOf = (el: Element) => wAttr(wChildren(el, 'name')[0], 'val') || wAttr(el, 'styleId') || '';
    // docDefaults -> basedOn chain -> own properties
    const resolved = (el: Element, depth = 0): RawProps => {
      const parentId = wAttr(wChildren(el, 'basedOn')[0], 'val');
      const parent = parentId && depth < 10 ? byId.get(parentId) : undefined;
      return { ...(parent ? resolved(parent, depth + 1) : docDefaults), ...propsOf(el) };
    };
    const headingLevel = (el: Element, depth = 0): number | undefined => {
      const own = builtInForWordName(nameOf(el));
      if (own?.startsWith('heading')) return +own.slice(7);
      const parentId = wAttr(wChildren(el, 'basedOn')[0], 'val');
      const parent = parentId && depth < 10 ? byId.get(parentId) : undefined;
      return parent ? headingLevel(parent, depth + 1) : undefined;
    };

    const docXml = (await zip.file('word/document.xml')?.async('string')) || '';
    const used = new Set(Array.from(docXml.matchAll(/<w:pStyle\s+w:val="([^"]+)"/g), m => m[1]));

    const taken: ParagraphStyle[] = [];
    byId.forEach((el, id) => {
      const name = nameOf(el);
      const builtinId = builtInForWordName(name) || (id === 'Normal' ? 'normal' : undefined);
      const props = resolved(el);
      if (builtinId) {
        const base = builtInStyle(builtinId)!;
        let raw: ParagraphStyle = { ...base, ...props, id: base.id, name: base.name, kind: base.kind, level: base.level };
        // the Quote colour our export writes is the editor's own quote grey
        if (builtinId === 'quote' && raw.color === '#4b5563') raw.color = null;
        raw = snap(raw, base);
        const n = normalizeStyle(raw);
        if (n && Object.keys(changedProps(n, base)).length) out.styles.push(n);
        return;
      }
      if (!used.has(id) || !name || SKIP_STYLE_NAMES.test(name) || /['\\]/.test(name) || /^screenplay|^(scene heading|action|character|parenthetical|dialogue|transition)$/i.test(name)) return;
      const level = props.outline !== undefined ? props.outline + 1 : headingLevel(el);
      const styleId = newStyleId(name, [...taken]);
      const base = level ? builtInStyle(`heading${level}`)! : builtInStyle('normal')!;
      const n = normalizeStyle({ ...base, ...props, id: styleId, name, kind: level ? 'heading' : 'paragraph', level });
      if (!n) return;
      taken.push(n);
      out.styles.push(n);
      out.styleMap.push(`p[style-name='${name}'] => ${level ? `h${level}` : 'p'}.penko-style-${styleId}:fresh`);
    });
  } catch (err) {
    console.warn('[Import] DOCX styles not read', err);
  }
  return out;
};
