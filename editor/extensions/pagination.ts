import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { sectionBreaks, sectionOrientations, DEFAULT_SECTION, type SectionInfo } from './sections';

/**
 * Page layout.
 *
 * The document is one ProseMirror flow; this plugin measures it and inserts
 * "page boundary" widgets (decorations — never stored in the document) so the
 * flow is cut into real pages:
 *
 *   ┌ page N content … ┐
 *   │ filler            │  ← rest of page N's content area
 *   │ footer zone (N)   │  ← bottom margin with page N's footer
 *   ╞ gap               ╡  ← canvas between pages (hidden when printing)
 *   │ header zone (N+1) │  ← top margin with page N+1's header
 *   └ page N+1 content… ┘
 *
 * Paragraphs are split between lines; tables, images and other atoms move to
 * the next page as a whole (an atom taller than a page overflows). Explicit
 * page-break nodes force a new page.
 *
 * Sections can switch orientation: pages of the other orientation ("alt"
 * pages) are wider or narrower than the page element, so their blocks are
 * widened with node decorations and the page chrome is drawn at their size.
 *
 * Layout runs in one animation frame: remove boundaries → measure the natural
 * flow → insert boundaries → measure again and correct each boundary's height
 * so every page starts exactly where it should (margin collapsing etc.).
 */

export interface PaginationStorage {
  enabled: boolean;
  /** Full page height / width and margin in CSS px (unscaled), for the document's own orientation. */
  pageHeight: number;
  pageWidth: number;
  /** The document's own orientation; sections with the other one get swapped page sizes. */
  orientation: 'portrait' | 'landscape';
  margin: number;
  /** Space between pages on screen. */
  gap: number;
  /** Renders a header or footer zone for a page (1-based). */
  renderZone: ((kind: 'header' | 'footer', page: number, pageCount: number) => HTMLElement | null) | null;
  /** Called after every layout with the page count and the last page's footnotes. */
  onLayout: ((pageCount: number, lastPageNotes: PageNote[]) => void) | null;
  pageCount: number;
  /** Sections and the page each starts on (from the last layout). */
  sections: SectionInfo[];
  /** Signature of `sections`; widgets are rebuilt when it changes. */
  sectionsSig: string;
  /** Per page (index = page - 1): does it use the other orientation? */
  pageAlt: boolean[];
}

export interface Boundary {
  /** Document position where the widget goes. */
  pos: number;
  /** True when the boundary splits a textblock between lines. */
  inline: boolean;
  /** Horizontal offset of the containing block from the content box (px). */
  left: number;
  height: number;
  /** Page number that ends at this boundary (1-based). */
  page: number;
  /** Footnotes shown at the bottom of the page that ends here. */
  notes?: PageNote[];
  /** Page that ends here / the next page use the other orientation. */
  alt?: boolean;
  nextAlt?: boolean;
  /** Screen y (unpaginated origin = top of page 1's content) where the next page's content starts. */
  end: number;
}

/** A footnote placed at the bottom of the page its reference is on. */
export interface PageNote {
  /** Document position of the reference (identity for comparisons). */
  pos: number;
  label: string;
  content: string;
  /** Natural (unpaginated) y of the reference. */
  y: number;
  /** Rendered height of the note in the notes area. */
  height: number;
}

export interface LayoutUnit {
  /** Where a page break before this unit goes (usually right before the block). */
  pos: number;
  top: number;
  bottom: number;
  /** Content-box left of the block itself (for breaks between its lines). */
  left: number;
  /** Content-box left of the element a block-level break is inserted into. */
  parentLeft: number;
  forceBreakBefore?: boolean;
  /** Belongs to a section with the other orientation. */
  alt?: boolean;
  lines?: { top: number; bottom: number; pos: number }[];
}

interface PluginState {
  boundaries: Boundary[];
  /** Bumped when page geometry / header content changes. */
  geometry: number;
  /** Lowest document position changed since the last layout (null = clean). */
  dirtyFrom: number | null;
  /** Geometry changed since the last layout: no page after the change can be reused. */
  full: boolean;
  /** Cached widgets; rebuilt only when the boundaries change, mapped otherwise. */
  decorations: DecorationSet;
  /** Geometry version the cached widgets were built for (header text, page size…). */
  decorationsGeometry: number;
  /** Section signature the cached widgets were built for. */
  decorationsSections: string;
}

const key = new PluginKey<PluginState>('penkoPagination');
const cleanKey = 'penkoPaginationClean';

const ATOMIC_BLOCKS = new Set(['table', 'image', 'codeBlock', 'horizontalRule', 'tableOfContents', 'bibliography', 'pageBreak', 'sectionBreak']);
const CONTAINERS = new Set(['bulletList', 'orderedList', 'listItem', 'blockquote', 'div', 'taskList', 'taskItem']);

const getScale = (root: HTMLElement) => {
  const rect = root.getBoundingClientRect();
  // Not offsetWidth/Height: they are rounded to whole px, and Gecko's fractional layout
  // (A4 = 793.7px wide, content heights) then skews the scale enough to drift pages by px
  const width = parseFloat(getComputedStyle(root).width);
  return width > 0 ? rect.width / width || 1 : 1;
};

const noteHeights = new Map<string, number>();

/**
 * Footnote references (endnotes stay at the end of the document) with their
 * natural y and the height their note takes in a page's notes area. Heights
 * are measured once per (content, width) and cached.
 */
const collectNotes = (view: EditorView, natural: (y: number) => number, rootRect: DOMRect, scale: number): PageNote[] => {
  const found: { pos: number; label: string; content: string }[] = [];
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'footnote' && node.attrs.noteType !== 'endnote') found.push({ pos, label: String(node.attrs.number || ''), content: node.attrs.content || '' });
    return true;
  });
  if (!found.length) return [];
  const root = view.dom as HTMLElement;
  // unrounded (offsetWidth rounds, which can change where note text wraps)
  const width = parseFloat(getComputedStyle(root).width) || root.offsetWidth;
  const keyOf = (n: { label: string; content: string }) => `${width}|${n.label}|${n.content}`;
  const missing = found.filter(n => !noteHeights.has(keyOf(n)));
  if (missing.length && root.parentElement) {
    // Measure with the real notes markup and styles, off-screen
    const host = document.createElement('div');
    host.className = 'penko-notes-measure';
    host.style.cssText = `position:absolute;visibility:hidden;left:-100000px;top:0;width:${width}px;`;
    host.appendChild(buildNotes('div', missing));
    root.parentElement.appendChild(host);
    host.querySelectorAll<HTMLElement>('.penko-page-note').forEach((el, i) => noteHeights.set(keyOf(missing[i]), el.offsetHeight));
    host.remove();
  }
  return found
    .map(n => {
      const dom = view.nodeDOM(n.pos) as HTMLElement | null;
      const top = dom && dom.nodeType === 1 ? (dom.getBoundingClientRect().top - rootRect.top) / scale : 0;
      return { ...n, y: natural(top), height: noteHeights.get(keyOf(n)) || 0 };
    })
    .sort((a, b) => a.y - b.y);
};

/** Group client rects of a textblock into visual lines, each with the doc position that starts it. */
const measureLines = (view: EditorView, dom: HTMLElement, blockPos: number, node: PMNode, rootRect: DOMRect, scale: number, natural: (y: number) => number) => {
  // Rects of the text and inline images, ignoring page-boundary widgets already in the paragraph
  const rects: DOMRect[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n =>
      n.nodeType === 1 && (n as HTMLElement).classList.contains('penko-page-boundary') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 3) {
      if (!n.nodeValue) continue;
      range.selectNodeContents(n);
      for (const r of Array.from(range.getClientRects())) if (r.height > 0) rects.push(r);
    } else if ((n as HTMLElement).tagName === 'IMG' || (n as HTMLElement).tagName === 'BR' || (n as HTMLElement).contentEditable === 'false') {
      const r = (n as HTMLElement).getBoundingClientRect();
      if (r.height > 0) rects.push(r);
    }
  }
  const lines: { top: number; bottom: number; screenMid: number }[] = [];
  rects
    .map(r => ({ screenTop: (r.top - rootRect.top) / scale, screenBottom: (r.bottom - rootRect.top) / scale }))
    .map(r => ({ top: natural(r.screenTop), bottom: natural(r.screenBottom), screenMid: (r.screenTop + r.screenBottom) / 2 }))
    .sort((a, b) => a.top - b.top)
    .forEach(r => {
      const last = lines[lines.length - 1];
      // same visual line if it overlaps vertically by more than half
      if (last && r.top < last.bottom - Math.min(r.bottom - r.top, last.bottom - last.top) / 2) {
        last.top = Math.min(last.top, r.top);
        last.bottom = Math.max(last.bottom, r.bottom);
      } else lines.push({ top: r.top, bottom: r.bottom, screenMid: r.screenMid });
    });
  if (lines.length < 2) return undefined;
  const start = blockPos + 1;
  const end = blockPos + 1 + node.content.size;
  // posAtCoords is comparatively expensive: resolve a line's position only when asked
  return lines.map(line => {
    let cached: number | undefined;
    return {
      top: line.top,
      bottom: line.bottom,
      get pos() {
        if (cached === undefined) {
          const domRect = dom.getBoundingClientRect();
          const y = rootRect.top + line.screenMid * scale;
          const hit = view.posAtCoords({ left: domRect.left + 1, top: y });
          cached = hit && hit.pos >= start && hit.pos <= end ? hit.pos : -1;
        }
        return cached;
      },
    };
  });
};

const contentLeft = (el: HTMLElement, rootRect: DOMRect, scale: number) => {
  const cs = window.getComputedStyle(el);
  return (el.getBoundingClientRect().left - rootRect.left) / scale + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
};

function* collectUnits(view: EditorView, fromPos = 0, natural: (y: number) => number = y => y, sectionAlt: boolean[] = []): Generator<LayoutUnit> {
  const root = view.dom as HTMLElement;
  const rootRect = root.getBoundingClientRect();
  const scale = getScale(root);
  let pending: LayoutUnit[] = [];
  let forceNext = false;
  let alt = !!sectionAlt[0];

  /**
   * `breakPos`/`breakParent` redirect a break to an ancestor: a break before
   * the first block of a list item goes before the list item itself, so the
   * bullet moves to the next page with its text.
   */
  const visit = (node: PMNode, pos: number, breakPos: number, breakParent: HTMLElement) => {
    const name = node.type.name;
    if (name === 'pageBreak' || name === 'sectionBreak') {
      forceNext = true;
      return;
    }
    const dom = view.nodeDOM(pos) as HTMLElement | null;
    if (CONTAINERS.has(name) && !node.isTextblock) {
      const isItem = name === 'listItem' || name === 'taskItem';
      node.forEach((child, offset) => {
        const childPos = pos + 1 + offset;
        if (isItem && offset === 0) visit(child, childPos, breakPos, breakParent);
        else visit(child, childPos, childPos, dom || breakParent);
      });
      return;
    }
    if (!dom || dom.nodeType !== 1) return;
    const rect = dom.getBoundingClientRect();
    const top = natural((rect.top - rootRect.top) / scale);
    const bottom = natural((rect.bottom - rootRect.top) / scale);
    const splittable = node.isTextblock && !ATOMIC_BLOCKS.has(name) && bottom > top;
    // Only units that cross a page edge need their lines / offsets: compute lazily.
    let left: number | undefined;
    let parentLeft: number | undefined;
    let lines: LayoutUnit['lines'] | null = null;
    const unit = {
      pos: breakPos,
      top,
      bottom,
      forceBreakBefore: forceNext,
      alt,
      get left() {
        return (left ??= contentLeft(dom, rootRect, scale));
      },
      get parentLeft() {
        return (parentLeft ??= breakParent === root ? 0 : contentLeft(breakParent, rootRect, scale));
      },
      get lines() {
        if (lines === null) lines = splittable ? measureLines(view, dom, pos, node, rootRect, scale, natural) : undefined;
        return lines;
      },
    } as LayoutUnit;
    forceNext = false;
    pending.push(unit);
  };

  // Measured lazily, top-level block by top-level block, so layout can stop early
  const doc = view.state.doc;
  let section = 0;
  for (let i = 0, offset = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const pos = offset;
    offset += node.nodeSize;
    const isBreak = node.type.name === 'sectionBreak';
    // Blocks entirely before the re-layout point keep their existing pages
    if (pos + node.nodeSize > fromPos) visit(node, pos, pos, root);
    if (isBreak) alt = !!sectionAlt[++section];
    if (pos + node.nodeSize <= fromPos) continue;
    const batch = pending;
    pending = [];
    yield* batch;
  }
}

/**
 * Decide page boundaries from the natural (unpaginated) flow. `contentHeight`
 * is the usable height of a page, `stride` the distance between the tops of
 * two consecutive pages' content areas (page height + gap).
 */
/** Height of the separator line above a page's footnotes. */
export const NOTES_SEPARATOR = 14;

export interface PageGeometry {
  /** Usable content height of a page. */
  contentHeight: number;
  /** Distance between the content tops of this page and the next (page height + gap). */
  stride: number;
}

export const computeBoundariesDetailed = (
  units: Iterable<LayoutUnit>,
  contentHeight: number,
  stride: number,
  /** Where to resume: natural y and screen y of a page's content top, its number and orientation. */
  start?: { pageStart: number; page: number; screen?: number; alt?: boolean },
  /** Existing boundaries after the edit: once a new one matches, the rest is reused. */
  previous: Boundary[] = [],
  /** Footnote references (natural y order) whose notes must fit on the same page. */
  notes: PageNote[] = [],
  /** Geometry of pages in the other orientation (sections), default: same as the main one. */
  altGeometry?: PageGeometry,
): { fresh: Boundary[]; reused: Boundary[] | null; lastNotes: PageNote[] } => {
  let converged: Boundary[] | null = null;
  const boundaries: Boundary[] = [];
  const main: PageGeometry = { contentHeight, stride };
  const geometryOf = (alt: boolean) => (alt && altGeometry ? altGeometry : main);
  let pageStart = start ? start.pageStart : 0;
  let page = start ? start.page : 1;
  let screen = start ? (start.screen ?? (start.page - 1) * stride) : 0;
  let alt: boolean | undefined = start?.alt;
  let forceNext = false;
  // Notes whose reference is before this y are already placed on earlier pages
  let noteIdx = notes.findIndex(n => n.y >= pageStart - 0.5);
  if (noteIdx === -1) noteIdx = notes.length;

  /** Notes (and their height) referenced on the current page above `y`. */
  const notesBefore = (y: number) => {
    let h = 0;
    let i = noteIdx;
    while (i < notes.length && notes[i].y < y - 0.5) h += notes[i++].height;
    return { height: h ? h + NOTES_SEPARATOR : 0, end: i };
  };
  /** Does content ending at `bottom` fit on the current page, with its footnotes? */
  const fits = (bottom: number) => bottom - pageStart <= geometryOf(!!alt).contentHeight - notesBefore(bottom).height + 0.5;

  const breakAt = (pos: number, naturalTop: number, inline: boolean, left: number, nextAlt: boolean) => {
    const used = naturalTop - pageStart;
    const pageStride = geometryOf(!!alt).stride;
    // More than one page is consumed when an oversized atom overflowed its page
    const spans = Math.max(1, Math.ceil((used - 0.5) / pageStride));
    const placed = notesBefore(naturalTop);
    const pageNotes = notes.slice(noteIdx, placed.end);
    const b: Boundary = { pos, inline, left, height: Math.max(0, spans * pageStride - used), page: page + spans - 1, end: screen + spans * pageStride };
    if (alt) b.alt = true;
    if (nextAlt) b.nextAlt = true;
    if (pageNotes.length) b.notes = pageNotes;
    boundaries.push(b);
    noteIdx = placed.end;
    pageStart = naturalTop;
    page += spans;
    screen = b.end;
    alt = nextAlt;
    forceNext = false;
    const idx = previous.findIndex(
      o => o.pos === b.pos && o.page === b.page && o.inline === b.inline && !!o.alt === !!b.alt && !!o.nextAlt === !!b.nextAlt && Math.abs(o.end - b.end) < 0.5 && sameNotes(o.notes, b.notes),
    );
    if (idx !== -1) converged = previous.slice(idx + 1);
  };

  for (const u of units) {
    if (converged) break;
    if (alt === undefined) alt = !!u.alt;
    if (u.forceBreakBefore || forceNext) breakAt(u.pos, u.top, false, u.parentLeft, !!u.alt);
    let guard = 0;
    while (!converged && !fits(u.bottom) && guard++ < 1000) {
      const startsHere = u.top > pageStart + 0.5;
      if (u.lines && u.lines.length > 1) {
        const idx = u.lines.findIndex(l => !fits(l.bottom));
        if (idx > 0 && u.lines[idx].pos > 0 && u.lines[idx].top > pageStart + 0.5) {
          breakAt(u.lines[idx].pos, u.lines[idx].top, true, u.left, !!u.alt);
          continue;
        }
      }
      if (startsHere) {
        breakAt(u.pos, u.top, false, u.parentLeft, !!u.alt);
        continue;
      }
      // Starts at the top of a page and still doesn't fit (huge atom): it
      // overflows, and whatever follows starts on a fresh page.
      forceNext = true;
      break;
    }
  }
  return { fresh: boundaries, reused: converged, lastNotes: converged ? [] : notes.slice(noteIdx) };
};

const sameNotes = (a?: PageNote[], b?: PageNote[]) =>
  (a?.length || 0) === (b?.length || 0) && (a || []).every((n, i) => n.pos === b![i].pos && n.label === b![i].label && Math.abs(n.height - b![i].height) < 0.5);

export const computeBoundaries = (
  units: Iterable<LayoutUnit>,
  contentHeight: number,
  stride: number,
  start?: { pageStart: number; page: number; screen?: number; alt?: boolean },
  previous: Boundary[] = [],
  notes: PageNote[] = [],
  altGeometry?: PageGeometry,
): Boundary[] => {
  const { fresh, reused } = computeBoundariesDetailed(units, contentHeight, stride, start, previous, notes, altGeometry);
  return reused ? fresh.concat(reused) : fresh;
};

/**
 * Horizontal placement of a page relative to the page element: pages in the
 * other orientation are centred on it (wider or narrower).
 */
export const pageFrame = (storage: Pick<PaginationStorage, 'pageWidth' | 'pageHeight'>, alt: boolean) => {
  const width = alt ? storage.pageHeight : storage.pageWidth;
  return { left: (storage.pageWidth - width) / 2, width, height: alt ? storage.pageWidth : storage.pageHeight };
};

const buildWidget = (b: Boundary, storage: PaginationStorage, pageCount: number): HTMLElement => {
  const { margin, gap, pageWidth } = storage;
  const cur = pageFrame(storage, !!b.alt);
  const next = pageFrame(storage, !!b.nextAlt);
  const tag = b.inline ? 'span' : 'div';
  const el = document.createElement(tag);
  el.className = 'penko-page-boundary';
  el.contentEditable = 'false';
  el.setAttribute('data-page', String(b.page));
  el.style.cssText = `display:block;position:relative;width:${pageWidth}px;margin-left:${-(b.left + margin)}px;height:${b.height}px;text-indent:0;`;
  const notesEl = b.notes?.length ? buildNotes(tag, b.notes) : null;
  const notesHeight = b.notes?.length ? b.notes.reduce((h, n) => h + n.height, NOTES_SEPARATOR) : 0;
  const filler = Math.max(0, b.height - margin * 2 - gap - notesHeight);
  const zone = (cls: string, top: number, height: number, frame: { left: number; width: number }) => {
    const z = document.createElement(tag);
    z.className = cls;
    z.style.cssText = `display:block;position:absolute;left:${frame.left}px;width:${frame.width}px;top:${top}px;height:${height}px;`;
    return z;
  };
  const fillerEl = zone('penko-page-filler', 0, filler, cur);
  const notesZone = notesEl ? zone('penko-page-notes-zone', filler, notesHeight, cur) : null;
  if (notesZone && notesEl) notesZone.appendChild(notesEl);
  const footerTop = filler + notesHeight;
  const footer = zone('penko-page-footer-zone', footerTop, margin, cur);
  const footerContent = storage.renderZone?.('footer', b.page, pageCount);
  if (footerContent) footer.appendChild(footerContent);
  // The gap covers the page element's own background too when the pages around it are narrower
  const gapLeft = Math.min(0, cur.left, next.left);
  const gapRight = Math.max(pageWidth, cur.left + cur.width, next.left + next.width);
  const gapEl = zone('penko-page-gap', footerTop + margin, gap, { left: gapLeft, width: gapRight - gapLeft });
  const header = zone('penko-page-header-zone', footerTop + margin + gap, margin, next);
  const headerContent = storage.renderZone?.('header', b.page + 1, pageCount);
  if (headerContent) header.appendChild(headerContent);
  el.append(...[fillerEl, notesZone, footer, gapEl, header].filter((x): x is HTMLElement => !!x));
  return el;
};

/** The footnotes block at the bottom of a page (same markup is measured in layout). */
export const buildNotes = (tag: 'div' | 'span', notes: { label: string; content: string; pos?: number }[]): HTMLElement => {
  const list = document.createElement(tag);
  list.className = 'penko-page-notes';
  list.style.cssText = 'display:block;';
  const sep = document.createElement(tag);
  sep.className = 'penko-page-notes-separator';
  sep.style.cssText = `display:block;height:${NOTES_SEPARATOR}px;`;
  list.appendChild(sep);
  for (const n of notes) {
    const item = document.createElement(tag);
    item.className = 'penko-page-note';
    item.style.cssText = 'display:block;';
    if (n.pos !== undefined) item.setAttribute('data-note-pos', String(n.pos));
    const sup = document.createElement('sup');
    sup.textContent = n.label;
    item.append(sup, document.createTextNode(' ' + n.content));
    list.appendChild(item);
  }
  return list;
};

/** Which page each section starts on, given the page boundaries. */
export const computeSections = (doc: PMNode, boundaries: Boundary[], firstSettings: SectionInfo['settings']): SectionInfo[] => {
  const pageCount = pageCountOf(boundaries);
  const infos: SectionInfo[] = [{ index: 0, pos: null, firstPage: 1, settings: firstSettings }];
  sectionBreaks(doc).forEach((sb, i) => {
    const b = boundaries.find(x => x.pos > sb.pos);
    infos.push({ index: i + 1, pos: sb.pos, firstPage: b ? b.page + 1 : pageCount, settings: sb.settings });
  });
  return infos;
};

export const pageCountOf = (boundaries: Boundary[]) => (boundaries.length ? boundaries[boundaries.length - 1].page + 1 : 1);

const hashString = (str: string) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
const notesKey = (notes?: PageNote[]) => (notes?.length ? hashString(notes.map(n => `${n.label}|${n.content}|${Math.round(n.height)}`).join('\n')) : '');

const buildDecorations = (doc: PMNode, st: { boundaries: Boundary[]; geometry: number }, storage: PaginationStorage) => {
  const pageCount = pageCountOf(st.boundaries);
  const sectionsKey = hashString(storage.sectionsSig || '');
  if (!st.boundaries.length) return DecorationSet.empty;
  return DecorationSet.create(
    doc,
    st.boundaries.map(b =>
      Decoration.widget(b.pos, () => buildWidget(b, storage, pageCount), {
        side: -1,
        // Everything the widget's DOM depends on must be in the key, or ProseMirror reuses a stale widget
        key: `pb:${b.pos}:${b.page}:${Math.round(b.height)}:${pageCount}:${b.inline ? 1 : 0}:${Math.round(b.left)}:${st.geometry}:${sectionsKey}:${notesKey(b.notes)}:${b.alt ? 1 : 0}${b.nextAlt ? 1 : 0}`,
        ignoreSelection: true,
        stopEvent: () => true,
      }),
    ),
  );
};

/** Per section: does it use the other orientation than the document? */
const sectionAltOf = (doc: PMNode, s: Pick<PaginationStorage, 'orientation'>): boolean[] => {
  const breaks = sectionBreaks(doc);
  if (!breaks.length) return [false];
  return sectionOrientations(s.orientation, breaks.map(b => b.settings)).map(o => o !== s.orientation);
};

/** Orientation flag of every page, from the boundaries (pages spanned by an oversized atom keep theirs). */
export const pageAltOf = (boundaries: Boundary[], firstAlt: boolean): boolean[] => {
  const out: boolean[] = [];
  let alt = boundaries.length ? !!boundaries[0].alt : firstAlt;
  for (const b of boundaries) {
    while (out.length < b.page) out.push(!!b.alt);
    alt = !!b.nextAlt;
  }
  out.push(alt);
  return out;
};

/** Screen top of every page's content area (page 1 = 0), plus the total height of all pages. */
export const pageTops = (s: Pick<PaginationStorage, 'pageWidth' | 'pageHeight' | 'gap'>, pageAlt: boolean[]) => {
  const tops: number[] = [];
  let y = 0;
  for (const alt of pageAlt) {
    tops.push(y);
    y += (alt ? s.pageWidth : s.pageHeight) + s.gap;
  }
  return { tops, total: Math.max(0, y - s.gap) };
};

const widenKey = new PluginKey<DecorationSet>('penkoSectionWidth');

/**
 * Blocks of sections in the other orientation are laid out at that page
 * width: shifted left by half the difference and extended on the right
 * (relative positioning keeps each block's own margins and indents).
 */
const widenDecorations = (doc: PMNode, s: PaginationStorage): DecorationSet => {
  if (!s.enabled || s.pageHeight <= 0) return DecorationSet.empty;
  const alt = sectionAltOf(doc, s);
  if (!alt.some(Boolean)) return DecorationSet.empty;
  const d = s.pageHeight - s.pageWidth;
  const style = `position:relative;left:${-d / 2}px;margin-right:${-d}px;`;
  const decos: Decoration[] = [];
  let section = 0;
  doc.forEach((node, offset) => {
    // a section break closes its section, so it takes that section's width
    if (alt[section]) decos.push(Decoration.node(offset, offset + node.nodeSize, { style, class: 'penko-alt-section' }));
    if (node.type.name === 'sectionBreak') section++;
  });
  return DecorationSet.create(doc, decos);
};

export const Pagination = Extension.create<{}, PaginationStorage>({
  name: 'pagination',
  addStorage() {
    return { enabled: false, pageHeight: 0, pageWidth: 0, orientation: 'portrait', margin: 0, gap: 24, renderZone: null, onLayout: null, pageCount: 1, sections: [], sectionsSig: '', pageAlt: [] };
  },
  addCommands() {
    return {
      setPagination:
        (opts: Partial<PaginationStorage>) =>
        ({ tr, dispatch }: any) => {
          Object.assign((this.editor.storage as any).pagination, opts);
          if (dispatch) tr.setMeta('penkoRepaginate', true).setMeta('addToHistory', false).setMeta('preventTrack', true);
          return true;
        },
    } as any;
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const storage = () => (editor.storage as any).pagination as PaginationStorage;
    let frame = 0;
    let lastRun = 0;
    let pendingTimer = 0;

    /** Update section info (page ranges + settings) for the widgets about to be built. */
    const updateSections = (view: EditorView, boundaries: Boundary[]) => {
      const s = storage();
      s.sections = computeSections(view.state.doc, boundaries, s.sections[0]?.settings || DEFAULT_SECTION);
      s.pageAlt = pageAltOf(boundaries, !!sectionAltOf(view.state.doc, s)[0]);
      s.sectionsSig = JSON.stringify([s.sections.map(x => [x.firstPage, x.settings]), s.pageAlt]);
    };
    const apply = (view: EditorView, boundaries: Boundary[]) => {
      updateSections(view, boundaries);
      view.dispatch(view.state.tr.setMeta(key, boundaries).setMeta('addToHistory', false).setMeta('preventTrack', true));
    };
    const markClean = (view: EditorView, boundaries: Boundary[]) => {
      view.dispatch(view.state.tr.setMeta(key, boundaries).setMeta(cleanKey, true).setMeta('addToHistory', false).setMeta('preventTrack', true));
    };

    const layout = (view: EditorView) => {
      frame = 0;
      if (view.isDestroyed) return;
      if ((view as any).composing) {
        schedule(view, 150);
        return;
      }
      const s = storage();
      const current = key.getState(view.state)?.boundaries || [];
      if (!s.enabled || s.pageHeight <= 0) {
        if (current.length) markClean(view, []);
        s.pageCount = 1;
        s.onLayout?.(1, []);
        return;
      }
      const contentHeight = s.pageHeight - s.margin * 2;
      const stride = s.pageHeight + s.gap;
      // Pages of sections in the other orientation: width and height swapped
      const altGeometry = { contentHeight: s.pageWidth - s.margin * 2, stride: s.pageWidth + s.gap };
      const sectionAlt = sectionAltOf(view.state.doc, s);

      // Re-layout only from the page before the first change; earlier pages are untouched,
      // and stop as soon as a new page break matches an existing one.
      const st = key.getState(view.state)!;
      const dirty = st.dirtyFrom ?? 0;
      const before = current.filter(b => b.pos < dirty);
      const kept = before.slice(0, -1);
      const last = kept[kept.length - 1];
      // After a geometry / width change every page must be measured again (a forced break
      // at the same place would otherwise "converge" and keep stale pages after it)
      const previous = st.full ? [] : current.filter(b => b.pos > dirty);

      // Measure with the current page breaks in place, converting screen
      // positions to the natural (unpaginated) flow by removing their heights.
      const root = view.dom as HTMLElement;
      const rootRect = root.getBoundingClientRect();
      const scale = getScale(root);
      const widgetSpans = Array.from(root.querySelectorAll<HTMLElement>('.penko-page-boundary'))
        .map(w => {
          const r = w.getBoundingClientRect();
          return { bottom: (r.bottom - rootRect.top) / scale, height: r.height / scale };
        })
        .sort((a, b) => a.bottom - b.bottom);
      const natural = (y: number) => {
        let shift = 0;
        for (const w of widgetSpans) {
          if (w.bottom <= y + 0.5) shift += w.height;
          else break;
        }
        return y - shift;
      };

      const notes = collectNotes(view, natural, rootRect, scale);
      const { fresh, reused } = computeBoundariesDetailed(
        collectUnits(view, last ? last.pos : 0, natural, sectionAlt),
        contentHeight,
        stride,
        last ? { pageStart: natural(last.end), page: last.page + 1, screen: last.end, alt: !!last.nextAlt } : undefined,
        previous,
        notes,
        altGeometry,
      );
      const tail = reused || [];
      const boundaries = kept.concat(fresh, tail);
      const same =
        boundaries.length === current.length &&
        boundaries.every(
          (b, i) => b.pos === current[i].pos && b.page === current[i].page && Math.abs(b.height - current[i].height) < 0.5 && !!b.alt === !!current[i].alt && !!b.nextAlt === !!current[i].nextAlt,
        );

      const prevSig = storage().sectionsSig;
      updateSections(view, boundaries);
      if (!same || storage().sectionsSig !== prevSig) {
        apply(view, boundaries);
        // Correct each new boundary so the next page starts exactly on its page
        if (fresh.length) {
          const rr = root.getBoundingClientRect();
          const firstNewPage = last ? last.page + 1 : 1;
          const lastNewPage = fresh[fresh.length - 1].page;
          const widgets = Array.from(root.querySelectorAll<HTMLElement>('.penko-page-boundary')).filter(w => {
            const pg = Number(w.dataset.page);
            return pg >= firstNewPage && pg <= lastNewPage;
          });
          let changed = false;
          let shift = 0;
          widgets.forEach((w, i) => {
            const b = fresh[i];
            if (!b) return;
            const bottom = (w.getBoundingClientRect().bottom - rr.top) / scale + shift;
            const delta = b.end - bottom;
            if (Math.abs(delta) > 0.01) {
              b.height = Math.max(0, b.height + delta);
              shift += delta;
              changed = true;
            }
          });
          if (changed) apply(view, kept.concat(fresh.map(b => ({ ...b })), tail));
        }
      }
      markClean(view, key.getState(view.state)!.boundaries);

      s.pageCount = pageCountOf(boundaries);
      const lastBoundary = boundaries[boundaries.length - 1];
      s.onLayout?.(s.pageCount, lastBoundary ? notes.filter(n => n.pos >= lastBoundary.pos) : notes);
      lastRun = performance.now();
    };

    const schedule = (view: EditorView, delay = 0) => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(pendingTimer);
      // Throttle while typing continuously
      const since = performance.now() - lastRun;
      const wait = Math.max(delay, since < 120 ? 120 - since : 0);
      const run = () => (frame = requestAnimationFrame(() => layout(view)));
      if (wait > 0) pendingTimer = window.setTimeout(run, wait);
      else run();
    };

    return [
      new Plugin<DecorationSet>({
        key: widenKey,
        state: {
          init: (_config, state) => widenDecorations(state.doc, storage()),
          apply: (tr, value, _old, newState) => (tr.docChanged || tr.getMeta('penkoRepaginate') ? widenDecorations(newState.doc, storage()) : value),
        },
        props: {
          decorations: state => widenKey.getState(state),
        },
      }),
      new Plugin<PluginState>({
        key,
        state: {
          init: () => ({ boundaries: [], geometry: 0, dirtyFrom: 0, full: true, decorations: DecorationSet.empty, decorationsGeometry: 0, decorationsSections: '' }),
          apply: (tr, value, _old, newState) => {
            const meta = tr.getMeta(key);
            const geometryChanged = !!tr.getMeta('penkoRepaginate');
            const geometry = geometryChanged ? value.geometry + 1 : value.geometry;
            if (meta) {
              const boundaries = meta as Boundary[];
              const unchanged =
                value.decorationsGeometry === geometry &&
                value.decorationsSections === storage().sectionsSig &&
                boundaries.length === value.boundaries.length &&
                boundaries.every((b, i) => {
                  const o = value.boundaries[i];
                  return b.pos === o.pos && b.page === o.page && b.height === o.height && b.left === o.left && b.inline === o.inline && b.alt === o.alt && b.nextAlt === o.nextAlt;
                });
              return {
                boundaries,
                geometry,
                dirtyFrom: tr.getMeta(cleanKey) ? null : geometryChanged ? 0 : value.dirtyFrom,
                full: tr.getMeta(cleanKey) ? false : value.full || geometryChanged,
                decorations: unchanged ? value.decorations : buildDecorations(newState.doc, { boundaries, geometry }, storage()),
                decorationsGeometry: geometry,
                decorationsSections: storage().sectionsSig,
              };
            }
            if (tr.docChanged) {
              let dirty = value.dirtyFrom === null ? Infinity : tr.mapping.map(value.dirtyFrom, -1);
              tr.mapping.maps.forEach((map, i) => {
                const rest = tr.mapping.slice(i + 1);
                map.forEach((_oldStart, _oldEnd, newStart) => {
                  dirty = Math.min(dirty, rest.map(newStart, -1));
                });
              });
              // keep boundaries roughly in place until the next layout pass
              return {
                boundaries: value.boundaries
                  .map(b => ({ ...b, pos: tr.mapping.map(b.pos, -1), notes: b.notes?.map(n => ({ ...n, pos: tr.mapping.map(n.pos) })) }))
                  .filter(b => b.pos >= 0 && b.pos <= tr.doc.content.size),
                geometry,
                dirtyFrom: geometryChanged ? 0 : Number.isFinite(dirty) ? dirty : value.dirtyFrom,
                full: value.full || geometryChanged,
                decorations: value.decorations.map(tr.mapping, tr.doc),
                decorationsGeometry: value.decorationsGeometry,
                decorationsSections: value.decorationsSections,
              };
            }
            if (geometryChanged) return { ...value, geometry, dirtyFrom: 0, full: true };
            return value;
          },
        },
        props: {
          decorations: state => key.getState(state)?.decorations || DecorationSet.empty,
        },
        view: view => {
          schedule(view);
          const onResize = () => schedule(view, 50);
          window.addEventListener('resize', onResize);
          const onLoad = () => schedule(view, 30);
          view.dom.addEventListener('load', onLoad, true);
          document.fonts?.addEventListener?.('loadingdone', onLoad);
          const onCompositionEnd = () => schedule(view, 30);
          view.dom.addEventListener('compositionend', onCompositionEnd);
          // The page animates its width (orientation / size changes): lay out again once the width settles
          let lastWidth = 0;
          const widthObserver =
            typeof ResizeObserver !== 'undefined'
              ? new ResizeObserver(entries => {
                  const width = entries[entries.length - 1].contentRect.width;
                  if (Math.abs(width - lastWidth) < 0.5) return;
                  const first = !lastWidth;
                  lastWidth = width;
                  if (!first && !view.isDestroyed) view.dispatch(view.state.tr.setMeta('penkoRepaginate', true).setMeta('addToHistory', false).setMeta('preventTrack', true));
                })
              : null;
          widthObserver?.observe(view.dom);
          return {
            update: (v, prev) => {
              const geometryChanged = key.getState(v.state)?.geometry !== key.getState(prev)?.geometry;
              if (v.state.doc !== prev.doc || geometryChanged) schedule(v);
            },
            destroy: () => {
              if (frame) cancelAnimationFrame(frame);
              window.clearTimeout(pendingTimer);
              window.removeEventListener('resize', onResize);
              view.dom.removeEventListener('load', onLoad, true);
              document.fonts?.removeEventListener?.('loadingdone', onLoad);
              view.dom.removeEventListener('compositionend', onCompositionEnd);
              widthObserver?.disconnect();
            },
          };
        },
      }),
    ];
  },
});

/** Page number (1-based) that contains the given document position. */
export const pageAtPos = (state: any, pos: number): number => {
  const st = key.getState(state);
  if (!st) return 1;
  let page = 1;
  for (const b of st.boundaries) if (b.pos <= pos) page = b.page + 1;
  return page;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pagination: {
      setPagination: (opts: Partial<PaginationStorage>) => ReturnType;
    };
  }
}
